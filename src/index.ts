import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { AppEnv, getRequestContext, inMemoryStore } from './db/supabase';
import { financeRoutes, resolveEffectiveAllocationRules, getSavedAllocationRules, getRecurringBills, reconcileRecurringBillsAndTransactions, doesTransactionMatchRecurringBill, getSavedGoalHorizons, resolveGoalHorizon, getSavedMmfSettings, saveMmfSettingsCookie, ALL_USER_DATA_COOKIES, clearAllUserDataCookies } from './routes/finance';
import { riderRoutes, classifyShiftWindow, resolveEffectiveComplianceDeadlines, resolveEffectiveMaintenanceSchedules, resolveEffectiveRiderLogs, reconcileRiderShiftLogsWithTransactions, getOdometerConfig, getStrictSaverConfig, getPlatformRemittanceConfig, getRoadsideIncidents, getWeeklyBatchPot } from './routes/rider';
import { traderRoutes, getSavedTraderLogs, getSavedTraderCredits, getTraderConfig } from './routes/trader';
import { salariedRoutes, getSalariedConfig, resolveEffectiveSalariedLoans } from './routes/salaried';
import { exportRoutes } from './routes/export';
import { authRoutes } from './routes/auth';
import { renderFinanceDashboard } from './views/financeView';
import { renderRiderDashboard } from './views/riderView';
import { renderTraderDashboard } from './views/traderView';
import { renderSalariedDashboard } from './views/salariedView';
import { renderAuthView } from './views/authView';
import { getActiveProfile, setActiveProfile, PROFILES, ProfileMode } from './utils/profile';
import { getPaystackConfig, isUserPaywalled } from './utils/paystack';
import {
  toDecimal,
  calculateMonthlyYield,
  calculateDailyYield,
  calculateAnnualYield,
  calculateBankMmfYieldBreakdown,
  inferKenyanInstitutionRate,
  calculateBudgetPace,
  calculateTargetPace,
  calculateDebtDeadline,
  calculateShiftHours,
  formatTimeDisplay,
  calculateEmergencyRunway,
  calculateEvRoiSavings,
  calculateFinancialHealthScore,
  buildUnifiedTimeline,
  sortTransactionsLatestFirst,
  isTransferTransaction
} from './utils/math';
import { Decimal } from 'decimal.js';

export const app = new Hono<{ Bindings: AppEnv }>();

const USD_TO_KES = 129.0;
const CLEAN_SLATE_EPOCH = '20261109_fresh_v1';

app.use('*', async (c, next) => {
  const currentEpoch = getCookie(c, 'finatrack_clean_epoch');
  if (currentEpoch !== CLEAN_SLATE_EPOCH) {
    const hasStaleCookies = ALL_USER_DATA_COOKIES.some((name) => Boolean(getCookie(c, name)));
    clearAllUserDataCookies(c);
    setCookie(c, 'finatrack_clean_epoch', CLEAN_SLATE_EPOCH, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
    if (hasStaleCookies && c.req.method === 'GET' && ['/', '/rider', '/trader', '/salaried'].includes(c.req.path)) {
      return c.redirect(`${c.req.path}?toast=${encodeURIComponent('✨ Fresh Start Active: All previous data cleared!')}&reset_ls=1`, 303);
    }
  }
  await next();
});

export interface SmartNotificationItem {
  id: string;
  category: 'DAILY_LOGGER' | 'UPCOMING_LOAN' | 'RECURRING_BILL' | 'FLEET_ALERT';
  urgency: 'OVERDUE' | 'CRITICAL' | 'WARNING' | 'SAFE';
  icon: string;
  title: string;
  subtitle: string;
  amount_kes?: number;
  action_href: string;
  action_label: string;
}

export function buildSmartNotifications(opts: {
  todayIso: string;
  currentDay: number;
  riderLogs: any[];
  enrichedDebts: any[];
  recurringBills: any[];
  complianceDeadlines: any[];
  odometerConfig?: any;
  isRiderView?: boolean;
}): SmartNotificationItem[] {
  const items: SmartNotificationItem[] = [];
  const todayShifts = (opts.riderLogs || []).filter((l: any) => String(l.date || '').slice(0, 10) === opts.todayIso);
  const todayGross = todayShifts.reduce((s: number, l: any) => s + Number(l.total_earned || 0), 0);
  const todayExp = todayShifts.reduce(
    (s: number, l: any) =>
      s +
      Number(l.fuel_cost || 0) +
      Number(l.food_spent || 0) +
      Number(l.airtime_spent || 0) +
      Number(l.maintenance_cost || 0) +
      Number(l.misc_expenses || 0),
    0
  );
  const todayNet = todayGross - todayExp;

  // 1. Daily Logger Notification
  if (todayShifts.length === 0) {
    items.push({
      id: `notif-daily-logger-${opts.todayIso}`,
      category: 'DAILY_LOGGER',
      urgency: 'WARNING',
      icon: '📝',
      title: 'Daily Logger Pending Today',
      subtitle: `No shift or daily closeout logged yet for ${opts.todayIso}. Log earnings & expenses to keep your ledger synced.`,
      action_href: opts.isRiderView ? '#shift-log-card' : '#daily-logger-card',
      action_label: '⚡ Log Today',
    });
  } else {
    items.push({
      id: `notif-daily-logger-done-${opts.todayIso}`,
      category: 'DAILY_LOGGER',
      urgency: 'SAFE',
      icon: '✅',
      title: `Daily Logger Synced (${todayShifts.length} entry)`,
      subtitle: `Today's Gross Ksh ${todayGross.toLocaleString()} • Expenses Ksh ${todayExp.toLocaleString()} • Net Ksh ${todayNet.toLocaleString()}`,
      amount_kes: todayNet,
      action_href: opts.isRiderView ? '#shift-log-card' : '#daily-logger-card',
      action_label: '+ Add Entry',
    });
  }

  // 2. Upcoming & Overdue Loans
  const activeDebts = (opts.enrichedDebts || [])
    .filter((d: any) => !d.is_settled && Number(d.remaining || 0) > 0)
    .sort((a: any, b: any) => Number(a.danger_status?.daysRemaining ?? 999) - Number(b.danger_status?.daysRemaining ?? 999));

  for (const d of activeDebts) {
    const daysRem = Number(d.danger_status?.daysRemaining ?? 14);
    const urgency: 'OVERDUE' | 'CRITICAL' | 'WARNING' | 'SAFE' =
      daysRem < 0 ? 'OVERDUE' : daysRem <= 3 ? 'CRITICAL' : daysRem <= 7 ? 'WARNING' : 'SAFE';
    const typeLabel = d.debt_type === 'OWED_TO_ME' ? 'Loan Collection Due' : 'Upcoming Loan Repayment';
    items.push({
      id: `notif-loan-${d.id}`,
      category: 'UPCOMING_LOAN',
      urgency,
      icon: d.debt_type === 'OWED_TO_ME' ? '🤝' : '💳',
      title: `${typeLabel}: ${d.person_name}`,
      subtitle: `${d.danger_status?.badgeLabel || `Due ${d.due_at}`} • Remaining Ksh ${Number(d.remaining || 0).toLocaleString()}`,
      amount_kes: Number(d.remaining || 0),
      action_href: opts.isRiderView ? '/#debts-card' : '#debts-card',
      action_label: d.debt_type === 'OWED_TO_ME' ? 'Record Collection' : '💳 Repay Now',
    });
  }

  // 3. Unpaid Recurring Bills Due Soon or Overdue This Month
  const unpaidBills = (opts.recurringBills || []).filter((b: any) => !b.is_paid_this_month);
  for (const b of unpaidBills) {
    const dueDay = Number(b.due_day || 5);
    const diffDays = dueDay - opts.currentDay;
    if (diffDays <= 7) {
      const urgency: 'OVERDUE' | 'CRITICAL' | 'WARNING' =
        diffDays < 0 ? 'OVERDUE' : diffDays <= 2 ? 'CRITICAL' : 'WARNING';
      const dueText =
        diffDays < 0
          ? `Overdue by ${Math.abs(diffDays)} day(s) (Due Day ${dueDay})`
          : diffDays === 0
          ? `Due Today (Day ${dueDay})!`
          : `Due in ${diffDays} day(s) (Day ${dueDay})`;
      items.push({
        id: `notif-bill-${b.id}`,
        category: 'RECURRING_BILL',
        urgency,
        icon: b.icon || '⚡',
        title: `Unpaid Bill: ${b.name}`,
        subtitle: `${dueText} • Ksh ${Number(b.amount || 0).toLocaleString()}`,
        amount_kes: Number(b.amount || 0),
        action_href: opts.isRiderView ? '/#recurring-bills-card' : '#recurring-bills-card',
        action_label: '✅ Mark Paid',
      });
    }
  }

  // 4. Odometer Service & Compliance Alerts
  if (opts.odometerConfig && Number(opts.odometerConfig.remaining_to_service_km ?? 9999) <= 300) {
    const remKm = Number(opts.odometerConfig.remaining_to_service_km || 0);
    items.push({
      id: 'notif-odo-service',
      category: 'FLEET_ALERT',
      urgency: remKm <= 50 ? 'CRITICAL' : 'WARNING',
      icon: '🛢️',
      title: remKm <= 0 ? 'Oil & Bike Service Overdue!' : `Bike Service Due in ${remKm.toLocaleString()} km`,
      subtitle: `Odometer at ${Number(opts.odometerConfig.current_odometer_km || 0).toLocaleString()} km (Target: ${Number(opts.odometerConfig.next_service_km || 0).toLocaleString()} km)`,
      action_href: opts.isRiderView ? '#odometer-card' : '/rider#odometer-card',
      action_label: '🔧 View Odometer',
    });
  }

  for (const comp of opts.complianceDeadlines || []) {
    if (!comp || !comp.expiry_date) continue;
    const dl = calculateDebtDeadline(comp.expiry_date);
    if (dl.daysRemaining <= 10) {
      const compUrgency: 'OVERDUE' | 'CRITICAL' | 'WARNING' | 'SAFE' =
        dl.daysRemaining < 0 ? 'OVERDUE' : dl.daysRemaining <= 3 ? 'CRITICAL' : 'WARNING';
      items.push({
        id: `notif-comp-${comp.id}`,
        category: 'FLEET_ALERT',
        urgency: compUrgency,
        icon: '🛡️',
        title: `Permit/Insurance Alert: ${comp.title || comp.item_type || 'Document'}`,
        subtitle: `${dl.badgeLabel} • Renewal Ksh ${Number(comp.renewal_cost || 0).toLocaleString()}`,
        amount_kes: Number(comp.renewal_cost || 0),
        action_href: opts.isRiderView ? '#compliance-card' : '/rider#compliance-card',
        action_label: 'Renew',
      });
    }
  }

  return items;
}

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

  if (userId || isLoggedIn) {
    try {
      const filterByUser = (q: any) => userId ? q.eq('user_id', userId) : q;
      const [accRes, txRes, goalRes, bgtRes, debtRes, billRes, ruleRes, logRes, compRes] = await Promise.all([
        filterByUser(supabase.from('accounts').select('*')).order('created_at', { ascending: true }),
        filterByUser(supabase.from('transactions').select('*')).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(100),
        filterByUser(supabase.from('goals').select('*')).order('created_at', { ascending: true }),
        filterByUser(supabase.from('budgets').select('*')),
        filterByUser(supabase.from('debts').select('*')).order('due_at', { ascending: true }),
        filterByUser(supabase.from('bills').select('*')).order('due_day', { ascending: true }),
        filterByUser(supabase.from('allocation_rules').select('*')).order('percentage', { ascending: false }),
        filterByUser(supabase.from('rider_logs').select('*')),
        filterByUser(supabase.from('compliance_deadlines').select('*')),
      ]);

      accounts = accRes?.data || [];
      transactions = sortTransactionsLatestFirst(txRes?.data || []);
      goals = goalRes?.data || [];
      budgets = bgtRes?.data || [];
      debts = debtRes?.data || [];
      bills = billRes?.data || [];
      allocationRules = ruleRes?.data || [];
      riderLogs = logRes?.data || [];
      complianceDeadlines = compRes?.data || [];
    } catch (e) {
      accounts = [];
      transactions = [];
      goals = [];
      budgets = [];
      debts = [];
      bills = [];
      allocationRules = [];
      riderLogs = [];
      complianceDeadlines = [];
    }

    if (accounts.length === 0) {
      try {
        const { data: anyAccs } = await supabase.from('accounts').select('*').order('created_at', { ascending: true });
        accounts = (anyAccs && anyAccs.length > 0) ? anyAccs : (inMemoryStore.accounts || []);
      } catch (e) {
        accounts = inMemoryStore.accounts || [];
      }
    }

    if (userId && transactions.length === 0 && goals.length === 0 && riderLogs.length === 0) {
      try {
        const [anyTx, anyGoals, anyLogs] = await Promise.all([
          supabase.from('transactions').select('*').is('user_id', null).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(100),
          supabase.from('goals').select('*').is('user_id', null).order('created_at', { ascending: true }),
          supabase.from('rider_logs').select('*').is('user_id', null),
        ]);
        if (anyTx?.data?.length) transactions = sortTransactionsLatestFirst(anyTx.data);
        if (anyGoals?.data?.length) goals = anyGoals.data;
        if (anyLogs?.data?.length) riderLogs = anyLogs.data;
      } catch (e) {}
    }

    const legacyDummyGoalTitles = new Set([
      '55" 4K Smart TV',
      '4-Burner Gas Cooker & Oven',
      '5-Seater Living Room Sofa / Seat',
    ]);
    const untouchedDummyIds = goals
      .filter((g: any) => legacyDummyGoalTitles.has(String(g.title || '').trim()) && Number(g.current_amount || 0) === 0)
      .map((g: any) => g.id)
      .filter(Boolean);
    if (untouchedDummyIds.length > 0) {
      goals = goals.filter((g: any) => !untouchedDummyIds.includes(g.id));
      try {
        await supabase.from('goals').delete().in('id', untouchedDummyIds);
      } catch (e) {}
    }

    const savedCookieRules = getSavedAllocationRules(c);
    if (allocationRules.length === 0 && (!savedCookieRules || savedCookieRules.length === 0)) {
      const defaultRulesToInsert = [
        { user_id: userId, bucket_name: '👑 Pay Yourself First — Ziidi / MMF', target_type: 'ACCOUNT', percentage: 15.0, icon: '👑', is_active: 1 },
        { user_id: userId, bucket_name: '🔒 Pay Yourself First — Sacco / Lock', target_type: 'ACCOUNT', percentage: 15.0, icon: '🔒', is_active: 1 },
        { user_id: userId, bucket_name: '🏖️ Goals & Malindi Vacation Vault', target_type: 'GOAL', percentage: 20.0, icon: '🏖️', is_active: 1 },
        { user_id: userId, bucket_name: '⚡ Monthly Bills & Rent Reserve', target_type: 'ACCOUNT', percentage: 15.0, icon: '⚡', is_active: 1 },
        { user_id: userId, bucket_name: '🛠️ Fleet Service & Docs Reserve', target_type: 'ACCOUNT', percentage: 10.0, icon: '🛠️', is_active: 1 },
        { user_id: userId, bucket_name: '💵 Guilt-Free Daily Pocket', target_type: 'CASH', percentage: 25.0, icon: '💵', is_active: 1 }
      ];
      try {
        const { data: insertedRules } = await supabase.from('allocation_rules').insert(defaultRulesToInsert).select();
        allocationRules = (insertedRules && insertedRules.length > 0) ? insertedRules : [];
      } catch (e) {
        allocationRules = [];
      }
    }
  } else {
    allocationRules = [];

    // Fetch guest accounts from database so Finance Hub and Rider Hub are 100% in sync
    try {
      const { data: guestAccs } = await supabase.from('accounts').select('*').is('user_id', null).order('created_at', { ascending: true });
      if (guestAccs && guestAccs.length > 0) {
        accounts = guestAccs;
      } else {
        const { data: anyAccs } = await supabase.from('accounts').select('*').order('created_at', { ascending: true });
        accounts = anyAccs || [];
      }
    } catch (e) {
      accounts = [];
    }

    // Parse deleted goals cookie for guests
    let deletedGoalIds: string[] = [];
    try {
      const rawDel = getCookie(c, 'finatrack_deleted_goals') || '';
      if (rawDel) deletedGoalIds = JSON.parse(decodeURIComponent(rawDel));
    } catch (e) {}

    // Fetch guest goals strictly from this browser's cookie (no shared dummy goals)
    let cookieGuestGoals: any[] = [];
    try {
      const rawGuest = getCookie(c, 'finatrack_guest_goals') || '';
      if (rawGuest) {
        cookieGuestGoals = JSON.parse(decodeURIComponent(rawGuest));
      }
    } catch (e) {}

    const legacyDummyGoalTitles = new Set([
      '55" 4K Smart TV',
      '4-Burner Gas Cooker & Oven',
      '5-Seater Living Room Sofa / Seat',
    ]);

    const combinedMap = new Map<string, any>();
    for (const g of cookieGuestGoals) {
      const isLegacyUntouched = legacyDummyGoalTitles.has(String(g.title || '').trim()) && Number(g.current_amount || 0) === 0;
      if (!deletedGoalIds.includes(String(g.id)) && !isLegacyUntouched) {
        combinedMap.set(String(g.id), g);
      }
    }

    goals = Array.from(combinedMap.values());
    debts = [];
    transactions = [];
  }

  // Synchronize goal sub-splits from cookie (persists custom and proportional splits across guest mode & user changes)
  let cookieSplits: Record<string, number> = {};
  try {
    const rawCookie = getCookie(c, 'finatrack_goal_splits') || '';
    if (rawCookie) {
      cookieSplits = JSON.parse(decodeURIComponent(rawCookie));
    } else {
      const cookieHeader = c.req?.header('cookie') || '';
      const match = cookieHeader.match(/finatrack_goal_splits=([^;]+)/);
      if (match) cookieSplits = JSON.parse(decodeURIComponent(match[1]));
    }
  } catch (e) {
    cookieSplits = {};
  }

  const cookieHorizons = getSavedGoalHorizons(c);

  if (goals && goals.length > 0) {
    goals = goals.map((g: any, idx: number) => {
      let splitPct = g.split_percentage;
      if (cookieSplits[g.id] !== undefined) {
        splitPct = cookieSplits[g.id];
      } else if (cookieSplits[g.title] !== undefined) {
        splitPct = cookieSplits[g.title];
      } else if (cookieSplits[`goal-${idx + 1}`] !== undefined) {
        splitPct = cookieSplits[`goal-${idx + 1}`];
      }
      return {
        ...g,
        split_percentage: splitPct !== null && splitPct !== undefined ? Number(splitPct) : null,
        horizon: resolveGoalHorizon(g, cookieHorizons),
      };
    });
  }

  const accs = accounts;
  const rules = resolveEffectiveAllocationRules(c, allocationRules);

  // Aggregations
  const totalBalance = accs.reduce((sum, a) => sum + Number(a.balance || 0), 0);

  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7);
  const currentYear = String(today.getFullYear());
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentDay = today.getDate();

  // Reconcile Rider Daily Logger shifts AND Recurring Bills & Standing Orders with Expenses (Transactions) bidirectionally
  const effectiveRiderLogs = resolveEffectiveRiderLogs(c, riderLogs);
  const txsWithRiderShifts = reconcileRiderShiftLogsWithTransactions(effectiveRiderLogs || [], transactions || []);
  const { recurringBills: reconciledRecurringBills, syncedTransactions: txs } =
    reconcileRecurringBillsAndTransactions(c, getRecurringBills(c), bills || [], txsWithRiderShifts, currentMonth);
  const totalRecurringBillsKes = reconciledRecurringBills.reduce((s, b) => s + Number(b.amount || 0), 0);

  // Strict saver & work days configuration (Respects user's work schedule: defaults to 6 work days/week: Mon - Sat, Sunday rest)
  const strictSaverConfig = getStrictSaverConfig(c);
  const workDaysPerWeek = Math.min(7, Math.max(1, Number(strictSaverConfig?.work_days_per_week || 6)));

  // Weekly calculation (Mon - Sun calendar boundaries, with daily pacing aligned to work days)
  const dayOfWeek = (today.getDay() + 6) % 7; // 0 for Monday, 5 for Saturday, 6 for Sunday
  const isRestDay = dayOfWeek >= workDaysPerWeek; // e.g. Sunday in a 6-day work week
  const elapsedWorkDays = isRestDay ? workDaysPerWeek : Math.min(workDaysPerWeek, dayOfWeek + 1);

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
  const savedBillsLimit = bgtMap.get('Utilities & Bills') || 0;
  const catLimitBills = savedBillsLimit > 0 ? Math.max(savedBillsLimit, totalRecurringBillsKes) : (totalRecurringBillsKes || 4000);

  let weeklyIncome = 0;
  let weeklyExpenses = 0;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let yearlyIncome = 0;
  let yearlyExpenses = 0;

  for (const t of txs) {
    if (isTransferTransaction(t)) continue;

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

  // Multi-timeframe Income and Expense Target Objects (Paced to user's 6 work days/week or custom schedule)
  const incomeTargets = {
    weekly: calculateTargetPace(weeklyIncome, targetIncWeekly, 'WEEKLY', true, elapsedWorkDays, workDaysPerWeek, isRestDay),
    monthly: calculateTargetPace(monthlyIncome, targetIncMonthly, 'MONTHLY', true, currentDay, daysInMonth),
    yearly: calculateTargetPace(yearlyIncome, targetIncYearly, 'YEARLY', true, dayOfYear, totalDaysInYear),
  };

  const expenseTargets = {
    weekly: calculateTargetPace(weeklyExpenses, targetExpWeekly, 'WEEKLY', false, elapsedWorkDays, workDaysPerWeek, isRestDay),
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
      .filter((t) => {
        if (isTransferTransaction(t) || t.transaction_type !== 'EXPENSE' || !(t.date || '').startsWith(currentMonth)) {
          return false;
        }
        const tCat = (t.category || '').toLowerCase();
        if (tCat === cat.name.toLowerCase()) return true;
        if (cat.name.includes('Fuel') && (tCat.includes('fuel') || tCat.includes('petrol') || tCat.includes('battery') || tCat.includes('ev swap'))) {
          return true;
        }
        if (cat.name === 'Utilities & Bills' && (tCat.startsWith('utility:') || tCat.includes('utilities') || tCat.includes('bill') || reconciledRecurringBills.some((b) => doesTransactionMatchRecurringBill(t, b, currentMonth)))) {
          return true;
        }
        return false;
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    return {
      category: cat.name,
      icon: cat.icon,
      ...calculateBudgetPace(spent, cat.limit, currentDay, daysInMonth),
    };
  });

  // MMF & Bank Daily Compounding Interest Engine (Britam, Ziidi, Sanlam, CIC, Banks & SACCOs)
  const mmfSettings = getSavedMmfSettings(c);
  let mmfSettingsDirty = false;
  const todayIsoForMmf = today.toISOString().slice(0, 10);
  const mmfAccounts = [];
  let totalMonthlyPassive = new Decimal(0);

  for (let i = 0; i < accs.length; i++) {
    const a = accs[i];
    const accIdStr = String(a.id);
    const savedSetting = mmfSettings[accIdStr] || {};
    const inferred = inferKenyanInstitutionRate(a.name, a.account_type, savedSetting.rate_p_a ?? a.interest_rate_p_a);
    const effectiveRate =
      savedSetting.rate_p_a !== undefined
        ? Number(savedSetting.rate_p_a)
        : Number(a.interest_rate_p_a || 0) > 0
        ? Number(a.interest_rate_p_a)
        : inferred.ratePa;

    const applyWht15 = savedSetting.apply_wht_15 !== undefined ? Boolean(savedSetting.apply_wht_15) : true;
    const autoDailyAccrual = savedSetting.auto_daily_accrual !== undefined ? Boolean(savedSetting.auto_daily_accrual) : true;
    let bal = savedSetting.balance_override !== undefined ? Number(savedSetting.balance_override) : Number(a.balance || 0);

    const isEligibleYieldAccount =
      effectiveRate > 0 ||
      inferred.isMmfOrYieldAccount ||
      ['MMF', 'SAVINGS', 'INVESTMENT'].includes(String(a.account_type || '').toUpperCase());

    if (isEligibleYieldAccount) {
      // Find existing interest transactions for this account
      const dbAccTxs = txs.filter(
        (t: any) =>
          String(t.account_id) === accIdStr &&
          ((t.category || '').toLowerCase().includes('interest') ||
            (t.category || '').toLowerCase().includes('yield') ||
            (t.description || '').toLowerCase().includes('interest') ||
            (t.description || '').toLowerCase().includes('yield') ||
            (t.description || '').toLowerCase().includes('profit')) &&
          t.transaction_type === 'INCOME'
      );

      const cookieLogs = [...(savedSetting.accrued_logs || [])];
      const hasTodayTx =
        savedSetting.last_accrued_date === todayIsoForMmf ||
        dbAccTxs.some((t: any) => String(t.date || '').slice(0, 10) === todayIsoForMmf) ||
        cookieLogs.some((l: any) => String(l.date || '').slice(0, 10) === todayIsoForMmf);

      // Automatic Daily Interest Accrual (just like Britam / Ziidi / Banks add daily at midnight)
      if (autoDailyAccrual && bal > 0 && effectiveRate > 0 && !hasTodayTx) {
        let daysToAccrue = 1;
        if (savedSetting.last_accrued_date) {
          const prevMs = Date.parse(savedSetting.last_accrued_date);
          const todayMs = Date.parse(todayIsoForMmf);
          if (!isNaN(prevMs) && !isNaN(todayMs) && todayMs > prevMs) {
            daysToAccrue = Math.min(30, Math.max(1, Math.round((todayMs - prevMs) / 86400000)));
          }
        }
        const netRatePa = applyWht15 ? effectiveRate * 0.85 : effectiveRate;
        const dailyNetFactor = netRatePa / 100 / 365;

        for (let d = daysToAccrue - 1; d >= 0; d--) {
          const dt = new Date(today.getTime() - d * 86400000).toISOString().slice(0, 10);
          if (
            dbAccTxs.some((t: any) => String(t.date || '').slice(0, 10) === dt) ||
            cookieLogs.some((l: any) => String(l.date || '').slice(0, 10) === dt)
          ) {
            continue;
          }
          const dayGross = Number(((bal * (effectiveRate / 100)) / 365).toFixed(2));
          const dayNet = Number((bal * dailyNetFactor).toFixed(2));
          const dayTax = Number(Math.max(0, dayGross - dayNet).toFixed(2));
          if (dayNet > 0) {
            bal = Number((bal + dayNet).toFixed(2));
            const desc = `Auto Daily Interest (${a.name} @ ${effectiveRate}% p.a.${applyWht15 ? ' less 15% WHT' : ''})`;
            const logEntry = {
              id: `auto-mmf-${accIdStr}-${dt}`,
              date: dt,
              amount: dayNet,
              gross_amount: dayGross,
              wht_tax: dayTax,
              description: desc,
            };
            cookieLogs.unshift(logEntry);
            txs.unshift({
              id: logEntry.id,
              account_id: a.id,
              transaction_type: 'INCOME',
              category: 'Interest & Yield',
              amount: dayNet,
              description: desc,
              date: dt,
            });
          }
        }

        accs[i] = { ...a, balance: bal, interest_rate_p_a: effectiveRate };
        mmfSettings[accIdStr] = {
          ...savedSetting,
          rate_p_a: effectiveRate,
          apply_wht_15: applyWht15,
          auto_daily_accrual: autoDailyAccrual,
          last_accrued_date: todayIsoForMmf,
          balance_override: bal,
          accrued_logs: cookieLogs.slice(0, 35),
        };
        mmfSettingsDirty = true;
      } else {
        accs[i] = { ...a, balance: bal, interest_rate_p_a: effectiveRate };
      }

      // Merge DB interest transactions + cookie accrued logs (deduplicated by date)
      const byDate = new Map<string, any>();
      for (const l of cookieLogs) {
        if (l && l.date) byDate.set(String(l.date).slice(0, 10), l);
      }
      for (const t of dbAccTxs) {
        if (t && t.date) {
          const dKey = String(t.date).slice(0, 10);
          if (!byDate.has(dKey)) {
            byDate.set(dKey, {
              id: t.id,
              date: dKey,
              amount: Number(t.amount || 0),
              description: t.description || 'MMF Interest Yield',
            });
          }
        }
      }
      const mergedProfitLogs = Array.from(byDate.values()).sort(
        (x: any, y: any) => new Date(y.date || 0).getTime() - new Date(x.date || 0).getTime()
      );

      const accruedProfit = Number(
        mergedProfitLogs.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0).toFixed(2)
      );
      const principalDeposited = Number(Math.max(0, bal - accruedProfit).toFixed(2));

      const recentProfitLogs = mergedProfitLogs.slice(0, 7).map((t: any) => {
        const d = t.date ? new Date(t.date) : new Date();
        const dayName = isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return {
          id: t.id,
          date: t.date,
          day_name: dayName,
          amount: Number(t.amount || 0),
          gross_amount: t.gross_amount,
          wht_tax: t.wht_tax,
          description: t.description || 'MMF Interest Yield',
        };
      });

      const yieldBreakdown = calculateBankMmfYieldBreakdown(bal, effectiveRate, applyWht15, daysInMonth);
      totalMonthlyPassive = totalMonthlyPassive.plus(yieldBreakdown.monthlyNetCompounded);

      mmfAccounts.push({
        ...accs[i],
        interest_rate_p_a: effectiveRate,
        net_rate_p_a: yieldBreakdown.netRatePa,
        effective_net_apy: yieldBreakdown.effectiveNetApyPct,
        apply_wht_15: applyWht15,
        auto_daily_accrual: autoDailyAccrual,
        institution_label: inferred.institutionLabel,
        total_balance: bal,
        total_accrued_profit: accruedProfit,
        principal_deposited: principalDeposited,
        recent_profit_logs: recentProfitLogs,
        daily_gross: yieldBreakdown.dailyGross.toFixed(2),
        daily_wht_tax: yieldBreakdown.dailyWhtTax.toFixed(2),
        daily_return: yieldBreakdown.dailyNet.toFixed(2),
        weekly_return: yieldBreakdown.weeklyNetCompounded.toFixed(2),
        monthly_gross: yieldBreakdown.monthlyGrossCompounded.toFixed(2),
        monthly_return: yieldBreakdown.monthlyNetCompounded.toFixed(2),
        annual_gross: yieldBreakdown.annualGrossCompounded.toFixed(2),
        annual_return: yieldBreakdown.annualNetCompounded.toFixed(2),
      });
    }
  }

  if (mmfSettingsDirty) {
    saveMmfSettingsCookie(c, mmfSettings);
  }

  const totalMmfBalance = mmfAccounts.reduce((sum, m) => sum + Number(m.balance || 0), 0);
  const totalMmfAccruedProfit = mmfAccounts.reduce((sum, m) => sum + Number(m.total_accrued_profit || 0), 0);
  const totalMmfPrincipal = mmfAccounts.reduce((sum, m) => sum + Number(m.principal_deposited || 0), 0);
  // strictSaverConfig already initialized above for work schedule and weekly target pacing

  // Enriched Debts & Loans with Danger Zone Intelligence (merged from DB + cookie so no loan is ever lost)
  const mergedDebts = resolveEffectiveSalariedLoans(c, debts || []);
  const enrichedDebts = (mergedDebts || []).map((d: any) => {
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

  // EV vs Petrol ROI Intelligence & Shift Net Take-Home for Pay Yourself First
  const evRoiStats = calculateEvRoiSavings(effectiveRiderLogs || []);
  const todayIsoStr = today.toISOString().slice(0, 10);
  const todayShiftNet = (effectiveRiderLogs || [])
    .filter((l: any) => l.date === todayIsoStr)
    .reduce((acc: number, l: any) => {
      const exp = Number(l.fuel_cost || 0) + Number(l.food_spent || 0) + Number(l.airtime_spent || 0) + Number(l.misc_expenses || 0) + Number(l.maintenance_cost || 0);
      return acc + (Number(l.total_earned || 0) - exp);
    }, 0);
  const latestShiftObj = effectiveRiderLogs && effectiveRiderLogs.length > 0 ? effectiveRiderLogs[0] : null;
  const lastShiftNet = latestShiftObj
    ? (Number(latestShiftObj.total_earned || 0) - (Number(latestShiftObj.fuel_cost || 0) + Number(latestShiftObj.food_spent || 0) + Number(latestShiftObj.airtime_spent || 0) + Number(latestShiftObj.misc_expenses || 0) + Number(latestShiftObj.maintenance_cost || 0)))
    : 0;
  const payYourselfQueryAmt = parseFloat(c.req.query('pay_yourself_amount') || '0') || 0;

  // Unified Deadlines & Renewals Timeline
  const effectiveCompliance = resolveEffectiveComplianceDeadlines(c, complianceDeadlines);
  const complianceItems = (effectiveCompliance || []).map((c: any) => ({
    id: c.id,
    name: c.title || c.item_type || c.name || 'Vehicle Document',
    title: c.title || c.item_type || c.name || 'Vehicle Document',
    expiryDate: c.expiry_date,
    costKes: Number(c.renewal_cost || c.cost || 0),
    notes: c.notes,
  }));
  const timelineBills = reconciledRecurringBills.map((b) => ({
    id: b.id,
    name: b.name,
    title: `${b.icon || '⚡'} ${b.name}`,
    amount: b.amount,
    due_day: b.due_day,
    last_paid_date: b.is_paid_this_month ? (b.last_paid_date || `${currentMonth}-01`) : undefined,
  }));
  const unifiedTimeline = buildUnifiedTimeline({
    debts: enrichedDebts,
    bills: timelineBills,
    complianceItems,
  });

  // Monthly Expense Category Breakdown for Chart
  const categoryTotals: Record<string, number> = {};
  for (const t of txs) {
    if (!isTransferTransaction(t) && t.transaction_type === 'EXPENSE' && t.date && t.date.startsWith(currentMonth)) {
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
  const odometerConfigForHome = getOdometerConfig(c, effectiveRiderLogs);
  const smartNotifications = buildSmartNotifications({
    todayIso: todayIsoStr,
    currentDay,
    riderLogs: effectiveRiderLogs,
    enrichedDebts,
    recurringBills: reconciledRecurringBills,
    complianceDeadlines: effectiveCompliance,
    odometerConfig: odometerConfigForHome,
    isRiderView: false,
  });

  const html = renderFinanceDashboard({
    accounts: accs,
    transactions: txs,
    rider_logs: effectiveRiderLogs,
    notifications: smartNotifications,
    goals: goals || [],
    budgets: categoryBudgets,
    income_targets: incomeTargets,
    expense_targets: expenseTargets,
    category_budgets: categoryBudgets,
    category_breakdown: categoryBreakdown,
    debts: enrichedDebts,
    bills: bills || [],
    recurring_bills: reconciledRecurringBills,
    mmf_accounts: mmfAccounts,
    total_mmf_balance: totalMmfBalance,
    total_mmf_accrued_profit: totalMmfAccruedProfit,
    total_mmf_principal: totalMmfPrincipal,
    strict_saver_config: strictSaverConfig,
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
    today_shift_net: todayShiftNet,
    last_shift_net: lastShiftNet,
    pay_yourself_amount: payYourselfQueryAmt,
    unified_timeline: unifiedTimeline,
    usd_to_kes: USD_TO_KES,
    current_currency: userCurrency,
    has_quick_pin: Boolean(getCookie(c, 'finatrack_quick_pin')),
    toast,
    username,
    is_logged_in: isLoggedIn,
    active_profile: getActiveProfile(c),
  });

  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  return c.html(html);
});

// ------------------------------------------------------------------------------
// 2. RIDER DASHBOARD (GET /rider)
// ------------------------------------------------------------------------------
app.get('/rider', async (c) => {
  const { supabase, userId, username, email, isLoggedIn } = await getRequestContext(c);
  const toast = c.req.query('toast') || '';

  let bikes: any[] = [];
  let logs: any[] = [];
  let accounts: any[] = [];
  let maintenance: any[] = [];
  let compliance: any[] = [];
  let financing: any[] = [];
  let allocationRules: any[] = [];

  if (userId) {
    try {
      const [bikeRes, logRes, accRes, maintRes, compRes, finRes, ruleRes] = await Promise.all([
        supabase.from('bikes').select('*').eq('user_id', userId),
        supabase.from('rider_logs').select('*').eq('user_id', userId).order('date', { ascending: false }),
        supabase.from('accounts').select('*').eq('user_id', userId),
        supabase.from('maintenance_schedules').select('*').eq('user_id', userId),
        supabase.from('compliance_deadlines').select('*').eq('user_id', userId),
        supabase.from('bike_financings').select('*').eq('user_id', userId),
        supabase.from('allocation_rules').select('*').eq('user_id', userId),
      ]);

      bikes = bikeRes?.data || [];
      logs = logRes?.data || [];
      accounts = accRes?.data || [];
      maintenance = maintRes?.data || [];
      compliance = compRes?.data || [];
      financing = finRes?.data || [];
      allocationRules = ruleRes?.data || [];
    } catch (e) {
      bikes = [];
      logs = [];
      accounts = [];
      maintenance = [];
      compliance = [];
      financing = [];
      allocationRules = [];
    }

    if (accounts.length === 0) {
      try {
        const { data: anyAccs } = await supabase.from('accounts').select('*').order('created_at', { ascending: true });
        accounts = (anyAccs && anyAccs.length > 0) ? anyAccs : (inMemoryStore.accounts || []);
      } catch (e) {
        accounts = inMemoryStore.accounts || [];
      }
    }

    if (bikes.length === 0) {
      try {
        const { data: anyBikes } = await supabase.from('bikes').select('*');
        bikes = (anyBikes && anyBikes.length > 0) ? anyBikes : (inMemoryStore.bikes || []);
      } catch (e) {
        bikes = inMemoryStore.bikes || [];
      }
    }

    if (logs.length === 0) {
      try {
        const { data: anyLogs } = await supabase.from('rider_logs').select('*').is('user_id', null).order('date', { ascending: false });
        if (anyLogs && anyLogs.length > 0) logs = anyLogs;
      } catch (e) {}
    }
  } else {
    try {
      const [guestCompRes, guestLogsRes, guestMaintRes, guestAccRes, guestBikesRes] = await Promise.all([
        supabase.from('compliance_deadlines').select('*').is('user_id', null),
        supabase.from('rider_logs').select('*').is('user_id', null).order('date', { ascending: false }),
        supabase.from('maintenance_schedules').select('*').is('user_id', null),
        supabase.from('accounts').select('*').is('user_id', null).order('created_at', { ascending: true }),
        supabase.from('bikes').select('*').is('user_id', null),
      ]);
      compliance = guestCompRes?.data || [];
      logs = guestLogsRes?.data || [];
      maintenance = guestMaintRes?.data || [];
      accounts = guestAccRes?.data || [];
      bikes = guestBikesRes?.data || [];

      if (accounts.length === 0) {
        const { data: anyAccs } = await supabase.from('accounts').select('*').order('created_at', { ascending: true });
        accounts = (anyAccs && anyAccs.length > 0) ? anyAccs : (inMemoryStore.accounts || []);
      }
      if (bikes.length === 0) {
        const { data: anyBikes } = await supabase.from('bikes').select('*');
        bikes = (anyBikes && anyBikes.length > 0) ? anyBikes : (inMemoryStore.bikes || []);
      }
    } catch (e) {
      compliance = [];
      logs = [];
      maintenance = [];
      accounts = inMemoryStore.accounts || [];
      bikes = inMemoryStore.bikes || [];
    }
  }

  const activeBikes = bikes;
  const shiftLogs = resolveEffectiveRiderLogs(c, logs);
  const odometerConfig = getOdometerConfig(c, shiftLogs);

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

  const primaryActiveBike = (activeBikes || []).find((b: any) => b.is_active === 1) || activeBikes[0] || null;
  const strictSaverConfig = getStrictSaverConfig(c, primaryActiveBike);
  const platformRemittanceConfig = getPlatformRemittanceConfig(c);

  const paystackCfg = getPaystackConfig(c);
  const userIdentifier = email || getCookie(c, 'finatrack_email') || username || '';
  const isPaywalled = isUserPaywalled(userIdentifier, paystackCfg);

  const todayRiderIso = new Date().toISOString().slice(0, 10);
  const currentRiderDay = new Date().getDate();
  const riderDebts = resolveEffectiveSalariedLoans(c, []).map((d: any) => {
    const total = Number(d.total_amount || 0);
    const paid = Number(d.paid_amount || 0);
    const remaining = Math.max(0, total - paid);
    return {
      ...d,
      remaining,
      is_settled: d.status === 'PAID' || remaining === 0,
      danger_status: calculateDebtDeadline(d.due_at),
    };
  });
  const riderNotifications = buildSmartNotifications({
    todayIso: todayRiderIso,
    currentDay: currentRiderDay,
    riderLogs: shiftLogs,
    enrichedDebts: riderDebts,
    recurringBills: getRecurringBills(c),
    complianceDeadlines: resolveEffectiveComplianceDeadlines(c, compliance),
    odometerConfig,
    isRiderView: true,
  });

  const html = renderRiderDashboard({
    active_bike: primaryActiveBike,
    bikes: activeBikes,
    rider_logs: shiftLogs,
    notifications: riderNotifications,
    odometer_config: odometerConfig,
    strict_saver_config: strictSaverConfig,
    platform_remittance: platformRemittanceConfig,
    weekly_batch_pot: getWeeklyBatchPot(c),
    has_quick_pin: Boolean(getCookie(c, 'finatrack_quick_pin')),
    time_intelligence: timeIntelligence,
    maintenance_schedules: resolveEffectiveMaintenanceSchedules(c, maintenance),
    compliance_deadlines: resolveEffectiveComplianceDeadlines(c, compliance),
    roadside_incidents: getRoadsideIncidents(c),
    bike_financings: financing || [],
    ev_roi_stats: calculateEvRoiSavings(shiftLogs || []),
    allocation_rules: resolveEffectiveAllocationRules(c, allocationRules),
    accounts: accounts || [],
    toast,
    usd_to_kes: USD_TO_KES,
    current_currency: userCurrency,
    username,
    email: userIdentifier,
    is_logged_in: isLoggedIn,
    active_profile: getActiveProfile(c),
    paystack_public_key: paystackCfg.publicKey,
    paystack_shift_fee_kes: paystackCfg.shiftFeeKes,
    is_paystack_paywalled: isPaywalled,
  });

  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  return c.html(html);
});

// ------------------------------------------------------------------------------
// 3. AUTHENTICATION VIEWS
// ------------------------------------------------------------------------------
app.get('/login', (c) => {
  const toast = c.req.query('toast') || '';
  const hasQuickPin = Boolean(getCookie(c, 'finatrack_quick_pin'));
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  return c.html(renderAuthView({ mode: 'login', toast, has_quick_pin: hasQuickPin }));
});

app.get('/signup', (c) => {
  const toast = c.req.query('toast') || '';
  const hasQuickPin = Boolean(getCookie(c, 'finatrack_quick_pin'));
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  return c.html(renderAuthView({ mode: 'signup', toast, has_quick_pin: hasQuickPin }));
});

app.get('/auth', (c) => {
  const toast = c.req.query('toast') || '';
  const hasQuickPin = Boolean(getCookie(c, 'finatrack_quick_pin'));
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  return c.html(renderAuthView({ mode: 'login', toast, has_quick_pin: hasQuickPin }));
});

// ------------------------------------------------------------------------------
// 4. MAMA MBOGA & MICRO-SHOP DASHBOARD (GET /trader)
// ------------------------------------------------------------------------------
app.get('/trader', async (c) => {
  const { userId, username, isLoggedIn } = await getRequestContext(c);
  const toast = c.req.query('toast') || '';
  const traderConfig = getTraderConfig(c);
  const traderLogs = getSavedTraderLogs(c);
  const traderCredits = getSavedTraderCredits(c);
  const userCurrency = getCookie(c, 'finatrack_currency') === 'USD' ? 'USD' : 'Ksh';

  const html = renderTraderDashboard({
    username: username || 'Dennis',
    is_logged_in: isLoggedIn,
    trader_config: traderConfig,
    trader_logs: traderLogs,
    trader_credits: traderCredits,
    toast,
    current_currency: userCurrency,
  });

  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  return c.html(html);
});

// ------------------------------------------------------------------------------
// 5. SALARIED & PROFESSIONAL DASHBOARD (GET /salaried)
// ------------------------------------------------------------------------------
app.get('/salaried', async (c) => {
  const { supabase, userId, username, isLoggedIn } = await getRequestContext(c);
  const toast = c.req.query('toast') || '';
  const salariedConfig = getSalariedConfig(c);
  const userCurrency = getCookie(c, 'finatrack_currency') === 'USD' ? 'USD' : 'Ksh';

  let accounts: any[] = [];
  try {
    const accQuery = userId ? supabase.from('accounts').select('*').eq('user_id', userId) : supabase.from('accounts').select('*').is('user_id', null);
    const { data: accData } = await accQuery.order('created_at', { ascending: true });
    accounts = (accData && accData.length > 0) ? accData : [];
    if (accounts.length === 0) {
      const { data: anyAccs } = await supabase.from('accounts').select('*').order('created_at', { ascending: true });
      accounts = anyAccs || [];
    }
  } catch (e) {
    accounts = [];
  }

  const { data: dbRules } = userId
    ? await supabase.from('allocation_rules').select('*').eq('user_id', userId)
    : await supabase.from('allocation_rules').select('*').is('user_id', null);
  const { data: dbDebts } = userId
    ? await supabase.from('debts').select('*').eq('user_id', userId)
    : await supabase.from('debts').select('*').is('user_id', null);
  const rules = resolveEffectiveAllocationRules(c, dbRules || []);
  const salariedLoans = resolveEffectiveSalariedLoans(c, dbDebts || []);

  const totalBal = (accounts || []).reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);

  const html = renderSalariedDashboard({
    username: username || 'Dennis',
    is_logged_in: isLoggedIn,
    salaried_config: salariedConfig,
    total_balance: totalBal,
    toast,
    current_currency: userCurrency,
    accounts: accounts || [],
    allocation_rules: rules,
    salaried_loans: salariedLoans,
  });

  c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  return c.html(html);
});

// ------------------------------------------------------------------------------
// 6. UNIVERSAL PROFILE SWITCHER (POST /profile/switch)
// ------------------------------------------------------------------------------
app.post('/profile/switch', async (c) => {
  const body: any = await c.req.parseBody().catch(() => ({}));
  const rawMode = String(body['profile_mode'] || c.req.query('profile_mode') || 'RIDER').toUpperCase();
  const validMode: ProfileMode = (rawMode === 'TRADER' || rawMode === 'SALARIED') ? rawMode : 'RIDER';
  setActiveProfile(c, validMode);

  const profile = PROFILES[validMode];
  const targetRoute = profile.primaryRoute;
  const toastMsg = encodeURIComponent(`Switched to ${profile.label} Mode ${profile.icon}`);
  return c.redirect(`${targetRoute}?toast=${toastMsg}`, 303);
});

// ------------------------------------------------------------------------------
// 7. MOUNT ROUTE MODULES
// ------------------------------------------------------------------------------
app.route('/', financeRoutes);
app.route('/', riderRoutes);
app.route('/', traderRoutes);
app.route('/', salariedRoutes);
app.route('/', exportRoutes);
app.route('/', authRoutes);

// Graceful Edge Error Boundary Handler
app.onError((err, c) => {
  console.error('⚠️ Finatrack Graceful Route Error Boundary:', err);
  if (c.req.path === '/rider' && c.req.method === 'GET') {
    const fallbackBikes = inMemoryStore.bikes || [];
    return c.html(renderRiderDashboard({
      active_bike: fallbackBikes[0] || null,
      bikes: fallbackBikes,
      accounts: inMemoryStore.accounts || [],
      username: getCookie(c, 'finatrack_user') || 'Member',
      email: getCookie(c, 'finatrack_email') || '',
      is_logged_in: Boolean(getCookie(c, 'sb-access-token')),
      active_profile: 'RIDER',
    }));
  }
  return c.redirect('/?toast=' + encodeURIComponent('Notice: Handled system error gracefully. All data safe.'), 303);
});

// Export for Cloudflare Pages / Workers & Local execution
export default app;
