import { Hono } from 'hono';
import { AppEnv, getSupabaseClient } from '../db/supabase';
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

// ------------------------------------------------------------------------------
// TIME INTELLIGENCE HELPERS
// ------------------------------------------------------------------------------
export function classifyShiftWindow(startTime?: string | null, endTime?: string | null): { windowKey: string; windowLabel: string; windowIcon: string } {
  const startMins = parseTimeToMinutes(startTime);
  if (startMins === null) {
    return { windowKey: 'MIDDAY', windowLabel: 'Midday & Afternoon (11:00 – 16:00)', windowIcon: '☀️' };
  }

  const h = Math.floor(startMins / 60);
  if (h >= 5 && h < 11) {
    return { windowKey: 'MORNING', windowLabel: 'Early Morning Rush (05:00 – 11:00)', windowIcon: '🌅' };
  } else if (h >= 11 && h < 16) {
    return { windowKey: 'MIDDAY', windowLabel: 'Midday & Lunch (11:00 – 16:00)', windowIcon: '☀️' };
  } else if (h >= 16 && h < 21) {
    return { windowKey: 'EVENING', windowLabel: 'Evening Rush (16:00 – 21:00)', windowIcon: '🌆' };
  } else {
    return { windowKey: 'NIGHT', windowLabel: 'Late Night / Graveyard (21:00 – 05:00)', windowIcon: '🌙' };
  }
}

// ------------------------------------------------------------------------------
// SHIFT LOGS CRUD
// ------------------------------------------------------------------------------
riderRoutes.post('/rider/logs', async (c) => {
  const body = await c.req.parseBody();
  const bikeId = body['bike_id'] ? String(body['bike_id']) : null;
  const powerType = String(body['power_type'] || 'PETROL').toUpperCase();
  const logDate = String(body['date'] || new Date().toISOString().slice(0, 10));
  const startTime = body['start_time'] ? String(body['start_time']).trim() : null;
  const endTime = body['end_time'] ? String(body['end_time']).trim() : null;

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

  const cookie = c.req.header('cookie') || '';
  const currencyPref = cookie.includes('finatrack_currency=USD') ? 'USD' : 'Ksh';
  const liveRate = getExchangeRate();

  const toUsd = (val: number) => (currencyPref === 'Ksh' ? toDecimal(val).dividedBy(liveRate).toNumber() : val);

  const totalEarnedUsd = toUsd(rawEarned);
  const fuelCostUsd = toUsd(rawFuelCost);
  const foodSpentUsd = toUsd(rawFood);
  const maintCostUsd = toUsd(rawMaint);
  const airtimeSpentUsd = toUsd(rawAirtime);
  const miscExpensesUsd = toUsd(rawMisc);

  const totalExpensesUsd = toDecimal(fuelCostUsd)
    .plus(foodSpentUsd)
    .plus(maintCostUsd)
    .plus(airtimeSpentUsd)
    .plus(miscExpensesUsd)
    .toNumber();

  const supabase = getSupabaseClient(c.env);
  const { data: newLog } = await supabase.from('rider_logs').insert({
    bike_id: bikeId,
    power_type: powerType,
    date: logDate,
    start_time: startTime,
    end_time: endTime,
    shift_hours: shiftHours,
    trips_completed: trips,
    kilometers: km,
    total_earned: totalEarnedUsd,
    fuel_station: fuelStation,
    fuel_litres: fuelLitres,
    swaps_count: swapsCount,
    fuel_cost: fuelCostUsd,
    food_spent: foodSpentUsd,
    airtime_spent: airtimeSpentUsd,
    maintenance_cost: maintCostUsd,
    misc_expenses: miscExpensesUsd,
    earnings_account_id: earningsAccId,
    expense_account_id: expenseAccId,
  }).select().single();

  // Automatic Finance Ledger Integration
  if (newLog) {
    if (earningsAccId && totalEarnedUsd > 0) {
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', earningsAccId).single();
      if (acc) {
        await supabase.from('accounts').update({ balance: toDecimal(acc.balance).plus(totalEarnedUsd).toNumber() }).eq('id', earningsAccId);
        await supabase.from('transactions').insert({
          account_id: earningsAccId,
          transaction_type: 'INCOME',
          category: 'Rider Revenue',
          amount: totalEarnedUsd,
          description: `Rider Shift Income (${logDate} • ${shiftHours}h shift)`,
          rider_log_id: newLog.id,
          date: logDate,
        });
      }
    }

    if (expenseAccId && totalExpensesUsd > 0) {
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', expenseAccId).single();
      if (acc) {
        await supabase.from('accounts').update({ balance: toDecimal(acc.balance).minus(totalExpensesUsd).toNumber() }).eq('id', expenseAccId);
        const energyLabel = powerType === 'ELECTRIC' ? `${fuelStation} Battery Swap` : `${fuelStation} Fuel`;
        await supabase.from('transactions').insert({
          account_id: expenseAccId,
          transaction_type: 'EXPENSE',
          category: powerType === 'ELECTRIC' ? 'EV Battery Swap & Upkeep' : 'Rider Shift Upkeep',
          amount: totalExpensesUsd,
          description: `Rider Shift Expenses (${energyLabel}, Lunch & Upkeep)`,
          rider_log_id: newLog.id,
          date: logDate,
        });
      }
    }
  }

  return c.redirect('/rider?toast=Shift+log+saved+and+synced+with+finance+ledger', 303);
});

riderRoutes.post('/rider/logs/delete/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env);
  await supabase.from('transactions').delete().eq('rider_log_id', id);
  await supabase.from('rider_logs').delete().eq('id', id);
  return c.redirect('/rider?toast=Shift+log+removed', 303);
});

// ------------------------------------------------------------------------------
// MOTORBIKE & EV FLEET CRUD
// ------------------------------------------------------------------------------
riderRoutes.post('/bikes/create', async (c) => {
  const body = await c.req.parseBody();
  const plate = String(body['plate_number'] || '').trim().toUpperCase();
  if (!plate) {
    return c.redirect('/rider?toast=Please+enter+a+valid+number+plate', 303);
  }

  const model = body['model_name'] ? String(body['model_name']).trim() : 'Boda Boda';
  const owner = body['owner_name'] ? String(body['owner_name']).trim() : 'Dennis';
  const powerType = (String(body['power_type'] || 'PETROL').toUpperCase() === 'ELECTRIC' ? 'ELECTRIC' : 'PETROL') as 'PETROL' | 'ELECTRIC';
  const rawTarget = parseFloat(String(body['daily_target'] || '2500.0')) || 2500.0;

  const cookie = c.req.header('cookie') || '';
  const currencyPref = cookie.includes('finatrack_currency=USD') ? 'USD' : 'Ksh';
  const liveRate = getExchangeRate();

  const targetUsd = currencyPref === 'Ksh'
    ? toDecimal(rawTarget).dividedBy(liveRate).toDecimalPlaces(2).toNumber()
    : rawTarget;

  const supabase = getSupabaseClient(c.env);
  
  // Deactivate all other bikes so the newly registered vehicle becomes active
  await supabase.from('bikes').update({ is_active: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
  
  const { data: newBike, error } = await supabase.from('bikes').insert({
    plate_number: plate,
    model_name: model,
    owner_name: owner,
    power_type: powerType,
    daily_target: targetUsd,
    is_active: 1,
  }).select().single();

  const typeLabel = powerType === 'ELECTRIC' ? 'Electric+EV' : 'Motorbike';
  return c.redirect(`/rider?toast=${typeLabel}+[${plate}]+registered+to+fleet!`, 303);
});

riderRoutes.post('/bikes/activate/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env);
  await supabase.from('bikes').update({ is_active: 0 }).neq('id', id);
  await supabase.from('bikes').update({ is_active: 1 }).eq('id', id);
  return c.redirect('/rider?toast=Active+vehicle+switched', 303);
});

riderRoutes.post('/bikes/delete/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env);
  await supabase.from('bikes').delete().eq('id', id);
  
  // If active bike was deleted, activate any remaining bike
  const { data: remaining } = await supabase.from('bikes').select('*').limit(1);
  if (remaining && remaining.length > 0) {
    await supabase.from('bikes').update({ is_active: 1 }).eq('id', remaining[0].id);
  }
  return c.redirect('/rider?toast=Vehicle+removed+from+fleet', 303);
});

// ------------------------------------------------------------------------------
// MAINTENANCE & COMPLIANCE
// ------------------------------------------------------------------------------
riderRoutes.post('/rider/maintenance/service/:id', async (c) => {
  const id = c.req.param('id');
  const today = new Date();
  const nextDate = new Date(today.getTime() + 21 * 86400000); // 3 weeks

  const supabase = getSupabaseClient(c.env);
  await supabase.from('maintenance_schedules').update({
    last_service_date: today.toISOString().slice(0, 10),
    next_due_date: nextDate.toISOString().slice(0, 10),
    last_brake_pad_date: today.toISOString().slice(0, 10),
  }).eq('id', id);

  return c.redirect('/rider?toast=Service+logged+and+interval+reset', 303);
});

riderRoutes.post('/rider/compliance/renew/:id', async (c) => {
  const id = c.req.param('id');
  const today = new Date();
  const nextYear = new Date(today.getTime() + 365 * 86400000);

  const supabase = getSupabaseClient(c.env);
  await supabase.from('compliance_deadlines').update({
    last_renewed_date: today.toISOString().slice(0, 10),
    expiry_date: nextYear.toISOString().slice(0, 10),
  }).eq('id', id);

  return c.redirect('/rider?toast=Compliance+deadline+renewed', 303);
});
