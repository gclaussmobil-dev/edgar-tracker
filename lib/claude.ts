import Anthropic from '@anthropic-ai/sdk';
import type { InsiderTrade, InstitutionalHolding, Financials } from '@/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateNvdaSummary(data: {
  insiderTrades: InsiderTrade[];
  institutionalHoldings: InstitutionalHolding[];
  financials: Financials[];
}): Promise<string> {
  const latestFinancials = data.financials[0];
  const recentTrades = data.insiderTrades.slice(0, 5);
  const topHolders = data.institutionalHoldings.slice(0, 3);

  const prompt = `Analysiere diese SEC EDGAR Daten für NVIDIA (NVDA) und schreibe eine Zusammenfassung in 3-5 Sätzen für einen Retail Day Trader.

Fokus auf: Was bedeuten die Insider-Transaktionen (echte Käufe P vs. Steuerabgaben F), wie ist die institutionelle Stimmung, was sagen die letzten Quartalszahlen?

Sei direkt, konkret und vermeide Fachjargon. Schreibe auf Deutsch.

INSIDER TRADES (letzte 5):
${recentTrades.map((t) => `${t.person_name} (${t.role}): ${t.transaction_code} — ${t.shares.toLocaleString()} Aktien @ $${t.price_per_share ?? 'N/A'} = $${t.total_value?.toLocaleString() ?? 'N/A'}`).join('\n')}

TOP INSTITUTIONELLE HOLDER:
${topHolders.map((h) => `${h.institution_name}: ${h.pct_outstanding}% (${h.shares_held.toLocaleString()} Aktien)`).join('\n')}

LETZTE QUARTALSZAHLEN (${latestFinancials?.period_end ?? 'N/A'}):
Umsatz: $${latestFinancials?.revenue?.toLocaleString() ?? 'N/A'}
Net Income: $${latestFinancials?.net_income?.toLocaleString() ?? 'N/A'}
EPS: $${latestFinancials?.eps_diluted ?? 'N/A'}
FCF: $${latestFinancials?.free_cash_flow?.toLocaleString() ?? 'N/A'}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  return (message.content[0] as { type: 'text'; text: string }).text;
}
