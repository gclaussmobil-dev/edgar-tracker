// lib/edgar.ts
import { XMLParser } from 'fast-xml-parser';

const NVDA_CIK = '0001045810';
const USER_AGENT = process.env.EDGAR_USER_AGENT!;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

const edgarFetch = (url: string) =>
  fetch(url, { headers: { 'User-Agent': USER_AGENT } });

// Holt alle aktuellen Filings für NVDA
export async function getNvdaSubmissions() {
  const res = await edgarFetch(
    `https://data.sec.gov/submissions/CIK${NVDA_CIK}.json`
  );
  if (!res.ok) throw new Error(`EDGAR submissions failed: ${res.status}`);
  return res.json();
}

// Holt XBRL Finanzdaten für NVDA
export async function getNvdaFinancials() {
  const res = await edgarFetch(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${NVDA_CIK}.json`
  );
  if (!res.ok) throw new Error(`EDGAR XBRL failed: ${res.status}`);
  return res.json();
}

// Extrahiert Revenue aus XBRL companyfacts JSON
// NVIDIA uses Revenues for its filings (both annual and quarterly)
// RevenueFromContractWithCustomerExcludingAssessedTax only has old 10-K data
export function extractRevenue(facts: any): { period: string; value: number }[] {
  // Combine both tags — Revenues has all current filings, the other has legacy data
  const fromRevenues = facts?.facts?.['us-gaap']?.Revenues?.units?.USD ?? [];
  const fromContract = facts?.facts?.['us-gaap']?.RevenueFromContractWithCustomerExcludingAssessedTax?.units?.USD ?? [];
  const combined = [...fromRevenues, ...fromContract];
  return combined
    .filter((r: any) => r.form === '10-Q' || r.form === '10-K')
    .map((r: any) => ({ period: r.end, value: r.val }))
    .sort((a: any, b: any) => b.period.localeCompare(a.period))
    .slice(0, 8);
}

// Extrahiert Net Income aus XBRL
export function extractNetIncome(facts: any): { period: string; value: number }[] {
  const items =
    facts?.facts?.['us-gaap']?.NetIncomeLoss?.units?.USD ?? [];
  return items
    .filter((r: any) => r.form === '10-Q' || r.form === '10-K')
    .map((r: any) => ({ period: r.end, value: r.val }))
    .sort((a: any, b: any) => b.period.localeCompare(a.period))
    .slice(0, 8);
}

// Extrahiert EPS diluted aus XBRL
export function extractEPS(facts: any): { period: string; value: number }[] {
  const items =
    facts?.facts?.['us-gaap']?.EarningsPerShareDiluted?.units?.['USD/shares'] ?? [];
  return items
    .filter((r: any) => r.form === '10-Q' || r.form === '10-K')
    .map((r: any) => ({ period: r.end, value: r.val }))
    .sort((a: any, b: any) => b.period.localeCompare(a.period))
    .slice(0, 8);
}

// Extrahiert Operating Cash Flow aus XBRL
export function extractOperatingCashFlow(facts: any): { period: string; value: number }[] {
  const items =
    facts?.facts?.['us-gaap']?.NetCashProvidedByUsedInOperatingActivities?.units?.USD ?? [];
  return items
    .filter((r: any) => r.form === '10-Q' || r.form === '10-K')
    .map((r: any) => ({ period: r.end, value: r.val }))
    .sort((a: any, b: any) => b.period.localeCompare(a.period))
    .slice(0, 8);
}

// Extrahiert Capital Expenditures aus XBRL
export function extractCapitalExpenditures(facts: any): { period: string; value: number }[] {
  const items =
    facts?.facts?.['us-gaap']?.PaymentsToAcquirePropertyPlantAndEquipment?.units?.USD ?? [];
  return items
    .filter((r: any) => r.form === '10-Q' || r.form === '10-K')
    .map((r: any) => ({ period: r.end, value: r.val }))
    .sort((a: any, b: any) => b.period.localeCompare(a.period))
    .slice(0, 8);
}

// Parst Form 4 Filings aus Submissions JSON
export function extractForm4Filings(submissions: any) {
  const recent = submissions?.filings?.recent ?? {};
  const forms: string[] = recent.form ?? [];
  const dates: string[] = recent.filingDate ?? [];
  const accessions: string[] = recent.accessionNumber ?? [];
  const docs: string[] = recent.primaryDocument ?? [];

  return forms
    .map((form, i) => ({ form, date: dates[i], accession: accessions[i], doc: docs[i] }))
    .filter((f) => f.form === '4')
    .slice(0, 20);
}

// Parst 8-K Filings
export function extract8KFilings(submissions: any) {
  const recent = submissions?.filings?.recent ?? {};
  const forms: string[] = recent.form ?? [];
  const dates: string[] = recent.filingDate ?? [];
  const accessions: string[] = recent.accessionNumber ?? [];

  return forms
    .map((form, i) => ({ form, date: dates[i], accession: accessions[i] }))
    .filter((f) => f.form === '8-K')
    .slice(0, 10);
}

// Parst 13F Filings
export function extract13FFilings(submissions: any) {
  const recent = submissions?.filings?.recent ?? {};
  const forms: string[] = recent.form ?? [];
  const dates: string[] = recent.filingDate ?? [];
  const accessions: string[] = recent.accessionNumber ?? [];

  return forms
    .map((form, i) => ({ form, date: dates[i], accession: accessions[i] }))
    .filter((f) => f.form === '13F-HR')
    .slice(0, 5);
}

// Parst 13D/13G Filings
export function extract13DGFilings(submissions: any) {
  const recent = submissions?.filings?.recent ?? {};
  const forms: string[] = recent.form ?? [];
  const dates: string[] = recent.filingDate ?? [];
  const accessions: string[] = recent.accessionNumber ?? [];

  return forms
    .map((form, i) => ({ form, date: dates[i], accession: accessions[i] }))
    .filter((f) => ['SC 13D', 'SC 13G', 'SC 13D/A', 'SC 13G/A'].includes(f.form))
    .slice(0, 10);
}

// Fetch Form 4 XML by trying multiple common document names
export async function fetchForm4Xml(accession: string): Promise<string> {
  const accessionNoDashes = accession.replace(/-/g, '');
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(NVDA_CIK)}/${accessionNoDashes}`;

  // Try primary_doc.xml first (the actual raw XML, always available for Form 4)
  // Falls back through stylesheet-transformed HTML then generic names
  const docNames = [
    'primary_doc.xml',
    'xslF345X06/wk-form4.xml',
    'xslF345X06/wk-form4_1774386816.xml',
    'xslF345X05/wk-form4.xml',
    'xslF345X04/wk-form4.xml',
    'ownership.xml',
    'form4.xml',
    'data.xml',
  ];
  for (const doc of docNames) {
    const url = `${baseUrl}/${doc}`;
    const res = await edgarFetch(url);
    if (res.ok) return res.text();
  }
  throw new Error(`Could not find Form 4 XML for accession ${accession}`);
}

// Parse Form 4 XML into structured transaction records
export function parseForm4Xml(xml: string): {
  ownerName: string;
  transactionCode: string;
  shares: number;
  pricePerShare: number;
  sharesOwnedAfter: number;
  directIndirect: string;
  transactionDate: string;
}[] {
  const parsed = xmlParser.parse(xml);
  const document = parsed['ownership-document'] ?? parsed;

  const getField = (obj: any, path: string): any => {
    return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
  };

  const results: {
    ownerName: string;
    transactionCode: string;
    shares: number;
    pricePerShare: number;
    sharesOwnedAfter: number;
    directIndirect: string;
    transactionDate: string;
  }[] = [];

  const ownerData = document['reporting-owner'] ?? document['reportingOwner'] ?? {};
  const ownerName =
    getField(ownerData, 'owner-name') ??
    getField(ownerData, 'rptOwnerName') ??
    getField(ownerData, 'reportingPerson.ownerName') ??
    'Unknown';

  const table = document['non-derivative-table'] ?? document['nonDerivativeTable'] ?? {};
  const transactions: any[] = Array.isArray(table['non-derivative-transaction'])
    ? table['non-derivative-transaction']
    : table['nonDerivativeTransaction']
      ? [table['nonDerivativeTransaction']]
      : [];

  for (const tx of transactions) {
    const amounts = tx['transaction-amounts'] ?? tx['transactionAmounts'] ?? {};
    const postTx = tx['post-transaction-amounts'] ?? tx['postTransactionAmounts'] ?? {};
    const ownership = tx['ownership-nature'] ?? tx['ownershipNature'] ?? {};

    const shares = parseInt(
      getField(amounts, 'transaction-shares.value') ??
      getField(amounts, 'transactionShares.value') ??
      '0'
    ) || 0;

    const priceRaw =
      getField(amounts, 'transaction-price-per-share.value') ??
      getField(amounts, 'transactionPricePerShare.value') ??
      '0';
    const pricePerShare = parseFloat(priceRaw) || 0;

    const sharesAfterRaw =
      getField(postTx, 'shares-owned-following-transaction.value') ??
      getField(postTx, 'sharesOwnedFollowingTransaction.value') ??
      '0';
    const sharesOwnedAfter = parseInt(sharesAfterRaw) || 0;

    const txCode =
      getField(amounts, 'transaction-code') ??
      getField(amounts, 'transactionCode') ??
      'S';

    const directIndirect =
      getField(ownership, 'direct-or-indirect-ownership.value') ??
      getField(ownership, 'directOrIndirectOwnership.value') ??
      getField(ownership, 'directIndirect.value') ??
      'D';

    const txDate =
      getField(tx, 'transaction-date') ??
      getField(tx, 'transactionDate') ??
      {};
    const transactionDate =
      getField(txDate, 'value') ??
      '';

    results.push({
      ownerName: String(ownerName),
      transactionCode: String(txCode),
      shares,
      pricePerShare,
      sharesOwnedAfter,
      directIndirect: String(directIndirect).charAt(0),
      transactionDate: String(transactionDate),
    });
  }

  return results;
}

// Fetch 13F-HR Information Table XML
export async function fetch13FInfoTableXml(accession: string): Promise<string> {
  const accessionNoDashes = accession.replace(/-/g, '');
  // Raw submission .txt file — always available
  const txtUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(NVDA_CIK)}/${accessionNoDashes}/${accession}.txt`;
  const txtRes = await edgarFetch(txtUrl);
  if (txtRes.ok) return txtRes.text();

  // Plain XML information table (correct for recent filings)
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(NVDA_CIK)}/${accessionNoDashes}`;
  const docNames = [
    'information_table.xml',
    'xslForm13F_X02/information_table.xml',
    'xslForm13F_X01/information_table.xml',
    'informdoc.xml',
    'Data.xml',
    '13f-info.xml',
    'information-table.xml',
  ];
  for (const doc of docNames) {
    const url = `${baseUrl}/${doc}`;
    const res = await edgarFetch(url);
    if (res.ok) return res.text();
  }
  throw new Error(`Could not find 13F Information Table for accession ${accession}`);
}

// Parse 13F Information Table XML
export function parse13FXml(xml: string): {
  institutionName: string;
  shares: number;
  valueUsd: number;
  pctOutstanding: number;
  soleVoting: number;
}[] {
  const parsed = xmlParser.parse(xml);
  const infoTable = parsed['informationTable'] ?? parsed;
  const entries: any[] = Array.isArray(infoTable['infoTable'])
    ? infoTable['infoTable']
    : infoTable['infoTable']
      ? [infoTable['infoTable']]
      : [];

  // NVIDIA shares outstanding ≈ 24.5B
  const NVDA_SHARES_OUTSTANDING = 24_500_000_000;

  return entries.map((entry) => {
    const name = String(
      entry['nameOfIssuer'] ??
      entry['name-of-issuer'] ??
      entry['issuerName'] ??
      'Unknown Institution'
    );
    const valueTag = entry['value'] ?? entry['marketValue'] ?? {};
    const valueUsd = (parseFloat(valueTag) || 0) * 1000; // filed in thousands

    const shrsTag = entry['shrsOrPrnAmt'] ?? entry['sharesOrPrincipalAmount'] ?? {};
    const shares = parseInt(
      shrsTag['sshPrnamt'] ??
      shrsTag['shares'] ??
      shrsTag['value'] ??
      '0'
    ) || 0;

    const votingTag = entry['votingAuthority'] ?? entry['voting-authority'] ?? {};
    const soleVoting = parseInt(
      votingTag['sole'] ??
      votingTag['Sole'] ??
      votingTag['votingAuthoritySole'] ??
      '0'
    ) || 0;

    const pctOutstanding = shares / NVDA_SHARES_OUTSTANDING;

    return { institutionName: name, shares, valueUsd, pctOutstanding, soleVoting };
  }).filter(e => e.shares > 0);
}

// Fetch 8-K XML by trying multiple common document names
export async function fetch8KXml(accession: string): Promise<string> {
  const accessionNoDashes = accession.replace(/-/g, '');
  // Raw submission .txt file — always available
  const txtUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(NVDA_CIK)}/${accessionNoDashes}/${accession}.txt`;
  const txtRes = await edgarFetch(txtUrl);
  if (txtRes.ok) return txtRes.text();

  // Fallback: try stylesheet HTML documents (8-K filings are often .htm files)
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(NVDA_CIK)}/${accessionNoDashes}`;
  const docNames = [
    '.htm',
    'form8k.xml',
    'data.xml',
    'xslForm8K.xml',
    'FilingSummary.xml',
  ];
  for (const doc of docNames) {
    const url = `${baseUrl}/${doc}`;
    const res = await edgarFetch(url);
    if (res.ok) return res.text();
  }
  throw new Error(`Could not find 8-K XML for accession ${accession}`);
}

// Parse 8-K XML (or HTML) into eventType and description
export function parse8KXml(xml: string): {
  eventType: string;
  description: string;
} {
  const parsed = xmlParser.parse(xml);
  const doc = parsed['document'] ?? parsed;

  const eventType =
    doc['documentType'] ??
    doc['document-type'] ??
    doc['form'] ??
    '8-K';

  const extractText = (obj: any): string => {
    if (typeof obj === 'string') return obj;
    if (Array.isArray(obj)) return obj.map(extractText).join(' ');
    if (obj && typeof obj === 'object') {
      const vals = Object.values(obj);
      return vals.map(extractText).join(' ');
    }
    return '';
  };

  let rawText = extractText(doc);

  // If rawText is empty (HTML parse produced no text), fall back to scanning the raw
  // HTML string directly for common 8-K patterns
  if (!rawText.trim()) {
    rawText = xml;
  }

  // For HTML documents, also try to find <sequence>.<item> patterns in raw text
  const itemPattern = /(?:Item|ITEM)\s+(\d+\.\d+|\d+[A-Z]?)\s*[:\-]?\s*([A-Z][^<\n]{0,200})/gi;
  const items: string[] = [];
  let match;
  while ((match = itemPattern.exec(rawText)) !== null) {
    items.push(`Item ${match[1]}: ${match[2].trim()}`);
  }

  const description = items.length > 0
    ? items.slice(0, 3).join('; ')
    : '8-K Filing';

  return { eventType: String(eventType), description };
}
