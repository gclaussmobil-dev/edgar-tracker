// lib/edgar.ts
import { XMLParser } from 'fast-xml-parser';

const NVDA_CIK = '0001045810';
const NVDA_CUSIP = '67066G104';
const NVDA_SHARES_OUTSTANDING = 24_500_000_000;
const USER_AGENT = process.env.EDGAR_USER_AGENT!;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,  // strips ns1:, xbrli: etc. so tag lookup works uniformly
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

// Accession format: 0001199039-26-000003 → folder: 000119903926000003
function accessionToFolder(accession: string): string {
  const parts = accession.split('-');
  return parts[0] + parts[1] + parts[2]; // cik(10) + year(2) + seq(6)
}

// Curated list of the top institutional NVDA holders by EDGAR CIK.
// The EDGAR EFTS relevance search does not surface these large institutions
// (they have 10,000+ holdings so NVDA ranks low in text relevance).
const MAJOR_NVDA_HOLDER_CIKS: { cik: string; fallbackName: string }[] = [
  { cik: '0000102909', fallbackName: 'Vanguard Group' },
  { cik: '0001422848', fallbackName: 'Capital Research Global Investors' },
  { cik: '0000093751', fallbackName: 'State Street' },
  { cik: '0001214717', fallbackName: 'Geode Capital Management' },
  { cik: '0000315066', fallbackName: 'FMR LLC' },
  { cik: '0000895421', fallbackName: 'Morgan Stanley' },
  { cik: '0000080255', fallbackName: 'T. Rowe Price Associates' },
  { cik: '0001374170', fallbackName: 'Norges Bank' },
];

// Fetch the latest 13F-HR accession for each major NVDA holder from their submissions.json.
export async function fetchMajorNvdaHolderAccessions(): Promise<{
  cik: string;
  accession: string;
  entityName: string;
  fileDate: string;
  periodEnding: string;
}[]> {
  const results = await Promise.all(
    MAJOR_NVDA_HOLDER_CIKS.map(async ({ cik, fallbackName }) => {
      try {
        const res = await edgarFetch(`https://data.sec.gov/submissions/CIK${cik}.json`);
        if (!res.ok) return null;
        const data = await res.json();
        const recent = data.filings?.recent ?? {};
        const forms: string[] = recent.form ?? [];
        const dates: string[] = recent.filingDate ?? [];
        const reportDates: string[] = recent.reportDate ?? [];
        const accessions: string[] = recent.accessionNumber ?? [];
        const idx = forms.findIndex((f) => f === '13F-HR');
        if (idx === -1) return null;
        return {
          cik,
          accession: accessions[idx],
          entityName: String(data.name ?? fallbackName),
          fileDate: dates[idx] ?? '',
          periodEnding: reportDates[idx] ?? '',
        };
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean) as {
    cik: string; accession: string; entityName: string; fileDate: string; periodEnding: string;
  }[];
}

// Fetch the information table XML for an institution's 13F filing.
// Parses the filing index to find the correct filename — large filers use
// non-standard names (e.g. Vanguard: 13F_0000102909_20251231.xml).
export async function fetchInstitutionInfoTable(cik: string, accession: string): Promise<string> {
  const folder = accessionToFolder(accession);
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${folder}`;

  // Parse the index page to find the INFORMATION TABLE document
  const indexRes = await edgarFetch(`${baseUrl}/${accession}-index.htm`);
  if (indexRes.ok) {
    const indexHtml = await indexRes.text();
    // The index lists documents as: href="...filename.xml"...>...INFORMATION TABLE
    const match = /href="([^"]+)"[^>]*>[^<]*<\/a><\/td>[^<]*<td[^>]*>INFORMATION TABLE/i.exec(indexHtml);
    if (match) {
      const filename = match[1].split('/').pop() ?? '';
      if (filename) {
        const fileRes = await edgarFetch(`${baseUrl}/${filename}`);
        if (fileRes.ok) return fileRes.text();
      }
    }
  }

  // Fallback: try common filenames used by smaller filers
  for (const filename of ['infotable.xml', 'information_table.xml']) {
    const res = await edgarFetch(`${baseUrl}/${filename}`);
    if (res.ok) return res.text();
  }
  throw new Error(`Could not find info table for ${cik}/${accession}`);
}

// Parse an institution's 13F info table and sum all direct NVDA positions.
// An institution may report NVDA split across multiple sub-managers — all are summed.
export function findNvdaInInfoTable(xml: string): {
  shares: number;
  valueUsd: number;
  pctOutstanding: number;
  soleVoting: number;
} | null {
  const parsed = xmlParser.parse(xml);
  const infoTable = parsed['informationTable'] ?? parsed;
  const rawEntries = infoTable['infoTable'];
  const entries: any[] = Array.isArray(rawEntries) ? rawEntries : rawEntries ? [rawEntries] : [];

  // All direct NVDA entries (skip options/puts/calls)
  const nvdaEntries = entries.filter(
    (e) =>
      !e['putCall'] &&
      (String(e['cusip'] ?? '').replace(/\s/g, '') === NVDA_CUSIP ||
        String(e['nameOfIssuer'] ?? '').toUpperCase().includes('NVIDIA'))
  );
  if (nvdaEntries.length === 0) return null;

  // Sum across all sub-manager entries
  let totalShares = 0;
  let totalValue = 0;
  let totalSoleVoting = 0;
  for (const entry of nvdaEntries) {
    const shrsTag = entry['shrsOrPrnAmt'] ?? {};
    const rawShares = shrsTag['sshPrnamt'] ?? '0';
    totalShares +=
      parseInt(typeof rawShares === 'object' ? (rawShares['#text'] ?? '0') : String(rawShares)) || 0;
    const rawValue = entry['value'] ?? '0';
    const valueStr = typeof rawValue === 'object' ? (rawValue['#text'] ?? '0') : String(rawValue);
    totalValue += parseFloat(valueStr) || 0;
    const votingTag = entry['votingAuthority'] ?? {};
    totalSoleVoting +=
      parseInt(votingTag['Sole'] ?? votingTag['sole'] ?? votingTag['votingAuthoritySole'] ?? '0') || 0;
  }

  const pctOutstanding = totalShares / NVDA_SHARES_OUTSTANDING;
  return { shares: totalShares, valueUsd: totalValue, pctOutstanding, soleVoting: totalSoleVoting };
}

// Fetch Form 4 XML — .txt raw submission is most reliable
export async function fetchForm4Xml(accession: string): Promise<string> {
  const folder = accessionToFolder(accession);
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(NVDA_CIK)}/${folder}`;

  // Try .txt raw submission first (confirmed present for all Form 4 filings)
  const txtRes = await edgarFetch(`${baseUrl}/${accession}.txt`);
  if (txtRes.ok) return txtRes.text();

  // Fallback: try stylesheet-transformed XML with known naming pattern
  const docNames = [
    'primary_doc.xml',
    'xslF345X06/wk-form4.xml',
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
  // fast-xml-parser preserves exact tag names; SEC Form 4 uses camelCase keys
  const document = parsed['ownershipDocument'] ?? parsed;

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
    getField(ownerData, 'reportingOwnerId.rptOwnerName') ??
    getField(ownerData, 'owner-name') ??
    getField(ownerData, 'rptOwnerName') ??
    getField(ownerData, 'reportingPerson.ownerName') ??
    'Unknown';

  const table = document['non-derivative-table'] ?? document['nonDerivativeTable'] ?? {};
  const rawTx = table['nonDerivativeTransaction'] ?? table['non-derivative-transaction'];
  const transactions: any[] = Array.isArray(rawTx) ? rawTx : rawTx ? [rawTx] : [];

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

    const coding = tx['transactionCoding'] ?? tx['transaction-coding'] ?? {};
    const txCode = coding['transactionCode'] ?? coding['transaction-code'] ?? 'S';

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
export async function fetch13FInfoTableXml(accession: string): Promise<string> {
  const folder = accessionToFolder(accession);
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(NVDA_CIK)}/${folder}`;

  // Try information_table.xml first (contains actual holdings data)
  const infoTable = await edgarFetch(`${baseUrl}/information_table.xml`);
  if (infoTable.ok) return infoTable.text();

  // Fallback: primary_doc.xml (contains metadata, not holdings)
  const primaryDoc = await edgarFetch(`${baseUrl}/primary_doc.xml`);
  if (primaryDoc.ok) return primaryDoc.text();

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
    // value can be a string, number, or { '#text': string } object
    const rawValue = entry['value'] ?? entry['marketValue'] ?? {};
    const valueStr = typeof rawValue === 'object' ? (rawValue['#text'] ?? JSON.stringify(rawValue)) : String(rawValue);
    const valueUsd = parseFloat(valueStr) || 0;

    const shrsTag = entry['shrsOrPrnAmt'] ?? entry['sharesOrPrincipalAmount'] ?? {};
    const rawShares = shrsTag['sshPrnamt'] ?? shrsTag['shares'] ?? shrsTag['value'] ?? '0';
    const shares = parseInt(typeof rawShares === 'object' ? (rawShares['#text'] ?? '0') : String(rawShares)) || 0;

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

// Fetch 8-K document — .htm inline XBRL has shallow nesting; .txt can be deeply nested
export async function fetch8KXml(accession: string): Promise<string> {
  const folder = accessionToFolder(accession);
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(NVDA_CIK)}/${folder}`;

  // Try .htm first (inline XBRL with shallow nesting — safe for fast-xml-parser)
  const htmRes = await edgarFetch(`${baseUrl}.htm`);
  if (htmRes.ok) return htmRes.text();

  // Fallback: primary_doc.xml (often a flat XBRL document)
  const xmlRes = await edgarFetch(`${baseUrl}/primary_doc.xml`);
  if (xmlRes.ok) return xmlRes.text();

  // Last resort: .txt (deeply nested, may exceed parser limits)
  const txtRes = await edgarFetch(`${baseUrl}/${accession}.txt`);
  if (txtRes.ok) return txtRes.text();

  throw new Error(`Could not find 8-K document for accession ${accession}`);
}

// Parse 8-K inline XBRL HTML (or plain XML) into eventType and description
// Falls back to regex when XML parse fails (e.g. Maximum nested tags exceeded)
export function parse8KXml(xml: string): {
  eventType: string;
  description: string;
} {
  let docType = '8-K';
  let periodEnd = '';

  try {
    const parsed = xmlParser.parse(xml);
    const doc = parsed['document'] ?? parsed;
    docType = doc['documentType'] ?? doc['document-type'] ?? doc['form'] ?? '8-K';
    periodEnd = doc['periodOfReport'] ?? doc['documentPeriodEndDate'] ?? '';
  } catch {
    // XML parse failed — use regex on raw text for inline XBRL HTML
  }

  // Extract dei: fields from inline XBRL HTML
  const docTypeMatch = /name=["']dei:DocumentType["'][^>]*>([^<]+)</.exec(xml);
  const periodMatch = /name=["']dei:DocumentPeriodEndDate["'][^>]*>([^<]+)</.exec(xml);
  if (docTypeMatch) docType = docTypeMatch[1].trim();
  if (periodMatch) periodEnd = periodMatch[1].trim();

  // Extract Item numbers and descriptions from HTML/text
  const itemPattern = /(?:Item|ITEM)\s+(\d+\.\d+|\d+[A-Z]?)\s*[:\-]?\s*([^<\n]{5,200})/gi;
  const items: string[] = [];
  let match;
  while ((match = itemPattern.exec(xml)) !== null) {
    const itemNum = match[1].trim();
    const itemDesc = match[2].replace(/<[^>]+>/g, '').trim().substring(0, 80);
    if (itemDesc) items.push(`Item ${itemNum}: ${itemDesc}`);
  }

  const periodStr = periodEnd ? ` (${periodEnd})` : '';
  const description = items.length > 0
    ? items.slice(0, 3).join('; ') + periodStr
    : `${docType}${periodStr}`;

  return { eventType: docType, description };
}
