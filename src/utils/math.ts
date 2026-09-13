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

// ------------------------------------------------------------------------------
// WEEKLY / MONTHLY / YEARLY TARGET INCOME & EXPENSE PACING
// ------------------------------------------------------------------------------
export interface TargetPace {
  period: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  periodLabel: string;
  isIncome: boolean;
  actual: number;
  target: number;
  percentage: number;
  displayPercentage: number;
  remaining: number;
  dailyRate: number; // For income: daily run-rate needed. For expense: safe daily spend limit.
  expectedPacePct: number;
  daysRemaining: number;
  statusLabel: string;
  statusBadge: 'rose' | 'amber' | 'emerald' | 'cyan' | 'indigo';
}

export function calculateTargetPace(
  actualAmount: number | string | Decimal,
  targetAmount: number | string | Decimal,
  period: 'WEEKLY' | 'MONTHLY' | 'YEARLY',
  isIncome: boolean,
  daysElapsed: number,
  totalDaysInPeriod: number
): TargetPace {
  const actual = toDecimal(actualAmount).toNumber();
  const target = toDecimal(targetAmount).toNumber();
  const daysRemaining = Math.max(1, totalDaysInPeriod - daysElapsed + 1);
  const expectedPacePct = totalDaysInPeriod > 0
    ? Math.min(100, Math.round((daysElapsed / totalDaysInPeriod) * 100))
    : 100;

  const percentage = target > 0
    ? Math.round((actual / target) * 100)
    : 0;

  const displayPercentage = Math.min(100, Math.max(0, percentage));
  const remaining = Math.max(0, target - actual);
  const dailyRate = daysRemaining > 0 ? remaining / daysRemaining : 0;

  const periodLabel = period === 'WEEKLY' ? 'This Week' : period === 'MONTHLY' ? 'This Month' : 'This Year';

  let statusLabel = '';
  let statusBadge: 'rose' | 'amber' | 'emerald' | 'cyan' | 'indigo' = 'emerald';

  if (isIncome) {
    if (actual >= target && target > 0) {
      statusLabel = '🎉 Target Achieved!';
      statusBadge = 'emerald';
    } else if (percentage >= expectedPacePct + 10) {
      statusLabel = '🚀 Ahead of Target';
      statusBadge = 'cyan';
    } else if (percentage >= Math.max(0, expectedPacePct - 15)) {
      statusLabel = '🎯 On Track';
      statusBadge = 'emerald';
    } else {
      statusLabel = '⚡ Catch Up Needed';
      statusBadge = 'amber';
    }
  } else {
    // Expense Budget
    if (actual > target && target > 0) {
      statusLabel = '🚨 Over Budget';
      statusBadge = 'rose';
    } else if (percentage > expectedPacePct + 15) {
      statusLabel = '⚡ Burning Fast';
      statusBadge = 'amber';
    } else if (actual === 0) {
      statusLabel = '✨ 0 Spend Yet';
      statusBadge = 'indigo';
    } else {
      statusLabel = '🟢 Safe Spend Pace';
      statusBadge = 'emerald';
    }
  }

  return {
    period,
    periodLabel,
    isIncome,
    actual,
    target,
    percentage,
    displayPercentage,
    remaining,
    dailyRate,
    expectedPacePct,
    daysRemaining,
    statusLabel,
    statusBadge
  };
}

// ------------------------------------------------------------------------------
// DEBTS & LOANS DANGER ZONE COUNTDOWN INTELLIGENCE
// ------------------------------------------------------------------------------
export interface DebtDangerStatus {
  daysRemaining: number;
  isOverdue: boolean;
  isDueToday: boolean;
  isDangerZone: boolean; // <= 3 days or Overdue
  isCautionZone: boolean; // <= 7 days
  badgeLabel: string;
  badgeClass: string;
  cardBorderClass: string;
  progressColor: string;
}

export function calculateDebtDeadline(dueAt?: string | null): DebtDangerStatus {
  if (!dueAt) {
    return {
      daysRemaining: 999,
      isOverdue: false,
      isDueToday: false,
      isDangerZone: false,
      isCautionZone: false,
      badgeLabel: '🗓️ No Fixed Deadline',
      badgeClass: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300',
      cardBorderClass: 'border-gray-200 dark:border-gray-800',
      progressColor: 'bg-indigo-500'
    };
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dueDate = new Date(dueAt);
  const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();

  const diffDays = Math.round((dueStart - todayStart) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      daysRemaining: diffDays,
      isOverdue: true,
      isDueToday: false,
      isDangerZone: true,
      isCautionZone: true,
      badgeLabel: `🚨 OVERDUE by ${overdueDays} day${overdueDays === 1 ? '' : 's'} (Danger Zone)`,
      badgeClass: 'bg-rose-600 text-white font-black animate-pulse shadow-xs border border-rose-700',
      cardBorderClass: 'border-rose-500 ring-2 ring-rose-500/40 dark:border-rose-500',
      progressColor: 'bg-gradient-to-r from-rose-600 to-red-600'
    };
  }

  if (diffDays === 0) {
    return {
      daysRemaining: 0,
      isOverdue: false,
      isDueToday: true,
      isDangerZone: true,
      isCautionZone: true,
      badgeLabel: '⚠️ DUE TODAY (Danger Zone)',
      badgeClass: 'bg-amber-500 text-slate-950 font-black animate-pulse shadow-xs border border-amber-600',
      cardBorderClass: 'border-amber-500 ring-2 ring-amber-500/40 dark:border-amber-500',
      progressColor: 'bg-gradient-to-r from-amber-500 to-rose-500'
    };
  }

  if (diffDays <= 3) {
    return {
      daysRemaining: diffDays,
      isOverdue: false,
      isDueToday: false,
      isDangerZone: true,
      isCautionZone: true,
      badgeLabel: `⚡ Due in ${diffDays} day${diffDays === 1 ? '' : 's'} (Danger Zone)`,
      badgeClass: 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-extrabold border border-rose-300 dark:border-rose-800',
      cardBorderClass: 'border-rose-400 dark:border-rose-800/80',
      progressColor: 'bg-gradient-to-r from-amber-500 to-rose-500'
    };
  }

  if (diffDays <= 7) {
    return {
      daysRemaining: diffDays,
      isOverdue: false,
      isDueToday: false,
      isDangerZone: false,
      isCautionZone: true,
      badgeLabel: `⏳ Due in ${diffDays} days (Caution)`,
      badgeClass: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold border border-amber-300 dark:border-amber-800',
      cardBorderClass: 'border-amber-300 dark:border-amber-900/60',
      progressColor: 'bg-gradient-to-r from-yellow-500 to-amber-500'
    };
  }

  return {
    daysRemaining: diffDays,
    isOverdue: false,
    isDueToday: false,
    isDangerZone: false,
    isCautionZone: false,
    badgeLabel: `🗓️ Due in ${diffDays} days (${dueAt.slice(0, 10)})`,
    badgeClass: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-200 dark:border-indigo-800',
    cardBorderClass: 'border-indigo-100 dark:border-indigo-900/40',
    progressColor: 'bg-gradient-to-r from-indigo-500 to-teal-500'
  };
}


