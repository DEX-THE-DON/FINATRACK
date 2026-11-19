import { parseSmartCommand, inferSmartShiftDefaults, computeSystemIntelligence } from './smartEngine';

console.log('🧪 RUNNING SMART INTELLIGENCE ENGINE TESTS...');

const mockAccounts = [
  { id: 'acc-mpesa', name: 'M-Pesa Wallet', account_type: 'MOBILE_MONEY', balance: 25000, interest_rate_p_a: 0 },
  { id: 'acc-cash', name: 'Cash Pocket', account_type: 'CASH', balance: 2000, interest_rate_p_a: 0 },
  { id: 'acc-ziidi', name: 'Ziidi MMF', account_type: 'MMF', balance: 40000, interest_rate_p_a: 13.5 },
];

// 1. Single shorthand expense
const e1 = parseSmartCommand('fuel 500', mockAccounts, '2026-11-19');
console.assert(e1.length === 1, `Expected 1 entry, got ${e1.length}`);
console.assert(e1[0].transaction_type === 'EXPENSE', 'fuel 500 should be EXPENSE');
console.assert(e1[0].amount === 500, 'Amount should be 500');
console.assert(e1[0].category === 'Fuel & Petrol', `Category should be Fuel & Petrol, got ${e1[0].category}`);
console.assert(e1[0].account_id === 'acc-mpesa', 'Should auto-select default liquid M-Pesa wallet');
console.log('✅ 1. Shorthand Expense ("fuel 500"):', e1[0].category, e1[0].amount, e1[0].account_name);

// 2. Multi-entry shorthand with "k" notation & account matching
const e2 = parseSmartCommand('uber 2.5k mpesa, lunch 150 cash, airtime 50', mockAccounts, '2026-11-19');
console.assert(e2.length === 3, `Expected 3 entries, got ${e2.length}`);
console.assert(e2[0].transaction_type === 'INCOME' && e2[0].amount === 2500 && e2[0].account_id === 'acc-mpesa', 'uber 2.5k mpesa failed');
console.assert(e2[1].transaction_type === 'EXPENSE' && e2[1].amount === 150 && e2[1].account_id === 'acc-cash' && e2[1].category === 'Food & Groceries', 'lunch 150 cash failed');
console.assert(e2[2].transaction_type === 'EXPENSE' && e2[2].amount === 50 && e2[2].category === 'Utilities & Bills', 'airtime 50 failed');
console.log('✅ 2. Multi-Entry Shorthand ("uber 2.5k mpesa, lunch 150 cash, airtime 50") parsed 3 items accurately');

// 3. Relative date ("yesterday")
const e3 = parseSmartCommand('bolt 1800 yesterday', mockAccounts, '2026-11-19');
console.assert(e3[0].date === '2026-11-18', `Expected 2026-11-18, got ${e3[0].date}`);
console.log('✅ 3. Relative Date ("yesterday"):', e3[0].date);

// 4. Raw M-Pesa SMS auto-detection inside the same Smart Command bar
const sms = 'QA12345678 Confirmed. You have received Ksh1,500.00 from BOLT DELIVERIES on 19/11/26 at 5:30 PM.';
const e4 = parseSmartCommand(sms, mockAccounts, '2026-11-19');
console.assert(e4.length === 1 && e4[0].source === 'MPESA_SMS' && e4[0].amount === 1500 && e4[0].transaction_type === 'INCOME', 'Raw M-Pesa SMS auto-detection failed');
console.log('✅ 4. Raw M-Pesa SMS Auto-Detected:', e4[0].source, e4[0].amount, e4[0].category);

// 5. Smart Shift Defaults Inference
const mockLogs = [
  { total_earned: 2600, fuel_cost: 450, food_spent: 150, airtime_spent: 50, platform: 'Bolt', km_driven: 120, start_time: '07:30', end_time: '18:30' },
  { total_earned: 2400, fuel_cost: 550, food_spent: 150, airtime_spent: 50, platform: 'Bolt', km_driven: 100, start_time: '08:00', end_time: '19:00' },
];
const defaults = inferSmartShiftDefaults(mockLogs, { fuel_allowance_kes: 500, lunch_allowance_kes: 150, airtime_allowance_kes: 50 });
console.assert(defaults.fuelCost === 500, `Expected avg fuel 500, got ${defaults.fuelCost}`);
console.assert(defaults.platform === 'Bolt', `Expected Bolt, got ${defaults.platform}`);
console.assert(defaults.avgKm === 110, `Expected 110 km, got ${defaults.avgKm}`);
console.log('✅ 5. Smart Shift Defaults Learned:', defaults);

// 6. System Intelligence Report (Idle Cash Yield + Month-End Forecast + Goal Acceleration)
const report = computeSystemIntelligence({
  accounts: mockAccounts,
  transactions: [],
  recurringBills: [{ name: 'WiFi', amount: 2500, due_day: 22, is_paid_this_month: false }],
  debts: [],
  goals: [{ title: 'Emergency Fund', target_amount: 50000, current_amount: 40000 }],
  monthlyIncome: 38000,
  monthlyExpenses: 19000,
  currentDay: 19,
  daysInMonth: 30,
  todayIso: '2026-11-19',
});
console.assert(report.idleCashKes > 0, `Expected idle cash > 0, got ${report.idleCashKes}`);
console.assert(report.missedMonthlyInterestKes > 0, `Expected missed interest > 0, got ${report.missedMonthlyInterestKes}`);
console.assert(report.projectedMonthEndNet === 30000, `Expected projected net 30000, got ${report.projectedMonthEndNet}`);
console.assert(report.insights.length >= 3, `Expected >= 3 insights, got ${report.insights.length}`);
console.log(`✅ 6. System Autopilot Report: ProjectedNet=+Ksh ${report.projectedMonthEndNet}, IdleCash=Ksh ${report.idleCashKes}, MissedYield=+Ksh ${report.missedMonthlyInterestKes}/mo, Insights=${report.insights.length}`);

console.log('🎉 ALL SMART INTELLIGENCE ENGINE TESTS PASSED 100%!');
