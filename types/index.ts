export interface InsiderTrade {
  id: string;
  accession_number: string;
  filed_at: string;
  person_name: string;
  role: string;
  transaction_code: 'P' | 'S' | 'A' | 'F' | 'G' | 'D' | 'M';
  shares: number;
  price_per_share: number | null;
  total_value: number | null;
  shares_owned_after: number | null;
  direct_indirect: 'D' | 'I';
  created_at: string;
}

export interface InstitutionalHolding {
  id: string;
  accession_number: string;
  filed_at: string;
  institution_name: string;
  shares_held: number;
  value_usd: number;
  pct_outstanding: number;
  quarter_end: string;
  created_at: string;
}

export interface LargePosition {
  id: string;
  accession_number: string;
  filed_at: string;
  filer_name: string;
  form_type: '13D' | '13G' | 'SC 13D' | 'SC 13G';
  pct_ownership: number;
  shares: number | null;
  value_usd: number | null;
  created_at: string;
}

export interface MaterialEvent {
  id: string;
  accession_number: string;
  filed_at: string;
  event_type: 'management' | 'acquisition' | 'earnings_warning' | 'other';
  description: string;
  filing_url: string;
  created_at: string;
}

export interface Financials {
  id: string;
  period_end: string;
  form_type: '10-Q' | '10-K';
  revenue: number | null;
  net_income: number | null;
  eps_diluted: number | null;
  free_cash_flow: number | null;
  operating_cash_flow: number | null;
  gross_profit: number | null;
  created_at: string;
}

export interface AISummaryRecord {
  id: string;
  content: string;
  generated_at: string;
}

export const TRANSACTION_CODE_LABELS: Record<InsiderTrade['transaction_code'], string> = {
  P: 'Direktkauf — stärkstes Bullish-Signal',
  S: 'Marktverkauf',
  A: 'Award / Gehaltsaktien (neutral)',
  F: 'Steuerabgabe (neutral, erzwungen)',
  G: 'Gift / Schenkung (neutral)',
  D: 'Disposition (neutral)',
  M: 'Option ausgeübt',
};
