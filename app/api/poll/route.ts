// app/api/poll/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  getNvdaSubmissions,
  getNvdaFinancials,
  extractForm4Filings,
  extract8KFilings,
  extract13FFilings,
  extractRevenue,
  extractNetIncome,
  extractEPS,
  extractOperatingCashFlow,
  extractCapitalExpenditures,
  fetchForm4Xml,
  parseForm4Xml,
  fetch13FInfoTableXml,
  parse13FXml,
  fetch8KXml,
  parse8KXml,
} from '@/lib/edgar';
import { generateNvdaSummary } from '@/lib/claude';

// Schützt den Cron Job Endpoint vor unautorisierten Aufrufen
function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [submissions, facts] = await Promise.all([
      getNvdaSubmissions(),
      getNvdaFinancials(),
    ]);

    // Form 4: fetch all XMLs in parallel, then upsert in parallel
    const form4Filings = extractForm4Filings(submissions);
    const form4Results = await Promise.all(
      form4Filings.map(async (filing) => {
        try {
          const xml = await fetchForm4Xml(filing.accession);
          const parsed = parseForm4Xml(xml);
          return { filing, parsed, error: null };
        } catch (err) {
          console.error(`Form 4 XML failed for ${filing.accession}:`, err);
          return { filing, parsed: [], error: err };
        }
      })
    );

    // Upsert all Form 4 results in parallel
    await Promise.all(
      form4Results.flatMap(({ filing, parsed }) => {
        if (parsed.length > 0) {
          return parsed.map((tx) =>
            supabaseAdmin.from('insider_trades').upsert(
              {
                accession_number: filing.accession,
                filed_at: tx.transactionDate
                  ? new Date(tx.transactionDate).toISOString()
                  : new Date(filing.date).toISOString(),
                person_name: tx.ownerName,
                role: 'Insider',
                transaction_code: tx.transactionCode,
                shares: tx.shares,
                price_per_share: tx.pricePerShare,
                total_value: tx.shares * tx.pricePerShare,
                shares_owned_after: tx.sharesOwnedAfter,
                direct_indirect: tx.directIndirect,
              },
              { onConflict: 'accession_number', ignoreDuplicates: false }
            )
          );
        } else {
          // Fallback: preserve filing timestamp
          return [
            supabaseAdmin.from('insider_trades').upsert(
              {
                accession_number: filing.accession,
                filed_at: new Date(filing.date).toISOString(),
                person_name: 'Pending Parse',
                role: 'Unknown',
                transaction_code: 'S',
                shares: 0,
              },
              { onConflict: 'accession_number', ignoreDuplicates: false }
            ),
          ];
        }
      })
    );

    // XBRL Finanzdaten verarbeiten
    const revenues = extractRevenue(facts);
    const netIncomes = extractNetIncome(facts);
    const epsList = extractEPS(facts);
    const opCashFlows = extractOperatingCashFlow(facts);
    const capExs = extractCapitalExpenditures(facts);

    for (const rev of revenues) {
      const ni = netIncomes.find((n) => n.period === rev.period);
      const eps = epsList.find((e) => e.period === rev.period);
      const opCf = opCashFlows.find((o) => o.period === rev.period);
      const capEx = capExs.find((c) => c.period === rev.period);
      const freeCashFlow = (opCf?.value != null && capEx?.value != null)
        ? (opCf!.value - capEx!.value)
        : null;

      await supabaseAdmin
        .from('financials')
        .upsert(
          {
            period_end: rev.period,
            form_type: '10-Q',
            revenue: rev.value,
            net_income: ni?.value ?? null,
            eps_diluted: eps?.value ?? null,
            free_cash_flow: freeCashFlow,
          },
          { onConflict: 'period_end', ignoreDuplicates: false }
        );
    }

    // 13F Institutional Holdings: fetch and parse Information Table XML
    const filings13F = extract13FFilings(submissions);
    if (filings13F.length > 0) {
      const latest13F = filings13F[0];
      try {
        const xml = await fetch13FInfoTableXml(latest13F.accession);
        const holdings = parse13FXml(xml);
        for (const h of holdings) {
          await supabaseAdmin
            .from('institutional_holdings')
            .upsert(
              {
                accession_number: latest13F.accession,
                filed_at: new Date(latest13F.date).toISOString(),
                institution_name: h.institutionName,
                shares_held: h.shares,
                value_usd: h.valueUsd,
                pct_outstanding: h.pctOutstanding,
                quarter_end: new Date().toISOString().split('T')[0],
              },
              { onConflict: 'accession_number', ignoreDuplicates: false }
            );
        }
      } catch (err) {
        console.error(`Failed to fetch/parse 13F ${latest13F.accession}:`, err);
      }
    }

    // 8-K Events: fetch and parse all in parallel
    const events8K = extract8KFilings(submissions);
    const eventResults = await Promise.all(
      events8K.map(async (ev) => {
        try {
          const xml = await fetch8KXml(ev.accession);
          const { eventType, description } = parse8KXml(xml);
          return { ev, eventType, description, error: null };
        } catch (err) {
          console.error(`Failed to fetch/parse 8-K ${ev.accession}:`, err);
          return { ev, eventType: 'other', description: '8-K Filing', error: err };
        }
      })
    );

    // Upsert all 8-K events in parallel
    await Promise.all(
      eventResults.map(({ ev, eventType, description }) =>
        supabaseAdmin.from('material_events').upsert(
          {
            accession_number: ev.accession,
            filed_at: new Date(ev.date).toISOString(),
            event_type: eventType,
            description: description,
            filing_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001045810&type=8-K`,
          },
          { onConflict: 'accession_number', ignoreDuplicates: false }
        )
      )
    );

    // KI-Zusammenfassung aktualisieren
    const { data: trades } = await supabaseAdmin
      .from('insider_trades')
      .select('*')
      .order('filed_at', { ascending: false })
      .limit(5);

    const { data: holdings } = await supabaseAdmin
      .from('institutional_holdings')
      .select('*')
      .order('pct_outstanding', { ascending: false })
      .limit(5);

    const { data: financialRows } = await supabaseAdmin
      .from('financials')
      .select('*')
      .order('period_end', { ascending: false })
      .limit(4);

    if (trades && holdings && financialRows) {
      const summary = await generateNvdaSummary({
        insiderTrades: trades,
        institutionalHoldings: holdings,
        financials: financialRows,
      });
      await supabaseAdmin
        .from('ai_summary')
        .insert({ content: summary });
    }

    return NextResponse.json({ ok: true, processed: { form4: form4Filings.length, events: events8K.length } });
  } catch (err) {
    console.error('Poll error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
