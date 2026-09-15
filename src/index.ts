import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { AppEnv, getRequestContext } from './db/supabase';
import { financeRoutes } from './routes/finance';
import { riderRoutes, classifyShiftWindow } from './routes/rider';
import { exportRoutes } from './routes/export';
import { authRoutes } from './routes/auth';
import { renderFinanceDashboard } from './views/financeView';
import { renderRiderDashboard } from './views/riderView';
import { renderAuthView } from './views/authView';
import {
  toDecimal,
  calculateMonthlyYield,
  calculateDailyYield,
  calculateAnnualYield,
  calculateBudgetPace,
  calculateTargetPace,
  calculateDebtDeadline,
  calculateShiftHours,
  formatTimeDisplay,
  calculateEmergencyRunway,
  calculateEvRoiSavings,
  calculateFinancialHealthScore,
  buildUnifiedTimeline
} from './utils/math';
import { Decimal } from 'decimal.js';

export const app = new Hono<{ Bindings: AppEnv }>();

const USD_TO_KES = 129.0;

// ------------------------------------------------------------------------------
// PWA MANIFEST & SERVICE WORKER
// ------------------------------------------------------------------------------
app.get('/manifest.json', (c) => {
  return c.body(JSON.stringify({
    name: "Finatrack - Financial Freedom & Fleet Hub",
    short_name: "Finatrack",
    id: "/",
    start_url: "/",
    scope: "/",
    description: "Smart personal finance management, MMF yields, savings goals, and rider fleet intelligence.",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/static/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/static/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon.svg", sizes: "512x512", type: "image/svg+xml" },
      { src: "/favicon.ico", sizes: "64x64", type: "image/x-icon" }
    ],
    shortcuts: [
      { name: "Finance Hub", url: "/", description: "Personal finance, balances & waterfall allocation" },
      { name: "Rider Fleet", url: "/rider", description: "Shift intelligence, bike maintenance & earnings" }
    ]
  }), 200, {
    'Content-Type': 'application/manifest+json; charset=utf-8',
    'Cache-Control': 'public, max-age=3600'
  });
});

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="128" fill="#1e3a8a"/>
  <circle cx="256" cy="256" r="200" fill="#2563eb" stroke="#60a5fa" stroke-width="12"/>
  <g fill="#ffffff">
    <circle cx="170" cy="310" r="50" fill="none" stroke="#ffffff" stroke-width="20"/>
    <circle cx="342" cy="310" r="50" fill="none" stroke="#ffffff" stroke-width="20"/>
    <path d="M170 310 L220 230 L280 230 L342 310" fill="none" stroke="#ffffff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M220 230 L250 310" fill="none" stroke="#ffffff" stroke-width="16" stroke-linecap="round"/>
    <path d="M280 230 L320 180 L350 180" fill="none" stroke="#ffffff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="270" cy="150" r="22" fill="#ffffff"/>
    <path d="M250 180 L290 190 L260 230" fill="#ffffff"/>
  </g>
  <text x="256" y="420" font-family="sans-serif" font-size="36" font-weight="bold" fill="#93c5fd" text-anchor="middle" letter-spacing="2">FINATRACK</text>
</svg>`;

app.get('/icons/icon.svg', (c) => c.body(ICON_SVG, 200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }));
app.get('/static/icons/icon.svg', (c) => c.body(ICON_SVG, 200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }));
app.get('/favicon.ico', (c) => c.body(ICON_SVG, 200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }));
app.get('/icons/icon-192.png', (c) => c.body(ICON_SVG, 200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }));
app.get('/icons/icon-512.png', (c) => c.body(ICON_SVG, 200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }));
app.get('/static/icons/icon-192.png', (c) => c.body(ICON_SVG, 200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }));
app.get('/static/icons/icon-512.png', (c) => c.body(ICON_SVG, 200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }));
app.get('/apple-touch-icon.png', (c) => c.body(ICON_SVG, 200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }));
app.get('/apple-touch-icon-precomposed.png', (c) => c.body(ICON_SVG, 200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }));

app.get('/manifest.webmanifest', (c) => c.redirect('/manifest.json', 301));

app.get('/sw.js', (c) => {
  const swScript = `
const CACHE_NAME = 'finatrack-v15';
const STATIC_ASSETS = ['/manifest.json', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/favicon.ico'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req));
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});`;

  return c.body(swScript, 200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Service-Worker-Allowed': '/',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
});

// ------------------------------------------------------------------------------
// 1. FINANCE DASHBOARD (GET /)
// ------------------------------------------------------------------------------
app.get('/', async (c) => {
  const { supabase, userId, username, isLoggedIn } = await getRequestContext(c);
  const toast = c.req.query('toast') || '';

  let accounts: any[] = [];
  let transactions: any[] = [];
  let goals: any[] = [];
  let budgets: any[] = [];
  let debts: any[] = [];
  let bills: any[] = [];
  let allocationRules: any[] = [];
  let riderLogs: any[] = [];
  let complianceDeadlines: any[] = [];

  if (userId) {
    const [accRes, txRes, goalRes, bgtRes, debtRes, billRes, ruleRes, logRes, compRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(50),
      supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('budgets').select('*').eq('user_id', userId),
      supabase.from('debts').select('*').eq('user_id', userId).order('due_at', { ascending: true }),
      supabase.from('bills').select('*').eq('user_id', userId).order('due_day', { ascending: true }),
      supabase.from('allocation_rules').select('*').eq('user_id', userId).order('percentage', { ascending: false }),
      supabase.from('rider_logs').select('*').eq('user_id', userId),
      supabase.from('compliance_deadlines').select('*').eq('user_id', userId),
    ]);

    accounts = accRes.data || [];
    transactions = txRes.data || [];
    goals = goalRes.data || [];
    budgets = bgtRes.data || [];
    debts = debtRes.data || [];
    bills = billRes.data || [];
    allocationRules = ruleRes.data || [];
    riderLogs = logRes?.data || [];
    complianceDeadlines = compRes?.data || [];

    if (goals.length === 0) {
      const defaultToInsert = [
        { user_id: userId, title: '55" 4K Smart TV', target_amount: 45000, current_amount: 0, target_date: '2026-12-31' },
        { user_id: userId, title: '4-Burner Gas Cooker & Oven', target_amount: 28000, current_amount: 0, target_date: '2026-11-30' },
        { user_id: userId, title: '5-Seater Living Room Sofa / Seat', target_amount: 35000, current_amount: 0, target_date: '2027-01-31' }
      ];
      try {
        const { data: insertedGoals } = await supabase.from('goals').insert(defaultToInsert).select();
        goals = (insertedGoals && insertedGoals.length > 0) ? insertedGoals : defaultToInsert.map((g, idx) => ({ id: `default-goal-${idx + 1}`, ...g }));
      } catch (e) {
        goals = defaultToInsert.map((g, idx) => ({ id: `default-goal-${idx + 1}`, ...g }));
      }
    }

    if (allocationRules.length === 0) {
      const defaultRulesToInsert = [
        { user_id: userId, bucket_name: 'Ziidi MMF (Safaricom)', target_type: 'ACCOUNT', percentage: 20.0, icon: '📈', is_active: 1 },
        { user_id: userId, bucket_name: 'Lock / Sacco Savings', target_type: 'ACCOUNT', percentage: 20.0, icon: '🔒', is_active: 1 },
        { user_id: userId, bucket_name: 'Savings Goals', target_type: 'GOAL', percentage: 15.0, icon: '🎯', is_active: 1 },
        { user_id: userId, bucket_name: 'Recurring Bills Reserve', target_type: 'ACCOUNT', percentage: 15.0, icon: '⚡', is_active: 1 },
        { user_id: userId, bucket_name: 'Daily Living Expenses', target_type: 'CASH', percentage: 30.0, icon: '💵', is_active: 1 }
      ];
      try {
        const { data: insertedRules } = await supabase.from('allocation_rules').insert(defaultRulesToInsert).select();
        allocationRules = (insertedRules && insertedRules.length > 0) ? insertedRules : defaultRulesToInsert.map((r, idx) => ({ id: `default-rule-${idx + 1}`, ...r }));
      } catch (e) {
        allocationRules = defaultRulesToInsert.map((r, idx) => ({ id: `default-rule-${idx + 1}`, ...r }));
      }
    }
  } else {
    const { data: guestRules } = await supabase.from('allocation_rules').select('*').eq('is_active', 1);
    allocationRules = guestRules || [];
    goals = [
      { id: 'goal-1', title: '55" 4K Smart TV', target_amount: 45000, current_amount: 0, target_date: '2026-12-31' },
      { id: 'goal-2', title: '4-Burner Gas Cooker & Oven', target_amount: 28000, current_amount: 0, target_date: '2026-11-30' },
      { id: 'goal-3', title: '5-Seater Living Room Sofa / Seat', target_amount: 35000, current_amount: 0, target_date: '2027-01-31' }
    ];
    debts = [];
  }

  const DEFAULT_RULES = [
    { id: 'rule-1', bucket_name: 'Ziidi MMF (Safaricom)', target_type: 'ACCOUNT', percentage: 20.0, icon: '📈', is_active: 1 },
    { id: 'rule-2', bucket_name: 'Lock / Sacco Savings', target_type: 'ACCOUNT', percentage: 20.0, icon: '🔒', is_active: 1 },
    { id: 'rule-3', bucket_name: 'Savings Goals', target_type: 'GOAL', percentage: 15.0, icon: '🎯', is_active: 1 },
    { id: 'rule-4', bucket_name: 'Recurring Bills Reserve', target_type: 'ACCOUNT', percentage: 15.0, icon: '⚡', is_active: 1 },
    { id: 'rule-5', bucket_name: 'Daily Living Expenses', target_type: 'CASH', percentage: 30.0, icon: '💵', is_active: 1 }
  ];

  const accs = accounts;
  const txs = transactions;
  const rules = (allocationRules && allocationRules.length > 0) ? allocationRules : DEFAULT_RULES;

  // Aggregations
  const totalBalance = accs.reduce((sum, a) => sum + Number(a.balance || 0), 0);

  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7);
  const currentYear = String(today.getFullYear());
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentDay = today.getDate();

  // Weekly calculation (Mon - Sun)
  const dayOfWeek = (today.getDay() + 6) % 7; // 0 for Monday, 6 for Sunday
  const daysElapsedWeek = dayOfWeek + 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek);
  const mondayStr = monday.toISOString().slice(0, 10);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const sundayStr = sunday.toISOString().slice(0, 10);

  // Yearly calculation
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const isLeap = (today.getFullYear() % 4 === 0 && today.getFullYear() % 100 !== 0) || (today.getFullYear() % 400 === 0);
  const totalDaysInYear = isLeap ? 366 : 365;
  const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Retrieve user target preferences or defaults
  const bgtMap = new Map((budgets || []).map((b: any) => [b.category, Number(b.limit_amount || 0)]));

  const targetIncWeekly = bgtMap.get('TARGET_INCOME_WEEKLY') || 15000;
  const targetIncMonthly = bgtMap.get('TARGET_INCOME_MONTHLY') || 65000;
  const targetIncYearly = bgtMap.get('TARGET_INCOME_YEARLY') || 780000;

  const targetExpWeekly = bgtMap.get('TARGET_EXPENSE_WEEKLY') || 6000;
  const targetExpMonthly = bgtMap.get('TARGET_EXPENSE_MONTHLY') || 25000;
  const targetExpYearly = bgtMap.get('TARGET_EXPENSE_YEARLY') || 300000;

  const catLimitLiving = bgtMap.get('Living Expenses') || 8000;
  const catLimitFood = bgtMap.get('Food & Groceries') || 6000;
  const catLimitFuel = bgtMap.get('Fuel & Petrol') || bgtMap.get('Fuel & Petrol / EV Swaps') || 7000;
  const catLimitBills = bgtMap.get('Utilities & Bills') || 4000;

  let weeklyIncome = 0;
  let weeklyExpenses = 0;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let yearlyIncome = 0;
  let yearlyExpenses = 0;

  for (const t of txs) {
    const tDate = t.date || '';
    const amt = Number(t.amount || 0);
    const isInc = t.transaction_type === 'INCOME';
    const isExp = t.transaction_type === 'EXPENSE';

    if (tDate >= mondayStr && tDate <= sundayStr) {
      if (isInc) weeklyIncome += amt;
      if (isExp) weeklyExpenses += amt;
    }
    if (tDate.startsWith(currentMonth)) {
      if (isInc) monthlyIncome += amt;
      if (isExp) monthlyExpenses += amt;
    }
    if (tDate.startsWith(currentYear)) {
      if (isInc) yearlyIncome += amt;
      if (isExp) yearlyExpenses += amt;
    }
  }

  // Multi-timeframe Income and Expense Target Objects
  const incomeTargets = {
    weekly: calculateTargetPace(weeklyIncome, targetIncWeekly, 'WEEKLY', true, daysElapsedWeek, 7),
    monthly: calculateTargetPace(monthlyIncome, targetIncMonthly, 'MONTHLY', true, currentDay, daysInMonth),
    yearly: calculateTargetPace(yearlyIncome, targetIncYearly, 'YEARLY', true, dayOfYear, totalDaysInYear),
  };

  const expenseTargets = {
    weekly: calculateTargetPace(weeklyExpenses, targetExpWeekly, 'WEEKLY', false, daysElapsedWeek, 7),
    monthly: calculateTargetPace(monthlyExpenses, targetExpMonthly, 'MONTHLY', false, currentDay, daysInMonth),
    yearly: calculateTargetPace(yearlyExpenses, targetExpYearly, 'YEARLY', false, dayOfYear, totalDaysInYear),
  };

  const defaultCategories = [
    { name: 'Living Expenses', icon: '🏠', limit: catLimitLiving },
    { name: 'Food & Groceries', icon: '🛒', limit: catLimitFood },
    { name: 'Fuel & Petrol / EV Swaps', icon: '⛽', limit: catLimitFuel },
    { name: 'Utilities & Bills', icon: '⚡', limit: catLimitBills },
  ];

  const categoryBudgets = defaultCategories.map(cat => {
    const spent = txs
      .filter((t) => t.transaction_type === 'EXPENSE' && (
        (t.category || '').toLowerCase() === cat.name.toLowerCase() ||
        (cat.name.includes('Fuel') && ((t.category || '').toLowerCase().includes('fuel') || (t.category || '').toLowerCase().includes('petrol') || (t.category || '').toLowerCase().includes('battery') || (t.category || '').toLowerCase().includes('ev swap')))
      ) && (t.date || '').startsWith(currentMonth))
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    return {
      category: cat.name,
      icon: cat.icon,
      ...calculateBudgetPace(spent, cat.limit, currentDay, daysInMonth),
    };
  });

  // MMF passive yield calculations
  const mmfAccounts = [];
  let totalMonthlyPassive = new Decimal(0);
  for (const a of accs) {
    const rate = Number(a.interest_rate_p_a || 0);
    const bal = Number(a.balance || 0);
    if (rate > 0 || a.account_type === 'MMF' || a.account_type === 'SAVINGS') {
      const mYield = calculateMonthlyYield(bal, rate);
      const dYield = calculateDailyYield(bal, rate);
      const aYield = calculateAnnualYield(bal, rate);
      totalMonthlyPassive = totalMonthlyPassive.plus(mYield);
      mmfAccounts.push({
        ...a,
        monthly_return: mYield.toFixed(2),
        daily_return: dYield.toFixed(2),
        annual_return: aYield.toFixed(2),
      });
    }
  }

  // Enriched Debts & Loans with Danger Zone Intelligence
  const enrichedDebts = (debts || []).map((d: any) => {
    const total = Number(d.total_amount || 0);
    const paid = Number(d.paid_amount || 0);
    const remaining = Math.max(0, total - paid);
    const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    const danger = calculateDebtDeadline(d.due_at);
    const isSettled = d.status === 'PAID' || remaining === 0;

    return {
      ...d,
      total,
      paid,
      remaining,
      percent,
      is_settled: isSettled,
      danger_status: danger,
    };
  });

  // Emergency Runway Meter
  const runwayStatus = calculateEmergencyRunway(totalBalance, monthlyExpenses, 25000);

  // Total Debt Liabilities
  const totalDebt = enrichedDebts.filter((d: any) => !d.is_settled).reduce((s: number, d: any) => s + Number(d.remaining || 0), 0);

  // Financial Freedom & Health Score (0 - 100)
  const healthScore = calculateFinancialHealthScore({
    liquidBalance: totalBalance,
    totalDebt,
    monthlyIncome,
    monthlyExpenses,
    monthlyIncomeTarget: incomeTargets.monthly.target,
    monthlyExpenseTarget: expenseTargets.monthly.target,
    runwayMonths: runwayStatus.months,
  });

  // EV vs Petrol ROI Intelligence
  const evRoiStats = calculateEvRoiSavings(riderLogs || []);

  // Unified Deadlines & Renewals Timeline
  const complianceItems = (complianceDeadlines || []).map((c: any) => ({
    id: c.id,
    name: c.title || c.item_type || c.name || 'Vehicle Document',
    title: c.title || c.item_type || c.name || 'Vehicle Document',
    expiryDate: c.expiry_date,
    costKes: Number(c.renewal_cost || c.cost || 0),
    notes: c.notes,
  }));
  const unifiedTimeline = buildUnifiedTimeline({
    debts: enrichedDebts,
    bills: bills || [],
    complianceItems,
  });

  // Monthly Expense Category Breakdown for Chart
  const categoryTotals: Record<string, number> = {};
  for (const t of txs) {
    if (t.transaction_type === 'EXPENSE' && t.date && t.date.startsWith(currentMonth)) {
      const cat = t.category || 'Living Expenses';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount || 0);
    }
  }
  const categoryBreakdown = Object.entries(categoryTotals).map(([category, amount]) => ({
    category,
    name: category,
    amount,
    percentage: monthlyExpenses > 0 ? Math.round((amount / monthlyExpenses) * 100) : 0,
  })).sort((a, b) => b.amount - a.amount);

  const userCurrency = getCookie(c, 'finatrack_currency') === 'USD' ? 'USD' : 'Ksh';

  const html = renderFinanceDashboard({
    accounts: accs,
    transactions: txs,
    goals: goals || [],
    budgets: categoryBudgets,
    income_targets: incomeTargets,
    expense_targets: expenseTargets,
    category_budgets: categoryBudgets,
    category_breakdown: categoryBreakdown,
    debts: enrichedDebts,
    bills: bills || [],
    mmf_accounts: mmfAccounts,
    allocation_rules: rules,
    total_balance: totalBalance,
    weekly_income: weeklyIncome,
    weekly_expenses: weeklyExpenses,
    monthly_income: monthlyIncome,
    monthly_expenses: monthlyExpenses,
    yearly_income: yearlyIncome,
    yearly_expenses: yearlyExpenses,
    net_savings: monthlyIncome - monthlyExpenses,
    total_monthly_passive_income: totalMonthlyPassive.toFixed(2),
    runway_status: runwayStatus,
    health_score: healthScore,
    ev_roi_stats: evRoiStats,
    unified_timeline: unifiedTimeline,
    usd_to_kes: USD_TO_KES,
    current_currency: userCurrency,
    toast,
    username,
    is_logged_in: isLoggedIn,
  });

  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  return c.html(html);
});

// ------------------------------------------------------------------------------
// 2. RIDER DASHBOARD (GET /rider)
// ------------------------------------------------------------------------------
app.get('/rider', async (c) => {
  const { supabase, userId, username, isLoggedIn } = await getRequestContext(c);
  const toast = c.req.query('toast') || '';

  let bikes: any[] = [];
  let logs: any[] = [];
  let accounts: any[] = [];
  let maintenance: any[] = [];
  let compliance: any[] = [];
  let financing: any[] = [];
  let allocationRules: any[] = [];

  if (userId) {
    const [bikeRes, logRes, accRes, maintRes, compRes, finRes, ruleRes] = await Promise.all([
      supabase.from('bikes').select('*').eq('user_id', userId),
      supabase.from('rider_logs').select('*').eq('user_id', userId).order('date', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', userId),
      supabase.from('maintenance_schedules').select('*').eq('user_id', userId),
      supabase.from('compliance_deadlines').select('*').eq('user_id', userId),
      supabase.from('bike_financings').select('*').eq('user_id', userId),
      supabase.from('allocation_rules').select('*').eq('user_id', userId),
    ]);

    bikes = bikeRes.data || [];
    logs = logRes.data || [];
    accounts = accRes.data || [];
    maintenance = maintRes.data || [];
    compliance = compRes.data || [];
    financing = finRes.data || [];
    allocationRules = ruleRes.data || [];
  } else {
    maintenance = [];
    compliance = [];
  }

  const activeBikes = bikes;
  const shiftLogs = logs;

  // Shift & Time Intelligence Engine (in KES)
  let totalHours = 0;
  let totalEarnedKes = 0;
  let totalExpensesKes = 0;

  const windowMap: Record<string, { label: string; hours: number; gross: number; net: number; count: number }> = {
    MORNING: { label: '🌅 Early Morning (05:00 – 11:00)', hours: 0, gross: 0, net: 0, count: 0 },
    LUNCH: { label: '🍲 Midday & Lunch (11:00 – 14:00)', hours: 0, gross: 0, net: 0, count: 0 },
    AFTERNOON: { label: '☀️ Afternoon Window (14:00 – 17:00)', hours: 0, gross: 0, net: 0, count: 0 },
    EVENING: { label: '🌆 Evening Rush (17:00 – 21:00)', hours: 0, gross: 0, net: 0, count: 0 },
    NIGHT: { label: '🌙 Late Night (21:00 – 05:00)', hours: 0, gross: 0, net: 0, count: 0 },
  };

  const dayMap: Record<number, { name: string; gross: number; count: number }> = {
    0: { name: 'Sunday', gross: 0, count: 0 },
    1: { name: 'Monday', gross: 0, count: 0 },
    2: { name: 'Tuesday', gross: 0, count: 0 },
    3: { name: 'Wednesday', gross: 0, count: 0 },
    4: { name: 'Thursday', gross: 0, count: 0 },
    5: { name: 'Friday', gross: 0, count: 0 },
    6: { name: 'Saturday', gross: 0, count: 0 },
  };

  for (const l of shiftLogs) {
    const hrs = Number(l.shift_hours || 8);
    const gross = Number(l.total_earned || 0);
    const exp = Number(l.fuel_cost || 0) + Number(l.food_spent || 0) + Number(l.maintenance_cost || 0) + Number(l.airtime_spent || 0) + Number(l.misc_expenses || 0);
    const net = gross - exp;

    totalHours += hrs;
    totalEarnedKes += gross;
    totalExpensesKes += exp;

    const win = classifyShiftWindow(l.start_time, l.end_time);
    if (windowMap[win.windowKey]) {
      windowMap[win.windowKey].hours += hrs;
      windowMap[win.windowKey].gross += gross;
      windowMap[win.windowKey].net += net;
      windowMap[win.windowKey].count += 1;
    }

    const d = new Date(l.date).getDay();
    if (dayMap[d]) {
      dayMap[d].gross += gross;
      dayMap[d].count += 1;
    }
  }

  const grossHourlyRate = totalHours > 0 ? (totalEarnedKes / totalHours).toFixed(2) : '0.00';
  const netHourlyRate = totalHours > 0 ? ((totalEarnedKes - totalExpensesKes) / totalHours).toFixed(2) : '0.00';

  // Best day computation
  let bestDayName = 'Friday';
  let bestDayAvg = 0;
  const dayAnalysis = Object.values(dayMap).map((d) => {
    const avg = d.count > 0 ? Math.round(d.gross / d.count) : 0;
    if (avg > bestDayAvg) {
      bestDayAvg = avg;
      bestDayName = d.name;
    }
    return {
      day_name: d.name,
      avg_earned: avg,
      avg_earned_display: avg.toLocaleString(),
      top_window: 'Evening (17:00 – 21:00)',
      is_best: false,
    };
  });
  dayAnalysis.forEach((d) => { if (d.day_name === bestDayName) d.is_best = true; });

  let topWindowName = 'Evening Rush (17:00 – 21:00)';
  let topWindowHourly = 0;
  const timeWindowAnalysis = Object.entries(windowMap).map(([_, w]) => {
    const gRate = w.hours > 0 ? Math.round(w.gross / w.hours) : 0;
    const nRate = w.hours > 0 ? Math.round(w.net / w.hours) : 0;
    const share = totalEarnedKes > 0 ? Math.round((w.gross / totalEarnedKes) * 100) : 0;
    if (gRate > topWindowHourly) {
      topWindowHourly = gRate;
      topWindowName = `${w.label} • Peak Ksh ${gRate.toLocaleString()}/hr`;
    }
    return {
      window_label: w.label,
      gross_hourly: gRate,
      net_hourly: nRate,
      share_pct: share,
      shifts_count: w.count,
    };
  });

  const timeIntelligence = {
    overall_avg_gross_hourly: grossHourlyRate,
    overall_avg_net_hourly: netHourlyRate,
    best_day: `${bestDayName} • Avg Ksh ${bestDayAvg.toLocaleString()} / shift`,
    best_time_window: topWindowName,
    time_window_analysis: timeWindowAnalysis,
    day_analysis: dayAnalysis,
    weekly_breakdown: [],
    monthly_breakdown: [],
  };

  const userCurrency = getCookie(c, 'finatrack_currency') === 'USD' ? 'USD' : 'Ksh';

  const html = renderRiderDashboard({
    active_bike: (activeBikes || []).find((b: any) => b.is_active === 1) || activeBikes[0] || null,
    bikes: activeBikes,
    rider_logs: shiftLogs,
    time_intelligence: timeIntelligence,
    maintenance_schedules: maintenance || [],
    compliance_deadlines: compliance || [],
    bike_financings: financing || [],
    ev_roi_stats: calculateEvRoiSavings(shiftLogs || []),
    allocation_rules: (allocationRules && allocationRules.length > 0) ? allocationRules : [
      { id: 'rule-1', bucket_name: 'Ziidi MMF (Safaricom)', target_type: 'ACCOUNT', percentage: 20.0, icon: '📈', is_active: 1 },
      { id: 'rule-2', bucket_name: 'Lock / Sacco Savings', target_type: 'ACCOUNT', percentage: 20.0, icon: '🔒', is_active: 1 },
      { id: 'rule-3', bucket_name: 'Savings Goals', target_type: 'GOAL', percentage: 15.0, icon: '🎯', is_active: 1 },
      { id: 'rule-4', bucket_name: 'Recurring Bills Reserve', target_type: 'ACCOUNT', percentage: 15.0, icon: '⚡', is_active: 1 },
      { id: 'rule-5', bucket_name: 'Daily Living Expenses', target_type: 'CASH', percentage: 30.0, icon: '💵', is_active: 1 }
    ],
    accounts: accounts || [],
    toast,
    usd_to_kes: USD_TO_KES,
    current_currency: userCurrency,
    username,
    is_logged_in: isLoggedIn,
  });

  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  return c.html(html);
});

// ------------------------------------------------------------------------------
// 3. AUTHENTICATION VIEWS
// ------------------------------------------------------------------------------
app.get('/login', (c) => {
  const toast = c.req.query('toast') || '';
  return c.html(renderAuthView({ mode: 'login', toast }));
});

app.get('/signup', (c) => {
  const toast = c.req.query('toast') || '';
  return c.html(renderAuthView({ mode: 'signup', toast }));
});

app.get('/auth', (c) => {
  const toast = c.req.query('toast') || '';
  return c.html(renderAuthView({ mode: 'signup', toast }));
});

// ------------------------------------------------------------------------------
// 4. MOUNT ROUTE MODULES
// ------------------------------------------------------------------------------
app.route('/', financeRoutes);
app.route('/', riderRoutes);
app.route('/', exportRoutes);
app.route('/', authRoutes);

// Export for Cloudflare Pages / Workers & Local execution
export default app;
