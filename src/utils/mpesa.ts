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
  const p = party.toUpperCase();
  if (type === 'INCOME') {
    if (p.includes('BOLT') || p.includes('UBER') || p.includes('GLOVO') || p.includes('DELIVERY') || p.includes('RIDER')) {
      return 'Rider & Boda Deliveries';
    }
    return 'M-Pesa Income';
  }

  // Expenses categorization
  if (p.includes('TOTAL') || p.includes('SHELL') || p.includes('RUBIS') || p.includes('PETROL') || p.includes('OIL') || p.includes('ASTON')) {
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
  if (p.includes('AIRTIME') || p.includes('BUNDLES') || p.includes('SAFARICOM PREPAY')) {
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
  const text = sms.trim();
  if (!text || text.length < 15) return null;

  // Regex Patterns for M-Pesa SMS variants:
  // 1. RECEIVED: "QA12345678 Confirmed. Ksh1,500.00 received from JOHN DOE 0712345678 on 12/9/26 at 11:30 AM."
  const receivedRegex = /([A-Z0-9]{8,12})\s+(?:Confirmed\.\s+)?(?:You have received\s+)?(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)\s+received from\s+([^.]+?)(?:\s+on|\s+at|\s+New M-PESA balance|\.)/i;
  
  // 2. SENT: "QA98765432 Confirmed. Ksh500.00 sent to JANE DOE 0723456789 on 12/9/26 at 2:15 PM."
  const sentRegex = /([A-Z0-9]{8,12})\s+(?:Confirmed\.\s+)?(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)\s+sent to\s+([^.]+?)(?:\s+on|\s+at|\s+New M-PESA balance|\.)/i;

  // 3. PAID TO (PAYBILL / BUY GOODS / TILL): "QB12345678 Confirmed. Ksh750.00 paid to TOTAL ENERGIES. on 12/9/26"
  const paidRegex = /([A-Z0-9]{8,12})\s+(?:Confirmed\.\s+)?(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)\s+paid to\s+([^.]+?)(?:\s+on|\s+at|\s+New M-PESA balance|\.)/i;

  // 4. WITHDRAWN: "QC12345678 Confirmed. Ksh1,000.00 withdrawn from 123456 - AGENT NAME on ..."
  const withdrawRegex = /([A-Z0-9]{8,12})\s+(?:Confirmed\.\s+)?(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)\s+withdrawn from\s+([^.]+?)(?:\s+on|\s+at|\s+New M-PESA balance|\.)/i;

  // Date and Time pattern: "on 12/9/26 at 11:30 AM" or "on 2026-09-12 11:30"
  const dateTimeRegex = /on\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})(?:\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?))?/i;

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
    party = match[3].trim();
    type = 'INCOME';
  } else if ((match = text.match(sentRegex))) {
    code = match[1].toUpperCase();
    amount = parseMpesaAmount(match[2]);
    party = match[3].trim();
    type = 'EXPENSE';
  } else if ((match = text.match(paidRegex))) {
    code = match[1].toUpperCase();
    amount = parseMpesaAmount(match[2]);
    party = match[3].trim();
    type = 'EXPENSE';
  } else if ((match = text.match(withdrawRegex))) {
    code = match[1].toUpperCase();
    amount = parseMpesaAmount(match[2]);
    party = match[3].trim();
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

  const text = rawBatchText.trim();
  const results: ParsedMpesaTx[] = [];

  // Match messages starting with 8-12 character alphanumeric receipt code e.g. "QA12345678" or split by lines
  // Split using regex lookahead for standard M-Pesa receipt codes
  const chunks = text.split(/(?=[A-Z0-9]{8,12}\s+(?:Confirmed|You have received))/i).filter(c => c.trim().length > 0);

  if (chunks.length > 1) {
    for (const chunk of chunks) {
      const parsed = parseSingleMpesaMessage(chunk);
      if (parsed) results.push(parsed);
    }
  } else {
    // Alternatively split by lines or double newlines
    const lines = text.split(/\n\s*\n|\r\n\s*\r\n/).filter(l => l.trim().length > 0);
    for (const line of lines) {
      const parsed = parseSingleMpesaMessage(line);
      if (parsed) results.push(parsed);
    }
  }

  // If still single block, try parsing the whole block
  if (results.length === 0) {
    const single = parseSingleMpesaMessage(text);
    if (single) results.push(single);
  }

  return results;
}
