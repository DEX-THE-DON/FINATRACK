import { Decimal } from 'decimal.js';

// Configure Decimal for exact financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function toDecimal(val: number | string | Decimal | null | undefined): Decimal {
  if (val === null || val === undefined || val === '') return new Decimal(0);
  try {
    return new Decimal(val);
  } catch {
    return new Decimal(0);
  }
}

export function formatMoney(val: number | string | Decimal | null | undefined, decimals = 2): string {
  return toDecimal(val).toFixed(decimals);
}

export function formatMoneyDisplay(val: number | string | Decimal | null | undefined, currency = 'Ksh'): string {
  const dec = toDecimal(val);
  const num = parseFloat(dec.toFixed(2));
  const formatted = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === 'Ksh' ? `Ksh ${formatted}` : `$${formatted}`;
}

// ------------------------------------------------------------------------------
// MMF & PASSIVE YIELD CALCULATIONS
// ------------------------------------------------------------------------------
export function calculateAnnualYield(balance: number | string | Decimal, apyPercent: number | string | Decimal): Decimal {
  const bal = toDecimal(balance);
  const apy = toDecimal(apyPercent).dividedBy(100);
  return bal.times(apy);
}

export function calculateMonthlyYield(balance: number | string | Decimal, apyPercent: number | string | Decimal): Decimal {
  return calculateAnnualYield(balance, apyPercent).dividedBy(12);
}

export function calculateDailyYield(balance: number | string | Decimal, apyPercent: number | string | Decimal): Decimal {
  return calculateAnnualYield(balance, apyPercent).dividedBy(365);
}

// ------------------------------------------------------------------------------
// WATERFALL DYNAMIC SPLIT ALLOCATOR (ZERO CENT LEAKAGE)
// ------------------------------------------------------------------------------
export interface SplitRule {
  id: string;
  bucket_name: string;
  target_type: string;
  target_id?: string | null;
  percentage: number;
}

export interface SplitResult {
  rule_id: string;
  bucket_name: string;
  target_type: string;
  target_id?: string | null;
  percentage: number;
  allocated_amount: string; // Exact string representation e.g. "50.00"
}

export function allocateWaterfallSplit(totalAmount: number | string | Decimal, rules: SplitRule[]): SplitResult[] {
  const total = toDecimal(totalAmount);
  if (total.isZero() || rules.length === 0) {
    return rules.map(r => ({
      rule_id: r.id,
      bucket_name: r.bucket_name,
      target_type: r.target_type,
      target_id: r.target_id,
      percentage: r.percentage,
      allocated_amount: "0.00"
    }));
  }

  let accumulated = new Decimal(0);
  const results: SplitResult[] = [];

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    const isLast = i === rules.length - 1;
    let splitAmt: Decimal;

    if (isLast) {
      // Allocate the remaining exact remainder to prevent rounding discrepancy
      splitAmt = Decimal.max(0, total.minus(accumulated));
    } else {
      const pct = toDecimal(r.percentage).dividedBy(100);
      splitAmt = total.times(pct).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      accumulated = accumulated.plus(splitAmt);
    }

    results.push({
      rule_id: r.id,
      bucket_name: r.bucket_name,
      target_type: r.target_type,
      target_id: r.target_id,
      percentage: r.percentage,
      allocated_amount: splitAmt.toFixed(2)
    });
  }

  return results;
}

// ------------------------------------------------------------------------------
// SHIFT TIME DURATION & HOURLY YIELD
// ------------------------------------------------------------------------------
export function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const clean = timeStr.trim().toLowerCase();
  
  // Format "14:30" or "11:00"
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
  }

  // Format "11:00 am" or "10:00 pm"
  const match12 = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (match12) {
    let hrs = parseInt(match12[1], 10);
    const mins = match12[2] ? parseInt(match12[2], 10) : 0;
    const meridiem = match12[3];
    if (meridiem === 'pm' && hrs < 12) hrs += 12;
    if (meridiem === 'am' && hrs === 12) hrs = 0;
    return hrs * 60 + mins;
  }

  return null;
}

export function calculateShiftHours(startTime?: string | null, endTime?: string | null, fallback = 8.0): number {
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);

  if (startMins === null || endMins === null) return fallback;

  let diffMins = endMins - startMins;
  // If shift crosses midnight (e.g. 20:00 to 04:00)
  if (diffMins <= 0) {
    diffMins += 24 * 60;
  }

  return Math.round((diffMins / 60) * 10) / 10;
}

export function formatTimeDisplay(timeStr?: string | null): string {
  if (!timeStr) return '';
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return timeStr;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// ------------------------------------------------------------------------------
// BUDGET BURN RATE & SAFE DAILY SPEND PACING
// ------------------------------------------------------------------------------
export interface BudgetPace {
  spent: string;
  limit: string;
  percentage: number;
  displayPercentage: number;
  remaining: string;
  safeDailySpend: string;
  burnLabel: string;
  burnBadge: 'rose' | 'amber' | 'emerald' | 'indigo';
}

export function calculateBudgetPace(
  spentAmount: number | string | Decimal,
  limitAmount: number | string | Decimal,
  currentDay: number,
  daysInMonth: number
): BudgetPace {
  const spent = toDecimal(spentAmount);
  const limit = toDecimal(limitAmount);
  const daysRemaining = Math.max(1, daysInMonth - currentDay);
  const expectedPacePct = (currentDay / daysInMonth) * 100;

  const pct = limit.isPositive() && !limit.isZero()
    ? spent.dividedBy(limit).times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber()
    : 0;

  const remaining = Decimal.max(0, limit.minus(spent));
  const safeDaily = remaining.dividedBy(daysRemaining).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  let burnLabel = '✨ No Spend Yet';
  let burnBadge: 'rose' | 'amber' | 'emerald' | 'indigo' = 'indigo';

  if (pct >= 100) {
    burnLabel = '🚨 Budget Exceeded';
    burnBadge = 'rose';
  } else if (pct > expectedPacePct + 15) {
    burnLabel = '⚡ Burning Fast';
    burnBadge = 'amber';
  } else if (pct > 0) {
    burnLabel = '🟢 On Track';
    burnBadge = 'emerald';
  }

  return {
    spent: spent.toFixed(2),
    limit: limit.toFixed(2),
    percentage: pct,
    displayPercentage: Math.min(pct, 100),
    remaining: remaining.toFixed(2),
    safeDailySpend: safeDaily.toFixed(2),
    burnLabel,
    burnBadge
  };
}
