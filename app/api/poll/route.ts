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

    // Form 4 verarbeiten
    const form4Filings = extractForm4Filings(submissions);
    for (const filing of form4Filings) {
      await supabaseAdmin
        .from('insider_trades')
        .upsert(
          {
            accession_number: filing.accession,
            filed_at: new Date(filing.date).toISOString(),
            person_name: 'Pending Parse',
            role: 'Unknown',
            transaction_code: 'S',
            shares: 0,
          },
          { onConflict: 'accession_number', ignoreDuplicates: true }
        );
    }

    // XBRL Finanzdaten verarbeiten
    const revenues = extractRevenue(facts);
    const netIncomes = extractNetIncome(facts);
    const epsList = extractEPS(facts);

    for (const rev of revenues) {
      const ni = netIncomes.find((n) => n.period === rev.period);
      const eps = epsList.find((e) => e.period === rev.period);
      await supabaseAdmin
        .from('financials')
        .upsert(
          {
            period_end: rev.period,
            form_type: '10-Q',
            revenue: rev.value,
            net_income: ni?.value ?? null,
            eps_diluted: eps?.value ?? null,
          },
          { onConflict: 'period_end', ignoreDuplicates: false }
        );
    }

    // 8-K Events verarbeiten
    const events8K = extract8KFilings(submissions);
    for (const ev of events8K) {
      await supabaseAdmin
        .from('material_events')
        .upsert(
          {
            accession_number: ev.accession,
            filed_at: new Date(ev.date).toISOString(),
            event_type: 'other',
            description: '8-K Filing',
            filing_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001045810&type=8-K`,
          },
          { onConflict: 'accession_number', ignoreDuplicates: true }
        );
    }

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
