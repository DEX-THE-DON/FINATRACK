import { Hono } from 'hono';
import { AppEnv, getSupabaseClient } from '../db/supabase';
import {
  toDecimal,
  calculateMonthlyYield,
  allocateWaterfallSplit,
  calculateBudgetPace,
  formatMoney
} from '../utils/math';
import { parseMultipleMpesaMessages } from '../utils/mpesa';
import { Decimal } from 'decimal.js';

export const financeRoutes = new Hono<{ Bindings: AppEnv }>();

const DEFAULT_USD_KES_RATE = 129.0;

function getExchangeRate(): number {
  return DEFAULT_USD_KES_RATE;
}

// ------------------------------------------------------------------------------
// ACCOUNTS CRUD
// ------------------------------------------------------------------------------
financeRoutes.post('/accounts/create', async (c) => {
  const body = await c.req.parseBody();
  const name = String(body['name'] || '').trim();
  const accountNumber = body['account_number'] ? String(body['account_number']).trim() : null;
  const accountType = String(body['account_type'] || 'BANK');
  const interestRate = parseFloat(String(body['interest_rate_p_a'] || '0.0')) || 0.0;
  const rawBalance = parseFloat(String(body['balance'] || '0.0')) || 0.0;

  const cookie = c.req.header('cookie') || '';
  const currencyPref = cookie.includes('finatrack_currency=USD') ? 'USD' : 'Ksh';
  const liveRate = getExchangeRate();

  const finalBalance = currencyPref === 'Ksh'
    ? toDecimal(rawBalance).dividedBy(liveRate).toDecimalPlaces(2).toNumber()
    : rawBalance;

  const supabase = getSupabaseClient(c.env);
  await supabase.from('accounts').insert({
    name,
    account_number: accountNumber,
    account_type: accountType,
    interest_rate_p_a: interestRate,
    balance: finalBalance,
  });

  return c.redirect('/?toast=Account+created+successfully', 303);
});

financeRoutes.post('/accounts/update/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const name = String(body['name'] || '').trim();
  const accountNumber = body['account_number'] ? String(body['account_number']).trim() : null;
  const accountType = String(body['account_type'] || 'BANK');
  const interestRate = parseFloat(String(body['interest_rate_p_a'] || '0.0')) || 0.0;
  const rawBalance = parseFloat(String(body['balance'] || '0.0')) || 0.0;

  const cookie = c.req.header('cookie') || '';
  const currencyPref = cookie.includes('finatrack_currency=USD') ? 'USD' : 'Ksh';
  const liveRate = getExchangeRate();

  const finalBalance = currencyPref === 'Ksh'
    ? toDecimal(rawBalance).dividedBy(liveRate).toDecimalPlaces(2).toNumber()
    : rawBalance;

  const supabase = getSupabaseClient(c.env);
  await supabase.from('accounts').update({
    name,
    account_number: accountNumber,
    account_type: accountType,
    interest_rate_p_a: interestRate,
    balance: finalBalance,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  return c.redirect('/?toast=Account+updated+successfully', 303);
});

financeRoutes.post('/accounts/delete/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env);

  // Decouple any linked allocation rules or bills
  await supabase.from('allocation_rules').update({ target_id: null }).eq('target_id', id);
  await supabase.from('bills').update({ payment_account_id: null }).eq('payment_account_id', id);

  await supabase.from('accounts').delete().eq('id', id);
  return c.redirect('/?toast=Account+deleted+successfully', 303);
});

financeRoutes.post('/accounts/interest/log/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env);

  const { data: acc } = await supabase.from('accounts').select('*').eq('id', id).single();
  if (acc && acc.interest_rate_p_a > 0 && acc.balance > 0) {
    const monthlyYield = calculateMonthlyYield(acc.balance, acc.interest_rate_p_a).toDecimalPlaces(2);
    const newBal = toDecimal(acc.balance).plus(monthlyYield).toNumber();

    await supabase.from('accounts').update({ balance: newBal }).eq('id', id);
    await supabase.from('transactions').insert({
      account_id: acc.id,
      transaction_type: 'INCOME',
      category: 'Interest & Yield',
      amount: monthlyYield.toNumber(),
      description: `Monthly MMF Interest Yield (${acc.name} @ ${acc.interest_rate_p_a}% p.a.)`,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  return c.redirect('/?toast=Monthly+MMF+yield+credited+successfully', 303);
});

// ------------------------------------------------------------------------------
// QUICK TRANSFERS
// ------------------------------------------------------------------------------
financeRoutes.post('/transfers/create', async (c) => {
  const body = await c.req.parseBody();
  const fromId = String(body['from_account_id'] || '');
  const toId = String(body['to_account_id'] || '');
  const rawAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;

  if (fromId && toId && fromId !== toId && rawAmt > 0) {
    const cookie = c.req.header('cookie') || '';
    const currencyPref = cookie.includes('finatrack_currency=USD') ? 'USD' : 'Ksh';
    const liveRate = getExchangeRate();

    const amtUsd = currencyPref === 'Ksh'
      ? toDecimal(rawAmt).dividedBy(liveRate).toDecimalPlaces(2).toNumber()
      : rawAmt;

    const supabase = getSupabaseClient(c.env);
    const { data: fromAcc } = await supabase.from('accounts').select('*').eq('id', fromId).single();
    const { data: toAcc } = await supabase.from('accounts').select('*').eq('id', toId).single();

    if (fromAcc && toAcc && Number(fromAcc.balance) >= amtUsd) {
      await supabase.from('accounts').update({ balance: toDecimal(fromAcc.balance).minus(amtUsd).toNumber() }).eq('id', fromId);
      await supabase.from('accounts').update({ balance: toDecimal(toAcc.balance).plus(amtUsd).toNumber() }).eq('id', toId);

      const today = new Date().toISOString().slice(0, 10);
      await supabase.from('transactions').insert([
        {
          account_id: fromId,
          transaction_type: 'EXPENSE',
          category: 'Transfer',
          amount: amtUsd,
          description: `Transfer to ${toAcc.name}`,
          date: today,
        },
        {
          account_id: toId,
          transaction_type: 'INCOME',
          category: 'Transfer',
          amount: amtUsd,
          description: `Transfer from ${fromAcc.name}`,
          date: today,
        }
      ]);
    }
  }

  return c.redirect('/?toast=Funds+transferred+successfully', 303);
});

// ------------------------------------------------------------------------------
// TRANSACTIONS CRUD
// ------------------------------------------------------------------------------
financeRoutes.post('/transactions/create', async (c) => {
  const body = await c.req.parseBody();
  const accountId = String(body['account_id'] || '');
  const txType = String(body['transaction_type'] || 'EXPENSE').toUpperCase();
  const category = String(body['category'] || 'General').trim();
  const rawAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;
  const tDate = String(body['t_date'] || new Date().toISOString().slice(0, 10));
  const description = body['description'] ? String(body['description']).trim() : null;

  const cookie = c.req.header('cookie') || '';
  const currencyPref = cookie.includes('finatrack_currency=USD') ? 'USD' : 'Ksh';
  const liveRate = getExchangeRate();

  const amtUsd = currencyPref === 'Ksh'
    ? toDecimal(rawAmt).dividedBy(liveRate).toDecimalPlaces(2).toNumber()
    : rawAmt;

  const supabase = getSupabaseClient(c.env);
  await supabase.from('transactions').insert({
    account_id: accountId || null,
    transaction_type: txType,
    category,
    amount: amtUsd,
    date: tDate,
    description,
  });

  // Update account balance
  if (accountId) {
    const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
    if (acc) {
      const curBal = toDecimal(acc.balance);
      const newBal = txType === 'INCOME' ? curBal.plus(amtUsd) : curBal.minus(amtUsd);
      await supabase.from('accounts').update({ balance: newBal.toNumber() }).eq('id', accountId);
    }
  }

  return c.redirect('/?toast=Transaction+saved+successfully', 303);
});

financeRoutes.post('/transactions/delete/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env);
  await supabase.from('transactions').delete().eq('id', id);
  return c.redirect('/?toast=Transaction+deleted', 303);
});

// ------------------------------------------------------------------------------
// BUDGETS
// ------------------------------------------------------------------------------
financeRoutes.post('/budgets/create', async (c) => {
  const body = await c.req.parseBody();
  const category = String(body['category'] || '').trim();
  const rawLimit = parseFloat(String(body['limit_amount'] || '0.0')) || 0.0;

  const cookie = c.req.header('cookie') || '';
  const currencyPref = cookie.includes('finatrack_currency=USD') ? 'USD' : 'Ksh';
  const liveRate = getExchangeRate();

  const limitUsd = currencyPref === 'Ksh'
    ? toDecimal(rawLimit).dividedBy(liveRate).toDecimalPlaces(2).toNumber()
    : rawLimit;

  const supabase = getSupabaseClient(c.env);
  await supabase.from('budgets').upsert({
    category,
    limit_amount: limitUsd,
  }, { onConflict: 'user_id, category' });

  return c.redirect('/?toast=Budget+saved+successfully', 303);
});

financeRoutes.post('/budgets/delete/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env);
  await supabase.from('budgets').delete().eq('id', id);
  return c.redirect('/?toast=Budget+category+removed', 303);
});

// ------------------------------------------------------------------------------
// SAVINGS GOALS
// ------------------------------------------------------------------------------
financeRoutes.post('/goals/create', async (c) => {
  const body = await c.req.parseBody();
  const title = String(body['title'] || '').trim();
  const rawTarget = parseFloat(String(body['target_amount'] || '0.0')) || 0.0;
  const targetDate = body['target_date'] ? String(body['target_date']) : null;
  const addToSplit = body['add_to_split'] === '1' || body['add_to_split'] === 'on';

  const cookie = c.req.header('cookie') || '';
  const currencyPref = cookie.includes('finatrack_currency=USD') ? 'USD' : 'Ksh';
  const liveRate = getExchangeRate();

  const targetUsd = currencyPref === 'Ksh'
    ? toDecimal(rawTarget).dividedBy(liveRate).toDecimalPlaces(2).toNumber()
    : rawTarget;

  const supabase = getSupabaseClient(c.env);
  const { data: goal } = await supabase.from('goals').insert({
    title,
    target_amount: targetUsd,
    current_amount: 0.00,
    target_date: targetDate,
  }).select().single();

  if (goal && addToSplit) {
    await supabase.from('allocation_rules').insert({
      bucket_name: title,
      target_type: 'GOAL',
      target_id: goal.id,
      percentage: 10.0,
      icon: '🎯',
      is_active: 1,
    });
  }

  return c.redirect('/?toast=Goal+created+successfully', 303);
});

financeRoutes.post('/goals/fund/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const rawAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;

  const cookie = c.req.header('cookie') || '';
  const currencyPref = cookie.includes('finatrack_currency=USD') ? 'USD' : 'Ksh';
  const liveRate = getExchangeRate();

  const amtUsd = currencyPref === 'Ksh'
    ? toDecimal(rawAmt).dividedBy(liveRate).toDecimalPlaces(2).toNumber()
    : rawAmt;

  const supabase = getSupabaseClient(c.env);
  const { data: goal } = await supabase.from('goals').select('*').eq('id', id).single();
  if (goal) {
    const newAmt = toDecimal(goal.current_amount).plus(amtUsd).toNumber();
    await supabase.from('goals').update({ current_amount: newAmt }).eq('id', id);
  }

  return c.redirect('/?toast=Funds+deposited+to+goal', 303);
});

financeRoutes.post('/goals/withdraw/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const rawAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;

  const cookie = c.req.header('cookie') || '';
  const currencyPref = cookie.includes('finatrack_currency=USD') ? 'USD' : 'Ksh';
  const liveRate = getExchangeRate();

  const amtUsd = currencyPref === 'Ksh'
    ? toDecimal(rawAmt).dividedBy(liveRate).toDecimalPlaces(2).toNumber()
    : rawAmt;

  const supabase = getSupabaseClient(c.env);
  const { data: goal } = await supabase.from('goals').select('*').eq('id', id).single();
  if (goal) {
    const newAmt = Decimal.max(0, toDecimal(goal.current_amount).minus(amtUsd)).toNumber();
    await supabase.from('goals').update({ current_amount: newAmt }).eq('id', id);
  }

  return c.redirect('/?toast=Funds+withdrawn+from+goal', 303);
});

financeRoutes.post('/goals/delete/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env);
  await supabase.from('allocation_rules').delete().eq('target_id', id);
  await supabase.from('goals').delete().eq('id', id);
  return c.redirect('/?toast=Goal+deleted', 303);
});

// ------------------------------------------------------------------------------
// DEBTS & LOANS
// ------------------------------------------------------------------------------
financeRoutes.post('/debts/create', async (c) => {
  const body = await c.req.parseBody();
  const personName = String(body['person_name'] || '').trim();
  const debtType = String(body['debt_type'] || 'I_OWE');
  const rawTotal = parseFloat(String(body['total_amount'] || '0.0')) || 0.0;
  const issuedAt = String(body['issued_at'] || new Date().toISOString());
  const dueAt = String(body['due_at'] || new Date(Date.now() + 30 * 86400000).toISOString());
  const description = body['description'] ? String(body['description']).trim() : null;

  const cookie = c.req.header('cookie') || '';
  const currencyPref = cookie.includes('finatrack_currency=USD') ? 'USD' : 'Ksh';
  const liveRate = getExchangeRate();

  const totalUsd = currencyPref === 'Ksh'
    ? toDecimal(rawTotal).dividedBy(liveRate).toDecimalPlaces(2).toNumber()
    : rawTotal;

  const supabase = getSupabaseClient(c.env);
  await supabase.from('debts').insert({
    person_name: personName,
    debt_type: debtType,
    total_amount: totalUsd,
    paid_amount: 0.00,
    issued_at: issuedAt,
    due_at: dueAt,
    status: 'ACTIVE',
    description,
  });

  return c.redirect('/?toast=Debt+record+saved', 303);
});

financeRoutes.post('/debts/repay/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const rawAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;

  const cookie = c.req.header('cookie') || '';
  const currencyPref = cookie.includes('finatrack_currency=USD') ? 'USD' : 'Ksh';
  const liveRate = getExchangeRate();

  const amtUsd = currencyPref === 'Ksh'
    ? toDecimal(rawAmt).dividedBy(liveRate).toDecimalPlaces(2).toNumber()
    : rawAmt;

  const supabase = getSupabaseClient(c.env);
  const { data: debt } = await supabase.from('debts').select('*').eq('id', id).single();
  if (debt) {
    const newPaid = toDecimal(debt.paid_amount).plus(amtUsd).toNumber();
    const isPaid = newPaid >= Number(debt.total_amount);
    await supabase.from('debts').update({
      paid_amount: newPaid,
      status: isPaid ? 'PAID' : debt.status,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
  }

  return c.redirect('/?toast=Debt+payment+recorded', 303);
});

financeRoutes.post('/debts/delete/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env);
  await supabase.from('debts').delete().eq('id', id);
  return c.redirect('/?toast=Debt+record+deleted', 303);
});

// ------------------------------------------------------------------------------
// RECURRING BILLS
// ------------------------------------------------------------------------------
financeRoutes.post('/bills/create', async (c) => {
  const body = await c.req.parseBody();
  const title = String(body['title'] || '').trim();
  const category = String(body['category'] || 'UTILITY').trim();
  const rawAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;
  const dueDay = parseInt(String(body['due_day'] || '1'), 10);
  const paymentAccountId = body['payment_account_id'] ? String(body['payment_account_id']) : null;
  const notes = body['notes'] ? String(body['notes']).trim() : null;

  const cookie = c.req.header('cookie') || '';
  const currencyPref = cookie.includes('finatrack_currency=USD') ? 'USD' : 'Ksh';
  const liveRate = getExchangeRate();

  const amtUsd = currencyPref === 'Ksh'
    ? toDecimal(rawAmt).dividedBy(liveRate).toDecimalPlaces(2).toNumber()
    : rawAmt;

  const supabase = getSupabaseClient(c.env);
  await supabase.from('bills').insert({
    title,
    category,
    amount: amtUsd,
    due_day: dueDay,
    payment_account_id: paymentAccountId,
    is_recurring: 1,
    notes,
  });

  return c.redirect('/?toast=Recurring+bill+added+successfully', 303);
});

financeRoutes.post('/bills/pay/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const paymentAccountId = body['payment_account_id'] ? String(body['payment_account_id']) : null;

  const supabase = getSupabaseClient(c.env);
  const { data: bill } = await supabase.from('bills').select('*').eq('id', id).single();
  if (bill) {
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from('bills').update({ last_paid_date: today }).eq('id', id);

    const accId = paymentAccountId || bill.payment_account_id;
    if (accId) {
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', accId).single();
      if (acc) {
        const newBal = toDecimal(acc.balance).minus(bill.amount).toNumber();
        await supabase.from('accounts').update({ balance: newBal }).eq('id', accId);
        await supabase.from('transactions').insert({
          account_id: accId,
          transaction_type: 'EXPENSE',
          category: `Utility: ${bill.category}`,
          amount: bill.amount,
          description: `Bill Payment: ${bill.title}`,
          date: today,
        });
      }
    }
  }

  return c.redirect('/?toast=Bill+paid+and+expense+recorded', 303);
});

financeRoutes.post('/bills/delete/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c.env);
  await supabase.from('bills').delete().eq('id', id);
  return c.redirect('/?toast=Bill+removed', 303);
});

// ------------------------------------------------------------------------------
// DYNAMIC WATERFALL AUTO-SPLIT EXECUTION
// ------------------------------------------------------------------------------
financeRoutes.post('/split/distribute', async (c) => {
  const body = await c.req.parseBody();
  const rawAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;
  const sourceAccountId = body['source_account_id'] ? String(body['source_account_id']) : null;

  if (rawAmt <= 0) return c.redirect('/?toast=Please+enter+a+valid+amount', 303);

  const cookie = c.req.header('cookie') || '';
  const currencyPref = cookie.includes('finatrack_currency=USD') ? 'USD' : 'Ksh';
  const liveRate = getExchangeRate();

  const totalUsd = currencyPref === 'Ksh'
    ? toDecimal(rawAmt).dividedBy(liveRate).toDecimalPlaces(2).toNumber()
    : rawAmt;

  const supabase = getSupabaseClient(c.env);
  const { data: rules } = await supabase.from('allocation_rules').select('*').eq('is_active', 1);

  if (rules && rules.length > 0) {
    const splitResults = allocateWaterfallSplit(
      totalUsd,
      rules.map((r) => ({
        id: r.id,
        bucket_name: r.bucket_name,
        target_type: r.target_type,
        target_id: r.target_id,
        percentage: Number(r.percentage),
      }))
    );

    const today = new Date().toISOString().slice(0, 10);

    for (const res of splitResults) {
      const splitAmt = parseFloat(res.allocated_amount);
      if (splitAmt <= 0) continue;

      if (res.target_type === 'ACCOUNT' && res.target_id) {
        const { data: acc } = await supabase.from('accounts').select('*').eq('id', res.target_id).single();
        if (acc) {
          const newBal = toDecimal(acc.balance).plus(splitAmt).toNumber();
          await supabase.from('accounts').update({ balance: newBal }).eq('id', res.target_id);
          await supabase.from('transactions').insert({
            account_id: res.target_id,
            transaction_type: 'INCOME',
            category: 'Auto-Split Deposit',
            amount: splitAmt,
            description: `Auto-Split Allocation: ${res.bucket_name} (${res.percentage}%)`,
            date: today,
          });
        }
      } else if (res.target_type === 'GOAL' && res.target_id) {
        const { data: goal } = await supabase.from('goals').select('*').eq('id', res.target_id).single();
        if (goal) {
          const newAmt = toDecimal(goal.current_amount).plus(splitAmt).toNumber();
          await supabase.from('goals').update({ current_amount: newAmt }).eq('id', res.target_id);
        }
      }
    }
  }

  return c.redirect('/?toast=Income+successfully+distributed+via+Waterfall+Split!', 303);
});

// ------------------------------------------------------------------------------
// ALLOCATION RULES UPDATE
// ------------------------------------------------------------------------------
financeRoutes.post('/rules/update', async (c) => {
  const body = await c.req.parseBody();
  const supabase = getSupabaseClient(c.env);
  const { data: rules } = await supabase.from('allocation_rules').select('*');

  if (rules) {
    for (const r of rules) {
      const fieldName = `percentage_${r.id}`;
      if (body[fieldName] !== undefined) {
        const pct = parseFloat(String(body[fieldName])) || 0.0;
        await supabase.from('allocation_rules').update({ percentage: pct }).eq('id', r.id);
      }
    }
  }

  return c.redirect('/?toast=Split+rules+updated+successfully', 303);
});

// ------------------------------------------------------------------------------
// SYSTEM DATA RESET (CLEAN SLATE)
// ------------------------------------------------------------------------------
financeRoutes.post('/system/reset-data', async (c) => {
  const supabase = getSupabaseClient(c.env);
  
  await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('rider_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('debts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('budgets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('goals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('bills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('maintenance_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('compliance_deadlines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('bike_financings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('allocation_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('bikes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  return c.redirect('/?toast=All+data+cleared!+Ready+for+real+data.', 303);
});

// ------------------------------------------------------------------------------
// M-PESA BATCH SMS PARSING & IMPORT
// ------------------------------------------------------------------------------
financeRoutes.post('/finance/mpesa/parse', async (c) => {
  const body = await c.req.parseBody();
  const rawText = String(body['raw_sms'] || '');
  const parsed = parseMultipleMpesaMessages(rawText);
  return c.json({ success: true, count: parsed.length, transactions: parsed });
});

financeRoutes.post('/finance/mpesa/import', async (c) => {
  const body = await c.req.parseBody();
  const accountId = String(body['account_id'] || '');
  const rawText = String(body['raw_sms'] || '');
  const liveRate = getExchangeRate();

  if (!accountId) {
    return c.redirect('/?toast=Please+select+an+account+to+import+into', 303);
  }

  const parsedList = parseMultipleMpesaMessages(rawText);
  if (parsedList.length === 0) {
    return c.redirect('/?toast=No+valid+M-Pesa+messages+found+in+the+pasted+text', 303);
  }

  const supabase = getSupabaseClient(c.env);
  const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
  let currentBalanceUsd = acc ? toDecimal(acc.balance) : new Decimal(0);

  let importedCount = 0;
  for (const t of parsedList) {
    const amountUsd = toDecimal(t.amount_kes).dividedBy(liveRate).toDecimalPlaces(2).toNumber();
    
    await supabase.from('transactions').insert({
      account_id: accountId,
      amount: amountUsd,
      type: t.type,
      category: t.suggested_category,
      description: t.description,
      date: t.date,
    });

    if (t.type === 'INCOME') {
      currentBalanceUsd = currentBalanceUsd.plus(amountUsd);
    } else {
      currentBalanceUsd = currentBalanceUsd.minus(amountUsd);
    }
    importedCount++;
  }

  if (acc) {
    await supabase.from('accounts').update({ balance: currentBalanceUsd.toNumber() }).eq('id', accountId);
  }

  return c.redirect(`/?toast=Successfully+imported+${importedCount}+M-Pesa+transactions!`, 303);
});
