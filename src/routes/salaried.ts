import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { AppEnv, getRequestContext } from '../db/supabase';
import { toDecimal, allocateWaterfallSplit } from '../utils/math';
import { resolveEffectiveAllocationRules } from './finance';

export const salariedRoutes = new Hono<{ Bindings: AppEnv }>();

export interface SalariedConfig {
  monthly_net_salary: number;
  payday_day: number; // e.g. 25, 28, 30
  side_hustle_estimate: number;
  employer_name: string;
  living_budget_monthly: number;
}

export function getSalariedConfig(c: any): SalariedConfig {
  const defaults: SalariedConfig = {
    monthly_net_salary: 65000,
    payday_day: 28,
    side_hustle_estimate: 0,
    employer_name: 'Main Employer',
    living_budget_monthly: 18000,
  };
  try {
    const raw = getCookie(c, 'finatrack_salaried_config') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      return { ...defaults, ...parsed };
    }
  } catch (e) {}
  return defaults;
}

export function saveSalariedConfigCookie(c: any, config: SalariedConfig): void {
  try {
    setCookie(c, 'finatrack_salaried_config', encodeURIComponent(JSON.stringify(config)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

export function calculateDaysUntilPayday(paydayDay: number): { daysRemaining: number; nextPaydayDate: string } {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-indexed
  const currentDay = today.getDate();

  let targetDate = new Date(currentYear, currentMonth, paydayDay);
  if (currentDay > paydayDay) {
    // Payday already passed this month, target next month
    targetDate = new Date(currentYear, currentMonth + 1, paydayDay);
  }

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  return {
    daysRemaining: diffDays,
    nextPaydayDate: targetDate.toISOString().slice(0, 10),
  };
}

// ------------------------------------------------------------------------------
// 1. UPDATE SALARIED CONFIG
// ------------------------------------------------------------------------------
salariedRoutes.post('/salaried/config', async (c) => {
  const body = await c.req.parseBody();
  const current = getSalariedConfig(c);

  const updated: SalariedConfig = {
    monthly_net_salary: Math.max(0, parseFloat(String(body['monthly_net_salary'] || '65000')) || current.monthly_net_salary),
    payday_day: Math.min(31, Math.max(1, parseInt(String(body['payday_day'] || '28'), 10) || current.payday_day)),
    side_hustle_estimate: Math.max(0, parseFloat(String(body['side_hustle_estimate'] || '0')) || 0),
    employer_name: String(body['employer_name'] || current.employer_name).trim(),
    living_budget_monthly: Math.max(0, parseFloat(String(body['living_budget_monthly'] || '18000')) || current.living_budget_monthly),
  };

  saveSalariedConfigCookie(c, updated);
  return c.redirect('/salaried?toast=Payday+and+salary+settings+updated+successfully', 303);
});

// ------------------------------------------------------------------------------
// 2. RUN MONTHLY PAYDAY WATERFALL SPLIT
// ------------------------------------------------------------------------------
salariedRoutes.post('/salaried/payday/split', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();
  const config = getSalariedConfig(c);

  const salaryAmount = parseFloat(String(body['salary_amount'] || config.monthly_net_salary)) || config.monthly_net_salary;
  if (salaryAmount <= 0) {
    return c.redirect('/salaried?toast=Please+enter+a+valid+salary+amount', 303);
  }

  // Use effective allocation rules
  const { data: dbRules } = await supabase.from('allocation_rules').select('*').eq(userId ? 'user_id' : 'id', userId || 'demo');
  const rules = resolveEffectiveAllocationRules(c, dbRules || []);

  const splitResults = allocateWaterfallSplit(
    salaryAmount,
    rules.map((r: any) => ({
      id: r.id,
      bucket_name: r.bucket_name,
      target_type: r.target_type,
      target_id: r.target_id,
      percentage: Number(r.percentage),
    }))
  );

  const today = new Date().toISOString().slice(0, 10);
  const { data: accounts } = await supabase.from('accounts').select('*').eq(userId ? 'user_id' : 'id', userId || 'demo');
  const userAccs = accounts || [];

  for (const res of splitResults) {
    const splitAmt = parseFloat(res.allocated_amount);
    if (splitAmt <= 0) continue;

    // Route to appropriate account
    let targetAcc = userAccs.find(a => String(a.id) === String(res.target_id));
    if (!targetAcc) {
      const bName = res.bucket_name.toLowerCase();
      if (bName.includes('mmf') || bName.includes('ziidi') || bName.includes('britam')) {
        targetAcc = userAccs.find(a => a.account_type === 'MMF' || a.name.toLowerCase().includes('mmf'));
      } else if (bName.includes('sacco') || bName.includes('lock') || bName.includes('save')) {
        targetAcc = userAccs.find(a => a.account_type === 'SAVINGS' || a.name.toLowerCase().includes('sacco'));
      } else if (bName.includes('bill') || bName.includes('rent')) {
        targetAcc = userAccs.find(a => a.account_type === 'BANK' || a.account_type === 'MOBILE');
      }
    }

    if (targetAcc) {
      const newBal = toDecimal(targetAcc.balance).plus(splitAmt).toNumber();
      try {
        await supabase.from('accounts').update({ balance: newBal }).eq('id', targetAcc.id);
        await supabase.from('transactions').insert({
          ...(userId ? { user_id: userId } : {}),
          account_id: targetAcc.id,
          transaction_type: 'INCOME',
          category: 'Salary & Employment',
          amount: splitAmt,
          description: `Payday Waterfall: ${res.bucket_name} (${res.percentage}%)`,
          date: today,
        });
      } catch (e) {}
    }
  }

  return c.redirect(`/salaried?toast=${encodeURIComponent(`🎉 Payday Waterfall Executed! Ksh ${salaryAmount.toLocaleString()} distributed across your wealth, goals, obligations, and living buckets.`)}`, 303);
});
