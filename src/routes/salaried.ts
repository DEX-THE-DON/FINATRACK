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

export interface SalariedLoanRecord {
  id: string;
  user_id?: string;
  person_name: string;
  debt_type: 'I_OWE' | 'OWED_TO_ME'; // I_OWE = Loan Borrowed, OWED_TO_ME = Money Credited / Lent Out
  loan_category?: string; // e.g. 'SACCO Loan', 'Salary Advance', 'Bank Checkoff Loan', 'HELB', 'Mobile Loan', 'Personal Credit / Lent'
  total_amount: number;
  paid_amount: number;
  monthly_installment?: number;
  issued_at: string;
  due_at: string;
  status: 'ACTIVE' | 'PAID';
  description?: string;
  created_at?: string;
}

export function getSavedSalariedLoans(c: any): SalariedLoanRecord[] {
  try {
    const raw = getCookie(c, 'finatrack_salaried_loans') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function saveSalariedLoansCookie(c: any, loans: SalariedLoanRecord[]): void {
  try {
    const trimmed = loans.slice(0, 40);
    setCookie(c, 'finatrack_salaried_loans', encodeURIComponent(JSON.stringify(trimmed)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

export function resolveEffectiveSalariedLoans(c: any, dbDebts: any[] = []): SalariedLoanRecord[] {
  const cookieLoans = getSavedSalariedLoans(c);
  const byId = new Map<string, SalariedLoanRecord>();

  // Load DB debts first
  for (const d of (dbDebts || [])) {
    if (!d || !d.id) continue;
    const rawDesc = String(d.description || '');
    // Extract optional category prefix "[Category] notes"
    let category = d.debt_type === 'OWED_TO_ME' ? 'Personal Credit / Lent' : 'Personal / Checkoff Loan';
    let cleanDesc = rawDesc;
    const catMatch = rawDesc.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (catMatch) {
      category = catMatch[1];
      cleanDesc = catMatch[2];
    }
    byId.set(String(d.id), {
      id: String(d.id),
      user_id: d.user_id,
      person_name: String(d.person_name || 'Counterparty'),
      debt_type: d.debt_type === 'OWED_TO_ME' ? 'OWED_TO_ME' : 'I_OWE',
      loan_category: d.loan_category || category,
      total_amount: Number(d.total_amount) || 0,
      paid_amount: Number(d.paid_amount) || 0,
      monthly_installment: Number(d.monthly_installment) || 0,
      issued_at: String(d.issued_at || new Date().toISOString().slice(0, 10)),
      due_at: String(d.due_at || new Date().toISOString().slice(0, 10)),
      status: d.status === 'PAID' ? 'PAID' : 'ACTIVE',
      description: cleanDesc,
      created_at: d.created_at,
    });
  }

  // Merge cookie records (override or supplement for guest mode / extra fields)
  for (const cl of cookieLoans) {
    if (!cl || !cl.id) continue;
    const existing = byId.get(String(cl.id));
    if (existing) {
      byId.set(String(cl.id), {
        ...existing,
        loan_category: cl.loan_category || existing.loan_category,
        monthly_installment: cl.monthly_installment || existing.monthly_installment,
      });
    } else {
      byId.set(String(cl.id), cl);
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1;
    return String(a.due_at || '').localeCompare(String(b.due_at || ''));
  });
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

// ------------------------------------------------------------------------------
// 3. SALARIED LOANS BORROWED (I_OWE) & CREDITED / LENT OUT (OWED_TO_ME)
// ------------------------------------------------------------------------------

// 3a. Create a Loan Borrowed or Money Credited / Lent Out Record
salariedRoutes.post('/salaried/loans/create', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();

  const person_name = String(body['person_name'] || '').trim();
  const debt_type: 'I_OWE' | 'OWED_TO_ME' = String(body['debt_type'] || 'I_OWE') === 'OWED_TO_ME' ? 'OWED_TO_ME' : 'I_OWE';
  const loan_category = String(body['loan_category'] || (debt_type === 'I_OWE' ? 'SACCO / Checkoff Loan' : 'Personal Credit / Lent')).trim();
  const total_amount = Math.max(0, parseFloat(String(body['total_amount'] || '0')) || 0);
  const paid_amount = Math.max(0, parseFloat(String(body['paid_amount'] || '0')) || 0);
  const monthly_installment = Math.max(0, parseFloat(String(body['monthly_installment'] || '0')) || 0);
  const issued_at = String(body['issued_at'] || new Date().toISOString().slice(0, 10));
  const due_at = String(body['due_at'] || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const description = String(body['description'] || '').trim();
  const link_account = body['link_account'] === 'on' || body['link_account'] === 'true';
  const account_id = String(body['account_id'] || '');

  if (!person_name || total_amount <= 0) {
    return c.redirect('/salaried?toast=Please+provide+counterparty+name+and+valid+loan+amount#salaried-loans-card', 303);
  }

  const status: 'ACTIVE' | 'PAID' = paid_amount >= total_amount ? 'PAID' : 'ACTIVE';
  const taggedDescription = loan_category ? `[${loan_category}] ${description}`.trim() : description;
  let newRecordId = 'salloan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

  // Save to Supabase debts table if available
  try {
    const { data: inserted } = await supabase
      .from('debts')
      .insert([
        {
          ...(userId ? { user_id: userId } : {}),
          person_name,
          debt_type,
          total_amount: toDecimal(total_amount).toFixed(2),
          paid_amount: toDecimal(paid_amount).toFixed(2),
          issued_at,
          due_at,
          status,
          description: taggedDescription,
        },
      ])
      .select('*')
      .single();

    if (inserted && inserted.id) {
      newRecordId = String(inserted.id);
    }
  } catch (e) {}

  // Also persist in cookie so guest mode & extra metadata (loan_category, monthly_installment) always work
  const currentCookieLoans = getSavedSalariedLoans(c);
  const newLoanRecord: SalariedLoanRecord = {
    id: newRecordId,
    ...(userId ? { user_id: userId } : {}),
    person_name,
    debt_type,
    loan_category,
    total_amount: Number(toDecimal(total_amount).toFixed(2)),
    paid_amount: Number(toDecimal(paid_amount).toFixed(2)),
    monthly_installment: Number(toDecimal(monthly_installment).toFixed(2)),
    issued_at,
    due_at,
    status,
    description,
    created_at: new Date().toISOString(),
  };
  saveSalariedLoansCookie(c, [newLoanRecord, ...currentCookieLoans]);

  // Optional Account Balance & Ledger Sync
  if (link_account && account_id) {
    try {
      const netCashAmount = Math.max(0, total_amount - paid_amount);
      if (netCashAmount > 0) {
        const { data: acc } = await supabase.from('accounts').select('*').eq('id', account_id).single();
        if (acc) {
          // I_OWE = borrowed cash received (+balance), OWED_TO_ME = money lent out from account (-balance)
          const currentBal = toDecimal(acc.balance);
          const updatedBal = debt_type === 'I_OWE' ? currentBal.plus(netCashAmount) : currentBal.minus(netCashAmount);
          await supabase.from('accounts').update({ balance: updatedBal.toFixed(2) }).eq('id', account_id);

          await supabase.from('transactions').insert([
            {
              ...(userId ? { user_id: userId } : {}),
              account_id,
              transaction_type: debt_type === 'I_OWE' ? 'INCOME' : 'EXPENSE',
              category: debt_type === 'I_OWE' ? `Loan Borrowed (${loan_category})` : `Money Credited / Lent (${loan_category})`,
              amount: toDecimal(netCashAmount).toFixed(2),
              description:
                debt_type === 'I_OWE'
                  ? `Loan disbursement from ${person_name} (${loan_category})`
                  : `Money credited / lent to ${person_name} (${loan_category})`,
              date: issued_at,
            },
          ]);
        }
      }
    } catch (e) {}
  }

  const label = debt_type === 'I_OWE' ? `Loan Borrowed from ${person_name}` : `Credit / Money Lent to ${person_name}`;
  return c.redirect(`/salaried?toast=${encodeURIComponent(`✅ Logged ${label} (Ksh ${total_amount.toLocaleString()})`)}#salaried-loans-card`, 303);
});

// 3b. Record a Loan Repayment (I_OWE) or Credit Collection (OWED_TO_ME)
salariedRoutes.post('/salaried/loans/repay/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const loanId = c.req.param('id');
  const body = await c.req.parseBody();

  const repayAmount = Math.max(0, parseFloat(String(body['repayment_amount'] || '0')) || 0);
  const accountId = String(body['account_id'] || '');

  if (repayAmount <= 0) {
    return c.redirect('/salaried?toast=Enter+a+valid+repayment+or+collection+amount#salaried-loans-card', 303);
  }

  const cookieLoans = getSavedSalariedLoans(c);
  const cookieIdx = cookieLoans.findIndex((l) => String(l.id) === String(loanId));

  let targetLoan: SalariedLoanRecord | null = cookieIdx >= 0 ? cookieLoans[cookieIdx] : null;

  // Also check Supabase debts table
  try {
    let query = supabase.from('debts').select('*').eq('id', loanId);
    if (userId) query = query.eq('user_id', userId);
    const { data: dbDebt } = await query.single();
    if (dbDebt) {
      targetLoan = {
        id: String(dbDebt.id),
        person_name: dbDebt.person_name,
        debt_type: dbDebt.debt_type === 'OWED_TO_ME' ? 'OWED_TO_ME' : 'I_OWE',
        loan_category: targetLoan?.loan_category || 'Loan / Credit',
        total_amount: Number(dbDebt.total_amount) || 0,
        paid_amount: Number(dbDebt.paid_amount) || 0,
        issued_at: dbDebt.issued_at,
        due_at: dbDebt.due_at,
        status: dbDebt.status,
        description: dbDebt.description,
      };
    }
  } catch (e) {}

  if (!targetLoan) {
    return c.redirect('/salaried?toast=Loan+record+not+found#salaried-loans-card', 303);
  }

  const newPaid = toDecimal(targetLoan.paid_amount).plus(repayAmount);
  const totalDec = toDecimal(targetLoan.total_amount);
  const isFullyPaid = newPaid.greaterThanOrEqualTo(totalDec);
  const newStatus: 'ACTIVE' | 'PAID' = isFullyPaid ? 'PAID' : 'ACTIVE';

  // Update Supabase if present
  try {
    let updateQ = supabase
      .from('debts')
      .update({
        paid_amount: newPaid.toFixed(2),
        status: newStatus,
      })
      .eq('id', loanId);
    if (userId) updateQ = updateQ.eq('user_id', userId);
    await updateQ;
  } catch (e) {}

  // Update Cookie
  if (cookieIdx >= 0) {
    cookieLoans[cookieIdx] = {
      ...cookieLoans[cookieIdx],
      paid_amount: Number(newPaid.toFixed(2)),
      status: newStatus,
    };
    saveSalariedLoansCookie(c, cookieLoans);
  } else {
    saveSalariedLoansCookie(c, [
      {
        ...targetLoan,
        paid_amount: Number(newPaid.toFixed(2)),
        status: newStatus,
      },
      ...cookieLoans,
    ]);
  }

  // Optional Account Sync
  if (accountId) {
    try {
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', accountId).single();
      if (acc) {
        const currentBal = toDecimal(acc.balance);
        // Repaying a loan I_OWE reduces account balance; collecting a credit OWED_TO_ME increases account balance
        const updatedBal =
          targetLoan.debt_type === 'I_OWE' ? currentBal.minus(repayAmount) : currentBal.plus(repayAmount);
        await supabase.from('accounts').update({ balance: updatedBal.toFixed(2) }).eq('id', accountId);

        await supabase.from('transactions').insert([
          {
            ...(userId ? { user_id: userId } : {}),
            account_id: accountId,
            transaction_type: targetLoan.debt_type === 'I_OWE' ? 'EXPENSE' : 'INCOME',
            category: targetLoan.debt_type === 'I_OWE' ? 'Loan Repayment' : 'Credit Collection',
            amount: toDecimal(repayAmount).toFixed(2),
            description:
              targetLoan.debt_type === 'I_OWE'
                ? `Loan repayment to ${targetLoan.person_name}`
                : `Collected credit repayment from ${targetLoan.person_name}`,
            date: new Date().toISOString().slice(0, 10),
          },
        ]);
      }
    } catch (e) {}
  }

  const actionVerb = targetLoan.debt_type === 'I_OWE' ? 'Repaid' : 'Collected';
  return c.redirect(
    `/salaried?toast=${encodeURIComponent(`💸 ${actionVerb} Ksh ${repayAmount.toLocaleString()} for ${targetLoan.person_name}${isFullyPaid ? ' (Fully Settled! 🎉)' : ''}`)}#salaried-loans-card`,
    303
  );
});

// 3c. Toggle Status (ACTIVE <-> PAID)
salariedRoutes.post('/salaried/loans/toggle-status/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const loanId = c.req.param('id');

  const cookieLoans = getSavedSalariedLoans(c);
  const cookieIdx = cookieLoans.findIndex((l) => String(l.id) === String(loanId));
  let newStatus: 'ACTIVE' | 'PAID' = 'PAID';

  try {
    let query = supabase.from('debts').select('status, total_amount, paid_amount').eq('id', loanId);
    if (userId) query = query.eq('user_id', userId);
    const { data: existing } = await query.single();
    if (existing) {
      newStatus = existing.status === 'ACTIVE' ? 'PAID' : 'ACTIVE';
      const updatedPaid = newStatus === 'PAID' ? existing.total_amount : existing.paid_amount;
      let upQ = supabase.from('debts').update({ status: newStatus, paid_amount: updatedPaid }).eq('id', loanId);
      if (userId) upQ = upQ.eq('user_id', userId);
      await upQ;
    } else if (cookieIdx >= 0) {
      newStatus = cookieLoans[cookieIdx].status === 'ACTIVE' ? 'PAID' : 'ACTIVE';
    }
  } catch (e) {
    if (cookieIdx >= 0) {
      newStatus = cookieLoans[cookieIdx].status === 'ACTIVE' ? 'PAID' : 'ACTIVE';
    }
  }

  if (cookieIdx >= 0) {
    cookieLoans[cookieIdx].status = newStatus;
    if (newStatus === 'PAID') {
      cookieLoans[cookieIdx].paid_amount = cookieLoans[cookieIdx].total_amount;
    }
    saveSalariedLoansCookie(c, cookieLoans);
  }

  return c.redirect(`/salaried?toast=${encodeURIComponent(`Loan/Credit marked as ${newStatus}`)}#salaried-loans-card`, 303);
});

// 3d. Delete Loan / Credit Record
salariedRoutes.post('/salaried/loans/delete/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const loanId = c.req.param('id');

  try {
    let delQ = supabase.from('debts').delete().eq('id', loanId);
    if (userId) delQ = delQ.eq('user_id', userId);
    await delQ;
  } catch (e) {}

  const cookieLoans = getSavedSalariedLoans(c).filter((l) => String(l.id) !== String(loanId));
  saveSalariedLoansCookie(c, cookieLoans);

  return c.redirect('/salaried?toast=Loan+or+credit+record+deleted#salaried-loans-card', 303);
});


