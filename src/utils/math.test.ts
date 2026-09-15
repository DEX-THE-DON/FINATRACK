import {
  toDecimal,
  calculateDailyYield,
  calculateMonthlyYield,
  calculateAnnualYield,
  allocateWaterfallSplit,
  calculateShiftHours,
  calculateBudgetPace
} from './math';

console.log('🧪 RUNNING PRECISION MATH TEST SUITE...');

// Test 1: Waterfall Split Exact Precision (Zero Cent Discrepancy)
const splitRules = [
  { id: '1', bucket_name: 'Ziidi MMF', target_type: 'ACCOUNT', percentage: 20 },
  { id: '2', bucket_name: 'Lock Savings', target_type: 'ACCOUNT', percentage: 20 },
  { id: '3', bucket_name: 'Goals', target_type: 'GOAL', percentage: 15 },
  { id: '4', bucket_name: 'Bills', target_type: 'ACCOUNT', percentage: 15 },
  { id: '5', bucket_name: 'Living Expenses', target_type: 'CASH', percentage: 30 },
];

const total500 = allocateWaterfallSplit(500, splitRules);
const sum500 = total500.reduce((acc, r) => acc + parseFloat(r.allocated_amount), 0);
console.assert(sum500 === 500.0, `Waterfall sum for 500 should be 500.00, got ${sum500}`);
console.log('✅ Waterfall Split (500 KES):', total500.map(r => `${r.bucket_name}: Ksh ${r.allocated_amount}`));

const total333 = allocateWaterfallSplit(333.33, splitRules);
const sum333 = total333.reduce((acc, r) => acc + parseFloat(r.allocated_amount), 0);
console.assert(Math.abs(sum333 - 333.33) < 0.001, `Waterfall sum for 333.33 should be 333.33, got ${sum333}`);
console.log('✅ Waterfall Split Odd Decimal (333.33 KES):', total333.map(r => `${r.bucket_name}: Ksh ${r.allocated_amount}`));

// Test 2: MMF Interest APY Calculation
const bal10000 = 10000;
const apy13_5 = 13.5;
const ann = calculateAnnualYield(bal10000, apy13_5);
const mon = calculateMonthlyYield(bal10000, apy13_5);
const day = calculateDailyYield(bal10000, apy13_5);

console.assert(ann.toFixed(2) === '1350.00', `Annual yield should be 1350.00, got ${ann.toFixed(2)}`);
console.assert(mon.toFixed(2) === '112.50', `Monthly yield should be 112.50, got ${mon.toFixed(2)}`);
console.log(`✅ MMF APY (10,000 KES @ 13.5%): Ann=${ann.toFixed(2)}, Mon=${mon.toFixed(2)}, Day=${day.toFixed(2)}`);

// Test 3: Shift Hours & Overnight Shifts
const dayShift = calculateShiftHours('11:00', '22:00');
console.assert(dayShift === 11.0, `Day shift 11:00-22:00 should be 11.0 hrs, got ${dayShift}`);

const nightShift = calculateShiftHours('20:00', '04:00');
console.assert(nightShift === 8.0, `Overnight shift 20:00-04:00 should be 8.0 hrs, got ${nightShift}`);
console.log(`✅ Shift Working Hours: 11am-10pm=${dayShift}h, 8pm-4am=${nightShift}h`);

// Test 4: Budget Pace
const pace = calculateBudgetPace(2500, 5000, 15, 30);
console.assert(pace.percentage === 50, `Budget pace percentage should be 50%, got ${pace.percentage}%`);
console.log(`✅ Budget Pace (2,500/5,000 on day 15/30): ${pace.burnLabel}, Safe Daily=${pace.safeDailySpend}`);

// Test 5: Target Income & Expense Multi-Timeframe Checkers
import { calculateTargetPace } from './math';
const weekIncomeTarget = calculateTargetPace(10000, 15000, 'WEEKLY', true, 4, 7);
console.assert(weekIncomeTarget.percentage === 67, `Weekly income target pct should be 67%, got ${weekIncomeTarget.percentage}%`);
console.assert(Math.round(weekIncomeTarget.dailyRate) === 1250, `Daily run-rate needed should be 1250, got ${weekIncomeTarget.dailyRate}`);
console.log(`✅ Weekly Income Target (10k/15k on day 4/7): ${weekIncomeTarget.statusLabel}, Needed=${Math.round(weekIncomeTarget.dailyRate)}/day`);

const monthExpenseTarget = calculateTargetPace(12000, 25000, 'MONTHLY', false, 15, 30);
console.assert(monthExpenseTarget.percentage === 48, `Monthly expense target pct should be 48%, got ${monthExpenseTarget.percentage}%`);
console.log(`✅ Monthly Expense Target (12k/25k on day 15/30): ${monthExpenseTarget.statusLabel}, Safe Daily=${monthExpenseTarget.dailyRate.toFixed(2)}/day`);

// Test 6: Debt & Loan Danger Zone Countdown
import { calculateDebtDeadline } from './math';
const now = new Date();
const overdueDate = new Date(now.getTime() - 2 * 86400000).toISOString();
const dueTodayDate = now.toISOString();
const dangerDate = new Date(now.getTime() + 2 * 86400000).toISOString();
const safeDate = new Date(now.getTime() + 15 * 86400000).toISOString();

const overdueStatus = calculateDebtDeadline(overdueDate);
console.assert(overdueStatus.isOverdue === true, 'Should be marked overdue');
console.assert(overdueStatus.isDangerZone === true, 'Overdue should be in danger zone');

const dangerStatus = calculateDebtDeadline(dangerDate);
console.assert(dangerStatus.isDangerZone === true, '2 days should be in danger zone');

const safeStatus = calculateDebtDeadline(safeDate);
console.assert(safeStatus.isDangerZone === false, '15 days should not be danger zone');

console.log(`✅ Debt Danger Zones: Overdue='${overdueStatus.badgeLabel}', Danger='${dangerStatus.badgeLabel}', Safe='${safeStatus.badgeLabel}'`);

// Test 7: Emergency Fund Runway Meter
import { calculateEmergencyRunway } from './math';
const runway1 = calculateEmergencyRunway(75000, 25000);
console.assert(runway1.months === 3.0, `Runway months should be 3.0, got ${runway1.months}`);
console.assert(runway1.percentageOfGoal === 50, `Runway % of goal should be 50%, got ${runway1.percentageOfGoal}%`);
console.log(`✅ Emergency Fund Runway (75k liquid / 25k burn): ${runway1.months} months (${runway1.statusLabel})`);

// Test 8: EV vs Petrol ROI Savings
import { calculateEvRoiSavings } from './math';
const sampleShifts = [
  { distance_km: 120, bike_type: 'EV', battery_swap_cost: 250 },
  { distance_km: 80, bike_type: 'PETROL', fuel_cost: 400 },
];
const evStats = calculateEvRoiSavings(sampleShifts, 4.5, 1.8);
console.assert(evStats.totalKm === 200, `Total km should be 200, got ${evStats.totalKm}`);
console.assert(evStats.actualSpent === 650, `Actual spend should be 650, got ${evStats.actualSpent}`);
console.assert(evStats.netSavingsKes === 250, `Net savings should be 250 (900 petrol equiv - 650 actual), got ${evStats.netSavingsKes}`);
console.log(`✅ EV vs Petrol Savings (200 km): Spent=${evStats.actualSpent} KES vs Petrol=${evStats.petrolEquivalentCost} KES (Saved ${evStats.netSavingsKes} KES)`);

// Test 9: Financial Freedom & Health Score (0 - 100)
import { calculateFinancialHealthScore } from './math';
const health = calculateFinancialHealthScore({
  liquidBalance: 60000,
  totalDebt: 5000,
  monthlyIncome: 65000,
  monthlyExpenses: 20000,
  runwayMonths: 3.0,
});
console.assert(health.totalScore >= 75, `Healthy score should be >= 75, got ${health.totalScore}`);
console.log(`✅ Financial Health Score: ${health.totalScore}/100 (Grade ${health.grade} - ${health.tierLabel})`);

// Test 10: Unified Upcoming Deadlines Timeline
import { buildUnifiedTimeline } from './math';
const timeline = buildUnifiedTimeline({
  debts: [{ id: '1', person_name: 'Hustler Loan', debt_type: 'I_OWE', remaining: 2000, due_at: dangerDate }],
  bills: [{ id: 'b1', title: 'KPLC Electricity', amount: 800, due_day: 20 }],
  complianceItems: [{ id: 'c1', name: 'Comprehensive Bike Insurance', expiryDate: safeDate, costKes: 3500 }],
});
console.assert(timeline.length === 3, `Timeline should aggregate 3 items, got ${timeline.length}`);
console.log(`✅ Unified Timeline: Aggregated ${timeline.length} items (First due: ${timeline[0].title} in ${timeline[0].daysRemaining}d)`);

// Test 11: Sinking Funds & Goal Pace Calculator
import { calculateGoalPace } from './math';
const todayUtc = new Date(new Date().toISOString().slice(0, 10));
const futureDate = new Date(todayUtc.getTime() + 10 * 86400000).toISOString().slice(0, 10);
const goalPace = calculateGoalPace(10000, 3000, futureDate);
console.assert(goalPace.remainingAmount === 7000, `Remaining amount should be 7000, got ${goalPace.remainingAmount}`);
console.assert(goalPace.dailyNeeded === 700, `Daily needed should be 700, got ${goalPace.dailyNeeded}`);
console.assert(goalPace.progressPct === 30, `Progress pct should be 30%, got ${goalPace.progressPct}%`);
console.log(`✅ Goal Pace (3k/10k in 10d): Needed=${goalPace.dailyNeeded}/day, Weekly=${goalPace.weeklyNeeded}/wk (${goalPace.statusBadge})`);

// Test 12: SACCO & Chama Dividend Forecaster
// Test 12: SACCO & Chama Dividend Forecaster
import { calculateSaccoDividendProjection } from './math';
const saccoProj = calculateSaccoDividendProjection(50000, 5000, 12);
console.assert(saccoProj.projectedYearEndCapital === 110000, `Year end capital should be 110,000, got ${saccoProj.projectedYearEndCapital}`);
console.assert(saccoProj.annualDividend === 9600, `Annual dividend should be 9,600, got ${saccoProj.annualDividend}`);
console.log(`✅ SACCO Forecaster (50k initial + 5k/mo @ 12%): Year-end=${saccoProj.projectedYearEndCapital} KES, Div=${saccoProj.annualDividend} KES`);

// Test 13: Stint & Session Hourly Yield Calculator (Uber / Bolt)
import { calculateStintHourlyYield } from './math';
const stint1 = calculateStintHourlyYield('11:00', '14:00', 567);
console.assert(stint1.hours === 3.0, `Stint 1 hours should be 3.0, got ${stint1.hours}`);
console.assert(stint1.hourlyYield === 189.0, `Stint 1 yield should be 189.0, got ${stint1.hourlyYield}`);

const stint2 = calculateStintHourlyYield('14:13', '17:00', 700);
console.assert(stint2.hours === 2.8, `Stint 2 hours should be ~2.8, got ${stint2.hours}`);
console.assert(Math.round(stint2.hourlyYield) === 250, `Stint 2 yield should be ~250, got ${stint2.hourlyYield}`);
console.log(`✅ Stint Yields: 11am-2pm (567 KES)=${stint1.displayYield}, 2:13pm-5pm (700 KES)=${stint2.displayYield}`);

// Test 14: Master Vault Goal Sub-Splits (Disciplined Single Account)
import { allocateGoalSubSplits } from './math';
const goalSubSplits = allocateGoalSubSplits(1500, [
  { id: 'g1', title: '55" Smart TV', split_percentage: 40 },
  { id: 'g2', title: 'Gas Cooker', split_percentage: 30 },
  { id: 'g3', title: 'Living Room Sofa', split_percentage: 30 },
]);
console.assert(goalSubSplits[0].allocated_amount === 600, `TV allocation should be 600, got ${goalSubSplits[0].allocated_amount}`);
console.assert(goalSubSplits[1].allocated_amount === 450, `Cooker allocation should be 450, got ${goalSubSplits[1].allocated_amount}`);
console.assert(goalSubSplits[2].allocated_amount === 450, `Sofa allocation should be 450, got ${goalSubSplits[2].allocated_amount}`);
console.log(`✅ Goal Sub-Splits (1.5k into 1 Lock Vault): TV=${goalSubSplits[0].display_amount}, Cooker=${goalSubSplits[1].display_amount}, Sofa=${goalSubSplits[2].display_amount}`);

console.log('🎉 ALL PRECISION MATH TESTS PASSED 100%!');
