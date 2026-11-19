import { parseMultipleMpesaMessages } from './mpesa';
import { parseMultipleBankMessages } from './bankSms';
import { calculateBankMmfYieldBreakdown, inferKenyanInstitutionRate, isTransferTransaction } from './math';

export interface ParsedSmartEntry {
  transaction_type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: string;
  description: string;
  date: string;
  account_id: string | null;
  account_name: string | null;
  source: 'SHORTHAND' | 'MPESA_SMS' | 'BANK_SMS';
  confidence: 'HIGH' | 'MEDIUM';
}

export interface SmartShiftDefaults {
  fuelCost: number;
  foodSpent: number;
  airtimeSpent: number;
  platform: string;
  avgKm: number;
  avgGross: number;
  startTime: string;
  endTime: string;
  sampleSize: number;
}

export interface SmartInsight {
  id: string;
  icon: string;
  title: string;
  message: string;
  badge: string;
  tone: 'emerald' | 'amber' | 'rose' | 'cyan' | 'indigo';
  actionLabel?: string;
  actionHref?: string;
}

export interface SystemIntelligenceReport {
  headline: string;
  projectedMonthEndNet: number;
  projectedMonthEndIncome: number;
  projectedMonthEndExpenses: number;
  idleCashKes: number;
  missedMonthlyInterestKes: number;
  upcoming7DayObligationsKes: number;
  insights: SmartInsight[];
}

const INCOME_KEYWORDS = [
  { pattern: /\b(uber|bolt|little|glovo|boda|rider|delivery|deliveries|trip|trips|errand|errands|shift|fare|fares|gig)\b/i, category: 'Rider & Boda Deliveries' },
  { pattern: /\b(salary|payroll|wages|payday|stipend|commission|bonus|allowance)\b/i, category: 'Salary & Wages' },
  { pattern: /\b(sale|sales|sold|customer|shop|kiosk|mboga|produce|revenue|profit|stock\s*sale)\b/i, category: 'Business Sales' },
  { pattern: /\b(interest|dividend|yield|mmf\s*profit|ziidi\s*profit|britam\s*profit)\b/i, category: 'Investment & Interest' },
  { pattern: /\b(received|earned|income|paid\s*me|client|freelance|tip|tips|deposit|inflow)\b/i, category: 'General Income' },
];

const EXPENSE_KEYWORDS = [
  { pattern: /\b(ev|swap|battery|spiro|roam|ampersand|charge|charging)\b/i, category: 'EV Battery Swap & Charging' },
  { pattern: /\b(fuel|petrol|diesel|gas|rubis|total|shell|ola|kobil|oil\s*libya|stabex)\b/i, category: 'Fuel & Petrol' },
  { pattern: /\b(service|oil|tyre|tire|puncture|brake|chain|sprocket|mechanic|spare|spares|repair|wash|bike\s*wash)\b/i, category: 'Bike Maintenance' },
  { pattern: /\b(lunch|dinner|breakfast|food|chapati|mandazi|chai|tea|coffee|supper|grocer|groceries|naivas|quickmart|carrefour|supermarket|water|milk|bread|nyama|mboga|mama\s*mboga|snack|snacks|soda)\b/i, category: 'Food & Groceries' },
  { pattern: /\b(kplc|token|tokens|electric|electricity|power|wifi|internet|zuku|safaricom\s*home|airtime|bundles|data|credo|bill|bills|water\s*bill|garbage)\b/i, category: 'Utilities & Bills' },
  { pattern: /\b(stock|restock|wholesale|inventory|supplier|supplies|marikiti|wakulima)\b/i, category: 'Business Stock & Supplies' },
  { pattern: /\b(loan|debt|fuliza|mshwari|kcb\s*mpesa|tala|branch|hustler|repay|repayment|kodi|installment)\b/i, category: 'Debt Repayment' },
  { pattern: /\b(rent|house|home|barber|salon|clothes|shoes|shoe|transport|matatu|fare|hospital|chemist|medicine|clinic|school|fees|family|mum|dad|wife|kids|living)\b/i, category: 'Living Expenses' },
];

/**
 * Matches a hint word in user input against the user's real accounts.
 */
function matchAccountFromText(text: string, accounts: any[]): { id: string | null; name: string | null } {
  const list = Array.isArray(accounts) ? accounts : [];
  if (list.length === 0) return { id: null, name: null };

  const lower = text.toLowerCase();
  // 1. Direct account name match
  for (const acc of list) {
    const accName = String(acc.name || '').toLowerCase();
    if (!accName) continue;
    if (lower.includes(accName)) {
      return { id: String(acc.id), name: String(acc.name) };
    }
    // Check significant tokens of account name (e.g. "mpesa", "kcb", "equity", "ziidi", "cash")
    const tokens = accName.split(/[\s\-_/]+/).filter(t => t.length >= 3);
    for (const tok of tokens) {
      const re = new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(lower)) {
        return { id: String(acc.id), name: String(acc.name) };
      }
    }
  }

  // 2. Common Kenyan wallet aliases
  if (/\bm-?pesa\b/i.test(lower)) {
    const mpesa = list.find(a => /m-?pesa/i.test(String(a.name || '')) || String(a.account_type || '').toUpperCase() === 'MOBILE_MONEY');
    if (mpesa) return { id: String(mpesa.id), name: String(mpesa.name) };
  }
  if (/\bcash\b/i.test(lower)) {
    const cash = list.find(a => /cash|wallet|pocket/i.test(String(a.name || '')) || String(a.account_type || '').toUpperCase() === 'CASH');
    if (cash) return { id: String(cash.id), name: String(cash.name) };
  }

  // 3. Default to primary liquid account (M-Pesa -> Cash -> Bank -> first account)
  const preferred =
    list.find(a => /m-?pesa/i.test(String(a.name || '')) && !/lock|save|mmf/i.test(String(a.name || ''))) ||
    list.find(a => ['MOBILE_MONEY', 'CASH'].includes(String(a.account_type || '').toUpperCase())) ||
    list.find(a => String(a.account_type || '').toUpperCase() === 'BANK') ||
    list[0];

  return preferred ? { id: String(preferred.id), name: String(preferred.name) } : { id: null, name: null };
}

/**
 * Parses a natural-language shorthand command OR raw M-Pesa / Bank SMS into structured entries.
 * Examples:
 *  - "fuel 500"
 *  - "uber 2.5k, lunch 150, airtime 50"
 *  - "+3200 bolt mpesa"
 *  - "QA12345678 Confirmed. You have received Ksh1,500.00 from..."
 */
export function parseSmartCommand(
  rawInput: string,
  accounts: any[] = [],
  defaultDate?: string
): ParsedSmartEntry[] {
  const input = String(rawInput || '').trim();
  if (!input) return [];

  const todayIso = defaultDate || new Date().toISOString().slice(0, 10);

  // 1. Auto-detect M-Pesa SMS
  if (/\bConfirmed\b/i.test(input) && /\b(Ksh|KES)\s*[\d,]+/i.test(input)) {
    const mpesaParsed = parseMultipleMpesaMessages(input);
    if (mpesaParsed.length > 0) {
      const mpesaAcc = matchAccountFromText('mpesa', accounts);
      return mpesaParsed.map(m => ({
        transaction_type: m.type,
        amount: m.amount_kes,
        category: m.suggested_category,
        description: `${m.party}${m.code ? ` (${m.code})` : ''}`,
        date: m.date || todayIso,
        account_id: mpesaAcc.id,
        account_name: mpesaAcc.name,
        source: 'MPESA_SMS',
        confidence: 'HIGH',
      }));
    }
  }

  // 2. Auto-detect Kenyan Bank SMS
  if (/\b(credited|debited|A\/C|account|Equity|KCB|Co-op|NCBA|ABSA|Stanbic)\b/i.test(input) && /\b(Ksh|KES)\s*[\d,]+/i.test(input)) {
    const bankParsed = parseMultipleBankMessages(input);
    if (bankParsed.length > 0) {
      return bankParsed.map(b => {
        const bankAcc = matchAccountFromText(b.bank_name || input, accounts);
        return {
          transaction_type: b.type,
          amount: b.amount_kes,
          category: b.suggested_category,
          description: `${b.bank_name}: ${b.party}${b.code ? ` (${b.code})` : ''}`,
          date: b.date || todayIso,
          account_id: bankAcc.id,
          account_name: bankAcc.name,
          source: 'BANK_SMS',
          confidence: 'HIGH',
        };
      });
    }
  }

  // 3. Natural-language / shorthand multi-entry parser (split by newline, semicolon, or comma between entries)
  const segments = input
    .split(/[\n;]+|,(?=\s*[+\-a-zA-Z])/)
    .map(s => s.trim())
    .filter(Boolean);

  const results: ParsedSmartEntry[] = [];

  for (const seg of segments) {
    // Support "yesterday" relative date
    let entryDate = todayIso;
    let working = seg;
    if (/\byesterday\b/i.test(working)) {
      const dt = new Date(`${todayIso}T12:00:00Z`);
      dt.setUTCDate(dt.getUTCDate() - 1);
      entryDate = dt.toISOString().slice(0, 10);
      working = working.replace(/\byesterday\b/gi, '').trim();
    }

    // Extract amount (supports 2.5k, 1,500, Ksh 500, +2400, -150)
    const amtMatch = working.match(/(?:^|[\s(])([+\-])?\s*(?:ksh\.?|kes\.?)?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?\b/i);
    if (!amtMatch) continue;

    const explicitSign = amtMatch[1] || '';
    const rawNum = parseFloat(amtMatch[2].replace(/,/g, ''));
    const multiplier = amtMatch[3] ? 1000 : 1;
    const amount = Math.round(rawNum * multiplier * 100) / 100;
    if (!isFinite(amount) || amount <= 0) continue;

    // Determine transaction_type & category
    let txType: 'INCOME' | 'EXPENSE' = 'EXPENSE';
    let category = 'Living Expenses';
    let confidence: 'HIGH' | 'MEDIUM' = 'MEDIUM';

    let matched = false;
    for (const rule of EXPENSE_KEYWORDS) {
      if (rule.pattern.test(working)) {
        txType = 'EXPENSE';
        category = rule.category;
        confidence = 'HIGH';
        matched = true;
        break;
      }
    }

    if (!matched || explicitSign === '+') {
      for (const rule of INCOME_KEYWORDS) {
        if (rule.pattern.test(working)) {
          txType = 'INCOME';
          category = rule.category;
          confidence = 'HIGH';
          matched = true;
          break;
        }
      }
    }

    if (explicitSign === '+') {
      txType = 'INCOME';
      if (!matched) category = 'General Income';
      confidence = 'HIGH';
    } else if (explicitSign === '-') {
      txType = 'EXPENSE';
      confidence = 'HIGH';
    }

    // Build clean human-readable description
    const cleanedDesc = working
      .replace(amtMatch[0], ' ')
      .replace(/\b(ksh|kes|mpesa|m-pesa|cash|kcb|equity|today)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const description = cleanedDesc
      ? cleanedDesc.charAt(0).toUpperCase() + cleanedDesc.slice(1)
      : category;

    const matchedAcc = matchAccountFromText(working, accounts);

    results.push({
      transaction_type: txType,
      amount,
      category,
      description,
      date: entryDate,
      account_id: matchedAcc.id,
      account_name: matchedAcc.name,
      source: 'SHORTHAND',
      confidence,
    });
  }

  return results;
}

/**
 * Learns typical daily rider shift values from recent logs + strict saver config
 * so the rider can close a shift with just 1 number (Gross Earned).
 */
export function inferSmartShiftDefaults(
  riderLogs: any[] = [],
  strictSaverConfig: any = null,
  activeBike: any = null
): SmartShiftDefaults {
  const isEv = String(activeBike?.power_type || '').toUpperCase() === 'ELECTRIC';
  const fallbackFuel = Number(strictSaverConfig?.fuel_allowance_kes ?? (isEv ? 300 : 500));
  const fallbackFood = Number(strictSaverConfig?.lunch_allowance_kes ?? 150);
  const fallbackAirtime = Number(strictSaverConfig?.airtime_allowance_kes ?? 50);

  const recent = (Array.isArray(riderLogs) ? riderLogs : []).slice(0, 7);
  if (recent.length === 0) {
    return {
      fuelCost: fallbackFuel,
      foodSpent: fallbackFood,
      airtimeSpent: fallbackAirtime,
      platform: 'Uber',
      avgKm: 110,
      avgGross: Number(strictSaverConfig?.required_gross_kes || 1700),
      startTime: '08:00',
      endTime: '19:00',
      sampleSize: 0,
    };
  }

  const avg = (vals: number[], fallback: number) => {
    const valid = vals.filter(v => isFinite(v) && v >= 0);
    if (valid.length === 0) return fallback;
    return Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);
  };

  const fuelCost = avg(recent.map(r => Number(r.fuel_cost || 0)), fallbackFuel);
  const foodSpent = avg(recent.map(r => Number(r.food_spent || 0)), fallbackFood);
  const airtimeSpent = avg(recent.map(r => Number(r.airtime_spent || 0)), fallbackAirtime);
  const avgKm = avg(recent.map(r => Number(r.km_driven || 0)).filter(k => k > 0), 110);
  const avgGross = avg(recent.map(r => Number(r.total_earned || 0)).filter(g => g > 0), Number(strictSaverConfig?.required_gross_kes || 1700));

  // Most common platform
  const platCounts: Record<string, number> = {};
  for (const r of recent) {
    const p = String(r.platform || '').trim();
    if (p) platCounts[p] = (platCounts[p] || 0) + 1;
  }
  const topPlatform = Object.entries(platCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Uber';

  const latestStart = recent.find(r => r.start_time)?.start_time || '08:00';
  const latestEnd = recent.find(r => r.end_time)?.end_time || '19:00';

  return {
    fuelCost,
    foodSpent,
    airtimeSpent,
    platform: topPlatform,
    avgKm,
    avgGross,
    startTime: String(latestStart),
    endTime: String(latestEnd),
    sampleSize: recent.length,
  };
}

/**
 * Cross-Hub Autopilot Intelligence Engine:
 * Forecasts month-end net cashflow, detects idle 0%-yield cash, spots 7-day bill/debt collisions,
 * flags category spending spikes, and highlights fastest goal acceleration.
 */
export function computeSystemIntelligence(params: {
  accounts: any[];
  transactions: any[];
  recurringBills?: any[];
  debts?: any[];
  goals?: any[];
  monthlyIncome: number;
  monthlyExpenses: number;
  currentDay: number;
  daysInMonth: number;
  todayIso: string;
}): SystemIntelligenceReport {
  const {
    accounts = [],
    transactions = [],
    recurringBills = [],
    debts = [],
    goals = [],
    monthlyIncome = 0,
    monthlyExpenses = 0,
    currentDay = 1,
    daysInMonth = 30,
    todayIso,
  } = params;

  const elapsed = Math.max(1, currentDay);
  const projectedMonthEndIncome = Math.round((monthlyIncome / elapsed) * daysInMonth);
  const projectedMonthEndExpenses = Math.round((monthlyExpenses / elapsed) * daysInMonth);
  const projectedMonthEndNet = projectedMonthEndIncome - projectedMonthEndExpenses;

  const insights: SmartInsight[] = [];

  // 1. 7-Day Bill & Debt Collision Radar
  const currentMonth = todayIso.slice(0, 7);
  const todayMs = new Date(`${todayIso}T00:00:00Z`).getTime();
  let upcoming7DayObligationsKes = 0;
  let upcomingCount = 0;

  for (const b of recurringBills) {
    if (b.is_paid_this_month || b.last_paid_month === currentMonth) continue;
    const dueDay = Number(b.due_day || 1);
    const diff = dueDay - currentDay;
    if (diff >= -2 && diff <= 7) {
      upcoming7DayObligationsKes += Number(b.amount || 0);
      upcomingCount++;
    }
  }
  for (const d of debts) {
    const rem = Math.max(0, Number(d.total_amount || 0) - Number(d.paid_amount || 0));
    if (rem <= 0 || String(d.status || '').toUpperCase() === 'PAID') continue;
    if (d.due_at) {
      const dueMs = new Date(String(d.due_at).slice(0, 10) + 'T00:00:00Z').getTime();
      const diffDays = Math.ceil((dueMs - todayMs) / 86400000);
      if (diffDays <= 7) {
        upcoming7DayObligationsKes += rem;
        upcomingCount++;
      }
    }
  }

  const liquidZeroYieldCash = accounts
    .filter(a => {
      const rate = Number(a.interest_rate_p_a || 0);
      const t = String(a.account_type || '').toUpperCase();
      return rate <= 0 && ['MOBILE_MONEY', 'CASH'].includes(t) && !/mmf|ziidi|britam|sacco|lock/i.test(String(a.name || ''));
    })
    .reduce((s, a) => s + Math.max(0, Number(a.balance || 0)), 0);

  const totalLiquidBalance = accounts
    .filter(a => ['MOBILE_MONEY', 'CASH', 'BANK'].includes(String(a.account_type || '').toUpperCase()))
    .reduce((s, a) => s + Math.max(0, Number(a.balance || 0)), 0);

  if (upcoming7DayObligationsKes > 0) {
    const shortfall = Math.max(0, upcoming7DayObligationsKes - totalLiquidBalance);
    if (shortfall > 0) {
      insights.push({
        id: 'bill-collision',
        icon: '🚨',
        title: `7-Day Obligation Alert (${upcomingCount} due)`,
        message: `Ksh ${upcoming7DayObligationsKes.toLocaleString()} is due within 7 days. Set aside Ksh ${Math.ceil(shortfall / 7).toLocaleString()}/day to cover the Ksh ${shortfall.toLocaleString()} gap cleanly.`,
        badge: 'Action Needed',
        tone: 'rose',
        actionLabel: 'View Bills',
        actionHref: '#recurring-bills-card',
      });
    } else {
      insights.push({
        id: 'bill-covered',
        icon: '🛡️',
        title: `Next 7 Days Covered (${upcomingCount} due)`,
        message: `Ksh ${upcoming7DayObligationsKes.toLocaleString()} in upcoming bills/debts is 100% covered by your Ksh ${totalLiquidBalance.toLocaleString()} liquid cash.`,
        badge: 'Safe',
        tone: 'emerald',
        actionLabel: 'Review Bills',
        actionHref: '#recurring-bills-card',
      });
    }
  }

  // 2. Idle Cash -> MMF Yield Optimizer
  const safeBuffer = Math.max(5000, upcoming7DayObligationsKes * 1.5);
  const idleCashKes = Math.max(0, Math.round(liquidZeroYieldCash - safeBuffer));
  let missedMonthlyInterestKes = 0;

  if (idleCashKes >= 2000) {
    const bestYieldAcc = accounts
      .map(a => ({ acc: a, info: inferKenyanInstitutionRate(a.name, a.account_type, a.interest_rate_p_a) }))
      .filter(x => x.info.isMmfOrYieldAccount && x.info.ratePa > 0)
      .sort((a, b) => b.info.ratePa - a.info.ratePa)[0];

    const targetRate = bestYieldAcc ? bestYieldAcc.info.ratePa : 13.5;
    const targetName = bestYieldAcc ? String(bestYieldAcc.acc.name) : 'Ziidi / Britam MMF';
    const yieldCalc = calculateBankMmfYieldBreakdown(idleCashKes, targetRate, true, 30);
    missedMonthlyInterestKes = Math.round(yieldCalc.monthlyNetCompounded);

    if (missedMonthlyInterestKes >= 20) {
      insights.push({
        id: 'idle-cash-yield',
        icon: '📈',
        title: `Ksh ${idleCashKes.toLocaleString()} Idle Cash Detected`,
        message: `Moving excess wallet cash above your buffer into ${targetName} (${targetRate}% p.a.) earns ~Ksh ${missedMonthlyInterestKes.toLocaleString()}/month net passive income automatically.`,
        badge: `+Ksh ${missedMonthlyInterestKes}/mo`,
        tone: 'cyan',
        actionLabel: 'Auto-Split Now',
        actionHref: '#pay-yourself-card',
      });
    }
  }

  // 3. Spending Spike / Leak Detector (last 7 days vs previous 28 days weekly avg)
  const sevenDaysMs = 7 * 86400000;
  const thirtyFiveDaysMs = 35 * 86400000;
  const recent7ByCat: Record<string, number> = {};
  const prior28ByCat: Record<string, number> = {};

  for (const t of transactions) {
    if (isTransferTransaction(t) || t.transaction_type !== 'EXPENSE') continue;
    const dStr = String(t.date || '').slice(0, 10);
    if (!dStr) continue;
    const tMs = new Date(`${dStr}T00:00:00Z`).getTime();
    if (isNaN(tMs)) continue;
    const age = todayMs - tMs;
    const cat = String(t.category || 'Living Expenses');
    const amt = Number(t.amount || 0);
    if (age >= 0 && age <= sevenDaysMs) {
      recent7ByCat[cat] = (recent7ByCat[cat] || 0) + amt;
    } else if (age > sevenDaysMs && age <= thirtyFiveDaysMs) {
      prior28ByCat[cat] = (prior28ByCat[cat] || 0) + amt;
    }
  }

  let topSpike: { cat: string; recent: number; avg: number; pct: number } | null = null;
  for (const [cat, recentAmt] of Object.entries(recent7ByCat)) {
    const priorAvgWeekly = (prior28ByCat[cat] || 0) / 4;
    if (priorAvgWeekly >= 500 && recentAmt > priorAvgWeekly * 1.25) {
      const pct = Math.round(((recentAmt - priorAvgWeekly) / priorAvgWeekly) * 100);
      if (!topSpike || pct > topSpike.pct) {
        topSpike = { cat, recent: Math.round(recentAmt), avg: Math.round(priorAvgWeekly), pct };
      }
    }
  }
  if (topSpike) {
    insights.push({
      id: 'spend-spike',
      icon: '🔍',
      title: `${topSpike.cat} Up +${topSpike.pct}% This Week`,
      message: `You spent Ksh ${topSpike.recent.toLocaleString()} vs your Ksh ${topSpike.avg.toLocaleString()}/wk average. Trimming this leak saves ~Ksh ${((topSpike.recent - topSpike.avg) * 4).toLocaleString()}/month.`,
      badge: `+${topSpike.pct}% Spike`,
      tone: 'amber',
      actionLabel: 'Inspect Ledger',
      actionHref: '#transactions-card',
    });
  }

  // 4. Month-End Net Cashflow Forecast
  if (monthlyIncome > 0 || monthlyExpenses > 0) {
    if (projectedMonthEndNet >= 0) {
      insights.push({
        id: 'month-forecast',
        icon: '🔮',
        title: `Month-End Forecast: +Ksh ${projectedMonthEndNet.toLocaleString()} Net`,
        message: `At your current daily pace, you are projected to earn Ksh ${projectedMonthEndIncome.toLocaleString()} and retain Ksh ${projectedMonthEndNet.toLocaleString()} by month-end.`,
        badge: 'Projected Surplus',
        tone: 'emerald',
      });
    } else {
      insights.push({
        id: 'month-forecast-warn',
        icon: '⚠️',
        title: `Projected Deficit: Ksh ${Math.abs(projectedMonthEndNet).toLocaleString()}`,
        message: `Expenses are pacing ahead of income. Adding Ksh ${Math.ceil(Math.abs(projectedMonthEndNet) / Math.max(1, daysInMonth - currentDay + 1)).toLocaleString()}/day or trimming spend flips you back to surplus.`,
        badge: 'Pace Warning',
        tone: 'amber',
      });
    }
  }

  // 5. Closest Savings Goal Accelerator
  const activeGoals = goals
    .map(g => {
      const tgt = Number(g.target_amount || 0);
      const cur = Number(g.current_amount || 0);
      const rem = Math.max(0, tgt - cur);
      const pct = tgt > 0 ? Math.round((cur / tgt) * 100) : 0;
      return { title: String(g.title || 'Goal'), rem, pct, tgt };
    })
    .filter(g => g.tgt > 0 && g.rem > 0)
    .sort((a, b) => b.pct - a.pct);

  if (activeGoals.length > 0 && insights.length < 4) {
    const top = activeGoals[0];
    const dailySurplus = Math.max(200, Math.round(Math.max(0, projectedMonthEndNet) / daysInMonth));
    const estDays = Math.ceil(top.rem / dailySurplus);
    insights.push({
      id: 'goal-accel',
      icon: '🎯',
      title: `Closest Goal: ${top.title} (${top.pct}%)`,
      message: `Only Ksh ${top.rem.toLocaleString()} left! At Ksh ${dailySurplus.toLocaleString()}/day surplus, you will unlock this goal in ~${estDays} days.`,
      badge: `${top.pct}% Done`,
      tone: 'indigo',
      actionLabel: 'Top Up Goal',
      actionHref: '#goals-card',
    });
  }

  const headline =
    insights.length > 0
      ? insights[0].title
      : '✨ Clean Slate Ready — Type any 1-line command like "uber 2500" or "fuel 500" above!';

  return {
    headline,
    projectedMonthEndNet,
    projectedMonthEndIncome,
    projectedMonthEndExpenses,
    idleCashKes,
    missedMonthlyInterestKes,
    upcoming7DayObligationsKes,
    insights: insights.slice(0, 4),
  };
}
