import { toDecimal } from './math';
import { Decimal } from 'decimal.js';

export interface ParsedBankTx {
  code: string;
  bank_name: 'EQUITY' | 'KCB' | 'COOP' | 'NCBA' | 'OTHER_BANK';
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
 * Categorize bank transaction party
 */
export function categorizeBankParty(party: string, type: 'INCOME' | 'EXPENSE'): string {
  const p = party.toUpperCase().replace(/\./g, '');
  if (type === 'INCOME') {
    if (p.includes('BOLT') || p.includes('UBER') || p.includes('GLOVO') || p.includes('DELIVERY') || p.includes('RIDER') || p.includes('LITTLE')) {
      return 'Rider & Boda Deliveries';
    }
    if (p.includes('SALARY') || p.includes('PAYROLL')) {
      return 'Salary & Income';
    }
    return 'Bank Deposit & Inflow';
  }

  // Expenses
  if (p.includes('SPIRO') || p.includes('ROAM') || p.includes('AMPERSAND') || p.includes('KIRI') || p.includes('ARC RIDE') || p.includes('BASIGO') || p.includes('SWAP')) {
    return 'EV Battery Swap & Charging';
  }
  if (p.includes('TOTAL') || p.includes('SHELL') || p.includes('RUBIS') || p.includes('PETROL') || p.includes('OIL') || p.includes('HASS') || p.includes('OLA') || p.includes('ENERGIES')) {
    return 'Fuel & Petrol';
  }
  if (p.includes('KPLC') || p.includes('WATER') || p.includes('INTERNET') || p.includes('ZUKU') || p.includes('SAFARICOM HOME') || p.includes('KENYA POWER')) {
    return 'Utilities & Bills';
  }
  if (p.includes('SUPERMARKET') || p.includes('NAIVAS') || p.includes('QUICKMART') || p.includes('CARREFOUR') || p.includes('FOOD') || p.includes('HOTEL') || p.includes('RESTAURANT') || p.includes('JAVA')) {
    return 'Food & Groceries';
  }
  if (p.includes('PHARMACY') || p.includes('HOSPITAL') || p.includes('CHEMIST') || p.includes('CLINIC')) {
    return 'Health & Medical';
  }
  if (p.includes('SPARE') || p.includes('GARAGE') || p.includes('AUTO') || p.includes('TYRE') || p.includes('MECHANIC') || p.includes('SERVICE')) {
    return 'Vehicle Maintenance';
  }

  return 'Living Expenses';
}

/**
 * Normalizes date string DD/MM/YYYY or YYYY-MM-DD to YYYY-MM-DD
 */
function normalizeDate(rawDateStr: string): string {
  const parts = rawDateStr.split(/[\/\-\.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      // DD/MM/YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Parses an Equity Bank SMS
 */
function parseEquityMessage(text: string): ParsedBankTx | null {
  const isCredit = /credited with (?:KES|Ksh)\s*([\d,]+\.?\d*)/i.test(text);
  const isDebit = /debited with (?:KES|Ksh)\s*([\d,]+\.?\d*)/i.test(text);

  if (!isCredit && !isDebit) return null;

  const type: 'INCOME' | 'EXPENSE' = isCredit ? 'INCOME' : 'EXPENSE';
  const amtMatch = text.match(/(?:credited|debited)\s+with\s+(?:KES|Ksh)\s*([\d,]+\.?\d*)/i);
  if (!amtMatch) return null;

  const amount_kes = parseFloat(amtMatch[1].replace(/,/g, ''));
  if (isNaN(amount_kes) || amount_kes <= 0) return null;

  // Reference code
  const refMatch = text.match(/Ref:?\s*([A-Za-z0-9]+)/i);
  const code = refMatch ? refMatch[1].toUpperCase() : 'EQ' + Math.random().toString(36).substring(2, 9).toUpperCase();

  // Date and optional time
  const dateMatch = text.match(/on\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/i);
  const date = dateMatch ? normalizeDate(dateMatch[1]) : new Date().toISOString().slice(0, 10);
  const time = dateMatch && dateMatch[2] ? dateMatch[2].slice(0, 5) : undefined;

  // Party
  let party = 'Equity Bank Customer';
  if (isCredit) {
    const fromMatch = text.match(/from\s+([^.\n\r]+?)(?:\s+Ref|\.|$)/i);
    if (fromMatch) party = fromMatch[1].trim();
  } else {
    const paidMatch = text.match(/(?:paid to|to)\s+([^.\n\r]+?)(?:\s+Ref|\.|$)/i);
    if (paidMatch) party = paidMatch[1].trim();
  }

  // Balance
  const balMatch = text.match(/(?:Available Bal|Bal(?:ance)?):?\s*(?:KES|Ksh)\s*([\d,]+\.?\d*)/i);
  const balance_kes = balMatch ? parseFloat(balMatch[1].replace(/,/g, '')) : null;

  const suggested_category = categorizeBankParty(party, type);
  const description = `${type === 'INCOME' ? 'Received from' : 'Paid to'} ${party} (Equity Bank #${code})`;

  return {
    code,
    bank_name: 'EQUITY',
    type,
    amount_kes,
    party,
    date,
    time,
    raw_date: dateMatch ? dateMatch[1] : undefined,
    balance_kes,
    suggested_category,
    description,
    raw_message: text.trim(),
  };
}

/**
 * Parses a KCB Bank SMS
 */
function parseKcbMessage(text: string): ParsedBankTx | null {
  if (!text.toLowerCase().includes('confirmed') && !text.toLowerCase().includes('kcb')) return null;

  const isCredit = /received from/i.test(text) || /credited/i.test(text);
  const isDebit = /sent to|transferred to|paid to|debited/i.test(text);

  if (!isCredit && !isDebit) return null;

  const type: 'INCOME' | 'EXPENSE' = isCredit ? 'INCOME' : 'EXPENSE';
  const amtMatch = text.match(/(?:KES|Ksh)\s*([\d,]+\.?\d*)/i);
  if (!amtMatch) return null;

  const amount_kes = parseFloat(amtMatch[1].replace(/,/g, ''));
  if (isNaN(amount_kes) || amount_kes <= 0) return null;

  const refMatch = text.match(/Ref:?\s*([A-Za-z0-9]+)/i);
  const code = refMatch ? refMatch[1].toUpperCase() : 'KCB' + Math.random().toString(36).substring(2, 9).toUpperCase();

  const dateMatch = text.match(/on\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})(?:\s+(?:at\s+)?(\d{1,2}:\d{2}(?:\s*[AP]M)?))?/i);
  const date = dateMatch ? normalizeDate(dateMatch[1]) : new Date().toISOString().slice(0, 10);
  const time = dateMatch && dateMatch[2] ? dateMatch[2] : undefined;

  let party = 'KCB Counterparty';
  if (isCredit) {
    const fromMatch = text.match(/received from\s+([^.\n\r]+?)(?:\s+on|\s+Ref|\.|$)/i);
    if (fromMatch) party = fromMatch[1].trim();
  } else {
    const toMatch = text.match(/(?:sent to|transferred to|paid to)\s+([^.\n\r]+?)(?:\s+on|\s+Ref|\.|$)/i);
    if (toMatch) party = toMatch[1].trim();
  }

  const balMatch = text.match(/(?:balance is|bal:?)\s*(?:KES|Ksh)\s*([\d,]+\.?\d*)/i);
  const balance_kes = balMatch ? parseFloat(balMatch[1].replace(/,/g, '')) : null;

  const suggested_category = categorizeBankParty(party, type);
  const description = `${type === 'INCOME' ? 'Received from' : 'Paid to'} ${party} (KCB #${code})`;

  return {
    code,
    bank_name: 'KCB',
    type,
    amount_kes,
    party,
    date,
    time,
    balance_kes,
    suggested_category,
    description,
    raw_message: text.trim(),
  };
}

/**
 * Parses a Co-operative Bank / MCo-op Cash SMS
 */
function parseCoopMessage(text: string): ParsedBankTx | null {
  if (!text.toLowerCase().includes('mco-op cash') && !text.toLowerCase().includes('co-op') && !text.toLowerCase().includes('cooperative')) {
    return null;
  }

  const isCredit = /received|credited/i.test(text);
  const isDebit = /sent|paid|debited/i.test(text);

  if (!isCredit && !isDebit) return null;

  const type: 'INCOME' | 'EXPENSE' = isCredit ? 'INCOME' : 'EXPENSE';
  const amtMatch = text.match(/(?:KES|Ksh)\s*([\d,]+\.?\d*)/i);
  if (!amtMatch) return null;

  const amount_kes = parseFloat(amtMatch[1].replace(/,/g, ''));
  if (isNaN(amount_kes) || amount_kes <= 0) return null;

  const refMatch = text.match(/Ref:?\s*([A-Za-z0-9]+)/i);
  const code = refMatch ? refMatch[1].toUpperCase() : 'COOP' + Math.random().toString(36).substring(2, 9).toUpperCase();

  const dateMatch = text.match(/on\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})(?:\s+(?:at\s+)?(\d{1,2}:\d{2}))?/i);
  const date = dateMatch ? normalizeDate(dateMatch[1]) : new Date().toISOString().slice(0, 10);
  const time = dateMatch && dateMatch[2] ? dateMatch[2] : undefined;

  let party = 'Co-op Bank Counterparty';
  if (isCredit) {
    const fromMatch = text.match(/from\s+([^.\n\r]+?)(?:\s+Ref|\.|$)/i);
    if (fromMatch) party = fromMatch[1].trim();
  } else {
    const toMatch = text.match(/(?:sent to|paid to|to)\s+([^.\n\r]+?)(?:\s+on|\s+Ref|\.|$)/i);
    if (toMatch) party = toMatch[1].trim();
  }

  const balMatch = text.match(/(?:balance is|bal:?)\s*(?:KES|Ksh)\s*([\d,]+\.?\d*)/i);
  const balance_kes = balMatch ? parseFloat(balMatch[1].replace(/,/g, '')) : null;

  const suggested_category = categorizeBankParty(party, type);
  const description = `${type === 'INCOME' ? 'Received from' : 'Paid to'} ${party} (Co-op Bank #${code})`;

  return {
    code,
    bank_name: 'COOP',
    type,
    amount_kes,
    party,
    date,
    time,
    balance_kes,
    suggested_category,
    description,
    raw_message: text.trim(),
  };
}

/**
 * Single entry point to parse any Kenyan bank message
 */
export function parseSingleBankMessage(text: string): ParsedBankTx | null {
  if (!text || typeof text !== 'string') return null;
  const clean = text.trim();
  if (clean.length < 15) return null;

  return parseEquityMessage(clean) || parseKcbMessage(clean) || parseCoopMessage(clean);
}

/**
 * Parses multiple bank SMS alerts pasted into a single textarea
 */
export function parseMultipleBankMessages(rawText: string): ParsedBankTx[] {
  if (!rawText || typeof rawText !== 'string') return [];

  // Split by double newline or common SMS boundary keywords
  const chunks = rawText
    .split(/\n\s*\n+|(?=Dear Customer)|(?=Confirmed\.)|(?=MCo-op Cash:)/i)
    .map(c => c.trim())
    .filter(c => c.length > 20);

  const results: ParsedBankTx[] = [];
  const seenCodes = new Set<string>();

  for (const chunk of chunks) {
    const parsed = parseSingleBankMessage(chunk);
    if (parsed) {
      if (!seenCodes.has(parsed.code)) {
        seenCodes.add(parsed.code);
        results.push(parsed);
      }
    }
  }

  return results;
}
