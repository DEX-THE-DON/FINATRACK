import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { AppEnv, getRequestContext } from '../db/supabase';
import {
  toDecimal,
  calculateMonthlyYield,
  allocateWaterfallSplit,
  allocateGoalSubSplits,
  calculateBudgetPace,
  formatMoney,
  calculateEmergencyRunway,
  calculateFinancialHealthScore
} from '../utils/math';
import { parseMultipleMpesaMessages } from '../utils/mpesa';
import { renderFinancialStatement } from '../views/statementView';
import { Decimal } from 'decimal.js';

export const financeRoutes = new Hono<{ Bindings: AppEnv }>();

export function getSavedGoalSplits(c: any): Record<string, number> {
  try {
    const raw = getCookie(c, 'finatrack_goal_splits');
    if (raw) return JSON.parse(decodeURIComponent(raw));
    const cookieHeader = c.req?.header('cookie') || '';
    const match = cookieHeader.match(/finatrack_goal_splits=([^;]+)/);
    if (match) return JSON.parse(decodeURIComponent(match[1]));
  } catch (e) {}
  return {};
}

const DEFAULT_USD_KES_RATE = 129.0;

function getExchangeRate(): number {
  return DEFAULT_USD_KES_RATE;
}

// ------------------------------------------------------------------------------
// ACCOUNTS CRUD
// ------------------------------------------------------------------------------
financeRoutes.post('/accounts/create', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const name = String(body['name'] || '').trim();
  const accountNumber = body['account_number'] ? String(body['account_number']).trim() : null;
  const accountType = String(body['account_type'] || 'BANK');
  const interestRate = parseFloat(String(body['interest_rate_p_a'] || '0.0')) || 0.0;
  const finalBalance = parseFloat(String(body['balance'] || '0.0')) || 0.0;

  const { error } = await supabase.from('accounts').insert({
    ...(userId ? { user_id: userId } : {}),
    name,
    account_number: accountNumber,
    account_type: accountType,
    interest_rate_p_a: interestRate,
    balance: finalBalance,
  });

  if (error) {
    console.error('Failed to create account:', error);
    return c.redirect(`/?toast=${encodeURIComponent('Failed to create account: ' + error.message)}`, 303);
  }

  return c.redirect('/?toast=Account+created+successfully', 303);
});

financeRoutes.post('/accounts/update/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const name = String(body['name'] || '').trim();
  const accountNumber = body['account_number'] ? String(body['account_number']).trim() : null;
  const accountType = String(body['account_type'] || 'BANK');
  const interestRate = parseFloat(String(body['interest_rate_p_a'] || '0.0')) || 0.0;
  const finalBalance = parseFloat(String(body['balance'] || '0.0')) || 0.0;

  const { error } = await supabase.from('accounts').update({
    name,
    account_number: accountNumber,
    account_type: accountType,
    interest_rate_p_a: interestRate,
    balance: finalBalance,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (error) {
    return c.redirect(`/?toast=${encodeURIComponent('Failed to update account: ' + error.message)}`, 303);
  }

  return c.redirect('/?toast=Account+updated+successfully', 303);
});

financeRoutes.post('/accounts/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');

  // Decouple any linked allocation rules or bills
  await supabase.from('allocation_rules').update({ target_id: null }).eq('target_id', id);
  await supabase.from('bills').update({ payment_account_id: null }).eq('payment_account_id', id);

  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) {
    return c.redirect(`/?toast=${encodeURIComponent('Failed to delete account: ' + error.message)}`, 303);
  }
  return c.redirect('/?toast=Account+deleted+successfully', 303);
});

financeRoutes.post('/accounts/interest/log/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const id = c.req.param('id');

  const { data: acc } = await supabase.from('accounts').select('*').eq('id', id).single();
  if (acc && acc.interest_rate_p_a > 0 && acc.balance > 0) {
    const monthlyYield = calculateMonthlyYield(acc.balance, acc.interest_rate_p_a).toDecimalPlaces(2);
    const newBal = toDecimal(acc.balance).plus(monthlyYield).toNumber();

    await supabase.from('accounts').update({ balance: newBal }).eq('id', id);
    await supabase.from('transactions').insert({
      ...(userId ? { user_id: userId } : {}),
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
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const fromId = String(body['from_account_id'] || '');
  const toId = String(body['to_account_id'] || '');
  const amtKes = parseFloat(String(body['amount'] || '0.0')) || 0.0;

  if (fromId && toId && fromId !== toId && amtKes > 0) {
    const { data: fromAcc } = await supabase.from('accounts').select('*').eq('id', fromId).single();
    const { data: toAcc } = await supabase.from('accounts').select('*').eq('id', toId).single();

    if (fromAcc && toAcc && Number(fromAcc.balance) >= amtKes) {
      await supabase.from('accounts').update({ balance: toDecimal(fromAcc.balance).minus(amtKes).toNumber() }).eq('id', fromId);
      await supabase.from('accounts').update({ balance: toDecimal(toAcc.balance).plus(amtKes).toNumber() }).eq('id', toId);

      const today = new Date().toISOString().slice(0, 10);
      await supabase.from('transactions').insert([
        {
          ...(userId ? { user_id: userId } : {}),
          account_id: fromId,
          transaction_type: 'EXPENSE',
          category: 'Transfer',
          amount: amtKes,
          description: `Transfer to ${toAcc.name}`,
          date: today,
        },
        {
          ...(userId ? { user_id: userId } : {}),
          account_id: toId,
          transaction_type: 'INCOME',
          category: 'Transfer',
          amount: amtKes,
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
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const accountId = String(body['account_id'] || '');
  const txType = String(body['transaction_type'] || 'EXPENSE').toUpperCase();
  const rawCategory = String(body['category'] || 'Living Expenses').trim();
  const customCategory = body['custom_category'] ? String(body['custom_category']).trim() : '';
  const description = body['description'] ? String(body['description']).trim() : null;

  let category = rawCategory;
  if (customCategory) {
    category = customCategory;
  } else if (rawCategory === 'Other' && description) {
    category = description.length > 25 ? description.slice(0, 25) : description;
  }

  const amtKes = parseFloat(String(body['amount'] || '0.0')) || 0.0;
  const tDate = String(body['t_date'] || new Date().toISOString().slice(0, 10));

  const { error } = await supabase.from('transactions').insert({
    ...(userId ? { user_id: userId } : {}),
    account_id: accountId || null,
    transaction_type: txType,
    category,
    amount: amtKes,
    date: tDate,
    description,
  });

  if (error) {
    console.error('Failed to create transaction:', error);
    return c.redirect(`/?toast=${encodeURIComponent('Failed to save transaction: ' + error.message)}`, 303);
  }

  // Update account balance
  if (accountId) {
    const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
    if (acc) {
      const curBal = toDecimal(acc.balance);
      const newBal = txType === 'INCOME' ? curBal.plus(amtKes) : curBal.minus(amtKes);
      await supabase.from('accounts').update({ balance: newBal.toNumber() }).eq('id', accountId);
    }
  }

  return c.redirect('/?toast=Transaction+saved+successfully', 303);
});

financeRoutes.post('/transactions/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) {
    return c.redirect(`/?toast=${encodeURIComponent('Failed to delete transaction: ' + error.message)}`, 303);
  }
  return c.redirect('/?toast=Transaction+deleted', 303);
});

// ------------------------------------------------------------------------------
// BUDGETS
// ------------------------------------------------------------------------------
financeRoutes.post('/budgets/create', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const category = String(body['category'] || '').trim();
  const rawLimit = parseFloat(String(body['limit_amount'] || '0.0')) || 0.0;

  const { error } = await supabase.from('budgets').upsert({
    ...(userId ? { user_id: userId } : {}),
    category,
    limit_amount: rawLimit,
  }, { onConflict: 'user_id, category' });

  if (error) {
    console.error('Failed to create budget:', error);
    return c.redirect(`/?toast=${encodeURIComponent('Failed to save budget: ' + error.message)}`, 303);
  }

  return c.redirect('/?toast=Budget+saved+successfully', 303);
});

financeRoutes.post('/budgets/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) {
    return c.redirect(`/?toast=${encodeURIComponent('Failed to delete budget: ' + error.message)}`, 303);
  }
  return c.redirect('/?toast=Budget+category+removed', 303);
});

// ------------------------------------------------------------------------------
// TARGETS UPDATE (WEEKLY / MONTHLY / YEARLY INCOME & EXPENSE CHECKERS)
// ------------------------------------------------------------------------------
financeRoutes.post('/targets/update', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();

  const entriesToUpsert = [
    { category: 'TARGET_INCOME_WEEKLY', limit_amount: parseFloat(String(body['target_income_weekly'] || '15000')) || 15000 },
    { category: 'TARGET_INCOME_MONTHLY', limit_amount: parseFloat(String(body['target_income_monthly'] || '65000')) || 65000 },
    { category: 'TARGET_INCOME_YEARLY', limit_amount: parseFloat(String(body['target_income_yearly'] || '780000')) || 780000 },
    { category: 'TARGET_EXPENSE_WEEKLY', limit_amount: parseFloat(String(body['target_expense_weekly'] || '6000')) || 6000 },
    { category: 'TARGET_EXPENSE_MONTHLY', limit_amount: parseFloat(String(body['target_expense_monthly'] || '25000')) || 25000 },
    { category: 'TARGET_EXPENSE_YEARLY', limit_amount: parseFloat(String(body['target_expense_yearly'] || '300000')) || 300000 },
  ];

  if (body['cat_limit_living'] !== undefined && body['cat_limit_living'] !== '') {
    entriesToUpsert.push({ category: 'Living Expenses', limit_amount: parseFloat(String(body['cat_limit_living'])) || 8000 });
  }
  if (body['cat_limit_food'] !== undefined && body['cat_limit_food'] !== '') {
    entriesToUpsert.push({ category: 'Food & Groceries', limit_amount: parseFloat(String(body['cat_limit_food'])) || 6000 });
  }
  if (body['cat_limit_fuel'] !== undefined && body['cat_limit_fuel'] !== '') {
    entriesToUpsert.push({ category: 'Fuel & Petrol', limit_amount: parseFloat(String(body['cat_limit_fuel'])) || 7000 });
  }
  if (body['cat_limit_bills'] !== undefined && body['cat_limit_bills'] !== '') {
    entriesToUpsert.push({ category: 'Utilities & Bills', limit_amount: parseFloat(String(body['cat_limit_bills'])) || 4000 });
  }

  if (userId) {
    for (const item of entriesToUpsert) {
      await supabase.from('budgets').upsert({
        user_id: userId,
        category: item.category,
        limit_amount: item.limit_amount,
      }, { onConflict: 'user_id, category' });
    }
  }

  return c.redirect('/?toast=Targets+and+budget+limits+updated+successfully', 303);
});


// ------------------------------------------------------------------------------
// SAVINGS GOALS (LINKED TO SINGLE MASTER VAULT WITH SUB-SPLIT %)
// ------------------------------------------------------------------------------
financeRoutes.post('/goals/create', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const title = String(body['title'] || '').trim();
  const rawTarget = parseFloat(String(body['target_amount'] || '0.0')) || 0.0;
  const rawSplit = parseFloat(String(body['split_percentage'] || '0.0')) || 0.0;
  const targetDate = body['target_date'] ? String(body['target_date']) : null;
  const accountId = body['account_id'] ? String(body['account_id']) : null;
  const addToSplit = body['add_to_split'] === '1' || body['add_to_split'] === 'on';

  const { data: goal, error } = await supabase.from('goals').insert({
    ...(userId ? { user_id: userId } : {}),
    title,
    target_amount: rawTarget,
    current_amount: 0.00,
    target_date: targetDate,
    split_percentage: rawSplit > 0 ? rawSplit : null,
    account_id: accountId || null,
  }).select().single();

  if (error) {
    console.error('Failed to create goal:', error);
    return c.redirect(`/?toast=${encodeURIComponent('Failed to create goal: ' + error.message)}`, 303);
  }

  if (goal && addToSplit) {
    await supabase.from('allocation_rules').insert({
      ...(userId ? { user_id: userId } : {}),
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

financeRoutes.post('/goals/link-vault', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const vaultAccountId = String(body['vault_account_id'] || '').trim();

  if (!vaultAccountId) {
    return c.redirect('/?toast=Please+select+a+valid+holding+account', 303);
  }

  // 1. Get the account info
  const { data: acc } = await supabase.from('accounts').select('*').eq('id', vaultAccountId).single();
  const accName = acc ? acc.name : 'Master Vault';

  // 2. Update allocation_rules where target_type is 'GOAL' or bucket contains 'Goal'
  let ruleQuery = supabase.from('allocation_rules').update({ target_id: vaultAccountId }).eq('target_type', 'GOAL');
  if (userId) ruleQuery = ruleQuery.eq('user_id', userId);
  await ruleQuery;

  // 3. Update all active goals with this master vault account_id
  let goalQuery = supabase.from('goals').update({ account_id: vaultAccountId });
  if (userId) {
    goalQuery = goalQuery.eq('user_id', userId);
  } else {
    goalQuery = goalQuery.neq('id', '00000000-0000-0000-0000-000000000000');
  }
  await goalQuery;

  return c.redirect(`/?toast=${encodeURIComponent(`Master Goal Vault linked to ${accName}!`)}`, 303);
});

financeRoutes.post('/goals/splits/update', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();

  // Parse split inputs e.g. split_goal-1 = 40, split_goal-2 = 30
  const updates: Array<{ id: string; pct: number }> = [];
  const splitMap: Record<string, number> = {};
  for (const [key, val] of Object.entries(body)) {
    if (key.startsWith('split_')) {
      const goalId = key.replace('split_', '');
      const pct = parseFloat(String(val || '0.0')) || 0.0;
      const cleanPct = Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
      updates.push({ id: goalId, pct: cleanPct });
      splitMap[goalId] = cleanPct;
    }
  }

  for (const u of updates) {
    try {
      let q = supabase.from('goals').update({ split_percentage: u.pct }).eq('id', u.id);
      if (userId) q = q.eq('user_id', userId);
      await q;
    } catch (e) {
      console.warn('Failed to update goal split in DB:', e);
    }
  }

  // Set cookie finatrack_goal_splits so custom & proportional splits survive page reloads and work across guest & user sessions
  setCookie(c, 'finatrack_goal_splits', encodeURIComponent(JSON.stringify(splitMap)), {
    path: '/',
    maxAge: 31536000,
    sameSite: 'Lax',
  });

  return c.redirect('/?toast=Goal+sub-split+shares+saved+successfully!', 303);
});

financeRoutes.post('/goals/deposit-vault', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const rawAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;
  const vaultAccountId = String(body['vault_account_id'] || '').trim();
  const sourceAccountId = String(body['source_account_id'] || '').trim();

  if (rawAmt <= 0) {
    return c.redirect('/?toast=Please+enter+a+valid+deposit+amount', 303);
  }

  // Get user accounts & active goals
  const [accRes, goalRes] = await Promise.all([
    userId ? supabase.from('accounts').select('*').eq('user_id', userId) : supabase.from('accounts').select('*'),
    userId ? supabase.from('goals').select('*').eq('user_id', userId) : supabase.from('goals').select('*'),
  ]);

  const userAccounts = accRes.data || [];
  let userGoals = goalRes.data || [];

  if (userGoals.length === 0) {
    userGoals = [
      { id: 'goal-1', title: '55" 4K Smart TV', target_amount: 45000, current_amount: 0, target_date: '2026-12-31' },
      { id: 'goal-2', title: '4-Burner Gas Cooker & Oven', target_amount: 28000, current_amount: 0, target_date: '2026-11-30' },
      { id: 'goal-3', title: '5-Seater Living Room Sofa / Seat', target_amount: 35000, current_amount: 0, target_date: '2027-01-31' }
    ];
  }

  const cookieSplits = getSavedGoalSplits(c);
  userGoals = userGoals.map((g: any, idx: number) => {
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
      split_percentage: splitPct !== null && splitPct !== undefined ? Number(splitPct) : null
    };
  });

  // Find vault account
  let vaultAcc = userAccounts.find(a => a.id === vaultAccountId);
  if (!vaultAcc && userGoals.some(g => g.account_id)) {
    const linkedId = userGoals.find(g => g.account_id)?.account_id;
    vaultAcc = userAccounts.find(a => a.id === linkedId);
  }
  if (!vaultAcc) {
    vaultAcc = userAccounts.find(a =>
      a.account_type === 'SAVINGS' ||
      a.name.toLowerCase().includes('lock') ||
      a.name.toLowerCase().includes('sacco') ||
      a.name.toLowerCase().includes('save')
    ) || userAccounts[0];
  }

  const today = new Date().toISOString().slice(0, 10);

  // If source account specified, deduct from source wallet
  if (sourceAccountId && sourceAccountId !== vaultAcc?.id) {
    const srcAcc = userAccounts.find(a => a.id === sourceAccountId);
    if (srcAcc) {
      const newSrcBal = toDecimal(srcAcc.balance).minus(rawAmt).toNumber();
      await supabase.from('accounts').update({ balance: newSrcBal }).eq('id', sourceAccountId);
      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: sourceAccountId,
        transaction_type: 'EXPENSE',
        category: 'Savings & Goals Funding',
        amount: rawAmt,
        description: `Transfer to ${vaultAcc ? vaultAcc.name : 'Goals Vault'} for Goal Sub-Splits`,
        date: today,
      });
    }
  }

  // Credit Master Vault Account
  if (vaultAcc) {
    const newBal = toDecimal(vaultAcc.balance).plus(rawAmt).toNumber();
    await supabase.from('accounts').update({ balance: newBal }).eq('id', vaultAcc.id);
    await supabase.from('transactions').insert({
      ...(userId ? { user_id: userId } : {}),
      account_id: vaultAcc.id,
      transaction_type: 'INCOME',
      category: 'Goal Vault Deposit',
      amount: rawAmt,
      description: `Master Vault Deposit: Sub-split across ${userGoals.length} goals`,
      date: today,
    });
  }

  // Sub-allocate exact zero-cent portions across goals
  const subResults = allocateGoalSubSplits(rawAmt, userGoals);
  for (const sub of subResults) {
    if (sub.allocated_amount > 0) {
      const g = userGoals.find(item => item.id === sub.goal_id);
      if (g) {
        const newGoalAmt = toDecimal(g.current_amount).plus(sub.allocated_amount).toNumber();
        await supabase.from('goals').update({ current_amount: newGoalAmt }).eq('id', sub.goal_id);
      }
    }
  }

  const vaultLabel = vaultAcc ? ` (${vaultAcc.name})` : '';
  return c.redirect(`/?toast=${encodeURIComponent(`Ksh ${rawAmt.toLocaleString()} deposited into Vault${vaultLabel} & sub-allocated to ${userGoals.length} goals!`)}`, 303);
});

financeRoutes.post('/goals/fund/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const rawAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;
  const accountId = String(body['account_id'] || '').trim();

  const { data: goal } = await supabase.from('goals').select('*').eq('id', id).single();
  if (goal && rawAmt > 0) {
    const newAmt = toDecimal(goal.current_amount).plus(rawAmt).toNumber();
    await supabase.from('goals').update({ current_amount: newAmt }).eq('id', id);

    if (accountId) {
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
      if (acc) {
        const newBal = toDecimal(acc.balance).minus(rawAmt).toNumber();
        await supabase.from('accounts').update({ balance: newBal }).eq('id', accountId);

        await supabase.from('transactions').insert({
          ...(userId ? { user_id: userId } : {}),
          account_id: accountId,
          transaction_type: 'EXPENSE',
          category: 'Savings & Goals',
          amount: rawAmt,
          date: new Date().toISOString().slice(0, 10),
          description: `Funded Goal: ${goal.title}`,
        });
      }
    }
  }

  return c.redirect('/?toast=Funds+deposited+to+goal', 303);
});

financeRoutes.post('/goals/withdraw/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const rawAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;
  const accountId = String(body['account_id'] || '').trim();

  const { data: goal } = await supabase.from('goals').select('*').eq('id', id).single();
  if (goal && rawAmt > 0) {
    const actualWithdraw = Math.min(Number(goal.current_amount || 0), rawAmt);
    const newAmt = Decimal.max(0, toDecimal(goal.current_amount).minus(rawAmt)).toNumber();
    await supabase.from('goals').update({ current_amount: newAmt }).eq('id', id);

    if (accountId && actualWithdraw > 0) {
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
      if (acc) {
        const newBal = toDecimal(acc.balance).plus(actualWithdraw).toNumber();
        await supabase.from('accounts').update({ balance: newBal }).eq('id', accountId);

        await supabase.from('transactions').insert({
          ...(userId ? { user_id: userId } : {}),
          account_id: accountId,
          transaction_type: 'INCOME',
          category: 'Savings & Goals',
          amount: actualWithdraw,
          date: new Date().toISOString().slice(0, 10),
          description: `Withdrawal from Goal: ${goal.title}`,
        });
      }
    }
  }

  return c.redirect('/?toast=Funds+withdrawn+from+goal', 303);
});

financeRoutes.post('/goals/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  await supabase.from('allocation_rules').delete().eq('target_id', id);
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) {
    return c.redirect(`/?toast=${encodeURIComponent('Failed to delete goal: ' + error.message)}`, 303);
  }
  return c.redirect('/?toast=Goal+deleted', 303);
});

financeRoutes.post('/goals/reset/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  await supabase.from('goals').update({ current_amount: 0.00 }).eq('id', id);
  return c.redirect('/?toast=Goal+saved+amount+reset+to+Ksh+0.00', 303);
});

financeRoutes.post('/goals/reset-all', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  let query = supabase.from('goals').update({ current_amount: 0.00 });
  if (userId) {
    query = query.eq('user_id', userId);
  } else {
    query = query.neq('id', '00000000-0000-0000-0000-000000000000');
  }
  await query;
  return c.redirect('/?toast=All+goal+balances+reset+to+Ksh+0.00', 303);
});


// ------------------------------------------------------------------------------
// DEBTS & LOANS (BORROWED LOANS & LENT MONEY WITH DANGER ZONES)
// ------------------------------------------------------------------------------
financeRoutes.post('/debts/create', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const personName = String(body['person_name'] || '').trim();
  const debtType = String(body['debt_type'] || 'I_OWE'); // 'I_OWE' (Borrowed) or 'OWED_TO_ME' (Lent)
  const rawTotal = parseFloat(String(body['total_amount'] || '0.0')) || 0.0;
  const rawPaid = parseFloat(String(body['paid_amount'] || '0.0')) || 0.0;
  const issuedAt = String(body['issued_at'] || new Date().toISOString().slice(0, 10));
  const dueAt = String(body['due_at'] || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const description = body['description'] ? String(body['description']).trim() : null;
  const accountId = body['account_id'] ? String(body['account_id']).trim() : null;
  const linkAccount = body['link_account'] === '1' || body['link_account'] === 'on';

  const isPaid = rawPaid >= rawTotal && rawTotal > 0;

  const { data: newDebt, error } = await supabase.from('debts').insert({
    ...(userId ? { user_id: userId } : {}),
    person_name: personName,
    debt_type: debtType,
    total_amount: rawTotal,
    paid_amount: rawPaid,
    issued_at: issuedAt,
    due_at: dueAt,
    status: isPaid ? 'PAID' : 'ACTIVE',
    description,
  }).select().single();

  if (error) {
    console.error('Failed to create debt:', error);
    return c.redirect(`/?toast=${encodeURIComponent('Failed to save debt: ' + error.message)}`, 303);
  }

  // If linking account for initial loan disbursement
  if (linkAccount && accountId && rawTotal > 0) {
    const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
    if (acc) {
      if (debtType === 'I_OWE') {
        // I borrowed -> funds received in account
        const newBal = toDecimal(acc.balance).plus(rawTotal).toNumber();
        await supabase.from('accounts').update({ balance: newBal }).eq('id', accountId);
        await supabase.from('transactions').insert({
          ...(userId ? { user_id: userId } : {}),
          account_id: accountId,
          transaction_type: 'INCOME',
          category: 'Loans & Borrowing',
          amount: rawTotal,
          date: issuedAt.slice(0, 10),
          description: `Loan Disbursed: ${personName} (Principal)`,
        });
      } else {
        // I lent out -> funds paid out from account
        const newBal = toDecimal(acc.balance).minus(rawTotal).toNumber();
        await supabase.from('accounts').update({ balance: newBal }).eq('id', accountId);
        await supabase.from('transactions').insert({
          ...(userId ? { user_id: userId } : {}),
          account_id: accountId,
          transaction_type: 'EXPENSE',
          category: 'Money Lent Out',
          amount: rawTotal,
          date: issuedAt.slice(0, 10),
          description: `Loan Issued to: ${personName}`,
        });
      }
    }
  }

  const label = debtType === 'I_OWE' ? 'Borrowed loan' : 'Lending record';
  return c.redirect(`/?toast=${encodeURIComponent(`${label} saved successfully!`)}`, 303);
});

financeRoutes.post('/debts/repay/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const rawAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;
  const accountId = body['account_id'] ? String(body['account_id']).trim() : null;
  const paymentDate = String(body['payment_date'] || new Date().toISOString().slice(0, 10));

  const { data: debt } = await supabase.from('debts').select('*').eq('id', id).single();
  if (debt && rawAmt > 0) {
    const newPaid = toDecimal(debt.paid_amount).plus(rawAmt).toNumber();
    const isPaid = newPaid >= Number(debt.total_amount);
    
    await supabase.from('debts').update({
      paid_amount: newPaid,
      status: isPaid ? 'PAID' : 'ACTIVE',
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    // Account ledger sync
    if (accountId) {
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
      if (acc) {
        if (debt.debt_type === 'I_OWE') {
          // Repaying a loan I borrowed -> expense from account
          const newBal = toDecimal(acc.balance).minus(rawAmt).toNumber();
          await supabase.from('accounts').update({ balance: newBal }).eq('id', accountId);
          await supabase.from('transactions').insert({
            ...(userId ? { user_id: userId } : {}),
            account_id: accountId,
            transaction_type: 'EXPENSE',
            category: 'Debt & Loan Repayments',
            amount: rawAmt,
            date: paymentDate,
            description: `Loan Repayment: ${debt.person_name}`,
          });
        } else {
          // Receiving repayment for money I lent -> income to account
          const newBal = toDecimal(acc.balance).plus(rawAmt).toNumber();
          await supabase.from('accounts').update({ balance: newBal }).eq('id', accountId);
          await supabase.from('transactions').insert({
            ...(userId ? { user_id: userId } : {}),
            account_id: accountId,
            transaction_type: 'INCOME',
            category: 'Debt Collections',
            amount: rawAmt,
            date: paymentDate,
            description: `Debt Recovery from: ${debt.person_name}`,
          });
        }
      }
    }
  }

  return c.redirect('/?toast=Payment+recorded+and+ledger+updated', 303);
});

financeRoutes.post('/debts/toggle-status/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  const { data: debt } = await supabase.from('debts').select('*').eq('id', id).single();
  if (debt) {
    const newStatus = debt.status === 'PAID' ? 'ACTIVE' : 'PAID';
    const newPaid = newStatus === 'PAID' ? Number(debt.total_amount) : 0.00;
    await supabase.from('debts').update({
      status: newStatus,
      paid_amount: newPaid,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
  }
  return c.redirect('/?toast=Debt+status+updated', 303);
});

financeRoutes.post('/debts/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  const { error } = await supabase.from('debts').delete().eq('id', id);
  if (error) {
    return c.redirect(`/?toast=${encodeURIComponent('Failed to delete debt: ' + error.message)}`, 303);
  }
  return c.redirect('/?toast=Debt+record+deleted', 303);
});


// ------------------------------------------------------------------------------
// RECURRING BILLS
// ------------------------------------------------------------------------------
financeRoutes.post('/bills/create', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const title = String(body['title'] || '').trim();
  const category = String(body['category'] || 'UTILITY').trim();
  const rawAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;
  const dueDay = parseInt(String(body['due_day'] || '1'), 10);
  const paymentAccountId = body['payment_account_id'] ? String(body['payment_account_id']) : null;
  const notes = body['notes'] ? String(body['notes']).trim() : null;

  const { error } = await supabase.from('bills').insert({
    ...(userId ? { user_id: userId } : {}),
    title,
    category,
    amount: rawAmt,
    due_day: dueDay,
    payment_account_id: paymentAccountId,
    is_recurring: 1,
    notes,
  });

  if (error) {
    console.error('Failed to create bill:', error);
    return c.redirect(`/?toast=${encodeURIComponent('Failed to save bill: ' + error.message)}`, 303);
  }

  return c.redirect('/?toast=Recurring+bill+added+successfully', 303);
});

financeRoutes.post('/bills/pay/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const paymentAccountId = body['payment_account_id'] ? String(body['payment_account_id']) : null;

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
          ...(userId ? { user_id: userId } : {}),
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
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  const { error } = await supabase.from('bills').delete().eq('id', id);
  if (error) {
    return c.redirect(`/?toast=${encodeURIComponent('Failed to delete bill: ' + error.message)}`, 303);
  }
  return c.redirect('/?toast=Bill+removed', 303);
});

// ------------------------------------------------------------------------------
// DYNAMIC WATERFALL AUTO-SPLIT EXECUTION
// ------------------------------------------------------------------------------
// ------------------------------------------------------------------------------
// DYNAMIC WATERFALL AUTO-SPLIT EXECUTION
// ------------------------------------------------------------------------------
financeRoutes.post('/split/distribute', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const rawAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;
  const sourceAccountId = body['source_account_id'] ? String(body['source_account_id']) : null;

  if (rawAmt <= 0) return c.redirect('/?toast=Please+enter+a+valid+amount', 303);

  let query = supabase.from('allocation_rules').select('*').eq('is_active', 1);
  if (userId) query = query.eq('user_id', userId);
  let { data: rules } = await query;

  if (!rules || rules.length === 0) {
    // Default fallback rules
    rules = [
      { id: 'rule-1', bucket_name: 'Ziidi MMF (Safaricom)', target_type: 'ACCOUNT', percentage: 20.0, icon: '📈', is_active: 1 },
      { id: 'rule-2', bucket_name: 'Lock / Sacco Savings', target_type: 'ACCOUNT', percentage: 20.0, icon: '🔒', is_active: 1 },
      { id: 'rule-3', bucket_name: 'Savings Goals', target_type: 'GOAL', percentage: 15.0, icon: '🎯', is_active: 1 },
      { id: 'rule-4', bucket_name: 'Recurring Bills Reserve', target_type: 'ACCOUNT', percentage: 15.0, icon: '⚡', is_active: 1 },
      { id: 'rule-5', bucket_name: 'Daily Living Expenses', target_type: 'CASH', percentage: 30.0, icon: '💵', is_active: 1 }
    ];
  }

  // Get user accounts & goals for smart destination matching if target_id is not set
  const [accRes, goalRes] = await Promise.all([
    userId ? supabase.from('accounts').select('*').eq('user_id', userId) : supabase.from('accounts').select('*'),
    userId ? supabase.from('goals').select('*').eq('user_id', userId) : supabase.from('goals').select('*'),
  ]);
  const userAccounts = accRes.data || [];
  let userGoals = goalRes.data || [];

  if (userGoals.length === 0) {
    userGoals = [
      { id: 'goal-1', title: '55" 4K Smart TV', target_amount: 45000, current_amount: 0, target_date: '2026-12-31' },
      { id: 'goal-2', title: '4-Burner Gas Cooker & Oven', target_amount: 28000, current_amount: 0, target_date: '2026-11-30' },
      { id: 'goal-3', title: '5-Seater Living Room Sofa / Seat', target_amount: 35000, current_amount: 0, target_date: '2027-01-31' }
    ];
  }

  const cookieSplits = getSavedGoalSplits(c);
  userGoals = userGoals.map((g: any, idx: number) => {
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
      split_percentage: splitPct !== null && splitPct !== undefined ? Number(splitPct) : null
    };
  });

  // If a source account was chosen, deduct the total amount from source wallet
  if (sourceAccountId) {
    const srcAcc = userAccounts.find(a => a.id === sourceAccountId);
    if (srcAcc) {
      const newSrcBal = toDecimal(srcAcc.balance).minus(rawAmt).toNumber();
      await supabase.from('accounts').update({ balance: newSrcBal }).eq('id', sourceAccountId);
      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: sourceAccountId,
        transaction_type: 'EXPENSE',
        category: 'Waterfall Split Source',
        amount: rawAmt,
        description: `Waterfall Auto-Split: Distributed Ksh ${rawAmt.toLocaleString()}`,
        date: new Date().toISOString().slice(0, 10),
      });
    }
  }

  const splitResults = allocateWaterfallSplit(
    rawAmt,
    rules.map((r: any) => ({
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

    if (res.target_type === 'ACCOUNT') {
      let targetAcc = userAccounts.find(a => a.id === res.target_id);
      if (!targetAcc) {
        // Smart match by bucket name or account type
        const bName = res.bucket_name.toLowerCase();
        if (bName.includes('mmf') || bName.includes('ziidi') || bName.includes('yield')) {
          targetAcc = userAccounts.find(a => a.account_type === 'MMF' || a.name.toLowerCase().includes('mmf'));
        } else if (bName.includes('lock') || bName.includes('sacco') || bName.includes('save')) {
          targetAcc = userAccounts.find(a => a.account_type === 'SAVINGS' || a.name.toLowerCase().includes('sacco') || a.name.toLowerCase().includes('lock'));
        } else if (bName.includes('bill') || bName.includes('utilit')) {
          targetAcc = userAccounts.find(a => a.name.toLowerCase().includes('bill') || a.account_type === 'BANK');
        }
      }

      if (targetAcc) {
        const newBal = toDecimal(targetAcc.balance).plus(splitAmt).toNumber();
        await supabase.from('accounts').update({ balance: newBal }).eq('id', targetAcc.id);
        await supabase.from('transactions').insert({
          ...(userId ? { user_id: userId } : {}),
          account_id: targetAcc.id,
          transaction_type: 'INCOME',
          category: 'Auto-Split Deposit',
          amount: splitAmt,
          description: `Auto-Split Allocation: ${res.bucket_name} (${res.percentage}%)`,
          date: today,
        });
      }
    } else if (res.target_type === 'GOAL') {
      // 1. Find the linked Master Holding Vault account for goals
      let vaultAcc = userAccounts.find(a => a.id === res.target_id);
      if (!vaultAcc) {
        const goalWithAcc = userGoals.find(g => g.account_id);
        if (goalWithAcc) {
          vaultAcc = userAccounts.find(a => a.id === goalWithAcc.account_id);
        }
      }
      if (!vaultAcc) {
        vaultAcc = userAccounts.find(a =>
          a.account_type === 'SAVINGS' ||
          a.name.toLowerCase().includes('lock') ||
          a.name.toLowerCase().includes('sacco') ||
          a.name.toLowerCase().includes('vault') ||
          a.name.toLowerCase().includes('save')
        ) || userAccounts.find(a => a.account_type === 'MMF' || a.account_type === 'BANK');
      }

      // 2. Deposit full split bucket amount into the single Master Holding Vault account
      if (vaultAcc) {
        const newBal = toDecimal(vaultAcc.balance).plus(splitAmt).toNumber();
        await supabase.from('accounts').update({ balance: newBal }).eq('id', vaultAcc.id);
        await supabase.from('transactions').insert({
          ...(userId ? { user_id: userId } : {}),
          account_id: vaultAcc.id,
          transaction_type: 'INCOME',
          category: 'Savings & Goals Vault',
          amount: splitAmt,
          description: `Auto-Split Goal Vault Deposit: Ksh ${splitAmt.toLocaleString()} (${res.percentage}% into ${vaultAcc.name})`,
          date: today,
        });
      }

      // 3. Sub-allocate exact zero-cent portions across active goals based on sub-split %
      if (userGoals.length > 0) {
        const subAllocations = allocateGoalSubSplits(splitAmt, userGoals);
        for (const sub of subAllocations) {
          if (sub.allocated_amount > 0) {
            const currentGoal = userGoals.find(g => g.id === sub.goal_id);
            if (currentGoal) {
              const newGoalAmt = toDecimal(currentGoal.current_amount).plus(sub.allocated_amount).toNumber();
              await supabase.from('goals').update({ current_amount: newGoalAmt }).eq('id', sub.goal_id);
            }
          }
        }
      }
    } else if (res.target_type === 'CASH') {
      // Find cash or mobile wallet to record living cash transaction
      const cashAcc = userAccounts.find(a => a.account_type === 'CASH' || a.account_type === 'MOBILE_MONEY');
      if (cashAcc && !sourceAccountId) {
        const newBal = toDecimal(cashAcc.balance).plus(splitAmt).toNumber();
        await supabase.from('accounts').update({ balance: newBal }).eq('id', cashAcc.id);
        await supabase.from('transactions').insert({
          ...(userId ? { user_id: userId } : {}),
          account_id: cashAcc.id,
          transaction_type: 'INCOME',
          category: 'Living Expenses',
          amount: splitAmt,
          description: `Daily Living Cash: ${res.bucket_name} (${res.percentage}%)`,
          date: today,
        });
      }
    }
  }

  return c.redirect('/?toast=Income+successfully+distributed+via+Waterfall+Split!', 303);
});

// ------------------------------------------------------------------------------
// ALLOCATION RULES UPDATE (FULL BUCKET EDITING)
// ------------------------------------------------------------------------------
financeRoutes.post('/rules/update', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();

  const ruleIds = new Set<string>();
  for (const key of Object.keys(body)) {
    if (key.startsWith('percentage_')) {
      ruleIds.add(key.replace('percentage_', ''));
    }
  }

  let query = supabase.from('allocation_rules').select('*');
  if (userId) query = query.eq('user_id', userId);
  const { data: existingRules } = await query;
  const existingMap = new Map((existingRules || []).map((r: any) => [r.id, r]));

  for (const id of ruleIds) {
    const pct = parseFloat(String(body[`percentage_${id}`])) || 0.0;
    const bucketName = body[`bucket_name_${id}`] ? String(body[`bucket_name_${id}`]).trim() : undefined;
    const icon = body[`icon_${id}`] ? String(body[`icon_${id}`]).trim() : undefined;
    const targetType = body[`target_type_${id}`] ? String(body[`target_type_${id}`]).trim() : undefined;
    const rawTargetId = body[`target_id_${id}`] ? String(body[`target_id_${id}`]).trim() : null;
    const targetId = rawTargetId && rawTargetId !== '' ? rawTargetId : null;

    if (existingMap.has(id)) {
      await supabase.from('allocation_rules').update({
        percentage: pct,
        ...(bucketName ? { bucket_name: bucketName } : {}),
        ...(icon ? { icon } : {}),
        ...(targetType ? { target_type: targetType } : {}),
        target_id: targetId,
        is_active: 1,
      }).eq('id', id);
    } else {
      await supabase.from('allocation_rules').insert({
        ...(userId ? { user_id: userId } : {}),
        bucket_name: bucketName || 'Custom Bucket',
        icon: icon || '💰',
        percentage: pct,
        target_type: targetType || 'CASH',
        target_id: targetId,
        is_active: 1,
      });
    }
  }

  return c.redirect('/?toast=Waterfall+split+rules+updated+successfully!', 303);
});

// ------------------------------------------------------------------------------
// ALLOCATION RULE CREATE (ADD NEW BUCKET)
// ------------------------------------------------------------------------------
financeRoutes.post('/rules/create', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();

  const bucketName = String(body['bucket_name'] || 'New Allocation Bucket').trim();
  const icon = String(body['icon'] || '💰').trim();
  const percentage = parseFloat(String(body['percentage'] || '10')) || 10.0;
  const targetType = String(body['target_type'] || 'CASH');
  const rawTargetId = body['target_id'] ? String(body['target_id']).trim() : null;
  const targetId = rawTargetId && rawTargetId !== '' ? rawTargetId : null;

  await supabase.from('allocation_rules').insert({
    ...(userId ? { user_id: userId } : {}),
    bucket_name: bucketName,
    icon: icon,
    percentage: percentage,
    target_type: targetType,
    target_id: targetId,
    is_active: 1,
  });

  return c.redirect('/?toast=New+allocation+bucket+added+successfully!', 303);
});

// ------------------------------------------------------------------------------
// ALLOCATION RULE DELETE (REMOVE BUCKET)
// ------------------------------------------------------------------------------
financeRoutes.post('/rules/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  if (id) {
    await supabase.from('allocation_rules').delete().eq('id', id);
  }
  return c.redirect('/?toast=Allocation+bucket+removed', 303);
});

// ------------------------------------------------------------------------------
// SYSTEM DATA RESET (CLEAN SLATE)
// ------------------------------------------------------------------------------
financeRoutes.post('/system/reset-data', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  
  if (userId) {
    await supabase.from('transactions').delete().eq('user_id', userId);
    await supabase.from('rider_logs').delete().eq('user_id', userId);
    await supabase.from('debts').delete().eq('user_id', userId);
    await supabase.from('budgets').delete().eq('user_id', userId);
    await supabase.from('goals').delete().eq('user_id', userId);
    await supabase.from('bills').delete().eq('user_id', userId);
    await supabase.from('maintenance_schedules').delete().eq('user_id', userId);
    await supabase.from('compliance_deadlines').delete().eq('user_id', userId);
    await supabase.from('bike_financings').delete().eq('user_id', userId);
    await supabase.from('allocation_rules').delete().eq('user_id', userId);
    await supabase.from('bikes').delete().eq('user_id', userId);
    await supabase.from('accounts').delete().eq('user_id', userId);
  } else {
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
  }

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
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const accountId = String(body['account_id'] || '');
  const rawText = String(body['raw_sms'] || '');

  if (!accountId) {
    return c.redirect('/?toast=Please+select+an+account+to+import+into', 303);
  }

  const parsedList = parseMultipleMpesaMessages(rawText);
  if (parsedList.length === 0) {
    return c.redirect('/?toast=No+valid+M-Pesa+messages+found+in+the+pasted+text', 303);
  }

  const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
  let currentBalance = acc ? toDecimal(acc.balance) : new Decimal(0);

  let importedCount = 0;
  for (const t of parsedList) {
    const amountKes = t.amount_kes;
    
    const { error: txError } = await supabase.from('transactions').insert({
      ...(userId ? { user_id: userId } : {}),
      account_id: accountId,
      amount: amountKes,
      transaction_type: t.type,
      category: t.suggested_category,
      description: t.description,
      date: t.date,
    });

    if (!txError) {
      if (t.type === 'INCOME') {
        currentBalance = currentBalance.plus(amountKes);
      } else {
        currentBalance = currentBalance.minus(amountKes);
      }
      importedCount++;
    }
  }

  if (acc) {
    await supabase.from('accounts').update({ balance: currentBalance.toNumber() }).eq('id', accountId);
  }

  return c.redirect(`/?toast=Successfully+imported+${importedCount}+M-Pesa+transactions!`, 303);
});

// ------------------------------------------------------------------------------
// 📄 1-CLICK PRINTABLE / PDF FINANCIAL STATEMENT
// ------------------------------------------------------------------------------
financeRoutes.get('/finance/statement', async (c) => {
  const { supabase, userId, username } = await getRequestContext(c);

  let accQuery = supabase.from('accounts').select('*').order('created_at', { ascending: true });
  let txQuery = supabase.from('transactions').select('*').order('date', { ascending: false });
  let debtQuery = supabase.from('debts').select('*').order('due_at', { ascending: true });

  if (userId) {
    accQuery = accQuery.eq('user_id', userId);
    txQuery = txQuery.eq('user_id', userId);
    debtQuery = debtQuery.eq('user_id', userId);
  }

  const [accRes, txRes, debtRes] = await Promise.all([accQuery, txQuery, debtQuery]);
  const accounts = accRes.data || [];
  const transactions = txRes.data || [];
  const debts = debtRes.data || [];

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
  
  const now = new Date();
  const currentMonthStr = now.toISOString().slice(0, 7);
  const monthlyTxs = transactions.filter((t: any) => t.date && t.date.startsWith(currentMonthStr));
  const monthlyIncome = monthlyTxs.filter((t: any) => t.transaction_type === 'INCOME').reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
  const monthlyExpenses = monthlyTxs.filter((t: any) => t.transaction_type === 'EXPENSE').reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
  const netSavings = monthlyIncome - monthlyExpenses;

  const totalDebt = debts.filter((d: any) => d.status !== 'PAID').reduce((sum: number, d: any) => sum + (Number(d.total_amount || 0) - Number(d.paid_amount || 0)), 0);

  const runwayStatus = calculateEmergencyRunway(totalBalance, monthlyExpenses, 25000);
  const healthScore = calculateFinancialHealthScore({
    liquidBalance: totalBalance,
    totalDebt,
    monthlyIncome,
    monthlyExpenses,
    runwayMonths: runwayStatus.months,
  });

  const html = renderFinancialStatement({
    username: username || 'Dennis',
    accounts,
    transactions,
    total_balance: totalBalance,
    monthly_income: monthlyIncome,
    monthly_expenses: monthlyExpenses,
    net_savings: netSavings,
    total_debt: totalDebt,
    runway_status: runwayStatus,
    health_score: healthScore,
    currency: 'Ksh',
  });

  return c.html(html);
});


