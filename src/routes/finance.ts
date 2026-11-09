import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { AppEnv, getRequestContext } from '../db/supabase';
import {
  toDecimal,
  calculateMonthlyYield,
  calculateDailyYield,
  allocateWaterfallSplit,
  allocateGoalSubSplits,
  calculateBudgetPace,
  formatMoney,
  calculateEmergencyRunway,
  calculateFinancialHealthScore,
  sortTransactionsLatestFirst,
  isTransferTransaction
} from '../utils/math';
import { parseMultipleMpesaMessages } from '../utils/mpesa';
import { parseMultipleBankMessages } from '../utils/bankSms';
import { renderFinancialStatement } from '../views/statementView';
import { Decimal } from 'decimal.js';
import { getStrictSaverConfig, saveStrictSaverConfigCookie } from './rider';

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

export type GoalHorizon = 'SHORT_TERM' | 'LONG_TERM';

export function getSavedGoalHorizons(c: any): Record<string, GoalHorizon> {
  try {
    const raw = getCookie(c, 'finatrack_goal_horizons');
    if (raw) return JSON.parse(decodeURIComponent(raw));
    const cookieHeader = c.req?.header('cookie') || '';
    const match = cookieHeader.match(/finatrack_goal_horizons=([^;]+)/);
    if (match) return JSON.parse(decodeURIComponent(match[1]));
  } catch (e) {}
  return {};
}

export function saveGoalHorizonsCookie(c: any, horizons: Record<string, GoalHorizon>): void {
  try {
    setCookie(c, 'finatrack_goal_horizons', encodeURIComponent(JSON.stringify(horizons)), {
      path: '/',
      maxAge: 31536000,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

export function resolveGoalHorizon(goal: any, savedHorizons: Record<string, GoalHorizon> = {}): GoalHorizon {
  if (!goal) return 'SHORT_TERM';
  const explicit =
    savedHorizons[String(goal.id || '')] ||
    savedHorizons[String(goal.title || '')] ||
    goal.horizon;
  if (explicit === 'SHORT_TERM' || explicit === 'LONG_TERM') {
    return explicit;
  }
  if (goal.target_date) {
    const targetMs = Date.parse(String(goal.target_date).slice(0, 10));
    const nowMs = Date.parse(new Date().toISOString().slice(0, 10));
    if (!isNaN(targetMs)) {
      const diffDays = Math.round((targetMs - nowMs) / 86400000);
      return diffDays <= 185 ? 'SHORT_TERM' : 'LONG_TERM';
    }
  }
  const titleStr = String(goal.title || '').toLowerCase();
  if (/malindi|vacation|resort|emergency|shield|land|plot|house|home build|car|vehicle|bike upgrade|pension|retire|college|university/i.test(titleStr)) {
    return 'LONG_TERM';
  }
  if (/tire|tube|phone|gas|cooker|helmet|school|exam|rent|insurance|service|repair|festive|december|christmas|sofa|tv/i.test(titleStr)) {
    return 'SHORT_TERM';
  }
  const targetAmt = Number(goal.target_amount || 0);
  return targetAmt > 30000 ? 'LONG_TERM' : 'SHORT_TERM';
}

export const DEFAULT_ALLOCATION_RULES = [
  { id: 'rule-1', bucket_name: 'Ziidi MMF (Safaricom)', target_type: 'ACCOUNT', target_id: null, percentage: 20.0, icon: '📈', is_active: 1 },
  { id: 'rule-2', bucket_name: 'Lock / Sacco Savings', target_type: 'ACCOUNT', target_id: null, percentage: 20.0, icon: '🔒', is_active: 1 },
  { id: 'rule-3', bucket_name: 'Savings Goals', target_type: 'GOAL', target_id: null, percentage: 15.0, icon: '🎯', is_active: 1 },
  { id: 'rule-4', bucket_name: 'Recurring Bills Reserve', target_type: 'ACCOUNT', target_id: null, percentage: 15.0, icon: '⚡', is_active: 1 },
  { id: 'rule-5', bucket_name: 'Daily Living Expenses', target_type: 'CASH', target_id: null, percentage: 30.0, icon: '💵', is_active: 1 }
];

export const SPLIT_RATIO_PRESETS: Record<string, { label: string; rules: any[] }> = {
  PAY_YOURSELF_FLEET: {
    label: '30-20-15-10-25 Pay Yourself First + Fleet Formula',
    rules: [
      { id: 'rule-pyf-1', bucket_name: 'Pay Yourself #1: Ziidi / Britam MMF', target_type: 'ACCOUNT', target_id: null, percentage: 15.0, icon: '👑', is_active: 1 },
      { id: 'rule-pyf-2', bucket_name: 'Pay Yourself #2: Lock / Sacco Savings', target_type: 'ACCOUNT', target_id: null, percentage: 15.0, icon: '🔒', is_active: 1 },
      { id: 'rule-pyf-3', bucket_name: 'Savings Goals (Malindi & Home)', target_type: 'GOAL', target_id: null, percentage: 20.0, icon: '🎯', is_active: 1 },
      { id: 'rule-pyf-4', bucket_name: 'Recurring Bills & Rent Reserve', target_type: 'BILL', target_id: null, percentage: 15.0, icon: '⚡', is_active: 1 },
      { id: 'rule-pyf-5', bucket_name: 'Fleet Service & Docs Reserve', target_type: 'ACCOUNT', target_id: null, percentage: 10.0, icon: '🛠️', is_active: 1 },
      { id: 'rule-pyf-6', bucket_name: 'Daily Living & Personal Pocket', target_type: 'CASH', target_id: null, percentage: 25.0, icon: '💵', is_active: 1 },
    ],
  },
  AGGRESSIVE_WEALTH: {
    label: '40-20-15-25 Aggressive Wealth Formula',
    rules: [
      { id: 'rule-agg-1', bucket_name: 'Pay Yourself #1: Ziidi / Britam MMF', target_type: 'ACCOUNT', target_id: null, percentage: 25.0, icon: '👑', is_active: 1 },
      { id: 'rule-agg-2', bucket_name: 'Pay Yourself #2: Lock / Sacco Savings', target_type: 'ACCOUNT', target_id: null, percentage: 15.0, icon: '🔒', is_active: 1 },
      { id: 'rule-agg-3', bucket_name: 'Savings Goals (Malindi & Home)', target_type: 'GOAL', target_id: null, percentage: 20.0, icon: '🎯', is_active: 1 },
      { id: 'rule-agg-4', bucket_name: 'Bills & Fleet Maintenance Reserve', target_type: 'ACCOUNT', target_id: null, percentage: 15.0, icon: '⚡', is_active: 1 },
      { id: 'rule-agg-5', bucket_name: 'Daily Living & Personal Pocket', target_type: 'CASH', target_id: null, percentage: 25.0, icon: '💵', is_active: 1 },
    ],
  },
  DEBT_CRUSHER: {
    label: '20-20-15-15-30 Debt Crusher Formula',
    rules: [
      { id: 'rule-dc-1', bucket_name: 'Pay Yourself First (MMF / Sacco)', target_type: 'ACCOUNT', target_id: null, percentage: 20.0, icon: '👑', is_active: 1 },
      { id: 'rule-dc-2', bucket_name: 'Loan / Debt Crusher Payoff', target_type: 'DEBT', target_id: null, percentage: 20.0, icon: '💳', is_active: 1 },
      { id: 'rule-dc-3', bucket_name: 'Savings Goals (Malindi & Home)', target_type: 'GOAL', target_id: null, percentage: 15.0, icon: '🎯', is_active: 1 },
      { id: 'rule-dc-4', bucket_name: 'Bills & Fleet Maintenance Reserve', target_type: 'ACCOUNT', target_id: null, percentage: 15.0, icon: '⚡', is_active: 1 },
      { id: 'rule-dc-5', bucket_name: 'Daily Living & Personal Pocket', target_type: 'CASH', target_id: null, percentage: 30.0, icon: '💵', is_active: 1 },
    ],
  },
  DEFAULT_5: {
    label: '20-20-15-15-30 Classic 5 Buckets',
    rules: DEFAULT_ALLOCATION_RULES,
  },
};

export function getSavedAllocationRules(c: any): any[] | null {
  try {
    const raw = getCookie(c, 'finatrack_allocation_rules');
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const cookieHeader = c.req?.header('cookie') || '';
    const match = cookieHeader.match(/finatrack_allocation_rules=([^;]+)/);
    if (match) {
      const parsed = JSON.parse(decodeURIComponent(match[1]));
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return null;
}

export function saveAllocationRulesCookie(c: any, rules: any[]) {
  try {
    const clean = (rules || []).map((r: any, idx: number) => ({
      id: String(r.id || `rule-${idx + 1}`),
      bucket_name: String(r.bucket_name || 'Custom Option').trim(),
      icon: String(r.icon || '💰').trim() || '💰',
      percentage: Number(r.percentage ?? 0),
      target_type: String(r.target_type || 'CASH').trim(),
      target_id: r.target_id ? String(r.target_id).trim() : null,
      is_active: 1,
    }));
    setCookie(c, 'finatrack_allocation_rules', encodeURIComponent(JSON.stringify(clean)), {
      path: '/',
      maxAge: 31536000,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

export function resolveEffectiveAllocationRules(c: any, dbRules: any[] | null | undefined): any[] {
  const cookieRules = getSavedAllocationRules(c);
  if (cookieRules && cookieRules.length > 0) {
    if (dbRules && dbRules.length > 0) {
      const dbByName = new Map(dbRules.map((d: any) => [String(d.bucket_name || '').toLowerCase(), d]));
      const dbById = new Map(dbRules.map((d: any) => [String(d.id), d]));
      return cookieRules.map((cr: any) => {
        const matched = dbById.get(String(cr.id)) || dbByName.get(String(cr.bucket_name || '').toLowerCase());
        return {
          ...cr,
          id: matched?.id ? String(matched.id) : String(cr.id),
          target_id: cr.target_id || matched?.target_id || null,
        };
      });
    }
    return cookieRules;
  }
  if (dbRules && dbRules.length > 0) {
    return dbRules;
  }
  return DEFAULT_ALLOCATION_RULES.map(r => ({ ...r }));
}

function isValidUuid(val: string | null | undefined): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val).trim()));
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

  // Keep Rider Hub Strict Saver account in 100% sync if this account is linked
  try {
    const curStrict = getStrictSaverConfig(c);
    if (String(curStrict.savings_account_id) === String(id)) {
      saveStrictSaverConfigCookie(c, {
        ...curStrict,
        savings_account_name: name,
        starting_savings_balance: finalBalance,
      });
    }
  } catch (e) {}

  return c.redirect('/?toast=Account+updated+successfully', 303);
});

financeRoutes.post('/accounts/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');

  // Decouple any linked allocation rules or bills
  await supabase.from('allocation_rules').update({ target_id: null }).eq('target_id', id);
  await supabase.from('bills').update({ payment_account_id: null }).eq('payment_account_id', id);

  // If deleted account is linked in Strict Saver, clear it
  try {
    const curStrict = getStrictSaverConfig(c);
    if (String(curStrict.savings_account_id) === String(id)) {
      saveStrictSaverConfigCookie(c, {
        ...curStrict,
        savings_account_id: '',
        savings_account_name: 'Strict Savings Account',
      });
    }
  } catch (e) {}

  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) {
    return c.redirect(`/?toast=${encodeURIComponent('Failed to delete account: ' + error.message)}`, 303);
  }
  return c.redirect('/?toast=Account+deleted+successfully', 303);
});

financeRoutes.post('/accounts/interest/log/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const id = c.req.param('id');
  let body: any = {};
  try {
    body = await c.req.parseBody();
  } catch (e) {
    body = {};
  }

  const customAmt = parseFloat(String(body['amount'] || '0.0')) || 0.0;
  const period = String(body['period'] || (customAmt > 0 ? 'custom' : 'monthly')).toLowerCase();
  const txDate = String(body['date'] || new Date().toISOString().slice(0, 10));
  const notes = String(body['notes'] || '').trim();

  const { data: acc } = await supabase.from('accounts').select('*').eq('id', id).single();
  if (acc) {
    let yieldAmount = new Decimal(0);
    let desc = '';

    if (customAmt > 0) {
      yieldAmount = toDecimal(customAmt).toDecimalPlaces(2);
      desc = notes || `Daily MMF Profit Yield (${acc.name})`;
    } else if (period === 'daily') {
      yieldAmount = calculateDailyYield(acc.balance, acc.interest_rate_p_a || 0).toDecimalPlaces(2);
      desc = notes || `Daily MMF Interest Yield (${acc.name} @ ${acc.interest_rate_p_a}% p.a.)`;
    } else {
      yieldAmount = calculateMonthlyYield(acc.balance, acc.interest_rate_p_a || 0).toDecimalPlaces(2);
      desc = notes || `Monthly MMF Interest Yield (${acc.name} @ ${acc.interest_rate_p_a}% p.a.)`;
    }

    if (yieldAmount.greaterThan(0)) {
      const newBal = toDecimal(acc.balance).plus(yieldAmount).toNumber();
      await supabase.from('accounts').update({ balance: newBal }).eq('id', id);
      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: acc.id,
        transaction_type: 'INCOME',
        category: 'Interest & Yield',
        amount: yieldAmount.toNumber(),
        description: desc,
        date: txDate,
      });

      return c.redirect(`/?toast=${encodeURIComponent(`MMF Profit of Ksh ${yieldAmount.toNumber().toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} credited successfully`)}#mmf-card`, 303);
    }
  }

  return c.redirect('/?toast=Unable+to+credit+yield#mmf-card', 303);
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
          transaction_type: 'TRANSFER',
          category: 'Transfer',
          amount: amtKes,
          description: `Transfer to ${toAcc.name}`,
          date: today,
        },
        {
          ...(userId ? { user_id: userId } : {}),
          account_id: toId,
          transaction_type: 'TRANSFER',
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
  let linkedBillId = body['linked_bill_id'] ? String(body['linked_bill_id']).trim() : '';
  let syncedBillName = '';

  if (rawCategory.startsWith('BILL:')) {
    linkedBillId = rawCategory.replace('BILL:', '').trim();
  }

  if (customCategory) {
    category = customCategory;
  } else if (rawCategory.startsWith('BILL:')) {
    category = 'Utilities & Bills';
  } else if (rawCategory === 'Other' && description) {
    category = description.length > 25 ? description.slice(0, 25) : description;
  }

  const amtKes = parseFloat(String(body['amount'] || '0.0')) || 0.0;
  const tDate = String(body['t_date'] || new Date().toISOString().slice(0, 10));
  const currentMonth = tDate.slice(0, 7);

  let matchedBillIdx = -1;
  let billsList: RecurringBillItem[] = [];
  if (txType === 'EXPENSE') {
    try {
      billsList = getRecurringBills(c);
      if (linkedBillId) {
        matchedBillIdx = billsList.findIndex((b) => String(b.id) === String(linkedBillId));
      } else if (description || category) {
        const probeTx = {
          transaction_type: txType,
          category,
          description: description || category,
          date: tDate,
          amount: amtKes,
        };
        matchedBillIdx = billsList.findIndex((b) => doesTransactionMatchRecurringBill(probeTx, b, currentMonth));
      }
      if (matchedBillIdx >= 0) {
        const b = billsList[matchedBillIdx];
        syncedBillName = b.name;
        if (rawCategory.startsWith('BILL:')) {
          category = b.category || 'Utilities & Bills';
        }
      }
    } catch (e) {}
  }

  const effectiveDescription = description || (syncedBillName ? `${billsList[matchedBillIdx]?.icon || '⚡'} ${syncedBillName} (Monthly Bill — ${currentMonth})` : null);

  const { data: insertedTx, error } = await supabase.from('transactions').insert({
    ...(userId ? { user_id: userId } : {}),
    account_id: accountId || null,
    transaction_type: txType,
    category,
    amount: amtKes,
    date: tDate,
    description: effectiveDescription,
  }).select().single();

  if (error) {
    console.error('Failed to create transaction:', error);
    return c.redirect(`/?toast=${encodeURIComponent('Failed to save transaction: ' + error.message)}`, 303);
  }

  if (matchedBillIdx >= 0 && billsList[matchedBillIdx]) {
    try {
      const b = billsList[matchedBillIdx];
      billsList[matchedBillIdx] = {
        ...b,
        amount: amtKes > 0 ? amtKes : b.amount,
        is_paid_this_month: true,
        last_paid_month: currentMonth,
        last_paid_date: tDate,
        account_id: accountId || b.account_id,
        last_tx_id: insertedTx?.id ? String(insertedTx.id) : b.last_tx_id,
        unpaid_override_month: undefined,
      };
      saveRecurringBillsCookie(c, billsList);
    } catch (e) {}
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

  const toastMsg = syncedBillName
    ? `✅ Transaction recorded & monthly bill "${syncedBillName}" (Ksh ${amtKes.toLocaleString()}) synced as PAID for ${currentMonth}!`
    : 'Transaction saved successfully';

  return c.redirect(`/?toast=${encodeURIComponent(toastMsg)}#recurring-bills-card`, 303);
});

financeRoutes.post('/transactions/delete/:id', async (c) => {
  const { supabase } = await getRequestContext(c);
  const id = c.req.param('id');
  const currentMonth = new Date().toISOString().slice(0, 7);

  try {
    const { data: txToDelete } = await supabase.from('transactions').select('*').eq('id', id).single();
    if (txToDelete) {
      // Reverse account balance impact if linked to an account
      if (txToDelete.account_id && !isTransferTransaction(txToDelete)) {
        const { data: acc } = await supabase.from('accounts').select('*').eq('id', txToDelete.account_id).single();
        if (acc) {
          const curBal = toDecimal(acc.balance);
          const amt = Number(txToDelete.amount || 0);
          const restoredBal = txToDelete.transaction_type === 'INCOME' ? curBal.minus(amt) : curBal.plus(amt);
          await supabase.from('accounts').update({ balance: restoredBal.toNumber() }).eq('id', txToDelete.account_id);
        }
      }

      // If this expense transaction had settled a recurring bill, reopen that recurring bill
      if (txToDelete.transaction_type === 'EXPENSE') {
        const bills = getRecurringBills(c);
        let updated = false;
        const txMonth = String(txToDelete.date || currentMonth).slice(0, 7);
        for (let i = 0; i < bills.length; i++) {
          const b = bills[i];
          if (
            (b.last_tx_id && String(b.last_tx_id) === String(id)) ||
            doesTransactionMatchRecurringBill(txToDelete, b, txMonth)
          ) {
            bills[i] = {
              ...b,
              is_paid_this_month: false,
              last_paid_month: undefined,
              last_paid_date: undefined,
              last_tx_id: undefined,
              unpaid_override_month: txMonth,
            };
            updated = true;
          }
        }
        if (updated) {
          saveRecurringBillsCookie(c, bills);
        }
      }
    }
  } catch (e) {}

  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) {
    return c.redirect(`/?toast=${encodeURIComponent('Failed to delete transaction: ' + error.message)}`, 303);
  }
  return c.redirect('/?toast=Transaction+deleted+(Accounts+%26+Recurring+Bills+re-synced)', 303);
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
  const rawHorizon = String(body['horizon'] || 'AUTO').toUpperCase();
  const addToSplit = body['add_to_split'] === '1' || body['add_to_split'] === 'on';

  if (!title) {
    return c.redirect('/?toast=Please+enter+a+goal+title', 303);
  }
  if (rawTarget <= 0) {
    return c.redirect('/?toast=Please+enter+a+valid+target+amount', 303);
  }

  // 1. Insert into Supabase goals using only valid schema columns
  const insertPayload: any = {
    title,
    target_amount: rawTarget,
    current_amount: 0.00,
    target_date: targetDate || null,
  };
  if (userId) {
    insertPayload.user_id = userId;
  }

  const { data: goal, error } = await supabase
    .from('goals')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error('Failed to create goal in database:', error);
    return c.redirect(`/?toast=${encodeURIComponent('Failed to create goal: ' + error.message)}`, 303);
  }

  const effectiveHorizon: GoalHorizon =
    rawHorizon === 'SHORT_TERM' || rawHorizon === 'LONG_TERM'
      ? rawHorizon
      : resolveGoalHorizon({ title, target_amount: rawTarget, target_date: targetDate });

  if (goal) {
    const existingHorizons = getSavedGoalHorizons(c);
    existingHorizons[String(goal.id)] = effectiveHorizon;
    existingHorizons[title] = effectiveHorizon;
    saveGoalHorizonsCookie(c, existingHorizons);
  }

  // 2. Persist sub-split share % into finatrack_goal_splits cookie
  if (rawSplit > 0 && goal) {
    try {
      const existingSplits = getSavedGoalSplits(c);
      existingSplits[goal.id] = rawSplit;
      existingSplits[goal.title] = rawSplit;
      setCookie(c, 'finatrack_goal_splits', encodeURIComponent(JSON.stringify(existingSplits)), {
        path: '/',
        maxAge: 31536000,
        sameSite: 'Lax',
      });
    } catch (e) {
      console.warn('Failed to save goal split cookie:', e);
    }
  }

  // 3. Persist guest goals in cookie if unauthenticated
  if (!userId && goal) {
    try {
      let guestGoalsList: any[] = [];
      const raw = getCookie(c, 'finatrack_guest_goals') || '';
      if (raw) guestGoalsList = JSON.parse(decodeURIComponent(raw));
      guestGoalsList.push({ ...goal, horizon: effectiveHorizon });
      setCookie(c, 'finatrack_guest_goals', encodeURIComponent(JSON.stringify(guestGoalsList)), {
        path: '/',
        maxAge: 31536000,
        sameSite: 'Lax',
      });
    } catch (e) {
      console.warn('Failed to save guest goal cookie:', e);
    }
  }

  // 4. Optional: Add to allocation rules if requested
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

  const horizonLabel = effectiveHorizon === 'SHORT_TERM' ? 'Short-Term' : 'Long-Term';
  return c.redirect(`/?toast=${encodeURIComponent(`${horizonLabel} goal "${title}" created!`)}#goals-card`, 303);
});

financeRoutes.post('/goals/horizon/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody().catch(() => ({} as any));
  const title = body['title'] ? String(body['title']).trim() : '';
  const requested = String(body['horizon'] || '').toUpperCase();
  const nextHorizon: GoalHorizon = requested === 'LONG_TERM' ? 'LONG_TERM' : 'SHORT_TERM';

  const existingHorizons = getSavedGoalHorizons(c);
  existingHorizons[String(id)] = nextHorizon;
  if (title) existingHorizons[title] = nextHorizon;
  saveGoalHorizonsCookie(c, existingHorizons);

  // Also update guest cookie if present
  try {
    const rawGuest = getCookie(c, 'finatrack_guest_goals') || '';
    if (rawGuest) {
      const list = JSON.parse(decodeURIComponent(rawGuest));
      if (Array.isArray(list)) {
        const updated = list.map((g: any) =>
          String(g.id) === String(id) ? { ...g, horizon: nextHorizon } : g
        );
        setCookie(c, 'finatrack_guest_goals', encodeURIComponent(JSON.stringify(updated)), {
          path: '/',
          maxAge: 31536000,
          sameSite: 'Lax',
        });
      }
    }
  } catch (e) {}

  const label = nextHorizon === 'SHORT_TERM' ? '⚡ Short-Term Goal (≤ 6 Months)' : '🏔️ Long-Term Goal (> 6 Months)';
  return c.redirect(`/?toast=${encodeURIComponent(`Categorized as ${label}`)}#goals-card`, 303);
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

  // 3. Update all active goals with this master vault account_id (wrapped in try/catch if column absent)
  try {
    let goalQuery = supabase.from('goals').update({ account_id: vaultAccountId });
    if (userId) {
      goalQuery = goalQuery.eq('user_id', userId);
    } else {
      goalQuery = goalQuery.neq('id', '00000000-0000-0000-0000-000000000000');
    }
    await goalQuery;
  } catch (e) {
    console.warn('account_id column not present in goals schema:', e);
  }

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
        transaction_type: 'TRANSFER',
        category: 'Goals Vault Transfer',
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
      transaction_type: 'TRANSFER',
      category: 'Goals Vault Transfer',
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
          transaction_type: 'TRANSFER',
          category: 'Goal Funding Transfer',
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
          transaction_type: 'TRANSFER',
          category: 'Goal Withdrawal Transfer',
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
  const { supabase, userId } = await getRequestContext(c);
  const id = c.req.param('id');
  await supabase.from('allocation_rules').delete().eq('target_id', id);
  try {
    await supabase.from('goals').delete().eq('id', id);
  } catch (e) {
    console.warn('Failed to delete goal from DB:', e);
  }

  // Update finatrack_guest_goals cookie
  try {
    const rawGuest = getCookie(c, 'finatrack_guest_goals') || '';
    if (rawGuest) {
      let guestGoalsList = JSON.parse(decodeURIComponent(rawGuest));
      guestGoalsList = guestGoalsList.filter((g: any) => String(g.id) !== String(id));
      setCookie(c, 'finatrack_guest_goals', encodeURIComponent(JSON.stringify(guestGoalsList)), {
        path: '/',
        maxAge: 31536000,
        sameSite: 'Lax',
      });
    }
  } catch (e) {}

  // Save to finatrack_deleted_goals cookie to persist guest deletions across reloads
  if (!userId) {
    try {
      let deletedList: string[] = [];
      const rawDel = getCookie(c, 'finatrack_deleted_goals') || '';
      if (rawDel) deletedList = JSON.parse(decodeURIComponent(rawDel));
      if (!deletedList.includes(String(id))) deletedList.push(String(id));
      setCookie(c, 'finatrack_deleted_goals', encodeURIComponent(JSON.stringify(deletedList)), {
        path: '/',
        maxAge: 31536000,
        sameSite: 'Lax',
      });
    } catch (e) {}
  }

  // Also clean up from goal splits cookie if present
  try {
    const splits = getSavedGoalSplits(c);
    if (splits[id] !== undefined) {
      delete splits[id];
      setCookie(c, 'finatrack_goal_splits', encodeURIComponent(JSON.stringify(splits)), {
        path: '/',
        maxAge: 31536000,
        sameSite: 'Lax',
      });
    }
  } catch (e) {}

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
  return c.redirect('/?toast=All+goal+balances+reset+to+Ksh+0.00#goals-card', 303);
});

financeRoutes.post('/goals/clear-all', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  try {
    if (userId) {
      await supabase.from('goals').delete().eq('user_id', userId);
    } else {
      await supabase.from('goals').delete().is('user_id', null);
    }
  } catch (e) {}

  try {
    setCookie(c, 'finatrack_guest_goals', encodeURIComponent(JSON.stringify([])), {
      path: '/',
      maxAge: 31536000,
      sameSite: 'Lax',
    });
    setCookie(c, 'finatrack_goal_splits', encodeURIComponent(JSON.stringify({})), {
      path: '/',
      maxAge: 31536000,
      sameSite: 'Lax',
    });
  } catch (e) {}

  return c.redirect('/?toast=All+goals+cleared.+Ready+for+your+personal+goals!#goals-card', 303);
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
  const sweepOverflow = String(body['sweep_overflow'] || '') === '1';
  const baseTarget = parseFloat(String(body['base_target'] || '0.0')) || 0.0;

  if (rawAmt <= 0) return c.redirect('/?toast=Please+enter+a+valid+amount', 303);

  let splitBaseAmt = rawAmt;
  let overflowAmt = 0;
  if (sweepOverflow && baseTarget > 0 && rawAmt > baseTarget) {
    splitBaseAmt = baseTarget;
    overflowAmt = toDecimal(rawAmt).minus(baseTarget).toDecimalPlaces(2).toNumber();
  }

  let dbRules: any[] = [];
  try {
    let query = supabase.from('allocation_rules').select('*').eq('is_active', 1);
    if (userId) query = query.eq('user_id', userId);
    const { data } = await query;
    dbRules = data || [];
  } catch (e) {
    dbRules = [];
  }

  const rules = resolveEffectiveAllocationRules(c, dbRules);

  // Get user accounts, goals, debts & bills for smart destination matching
  const [accRes, goalRes, debtRes, billRes] = await Promise.all([
    userId ? supabase.from('accounts').select('*').eq('user_id', userId) : supabase.from('accounts').select('*'),
    userId ? supabase.from('goals').select('*').eq('user_id', userId) : supabase.from('goals').select('*'),
    userId ? supabase.from('debts').select('*').eq('user_id', userId) : supabase.from('debts').select('*'),
    userId ? supabase.from('bills').select('*').eq('user_id', userId) : supabase.from('bills').select('*'),
  ]);
  const userAccounts = accRes.data || [];
  let userGoals = goalRes.data || [];
  const userDebts = debtRes.data || [];
  const userBills = billRes.data || [];

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
    const srcAcc = userAccounts.find(a => String(a.id) === String(sourceAccountId));
    if (srcAcc) {
      const newSrcBal = toDecimal(srcAcc.balance).minus(rawAmt).toNumber();
      await supabase.from('accounts').update({ balance: newSrcBal }).eq('id', sourceAccountId);
      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: sourceAccountId,
        transaction_type: 'TRANSFER',
        category: 'Waterfall Split',
        amount: rawAmt,
        description: `Waterfall Auto-Split: Distributed Ksh ${rawAmt.toLocaleString()}`,
        date: new Date().toISOString().slice(0, 10),
      });
    }
  }

  const splitResults = allocateWaterfallSplit(
    splitBaseAmt,
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

    if (res.target_type === 'ACCOUNT' || res.target_type === 'BILL') {
      let targetAcc = userAccounts.find(a => String(a.id) === String(res.target_id));
      if (!targetAcc && res.target_type === 'BILL' && res.target_id) {
        const matchedBill = userBills.find(b => String(b.id) === String(res.target_id));
        if (matchedBill && matchedBill.payment_account_id) {
          targetAcc = userAccounts.find(a => String(a.id) === String(matchedBill.payment_account_id));
        }
      }
      if (!targetAcc) {
        // Smart match by bucket name or account type
        const bName = res.bucket_name.toLowerCase();
        if (bName.includes('mmf') || bName.includes('ziidi') || bName.includes('yield') || bName.includes('invest')) {
          targetAcc = userAccounts.find(a => a.account_type === 'MMF' || a.name.toLowerCase().includes('mmf'));
        } else if (bName.includes('lock') || bName.includes('sacco') || bName.includes('save') || bName.includes('emergenc') || bName.includes('chama')) {
          targetAcc = userAccounts.find(a => a.account_type === 'SAVINGS' || a.name.toLowerCase().includes('sacco') || a.name.toLowerCase().includes('lock'));
        } else if (bName.includes('bill') || bName.includes('utilit') || bName.includes('rent')) {
          targetAcc = userAccounts.find(a => a.name.toLowerCase().includes('bill') || a.account_type === 'BANK' || a.account_type === 'MOBILE');
        }
      }

      if (targetAcc) {
        const newBal = toDecimal(targetAcc.balance).plus(splitAmt).toNumber();
        targetAcc.balance = newBal;
        await supabase.from('accounts').update({ balance: newBal }).eq('id', targetAcc.id);
        await supabase.from('transactions').insert({
          ...(userId ? { user_id: userId } : {}),
          account_id: targetAcc.id,
          transaction_type: 'TRANSFER',
          category: 'Waterfall Split',
          amount: splitAmt,
          description: `Auto-Split Allocation: ${res.bucket_name} (${res.percentage}%)`,
          date: today,
        });
      }
    } else if (res.target_type === 'GOAL') {
      // Check if target_id points to a specific goal
      const specificGoal = res.target_id ? userGoals.find(g => String(g.id) === String(res.target_id)) : null;

      // 1. Find the linked Master Holding Vault account for goals
      let vaultAcc = userAccounts.find(a => String(a.id) === String(res.target_id));
      if (!vaultAcc && specificGoal && specificGoal.account_id) {
        vaultAcc = userAccounts.find(a => String(a.id) === String(specificGoal.account_id));
      }
      if (!vaultAcc) {
        const goalWithAcc = userGoals.find(g => g.account_id);
        if (goalWithAcc) {
          vaultAcc = userAccounts.find(a => String(a.id) === String(goalWithAcc.account_id));
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

      // 2. Deposit full split bucket amount into the Master Holding Vault account
      if (vaultAcc) {
        const newBal = toDecimal(vaultAcc.balance).plus(splitAmt).toNumber();
        vaultAcc.balance = newBal;
        await supabase.from('accounts').update({ balance: newBal }).eq('id', vaultAcc.id);
        await supabase.from('transactions').insert({
          ...(userId ? { user_id: userId } : {}),
          account_id: vaultAcc.id,
          transaction_type: 'TRANSFER',
          category: 'Waterfall Split',
          amount: splitAmt,
          description: `Auto-Split Goal Vault Deposit: Ksh ${splitAmt.toLocaleString()} (${res.bucket_name} - ${res.percentage}% into ${vaultAcc.name})`,
          date: today,
        });
      }

      // 3. Allocate to specific goal if chosen, otherwise sub-allocate across all active goals
      if (specificGoal) {
        const newGoalAmt = toDecimal(specificGoal.current_amount).plus(splitAmt).toNumber();
        specificGoal.current_amount = newGoalAmt;
        try {
          await supabase.from('goals').update({ current_amount: newGoalAmt }).eq('id', specificGoal.id);
        } catch (e) {}
      } else if (userGoals.length > 0) {
        const subAllocations = allocateGoalSubSplits(splitAmt, userGoals);
        for (const sub of subAllocations) {
          if (sub.allocated_amount > 0) {
            const currentGoal = userGoals.find(g => String(g.id) === String(sub.goal_id));
            if (currentGoal) {
              const newGoalAmt = toDecimal(currentGoal.current_amount).plus(sub.allocated_amount).toNumber();
              currentGoal.current_amount = newGoalAmt;
              try {
                await supabase.from('goals').update({ current_amount: newGoalAmt }).eq('id', sub.goal_id);
              } catch (e) {}
            }
          }
        }
      }
    } else if (res.target_type === 'DEBT') {
      const targetDebt = (res.target_id && userDebts.find(d => String(d.id) === String(res.target_id))) ||
        userDebts.find(d => d.debt_type === 'I_OWE' && d.status !== 'PAID');
      if (targetDebt) {
        const newPaid = toDecimal(targetDebt.paid_amount || 0).plus(splitAmt).toNumber();
        const totalAmt = Number(targetDebt.total_amount || 0);
        const newStatus = newPaid >= totalAmt && totalAmt > 0 ? 'PAID' : (targetDebt.status || 'ACTIVE');
        try {
          await supabase.from('debts').update({ paid_amount: newPaid, status: newStatus }).eq('id', targetDebt.id);
        } catch (e) {}
      }
      const payAcc = (res.target_id && userAccounts.find(a => String(a.id) === String(res.target_id))) ||
        userAccounts.find(a => a.account_type === 'MOBILE' || a.account_type === 'BANK' || a.account_type === 'CASH');
      if (payAcc) {
        await supabase.from('transactions').insert({
          ...(userId ? { user_id: userId } : {}),
          account_id: payAcc.id,
          transaction_type: 'EXPENSE',
          category: 'Debt Repayment',
          amount: splitAmt,
          description: `Auto-Split Debt Allocation: ${res.bucket_name} (${res.percentage}%)`,
          date: today,
        });
      }
    } else {
      // 'CASH' or 'CUSTOM' or any custom user-defined bucket type
      const explicitAcc = res.target_id ? userAccounts.find(a => String(a.id) === String(res.target_id)) : null;
      if (explicitAcc) {
        const newBal = toDecimal(explicitAcc.balance).plus(splitAmt).toNumber();
        explicitAcc.balance = newBal;
        await supabase.from('accounts').update({ balance: newBal }).eq('id', explicitAcc.id);
        await supabase.from('transactions').insert({
          ...(userId ? { user_id: userId } : {}),
          account_id: explicitAcc.id,
          transaction_type: 'TRANSFER',
          category: 'Waterfall Split',
          amount: splitAmt,
          description: `Auto-Split Allocation: ${res.bucket_name} (${res.percentage}%)`,
          date: today,
        });
      } else {
        const cashAcc = userAccounts.find(a => a.account_type === 'CASH' || a.account_type === 'MOBILE' || a.account_type === 'MOBILE_MONEY');
        if (cashAcc && !sourceAccountId) {
          const newBal = toDecimal(cashAcc.balance).plus(splitAmt).toNumber();
          cashAcc.balance = newBal;
          await supabase.from('accounts').update({ balance: newBal }).eq('id', cashAcc.id);
          await supabase.from('transactions').insert({
            ...(userId ? { user_id: userId } : {}),
            account_id: cashAcc.id,
            transaction_type: 'INCOME',
            category: 'Living Expenses',
            amount: splitAmt,
            description: `Daily Allocation: ${res.bucket_name} (${res.percentage}%)`,
            date: today,
          });
        }
      }
    }
  }

  // 100% Overflow Sweep: Extra profit above base target sweeps directly to MMF / Savings
  if (overflowAmt > 0) {
    const targetMmf = userAccounts.find(a => a.account_type === 'MMF' || (a.name || '').toLowerCase().includes('mmf') || (a.name || '').toLowerCase().includes('ziidi') || (a.name || '').toLowerCase().includes('britam')) ||
      userAccounts.find(a => a.account_type === 'SAVINGS') ||
      userAccounts[0];

    if (targetMmf) {
      const newBal = toDecimal(targetMmf.balance).plus(overflowAmt).toNumber();
      targetMmf.balance = newBal;
      await supabase.from('accounts').update({ balance: newBal }).eq('id', targetMmf.id);
      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: targetMmf.id,
        transaction_type: 'TRANSFER',
        category: 'Waterfall Split',
        amount: overflowAmt,
        description: `🚀 100% Overflow Sweep: Extra Ksh ${overflowAmt.toLocaleString(undefined, {minimumFractionDigits: 2})} profit swept directly to ${targetMmf.name}`,
        date: today,
      });

      return c.redirect(`/?toast=${encodeURIComponent(`Distributed base Ksh ${splitBaseAmt.toLocaleString()} across rules + Swept Ksh ${overflowAmt.toLocaleString()} overflow directly to ${targetMmf.name}!`)}#waterfall-card`, 303);
    }
  }

  return c.redirect('/?toast=Income+successfully+distributed+via+Waterfall+Split!#waterfall-card', 303);
});

// ------------------------------------------------------------------------------
// ALLOCATION RULES UPDATE (FULL BUCKET EDITING + DYNAMIC CUSTOM OPTIONS)
// ------------------------------------------------------------------------------
financeRoutes.post('/rules/update', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();

  const deletedIds = new Set<string>(
    String(body['deleted_rule_ids'] || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );

  const orderedIds: string[] = [];
  const rawOrdered = String(body['ordered_rule_ids'] || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  for (const id of rawOrdered) {
    if (!deletedIds.has(id) && !orderedIds.includes(id)) {
      orderedIds.push(id);
    }
  }

  for (const key of Object.keys(body)) {
    if (key.startsWith('percentage_')) {
      const id = key.replace('percentage_', '');
      if (id && !deletedIds.has(id) && !orderedIds.includes(id)) {
        orderedIds.push(id);
      }
    } else if (key.startsWith('bucket_name_')) {
      const id = key.replace('bucket_name_', '');
      if (id && !deletedIds.has(id) && !orderedIds.includes(id)) {
        orderedIds.push(id);
      }
    }
  }

  const updatedRulesList: any[] = [];
  for (const id of orderedIds) {
    if (body[`bucket_name_${id}`] === undefined && body[`percentage_${id}`] === undefined) continue;
    const pct = parseFloat(String(body[`percentage_${id}`] ?? '0')) || 0.0;
    const bucketName = String(body[`bucket_name_${id}`] || 'Custom Option').trim() || 'Custom Option';
    const icon = String(body[`icon_${id}`] || '💰').trim() || '💰';
    const targetType = String(body[`target_type_${id}`] || 'CASH').trim() || 'CASH';
    const rawTargetId = body[`target_id_${id}`] ? String(body[`target_id_${id}`]).trim() : null;
    const targetId = rawTargetId && rawTargetId !== '' ? rawTargetId : null;

    updatedRulesList.push({
      id: String(id),
      bucket_name: bucketName,
      icon,
      percentage: pct,
      target_type: targetType,
      target_id: targetId,
      is_active: 1,
    });
  }

  // Also check if user typed a new option into the inline quick-add fields before hitting Save
  const inlineNewName = String(body['new_bucket_name'] || '').trim();
  if (inlineNewName) {
    const inlinePct = parseFloat(String(body['new_percentage'] || '10')) || 10.0;
    const inlineIcon = String(body['new_icon'] || '✨').trim() || '✨';
    const inlineType = String(body['new_target_type'] || 'CASH').trim() || 'CASH';
    const rawInlineTarget = body['new_target_id'] ? String(body['new_target_id']).trim() : null;
    updatedRulesList.push({
      id: `custom-${Date.now()}`,
      bucket_name: inlineNewName,
      icon: inlineIcon,
      percentage: inlinePct,
      target_type: inlineType,
      target_id: rawInlineTarget && rawInlineTarget !== '' ? rawInlineTarget : null,
      is_active: 1,
    });
  }

  // Sync with Supabase DB (resilient to schema cache or non-UUID target_ids)
  try {
    let query = supabase.from('allocation_rules').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data: existingRules } = await query;
    const existingMap = new Map((existingRules || []).map((r: any) => [String(r.id), r]));

    const activeIdSet = new Set(updatedRulesList.map(r => String(r.id)));
    for (const [existingId] of existingMap.entries()) {
      if (!activeIdSet.has(existingId) || deletedIds.has(existingId)) {
        try {
          await supabase.from('allocation_rules').delete().eq('id', existingId);
        } catch (e) {}
      }
    }

    for (let i = 0; i < updatedRulesList.length; i++) {
      const r = updatedRulesList[i];
      const dbTargetId = isValidUuid(r.target_id) ? r.target_id : null;
      if (existingMap.has(String(r.id))) {
        try {
          await supabase.from('allocation_rules').update({
            percentage: r.percentage,
            bucket_name: r.bucket_name,
            icon: r.icon,
            target_type: r.target_type,
            target_id: dbTargetId,
            is_active: 1,
          }).eq('id', r.id);
        } catch (e) {}
      } else {
        try {
          const { data: inserted } = await supabase.from('allocation_rules').insert({
            ...(userId ? { user_id: userId } : {}),
            bucket_name: r.bucket_name,
            icon: r.icon,
            percentage: r.percentage,
            target_type: r.target_type,
            target_id: dbTargetId,
            is_active: 1,
          }).select().single();
          if (inserted && inserted.id) {
            r.id = String(inserted.id);
          }
        } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('Allocation rules DB sync notice:', e);
  }

  if (updatedRulesList.length > 0) {
    saveAllocationRulesCookie(c, updatedRulesList);
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
  const icon = String(body['icon'] || '💰').trim() || '💰';
  const percentage = parseFloat(String(body['percentage'] || '10')) || 10.0;
  const targetType = String(body['target_type'] || 'CASH').trim() || 'CASH';
  const rawTargetId = body['target_id'] ? String(body['target_id']).trim() : null;
  const targetId = rawTargetId && rawTargetId !== '' ? rawTargetId : null;

  let existingDbRules: any[] = [];
  try {
    let query = supabase.from('allocation_rules').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data } = await query;
    existingDbRules = data || [];
  } catch (e) {}

  const currentRules = resolveEffectiveAllocationRules(c, existingDbRules);

  let newRuleId = `custom-${Date.now()}`;
  try {
    const { data: inserted } = await supabase.from('allocation_rules').insert({
      ...(userId ? { user_id: userId } : {}),
      bucket_name: bucketName,
      icon: icon,
      percentage: percentage,
      target_type: targetType,
      target_id: isValidUuid(targetId) ? targetId : null,
      is_active: 1,
    }).select().single();
    if (inserted && inserted.id) {
      newRuleId = String(inserted.id);
    }
  } catch (e) {}

  currentRules.push({
    id: newRuleId,
    bucket_name: bucketName,
    icon,
    percentage,
    target_type: targetType,
    target_id: targetId,
    is_active: 1,
  });

  saveAllocationRulesCookie(c, currentRules);

  return c.redirect('/?toast=New+allocation+bucket+added+successfully!', 303);
});

// ------------------------------------------------------------------------------
// ALLOCATION RULE DELETE (REMOVE BUCKET)
// ------------------------------------------------------------------------------
financeRoutes.post('/rules/delete/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const id = c.req.param('id');

  let existingDbRules: any[] = [];
  try {
    let query = supabase.from('allocation_rules').select('*');
    if (userId) query = query.eq('user_id', userId);
    const { data } = await query;
    existingDbRules = data || [];
  } catch (e) {}

  const currentRules = resolveEffectiveAllocationRules(c, existingDbRules);
  const remainingRules = currentRules.filter((r: any) => String(r.id) !== String(id));

  if (id) {
    try {
      await supabase.from('allocation_rules').delete().eq('id', id);
    } catch (e) {}
  }

  if (remainingRules.length > 0) {
    saveAllocationRulesCookie(c, remainingRules);
  }

  return c.redirect('/?toast=Allocation+bucket+removed', 303);
});

// ------------------------------------------------------------------------------
// ALLOCATION RULES RESET TO DEFAULT 5
// ------------------------------------------------------------------------------
financeRoutes.post('/rules/reset', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  try {
    if (userId) {
      await supabase.from('allocation_rules').delete().eq('user_id', userId);
    } else {
      await supabase.from('allocation_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
  } catch (e) {}

  saveAllocationRulesCookie(c, DEFAULT_ALLOCATION_RULES);
  return c.redirect('/?toast=Split+rules+reset+to+default+5+buckets!', 303);
});

financeRoutes.post('/rules/preset', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const presetKey = String(body['preset_key'] || 'PAY_YOURSELF_FLEET').trim();
  const preset = SPLIT_RATIO_PRESETS[presetKey] || SPLIT_RATIO_PRESETS.PAY_YOURSELF_FLEET;
  const targetRules = preset.rules.map(r => ({ ...r }));

  try {
    if (userId) {
      await supabase.from('allocation_rules').delete().eq('user_id', userId);
      const toInsert = targetRules.map(r => ({
        user_id: userId,
        bucket_name: r.bucket_name,
        target_type: r.target_type,
        target_id: null,
        percentage: r.percentage,
        icon: r.icon,
        is_active: 1,
      }));
      const { data: inserted } = await supabase.from('allocation_rules').insert(toInsert).select();
      if (inserted && inserted.length > 0) {
        saveAllocationRulesCookie(c, inserted);
        return c.redirect(`/?toast=${encodeURIComponent(`Applied ${preset.label}!`)}`, 303);
      }
    } else {
      await supabase.from('allocation_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
  } catch (e) {}

  saveAllocationRulesCookie(c, targetRules);
  return c.redirect(`/?toast=${encodeURIComponent(`Applied ${preset.label}!`)}`, 303);
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

  try {
    setCookie(c, 'finatrack_allocation_rules', '', { path: '/', maxAge: 0 });
  } catch (e) {}

  return c.redirect('/?toast=All+data+cleared!+Ready+for+real+data.', 303);
});

// ------------------------------------------------------------------------------
// M-PESA & BANK BATCH SMS PARSING & IMPORT
// ------------------------------------------------------------------------------
// Helper to accurately extract all M-Pesa and Kenyan Bank SMS transactions
function extractAllSmsTransactions(rawText: string): any[] {
  if (!rawText || !rawText.trim()) return [];

  // Split into chunks by double newline or common SMS boundary markers
  const chunks = rawText.split(/\n\s*\n+|(?=Dear Customer)|(?=MCo-op Cash:)/i).map(s => s.trim()).filter(Boolean);
  const results: any[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const isExplicitBank = /Dear Customer|credited with|debited with|Ref:\s*(?:BQD|EQ|KCB|COOP|[A-Za-z0-9]+)|MCo-op/i.test(chunk) && !/New M-PESA/i.test(chunk);
    if (isExplicitBank) {
      const bRes = parseMultipleBankMessages(chunk);
      for (const b of bRes) {
        if (!seen.has(b.code)) {
          seen.add(b.code);
          results.push(b);
        }
      }
    } else {
      const mRes = parseMultipleMpesaMessages(chunk);
      for (const m of mRes) {
        if (!seen.has(m.code)) {
          seen.add(m.code);
          results.push(m);
        }
      }
    }
  }

  // Fallback for contiguous unchunked text
  if (results.length === 0) {
    const isExplicitBank = /Dear Customer|credited with|debited with|MCo-op/i.test(rawText) && !/New M-PESA/i.test(rawText);
    return isExplicitBank ? parseMultipleBankMessages(rawText) : parseMultipleMpesaMessages(rawText);
  }

  return results;
}

financeRoutes.post('/finance/mpesa/parse', async (c) => {
  const body = await c.req.parseBody();
  const rawText = String(body['raw_sms'] || '');
  const parsed = extractAllSmsTransactions(rawText);
  return c.json({ success: true, count: parsed.length, transactions: parsed });
});

financeRoutes.post('/finance/mpesa/import', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const accountId = String(body['account_id'] || '');
  const rawText = String(body['raw_sms'] || '');
  const reviewedJson = String(body['reviewed_transactions'] || '');

  if (!accountId) {
    return c.redirect('/?toast=Please+select+an+account+to+import+into', 303);
  }

  let parsedList: any[] = [];
  if (reviewedJson && reviewedJson.trim()) {
    try {
      parsedList = JSON.parse(reviewedJson);
    } catch {
      parsedList = [];
    }
  }

  if (parsedList.length === 0) {
    parsedList = extractAllSmsTransactions(rawText);
  }

  if (parsedList.length === 0) {
    return c.redirect('/?toast=No+valid+M-Pesa+or+Bank+SMS+found+in+the+pasted+text', 303);
  }

  const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
  let currentBalance = acc ? toDecimal(acc.balance) : new Decimal(0);
  const bills = getRecurringBills(c);
  let billsUpdated = false;
  const currentMonth = new Date().toISOString().slice(0, 7);

  let importedCount = 0;
  for (const t of parsedList) {
    const amountKes = Number(t.amount_kes || t.amount || 0);
    if (!amountKes || amountKes <= 0) continue;

    const category = t.category || t.suggested_category || 'Living Expenses';
    const description = t.description || `SMS import #${t.code || ''}`;
    const date = t.date || new Date().toISOString().slice(0, 10);
    const txType = (t.type === 'INCOME') ? 'INCOME' : 'EXPENSE';
    
    const { data: insertedTx, error: txError } = await supabase.from('transactions').insert({
      ...(userId ? { user_id: userId } : {}),
      account_id: accountId,
      amount: amountKes,
      transaction_type: txType,
      category: category,
      description: description,
      date: date,
    }).select().single();

    if (!txError) {
      if (txType === 'INCOME') {
        currentBalance = currentBalance.plus(amountKes);
      } else {
        currentBalance = currentBalance.minus(amountKes);
        const probeTx = {
          id: insertedTx?.id,
          transaction_type: 'EXPENSE',
          category,
          description,
          date,
          amount: amountKes,
        };
        const bIdx = bills.findIndex((b) => doesTransactionMatchRecurringBill(probeTx, b, currentMonth));
        if (bIdx >= 0) {
          bills[bIdx] = {
            ...bills[bIdx],
            amount: amountKes,
            is_paid_this_month: true,
            last_paid_month: currentMonth,
            last_paid_date: date,
            account_id: accountId || bills[bIdx].account_id,
            last_tx_id: insertedTx?.id ? String(insertedTx.id) : bills[bIdx].last_tx_id,
            unpaid_override_month: undefined,
          };
          billsUpdated = true;
        }
      }
      importedCount++;
    }
  }

  if (billsUpdated) {
    saveRecurringBillsCookie(c, bills);
  }

  if (acc) {
    await supabase.from('accounts').update({ balance: currentBalance.toNumber() }).eq('id', accountId);
  }

  return c.redirect(`/?toast=Successfully+imported+${importedCount}+SMS+transactions+into+ledger!`, 303);
});

// ------------------------------------------------------------------------------
// 📄 1-CLICK PRINTABLE / PDF FINANCIAL STATEMENT
// ------------------------------------------------------------------------------
financeRoutes.get('/finance/statement', async (c) => {
  const { supabase, userId, username } = await getRequestContext(c);

  let accQuery = supabase.from('accounts').select('*').order('created_at', { ascending: true });
  let txQuery = supabase.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
  let debtQuery = supabase.from('debts').select('*').order('due_at', { ascending: true });
  let goalQuery = supabase.from('goals').select('*').order('created_at', { ascending: true });

  if (userId) {
    accQuery = accQuery.eq('user_id', userId);
    txQuery = txQuery.eq('user_id', userId);
    debtQuery = debtQuery.eq('user_id', userId);
    goalQuery = goalQuery.eq('user_id', userId);
  }

  const [accRes, txRes, debtRes, goalRes] = await Promise.all([accQuery, txQuery, debtQuery, goalQuery]);
  const accounts = accRes.data || [];
  const transactions = sortTransactionsLatestFirst(txRes.data || []);
  const debts = debtRes.data || [];
  const savedHorizons = getSavedGoalHorizons(c);
  const goals = (goalRes.data || []).map((g: any) => ({
    ...g,
    horizon: resolveGoalHorizon(g, savedHorizons),
  }));

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
  
  const now = new Date();
  const currentMonthStr = now.toISOString().slice(0, 7);
  const monthlyTxs = transactions.filter((t: any) => t.date && t.date.startsWith(currentMonthStr));
  const monthlyIncome = monthlyTxs.filter((t: any) => !isTransferTransaction(t) && t.transaction_type === 'INCOME').reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
  const monthlyExpenses = monthlyTxs.filter((t: any) => !isTransferTransaction(t) && t.transaction_type === 'EXPENSE').reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
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
    goals,
    debts,
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

// ------------------------------------------------------------------------------
// 🔁 RECURRING MONTHLY BILLS & STANDING ORDERS CHECKLIST
// ------------------------------------------------------------------------------
export interface RecurringBillItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  due_day: number; // 1 - 31
  icon: string;
  is_paid_this_month: boolean;
  last_paid_month?: string; // YYYY-MM
  last_paid_date?: string;  // YYYY-MM-DD
  account_id?: string;
  last_tx_id?: string;
  unpaid_override_month?: string;
}

export const DEFAULT_RECURRING_BILLS: RecurringBillItem[] = [
  { id: 'bill-rent', name: 'Monthly House Rent', category: 'Utilities & Bills', amount: 8500, due_day: 5, icon: '🏠', is_paid_this_month: false },
  { id: 'bill-kplc', name: 'KPLC Prepaid Tokens', category: 'Utilities & Bills', amount: 1500, due_day: 10, icon: '⚡', is_paid_this_month: false },
  { id: 'bill-wifi', name: 'Home WiFi / Monthly Data Bundle', category: 'Utilities & Bills', amount: 2500, due_day: 15, icon: '🌐', is_paid_this_month: false },
  { id: 'bill-sha', name: 'SHA / NHIF Health Cover', category: 'Utilities & Bills', amount: 500, due_day: 9, icon: '🏥', is_paid_this_month: false },
  { id: 'bill-water', name: 'Water & Garbage Bill', category: 'Utilities & Bills', amount: 600, due_day: 20, icon: '💧', is_paid_this_month: false },
];

export function doesTransactionMatchRecurringBill(t: any, b: RecurringBillItem, currentMonth: string): boolean {
  if (!t || !b) return false;
  if (isTransferTransaction(t) || t.transaction_type !== 'EXPENSE') return false;
  const txDate = String(t.date || '');
  if (currentMonth && txDate && !txDate.startsWith(currentMonth)) return false;

  if (b.last_tx_id && t.id && String(t.id) === String(b.last_tx_id)) {
    return true;
  }

  const desc = String(t.description || '').toLowerCase().trim();
  const cat = String(t.category || '').toLowerCase().trim();
  const billName = String(b.name || '').toLowerCase().trim();
  if (!billName) return false;

  if (desc && desc.includes(billName)) return true;
  if (desc.length >= 4 && billName.length >= 4 && billName.includes(desc)) return true;

  // Smart keyword matching for standard recurring bills & standing orders
  const combinedTxText = `${desc} ${cat}`;
  if ((b.id === 'bill-rent' || /\b(rent|landlord)\b/i.test(billName)) && /\b(house\s+rent|monthly\s+rent|rent|landlord)\b/i.test(combinedTxText)) {
    return true;
  }
  if ((b.id === 'bill-kplc' || /\b(kplc|token|prepaid|electricity)\b/i.test(billName)) && /\b(kplc|k\.p\.l\.c|token|tokens|prepaid|kenya\s+power|electricity)\b/i.test(combinedTxText)) {
    return true;
  }
  if ((b.id === 'bill-wifi' || /\b(wifi|wi-fi|internet|zuku|fibre|fiber|data\s+bundle)\b/i.test(billName)) && /\b(wifi|wi-fi|internet|zuku|safaricom\s+home|fibre|fiber|monthly\s+data)\b/i.test(combinedTxText)) {
    return true;
  }
  if ((b.id === 'bill-sha' || /\b(sha|shif|nhif)\b/i.test(billName)) && /\b(sha|shif|nhif|social\s+health)\b/i.test(combinedTxText)) {
    return true;
  }
  if ((b.id === 'bill-water' || /\b(water|garbage)\b/i.test(billName)) && /\b(water|garbage|sewerage|nairobi\s+water)\b/i.test(combinedTxText)) {
    return true;
  }

  return false;
}

export function reconcileRecurringBillsAndTransactions(
  c: any,
  rawBills: RecurringBillItem[],
  dbBills: any[] = [],
  txs: any[] = [],
  currentMonth: string
): { recurringBills: RecurringBillItem[]; syncedTransactions: any[] } {
  const bills = [...(rawBills || [])];
  const existingNames = new Set(bills.map((b) => String(b.name || '').toLowerCase().trim()));

  // Merge any DB bills from `bills` table so Standing Orders & DB bills are unified
  for (const dbBill of (dbBills || [])) {
    const title = String(dbBill.title || dbBill.name || '').trim();
    if (!title || existingNames.has(title.toLowerCase())) continue;
    existingNames.add(title.toLowerCase());
    const paidThisMonth = Boolean(dbBill.last_paid_date && String(dbBill.last_paid_date).startsWith(currentMonth));
    bills.push({
      id: String(dbBill.id || `db-bill-${Date.now()}`),
      name: title,
      category: dbBill.category && !String(dbBill.category).toUpperCase().startsWith('UTILITY') ? String(dbBill.category) : 'Utilities & Bills',
      amount: Number(dbBill.amount || 0),
      due_day: Math.min(31, Math.max(1, Number(dbBill.due_day || 5))),
      icon: '⚡',
      is_paid_this_month: paidThisMonth,
      last_paid_month: paidThisMonth ? currentMonth : undefined,
      last_paid_date: paidThisMonth ? String(dbBill.last_paid_date) : undefined,
      account_id: dbBill.payment_account_id ? String(dbBill.payment_account_id) : undefined,
    });
  }

  const syncedTxs = [...(txs || [])];
  let cookieDirty = false;

  for (let i = 0; i < bills.length; i++) {
    const b = bills[i];
    const matchedTxs = syncedTxs.filter((t) => doesTransactionMatchRecurringBill(t, b, currentMonth));

    if (matchedTxs.length > 0) {
      // Expense transaction(s) exist in the ledger for this recurring bill this month
      if (b.unpaid_override_month !== currentMonth) {
        const latestTx = matchedTxs[0];
        const totalPaidKes = matchedTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const nextAmt = totalPaidKes > 0 ? totalPaidKes : b.amount;
        if (!b.is_paid_this_month || b.amount !== nextAmt || b.last_paid_month !== currentMonth) {
          bills[i] = {
            ...b,
            amount: nextAmt,
            is_paid_this_month: true,
            last_paid_month: currentMonth,
            last_paid_date: latestTx.date || `${currentMonth}-01`,
            account_id: latestTx.account_id || b.account_id,
            last_tx_id: latestTx.id ? String(latestTx.id) : b.last_tx_id,
          };
          cookieDirty = true;
        }
      }
    } else if (b.is_paid_this_month && b.amount > 0) {
      // Bill is marked as paid in the checklist, but no corresponding expense transaction is in `txs` yet!
      // Inject the expense transaction into `syncedTxs` so Monthly Expenses, Category Budgets, and Ledger match 100%.
      const paidDate = b.last_paid_date && String(b.last_paid_date).startsWith(currentMonth)
        ? b.last_paid_date
        : new Date().toISOString().slice(0, 10);
      syncedTxs.unshift({
        id: b.last_tx_id || `bill-sync-${b.id}-${currentMonth}`,
        account_id: b.account_id || null,
        transaction_type: 'EXPENSE',
        category: b.category || 'Utilities & Bills',
        amount: Number(b.amount) || 0,
        description: `${b.icon || '⚡'} ${b.name} (Monthly Bill — ${currentMonth})`,
        date: paidDate,
        created_at: new Date().toISOString(),
      });
    }
  }

  if (cookieDirty) {
    saveRecurringBillsCookie(c, bills);
  }

  return {
    recurringBills: bills,
    syncedTransactions: syncedTxs,
  };
}

export function getRecurringBills(c: any): RecurringBillItem[] {
  const currentMonth = new Date().toISOString().slice(0, 7);
  try {
    const raw = getCookie(c, 'finatrack_recurring_bills') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((b: any) => ({
          ...b,
          amount: Number(b.amount) || 0,
          due_day: Math.min(31, Math.max(1, Number(b.due_day) || 5)),
          // Auto-reset paid flag if a new calendar month has started
          is_paid_this_month: b.last_paid_month === currentMonth ? Boolean(b.is_paid_this_month) : false,
        }));
      }
    }
  } catch (e) {}
  return DEFAULT_RECURRING_BILLS;
}

export function saveRecurringBillsCookie(c: any, bills: RecurringBillItem[]): void {
  try {
    const trimmed = (bills || []).slice(0, 30);
    setCookie(c, 'finatrack_recurring_bills', encodeURIComponent(JSON.stringify(trimmed)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

financeRoutes.post('/finance/bills/create', async (c) => {
  const body = await c.req.parseBody();
  const name = String(body['name'] || '').trim();
  const amount = Math.max(0, parseFloat(String(body['amount'] || '0')) || 0);
  const due_day = Math.min(31, Math.max(1, parseInt(String(body['due_day'] || '5'), 10) || 5));
  const icon = String(body['icon'] || '⚡').trim() || '⚡';
  const category = String(body['category'] || 'Utilities & Bills').trim() || 'Utilities & Bills';
  const accountId = body['account_id'] ? String(body['account_id']).trim() : undefined;

  if (!name || amount <= 0) {
    return c.redirect('/?toast=Please+enter+a+valid+bill+name+and+amount#recurring-bills-card', 303);
  }

  const bills = getRecurringBills(c);
  const newBill: RecurringBillItem = {
    id: 'bill_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
    name,
    category,
    amount,
    due_day,
    icon,
    is_paid_this_month: false,
    ...(accountId ? { account_id: accountId } : {}),
  };

  saveRecurringBillsCookie(c, [...bills, newBill]);
  return c.redirect(`/?toast=${encodeURIComponent(`✅ Added recurring bill: ${name} (Ksh ${amount.toLocaleString()}/mo)`)}#recurring-bills-card`, 303);
});

financeRoutes.post('/finance/bills/toggle-pay/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const billId = c.req.param('id');
  const body = await c.req.parseBody().catch(() => ({} as any));
  const accountId = String(body['account_id'] || '').trim();
  const customAmt = parseFloat(String(body['paid_amount'] || '0'));

  const bills = getRecurringBills(c);
  const idx = bills.findIndex((b) => String(b.id) === String(billId));
  if (idx < 0) {
    return c.redirect('/?toast=Recurring+bill+not+found#recurring-bills-card', 303);
  }

  const target = bills[idx];
  const nowIso = new Date().toISOString().slice(0, 10);
  const currentMonth = nowIso.slice(0, 7);
  const markingPaid = !target.is_paid_this_month;
  const effectiveAmt = customAmt > 0 ? customAmt : target.amount;
  const effectiveAccId = accountId || target.account_id || '';

  let createdTxId: string | undefined = undefined;

  if (markingPaid && effectiveAmt > 0) {
    // Always record the expense transaction so Recurring Bills and Monthly Expenses stay 100% synced
    try {
      if (effectiveAccId) {
        const { data: acc } = await supabase.from('accounts').select('*').eq('id', effectiveAccId).single();
        if (acc) {
          const updatedBal = toDecimal(acc.balance).minus(effectiveAmt).toNumber();
          await supabase.from('accounts').update({ balance: updatedBal }).eq('id', effectiveAccId);
        }
      }
      const { data: insertedTx } = await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: effectiveAccId || null,
        transaction_type: 'EXPENSE',
        category: target.category || 'Utilities & Bills',
        amount: effectiveAmt,
        description: `${target.icon || '⚡'} ${target.name} (Monthly Bill — ${currentMonth})`,
        date: nowIso,
      }).select().single();
      if (insertedTx && insertedTx.id) {
        createdTxId = String(insertedTx.id);
      }
    } catch (e) {}
  } else if (!markingPaid) {
    // Reopening as unpaid: remove the corresponding expense transaction(s) for this month and restore account balance
    try {
      let txQuery = supabase.from('transactions').select('*').eq('transaction_type', 'EXPENSE');
      if (userId) txQuery = txQuery.eq('user_id', userId);
      const { data: expTxs } = await txQuery;
      const matchingTxs = (expTxs || []).filter((t: any) =>
        (target.last_tx_id && String(t.id) === String(target.last_tx_id)) ||
        doesTransactionMatchRecurringBill(t, target, currentMonth)
      );

      for (const mTx of matchingTxs) {
        if (mTx.account_id) {
          const { data: acc } = await supabase.from('accounts').select('*').eq('id', mTx.account_id).single();
          if (acc) {
            const restoredBal = toDecimal(acc.balance).plus(Number(mTx.amount || 0)).toNumber();
            await supabase.from('accounts').update({ balance: restoredBal }).eq('id', mTx.account_id);
          }
        }
        await supabase.from('transactions').delete().eq('id', mTx.id);
      }
    } catch (e) {}
  }

  bills[idx] = {
    ...target,
    amount: effectiveAmt,
    is_paid_this_month: markingPaid,
    last_paid_month: markingPaid ? currentMonth : undefined,
    last_paid_date: markingPaid ? nowIso : undefined,
    account_id: effectiveAccId || undefined,
    last_tx_id: markingPaid ? createdTxId : undefined,
    unpaid_override_month: markingPaid ? undefined : currentMonth,
  };
  saveRecurringBillsCookie(c, bills);

  const msg = markingPaid
    ? `✅ Marked "${target.name}" (Ksh ${effectiveAmt.toLocaleString()}) as PAID & recorded in Monthly Expenses!`
    : `↺ Reopened "${target.name}" as unpaid & removed from Monthly Expenses.`;
  return c.redirect(`/?toast=${encodeURIComponent(msg)}#recurring-bills-card`, 303);
});

financeRoutes.post('/finance/bills/sync-expenses', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const nowIso = new Date().toISOString().slice(0, 10);
  const currentMonth = nowIso.slice(0, 7);

  let txQuery = supabase.from('transactions').select('*').order('date', { ascending: false });
  if (userId) txQuery = txQuery.eq('user_id', userId);
  const { data: existingTxs } = await txQuery;
  const txs = existingTxs || [];

  const bills = getRecurringBills(c);
  let newlyRecordedInLedger = 0;
  let newlyMarkedPaidFromLedger = 0;

  for (let i = 0; i < bills.length; i++) {
    const b = bills[i];
    const matchedTxs = txs.filter((t: any) => doesTransactionMatchRecurringBill(t, b, currentMonth));

    if (matchedTxs.length > 0) {
      const latestTx = matchedTxs[0];
      const totalPaid = matchedTxs.reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
      if (!b.is_paid_this_month || b.amount !== totalPaid) {
        newlyMarkedPaidFromLedger++;
      }
      bills[i] = {
        ...b,
        amount: totalPaid > 0 ? totalPaid : b.amount,
        is_paid_this_month: true,
        last_paid_month: currentMonth,
        last_paid_date: latestTx.date || nowIso,
        account_id: latestTx.account_id || b.account_id,
        last_tx_id: latestTx.id ? String(latestTx.id) : b.last_tx_id,
        unpaid_override_month: undefined,
      };
    } else if (b.is_paid_this_month && b.amount > 0) {
      // Paid in checklist but missing in `transactions` table -> insert it now
      try {
        const paidDate = b.last_paid_date && String(b.last_paid_date).startsWith(currentMonth) ? b.last_paid_date : nowIso;
        const { data: insertedTx } = await supabase.from('transactions').insert({
          ...(userId ? { user_id: userId } : {}),
          account_id: b.account_id || null,
          transaction_type: 'EXPENSE',
          category: b.category || 'Utilities & Bills',
          amount: Number(b.amount) || 0,
          description: `${b.icon || '⚡'} ${b.name} (Monthly Bill — ${currentMonth})`,
          date: paidDate,
        }).select().single();
        if (insertedTx && insertedTx.id) {
          bills[i] = {
            ...b,
            last_tx_id: String(insertedTx.id),
          };
        }
        newlyRecordedInLedger++;
      } catch (e) {}
    }
  }

  saveRecurringBillsCookie(c, bills);
  const summaryMsg = `🔄 Recurring Bills & Monthly Expenses 100% synced (${newlyMarkedPaidFromLedger} matched from ledger, ${newlyRecordedInLedger} backfilled to expenses)!`;
  return c.redirect(`/?toast=${encodeURIComponent(summaryMsg)}#recurring-bills-card`, 303);
});

financeRoutes.post('/finance/bills/delete/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const billId = c.req.param('id');
  const currentMonth = new Date().toISOString().slice(0, 7);
  const allBills = getRecurringBills(c);
  const target = allBills.find((b) => String(b.id) === String(billId));

  if (target && target.is_paid_this_month && target.last_tx_id) {
    try {
      const { data: mTx } = await supabase.from('transactions').select('*').eq('id', target.last_tx_id).single();
      if (mTx) {
        if (mTx.account_id) {
          const { data: acc } = await supabase.from('accounts').select('*').eq('id', mTx.account_id).single();
          if (acc) {
            const restoredBal = toDecimal(acc.balance).plus(Number(mTx.amount || 0)).toNumber();
            await supabase.from('accounts').update({ balance: restoredBal }).eq('id', mTx.account_id);
          }
        }
        await supabase.from('transactions').delete().eq('id', mTx.id);
      }
    } catch (e) {}
  }

  const bills = allBills.filter((b) => String(b.id) !== String(billId));
  saveRecurringBillsCookie(c, bills);
  return c.redirect('/?toast=Recurring+bill+removed#recurring-bills-card', 303);
});



