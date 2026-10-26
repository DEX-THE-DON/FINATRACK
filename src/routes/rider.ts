import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { AppEnv, getRequestContext } from '../db/supabase';
import {
  toDecimal,
  calculateShiftHours,
  parseTimeToMinutes,
  formatMoney
} from '../utils/math';
import { Decimal } from 'decimal.js';

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

  let baseOdo = 10000;
  let lastServiceOdo = 10000;
  let intervalKm = 3000;

  try {
    const raw = getCookie(c, 'finatrack_odometer_config') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (typeof parsed.last_service_odo === 'number' && !isNaN(parsed.last_service_odo)) {
        lastServiceOdo = parsed.last_service_odo;
      }
      if (typeof parsed.base_odometer === 'number' && !isNaN(parsed.base_odometer)) {
        baseOdo = parsed.base_odometer;
      } else {
        baseOdo = lastServiceOdo;
      }
      if (typeof parsed.service_interval_km === 'number' && parsed.service_interval_km > 0) {
        intervalKm = parsed.service_interval_km;
      }
    }
  } catch (e) {}

  const currentOdometer = Math.round((baseOdo + totalShiftKm) * 10) / 10;

  return {
    base_odometer: baseOdo,
    last_service_odo: lastServiceOdo,
    service_interval_km: intervalKm,
    current_odometer: currentOdometer,
    total_shift_km: totalShiftKm,
  };
}

export function saveOdometerConfigCookie(
  c: any,
  config: { base_odometer: number; last_service_odo: number; service_interval_km: number }
): void {
  try {
    setCookie(c, 'finatrack_odometer_config', encodeURIComponent(JSON.stringify(config)), {
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
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const bikeId = body['bike_id'] ? String(body['bike_id']) : null;
  const powerType = String(body['power_type'] || 'PETROL').toUpperCase();
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

  const earningsAccId = body['earnings_account_id'] ? String(body['earnings_account_id']) : null;
  const expenseAccId = body['expense_account_id'] ? String(body['expense_account_id']) : null;
  const channel = body['channel'] ? String(body['channel']).trim() : 'ALL';

  // Optional Platform Split & Cash-in-Hand vs App Wallet Reconciliation
  const uberEarned = Math.max(0, parseFloat(String(body['uber_earned'] || '0')) || 0);
  const boltEarned = Math.max(0, parseFloat(String(body['bolt_earned'] || '0')) || 0);
  const littleEarned = Math.max(0, parseFloat(String(body['little_earned'] || '0')) || 0);
  const directCashEarned = Math.max(0, parseFloat(String(body['direct_cash_earned'] || '0')) || 0);
  const platformSum = uberEarned + boltEarned + littleEarned + directCashEarned;

  const totalEarnedKes = rawEarned > 0 ? rawEarned : platformSum;
  const rawCashInHand = parseFloat(String(body['cash_in_hand'] || '0')) || 0;
  const rawAppWallet = parseFloat(String(body['app_wallet_balance'] || '0')) || 0;
  const cashInHandKes = rawCashInHand > 0 || rawAppWallet > 0 ? rawCashInHand : totalEarnedKes;
  const appWalletKes = rawAppWallet > 0 ? rawAppWallet : Math.max(0, totalEarnedKes - cashInHandKes);

  const platformMeta = {
    channel,
    uber_earned: uberEarned,
    bolt_earned: boltEarned,
    little_earned: littleEarned,
    direct_cash_earned: directCashEarned,
    cash_in_hand: cashInHandKes,
    app_wallet_balance: appWalletKes,
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

  // Automatic Finance Ledger Integration (Sync Income AND Expenses)
  if (primaryLogId) {
    const targetAccId = earningsAccId || expenseAccId || null;
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
        description: `Fleet & Ride-Hail Gross Revenue${channelTag} (${logDate} • ${shiftHours}h shift${parsedStints.length > 1 ? ` • ${parsedStints.length} stints` : ''})`,
        rider_log_id: primaryLogId,
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
        description: `Rider Shift: ${energyLabel}`,
        rider_log_id: primaryLogId,
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
        description: `Rider Shift: Food & Lunch (${logDate})`,
        rider_log_id: primaryLogId,
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
        description: `Rider Shift: Airtime & Delivery App Data (${logDate})`,
        rider_log_id: primaryLogId,
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
        description: `Rider Shift: Bike Maintenance & Spares (${logDate})`,
        rider_log_id: primaryLogId,
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
        description: `Rider Shift: Parking, Puncture & Daily Upkeep (${logDate})`,
        rider_log_id: primaryLogId,
        date: logDate,
      });
    }

    if (txInserts.length > 0) {
      try {
        await supabase.from('transactions').insert(txInserts);
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
      }
    }
  }

  const strictCfg = getStrictSaverConfig(c);
  const shiftNet = totalEarnedKes - totalExpensesKes;
  const lunchSavedBonus = strictCfg.save_unspent_lunch ? Math.max(0, strictCfg.lunch_allowance_kes - foodSpentKes) : 0;
  const strictRequiredToday = strictCfg.net_floor_kes + lunchSavedBonus;
  const totalShiftsSaved = savedCookieLogs.reduce((acc: number, l: any) => {
    const exp = Number(l.fuel_cost || 0) + Number(l.food_spent || 0) + Number(l.airtime_spent || 0) + Number(l.misc_expenses || 0) + Number(l.maintenance_cost || 0);
    return acc + Math.max(0, Number(l.total_earned || 0) - exp);
  }, 0);
  const expectedAccBalance = strictCfg.starting_savings_balance + totalShiftsSaved;
  const accLabel = strictCfg.savings_account_name || 'Savings Account';
  const kmToastMsg = km > 0 ? ` (+${km} km Odo)` : '';

  let strictToastMsg = '';
  if (shiftNet >= strictRequiredToday) {
    const extraProfit = shiftNet - strictRequiredToday;
    strictToastMsg = `🎉 Congrats! You saved Ksh ${shiftNet.toLocaleString()} today (Ksh ${strictCfg.net_floor_kes.toLocaleString()} Target${lunchSavedBonus > 0 ? ` + Ksh ${lunchSavedBonus.toLocaleString()} Home-Lunch Saved` : ''}${extraProfit > 0 ? ` + Ksh ${extraProfit.toLocaleString()} Extra Profit` : ''})! Your ${accLabel} should now read Ksh ${expectedAccBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${kmToastMsg}`;
  } else {
    const overdueAmt = strictRequiredToday - Math.max(0, shiftNet);
    strictToastMsg = `💪 Let's catch up! You have an overdue of Ksh ${overdueAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Saved Ksh ${Math.max(0, shiftNet).toLocaleString()} vs Ksh ${strictRequiredToday.toLocaleString()} strict target). Your ${accLabel} should now read Ksh ${expectedAccBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${kmToastMsg}`;
  }

  return c.redirect(`/rider?toast=${encodeURIComponent(strictToastMsg)}#shift-briefing-card`, 303);
});

riderRoutes.post('/rider/logs/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  try {
    await supabase.from('transactions').delete().eq('rider_log_id', id);
    await supabase.from('rider_logs').delete().eq('id', id);
  } catch (e) {}
  const remainingLogs = getSavedRiderLogs(c).filter((l: any) => String(l.id) !== String(id));
  saveRiderLogsCookie(c, remainingLogs);
  return c.redirect('/rider?toast=Shift+log+removed', 303);
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
  const bikeId = body['bike_id'] ? String(body['bike_id']).trim() : '';

  if (savingsAccountId) {
    try {
      const { data: acc } = await supabase.from('accounts').select('name').eq('id', savingsAccountId).single();
      if (acc && acc.name) savingsAccountName = acc.name;
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
    starting_savings_balance: startingSavingsBalance,
  });

  try {
    if (bikeId) {
      await supabase.from('bikes').update({ daily_target: netFloorKes }).eq('id', bikeId);
    } else if (userId) {
      await supabase.from('bikes').update({ daily_target: netFloorKes }).eq('user_id', userId).eq('is_active', 1);
    }
  } catch (e) {}

  const reqGross = netFloorKes + fuelAllowanceKes + personalCapKes + dailyKodiKes;
  return c.redirect(
    `/rider?toast=${encodeURIComponent(`Strict Saver Contract locked! Net Target: Ksh ${netFloorKes.toLocaleString()} • Fuel: Ksh ${fuelAllowanceKes.toLocaleString()} • Lunch: Ksh ${lunchAllowanceKes.toLocaleString()} • Airtime: Ksh ${airtimeAllowanceKes.toLocaleString()} • Required Gross: Ksh ${reqGross.toLocaleString()}`)}#shift-briefing-card`,
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
  const lastServiceOdo = parseFloat(String(body['last_service_odo'] || '10000')) || 10000;
  const intervalKm = parseFloat(String(body['service_interval_km'] || '3000')) || 3000;
  const totalShiftKm = parseFloat(String(body['total_shift_km'] || '0')) || 0;
  const syncMode = String(body['sync_mode'] || '');

  let currentOdo = parseFloat(String(body['current_odometer'] || '0')) || 0;
  let baseOdo = lastServiceOdo;

  if (syncMode === 'FROM_SERVICE' || currentOdo <= 0) {
    baseOdo = lastServiceOdo;
    currentOdo = Math.round((lastServiceOdo + totalShiftKm) * 10) / 10;
  } else {
    baseOdo = Math.round((currentOdo - totalShiftKm) * 10) / 10;
  }

  saveOdometerConfigCookie(c, {
    base_odometer: baseOdo,
    last_service_odo: lastServiceOdo,
    service_interval_km: intervalKm,
  });

  return c.redirect(`/rider?toast=${encodeURIComponent(`Odometer synced at ${currentOdo.toLocaleString()} km (Next service at ${(lastServiceOdo + intervalKm).toLocaleString()} km)`)}`, 303);
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
    const totalShiftKm = parseFloat(String(body['total_shift_km'] || '0')) || 0;
    saveOdometerConfigCookie(c, {
      base_odometer: Math.round((serviceOdometer - totalShiftKm) * 10) / 10,
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



