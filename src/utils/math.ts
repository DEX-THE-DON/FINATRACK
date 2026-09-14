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

// ------------------------------------------------------------------------------
// 1. 🛡️ EMERGENCY FUND RUNWAY METER ("MONTHS OF FREEDOM")
// ------------------------------------------------------------------------------
export interface RunwayStatus {
  liquidBalance: number;
  monthlyBurn: number;
  months: number;
  displayMonths: string;
  goalMonths: number;
  percentageOfGoal: number;
  statusLabel: string;
  statusBadge: string;
  statusColor: string;
  advice: string;
}

export function calculateEmergencyRunway(
  liquidBalance: number | string | Decimal,
  monthlyExpenses: number | string | Decimal,
  fallbackMonthlyBudget = 25000
): RunwayStatus {
  const liquid = Math.max(0, toDecimal(liquidBalance).toNumber());
  const actualExp = toDecimal(monthlyExpenses).toNumber();
  const burn = actualExp > 0 ? actualExp : fallbackMonthlyBudget;
  const rawMonths = burn > 0 ? liquid / burn : 0;
  const months = parseFloat(rawMonths.toFixed(1));
  const goalMonths = 6.0;
  const percentageOfGoal = Math.min(100, Math.round((months / goalMonths) * 100));

  let statusLabel = '🛡️ Building Runway';
  let statusBadge = 'amber';
  let statusColor = 'text-amber-600 dark:text-amber-400';
  let advice = 'Keep building until you reach 3–6 months of living expenses buffer.';

  if (months < 1.0) {
    statusLabel = '🚨 Critical Runway (< 1 Month)';
    statusBadge = 'rose';
    statusColor = 'text-rose-600 dark:text-rose-400';
    advice = 'Prioritize allocating daily split funds into liquid reserves immediately.';
  } else if (months < 3.0) {
    statusLabel = '⚡ 1–3 Months Safety Cushion';
    statusBadge = 'amber';
    statusColor = 'text-amber-600 dark:text-amber-400';
    advice = 'Good start! Push towards the 3-month milestone for basic stability.';
  } else if (months < 6.0) {
    statusLabel = '🟢 Solid Safety Shield (3–6 Months)';
    statusBadge = 'emerald';
    statusColor = 'text-emerald-600 dark:text-emerald-400';
    advice = 'Excellent! You have a robust shield against income dips and emergencies.';
  } else {
    statusLabel = '🏆 Ultimate Financial Freedom (6+ Months)';
    statusBadge = 'indigo';
    statusColor = 'text-indigo-600 dark:text-indigo-400';
    advice = 'Outstanding! You have complete peace of mind. Consider deploying excess into high-yield MMFs/assets.';
  }

  return {
    liquidBalance: liquid,
    monthlyBurn: burn,
    months,
    displayMonths: `${months} mo`,
    goalMonths,
    percentageOfGoal,
    statusLabel,
    statusBadge,
    statusColor,
    advice,
  };
}

// ------------------------------------------------------------------------------
// 2. ⚡ EV VS PETROL SAVINGS & ROI COMPARATOR
// ------------------------------------------------------------------------------
export interface EvRoiStats {
  totalKm: number;
  evKm: number;
  petrolKm: number;
  actualSpent: number;
  petrolEquivalentCost: number;
  netSavingsKes: number;
  costPerKmActual: number;
  costPerKmPetrol: number;
  costPerKmEv: number;
  co2SavedKg: number;
  savingsPercentage: number;
}

export function calculateEvRoiSavings(
  shifts: any[] = [],
  petrolCostPerKm = 4.50,
  evCostPerKm = 1.80
): EvRoiStats {
  let totalKm = 0;
  let evKm = 0;
  let petrolKm = 0;
  let actualSpent = 0;

  for (const s of shifts) {
    const km = Number(s.distance_km || s.mileage_km || 0);
    const bikeType = String(s.bike_type || 'PETROL').toUpperCase();
    const fuelCost = Number(s.fuel_cost || s.battery_swap_cost || 0);

    totalKm += km;
    actualSpent += fuelCost;

    if (bikeType === 'EV' || bikeType === 'ELECTRIC') {
      evKm += km;
    } else {
      petrolKm += km;
    }
  }

  const petrolEquivalentCost = totalKm * petrolCostPerKm;
  const netSavingsKes = Math.max(0, petrolEquivalentCost - actualSpent);
  const costPerKmActual = totalKm > 0 ? parseFloat((actualSpent / totalKm).toFixed(2)) : 0;
  const savingsPercentage = petrolEquivalentCost > 0 ? Math.min(100, Math.round((netSavingsKes / petrolEquivalentCost) * 100)) : 0;
  const co2SavedKg = parseFloat((evKm * 0.082).toFixed(1)); // ~82g CO2 saved per km on electric

  return {
    totalKm,
    evKm,
    petrolKm,
    actualSpent,
    petrolEquivalentCost,
    netSavingsKes,
    costPerKmActual,
    costPerKmPetrol: petrolCostPerKm,
    costPerKmEv: evCostPerKm,
    co2SavedKg,
    savingsPercentage,
  };
}

// ------------------------------------------------------------------------------
// 3. 🏆 FINANCIAL HEALTH & FREEDOM SCORE (0–100)
// ------------------------------------------------------------------------------
export interface HealthScoreResult {
  totalScore: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  tierLabel: string;
  badgeClass: string;
  pillarScores: {
    runway: { score: number; max: number; label: string; detail: string };
    debt: { score: number; max: number; label: string; detail: string };
    incomeTarget: { score: number; max: number; label: string; detail: string };
    budgetDiscipline: { score: number; max: number; label: string; detail: string };
  };
  recommendations: string[];
}

export function calculateFinancialHealthScore(params: {
  liquidBalance: number;
  totalDebt: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyIncomeTarget?: number;
  monthlyExpenseTarget?: number;
  runwayMonths: number;
}): HealthScoreResult {
  const {
    liquidBalance,
    totalDebt,
    monthlyIncome,
    monthlyExpenses,
    monthlyIncomeTarget = 65000,
    monthlyExpenseTarget = 25000,
    runwayMonths,
  } = params;

  // Pillar 1: Emergency Runway & Reserves (0 - 25 pts)
  let runwayScore = 0;
  if (runwayMonths >= 6.0) runwayScore = 25;
  else if (runwayMonths >= 3.0) runwayScore = 20;
  else if (runwayMonths >= 1.5) runwayScore = 14;
  else if (runwayMonths >= 0.5) runwayScore = 8;
  else runwayScore = 3;

  // Pillar 2: Debt-to-Asset Health (0 - 25 pts)
  let debtScore = 25;
  const netAssets = liquidBalance;
  if (totalDebt > 0) {
    const debtRatio = netAssets > 0 ? (totalDebt / netAssets) : 2.0;
    if (debtRatio <= 0.15) debtScore = 22;
    else if (debtRatio <= 0.40) debtScore = 16;
    else if (debtRatio <= 0.80) debtScore = 10;
    else debtScore = 4;
  }

  // Pillar 3: Income Target Performance (0 - 25 pts)
  let incomeScore = 15;
  if (monthlyIncomeTarget > 0) {
    const incomeRatio = monthlyIncome / monthlyIncomeTarget;
    if (incomeRatio >= 1.0) incomeScore = 25;
    else if (incomeRatio >= 0.75) incomeScore = 20;
    else if (incomeRatio >= 0.50) incomeScore = 14;
    else if (incomeRatio >= 0.25) incomeScore = 8;
    else incomeScore = 4;
  }

  // Pillar 4: Budget Discipline & Burn Rate (0 - 25 pts)
  let budgetScore = 20;
  if (monthlyExpenseTarget > 0) {
    const burnRatio = monthlyExpenses / monthlyExpenseTarget;
    if (burnRatio <= 0.75) budgetScore = 25;
    else if (burnRatio <= 0.95) budgetScore = 22;
    else if (burnRatio <= 1.10) budgetScore = 14;
    else budgetScore = 5;
  }

  const totalScore = Math.min(100, Math.max(0, runwayScore + debtScore + incomeScore + budgetScore));

  let grade: 'A+' | 'A' | 'B' | 'C' | 'D' = 'B';
  let tierLabel = 'Steady Growth';
  let badgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';

  if (totalScore >= 90) {
    grade = 'A+';
    tierLabel = '🏆 Financial Freedom Elite';
    badgeClass = 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black shadow-md';
  } else if (totalScore >= 75) {
    grade = 'A';
    tierLabel = '🛡️ Robust Financial Shield';
    badgeClass = 'bg-emerald-600 text-white font-black shadow-sm';
  } else if (totalScore >= 60) {
    grade = 'B';
    tierLabel = '⚡ Resilient Financial Builder';
    badgeClass = 'bg-indigo-600 text-white font-bold';
  } else if (totalScore >= 45) {
    grade = 'C';
    tierLabel = '📈 Needs Pacing & Cushion';
    badgeClass = 'bg-amber-500 text-slate-950 font-bold';
  } else {
    grade = 'D';
    tierLabel = '🚨 Critical Action Required';
    badgeClass = 'bg-rose-600 text-white font-black animate-pulse';
  }

  const recommendations: string[] = [];
  if (runwayScore < 20) {
    recommendations.push('Boost liquid emergency fund into high-yield MMF to reach at least 3 months of living runway.');
  }
  if (debtScore < 18) {
    recommendations.push('Accelerate repayments on danger zone loans to reduce overall debt liabilities.');
  }
  if (incomeScore < 18) {
    recommendations.push('Log regular delivery shifts and M-Pesa receipts to stay ahead of weekly income targets.');
  }
  if (budgetScore < 18) {
    recommendations.push('Living/Fuel expenses are pacing close to or over budget ceiling; throttle non-essential spend.');
  }
  if (recommendations.length === 0) {
    recommendations.push('All core financial pillars are performing exceptionally! Keep compounding passive yields.');
  }

  return {
    totalScore,
    grade,
    tierLabel,
    badgeClass,
    pillarScores: {
      runway: { score: runwayScore, max: 25, label: 'Emergency Runway', detail: `${runwayMonths} Months` },
      debt: { score: debtScore, max: 25, label: 'Debt Health', detail: totalDebt > 0 ? `Ksh ${totalDebt.toLocaleString()}` : '0 Debt' },
      incomeTarget: { score: incomeScore, max: 25, label: 'Income Target Pace', detail: `${Math.round((monthlyIncome / monthlyIncomeTarget) * 100)}% Met` },
      budgetDiscipline: { score: budgetScore, max: 25, label: 'Budget Discipline', detail: `${Math.round((monthlyExpenses / monthlyExpenseTarget) * 100)}% Burn` },
    },
    recommendations,
  };
}

// ------------------------------------------------------------------------------
// 4. 🗓️ UNIFIED DEADLINES & TIMELINE BUILDER
// ------------------------------------------------------------------------------
export interface TimelineItem {
  id: string;
  title: string;
  itemType: 'LOAN' | 'BILL' | 'COMPLIANCE';
  amountKes?: number;
  dueDate: string;
  daysRemaining: number;
  isOverdue: boolean;
  isDueToday: boolean;
  isDangerZone: boolean;
  statusBadge: string;
  icon: string;
  subtitle: string;
}

export function buildUnifiedTimeline(params: {
  debts?: any[];
  bills?: any[];
  complianceItems?: any[];
}): TimelineItem[] {
  const { debts = [], bills = [], complianceItems = [] } = params;
  const items: TimelineItem[] = [];

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // 1. Debts
  for (const d of debts) {
    if (d.status === 'PAID' || Number(d.remaining || 0) === 0) continue;
    const dueStr = d.due_at ? d.due_at.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const danger = calculateDebtDeadline(dueStr);
    const remAmt = Number(d.remaining ?? (Number(d.total_amount || 0) - Number(d.paid_amount || 0)));

    items.push({
      id: `debt-${d.id}`,
      title: `${d.person_name || 'Loan'} (${d.debt_type === 'I_OWE' ? 'Borrowed' : 'Lent Out'})`,
      itemType: 'LOAN',
      amountKes: remAmt,
      dueDate: dueStr,
      daysRemaining: danger.daysRemaining,
      isOverdue: danger.isOverdue,
      isDueToday: danger.isDueToday,
      isDangerZone: danger.isDangerZone,
      statusBadge: danger.badgeLabel,
      icon: d.debt_type === 'I_OWE' ? '🔴' : '🟢',
      subtitle: `Remaining Balance: Ksh ${remAmt.toLocaleString()}`,
    });
  }

  // 2. Bills
  for (const b of bills) {
    const dueDay = Number(b.due_day || 1);
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
    if (currentMonthDate < now) {
      currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    }
    const dueStr = currentMonthDate.toISOString().slice(0, 10);
    const diffDays = Math.ceil((currentMonthDate.getTime() - now.getTime()) / 86400000);
    const isDanger = diffDays <= 3;

    items.push({
      id: `bill-${b.id}`,
      title: b.title,
      itemType: 'BILL',
      amountKes: Number(b.amount || 0),
      dueDate: dueStr,
      daysRemaining: diffDays,
      isOverdue: diffDays < 0,
      isDueToday: diffDays === 0,
      isDangerZone: isDanger,
      statusBadge: diffDays === 0 ? '⚠️ Due Today' : `Due in ${diffDays}d`,
      icon: '⚡',
      subtitle: `Recurring Monthly Utility (Day ${dueDay})`,
    });
  }

  // 3. Compliance & Vehicle Items
  for (const c of complianceItems) {
    if (!c.expiryDate) continue;
    const expStr = c.expiryDate.slice(0, 10);
    const expDate = new Date(expStr);
    expDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / 86400000);
    const isDanger = diffDays <= 7;

    items.push({
      id: `comp-${c.id || c.name}`,
      title: c.name || 'Compliance Item',
      itemType: 'COMPLIANCE',
      amountKes: c.costKes || 0,
      dueDate: expStr,
      daysRemaining: diffDays,
      isOverdue: diffDays < 0,
      isDueToday: diffDays === 0,
      isDangerZone: isDanger,
      statusBadge: diffDays < 0 ? `🚨 Expired by ${Math.abs(diffDays)}d` : `Expires in ${diffDays}d`,
      icon: '🛵',
      subtitle: c.notes || 'Rider Compliance Renewal',
    });
  }

  // Sort by days remaining ascending (urgent/overdue first)
  items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return items;
}

// ------------------------------------------------------------------------------
// 🎯 SINKING FUNDS & GOAL PACE CALCULATOR
// ------------------------------------------------------------------------------
export interface GoalPaceResult {
  remainingAmount: number;
  daysLeft: number;
  dailyNeeded: number;
  weeklyNeeded: number;
  monthlyNeeded: number;
  progressPct: number;
  isCompleted: boolean;
  statusBadge: string;
}

export function calculateGoalPace(
  targetAmount: number | string | Decimal,
  currentAmount: number | string | Decimal,
  targetDateStr?: string | null
): GoalPaceResult {
  const target = toDecimal(targetAmount);
  const current = toDecimal(currentAmount);
  const remaining = Decimal.max(0, target.minus(current));
  const isCompleted = target.greaterThan(0) && current.greaterThanOrEqualTo(target);
  const progressPct = target.isZero()
    ? 0
    : Math.min(100, Math.round(current.dividedBy(target).times(100).toNumber()));

  let daysLeft = 30;
  if (targetDateStr) {
    const tTime = Date.parse(targetDateStr.slice(0, 10));
    const nTime = Date.parse(new Date().toISOString().slice(0, 10));
    const diffMs = tTime - nTime;
    daysLeft = Math.max(1, Math.round(diffMs / 86400000));
  }

  const dailyNeeded = daysLeft > 0 ? remaining.dividedBy(daysLeft).toDecimalPlaces(2).toNumber() : 0;
  const weeklyNeeded = toDecimal(dailyNeeded).times(7).toDecimalPlaces(2).toNumber();
  const monthlyNeeded = toDecimal(dailyNeeded).times(30).toDecimalPlaces(2).toNumber();

  let statusBadge = '🎯 On Track';
  if (isCompleted) {
    statusBadge = '🎉 Target Reached!';
  } else if (daysLeft <= 7) {
    statusBadge = `⚡ Target in ${daysLeft} days`;
  } else {
    statusBadge = `⏳ ${daysLeft} days left`;
  }

  return {
    remainingAmount: remaining.toNumber(),
    daysLeft,
    dailyNeeded,
    weeklyNeeded,
    monthlyNeeded,
    progressPct,
    isCompleted,
    statusBadge,
  };
}

// ------------------------------------------------------------------------------
// 👥 SACCO & CHAMA DIVIDEND FORECASTER
// ------------------------------------------------------------------------------
export interface SaccoProjectionResult {
  currentCapital: number;
  projectedYearEndCapital: number;
  annualDividend: number;
  monthlyEffectiveDividend: number;
  totalAnnualYieldPct: number;
}

export function calculateSaccoDividendProjection(
  currentShareCapital: number | string | Decimal,
  monthlyContribution: number | string | Decimal,
  dividendRatePct: number | string | Decimal = 12.0
): SaccoProjectionResult {
  const capital = toDecimal(currentShareCapital);
  const monthly = toDecimal(monthlyContribution);
  const rate = toDecimal(dividendRatePct).dividedBy(100);

  // Approximate weighted average balance over 12 months with linear contributions
  const yearEndCapital = capital.plus(monthly.times(12));
  const avgCapital = capital.plus(monthly.times(6)); // Mid-year weighted average
  const annualDividend = avgCapital.times(rate).toDecimalPlaces(2);
  const monthlyEffectiveDividend = annualDividend.dividedBy(12).toDecimalPlaces(2);

  return {
    currentCapital: capital.toNumber(),
    projectedYearEndCapital: yearEndCapital.toNumber(),
    annualDividend: annualDividend.toNumber(),
    monthlyEffectiveDividend: monthlyEffectiveDividend.toNumber(),
    totalAnnualYieldPct: rate.times(100).toNumber(),
  };
}
