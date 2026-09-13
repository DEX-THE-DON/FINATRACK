import { Hono } from 'hono';
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
  const { supabase, userId } = await getRequestContext(c);
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

  const totalEarnedKes = rawEarned;
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

  let { data: newLog, error } = await supabase.from('rider_logs').insert(insertPayload).select().single();

  if (error && error.code === 'PGRST204') {
    delete insertPayload.power_type;
    delete insertPayload.swaps_count;
    const retryRes = await supabase.from('rider_logs').insert(insertPayload).select().single();
    newLog = retryRes.data;
    error = retryRes.error;
  }

  if (error) {
    console.error('Failed to save shift log:', error);
    return c.redirect(`/rider?toast=${encodeURIComponent('Failed to save shift: ' + error.message)}`, 303);
  }

  // Automatic Finance Ledger Integration (Sync Income AND Expenses)
  if (newLog) {
    const targetAccId = earningsAccId || expenseAccId || null;
    const txInserts: any[] = [];

    // 1. Gross Earnings Income Transaction
    if (totalEarnedKes > 0) {
      txInserts.push({
        ...(userId ? { user_id: userId } : {}),
        account_id: targetAccId,
        transaction_type: 'INCOME',
        category: 'Rider & Boda Deliveries',
        amount: totalEarnedKes,
        description: `Rider Shift Gross Revenue (${logDate} • ${shiftHours}h shift)`,
        rider_log_id: newLog.id,
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
        rider_log_id: newLog.id,
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
        rider_log_id: newLog.id,
        date: logDate,
      });
    }

    // 4. Maintenance / Upkeep Expense Transaction
    const otherUpkeep = toDecimal(maintCostKes).plus(airtimeSpentKes).plus(miscExpensesKes).toNumber();
    if (otherUpkeep > 0) {
      txInserts.push({
        ...(userId ? { user_id: userId } : {}),
        account_id: targetAccId,
        transaction_type: 'EXPENSE',
        category: 'Living Expenses',
        amount: otherUpkeep,
        description: `Rider Shift: Bike Maintenance & Airtime (${logDate})`,
        rider_log_id: newLog.id,
        date: logDate,
      });
    }

    if (txInserts.length > 0) {
      await supabase.from('transactions').insert(txInserts);
    }

    // Update target account balance with net take-home
    if (targetAccId) {
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', targetAccId).single();
      if (acc) {
        const netTakeHome = toDecimal(totalEarnedKes).minus(totalExpensesKes);
        const newBalance = toDecimal(acc.balance).plus(netTakeHome).toNumber();
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', targetAccId);
      }
    }
  }

  return c.redirect('/rider?toast=Shift+log+saved+and+synced+with+finance+ledger', 303);
});

riderRoutes.post('/rider/logs/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  await supabase.from('transactions').delete().eq('rider_log_id', id);
  const { error } = await supabase.from('rider_logs').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete shift log:', error);
    return c.redirect(`/rider?toast=${encodeURIComponent('Failed to delete shift: ' + error.message)}`, 303);
  }
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
  const powerType = (String(body['power_type'] || 'PETROL').toUpperCase() === 'ELECTRIC' ? 'ELECTRIC' : 'PETROL') as 'PETROL' | 'ELECTRIC';
  const targetKes = parseFloat(String(body['daily_target'] || '2500.0')) || 2500.0;

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

  const typeLabel = powerType === 'ELECTRIC' ? 'Electric EV' : 'Motorbike';
  return c.redirect(`/rider?toast=${encodeURIComponent(`${typeLabel} [${plate}] registered to fleet!`)}`, 303);
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
// MAINTENANCE & COMPLIANCE
// ------------------------------------------------------------------------------
riderRoutes.post('/rider/maintenance/log', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const bikeId = body['bike_id'] ? String(body['bike_id']) : null;
  const serviceType = String(body['service_type'] || 'Oil Change & Brake Service').trim();
  const serviceDate = String(body['service_date'] || new Date().toISOString().slice(0, 10));
  const intervalWeeks = parseInt(String(body['interval_weeks'] || '3'), 10) || 3;

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

  // Insert or record in maintenance_schedules
  const insertPayload: any = {
    bike_id: bikeId || null,
    service_type: serviceType,
    interval_weeks: intervalWeeks,
    last_service_date: serviceDate,
    next_due_date: nextDueDate,
    last_brake_pad_date: brakePadCost > 0 ? serviceDate : null,
    brake_pad_cost_last: brakePadCost,
    notes: notes || `Service on ${serviceDate}: Oil (Ksh ${oilCost}), Pads (Ksh ${brakePadCost}), Labor (Ksh ${laborCost})`,
  };
  if (userId) {
    insertPayload.user_id = userId;
  }

  const { error } = await supabase.from('maintenance_schedules').insert(insertPayload);
  if (error) {
    console.error('Failed to log maintenance schedule:', error);
  }

  // Deduct from account & sync to finance ledger if account specified and cost > 0
  if (accountId && finalTotalCost > 0) {
    const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
    if (acc) {
      const newBal = toDecimal(acc.balance).minus(finalTotalCost).toNumber();
      await supabase.from('accounts').update({ balance: newBal }).eq('id', accountId);

      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: accountId,
        transaction_type: 'EXPENSE',
        category: 'Living Expenses',
        amount: finalTotalCost,
        date: serviceDate,
        description: `Bike Service: ${serviceType} (${notes || 'Oil, Brake Pads & Labor'})`,
      });
    }
  }

  return c.redirect('/rider?toast=Maintenance+service+recorded+and+ledger+updated', 303);
});

riderRoutes.post('/rider/maintenance/create', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const serviceType = String(body['service_type'] || 'Oil Change & Inspection').trim();
  const intervalWeeks = parseInt(String(body['interval_weeks'] || '3'), 10) || 3;
  const lastDate = body['last_service_date'] ? String(body['last_service_date']) : new Date().toISOString().slice(0, 10);
  const nextDate = new Date(new Date(lastDate).getTime() + intervalWeeks * 7 * 86400000).toISOString().slice(0, 10);

  const { error } = await supabase.from('maintenance_schedules').insert({
    ...(userId ? { user_id: userId } : {}),
    service_type: serviceType,
    interval_weeks: intervalWeeks,
    last_service_date: lastDate,
    next_due_date: nextDate,
    notes: body['notes'] ? String(body['notes']).trim() : null,
  });

  if (error) {
    return c.redirect(`/rider?toast=${encodeURIComponent('Failed to create schedule: ' + error.message)}`, 303);
  }
  return c.redirect('/rider?toast=Maintenance+schedule+added', 303);
});

riderRoutes.post('/rider/maintenance/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  const { error } = await supabase.from('maintenance_schedules').delete().eq('id', id);
  if (error) {
    return c.redirect(`/rider?toast=${encodeURIComponent('Failed to delete schedule: ' + error.message)}`, 303);
  }
  return c.redirect('/rider?toast=Maintenance+schedule+removed', 303);
});

riderRoutes.post('/rider/compliance/create', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const title = String(body['title'] || 'Motorbike Insurance').trim();
  const expiryDate = body['expiry_date'] ? String(body['expiry_date']) : null;
  const intervalMonths = parseInt(String(body['interval_months'] || '12'), 10) || 12;
  const lastRenewed = body['last_renewed_date'] ? String(body['last_renewed_date']) : new Date().toISOString().slice(0, 10);
  const notes = body['notes'] ? String(body['notes']).trim() : null;

  const { error } = await supabase.from('compliance_deadlines').insert({
    ...(userId ? { user_id: userId } : {}),
    title,
    expiry_date: expiryDate,
    interval_months: intervalMonths,
    last_renewed_date: lastRenewed,
    notes,
  });

  if (error) {
    return c.redirect(`/rider?toast=${encodeURIComponent('Failed to create compliance item: ' + error.message)}`, 303);
  }
  return c.redirect('/rider?toast=Compliance+record+created', 303);
});

riderRoutes.post('/rider/compliance/update/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const expiryDate = body['expiry_date'] ? String(body['expiry_date']) : null;
  const lastRenewed = body['last_renewed_date'] ? String(body['last_renewed_date']) : new Date().toISOString().slice(0, 10);
  const notes = body['notes'] ? String(body['notes']).trim() : null;
  const renewalCost = parseFloat(String(body['renewal_cost'] || '0.0')) || 0.0;
  const accountId = body['account_id'] ? String(body['account_id']).trim() : '';

  const { data: comp, error } = await supabase.from('compliance_deadlines').update({
    expiry_date: expiryDate,
    last_renewed_date: lastRenewed,
    notes,
  }).eq('id', id).select().single();

  if (error) {
    return c.redirect(`/rider?toast=${encodeURIComponent('Failed to update compliance: ' + error.message)}`, 303);
  }

  if (accountId && renewalCost > 0 && comp) {
    const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
    if (acc) {
      const newBal = toDecimal(acc.balance).minus(renewalCost).toNumber();
      await supabase.from('accounts').update({ balance: newBal }).eq('id', accountId);

      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: accountId,
        transaction_type: 'EXPENSE',
        category: 'Utilities & Bills',
        amount: renewalCost,
        date: lastRenewed,
        description: `Compliance Renewal: ${comp.title}`,
      });
    }
  }

  return c.redirect('/rider?toast=Compliance+deadline+updated', 303);
});

riderRoutes.post('/rider/compliance/renew/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  const today = new Date();
  const nextYear = new Date(today.getTime() + 365 * 86400000);

  const { error } = await supabase.from('compliance_deadlines').update({
    last_renewed_date: today.toISOString().slice(0, 10),
    expiry_date: nextYear.toISOString().slice(0, 10),
  }).eq('id', id);

  if (error) {
    return c.redirect(`/rider?toast=${encodeURIComponent('Error updating compliance: ' + error.message)}`, 303);
  }
  return c.redirect('/rider?toast=Compliance+deadline+renewed', 303);
});

riderRoutes.post('/rider/compliance/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  const { error } = await supabase.from('compliance_deadlines').delete().eq('id', id);
  if (error) {
    return c.redirect(`/rider?toast=${encodeURIComponent('Failed to delete: ' + error.message)}`, 303);
  }
  return c.redirect('/rider?toast=Compliance+record+deleted', 303);
});

