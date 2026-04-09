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
  // Extract the actual XML block — SEC .txt files have SGML headers before the XML.
  // e.g. "<SEC-DOCUMENT>0001199039-26-000003.txt : 20260324\r\n<SEC-HEADER>..."
  // We need the portion starting from <?xml or <ownershipDocument>
  let xmlBlock = xml;
  const xmlStart = xml.indexOf('<?xml');
  const ownershipStart = xml.indexOf('<ownershipDocument');
  const start = xmlStart >= 0 ? xmlStart : ownershipStart;
  if (start > 0) {
    xmlBlock = xml.substring(start);
  }

  // Attempt fast-xml-parser on the extracted XML block
  const parsed = xmlParser.parse(xmlBlock);
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

  // Fallback: if XML parse produced no transactions, use regex on raw txt content.
  // This handles .txt submissions where fast-xml-parser cannot parse the embedded XML.
  if (results.length === 0) {
    const ownerNameMatch = /<rptOwnerName>([^<]+)<\/rptOwnerName>/.exec(xml);
    const name = ownerNameMatch ? ownerNameMatch[1].trim() : 'Unknown';

    const txBlocks = xml.split(/<nonDerivativeTransaction>/i).slice(1);
    for (const block of txBlocks) {
      const sharesMatch = /<transactionShares>\s*<value>(\d+)<\/value>/.exec(block);
      const priceMatch = /<transactionPricePerShare>\s*<value>([\d.]+)<\/value>/.exec(block);
      const sharesAfterMatch = /<sharesOwnedFollowingTransaction>\s*<value>(\d+)<\/value>/.exec(block);
      const codeMatch = /<transactionCode>([A-Z])<[^<]*<\/transactionCode>/.exec(block);
      const directMatch = /<directOrIndirectOwnership>\s*<value>([DI])\s*<\/value>/.exec(block);
      const dateMatch = /<transactionDate>\s*<value>(\d{4}-\d{2}-\d{2})<\/value>/.exec(block);

      const shares = sharesMatch ? parseInt(sharesMatch[1]) || 0 : 0;
      const pricePerShare = priceMatch ? parseFloat(priceMatch[1]) || 0 : 0;
      const sharesOwnedAfter = sharesAfterMatch ? parseInt(sharesAfterMatch[1]) || 0 : 0;
      const transactionCode = codeMatch ? codeMatch[1] : 'S';
      const directIndirect = directMatch ? directMatch[1] : 'D';
      const transactionDate = dateMatch ? dateMatch[1] : '';

      if (shares > 0 || pricePerShare > 0) {
        results.push({
          ownerName: name,
          transactionCode,
          shares,
          pricePerShare,
          sharesOwnedAfter,
          directIndirect,
          transactionDate,
        });
      }
    }
  }

  return results;
}

// Fetch 13F-HR Information Table XML
// Accession format: 0001045810-26-000011 → folder path: 000104581026000011
// (CIK 10 digits + year 2 digits + sequence 6 digits, no dashes)
export async function fetch13FInfoTableXml(accession: string): Promise<string> {
  const parts = accession.split('-');
  const cikPart = parts[0];          // '0001045810'
  const yearPart = parts[1];         // '26'
  const seqPart = parts[2];          // '000011'
  const folder = cikPart + yearPart + seqPart; // '000104581026000011'
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(NVDA_CIK)}/${folder}`;

  // Try primary_doc.xml first (confirmed present on SEC index page)
  const primaryDoc = await edgarFetch(`${baseUrl}/primary_doc.xml`);
  if (primaryDoc.ok) return primaryDoc.text();

  // Then information_table.xml
  const infoTable = await edgarFetch(`${baseUrl}/information_table.xml`);
  if (infoTable.ok) return infoTable.text();

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
    // SEC 13F: value is reported in dollars (not thousands) for inline XBRL filings
    const valueUsd = parseFloat(String(valueTag)) || 0;

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

// Fetch 8-K document (HTML or XML)
// Accession format: 0001045810-26-000024 → folder path: 000104581026000024
export async function fetch8KXml(accession: string): Promise<string> {
  const parts = accession.split('-');
  const cikPart = parts[0];
  const yearPart = parts[1];
  const seqPart = parts[2];
  const folder = cikPart + yearPart + seqPart;
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(NVDA_CIK)}/${folder}`;

  // Try .htm first (confirmed present; naming pattern: nvda-YYYYMMDD.htm)
  const htmRes = await edgarFetch(`${baseUrl}.htm`);
  if (htmRes.ok) return htmRes.text();

  // Try primary_doc.xml
  const xmlRes = await edgarFetch(`${baseUrl}/primary_doc.xml`);
  if (xmlRes.ok) return xmlRes.text();

  throw new Error(`Could not find 8-K document for accession ${accession}`);
}

// Parse 8-K inline XBRL HTML (or plain XML) into eventType and description
export function parse8KXml(xml: string): {
  eventType: string;
  description: string;
} {
  // Attempt XML parse (for plain XML documents)
  const parsed = xmlParser.parse(xml);
  const doc = parsed['document'] ?? parsed;

  const eventType =
    doc['documentType'] ??
    doc['document-type'] ??
    doc['form'] ??
    '8-K';

  // For inline XBRL HTML, extract dei: fields from raw HTML
  const docTypeMatch = /name=["']dei:DocumentType["'][^>]*>([^<]+)</.exec(xml);
  const periodMatch = /name=["']dei:DocumentPeriodEndDate["'][^>]*>([^<]+)</.exec(xml);
  const extractedType = docTypeMatch ? docTypeMatch[1].trim() : null;
  const extractedPeriod = periodMatch ? periodMatch[1].trim() : null;

  // Extract Item numbers and descriptions from HTML headings
  const itemPattern = /(?:Item|ITEM)\s+(\d+\.\d+|\d+[A-Z]?)\s*[:\-]?\s*([^<\n]{5,200})/gi;
  const items: string[] = [];
  let match;
  while ((match = itemPattern.exec(xml)) !== null) {
    const itemNum = match[1].trim();
    const itemDesc = match[2].replace(/<[^>]+>/g, '').trim().substring(0, 80);
    if (itemDesc) items.push(`Item ${itemNum}: ${itemDesc}`);
  }

  const typeStr = extractedType ?? String(eventType);
  const periodStr = extractedPeriod ? ` (${extractedPeriod})` : '';
  const description = items.length > 0
    ? items.slice(0, 3).join('; ') + periodStr
    : `${typeStr}${periodStr}`;

  return { eventType: typeStr, description };
}
