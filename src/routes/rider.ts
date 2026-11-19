import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { AppEnv, getRequestContext } from '../db/supabase';
import {
  toDecimal,
  calculateShiftHours,
  parseTimeToMinutes,
  formatMoney,
  allocateWaterfallSplit
} from '../utils/math';
import { Decimal } from 'decimal.js';
import { getPaystackConfig, isUserPaywalled, verifyPaystackPayment } from '../utils/paystack';
import { HoldingPotConfig, normalizeHoldingPotConfig, computeSmartHoldingPot } from '../utils/smartEngine';

export const riderRoutes = new Hono<{ Bindings: AppEnv }>();

const DEFAULT_USD_KES_RATE = 129.0;

function getExchangeRate(): number {
  return DEFAULT_USD_KES_RATE;
}

export function getSavedComplianceDocs(c: any): any[] {
  try {
    const raw = getCookie(c, 'finatrack_compliance_docs') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function saveComplianceDocsCookie(c: any, docs: any[]): void {
  try {
    setCookie(c, 'finatrack_compliance_docs', encodeURIComponent(JSON.stringify(docs)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

export function resolveEffectiveComplianceDeadlines(c: any, dbDocs: any[]): any[] {
  const cookieDocs = getSavedComplianceDocs(c);
  const merged = new Map<string, any>();
  for (const d of (dbDocs || [])) {
    if (d && d.id) merged.set(String(d.id), d);
  }
  for (const d of cookieDocs) {
    if (d && d.id) merged.set(String(d.id), d);
  }
  return Array.from(merged.values());
}

export function getSavedMaintenanceSchedules(c: any): any[] {
  try {
    const raw = getCookie(c, 'finatrack_maint_schedules') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function saveMaintenanceSchedulesCookie(c: any, list: any[]): void {
  try {
    const trimmed = (list || []).slice(0, 30);
    setCookie(c, 'finatrack_maint_schedules', encodeURIComponent(JSON.stringify(trimmed)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

export function resolveEffectiveMaintenanceSchedules(c: any, dbSchedules: any[]): any[] {
  const cookieList = getSavedMaintenanceSchedules(c);
  const merged = new Map<string, any>();
  for (const m of (dbSchedules || [])) {
    if (m && m.id) merged.set(String(m.id), m);
  }
  for (const m of cookieList) {
    if (!m || !m.id) continue;
    const existing = merged.get(String(m.id));
    if (existing) {
      merged.set(String(m.id), {
        ...existing,
        cost_kes: m.cost_kes ?? existing.cost_kes ?? existing.brake_pad_cost_last ?? 0,
        service_odometer: m.service_odometer ?? existing.service_odometer,
      });
    } else {
      merged.set(String(m.id), m);
    }
  }
  return Array.from(merged.values()).sort((a, b) =>
    String(b.last_service_date || '').localeCompare(String(a.last_service_date || ''))
  );
}

export function getSavedRiderLogs(c: any): any[] {
  try {
    const raw = getCookie(c, 'finatrack_rider_logs') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function saveRiderLogsCookie(c: any, logs: any[]): void {
  try {
    const trimmed = (logs || []).slice(0, 40);
    setCookie(c, 'finatrack_rider_logs', encodeURIComponent(JSON.stringify(trimmed)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

export function resolveEffectiveRiderLogs(c: any, dbLogs: any[]): any[] {
  const cookieLogs = getSavedRiderLogs(c);
  const merged = new Map<string, any>();
  for (const l of (dbLogs || [])) {
    if (l && l.id) merged.set(String(l.id), l);
  }
  for (const l of cookieLogs) {
    if (!l || !l.id) continue;
    const existing = merged.get(String(l.id));
    if (existing) {
      merged.set(String(l.id), {
        ...existing,
        uber_earned: l.uber_earned ?? existing.uber_earned,
        bolt_earned: l.bolt_earned ?? existing.bolt_earned,
        little_earned: l.little_earned ?? existing.little_earned,
        direct_cash_earned: l.direct_cash_earned ?? existing.direct_cash_earned,
        cash_in_hand: l.cash_in_hand ?? existing.cash_in_hand,
        app_wallet_balance: l.app_wallet_balance ?? existing.app_wallet_balance,
        channel: l.channel ?? existing.channel,
      });
    } else {
      merged.set(String(l.id), l);
    }
  }
  return Array.from(merged.values()).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export function reconcileRiderShiftLogsWithTransactions(riderLogs: any[] = [], existingTxs: any[] = []): any[] {
  const syncedTxs = [...(existingTxs || [])];
  for (const log of (riderLogs || [])) {
    if (!log || !log.id) continue;
    const logIdStr = String(log.id);
    const logDate = String(log.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const gross = Number(log.total_earned || 0);
    const fuel = Number(log.fuel_cost || 0);
    const food = Number(log.food_spent || 0);
    const airtime = Number(log.airtime_spent || 0);
    const maint = Number(log.maintenance_cost || 0);
    const misc = Number(log.misc_expenses || 0);

    // Check if this shift already has transactions in `syncedTxs`
    const hasLinkedTx = syncedTxs.some((t: any) =>
      (t.rider_log_id && String(t.rider_log_id) === logIdStr) ||
      (String(t.date || '').slice(0, 10) === logDate &&
        ((gross > 0 && t.transaction_type === 'INCOME' && Number(t.amount || 0) === gross && String(t.category || '').includes('Rider')) ||
         String(t.description || '').includes(logIdStr)))
    );
    if (hasLinkedTx) continue;

    const powerType = String(log.power_type || 'PETROL').toUpperCase();
    const station = String(log.fuel_station || (powerType === 'ELECTRIC' ? 'SPIRO' : 'RUBIS'));

    if (gross > 0) {
      syncedTxs.unshift({
        id: `shift-inc-${logIdStr}`,
        account_id: null,
        transaction_type: 'INCOME',
        category: 'Rider & Boda Deliveries',
        amount: gross,
        description: `Fleet & Ride-Hail Gross Revenue (${logDate} • ${log.shift_hours || 8}h shift) [${logIdStr}]`,
        rider_log_id: logIdStr,
        date: logDate,
        created_at: log.created_at || new Date().toISOString(),
      });
    }
    if (fuel > 0) {
      syncedTxs.unshift({
        id: `shift-fuel-${logIdStr}`,
        account_id: null,
        transaction_type: 'EXPENSE',
        category: powerType === 'ELECTRIC' ? 'EV Battery Swap & Charging' : 'Fuel & Petrol',
        amount: fuel,
        description: `Rider Shift: ${powerType === 'ELECTRIC' ? `EV Battery Swap (${station})` : `Fuel & Petrol (${station})`} [${logIdStr}]`,
        rider_log_id: logIdStr,
        date: logDate,
        created_at: log.created_at || new Date().toISOString(),
      });
    }
    if (food > 0) {
      syncedTxs.unshift({
        id: `shift-food-${logIdStr}`,
        account_id: null,
        transaction_type: 'EXPENSE',
        category: 'Food & Groceries',
        amount: food,
        description: `Rider Shift: Food & Lunch (${logDate}) [${logIdStr}]`,
        rider_log_id: logIdStr,
        date: logDate,
        created_at: log.created_at || new Date().toISOString(),
      });
    }
    if (airtime > 0) {
      syncedTxs.unshift({
        id: `shift-air-${logIdStr}`,
        account_id: null,
        transaction_type: 'EXPENSE',
        category: 'Airtime & Data Bundles',
        amount: airtime,
        description: `Rider Shift: Airtime & Delivery App Data (${logDate}) [${logIdStr}]`,
        rider_log_id: logIdStr,
        date: logDate,
        created_at: log.created_at || new Date().toISOString(),
      });
    }
    if (maint > 0) {
      syncedTxs.unshift({
        id: `shift-maint-${logIdStr}`,
        account_id: null,
        transaction_type: 'EXPENSE',
        category: 'Bike Maintenance & Repairs',
        amount: maint,
        description: `Rider Shift: Bike Maintenance & Spares (${logDate}) [${logIdStr}]`,
        rider_log_id: logIdStr,
        date: logDate,
        created_at: log.created_at || new Date().toISOString(),
      });
    }
    if (misc > 0) {
      syncedTxs.unshift({
        id: `shift-misc-${logIdStr}`,
        account_id: null,
        transaction_type: 'EXPENSE',
        category: 'Daily Upkeep & Misc',
        amount: misc,
        description: `Rider Shift: Parking, Puncture & Daily Upkeep (${logDate}) [${logIdStr}]`,
        rider_log_id: logIdStr,
        date: logDate,
        created_at: log.created_at || new Date().toISOString(),
      });
    }
  }
  return syncedTxs;
}

export interface OdometerConfig {
  base_odometer: number;
  last_service_odo: number;
  service_interval_km: number;
  current_odometer: number;
  total_shift_km: number;
}

export function getOdometerConfig(c: any, shiftLogs: any[] = []): OdometerConfig {
  const totalShiftKm = Math.round(
    (shiftLogs || []).reduce((acc: number, l: any) => acc + (Number(l.kilometers) || 0), 0) * 10
  ) / 10;

  let currentOdo = 0;
  let lastServiceOdo = 0;
  let intervalKm = 3000;

  try {
    const raw = getCookie(c, 'finatrack_odometer_config') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (typeof parsed.last_service_odo === 'number' && !isNaN(parsed.last_service_odo)) {
        lastServiceOdo = parsed.last_service_odo;
      }
      if (typeof parsed.current_odometer === 'number' && !isNaN(parsed.current_odometer) && parsed.current_odometer > 0) {
        currentOdo = parsed.current_odometer;
      } else if (typeof parsed.base_odometer === 'number' && !isNaN(parsed.base_odometer) && parsed.base_odometer > 0) {
        currentOdo = parsed.base_odometer;
      } else {
        currentOdo = lastServiceOdo;
      }
      if (typeof parsed.service_interval_km === 'number' && parsed.service_interval_km > 0) {
        intervalKm = parsed.service_interval_km;
      }
    }
  } catch (e) {}

  const roundedOdo = Math.round(currentOdo * 10) / 10;

  return {
    base_odometer: roundedOdo,
    last_service_odo: lastServiceOdo,
    service_interval_km: intervalKm,
    current_odometer: roundedOdo,
    total_shift_km: totalShiftKm,
  };
}

export function saveOdometerConfigCookie(
  c: any,
  config: { base_odometer: number; current_odometer?: number; last_service_odo: number; service_interval_km: number }
): void {
  try {
    const normalized = {
      ...config,
      current_odometer: config.current_odometer ?? config.base_odometer,
    };
    setCookie(c, 'finatrack_odometer_config', encodeURIComponent(JSON.stringify(normalized)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

export interface StrictSaverConfig {
  net_floor_kes: number;
  fuel_allowance_kes: number;
  lunch_allowance_kes: number;
  airtime_allowance_kes: number;
  personal_expense_cap_kes: number;
  daily_kodi_kes: number;
  save_unspent_lunch: boolean;
  savings_account_id: string;
  savings_account_name: string;
  starting_savings_balance: number;
  work_days_per_week: number;
  preferred_off_day: string;
  daily_bonus_target_kes: number;
  bonus_mission: string;
  required_gross_kes: number;
}

export function getStrictSaverConfig(c: any, activeBike?: any): StrictSaverConfig {
  const defaultNetFloor = Number(activeBike?.daily_target) > 0 ? Number(activeBike.daily_target) : 1000;
  const isEv = String(activeBike?.power_type || '').toUpperCase() === 'ELECTRIC';
  let netFloor = defaultNetFloor;
  let fuelAllowance = isEv ? 300 : 500;
  let lunchAllowance = 150;
  let airtimeAllowance = 50;
  let personalCap = 200;
  let dailyKodi = 0;
  let saveUnspentLunch = true;
  let savingsAccountId = '';
  let savingsAccountName = 'Strict Savings Account';
  let startingSavingsBalance = 0;
  let workDaysPerWeek = 6;
  let preferredOffDay = 'TUESDAY';
  let dailyBonusTarget = 300;
  let bonusMission = '80_20_REWARD';

  try {
    const raw = getCookie(c, 'finatrack_strict_saver') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (typeof parsed.net_floor_kes === 'number' && parsed.net_floor_kes > 0) {
        netFloor = parsed.net_floor_kes;
      }
      if (typeof parsed.fuel_allowance_kes === 'number' && parsed.fuel_allowance_kes >= 0) {
        fuelAllowance = parsed.fuel_allowance_kes;
      }
      if (typeof parsed.lunch_allowance_kes === 'number' && parsed.lunch_allowance_kes >= 0) {
        lunchAllowance = parsed.lunch_allowance_kes;
      }
      if (typeof parsed.airtime_allowance_kes === 'number' && parsed.airtime_allowance_kes >= 0) {
        airtimeAllowance = parsed.airtime_allowance_kes;
      }
      if (typeof parsed.personal_expense_cap_kes === 'number' && parsed.personal_expense_cap_kes >= 0) {
        personalCap = parsed.personal_expense_cap_kes;
      } else {
        personalCap = lunchAllowance + airtimeAllowance;
      }
      if (typeof parsed.daily_kodi_kes === 'number' && parsed.daily_kodi_kes >= 0) {
        dailyKodi = parsed.daily_kodi_kes;
      }
      if (typeof parsed.save_unspent_lunch === 'boolean') {
        saveUnspentLunch = parsed.save_unspent_lunch;
      }
      if (typeof parsed.savings_account_id === 'string') {
        savingsAccountId = parsed.savings_account_id;
      }
      if (typeof parsed.savings_account_name === 'string' && parsed.savings_account_name.trim()) {
        savingsAccountName = parsed.savings_account_name.trim();
      }
      if (typeof parsed.starting_savings_balance === 'number' && parsed.starting_savings_balance >= 0) {
        startingSavingsBalance = parsed.starting_savings_balance;
      }
      if (typeof parsed.work_days_per_week === 'number' && parsed.work_days_per_week >= 1 && parsed.work_days_per_week <= 7) {
        workDaysPerWeek = Math.round(parsed.work_days_per_week);
      }
      if (typeof parsed.preferred_off_day === 'string' && parsed.preferred_off_day.trim()) {
        preferredOffDay = parsed.preferred_off_day.trim().toUpperCase();
      }
      if (typeof parsed.daily_bonus_target_kes === 'number' && parsed.daily_bonus_target_kes >= 50) {
        dailyBonusTarget = Math.round(parsed.daily_bonus_target_kes);
      }
      if (typeof parsed.bonus_mission === 'string' && parsed.bonus_mission.trim()) {
        bonusMission = parsed.bonus_mission.trim();
      }
    }
  } catch (e) {}

  personalCap = lunchAllowance + airtimeAllowance;

  return {
    net_floor_kes: netFloor,
    fuel_allowance_kes: fuelAllowance,
    lunch_allowance_kes: lunchAllowance,
    airtime_allowance_kes: airtimeAllowance,
    personal_expense_cap_kes: personalCap,
    daily_kodi_kes: dailyKodi,
    save_unspent_lunch: saveUnspentLunch,
    savings_account_id: savingsAccountId,
    savings_account_name: savingsAccountName,
    starting_savings_balance: startingSavingsBalance,
    work_days_per_week: workDaysPerWeek,
    preferred_off_day: preferredOffDay,
    daily_bonus_target_kes: dailyBonusTarget,
    bonus_mission: bonusMission,
    required_gross_kes: netFloor + fuelAllowance + personalCap + dailyKodi,
  };
}

export function saveStrictSaverConfigCookie(
  c: any,
  cfg: Partial<StrictSaverConfig>
): void {
  try {
    setCookie(c, 'finatrack_strict_saver', encodeURIComponent(JSON.stringify(cfg)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

// ------------------------------------------------------------------------------
// 🛋️ WEEKLY FLEXIBLE REST / OFF DAYS STORAGE
// ------------------------------------------------------------------------------
export function getWeeklyRestDays(c: any): string[] {
  try {
    const raw = getCookie(c, 'finatrack_rest_days');
    if (!raw) return [];
    const parsed = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (e) {
    return [];
  }
}

export function saveWeeklyRestDaysCookie(c: any, restDays: string[]): void {
  try {
    setCookie(c, 'finatrack_rest_days', encodeURIComponent(JSON.stringify(restDays)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

export function toggleRestDay(c: any, dateIsoStr: string): boolean {
  const existing = getWeeklyRestDays(c);
  const updated = existing.includes(dateIsoStr)
    ? existing.filter(d => d !== dateIsoStr)
    : [...existing, dateIsoStr];
  saveWeeklyRestDaysCookie(c, updated);
  return updated.includes(dateIsoStr);
}

// ------------------------------------------------------------------------------
// 🚗 PLATFORM CASH REMITTANCE & LOCKOUT THRESHOLD CONFIG (UBER / BOLT)
// ------------------------------------------------------------------------------
export interface PlatformRemittanceConfig {
  uber_owed: number;
  bolt_owed: number;
  other_owed: number;
  total_owed: number;
  lockout_threshold_kes: number; // default 6000 KES (Uber Kenya lockout threshold)
  last_remitted_date?: string;
  last_remitted_amount?: number;
  last_remitted_platform?: string;
  notes?: string;
}

export function getPlatformRemittanceConfig(c: any): PlatformRemittanceConfig {
  let uberOwed = 0;
  let boltOwed = 0;
  let otherOwed = 0;
  let lockoutThreshold = 6000;
  let lastRemittedDate = '';
  let lastRemittedAmt = 0;
  let lastRemittedPlatform = '';
  let notes = '';

  try {
    const raw = getCookie(c, 'finatrack_platform_remittance') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (typeof parsed.uber_owed === 'number' && !isNaN(parsed.uber_owed)) uberOwed = Math.max(0, parsed.uber_owed);
      if (typeof parsed.bolt_owed === 'number' && !isNaN(parsed.bolt_owed)) boltOwed = Math.max(0, parsed.bolt_owed);
      if (typeof parsed.other_owed === 'number' && !isNaN(parsed.other_owed)) otherOwed = Math.max(0, parsed.other_owed);
      if (typeof parsed.lockout_threshold_kes === 'number' && parsed.lockout_threshold_kes > 0) lockoutThreshold = parsed.lockout_threshold_kes;
      if (parsed.last_remitted_date) lastRemittedDate = String(parsed.last_remitted_date);
      if (typeof parsed.last_remitted_amount === 'number') lastRemittedAmt = parsed.last_remitted_amount;
      if (parsed.last_remitted_platform) lastRemittedPlatform = String(parsed.last_remitted_platform);
      if (parsed.notes) notes = String(parsed.notes);
    }
  } catch (e) {}

  const totalOwed = Math.round((uberOwed + boltOwed + otherOwed) * 100) / 100;
  return {
    uber_owed: uberOwed,
    bolt_owed: boltOwed,
    other_owed: otherOwed,
    total_owed: totalOwed,
    lockout_threshold_kes: lockoutThreshold,
    last_remitted_date: lastRemittedDate,
    last_remitted_amount: lastRemittedAmt,
    last_remitted_platform: lastRemittedPlatform,
    notes,
  };
}

export function savePlatformRemittanceConfigCookie(c: any, cfg: Partial<PlatformRemittanceConfig>): void {
  try {
    setCookie(c, 'finatrack_platform_remittance', encodeURIComponent(JSON.stringify(cfg)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

// ------------------------------------------------------------------------------
// 📦 SUNDAY BATCH WATERFALL HOLDING POT (AVOID DAILY M-PESA CHARGES)
// ------------------------------------------------------------------------------
export interface BatchPotSplitBucket {
  bucket_name: string;
  target_type: string;
  target_id?: string | null;
  percentage: number;
  amount: number;
}

export interface WeeklyBatchPotEntry {
  id: string;
  date: string;
  day_label: string;
  net_amount: number;
  shifts_count?: number;
  km_driven?: number;
  splits: BatchPotSplitBucket[];
}

export function getWeeklyBatchPot(c: any): WeeklyBatchPotEntry[] {
  try {
    const raw = getCookie(c, 'finatrack_batch_pot') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function saveWeeklyBatchPotCookie(c: any, entries: WeeklyBatchPotEntry[]): void {
  try {
    const trimmed = (entries || []).slice(0, 14);
    setCookie(c, 'finatrack_batch_pot', encodeURIComponent(JSON.stringify(trimmed)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

export function getHoldingPotConfig(c: any): HoldingPotConfig {
  try {
    const raw = getCookie(c, 'finatrack_holding_pot_cfg') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      return normalizeHoldingPotConfig(parsed);
    }
  } catch (e) {}
  return normalizeHoldingPotConfig(null);
}

export function saveHoldingPotConfigCookie(c: any, cfg: Partial<HoldingPotConfig>): HoldingPotConfig {
  const normalized = normalizeHoldingPotConfig(cfg);
  try {
    setCookie(c, 'finatrack_holding_pot_cfg', encodeURIComponent(JSON.stringify(normalized)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
  return normalized;
}

const HOLDING_POT_DB_PREFIX = 'SYS_HOLDING_POT::';

/**
 * Persists Holding Pot entries + config to Supabase (via reserved budgets row)
 * so Phone and PC stay 100% synchronized.
 */
export async function syncBatchPotStateToDb(
  supabase: any,
  userId: string | null,
  entries: WeeklyBatchPotEntry[],
  cfg: HoldingPotConfig
): Promise<void> {
  if (!supabase || !userId) return;
  try {
    const payload = JSON.stringify({ entries: (entries || []).slice(0, 14), config: cfg, updated_at: Date.now() });
    const categoryKey = `${HOLDING_POT_DB_PREFIX}${payload}`;
    const totalHeld = (entries || []).reduce((s, e) => s + Number(e.net_amount || 0), 0);

    const { data: existingRows } = await supabase
      .from('budgets')
      .select('id, category')
      .eq('user_id', userId);

    const oldPotRows = (existingRows || []).filter((r: any) => String(r.category || '').startsWith(HOLDING_POT_DB_PREFIX));
    for (const r of oldPotRows) {
      await supabase.from('budgets').delete().eq('id', r.id);
    }

    await supabase.from('budgets').insert({
      user_id: userId,
      category: categoryKey,
      limit_amount: Math.round(totalHeld * 100) / 100,
    });
  } catch (e) {}
}

/**
 * Resolves Holding Pot state across Supabase DB and Cookie so Phone and PC stay synced.
 */
export async function resolveEffectiveBatchPot(
  c: any,
  supabase?: any,
  userId?: string | null
): Promise<{ entries: WeeklyBatchPotEntry[]; config: HoldingPotConfig }> {
  let cookieEntries = getWeeklyBatchPot(c);
  let cookieCfg = getHoldingPotConfig(c);

  if (supabase && userId) {
    try {
      const { data: rows } = await supabase.from('budgets').select('category, limit_amount').eq('user_id', userId);
      const potRow = (rows || []).find((r: any) => String(r.category || '').startsWith(HOLDING_POT_DB_PREFIX));
      if (potRow) {
        const jsonPart = String(potRow.category).slice(HOLDING_POT_DB_PREFIX.length);
        const parsed = JSON.parse(jsonPart);
        if (Array.isArray(parsed.entries)) {
          // If cookie is empty or DB has entries, sync from DB to cookie
          if (cookieEntries.length === 0 && parsed.entries.length > 0) {
            cookieEntries = parsed.entries;
            saveWeeklyBatchPotCookie(c, cookieEntries);
          }
        }
        if (parsed.config) {
          cookieCfg = normalizeHoldingPotConfig({ ...parsed.config, ...cookieCfg });
          saveHoldingPotConfigCookie(c, cookieCfg);
        }
      } else if (cookieEntries.length > 0) {
        await syncBatchPotStateToDb(supabase, userId, cookieEntries, cookieCfg);
      }
    } catch (e) {}
  }

  return { entries: cookieEntries, config: cookieCfg };
}

export async function queueNetAmountToBatchPot(
  c: any,
  supabase: any,
  userId: string | null,
  dateStr: string,
  netAmount: number,
  options?: { accumulate?: boolean; kmDriven?: number }
): Promise<WeeklyBatchPotEntry | null> {
  if (netAmount <= 0) return null;
  const accumulate = options?.accumulate !== false; // Default true: sum multiple shifts on the same day!
  const kmDriven = Math.max(0, Number(options?.kmDriven || 0));

  let rules: any[] = [];
  try {
    let q = supabase.from('split_rules').select('*').order('percentage', { ascending: false });
    if (userId) q = q.eq('user_id', userId);
    const { data } = await q;
    if (Array.isArray(data) && data.length > 0) rules = data;
  } catch (e) {}

  if (rules.length === 0) {
    rules = [
      { id: 'def-mmf', bucket_name: 'Ziidi MMF (Passive Yield)', target_type: 'MMF', percentage: 30 },
      { id: 'def-lock', bucket_name: 'Lock Savings Vault', target_type: 'SAVINGS', percentage: 30 },
      { id: 'def-goals', bucket_name: 'Goals / Sacco Checkoff', target_type: 'GOAL', percentage: 20 },
      { id: 'def-bills', bucket_name: 'Bills & Upkeep Reserve', target_type: 'WALLET', percentage: 20 },
    ];
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dt = new Date(dateStr + 'T12:00:00Z');
  const dayLabel = isNaN(dt.getTime()) ? 'Shift' : dayNames[dt.getUTCDay()];

  const currentPot = getWeeklyBatchPot(c);
  const existingIdx = currentPot.findIndex((e) => e.date === dateStr);
  const prevEntry = existingIdx >= 0 ? currentPot[existingIdx] : null;

  const combinedNetAmount = prevEntry && accumulate
    ? Math.round((Number(prevEntry.net_amount || 0) + netAmount) * 100) / 100
    : Math.round(netAmount * 100) / 100;
  const combinedShiftsCount = prevEntry && accumulate
    ? Math.max(1, Number(prevEntry.shifts_count || 1)) + 1
    : 1;
  const combinedKm = prevEntry && accumulate
    ? Math.round((Number(prevEntry.km_driven || 0) + kmDriven) * 10) / 10
    : Math.round(kmDriven * 10) / 10;

  const allocated = allocateWaterfallSplit(combinedNetAmount, rules);
  const splits: BatchPotSplitBucket[] = allocated.map((s) => ({
    bucket_name: s.bucket_name,
    target_type: s.target_type,
    target_id: s.target_id || null,
    percentage: Number(s.percentage || 0),
    amount: parseFloat(s.allocated_amount) || 0,
  }));

  const entry: WeeklyBatchPotEntry = {
    id: prevEntry ? prevEntry.id : `batch-${Date.now()}`,
    date: dateStr,
    day_label: dayLabel,
    net_amount: combinedNetAmount,
    shifts_count: combinedShiftsCount,
    km_driven: combinedKm,
    splits,
  };

  if (existingIdx >= 0) {
    currentPot[existingIdx] = entry;
  } else {
    currentPot.push(entry);
  }
  currentPot.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  saveWeeklyBatchPotCookie(c, currentPot);

  const cfg = getHoldingPotConfig(c);
  await syncBatchPotStateToDb(supabase, userId, currentPot, cfg);
  return entry;
}



// ------------------------------------------------------------------------------
// TIME INTELLIGENCE HELPERS
// ------------------------------------------------------------------------------
export function classifyShiftWindow(startTime?: string | null, endTime?: string | null): { windowKey: string; windowLabel: string; windowIcon: string } {
  const startMins = parseTimeToMinutes(startTime);
  if (startMins === null) {
    return { windowKey: 'LUNCH', windowLabel: 'Midday & Lunch Rush (11:00 – 14:00)', windowIcon: '🍲' };
  }

  const h = Math.floor(startMins / 60);
  if (h >= 5 && h < 11) {
    return { windowKey: 'MORNING', windowLabel: 'Early Morning Rush (05:00 – 11:00)', windowIcon: '🌅' };
  } else if (h >= 11 && h < 14) {
    return { windowKey: 'LUNCH', windowLabel: 'Midday & Lunch Rush (11:00 – 14:00)', windowIcon: '🍲' };
  } else if (h >= 14 && h < 17) {
    return { windowKey: 'AFTERNOON', windowLabel: 'Afternoon Window (14:00 – 17:00)', windowIcon: '☀️' };
  } else if (h >= 17 && h < 21) {
    return { windowKey: 'EVENING', windowLabel: 'Evening & Dinner Rush (17:00 – 21:00)', windowIcon: '🌆' };
  } else {
    return { windowKey: 'NIGHT', windowLabel: 'Late Night / Graveyard (21:00 – 05:00)', windowIcon: '🌙' };
  }
}

// ------------------------------------------------------------------------------
// SHIFT LOGS CRUD
// ------------------------------------------------------------------------------
riderRoutes.post('/rider/logs', async (c) => {
  const { supabase, userId, username, email } = await getRequestContext(c);
  const body = await c.req.parseBody();

  // ----------------------------------------------------------------------------
  // 💳 PAYSTACK SHIFT GATE (Strictly enforced for dex@gmail.com)
  // ----------------------------------------------------------------------------
  const paystackCfg = getPaystackConfig(c);
  const userIdentifier = email || getCookie(c, 'finatrack_email') || username || '';
  const isPaywalled = isUserPaywalled(userIdentifier, paystackCfg);
  let paystackToastPrefix = '';

  if (isPaywalled) {
    const paystackRef = String(body['paystack_reference'] || c.req.query('paystack_reference') || '').trim();

    if (!paystackRef) {
      return c.redirect(
        `/rider?toast=${encodeURIComponent(`⚠️ Paystack Shift Gate: dex@gmail.com must complete Ksh ${paystackCfg.shiftFeeKes} payment before recording a shift.`)}&paystack_gate=1`,
        303
      );
    }

    const verifyResult = await verifyPaystackPayment(paystackCfg.secretKey, paystackRef);
    if (!verifyResult.success || (verifyResult.amountKes && verifyResult.amountKes < paystackCfg.shiftFeeKes)) {
      return c.redirect(
        `/rider?toast=${encodeURIComponent(`⚠️ Paystack Verification Failed: ${verifyResult.message || 'Payment not completed or amount is less than Ksh ' + paystackCfg.shiftFeeKes}`)}&paystack_gate=1`,
        303
      );
    }

    paystackToastPrefix = `⚡ Paystack Verified (Ref: ${paystackRef.slice(-7)}, Ksh ${verifyResult.amountKes || paystackCfg.shiftFeeKes}) • `;
  }

  const rawBikeId = body['bike_id'] ? String(body['bike_id']).trim() : null;
  const bikeId = rawBikeId && !rawBikeId.startsWith('PRESET_') ? rawBikeId : null;
  const channel = body['channel'] ? String(body['channel']).trim() : 'ALL';
  const isEvSelection =
    String(rawBikeId || '').toUpperCase().includes('_EV') ||
    String(channel || '').toUpperCase().includes('_EV');
  const powerType = isEvSelection
    ? 'ELECTRIC'
    : String(body['power_type'] || 'PETROL').toUpperCase();
  const logDate = String(body['date'] || new Date().toISOString().slice(0, 10));
  const startTime = body['start_time'] ? String(body['start_time']).trim() : null;
  const endTime = body['end_time'] ? String(body['end_time']).trim() : null;

  let parsedStints: any[] = [];
  if (body['stints_json']) {
    try {
      const parsed = JSON.parse(String(body['stints_json']));
      if (Array.isArray(parsed) && parsed.length > 1) {
        parsedStints = parsed.filter((s: any) => (parseFloat(String(s.earned || '0')) > 0 || (s.start_time && s.end_time)));
      }
    } catch (e) {}
  }

  const rawShiftHours = parseFloat(String(body['shift_hours'] || '0.0'));
  const shiftHours = (startTime && endTime)
    ? calculateShiftHours(startTime, endTime, 8.0)
    : (rawShiftHours > 0 ? rawShiftHours : 8.0);

  const trips = parseInt(String(body['trips_completed'] || '0'), 10);
  const km = parseFloat(String(body['kilometers'] || '0.0')) || 0.0;
  const rawEarned = parseFloat(String(body['total_earned'] || '0.0')) || 0.0;
  const fuelStation = String(body['fuel_station'] || (powerType === 'ELECTRIC' ? 'SPIRO' : 'RUBIS'));
  const fuelLitres = parseFloat(String(body['fuel_litres'] || '0.0')) || 0.0;
  const swapsCount = parseInt(String(body['swaps_count'] || '0'), 10);
  const rawFuelCost = parseFloat(String(body['fuel_cost'] || '0.0')) || 0.0;
  const rawFood = parseFloat(String(body['food_spent'] || '0.0')) || 0.0;
  const rawMaint = parseFloat(String(body['maintenance_cost'] || '0.0')) || 0.0;
  const rawAirtime = parseFloat(String(body['airtime_spent'] || '0.0')) || 0.0;
  const rawMisc = parseFloat(String(body['misc_expenses'] || '0.0')) || 0.0;

  const strictCfg = getStrictSaverConfig(c);
  let earningsAccId = body['earnings_account_id'] !== undefined ? String(body['earnings_account_id']).trim() : null;
  // If omitted or not explicitly cleared, default to strict saver's savings_account_id
  if (!earningsAccId && strictCfg.savings_account_id) {
    earningsAccId = strictCfg.savings_account_id;
  }
  const expenseAccId = body['expense_account_id'] ? String(body['expense_account_id']).trim() : null;

  // Optional Platform Split & Cash-in-Hand vs App Wallet Reconciliation
  const uberEarned = Math.max(0, parseFloat(String(body['uber_earned'] || '0')) || 0);
  const boltEarned = Math.max(0, parseFloat(String(body['bolt_earned'] || '0')) || 0);
  const glovoEarned = Math.max(0, parseFloat(String(body['glovo_earned'] || '0')) || 0);
  const farasEarned = Math.max(0, parseFloat(String(body['faras_earned'] || '0')) || 0);
  const yegoEarned = Math.max(0, parseFloat(String(body['yego_earned'] || '0')) || 0);
  const littleEarned = Math.max(0, parseFloat(String(body['little_earned'] || '0')) || 0);
  const directCashEarned = Math.max(0, parseFloat(String(body['direct_cash_earned'] || '0')) || 0);
  const platformSum = uberEarned + boltEarned + glovoEarned + farasEarned + yegoEarned + littleEarned + directCashEarned;

  const totalEarnedKes = rawEarned > 0 ? rawEarned : platformSum;
  const rawCashInHand = parseFloat(String(body['cash_in_hand'] || '0')) || 0;
  const rawAppWallet = parseFloat(String(body['app_wallet_balance'] || '0')) || 0;
  const cashInHandKes = rawCashInHand > 0 || rawAppWallet > 0 ? rawCashInHand : totalEarnedKes;
  const appWalletKes = rawAppWallet > 0 ? rawAppWallet : Math.max(0, totalEarnedKes - cashInHandKes);

  // Unremitted Cash Commission (e.g. Uber commission on cash trips held by driver)
  const unremittedUber = Math.max(0, parseFloat(String(body['unremitted_uber_commission'] || '0')) || 0);
  const unremittedBolt = Math.max(0, parseFloat(String(body['unremitted_bolt_commission'] || '0')) || 0);
  const totalUnremittedCommission = unremittedUber + unremittedBolt;

  if (totalUnremittedCommission > 0) {
    const curPlat = getPlatformRemittanceConfig(c);
    const updatedPlat: PlatformRemittanceConfig = {
      ...curPlat,
      uber_owed: Math.round((curPlat.uber_owed + unremittedUber) * 100) / 100,
      bolt_owed: Math.round((curPlat.bolt_owed + unremittedBolt) * 100) / 100,
      total_owed: Math.round((curPlat.total_owed + totalUnremittedCommission) * 100) / 100,
    };
    savePlatformRemittanceConfigCookie(c, updatedPlat);
  }

  const platformMeta = {
    channel,
    uber_earned: uberEarned,
    bolt_earned: boltEarned,
    glovo_earned: glovoEarned,
    faras_earned: farasEarned,
    yego_earned: yegoEarned,
    little_earned: littleEarned,
    direct_cash_earned: directCashEarned,
    cash_in_hand: cashInHandKes,
    app_wallet_balance: appWalletKes,
    unremitted_uber_commission: unremittedUber,
    unremitted_bolt_commission: unremittedBolt,
    total_unremitted_commission: totalUnremittedCommission,
  };

  const fuelCostKes = rawFuelCost;
  const foodSpentKes = rawFood;
  const maintCostKes = rawMaint;
  const airtimeSpentKes = rawAirtime;
  const miscExpensesKes = rawMisc;

  const totalExpensesKes = toDecimal(fuelCostKes)
    .plus(foodSpentKes)
    .plus(maintCostKes)
    .plus(airtimeSpentKes)
    .plus(miscExpensesKes)
    .toNumber();

  let primaryLogId: string | null = null;
  const savedCookieLogs = getSavedRiderLogs(c);

  if (parsedStints.length > 1) {
    // Multi-stint entry: Insert each stint for exact granular time intelligence
    for (let i = 0; i < parsedStints.length; i++) {
      const s = parsedStints[i];
      const sStart = s.start_time || startTime;
      const sEnd = s.end_time || endTime;
      const sHours = calculateShiftHours(sStart, sEnd, 1.0);
      const sEarned = parseFloat(String(s.earned || '0.0')) || 0.0;
      const sTrips = parseInt(String(s.trips || '0'), 10);

      const stintPayload: any = {
        bike_id: bikeId || null,
        power_type: powerType,
        date: logDate,
        start_time: sStart,
        end_time: sEnd,
        shift_hours: sHours,
        trips_completed: sTrips > 0 ? sTrips : Math.round(trips / parsedStints.length),
        kilometers: km > 0 ? (km / parsedStints.length) : 0,
        total_earned: sEarned,
        fuel_station: fuelStation,
        fuel_litres: i === 0 ? fuelLitres : 0,
        swaps_count: i === 0 ? swapsCount : 0,
        fuel_cost: i === 0 ? fuelCostKes : 0,
        food_spent: i === 0 ? foodSpentKes : 0,
        airtime_spent: i === 0 ? airtimeSpentKes : 0,
        maintenance_cost: i === 0 ? maintCostKes : 0,
        misc_expenses: i === 0 ? miscExpensesKes : 0,
        earnings_account_id: earningsAccId || null,
        expense_account_id: expenseAccId || null,
      };
      if (userId) stintPayload.user_id = userId;

      let stintRes: any = null;
      try {
        const { data } = await supabase.from('rider_logs').insert(stintPayload).select().single();
        stintRes = data;
      } catch (e) {}
      if (!stintRes) {
        stintRes = { id: `shift-${Date.now()}-${i}`, ...stintPayload };
      }
      savedCookieLogs.unshift({ ...stintRes, ...(i === 0 ? platformMeta : { channel }) });
      if (stintRes && !primaryLogId) {
        primaryLogId = stintRes.id;
      }
    }
  } else {
    // Standard Single Shift Log
    const insertPayload: any = {
      bike_id: bikeId || null,
      power_type: powerType,
      date: logDate,
      start_time: startTime,
      end_time: endTime,
      shift_hours: shiftHours,
      trips_completed: trips,
      kilometers: km,
      total_earned: totalEarnedKes,
      fuel_station: fuelStation,
      fuel_litres: fuelLitres,
      swaps_count: swapsCount,
      fuel_cost: fuelCostKes,
      food_spent: foodSpentKes,
      airtime_spent: airtimeSpentKes,
      maintenance_cost: maintCostKes,
      misc_expenses: miscExpensesKes,
      earnings_account_id: earningsAccId || null,
      expense_account_id: expenseAccId || null,
    };
    if (userId) {
      insertPayload.user_id = userId;
    }

    let newLog: any = null;
    try {
      let { data, error } = await supabase.from('rider_logs').insert(insertPayload).select().single();
      if (error && error.code === 'PGRST204') {
        delete insertPayload.power_type;
        delete insertPayload.swaps_count;
        const retryRes = await supabase.from('rider_logs').insert(insertPayload).select().single();
        data = retryRes.data;
      }
      newLog = data;
    } catch (e) {}

    if (!newLog) {
      newLog = { id: `shift-${Date.now()}`, ...insertPayload, power_type: powerType, swaps_count: swapsCount };
    }
    savedCookieLogs.unshift({ ...newLog, ...platformMeta });
    if (newLog) primaryLogId = newLog.id;
  }

  saveRiderLogsCookie(c, savedCookieLogs);

  if (km > 0) {
    const existingOdo = getOdometerConfig(c, []);
    const nextCurrentOdo = Math.round((existingOdo.current_odometer + km) * 10) / 10;
    saveOdometerConfigCookie(c, {
      base_odometer: nextCurrentOdo,
      current_odometer: nextCurrentOdo,
      last_service_odo: existingOdo.last_service_odo,
      service_interval_km: existingOdo.service_interval_km,
    });
  }

  // Automatic Finance Ledger Integration (Sync Income AND Expenses)
  if (primaryLogId) {
    let targetAccId = earningsAccId || expenseAccId || null;
    if (!targetAccId && body['earnings_account_id'] !== 'NONE') {
      try {
        let accQ = supabase.from('accounts').select('*').order('created_at', { ascending: true });
        if (userId) accQ = accQ.eq('user_id', userId);
        const { data: allAccs } = await accQ;
        if (allAccs && allAccs.length > 0) {
          const primaryAcc = allAccs.find((a: any) => a.account_type === 'MOBILE' || String(a.name || '').toLowerCase().includes('pesa')) || allAccs[0];
          if (primaryAcc && primaryAcc.id) {
            targetAccId = String(primaryAcc.id);
          }
        }
      } catch (e) {}
    }

    const isPrimaryIdUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(primaryLogId));
    const txInserts: any[] = [];

    // 1. Gross Earnings Income Transaction
    if (totalEarnedKes > 0) {
      const channel = body['channel'] ? String(body['channel']).trim() : '';
      const channelTag = (channel && channel !== 'ALL') ? ` • ${channel}` : '';
      txInserts.push({
        ...(userId ? { user_id: userId } : {}),
        account_id: targetAccId,
        transaction_type: 'INCOME',
        category: 'Rider & Boda Deliveries',
        amount: totalEarnedKes,
        description: `Fleet & Ride-Hail Gross Revenue${channelTag} (${logDate} • ${shiftHours}h shift${parsedStints.length > 1 ? ` • ${parsedStints.length} stints` : ''}) [${primaryLogId}]`,
        ...(isPrimaryIdUuid ? { rider_log_id: primaryLogId } : {}),
        date: logDate,
      });
    }

    // 2. Fuel / Battery Swap Expense Transaction
    if (fuelCostKes > 0) {
      const energyCategory = powerType === 'ELECTRIC' ? 'EV Battery Swap & Charging' : 'Fuel & Petrol';
      const energyLabel = powerType === 'ELECTRIC' ? `EV Battery Swap (${fuelStation || 'Station'})` : `Fuel & Petrol (${fuelStation || 'Station'})`;
      txInserts.push({
        ...(userId ? { user_id: userId } : {}),
        account_id: targetAccId,
        transaction_type: 'EXPENSE',
        category: energyCategory,
        amount: fuelCostKes,
        description: `Rider Shift: ${energyLabel} [${primaryLogId}]`,
        ...(isPrimaryIdUuid ? { rider_log_id: primaryLogId } : {}),
        date: logDate,
      });
    }

    // 3. Food / Lunch Expense Transaction
    if (foodSpentKes > 0) {
      txInserts.push({
        ...(userId ? { user_id: userId } : {}),
        account_id: targetAccId,
        transaction_type: 'EXPENSE',
        category: 'Food & Groceries',
        amount: foodSpentKes,
        description: `Rider Shift: Food & Lunch (${logDate}) [${primaryLogId}]`,
        ...(isPrimaryIdUuid ? { rider_log_id: primaryLogId } : {}),
        date: logDate,
      });
    }

    // 4. Airtime & Data Bundles Expense Transaction
    if (airtimeSpentKes > 0) {
      txInserts.push({
        ...(userId ? { user_id: userId } : {}),
        account_id: targetAccId,
        transaction_type: 'EXPENSE',
        category: 'Airtime & Data Bundles',
        amount: airtimeSpentKes,
        description: `Rider Shift: Airtime & Delivery App Data (${logDate}) [${primaryLogId}]`,
        ...(isPrimaryIdUuid ? { rider_log_id: primaryLogId } : {}),
        date: logDate,
      });
    }

    // 5. Bike Maintenance Expense Transaction
    if (maintCostKes > 0) {
      txInserts.push({
        ...(userId ? { user_id: userId } : {}),
        account_id: targetAccId,
        transaction_type: 'EXPENSE',
        category: 'Bike Maintenance & Repairs',
        amount: maintCostKes,
        description: `Rider Shift: Bike Maintenance & Spares (${logDate}) [${primaryLogId}]`,
        ...(isPrimaryIdUuid ? { rider_log_id: primaryLogId } : {}),
        date: logDate,
      });
    }

    // 6. Daily Upkeep, Parking & Misc Expense Transaction
    if (miscExpensesKes > 0) {
      txInserts.push({
        ...(userId ? { user_id: userId } : {}),
        account_id: targetAccId,
        transaction_type: 'EXPENSE',
        category: 'Daily Upkeep & Misc',
        amount: miscExpensesKes,
        description: `Rider Shift: Parking, Puncture & Daily Upkeep (${logDate}) [${primaryLogId}]`,
        ...(isPrimaryIdUuid ? { rider_log_id: primaryLogId } : {}),
        date: logDate,
      });
    }

    if (txInserts.length > 0) {
      try {
        const { error: txErr } = await supabase.from('transactions').insert(txInserts);
        if (txErr) {
          const fallbackInserts = txInserts.map(({ rider_log_id, ...rest }) => rest);
          await supabase.from('transactions').insert(fallbackInserts);
        }
      } catch (txError) {
        console.error('Failed to sync shift with finance transactions:', txError);
      }
    }

    // Update target account balance if specified
    if (targetAccId) {
      const netDelta = totalEarnedKes - totalExpensesKes;
      const { data: targetAcc } = await supabase.from('accounts').select('*').eq('id', targetAccId).single();
      if (targetAcc) {
        const newBalance = toDecimal(targetAcc.balance).plus(netDelta).toNumber();
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', targetAccId);
        // Keep strict saver config 100% in sync with live Finance Hub balance
        saveStrictSaverConfigCookie(c, {
          ...strictCfg,
          savings_account_id: targetAccId,
          savings_account_name: targetAcc.name || strictCfg.savings_account_name,
          starting_savings_balance: newBalance,
        });
      }
    }
  }

  const shiftNet = totalEarnedKes - totalExpensesKes;
  const safeShiftNetAfterUber = Math.max(0, shiftNet - totalUnremittedCommission);
  const queueToSundayBatch = body['queue_to_sunday_batch'] === '1' || body['queue_to_sunday_batch'] === 'true';
  let batchToastSuffix = '';
  if (queueToSundayBatch && safeShiftNetAfterUber > 0) {
    const queuedEntry = await queueNetAmountToBatchPot(c, supabase, userId, logDate, safeShiftNetAfterUber, {
      accumulate: true,
      kmDriven: km,
    });
    if (queuedEntry) {
      const shiftTag = (queuedEntry.shifts_count || 1) > 1 ? ` (Shift #${queuedEntry.shifts_count} accumulated today: Ksh ${queuedEntry.net_amount.toLocaleString()})` : '';
      batchToastSuffix = ` • 📦 Queued Ksh ${safeShiftNetAfterUber.toLocaleString()}${shiftTag} to Holding Pot (Synced to Cloud!)`;
    }
  }

  const lunchSavedBonus = strictCfg.save_unspent_lunch ? Math.max(0, strictCfg.lunch_allowance_kes - foodSpentKes) : 0;
  const strictRequiredToday = strictCfg.net_floor_kes + lunchSavedBonus;

  // Resolve true live balance from the linked Finance Hub account
  const activeTargetAccId = earningsAccId || expenseAccId || strictCfg.savings_account_id || null;
  let liveAccBal = strictCfg.starting_savings_balance;
  let accLabel = strictCfg.savings_account_name || 'Savings Account';
  if (activeTargetAccId) {
    try {
      const { data: liveAcc } = await supabase.from('accounts').select('name, balance').eq('id', activeTargetAccId).single();
      if (liveAcc) {
        liveAccBal = Number(liveAcc.balance || 0);
        if (liveAcc.name) accLabel = liveAcc.name;
      }
    } catch (e) {}
  }
  const kmToastMsg = km > 0 ? ` (+${km} km Odo)` : '';

  let strictToastMsg = '';
  if (shiftNet >= strictRequiredToday) {
    const extraProfit = shiftNet - strictRequiredToday;
    strictToastMsg = `🎉 Congrats! Target & Profit Hit! You saved Ksh ${shiftNet.toLocaleString()} today (${accLabel} in Finance Hub is now Ksh ${liveAccBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • 100% Synced)${kmToastMsg}${batchToastSuffix}`;
  } else {
    const overdueAmt = strictRequiredToday - Math.max(0, shiftNet);
    strictToastMsg = `💪 Let's catch up! Overdue of Ksh ${overdueAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to recover (${accLabel} in Finance Hub reads Ksh ${liveAccBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})${kmToastMsg}${batchToastSuffix}`;
  }

  return c.redirect(`/rider?toast=${encodeURIComponent(paystackToastPrefix + strictToastMsg)}#shift-briefing-card`, 303);
});

riderRoutes.post('/rider/logs/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  try {
    const { data: shiftTxs } = await supabase.from('transactions').select('*').eq('rider_log_id', id);
    if (shiftTxs && shiftTxs.length > 0) {
      for (const t of shiftTxs) {
        if (t.account_id) {
          const { data: acc } = await supabase.from('accounts').select('*').eq('id', t.account_id).single();
          if (acc) {
            const delta = t.transaction_type === 'INCOME' ? -Number(t.amount || 0) : Number(t.amount || 0);
            const newBal = toDecimal(acc.balance).plus(delta).toNumber();
            await supabase.from('accounts').update({ balance: newBal }).eq('id', t.account_id);
          }
        }
      }
    }
    await supabase.from('transactions').delete().eq('rider_log_id', id);
    await supabase.from('rider_logs').delete().eq('id', id);
  } catch (e) {}
  const currentSavedLogs = getSavedRiderLogs(c);
  const deletedShift = currentSavedLogs.find((l: any) => String(l.id) === String(id));
  if (deletedShift && Number(deletedShift.kilometers || 0) > 0) {
    const existingOdo = getOdometerConfig(c, []);
    const nextCurrentOdo = Math.max(0, Math.round((existingOdo.current_odometer - Number(deletedShift.kilometers || 0)) * 10) / 10);
    saveOdometerConfigCookie(c, {
      base_odometer: nextCurrentOdo,
      current_odometer: nextCurrentOdo,
      last_service_odo: existingOdo.last_service_odo,
      service_interval_km: existingOdo.service_interval_km,
    });
  }
  const remainingLogs = currentSavedLogs.filter((l: any) => String(l.id) !== String(id));
  saveRiderLogsCookie(c, remainingLogs);
  return c.redirect('/rider?toast=Shift+log+removed+(Finance+accounts+re-synced)', 303);
});

// ------------------------------------------------------------------------------
// MOTORBIKE & EV FLEET CRUD
// ------------------------------------------------------------------------------
riderRoutes.post('/bikes/create', async (c) => {
  const { supabase, userId, username } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const plate = String(body['plate_number'] || '').trim().toUpperCase();
  if (!plate) {
    return c.redirect('/rider?toast=Please+enter+a+valid+number+plate', 303);
  }

  const model = body['model_name'] ? String(body['model_name']).trim() : 'Boda Boda';
  const owner = body['owner_name'] ? String(body['owner_name']).trim() : (username || 'Dennis');
  const rawPower = String(body['power_type'] || 'PETROL').toUpperCase();
  const powerType = (['ELECTRIC', 'HYBRID', 'DIESEL', 'PETROL'].includes(rawPower) ? rawPower : 'PETROL') as 'PETROL' | 'ELECTRIC' | 'HYBRID' | 'DIESEL';
  const targetKes = parseFloat(String(body['daily_target'] || '1000.0')) || 1000.0;

  // Deactivate existing bikes so the new bike becomes active
  try {
    if (userId) {
      await supabase.from('bikes').update({ is_active: 0 }).eq('user_id', userId);
    } else {
      await supabase.from('bikes').update({ is_active: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
    }
  } catch (err) {
    console.warn('Deactivate previous bikes notice:', err);
  }

  const insertPayload: any = {
    plate_number: plate,
    model_name: model,
    owner_name: owner,
    power_type: powerType,
    daily_target: targetKes,
    is_active: 1,
  };
  if (userId) {
    insertPayload.user_id = userId;
  }

  let { data: newBike, error } = await supabase.from('bikes').insert(insertPayload).select().single();

  if (error && error.code === 'PGRST204') {
    delete insertPayload.power_type;
    const retryRes = await supabase.from('bikes').insert(insertPayload).select().single();
    newBike = retryRes.data;
    error = retryRes.error;
  }

  if (error) {
    console.error('Failed to register bike:', error);
    return c.redirect(`/rider?toast=${encodeURIComponent('Failed to register vehicle: ' + error.message)}`, 303);
  }

  const existingStrict = getStrictSaverConfig(c, insertPayload);
  const customFuel = parseFloat(String(body['fuel_allowance'] || '')) || (powerType === 'ELECTRIC' ? 300 : 500);
  const lunchKes = existingStrict.lunch_allowance_kes ?? 150;
  const airtimeKes = existingStrict.airtime_allowance_kes ?? 50;
  saveStrictSaverConfigCookie(c, {
    ...existingStrict,
    net_floor_kes: targetKes,
    fuel_allowance_kes: customFuel,
    lunch_allowance_kes: lunchKes,
    airtime_allowance_kes: airtimeKes,
    personal_expense_cap_kes: lunchKes + airtimeKes,
  });

  const typeLabel = powerType === 'ELECTRIC' ? 'Electric EV' : (powerType === 'HYBRID' ? 'Hybrid Car' : (powerType === 'DIESEL' ? 'Diesel Vehicle' : (model.toLowerCase().includes('car') || model.toLowerCase().includes('vitz') || model.toLowerCase().includes('demio') || model.toLowerCase().includes('alto') ? 'Ride-Hailing Car' : 'Vehicle')));
  return c.redirect(`/rider?toast=${encodeURIComponent(`${typeLabel} [${plate}] registered with Strict Net Floor of Ksh ${targetKes.toLocaleString()}!`)}`, 303);
});

riderRoutes.post('/rider/strict-contract', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const existing = getStrictSaverConfig(c);
  const netFloorKes = Math.max(100, parseFloat(String(body['net_floor_kes'] || '1000')) || 1000);
  const fuelAllowanceKes = Math.max(0, parseFloat(String(body['fuel_allowance_kes'] ?? '500')) || 0);
  const lunchAllowanceKes = Math.max(0, parseFloat(String(body['lunch_allowance_kes'] ?? '150')) || 0);
  const airtimeAllowanceKes = Math.max(0, parseFloat(String(body['airtime_allowance_kes'] ?? '50')) || 0);
  const personalCapKes = lunchAllowanceKes + airtimeAllowanceKes;
  const dailyKodiKes = Math.max(0, parseFloat(String(body['daily_kodi_kes'] || '0')) || 0);
  const saveUnspentLunch = body['save_unspent_lunch'] !== '0';
  const savingsAccountId = body['savings_account_id'] !== undefined ? String(body['savings_account_id']).trim() : existing.savings_account_id;
  let savingsAccountName = body['savings_account_name'] ? String(body['savings_account_name']).trim() : existing.savings_account_name;
  const startingSavingsBalance = body['starting_savings_balance'] !== undefined
    ? Math.max(0, parseFloat(String(body['starting_savings_balance'] || '0')) || 0)
    : existing.starting_savings_balance;
  const workDaysPerWeek = body['work_days_per_week'] !== undefined
    ? Math.min(7, Math.max(1, parseInt(String(body['work_days_per_week'] || '6'), 10) || 6))
    : existing.work_days_per_week;
  const preferredOffDay = body['preferred_off_day'] !== undefined
    ? String(body['preferred_off_day'] || 'TUESDAY').toUpperCase().trim()
    : (existing.preferred_off_day || 'TUESDAY');
  const dailyBonusTargetKes = body['daily_bonus_target_kes'] !== undefined
    ? Math.max(50, parseFloat(String(body['daily_bonus_target_kes'] || '300')) || 300)
    : existing.daily_bonus_target_kes;
  const bonusMission = body['bonus_mission']
    ? String(body['bonus_mission']).trim()
    : existing.bonus_mission;
  const bikeId = body['bike_id'] ? String(body['bike_id']).trim() : '';

  let resolvedStartingBalance = startingSavingsBalance;
  if (savingsAccountId) {
    try {
      const { data: acc } = await supabase.from('accounts').select('name, balance').eq('id', savingsAccountId).single();
      if (acc) {
        if (acc.name) savingsAccountName = acc.name;
        resolvedStartingBalance = Number(acc.balance || 0);
      }
    } catch (e) {}
  }

  saveStrictSaverConfigCookie(c, {
    net_floor_kes: netFloorKes,
    fuel_allowance_kes: fuelAllowanceKes,
    lunch_allowance_kes: lunchAllowanceKes,
    airtime_allowance_kes: airtimeAllowanceKes,
    personal_expense_cap_kes: personalCapKes,
    daily_kodi_kes: dailyKodiKes,
    save_unspent_lunch: saveUnspentLunch,
    savings_account_id: savingsAccountId,
    savings_account_name: savingsAccountName || 'Strict Savings Account',
    starting_savings_balance: resolvedStartingBalance,
    work_days_per_week: workDaysPerWeek,
    preferred_off_day: preferredOffDay,
    daily_bonus_target_kes: dailyBonusTargetKes,
    bonus_mission: bonusMission,
  });

  try {
    if (bikeId) {
      await supabase.from('bikes').update({ daily_target: netFloorKes }).eq('id', bikeId);
    } else if (userId) {
      await supabase.from('bikes').update({ daily_target: netFloorKes }).eq('user_id', userId).eq('is_active', 1);
    }
  } catch (e) {}

  const reqGross = netFloorKes + fuelAllowanceKes + personalCapKes + dailyKodiKes;
  const weeklyExtraPool = dailyBonusTargetKes * workDaysPerWeek;
  return c.redirect(
    `/rider?toast=${encodeURIComponent(`Strict Saver Contract locked! 👑 Sacred Daily Floor: Ksh ${netFloorKes.toLocaleString()} • 🔥 Extra Hustle Challenge: +Ksh ${dailyBonusTargetKes.toLocaleString()}/day (Ksh ${weeklyExtraPool.toLocaleString()} Weekly Extra Pool) • Required Gross: Ksh ${reqGross.toLocaleString()}`)}#shift-briefing-card`,
    303
  );
});

// Toggle any day as a flexible Rest / Off Day
riderRoutes.post('/rider/rest-day/toggle', async (c) => {
  const body = await c.req.parseBody();
  const dateStr = String(body['date'] || new Date().toISOString().slice(0, 10));
  const isRest = toggleRestDay(c, dateStr);
  const msg = isRest
    ? `🛋️ Marked ${dateStr} as an Off / Rest Day! Weekly targets & pacing adapted.`
    : `🛵 Cleared off day for ${dateStr}! Active shift mode restored.`;
  return c.redirect(`/rider?toast=${encodeURIComponent(msg)}#shift-briefing-card`, 303);
});

// ------------------------------------------------------------------------------
// 📦 SMART HOLDING POT ROUTES (QUEUE / CONFIG / INTERACTIVE CHECKLIST / DISBURSE / CLEAR)
// ------------------------------------------------------------------------------
riderRoutes.post('/rider/batch-pot/queue', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const netAmount = Math.max(0, parseFloat(String(body['net_amount'] || '0')) || 0);
  const kmDriven = Math.max(0, parseFloat(String(body['km_driven'] || '0')) || 0);
  const accumulate = String(body['queue_mode'] || 'ACCUMULATE').toUpperCase() !== 'REPLACE';
  const dateStr = String(body['date'] || new Date().toISOString().slice(0, 10));

  if (netAmount <= 0) {
    return c.redirect('/rider?toast=' + encodeURIComponent('Enter a positive net surplus to queue into your Weekly Holding Pot.') + '#sunday-batch-card', 303);
  }

  const entry = await queueNetAmountToBatchPot(c, supabase, userId, dateStr, netAmount, { accumulate, kmDriven });
  const currentPot = getWeeklyBatchPot(c);
  const totalQueued = currentPot.reduce((sum, e) => sum + Number(e.net_amount || 0), 0);
  const shiftInfo = (entry?.shifts_count || 1) > 1
    ? ` (Shift #${entry?.shifts_count} summed for ${entry?.day_label}: Ksh ${entry?.net_amount.toLocaleString()})`
    : ` (${entry?.day_label || dateStr})`;

  return c.redirect(
    `/rider?toast=${encodeURIComponent(`📦 Queued +Ksh ${netAmount.toLocaleString()}${shiftInfo}! Total Ring-Fenced in Holding Pot: Ksh ${totalQueued.toLocaleString()} (Synced to Cloud DB)`)}#sunday-batch-card`,
    303
  );
});

riderRoutes.post('/rider/batch-pot/config', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const existing = getHoldingPotConfig(c);

  const stratRaw = String(body['parking_strategy'] || existing.parking_strategy).toUpperCase();
  const parkingStrategy = (stratRaw === 'MSHWARI' || stratRaw === 'MPESA_WALLET' ? stratRaw : 'ZIIDI_MMF') as HoldingPotConfig['parking_strategy'];
  const defaultApy = parkingStrategy === 'ZIIDI_MMF' ? 13.5 : parkingStrategy === 'MSHWARI' ? 7.5 : 0;
  const apy = body['parking_apy_pct'] !== undefined && body['parking_apy_pct'] !== ''
    ? Math.max(0, parseFloat(String(body['parking_apy_pct'])) || defaultApy)
    : defaultApy;

  const updated = saveHoldingPotConfigCookie(c, {
    ...existing,
    source_account_id: body['source_account_id'] !== undefined ? String(body['source_account_id']).trim() : existing.source_account_id,
    parking_strategy: parkingStrategy,
    parking_apy_pct: apy,
    closeout_day: body['closeout_day'] ? String(body['closeout_day']).toUpperCase().trim() : existing.closeout_day,
    threshold_kes: body['threshold_kes'] ? Math.max(500, parseInt(String(body['threshold_kes']), 10) || 5000) : existing.threshold_kes,
    auto_skim_commission: body['auto_skim_commission'] === '1' || body['auto_skim_commission'] === 'on',
    auto_skim_service: body['auto_skim_service'] === '1' || body['auto_skim_service'] === 'on',
    service_rate_per_km: body['service_rate_per_km'] !== undefined ? Math.max(0, parseFloat(String(body['service_rate_per_km'])) || 2.5) : existing.service_rate_per_km,
    auto_skim_bills: body['auto_skim_bills'] === '1' || body['auto_skim_bills'] === 'on',
  });

  const currentPot = getWeeklyBatchPot(c);
  await syncBatchPotStateToDb(supabase, userId, currentPot, updated);

  return c.redirect(
    `/rider?toast=${encodeURIComponent(`⚙️ Smart Holding Pot Settings saved! Closeout: ${updated.closeout_day} or Ksh ${updated.threshold_kes.toLocaleString()}+ • Parking: ${updated.parking_strategy} (${updated.parking_apy_pct}% p.a.)`)}#sunday-batch-card`,
    303
  );
});

async function executeSingleChecklistTransfer(params: {
  c: any;
  supabase: any;
  userId: string | null;
  sourceAccountId: string | null;
  targetId: string | null;
  targetType: string;
  title: string;
  amount: number;
  stayParked: boolean;
  todayDate: string;
}): Promise<void> {
  const { c, supabase, userId, sourceAccountId, targetId, targetType, title, amount, stayParked, todayDate } = params;
  if (amount <= 0) return;

  try {
    // 1. Subtract from Source Holding Account (unless it stays parked inside the exact same account)
    if (sourceAccountId && (!stayParked || (targetId && targetId !== sourceAccountId))) {
      const { data: srcAcc } = await supabase.from('accounts').select('*').eq('id', sourceAccountId).single();
      if (srcAcc) {
        const nextBal = Math.max(0, toDecimal(srcAcc.balance || 0).minus(amount).toNumber());
        await supabase.from('accounts').update({ balance: nextBal }).eq('id', sourceAccountId);
      }
      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: sourceAccountId,
        transaction_type: 'EXPENSE',
        category: 'Internal Transfer: Batch Waterfall',
        amount,
        date: todayDate,
        description: `Transfer to ${title} (Holding Pot Closeout)`,
      });
    }

    // 2. Credit Destination Account, Goal, or settle Platform Commission
    if (targetType === 'COMMISSION') {
      const plat = getPlatformRemittanceConfig(c);
      let rem = amount;
      const uberCut = Math.min(plat.uber_owed, rem);
      rem -= uberCut;
      const boltCut = Math.min(plat.bolt_owed, rem);
      rem -= boltCut;
      const otherCut = Math.min(plat.other_owed, rem);
      const nextUber = Math.max(0, Math.round((plat.uber_owed - uberCut) * 100) / 100);
      const nextBolt = Math.max(0, Math.round((plat.bolt_owed - boltCut) * 100) / 100);
      const nextOther = Math.max(0, Math.round((plat.other_owed - otherCut) * 100) / 100);
      savePlatformRemittanceConfigCookie(c, {
        ...plat,
        uber_owed: nextUber,
        bolt_owed: nextBolt,
        other_owed: nextOther,
        total_owed: nextUber + nextBolt + nextOther,
        last_remitted_date: todayDate,
        last_remitted_amount: amount,
        last_remitted_platform: 'Batch Closeout Auto-Skim',
      });
    } else if (targetId) {
      if (targetType === 'GOAL') {
        const { data: g } = await supabase.from('goals').select('*').eq('id', targetId).single();
        if (g) {
          const newCur = toDecimal(g.current_amount || 0).plus(amount).toNumber();
          await supabase.from('goals').update({ current_amount: newCur }).eq('id', targetId);
        }
      } else if (!stayParked || targetId !== sourceAccountId) {
        const { data: dstAcc } = await supabase.from('accounts').select('*').eq('id', targetId).single();
        if (dstAcc) {
          const newBal = toDecimal(dstAcc.balance || 0).plus(amount).toNumber();
          await supabase.from('accounts').update({ balance: newBal }).eq('id', targetId);
        }
      }

      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: targetId,
        transaction_type: 'INCOME',
        category: 'Internal Transfer: Batch Waterfall',
        amount,
        date: todayDate,
        description: `Transfer from Holding Pot: ${title}`,
      });
    }
  } catch (e) {}
}

// Interactive Closeout Checklist: Mark 1 Single Bucket Sent & Settle via True Internal Transfer
riderRoutes.post('/rider/batch-pot/disburse-item', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const itemKey = String(body['item_key'] || '').trim();
  const title = String(body['title'] || 'Holding Pot Bucket').trim();
  const targetType = String(body['target_type'] || 'ACCOUNT').toUpperCase().trim();
  const targetId = body['target_id'] ? String(body['target_id']).trim() : null;
  const sourceAccountId = body['source_account_id'] ? String(body['source_account_id']).trim() : null;
  const amount = Math.max(0, parseFloat(String(body['amount'] || '0')) || 0);
  const stayParked = body['stay_parked'] === '1' || body['stay_parked'] === 'true';
  const totalChecklistCount = Math.max(1, parseInt(String(body['total_items'] || '1'), 10) || 1);
  const todayDate = new Date().toISOString().slice(0, 10);

  if (!itemKey || amount <= 0) {
    return c.redirect('/rider?toast=' + encodeURIComponent('Invalid checklist item.') + '#sunday-batch-card', 303);
  }

  const cfg = getHoldingPotConfig(c);
  if (cfg.settled_bucket_keys.includes(itemKey)) {
    return c.redirect('/rider?toast=' + encodeURIComponent(`"${title}" is already marked as sent.`) + '#sunday-batch-card', 303);
  }

  await executeSingleChecklistTransfer({
    c,
    supabase,
    userId,
    sourceAccountId: sourceAccountId || cfg.source_account_id || null,
    targetId,
    targetType,
    title,
    amount,
    stayParked,
    todayDate,
  });

  const nextSettled = [...cfg.settled_bucket_keys, itemKey];
  const currentPot = getWeeklyBatchPot(c);

  if (nextSettled.length >= totalChecklistCount) {
    // All checklist items have been sent! Reset Holding Pot for the new week
    saveWeeklyBatchPotCookie(c, []);
    const resetCfg = saveHoldingPotConfigCookie(c, { ...cfg, settled_bucket_keys: [] });
    await syncBatchPotStateToDb(supabase, userId, [], resetCfg);
    return c.redirect(
      `/rider?toast=${encodeURIComponent(`🎉 Final Checklist Item "${title}" (Ksh ${amount.toLocaleString()}) Sent! All buckets settled via Internal Transfers & Holding Pot reset for the new cycle.`)}#sunday-batch-card`,
      303
    );
  }

  const updatedCfg = saveHoldingPotConfigCookie(c, { ...cfg, settled_bucket_keys: nextSettled });
  await syncBatchPotStateToDb(supabase, userId, currentPot, updatedCfg);

  return c.redirect(
    `/rider?toast=${encodeURIComponent(`✅ Marked "${title}" (Ksh ${amount.toLocaleString()}) Sent! (${nextSettled.length}/${totalChecklistCount} done — ${totalChecklistCount - nextSettled.length} remaining in Holding Pot)`)}#sunday-batch-card`,
    303
  );
});

riderRoutes.post('/rider/batch-pot/disburse', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const explicitSourceId = body['source_account_id'] ? String(body['source_account_id']).trim() : '';
  const { entries: currentPot, config: potCfg } = await resolveEffectiveBatchPot(c, supabase, userId);

  if (currentPot.length === 0) {
    return c.redirect('/rider?toast=' + encodeURIComponent('Your Weekly Holding Pot is currently empty.') + '#sunday-batch-card', 303);
  }

  let accQuery = supabase.from('accounts').select('*');
  let rulesQuery = supabase.from('split_rules').select('*').order('percentage', { ascending: false });
  if (userId) {
    accQuery = accQuery.eq('user_id', userId);
    rulesQuery = rulesQuery.eq('user_id', userId);
  }
  const [{ data: accs }, { data: rules }] = await Promise.all([accQuery, rulesQuery]);
  const platRemit = getPlatformRemittanceConfig(c);
  const todayDate = new Date().toISOString().slice(0, 10);

  const report = computeSmartHoldingPot({
    batchPotEntries: currentPot,
    config: explicitSourceId ? { ...potCfg, source_account_id: explicitSourceId } : potCfg,
    accounts: accs || [],
    allocationRules: rules || [],
    platformOwedKes: platRemit.total_owed,
    todayIso: todayDate,
  });

  const pendingItems = report.checklistItems.filter(i => !i.isSettled && i.amount > 0);
  let totalSettledNow = 0;

  for (const item of pendingItems) {
    totalSettledNow = Math.round((totalSettledNow + item.amount) * 100) / 100;
    await executeSingleChecklistTransfer({
      c,
      supabase,
      userId,
      sourceAccountId: report.sourceAccountId,
      targetId: item.targetId,
      targetType: item.targetType,
      title: item.title,
      amount: item.amount,
      stayParked: item.stayParkedInMmf,
      todayDate,
    });
  }

  const transfersSaved = Math.max(0, (currentPot.length * Math.max(1, pendingItems.length)) - pendingItems.length);
  saveWeeklyBatchPotCookie(c, []);
  const resetCfg = saveHoldingPotConfigCookie(c, { ...potCfg, settled_bucket_keys: [] });
  await syncBatchPotStateToDb(supabase, userId, [], resetCfg);

  return c.redirect(
    `/rider?toast=${encodeURIComponent(`🚀 Holding Pot Closeout Complete! Ksh ${totalSettledNow.toLocaleString()} settled across ${pendingItems.length} priority & profit buckets via clean Internal Transfers (Saved ${transfersSaved} M-Pesa fee transfers!).`)}#sunday-batch-card`,
    303
  );
});

riderRoutes.post('/rider/batch-pot/clear', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  saveWeeklyBatchPotCookie(c, []);
  const cfg = getHoldingPotConfig(c);
  const resetCfg = saveHoldingPotConfigCookie(c, { ...cfg, settled_bucket_keys: [] });
  await syncBatchPotStateToDb(supabase, userId, [], resetCfg);
  return c.redirect('/rider?toast=' + encodeURIComponent('Weekly Batch Holding Pot cleared across device & cloud.') + '#sunday-batch-card', 303);
});

riderRoutes.post('/rider/platform-remittance/remit', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const platform = String(body['platform'] || 'uber').toLowerCase(); // 'uber' | 'bolt' | 'other'
  const amount = Math.max(0, parseFloat(String(body['amount'] || '0')) || 0);
  const payDate = String(body['payment_date'] || new Date().toISOString().slice(0, 10));
  const accountId = body['account_id'] ? String(body['account_id']).trim() : null;
  const syncFinanceLedger = body['sync_finance_ledger'] === '1' || body['sync_finance_ledger'] === 'true' || Boolean(accountId);

  if (amount <= 0) {
    return c.redirect('/rider?toast=' + encodeURIComponent('Please enter a valid remittance amount.') + '#platform-remittance-card', 303);
  }

  const curConfig = getPlatformRemittanceConfig(c);
  let newUber = curConfig.uber_owed;
  let newBolt = curConfig.bolt_owed;
  let newOther = curConfig.other_owed;

  if (platform === 'uber') {
    newUber = Math.max(0, Math.round((newUber - amount) * 100) / 100);
  } else if (platform === 'bolt') {
    newBolt = Math.max(0, Math.round((newBolt - amount) * 100) / 100);
  } else {
    newOther = Math.max(0, Math.round((newOther - amount) * 100) / 100);
  }

  const newTotal = Math.round((newUber + newBolt + newOther) * 100) / 100;

  savePlatformRemittanceConfigCookie(c, {
    ...curConfig,
    uber_owed: newUber,
    bolt_owed: newBolt,
    other_owed: newOther,
    total_owed: newTotal,
    last_remitted_date: payDate,
    last_remitted_amount: amount,
    last_remitted_platform: platform.toUpperCase(),
  });

  // If driver opted to sync to FinanceHub ledger or selected an account
  if (syncFinanceLedger && accountId) {
    try {
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
      if (acc) {
        const newBal = toDecimal(acc.balance).minus(amount).toNumber();
        await supabase.from('accounts').update({ balance: newBal }).eq('id', accountId);
      }
      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: accountId,
        transaction_type: 'EXPENSE',
        category: 'Platform Commission Remittance',
        amount: amount,
        date: payDate,
        description: `Platform Remittance: ${platform.toUpperCase()} Commission (Paybill 898998) - Ksh ${amount.toLocaleString()}`,
      });
    } catch (e) {}
  }

  return c.redirect(
    `/rider?toast=${encodeURIComponent(`Remitted Ksh ${amount.toLocaleString()} to ${platform.toUpperCase()}! Remaining balance owed: Ksh ${newTotal.toLocaleString()}.`)}#platform-remittance-card`,
    303
  );
});

riderRoutes.post('/rider/platform-remittance/update', async (c) => {
  const body = await c.req.parseBody();
  const uberOwed = Math.max(0, parseFloat(String(body['uber_owed'] || '0')) || 0);
  const boltOwed = Math.max(0, parseFloat(String(body['bolt_owed'] || '0')) || 0);
  const otherOwed = Math.max(0, parseFloat(String(body['other_owed'] || '0')) || 0);
  const lockoutThreshold = Math.max(500, parseFloat(String(body['lockout_threshold_kes'] || '6000')) || 6000);
  const notes = body['notes'] ? String(body['notes']).trim() : '';

  const totalOwed = Math.round((uberOwed + boltOwed + otherOwed) * 100) / 100;
  const curConfig = getPlatformRemittanceConfig(c);

  savePlatformRemittanceConfigCookie(c, {
    ...curConfig,
    uber_owed: uberOwed,
    bolt_owed: boltOwed,
    other_owed: otherOwed,
    total_owed: totalOwed,
    lockout_threshold_kes: lockoutThreshold,
    notes,
  });

  return c.redirect(
    `/rider?toast=${encodeURIComponent(`Platform balances updated: Total owed Ksh ${totalOwed.toLocaleString()} (Lockout threshold: Ksh ${lockoutThreshold.toLocaleString()})`)}#platform-remittance-card`,
    303
  );
});

riderRoutes.post('/bikes/activate/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const id = c.req.param('id');
  if (userId) {
    await supabase.from('bikes').update({ is_active: 0 }).eq('user_id', userId);
  } else {
    await supabase.from('bikes').update({ is_active: 0 }).neq('id', id);
  }
  const { error } = await supabase.from('bikes').update({ is_active: 1 }).eq('id', id);
  if (error) {
    console.error('Failed to activate bike:', error);
    return c.redirect(`/rider?toast=${encodeURIComponent('Failed to activate vehicle: ' + error.message)}`, 303);
  }
  return c.redirect('/rider?toast=Active+vehicle+switched', 303);
});

riderRoutes.post('/bikes/delete/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const id = c.req.param('id');
  const { error } = await supabase.from('bikes').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete bike:', error);
    return c.redirect(`/rider?toast=${encodeURIComponent('Failed to delete vehicle: ' + error.message)}`, 303);
  }
  
  // If active bike was deleted, activate any remaining bike
  let query = supabase.from('bikes').select('*');
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const { data: remaining } = await query.limit(1);
  if (remaining && remaining.length > 0) {
    await supabase.from('bikes').update({ is_active: 1 }).eq('id', remaining[0].id);
  }
  return c.redirect('/rider?toast=Vehicle+removed+from+fleet', 303);
});

// ------------------------------------------------------------------------------
// ODOMETER, SERVICE INTERVAL & REAL CPK SYNC
// ------------------------------------------------------------------------------
riderRoutes.post('/rider/odometer/update', async (c) => {
  const body = await c.req.parseBody();
  const rawLastService = parseFloat(String(body['last_service_odo'] ?? '0'));
  const lastServiceOdo = !isNaN(rawLastService) && rawLastService >= 0 ? rawLastService : 0;
  const intervalKm = parseFloat(String(body['service_interval_km'] || '3000')) || 3000;
  const syncMode = String(body['sync_mode'] || '');

  const rawCurrentOdo = parseFloat(String(body['current_odometer'] ?? '0'));
  let currentOdo = !isNaN(rawCurrentOdo) && rawCurrentOdo >= 0 ? rawCurrentOdo : 0;

  if (syncMode === 'FROM_SERVICE') {
    currentOdo = lastServiceOdo;
  }

  const roundedCurrentOdo = Math.round(currentOdo * 10) / 10;

  saveOdometerConfigCookie(c, {
    base_odometer: roundedCurrentOdo,
    current_odometer: roundedCurrentOdo,
    last_service_odo: lastServiceOdo,
    service_interval_km: intervalKm,
  });

  return c.redirect(`/rider?toast=${encodeURIComponent(`Odometer synced at ${roundedCurrentOdo.toLocaleString()} km (Next service at ${(lastServiceOdo + intervalKm).toLocaleString()} km)`)}#odometer-card`, 303);
});

// ------------------------------------------------------------------------------
// MAINTENANCE & COMPLIANCE
// ------------------------------------------------------------------------------
riderRoutes.post('/rider/maintenance/log', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const rawBikeId = body['bike_id'] ? String(body['bike_id']).trim() : '';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawBikeId);
  const bikeId = isUuid ? rawBikeId : null;
  const serviceType = String(body['service_type'] || 'Oil Change & Brake Service').trim();
  const serviceDate = String(body['service_date'] || new Date().toISOString().slice(0, 10));
  const intervalWeeks = parseInt(String(body['interval_weeks'] || '3'), 10) || 3;
  const serviceOdometer = parseFloat(String(body['service_odometer'] || '0'));

  const oilCost = parseFloat(String(body['oil_cost'] || '0.0')) || 0.0;
  const brakePadCost = parseFloat(String(body['brake_pad_cost'] || '0.0')) || 0.0;
  const sparkPlugCost = parseFloat(String(body['spark_plug_cost'] || '0.0')) || 0.0;
  const laborCost = parseFloat(String(body['labor_cost'] || '0.0')) || 0.0;
  const otherCost = parseFloat(String(body['other_cost'] || '0.0')) || 0.0;
  const rawTotal = parseFloat(String(body['total_cost'] || '0.0')) || 0.0;

  const computedTotal = oilCost + brakePadCost + sparkPlugCost + laborCost + otherCost;
  const finalTotalCost = rawTotal > 0 ? rawTotal : computedTotal;

  const notes = body['notes'] ? String(body['notes']).trim() : '';
  const accountId = body['account_id'] ? String(body['account_id']).trim() : '';

  const parsedDate = new Date(serviceDate);
  const nextDueDate = new Date(parsedDate.getTime() + intervalWeeks * 7 * 86400000).toISOString().slice(0, 10);

  if (serviceOdometer > 0) {
    const existingOdo = getOdometerConfig(c, []);
    const updatedCurrentOdo = Math.round(Math.max(existingOdo.current_odometer, serviceOdometer) * 10) / 10;
    saveOdometerConfigCookie(c, {
      base_odometer: updatedCurrentOdo,
      current_odometer: updatedCurrentOdo,
      last_service_odo: serviceOdometer,
      service_interval_km: existingOdo.service_interval_km || 3000,
    });
  }

  const effectiveNotes = notes || `Service on ${serviceDate}: Oil (Ksh ${oilCost}), Pads (Ksh ${brakePadCost}), Labor (Ksh ${laborCost})` + (finalTotalCost > 0 ? ` • Total: Ksh ${finalTotalCost.toLocaleString()}` : '');

  // Insert or record in maintenance_schedules
  const insertPayload: any = {
    bike_id: bikeId,
    service_type: serviceType,
    interval_weeks: intervalWeeks,
    last_service_date: serviceDate,
    next_due_date: nextDueDate,
    last_brake_pad_date: brakePadCost > 0 ? serviceDate : null,
    brake_pad_cost_last: brakePadCost > 0 ? brakePadCost : finalTotalCost,
    notes: effectiveNotes,
  };
  if (userId) {
    insertPayload.user_id = userId;
  }

  let createdMaint: any = null;
  try {
    const { data, error } = await supabase.from('maintenance_schedules').insert(insertPayload).select().single();
    if (!error && data) {
      createdMaint = data;
    } else if (error) {
      console.error('Failed to log maintenance schedule in DB:', error);
    }
  } catch (e) {}

  const fallbackMaint = {
    id: createdMaint?.id || ('maint_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
    user_id: userId || 'demo',
    bike_id: rawBikeId || null,
    service_type: serviceType,
    interval_weeks: intervalWeeks,
    last_service_date: serviceDate,
    next_due_date: nextDueDate,
    last_brake_pad_date: brakePadCost > 0 ? serviceDate : null,
    brake_pad_cost_last: brakePadCost > 0 ? brakePadCost : finalTotalCost,
    cost_kes: finalTotalCost,
    service_odometer: serviceOdometer > 0 ? serviceOdometer : undefined,
    notes: effectiveNotes,
    created_at: new Date().toISOString(),
  };
  const savedMaintList = getSavedMaintenanceSchedules(c);
  savedMaintList.unshift(fallbackMaint);
  saveMaintenanceSchedulesCookie(c, savedMaintList);

  // Deduct from account & sync to finance ledger automatically
  if (finalTotalCost > 0) {
    if (accountId) {
      try {
        const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
        if (acc) {
          const newBal = toDecimal(acc.balance).minus(finalTotalCost).toNumber();
          await supabase.from('accounts').update({ balance: newBal }).eq('id', accountId);
        }
      } catch (e) {}
    }

    try {
      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: accountId || null,
        transaction_type: 'EXPENSE',
        category: 'Vehicle Maintenance & Repairs',
        amount: finalTotalCost,
        date: serviceDate,
        description: `Vehicle Service: ${serviceType} (${notes || 'Oil, Brake Pads & Labor'})`,
      });
    } catch (e) {}
  }

  return c.redirect('/rider?toast=' + encodeURIComponent(`Service & repair logged (${serviceType}${finalTotalCost > 0 ? ' • Ksh ' + finalTotalCost.toLocaleString() : ''})#maint-card`), 303);
});

riderRoutes.post('/rider/maintenance/create', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const serviceType = String(body['service_type'] || 'Oil Change & Inspection').trim();
  const intervalWeeks = parseInt(String(body['interval_weeks'] || '3'), 10) || 3;
  const lastDate = body['last_service_date'] ? String(body['last_service_date']) : new Date().toISOString().slice(0, 10);
  const nextDate = new Date(new Date(lastDate).getTime() + intervalWeeks * 7 * 86400000).toISOString().slice(0, 10);
  const notes = body['notes'] ? String(body['notes']).trim() : null;

  let createdMaint: any = null;
  try {
    const { data, error } = await supabase.from('maintenance_schedules').insert({
      ...(userId ? { user_id: userId } : {}),
      service_type: serviceType,
      interval_weeks: intervalWeeks,
      last_service_date: lastDate,
      next_due_date: nextDate,
      notes,
    }).select().single();
    if (!error && data) createdMaint = data;
  } catch (e) {}

  const savedMaintList = getSavedMaintenanceSchedules(c);
  savedMaintList.unshift(createdMaint || {
    id: 'maint_' + Date.now(),
    user_id: userId || 'demo',
    service_type: serviceType,
    interval_weeks: intervalWeeks,
    last_service_date: lastDate,
    next_due_date: nextDate,
    notes,
  });
  saveMaintenanceSchedulesCookie(c, savedMaintList);

  return c.redirect('/rider?toast=Maintenance+schedule+added#maint-card', 303);
});

riderRoutes.post('/rider/maintenance/service/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  const todayStr = new Date().toISOString().slice(0, 10);

  const savedMaintList = getSavedMaintenanceSchedules(c);
  let intervalWeeks = 3;
  const targetCookie = savedMaintList.find((m: any) => String(m.id) === String(id));
  if (targetCookie && targetCookie.interval_weeks) {
    intervalWeeks = Number(targetCookie.interval_weeks) || 3;
  } else {
    try {
      const { data: existing } = await supabase.from('maintenance_schedules').select('*').eq('id', id).single();
      if (existing && existing.interval_weeks) intervalWeeks = Number(existing.interval_weeks) || 3;
    } catch (e) {}
  }

  const nextDueDate = new Date(Date.now() + intervalWeeks * 7 * 86400000).toISOString().slice(0, 10);

  try {
    await supabase.from('maintenance_schedules').update({
      last_service_date: todayStr,
      next_due_date: nextDueDate,
    }).eq('id', id);
  } catch (e) {}

  const updatedCookieList = savedMaintList.map((m: any) =>
    String(m.id) === String(id)
      ? { ...m, last_service_date: todayStr, next_due_date: nextDueDate }
      : m
  );
  saveMaintenanceSchedulesCookie(c, updatedCookieList);

  return c.redirect('/rider?toast=Service+marked+done+today#maint-card', 303);
});

riderRoutes.post('/rider/maintenance/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  try {
    await supabase.from('maintenance_schedules').delete().eq('id', id);
  } catch (e) {}

  const savedMaintList = getSavedMaintenanceSchedules(c).filter((m: any) => String(m.id) !== String(id));
  saveMaintenanceSchedulesCookie(c, savedMaintList);

  return c.redirect('/rider?toast=Maintenance+schedule+removed#maint-card', 303);
});

riderRoutes.post('/rider/compliance/create', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const title = String(body['title'] || 'Certificate of Good Conduct (DCI)').trim();
  const expiryDate = body['expiry_date'] ? String(body['expiry_date']) : null;
  const intervalMonths = parseInt(String(body['interval_months'] || '12'), 10) || 12;
  const lastRenewed = body['last_renewed_date'] ? String(body['last_renewed_date']) : new Date().toISOString().slice(0, 10);
  const notes = body['notes'] ? String(body['notes']).trim() : null;
  const docCost = parseFloat(String(body['renewal_cost'] || '0.0')) || 0.0;
  const accountId = body['account_id'] ? String(body['account_id']).trim() : '';

  let createdDoc: any = null;
  try {
    const { data, error } = await supabase.from('compliance_deadlines').insert({
      ...(userId ? { user_id: userId } : {}),
      title,
      expiry_date: expiryDate,
      interval_months: intervalMonths,
      last_renewed_date: lastRenewed,
      notes,
    }).select().single();
    if (!error && data) {
      createdDoc = data;
    }
  } catch (e) {
    console.warn('Compliance DB insert notice:', e);
  }

  if (!createdDoc) {
    createdDoc = {
      id: `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title,
      expiry_date: expiryDate,
      interval_months: intervalMonths,
      last_renewed_date: lastRenewed,
      notes,
    };
  }

  const savedDocs = getSavedComplianceDocs(c);
  savedDocs.push(createdDoc);
  saveComplianceDocsCookie(c, savedDocs);

  if (docCost > 0) {
    try {
      if (accountId) {
        const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
        if (acc) {
          const newBal = toDecimal(acc.balance).minus(docCost).toNumber();
          await supabase.from('accounts').update({ balance: newBal }).eq('id', accountId);
        }
      }
      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: accountId || null,
        transaction_type: 'EXPENSE',
        category: 'Utilities & Bills',
        amount: docCost,
        date: lastRenewed,
        description: `Document / Permit Fee: ${title}`,
      });
    } catch (e) {}
  }

  return c.redirect(`/rider?toast=${encodeURIComponent(`Document "${title}" added!`)}`, 303);
});

riderRoutes.post('/rider/compliance/update/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const titleInput = body['title'] ? String(body['title']).trim() : '';
  const expiryDate = body['expiry_date'] ? String(body['expiry_date']) : null;
  const lastRenewed = body['last_renewed_date'] ? String(body['last_renewed_date']) : new Date().toISOString().slice(0, 10);
  const notes = body['notes'] ? String(body['notes']).trim() : null;
  const renewalCost = parseFloat(String(body['renewal_cost'] || '0.0')) || 0.0;
  const accountId = body['account_id'] ? String(body['account_id']).trim() : '';

  let comp: any = null;
  try {
    const updatePayload: any = {
      expiry_date: expiryDate,
      last_renewed_date: lastRenewed,
      notes,
    };
    if (titleInput) updatePayload.title = titleInput;
    const { data } = await supabase.from('compliance_deadlines').update(updatePayload).eq('id', id).select().single();
    if (data) comp = data;
  } catch (e) {}

  const savedDocs = getSavedComplianceDocs(c);
  const updatedDocs = savedDocs.map((d: any) => {
    if (String(d.id) === String(id)) {
      const next = {
        ...d,
        ...(titleInput ? { title: titleInput } : {}),
        expiry_date: expiryDate,
        last_renewed_date: lastRenewed,
        notes,
      };
      if (!comp) comp = next;
      return next;
    }
    return d;
  });
  saveComplianceDocsCookie(c, updatedDocs);

  if (renewalCost > 0) {
    try {
      if (accountId) {
        const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
        if (acc) {
          const newBal = toDecimal(acc.balance).minus(renewalCost).toNumber();
          await supabase.from('accounts').update({ balance: newBal }).eq('id', accountId);
        }
      }

      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: accountId || null,
        transaction_type: 'EXPENSE',
        category: 'Utilities & Bills',
        amount: renewalCost,
        date: lastRenewed,
        description: `Compliance Renewal: ${comp?.title || titleInput || 'Document / Permit'}`,
      });
    } catch (e) {}
  }

  return c.redirect('/rider?toast=Document+record+updated', 303);
});

riderRoutes.post('/rider/compliance/renew/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  const today = new Date();
  const nextYear = new Date(today.getTime() + 365 * 86400000);
  const todayStr = today.toISOString().slice(0, 10);
  const nextYearStr = nextYear.toISOString().slice(0, 10);

  try {
    await supabase.from('compliance_deadlines').update({
      last_renewed_date: todayStr,
      expiry_date: nextYearStr,
    }).eq('id', id);
  } catch (e) {}

  const savedDocs = getSavedComplianceDocs(c).map((d: any) =>
    String(d.id) === String(id) ? { ...d, last_renewed_date: todayStr, expiry_date: nextYearStr } : d
  );
  saveComplianceDocsCookie(c, savedDocs);

  return c.redirect('/rider?toast=Document+renewed+for+1+year', 303);
});

riderRoutes.post('/rider/compliance/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  try {
    await supabase.from('compliance_deadlines').delete().eq('id', id);
  } catch (e) {}

  const savedDocs = getSavedComplianceDocs(c).filter((d: any) => String(d.id) !== String(id));
  saveComplianceDocsCookie(c, savedDocs);

  return c.redirect('/rider?toast=Document+record+deleted', 303);
});

// ------------------------------------------------------------------------------
// OWNER REMITTANCE & VEHICLE LEASE / HIRE-PURCHASE FINANCING CRUD
// ------------------------------------------------------------------------------
riderRoutes.post('/rider/financing/create', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const bikeId = body['bike_id'] ? String(body['bike_id']) : null;
  const provider = String(body['provider_name'] || 'Vehicle Owner / Lease Provider').trim();
  const dailyAmount = parseFloat(String(body['daily_amount'] || '500.0')) || 500.0;
  const totalCost = parseFloat(String(body['total_cost'] || '180000.0')) || 180000.0;
  const paidAmount = parseFloat(String(body['paid_amount'] || '0.0')) || 0.0;
  const frequency = String(body['frequency'] || 'DAILY').toUpperCase();
  const startDate = String(body['start_date'] || new Date().toISOString().slice(0, 10));
  const notes = body['notes'] ? String(body['notes']).trim() : null;

  const { error } = await supabase.from('bike_financings').insert({
    ...(userId ? { user_id: userId } : {}),
    bike_id: bikeId,
    provider_name: provider,
    daily_amount: dailyAmount,
    total_cost: totalCost,
    paid_amount: paidAmount,
    start_date: startDate,
    frequency: frequency,
    status: paidAmount >= totalCost && totalCost > 0 ? 'COMPLETED' : 'ACTIVE',
    notes,
  });

  if (error) {
    return c.redirect(`/rider?toast=${encodeURIComponent('Failed to add lease/financing: ' + error.message)}`, 303);
  }
  return c.redirect('/rider?toast=Owner+remittance+and+lease+tracker+configured', 303);
});

riderRoutes.post('/rider/financing/pay/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const payAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;
  const payDate = String(body['payment_date'] || new Date().toISOString().slice(0, 10));
  const accountId = body['account_id'] ? String(body['account_id']).trim() : null;

  if (payAmt <= 0) {
    return c.redirect('/rider?toast=Please+enter+a+valid+payment+amount', 303);
  }

  const { data: fin } = await supabase.from('bike_financings').select('*').eq('id', id).single();
  if (fin) {
    const curPaid = toDecimal(fin.paid_amount || 0);
    const newPaid = curPaid.plus(payAmt).toNumber();
    const isCompleted = newPaid >= Number(fin.total_cost || 0) && Number(fin.total_cost || 0) > 0;

    await supabase.from('bike_financings').update({
      paid_amount: newPaid,
      status: isCompleted ? 'COMPLETED' : 'ACTIVE',
    }).eq('id', id);

    // If account linked, deduct balance
    if (accountId) {
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
      if (acc) {
        const newBal = toDecimal(acc.balance).minus(payAmt).toNumber();
        await supabase.from('accounts').update({ balance: newBal }).eq('id', accountId);
      }
    }

    // Insert transaction
    await supabase.from('transactions').insert({
      ...(userId ? { user_id: userId } : {}),
      account_id: accountId || null,
      transaction_type: 'EXPENSE',
      category: 'Vehicle Lease & Remittance',
      amount: payAmt,
      date: payDate,
      description: `Owner Remittance / Kodi: ${fin.provider_name} (Ksh ${payAmt})`,
    });
  }

  return c.redirect('/rider?toast=Remittance+payment+recorded+successfully!', 303);
});

riderRoutes.post('/rider/financing/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  const { error } = await supabase.from('bike_financings').delete().eq('id', id);
  if (error) {
    return c.redirect(`/rider?toast=${encodeURIComponent('Failed to delete financing: ' + error.message)}`, 303);
  }
  return c.redirect('/rider?toast=Lease+record+deleted', 303);
});

// ------------------------------------------------------------------------------
// 🚨 ROADSIDE EMERGENCY, PUNCTURE & FINE LEAK LOGGER
// ------------------------------------------------------------------------------
export interface RoadsideIncidentRecord {
  id: string;
  date: string;
  incident_type: 'PUNCTURE_TIRE' | 'KANJO_POLICE_FINE' | 'BREAKDOWN_TOW' | 'EMERGENCY_RESCUE' | 'OTHER';
  title: string;
  amount: number;
  location?: string;
  bike_plate?: string;
  account_id?: string;
  notes?: string;
}

export function getRoadsideIncidents(c: any): RoadsideIncidentRecord[] {
  try {
    const raw = getCookie(c, 'finatrack_roadside_incidents') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function saveRoadsideIncidentsCookie(c: any, list: RoadsideIncidentRecord[]): void {
  try {
    const trimmed = (list || []).slice(0, 40);
    setCookie(c, 'finatrack_roadside_incidents', encodeURIComponent(JSON.stringify(trimmed)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

riderRoutes.post('/rider/incidents/create', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();

  const incident_type = (String(body['incident_type'] || 'PUNCTURE_TIRE').toUpperCase() as RoadsideIncidentRecord['incident_type']);
  const title = String(body['title'] || 'Roadside Incident / Repair').trim();
  const amount = Math.max(0, parseFloat(String(body['amount'] || '0')) || 0);
  const date = String(body['date'] || new Date().toISOString().slice(0, 10));
  const location = String(body['location'] || '').trim();
  const bike_plate = String(body['bike_plate'] || '').trim();
  const account_id = String(body['account_id'] || '').trim();
  const notes = String(body['notes'] || '').trim();

  if (!title || amount <= 0) {
    return c.redirect('/rider?toast=Please+enter+incident+description+and+valid+amount#roadside-incidents-card', 303);
  }

  const newRecord: RoadsideIncidentRecord = {
    id: 'inc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
    date,
    incident_type,
    title,
    amount,
    location,
    bike_plate,
    account_id: account_id || undefined,
    notes,
  };

  const current = getRoadsideIncidents(c);
  saveRoadsideIncidentsCookie(c, [newRecord, ...current]);

  // Optional Account Deduction & Ledger Sync
  if (account_id && amount > 0) {
    try {
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', account_id).single();
      if (acc) {
        const newBal = toDecimal(acc.balance).minus(amount).toNumber();
        await supabase.from('accounts').update({ balance: newBal }).eq('id', account_id);
      }
      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id,
        transaction_type: 'EXPENSE',
        category: incident_type === 'KANJO_POLICE_FINE' ? 'Fines & Road Compliance' : 'Bike Maintenance & Repairs',
        amount,
        date,
        description: `Roadside Leak (${incident_type.replace(/_/g, ' ')}): ${title}${location ? ` @ ${location}` : ''}`,
      });
    } catch (e) {}
  }

  return c.redirect(`/rider?toast=${encodeURIComponent(`🚨 Logged roadside leak: ${title} (Ksh ${amount.toLocaleString()})`)}#roadside-incidents-card`, 303);
});

riderRoutes.post('/rider/incidents/delete/:id', async (c) => {
  const id = c.req.param('id');
  const updated = getRoadsideIncidents(c).filter((inc) => String(inc.id) !== String(id));
  saveRoadsideIncidentsCookie(c, updated);
  return c.redirect('/rider?toast=Roadside+incident+record+removed#roadside-incidents-card', 303);
});



