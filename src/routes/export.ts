import { Hono } from 'hono';
import { AppEnv, getRequestContext } from '../db/supabase';

export const exportRoutes = new Hono<{ Bindings: AppEnv }>();

exportRoutes.get('/finance/export/csv', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  let txQuery = supabase.from('transactions').select('*').order('date', { ascending: false });
  let accQuery = supabase.from('accounts').select('id, name');
  if (userId) {
    txQuery = txQuery.eq('user_id', userId);
    accQuery = accQuery.eq('user_id', userId);
  } else {
    return c.text('Please log in to export your financial data.', 401);
  }

  const { data: txs } = await txQuery;
  const { data: accounts } = await accQuery;

  const accMap = new Map((accounts || []).map((a) => [a.id, a.name]));
  const liveRate = 129.0; // Standard USD to KES rate

  let csvContent = 'ID,Date,Account,Type,Category,Amount_KES,Amount_USD,Description\n';

  for (const t of txs || []) {
    const amtKes = Number(t.amount || 0);
    const amtUsd = (amtKes / liveRate).toFixed(2);
    const accName = accMap.get(t.account_id || '') || 'Unknown';
    const dateStr = (t.date || '').slice(0, 10);
    const desc = (t.description || '').replace(/"/g, '""');

    csvContent += `"${t.id}","${dateStr}","${accName}","${t.transaction_type}","${t.category}",${amtKes.toFixed(2)},${amtUsd},"${desc}"\n`;
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return c.text(csvContent, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="Finatrack_Ledger_${today}.csv"`,
  });
});

exportRoutes.get('/rider/export/csv', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  let logQuery = supabase.from('rider_logs').select('*').order('date', { ascending: false });
  let bikeQuery = supabase.from('bikes').select('id, plate_number, model_name');
  if (userId) {
    logQuery = logQuery.eq('user_id', userId);
    bikeQuery = bikeQuery.eq('user_id', userId);
  } else {
    return c.text('Please log in to export your shift logs.', 401);
  }

  const { data: logs } = await logQuery;
  const { data: bikes } = await bikeQuery;

  const bikeMap = new Map((bikes || []).map((b) => [b.id, `${b.plate_number} (${b.model_name || 'Bike'})`]));

  let csvContent = 'ID,Date,Bike,Power_Type,Start_Time,End_Time,Hours,Trips,Distance_Km,Station,Swaps_Count,Fuel_Litres,Energy_Cost_KES,Food_KES,Airtime_KES,Maintenance_KES,Misc_KES,Total_Earned_KES,Total_Expenses_KES,Net_Remittance_KES\n';

  for (const l of logs || []) {
    const bikeStr = bikeMap.get(l.bike_id || '') || 'Default Bike';
    const powerType = l.power_type || 'PETROL';
    const earnedKes = Number(l.total_earned || 0).toFixed(2);
    const fuelKes = Number(l.fuel_cost || 0).toFixed(2);
    const foodKes = Number(l.food_spent || 0).toFixed(2);
    const airtimeKes = Number(l.airtime_spent || 0).toFixed(2);
    const maintKes = Number(l.maintenance_cost || 0).toFixed(2);
    const miscKes = Number(l.misc_expenses || 0).toFixed(2);

    const totalExpKes = (
      Number(fuelKes) +
      Number(foodKes) +
      Number(airtimeKes) +
      Number(maintKes) +
      Number(miscKes)
    ).toFixed(2);

    const netRemitKes = (Number(earnedKes) - Number(totalExpKes)).toFixed(2);

    csvContent += `"${l.id}","${l.date}","${bikeStr}","${powerType}","${l.start_time || ''}","${l.end_time || ''}",${l.shift_hours},${l.trips_completed},${l.kilometers},"${l.fuel_station || (powerType === 'ELECTRIC' ? 'SPIRO' : 'RUBIS')}",${l.swaps_count || 0},${l.fuel_litres || 0},${fuelKes},${foodKes},${airtimeKes},${maintKes},${miscKes},${earnedKes},${totalExpKes},${netRemitKes}\n`;
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return c.text(csvContent, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="Finatrack_Rider_Shifts_${today}.csv"`,
  });
});
