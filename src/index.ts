import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { AppEnv, getSupabaseClient } from './db/supabase';
import { financeRoutes } from './routes/finance';
import { riderRoutes, classifyShiftWindow } from './routes/rider';
import { exportRoutes } from './routes/export';
import { renderFinanceDashboard } from './views/financeView';
import { renderRiderDashboard } from './views/riderView';
import {
  toDecimal,
  calculateMonthlyYield,
  calculateDailyYield,
  calculateAnnualYield,
  calculateBudgetPace,
  calculateShiftHours,
  formatTimeDisplay
} from './utils/math';
import { Decimal } from 'decimal.js';

export const app = new Hono<{ Bindings: AppEnv }>();

const USD_TO_KES = 129.0;

// ------------------------------------------------------------------------------
// 1. FINANCE DASHBOARD (GET /)
// ------------------------------------------------------------------------------
app.get('/', async (c) => {
  const supabase = getSupabaseClient(c.env);
  const toast = c.req.query('toast') || '';

  const { data: accounts } = await supabase.from('accounts').select('*').order('created_at', { ascending: true });
  const { data: transactions } = await supabase.from('transactions').select('*').order('date', { ascending: false }).limit(50);
  const { data: goals } = await supabase.from('goals').select('*').order('created_at', { ascending: true });
  const { data: budgets } = await supabase.from('budgets').select('*');
  const { data: debts } = await supabase.from('debts').select('*').order('due_at', { ascending: true });
  const { data: bills } = await supabase.from('bills').select('*').order('due_day', { ascending: true });
  const { data: allocationRules } = await supabase.from('allocation_rules').select('*').order('percentage', { ascending: false });

  const accs = accounts || [];
  const txs = transactions || [];

  // Aggregations
  const totalBalance = accs.reduce((sum, a) => sum + Number(a.balance || 0), 0);

  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentDay = today.getDate();

  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  for (const t of txs) {
    if ((t.date || '').startsWith(currentMonth)) {
      if (t.transaction_type === 'INCOME') monthlyIncome += Number(t.amount || 0);
      if (t.transaction_type === 'EXPENSE') monthlyExpenses += Number(t.amount || 0);
    }
  }

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

  // Budget burn rate calculations
  const budgetData = (budgets || []).map((b) => {
    const spent = txs
      .filter((t) => t.transaction_type === 'EXPENSE' && (t.category || '').toLowerCase() === b.category.toLowerCase() && (t.date || '').startsWith(currentMonth))
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return {
      id: b.id,
      category: b.category,
      ...calculateBudgetPace(spent, b.limit_amount, currentDay, daysInMonth),
    };
  });

  const html = renderFinanceDashboard({
    accounts: accs,
    transactions: txs,
    goals: goals || [],
    budgets: budgetData,
    debts: debts || [],
    bills: bills || [],
    mmf_accounts: mmfAccounts,
    allocation_rules: allocationRules || [],
    total_balance: totalBalance,
    monthly_income: monthlyIncome,
    monthly_expenses: monthlyExpenses,
    net_savings: monthlyIncome - monthlyExpenses,
    total_monthly_passive_income: totalMonthlyPassive.toFixed(2),
    usd_to_kes: USD_TO_KES,
    toast,
  });

  return c.html(html);
});

// ------------------------------------------------------------------------------
// 2. RIDER DASHBOARD (GET /rider)
// ------------------------------------------------------------------------------
app.get('/rider', async (c) => {
  const supabase = getSupabaseClient(c.env);
  const toast = c.req.query('toast') || '';

  const { data: bikes } = await supabase.from('bikes').select('*');
  const { data: logs } = await supabase.from('rider_logs').select('*').order('date', { ascending: false });
  const { data: accounts } = await supabase.from('accounts').select('*');
  const { data: maintenance } = await supabase.from('maintenance_schedules').select('*');
  const { data: compliance } = await supabase.from('compliance_deadlines').select('*');
  const { data: financing } = await supabase.from('bike_financings').select('*');
  const { data: allocationRules } = await supabase.from('allocation_rules').select('*');

  const shiftLogs = logs || [];

  // Shift & Time Intelligence Engine
  let totalHours = 0;
  let totalEarnedUsd = 0;
  let totalExpensesUsd = 0;

  const windowMap: Record<string, { label: string; hours: number; gross: number; net: number; count: number }> = {
    MORNING: { label: '🌅 Early Morning (05:00 – 11:00)', hours: 0, gross: 0, net: 0, count: 0 },
    MIDDAY: { label: '☀️ Midday & Lunch (11:00 – 16:00)', hours: 0, gross: 0, net: 0, count: 0 },
    EVENING: { label: '🌆 Evening Rush (16:00 – 21:00)', hours: 0, gross: 0, net: 0, count: 0 },
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
    const exp = Number(l.fuel_cost || 0) + Number(l.food_spent || 0) + Number(l.maintenance_cost || 0) + Number(l.airtime_spent || 0);
    const net = gross - exp;

    totalHours += hrs;
    totalEarnedUsd += gross;
    totalExpensesUsd += exp;

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

  const grossHourlyRate = totalHours > 0 ? Math.round((totalEarnedUsd * USD_TO_KES) / totalHours) : 0;
  const netHourlyRate = totalHours > 0 ? Math.round(((totalEarnedUsd - totalExpensesUsd) * USD_TO_KES) / totalHours) : 0;

  // Best day computation
  let bestDayName = 'Friday';
  let bestDayAvg = 0;
  const dayAnalysis = Object.entries(dayMap).map(([_, d]) => {
    const avg = d.count > 0 ? Math.round((d.gross * USD_TO_KES) / d.count) : 0;
    if (avg > bestDayAvg) {
      bestDayAvg = avg;
      bestDayName = d.name;
    }
    return {
      day_name: d.name,
      avg_earned_display: avg.toLocaleString(),
      top_window: 'Midday (11am – 10pm)',
      is_best: false,
    };
  });
  dayAnalysis.forEach((d) => { if (d.day_name === bestDayName) d.is_best = true; });

  const timeWindowAnalysis = Object.entries(windowMap).map(([_, w]) => {
    const gRate = w.hours > 0 ? Math.round((w.gross * USD_TO_KES) / w.hours) : 0;
    const nRate = w.hours > 0 ? Math.round((w.net * USD_TO_KES) / w.hours) : 0;
    const share = totalEarnedUsd > 0 ? Math.round((w.gross / totalEarnedUsd) * 100) : 0;
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
    best_time_window: 'Midday & Lunch (11:00 – 16:00)',
    time_window_analysis: timeWindowAnalysis,
    day_analysis: dayAnalysis,
    weekly_breakdown: [],
    monthly_breakdown: [],
  };

  const html = renderRiderDashboard({
    active_bike: (bikes || []).find((b) => b.is_active === 1) || (bikes || [])[0] || null,
    bikes: bikes || [],
    rider_logs: shiftLogs,
    time_intelligence: timeIntelligence,
    maintenance_schedules: maintenance || [],
    compliance_deadlines: compliance || [],
    bike_financings: financing || [],
    allocation_rules: allocationRules || [],
    accounts: accounts || [],
    toast,
    usd_to_kes: USD_TO_KES,
  });

  return c.html(html);
});

// ------------------------------------------------------------------------------
// 3. MOUNT ROUTE MODULES
// ------------------------------------------------------------------------------
app.route('/', financeRoutes);
app.route('/', riderRoutes);
app.route('/', exportRoutes);

// Export for Cloudflare Pages / Workers & Local execution
export default app;
