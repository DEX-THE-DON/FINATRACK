import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { AppEnv, getRequestContext } from '../db/supabase';
import { toDecimal } from '../utils/math';
import { Decimal } from 'decimal.js';

export const traderRoutes = new Hono<{ Bindings: AppEnv }>();

export interface TraderCloseoutLog {
  id: string;
  user_id?: string;
  date: string;
  gross_sales: number;
  restock_fund: number;
  kanjo_fee: number;
  porter_fee: number;
  packaging_fee: number;
  airtime_fee: number;
  misc_fee: number;
  total_expenses: number;
  net_profit: number;
  notes?: string;
  created_at: string;
}

export interface TraderCustomerCredit {
  id: string;
  user_id?: string;
  customer_name: string;
  phone?: string;
  items: string;
  amount: number;
  paid_amount: number;
  due_date?: string;
  status: 'UNPAID' | 'PAID' | 'PARTIAL';
  notes?: string;
  created_at: string;
}

export interface TraderConfig {
  daily_profit_target: number;
  default_restock_kes: number;
  stall_name: string;
  market_location: string;
  till_number: string;
}

export function getSavedTraderLogs(c: any): TraderCloseoutLog[] {
  try {
    const raw = getCookie(c, 'finatrack_trader_logs') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function saveTraderLogsCookie(c: any, logs: TraderCloseoutLog[]): void {
  try {
    setCookie(c, 'finatrack_trader_logs', encodeURIComponent(JSON.stringify(logs.slice(0, 100))), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

export function getSavedTraderCredits(c: any): TraderCustomerCredit[] {
  try {
    const raw = getCookie(c, 'finatrack_trader_credits') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function saveTraderCreditsCookie(c: any, credits: TraderCustomerCredit[]): void {
  try {
    setCookie(c, 'finatrack_trader_credits', encodeURIComponent(JSON.stringify(credits.slice(0, 100))), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

export function getTraderConfig(c: any): TraderConfig {
  const defaults: TraderConfig = {
    daily_profit_target: 1000,
    default_restock_kes: 3000,
    stall_name: 'Mama Mboga Fresh Groceries',
    market_location: 'Marikiti / City Market',
    till_number: '',
  };
  try {
    const raw = getCookie(c, 'finatrack_trader_config') || '';
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      return { ...defaults, ...parsed };
    }
  } catch (e) {}
  return defaults;
}

export function saveTraderConfigCookie(c: any, config: TraderConfig): void {
  try {
    setCookie(c, 'finatrack_trader_config', encodeURIComponent(JSON.stringify(config)), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'Lax',
    });
  } catch (e) {}
}

// ------------------------------------------------------------------------------
// 1. LOG DAILY MARKET / STALL CLOSEOUT
// ------------------------------------------------------------------------------
traderRoutes.post('/trader/closeout', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const body = await c.req.parseBody();

  const date = String(body['date'] || new Date().toISOString().slice(0, 10));
  const grossSales = Math.max(0, parseFloat(String(body['gross_sales'] || '0.0')) || 0);
  const restockFund = Math.max(0, parseFloat(String(body['restock_fund'] || '0.0')) || 0);
  const kanjoFee = Math.max(0, parseFloat(String(body['kanjo_fee'] || '0.0')) || 0);
  const porterFee = Math.max(0, parseFloat(String(body['porter_fee'] || '0.0')) || 0);
  const packagingFee = Math.max(0, parseFloat(String(body['packaging_fee'] || '0.0')) || 0);
  const airtimeFee = Math.max(0, parseFloat(String(body['airtime_fee'] || '0.0')) || 0);
  const miscFee = Math.max(0, parseFloat(String(body['misc_fee'] || '0.0')) || 0);
  const notes = String(body['notes'] || '').trim();

  const totalExpenses = kanjoFee + porterFee + packagingFee + airtimeFee + miscFee;
  // Pure Net = Gross Sales - (Inventory Restock Fund + Daily Operating Stall Expenses)
  const netProfit = toDecimal(grossSales).minus(restockFund).minus(totalExpenses).toNumber();

  const newLog: TraderCloseoutLog = {
    id: `trader-log-${Date.now()}`,
    user_id: userId || undefined,
    date,
    gross_sales: grossSales,
    restock_fund: restockFund,
    kanjo_fee: kanjoFee,
    porter_fee: porterFee,
    packaging_fee: packagingFee,
    airtime_fee: airtimeFee,
    misc_fee: miscFee,
    total_expenses: totalExpenses,
    net_profit: netProfit,
    notes,
    created_at: new Date().toISOString(),
  };

  // 1. Persist to Cookie
  const savedLogs = getSavedTraderLogs(c);
  savedLogs.unshift(newLog);
  saveTraderLogsCookie(c, savedLogs);

  // 2. Also record as an income transaction for net profit into Till / Cash account
  try {
    const { data: accounts } = await supabase.from('accounts').select('*').eq(userId ? 'user_id' : 'id', userId || 'demo');
    const tillAcc = (accounts || []).find((a: any) => a.account_type === 'MOBILE_MONEY' || a.name.toLowerCase().includes('till') || a.account_type === 'CASH') || (accounts || [])[0];

    if (tillAcc && netProfit > 0) {
      await supabase.from('transactions').insert({
        ...(userId ? { user_id: userId } : {}),
        account_id: tillAcc.id,
        transaction_type: 'INCOME',
        category: 'Business Revenue',
        amount: netProfit,
        description: `Market Stall Daily Profit (${date}): Gross Ksh ${grossSales.toLocaleString()} - Restock Ksh ${restockFund.toLocaleString()} - Expenses Ksh ${totalExpenses.toLocaleString()}`,
        date,
      });
    }
  } catch (e) {}

  const config = getTraderConfig(c);
  const overflow = Math.max(0, netProfit - config.daily_profit_target);
  const toastMsg = overflow > 0
    ? `Soko closeout saved! Pure profit: Ksh ${netProfit.toLocaleString()} (Target Ksh ${config.daily_profit_target.toLocaleString()} + Ksh ${overflow.toLocaleString()} Overflow swept to MMF/Chama!)`
    : `Soko closeout saved! Pure profit: Ksh ${netProfit.toLocaleString()}`;

  return c.redirect(`/trader?toast=${encodeURIComponent(toastMsg)}`, 303);
});

// ------------------------------------------------------------------------------
// 2. DAFTARI YA MKOPO (CUSTOMER CREDIT TRACKING)
// ------------------------------------------------------------------------------
traderRoutes.post('/trader/credit/add', async (c) => {
  const { userId } = await getRequestContext(c);
  const body = await c.req.parseBody();

  const customerName = String(body['customer_name'] || '').trim();
  const phone = String(body['phone'] || '').trim();
  const items = String(body['items'] || '').trim();
  const amount = Math.max(0, parseFloat(String(body['amount'] || '0.0')) || 0);
  const dueDate = String(body['due_date'] || '');
  const notes = String(body['notes'] || '').trim();

  if (!customerName || amount <= 0) {
    return c.redirect('/trader?toast=Please+enter+customer+name+and+valid+amount', 303);
  }

  const newCredit: TraderCustomerCredit = {
    id: `credit-${Date.now()}`,
    user_id: userId || undefined,
    customer_name: customerName,
    phone,
    items,
    amount,
    paid_amount: 0,
    due_date: dueDate || undefined,
    status: 'UNPAID',
    notes,
    created_at: new Date().toISOString(),
  };

  const savedCredits = getSavedTraderCredits(c);
  savedCredits.unshift(newCredit);
  saveTraderCreditsCookie(c, savedCredits);

  return c.redirect(`/trader?toast=${encodeURIComponent(`Daftari record added: ${customerName} owes Ksh ${amount.toLocaleString()}`)}`, 303);
});

traderRoutes.post('/trader/credit/settle/:id', async (c) => {
  const { supabase, userId } = await getRequestContext(c);
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const paidAmt = parseFloat(String(body['amount'] || '0.0')) || 0;

  const savedCredits = getSavedTraderCredits(c);
  const credit = savedCredits.find(cr => String(cr.id) === String(id));

  if (credit) {
    const settleAmt = paidAmt > 0 ? paidAmt : (credit.amount - credit.paid_amount);
    credit.paid_amount = Math.min(credit.amount, credit.paid_amount + settleAmt);
    credit.status = credit.paid_amount >= credit.amount ? 'PAID' : 'PARTIAL';
    saveTraderCreditsCookie(c, savedCredits);

    // Optionally credit Till / Cash account
    try {
      const { data: accounts } = await supabase.from('accounts').select('*').eq(userId ? 'user_id' : 'id', userId || 'demo');
      const cashAcc = (accounts || []).find((a: any) => a.account_type === 'MOBILE_MONEY' || a.account_type === 'CASH') || (accounts || [])[0];
      if (cashAcc && settleAmt > 0) {
        await supabase.from('transactions').insert({
          ...(userId ? { user_id: userId } : {}),
          account_id: cashAcc.id,
          transaction_type: 'INCOME',
          category: 'Customer Debt Repayment',
          amount: settleAmt,
          description: `Daftari ya Mkopo Payment: ${credit.customer_name} paid Ksh ${settleAmt.toLocaleString()}`,
          date: new Date().toISOString().slice(0, 10),
        });
      }
    } catch (e) {}

    return c.redirect(`/trader?toast=${encodeURIComponent(`Payment of Ksh ${settleAmt.toLocaleString()} recorded for ${credit.customer_name}!`)}`, 303);
  }

  return c.redirect('/trader?toast=Record+not+found', 303);
});

traderRoutes.post('/trader/credit/delete/:id', async (c) => {
  const id = c.req.param('id');
  let savedCredits = getSavedTraderCredits(c);
  savedCredits = savedCredits.filter(cr => String(cr.id) !== String(id));
  saveTraderCreditsCookie(c, savedCredits);
  return c.redirect('/trader?toast=Record+removed', 303);
});

// ------------------------------------------------------------------------------
// 3. UPDATE TRADER CONFIG
// ------------------------------------------------------------------------------
traderRoutes.post('/trader/config', async (c) => {
  const body = await c.req.parseBody();
  const current = getTraderConfig(c);

  const updated: TraderConfig = {
    daily_profit_target: parseFloat(String(body['daily_profit_target'] || '1000')) || current.daily_profit_target,
    default_restock_kes: parseFloat(String(body['default_restock_kes'] || '3000')) || current.default_restock_kes,
    stall_name: String(body['stall_name'] || current.stall_name).trim(),
    market_location: String(body['market_location'] || current.market_location).trim(),
    till_number: String(body['till_number'] || '').trim(),
  };

  saveTraderConfigCookie(c, updated);
  return c.redirect('/trader?toast=Stall+and+Soko+settings+updated+successfully', 303);
});
