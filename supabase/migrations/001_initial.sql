-- supabase/migrations/001_initial.sql

-- Form 4: Insider Trades
CREATE TABLE insider_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accession_number TEXT UNIQUE NOT NULL,
  filed_at TIMESTAMPTZ NOT NULL,
  person_name TEXT NOT NULL,
  role TEXT,
  transaction_code TEXT NOT NULL,
  shares BIGINT NOT NULL,
  price_per_share NUMERIC(12, 4),
  total_value NUMERIC(20, 2),
  shares_owned_after BIGINT,
  direct_indirect TEXT DEFAULT 'D',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13F: Institutionelle Holdings
CREATE TABLE institutional_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accession_number TEXT UNIQUE NOT NULL,
  filed_at TIMESTAMPTZ NOT NULL,
  institution_name TEXT NOT NULL,
  shares_held BIGINT NOT NULL,
  value_usd NUMERIC(20, 2),
  pct_outstanding NUMERIC(6, 4),
  quarter_end DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13D/13G: Große Positionen
CREATE TABLE large_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accession_number TEXT UNIQUE NOT NULL,
  filed_at TIMESTAMPTZ NOT NULL,
  filer_name TEXT NOT NULL,
  form_type TEXT NOT NULL,
  pct_ownership NUMERIC(6, 4),
  shares BIGINT,
  value_usd NUMERIC(20, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8-K: Material Events
CREATE TABLE material_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accession_number TEXT UNIQUE NOT NULL,
  filed_at TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  filing_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- XBRL: Quartalszahlen
CREATE TABLE financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_end DATE UNIQUE NOT NULL,
  form_type TEXT NOT NULL,
  revenue NUMERIC(20, 2),
  net_income NUMERIC(20, 2),
  eps_diluted NUMERIC(10, 4),
  free_cash_flow NUMERIC(20, 2),
  operating_cash_flow NUMERIC(20, 2),
  gross_profit NUMERIC(20, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- KI-Zusammenfassung
CREATE TABLE ai_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Realtime aktivieren für alle Tabellen
ALTER PUBLICATION supabase_realtime ADD TABLE insider_trades;
ALTER PUBLICATION supabase_realtime ADD TABLE institutional_holdings;
ALTER PUBLICATION supabase_realtime ADD TABLE large_positions;
ALTER PUBLICATION supabase_realtime ADD TABLE material_events;
ALTER PUBLICATION supabase_realtime ADD TABLE financials;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_summary;

-- Indices für Performance
CREATE INDEX idx_insider_trades_filed_at ON insider_trades(filed_at DESC);
CREATE INDEX idx_material_events_filed_at ON material_events(filed_at DESC);
