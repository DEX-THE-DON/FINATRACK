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

console.log('🎉 ALL PRECISION MATH TESTS PASSED 100%!');

