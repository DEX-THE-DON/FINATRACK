import { toDecimal } from './math';
import { Decimal } from 'decimal.js';

export interface ParsedMpesaTx {
  code: string;
  type: 'INCOME' | 'EXPENSE';
  amount_kes: number;
  party: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  raw_date?: string;
  balance_kes?: number | null;
  suggested_category: string;
  description: string;
  raw_message: string;
}

/**
 * Categorizes an M-Pesa transaction based on counterparty and keywords
 */
export function categorizeMpesaParty(party: string, type: 'INCOME' | 'EXPENSE'): string {
  const p = party.toUpperCase().replace(/\./g, '');
  if (type === 'INCOME') {
    if (p.includes('BOLT') || p.includes('UBER') || p.includes('GLOVO') || p.includes('DELIVERY') || p.includes('RIDER')) {
      return 'Rider & Boda Deliveries';
    }
    return 'M-Pesa Income';
  }

  // Expenses categorization
  // 1. EV Battery Swap & Charging
  if (p.includes('SPIRO') || p.includes('ROAM') || p.includes('AMPERSAND') || p.includes('KIRI') || p.includes('ARC RIDE') || p.includes('BASIGO') || p.includes('BATTERY') || p.includes('SWAP')) {
    return 'EV Battery Swap & Charging';
  }

  // 2. Petrol & Fuel Stations
  if (p.includes('TOTAL') || p.includes('SHELL') || p.includes('RUBIS') || p.includes('PETROL') || p.includes('OIL') || p.includes('ASTON') || p.includes('HASS') || p.includes('OLA')) {
    return 'Fuel & Petrol';
  }
  if (p.includes('KPLC') || p.includes('WATER') || p.includes('INTERNET') || p.includes('SAFARICOM HOME') || p.includes('ZUKU')) {
    return 'Utilities & Bills';
  }
  if (p.includes('SUPERMARKET') || p.includes('NAIVAS') || p.includes('QUICKMART') || p.includes('CARREFOUR') || p.includes('CHOMAZ') || p.includes('HOTEL') || p.includes('CAFE') || p.includes('RESTAURANT') || p.includes('FOOD') || p.includes('KFC') || p.includes('JAVA')) {
    return 'Food & Groceries';
  }
  if (p.includes('GARAGE') || p.includes('SPARES') || p.includes('MOTOR') || p.includes('SERVICE') || p.includes('MECHANIC') || p.includes('TYRE') || p.includes('AUTO')) {
    return 'Bike Maintenance';
  }
  if (p.includes('AIRTIME') || p.includes('BUNDLES') || p.includes('SAFARICOM PREPAY') || p.includes('SAFARICOM')) {
    return 'Airtime & Internet';
  }
  if (p.includes('HOSPITAL') || p.includes('CLINIC') || p.includes('PHARMACY') || p.includes('CHEMIST')) {
    return 'Healthcare';
  }
  if (p.includes('SACCO') || p.includes('SAVINGS') || p.includes('ZIIDI') || p.includes('CIC') || p.includes('SANLAM') || p.includes('BRITAM')) {
    return 'Savings & Investments';
  }

  return 'Living Expenses';
}

/**
 * Formats Kenyan date formats (e.g. "12/9/26", "12/09/2026", "2026-09-12") to "YYYY-MM-DD"
 */
export function normalizeMpesaDate(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  const clean = dateStr.trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  // Handles DD/MM/YY or DD/MM/YYYY or D/M/YY
  const match = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    let day = match[1].padStart(2, '0');
    let month = match[2].padStart(2, '0');
    let year = match[3];
    if (year.length === 2) {
      year = '20' + year;
    }
    return `${year}-${month}-${day}`;
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * Cleans monetary string e.g. "Ksh1,500.00", "1,500.50", "Ksh. 500" into numeric float
 */
export function parseMpesaAmount(amtStr: string): number {
  if (!amtStr) return 0;
  const cleaned = amtStr.replace(/[^0-9.]/g, '');
  return parseFloat(toDecimal(cleaned).toFixed(2));
}

/**
 * Parses a single M-Pesa SMS message
 */
export function parseSingleMpesaMessage(sms: string): ParsedMpesaTx | null {
  if (!sms) return null;
  // Normalize all unicode spaces, zero-width spaces, and punctuation quirks
  let text = sms
    .replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, ' ')
    .trim();
  if (text.length < 15) return null;

  // Normalize common Safaricom punctuation quirks (e.g. "PM.New M-PESA" -> "PM. New M-PESA")
  text = text.replace(/([0-9]|AM|PM|am|pm)\.New\s+M-PESA/gi, '$1. New M-PESA');

  // Regex Patterns for M-Pesa SMS variants with flexible lookahead boundaries:
  // 1. RECEIVED
  const receivedRegex = /([A-Z0-9]{8,12})\s+(?:Confirmed\.?\s+)?(?:You have received\s+)?(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)\s+received from\s+([\s\S]+?)(?=(?:\s+on\s+\d|\s+at\s+\d|\.?\s*New M-PESA|\.$|$))/i;
  
  // 2. SENT
  const sentRegex = /([A-Z0-9]{8,12})\s+(?:Confirmed\.?\s+)?(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)\s+sent to\s+([\s\S]+?)(?=(?:\s+on\s+\d|\s+at\s+\d|\.?\s*New M-PESA|\.$|$))/i;

  // 3. PAID TO (PAYBILL / BUY GOODS / TILL)
  const paidRegex = /([A-Z0-9]{8,12})\s+(?:Confirmed\.?\s+)?(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)\s+paid to\s+([\s\S]+?)(?=(?:\s+on\s+\d|\s+at\s+\d|\.?\s*New M-PESA|\.$|$))/i;

  // 4. WITHDRAWN
  const withdrawRegex = /([A-Z0-9]{8,12})\s+(?:Confirmed\.?\s+)?(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)\s+withdrawn from\s+([\s\S]+?)(?=(?:\s+on\s+\d|\s+at\s+\d|\.?\s*New M-PESA|\.$|$))/i;

  // Date and Time pattern: "on 12/9/26 at 11:30 AM" or "on 2026-09-12 11:30"
  const dateTimeRegex = /on\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})(?:\s+at\s+(\d{1,2}:\d{2}(?:\s*(?:AM|PM|am|pm))?))?/i;

  // Balance pattern: "New M-PESA balance is Ksh5,400.00"
  const balanceRegex = /New M-PESA balance is\s+(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i;

  let code = '';
  let amount = 0;
  let party = '';
  let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';

  let match = text.match(receivedRegex);
  if (match) {
    code = match[1].toUpperCase();
    amount = parseMpesaAmount(match[2]);
    party = match[3].trim().replace(/\.+$/, '');
    type = 'INCOME';
  } else if ((match = text.match(sentRegex))) {
    code = match[1].toUpperCase();
    amount = parseMpesaAmount(match[2]);
    party = match[3].trim().replace(/\.+$/, '');
    type = 'EXPENSE';
  } else if ((match = text.match(paidRegex))) {
    code = match[1].toUpperCase();
    amount = parseMpesaAmount(match[2]);
    party = match[3].trim().replace(/\.+$/, '');
    type = 'EXPENSE';
  } else if ((match = text.match(withdrawRegex))) {
    code = match[1].toUpperCase();
    amount = parseMpesaAmount(match[2]);
    party = match[3].trim().replace(/\.+$/, '');
    type = 'EXPENSE';
  } else {
    // Fallback heuristic: match any SMS with Receipt code and Ksh amount
    const genericMatch = text.match(/([A-Z0-9]{8,12})\s+.*?(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    if (genericMatch) {
      code = genericMatch[1].toUpperCase();
      amount = parseMpesaAmount(genericMatch[2]);
      type = text.toLowerCase().includes('received') ? 'INCOME' : 'EXPENSE';
      party = 'M-Pesa Transaction';
    } else {
      return null;
    }
  }

  // Extract Date & Time
  const dtMatch = text.match(dateTimeRegex);
  const rawDate = dtMatch ? dtMatch[1] : undefined;
  const date = normalizeMpesaDate(rawDate);
  const time = dtMatch && dtMatch[2] ? dtMatch[2].trim() : undefined;

  // Extract New Balance
  const balMatch = text.match(balanceRegex);
  const balance = balMatch ? parseMpesaAmount(balMatch[1]) : null;

  // Suggested category
  const suggestedCategory = categorizeMpesaParty(party, type);

  return {
    code,
    type,
    amount_kes: amount,
    party,
    date,
    time,
    raw_date: rawDate,
    balance_kes: balance,
    suggested_category: suggestedCategory,
    description: `M-Pesa [${code}] ${type === 'INCOME' ? 'from' : 'to'} ${party}`,
    raw_message: text,
  };
}

/**
 * Extracts and parses multiple M-Pesa SMS messages pasted together
 */
export function parseMultipleMpesaMessages(rawBatchText: string): ParsedMpesaTx[] {
  if (!rawBatchText || !rawBatchText.trim()) return [];

  const text = rawBatchText
    .replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/g, ' ')
    .trim();
  const results: ParsedMpesaTx[] = [];

  // Match messages starting with alphanumeric receipt code
  const splitRegex = /(?:^|\n|\b)([A-Z0-9]{8,12})\s+(?:Confirmed|Ksh|KES|You have received|You have|paid to|sent to|withdrawn)[\s\S]*?(?=(?:(?:\n|\b)[A-Z0-9]{8,12}\s+(?:Confirmed|Ksh|KES|You have received|You have|paid to|sent to|withdrawn))|$)/gi;

  let chunks: string[] = [];
  let rMatch;
  while ((rMatch = splitRegex.exec(text)) !== null) {
    if (rMatch[0].trim().length >= 15) {
      chunks.push(rMatch[0].trim());
    }
  }

  // Fallback if regex split returned <= 1 chunk but multiple lines exist
  if (chunks.length <= 1) {
    const lineChunks = text.split(/\n+/).map(l => l.trim()).filter(l => l.length >= 15 && /[A-Z0-9]{8,12}/.test(l));
    if (lineChunks.length > chunks.length) {
      chunks = lineChunks;
    }
  }

  if (chunks.length === 0 && text.length >= 15) {
    chunks.push(text);
  }

  for (const chunk of chunks) {
    const parsed = parseSingleMpesaMessage(chunk);
    if (parsed) results.push(parsed);
  }

  return results;
}
