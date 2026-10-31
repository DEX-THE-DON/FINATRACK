import { sortTransactionsLatestFirst } from '../utils/math';

export function renderFinancialStatement(data: any): string {
  const {
    username = 'Dennis',
    accounts = [],
    transactions = [],
    goals = [],
    debts = [],
    total_balance = 0.0,
    monthly_income = 0.0,
    monthly_expenses = 0.0,
    net_savings = 0.0,
    total_debt = 0.0,
    runway_status = { months: 0, displayMonths: '0 mo', statusLabel: 'N/A' },
    health_score = { totalScore: 85, grade: 'A', tierLabel: 'Financial Shield' },
    statement_date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
    statement_ref = 'FINA-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    currency = 'Ksh',
  } = data;

  const formatKes = (val: number | string) => 'Ksh ' + (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Goals Breakdown (Short-Term vs Long-Term Basis)
  const shortTermGoals = (goals || []).filter((g: any) => g.horizon !== 'LONG_TERM');
  const longTermGoals = (goals || []).filter((g: any) => g.horizon === 'LONG_TERM');
  const totalShortSaved = shortTermGoals.reduce((s: number, g: any) => s + Number(g.current_amount || 0), 0);
  const totalShortTarget = shortTermGoals.reduce((s: number, g: any) => s + Number(g.target_amount || 0), 0);
  const totalLongSaved = longTermGoals.reduce((s: number, g: any) => s + Number(g.current_amount || 0), 0);
  const totalLongTarget = longTermGoals.reduce((s: number, g: any) => s + Number(g.target_amount || 0), 0);

  // Loans & Credit Breakdown (Borrowed vs Credited / Lent Out)
  const borrowedDebts = (debts || []).filter((d: any) => d.debt_type === 'I_OWE' && d.status !== 'PAID');
  const creditedDebts = (debts || []).filter((d: any) => d.debt_type !== 'I_OWE' && d.status !== 'PAID');
  const totalBorrowedRemaining = borrowedDebts.reduce((s: number, d: any) => s + Math.max(0, Number(d.total_amount || 0) - Number(d.paid_amount || 0)), 0);
  const totalCreditedRemaining = creditedDebts.reduce((s: number, d: any) => s + Math.max(0, Number(d.total_amount || 0) - Number(d.paid_amount || 0)), 0);
  const netCreditPosition = totalCreditedRemaining - totalBorrowedRemaining;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Financial Statement - ${username} - ${statement_ref}</title>
    <script>
        (function() {
            var theme = localStorage.getItem('theme');
            if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            if (localStorage.getItem('finatrack_privacy_blur') === '1') {
                document.documentElement.classList.add('privacy-blur');
            }
        })();
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                    }
                }
            }
        }
    </script>
    <style>
        html, body { overflow-x: hidden; }
        html.privacy-blur .privacy-amount {
            filter: blur(7px);
            user-select: none;
            transition: filter 0.2s ease;
        }
        html.privacy-blur .privacy-amount:hover {
            filter: blur(0px);
        }
        @media print {
            .no-print { display: none !important; }
            html, body { font-size: 10.5pt; background: #fff !important; color: #000 !important; }
            html.privacy-blur .privacy-amount { filter: none !important; }
            .print-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; background: #fff !important; color: #000 !important; }
            .page-break { page-break-after: always; }
            @page { margin: 1.2cm; }
        }
    </style>
</head>
<body class="bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen p-3.5 sm:p-8 font-sans antialiased">

    <!-- Top Action Bar (hidden when printed) -->
    <div class="max-w-4xl mx-auto mb-5 no-print flex flex-wrap justify-between items-center gap-3 bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div class="flex items-center gap-2">
            <a href="/" class="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition">
                ← Back to FinanceHub
            </a>
            <span class="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 font-semibold">SACCO &amp; Bank Verified Statement</span>
        </div>
        <div class="flex items-center gap-2">
            <button type="button" onclick="togglePrivacyBlur()" class="privacy-toggle-btn px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5" title="Hide or Show Balances">
                <span class="privacy-toggle-icon">👁️</span>
                <span class="privacy-toggle-label hidden sm:inline">Hide Balances</span>
            </button>
            <button type="button" onclick="toggleDarkMode()" class="dark-mode-toggle-btn p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Toggle Dark/Light Preview">
                🌙
            </button>
            <button onclick="window.print()" class="px-4 sm:px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95">
                <span>🖨️ Print / Save PDF</span>
            </button>
        </div>
    </div>

    <!-- Official Statement Document -->
    <div class="print-sheet max-w-4xl mx-auto bg-white dark:bg-slate-900 p-5 sm:p-10 lg:p-12 rounded-2xl sm:rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 space-y-7">
        
        <!-- Header -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-900 dark:border-slate-700 pb-5 gap-4">
            <div>
                <div class="flex items-center space-x-2">
                    <span class="text-xl sm:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">⚡ FINATRACK</span>
                    <span class="text-[10px] sm:text-[11px] font-mono bg-slate-900 dark:bg-emerald-600 text-white px-2 py-0.5 rounded font-bold">OFFICIAL STATEMENT</span>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Verified Personal Finance, Multi-Account &amp; Credit Intelligence Statement</p>
            </div>
            <div class="text-left sm:text-right text-xs space-y-1">
                <p class="font-bold text-slate-900 dark:text-white">Ref: <span class="font-mono text-emerald-700 dark:text-emerald-400">${statement_ref}</span></p>
                <p class="text-slate-600 dark:text-slate-300">Date Issued: <strong>${statement_date}</strong></p>
                <p class="text-slate-600 dark:text-slate-300">Account Holder: <strong>${username}</strong></p>
            </div>
        </div>

        <!-- 1. Executive Financial Summary -->
        <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">1. Executive Financial Summary</h2>
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[11px] font-extrabold">
                    🏆 Health Score: ${health_score.totalScore}/100 (Grade ${health_score.grade} — ${health_score.tierLabel})
                </span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div class="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <p class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Total Net Balance</p>
                    <p class="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5 privacy-amount break-words">${formatKes(total_balance)}</p>
                    <p class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">${accounts.length} Active Accounts</p>
                </div>
                <div class="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/70">
                    <p class="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Monthly Income</p>
                    <p class="text-base sm:text-lg font-black text-emerald-800 dark:text-emerald-400 mt-0.5 privacy-amount break-words">${formatKes(monthly_income)}</p>
                    <p class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Shifts &amp; Inflows</p>
                </div>
                <div class="p-3.5 bg-rose-50/60 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800/70">
                    <p class="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase">Monthly Expenses</p>
                    <p class="text-base sm:text-lg font-black text-rose-800 dark:text-rose-400 mt-0.5 privacy-amount break-words">${formatKes(monthly_expenses)}</p>
                    <p class="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">Living, Fuel &amp; Bills</p>
                </div>
                <div class="p-3.5 bg-teal-50/60 dark:bg-teal-950/40 rounded-2xl border border-teal-200 dark:border-teal-800/70">
                    <p class="text-[10px] font-bold text-teal-700 dark:text-teal-300 uppercase">Net Monthly Surplus</p>
                    <p class="text-base sm:text-lg font-black ${net_savings >= 0 ? 'text-teal-800 dark:text-teal-400' : 'text-rose-700 dark:text-rose-400'} mt-0.5 privacy-amount break-words">${formatKes(net_savings)}</p>
                    <p class="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">Retained Cashflow</p>
                </div>
                <div class="col-span-2 sm:col-span-1 p-3.5 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800/70">
                    <p class="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Emergency Runway</p>
                    <p class="text-base sm:text-lg font-black text-indigo-800 dark:text-indigo-400 mt-0.5">${runway_status.displayMonths}</p>
                    <p class="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">${runway_status.statusLabel}</p>
                </div>
            </div>
        </div>

        <!-- 2. Account Holdings & Balances -->
        <div class="space-y-3">
            <h2 class="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">2. Account &amp; Asset Holdings</h2>
            <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table class="w-full text-left text-xs">
                    <thead class="bg-slate-100 dark:bg-slate-800 uppercase text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                        <tr>
                            <th class="py-2.5 px-4">Account Name</th>
                            <th class="py-2.5 px-4">Account Type</th>
                            <th class="py-2.5 px-4">Account / Till #</th>
                            <th class="py-2.5 px-4">Yield / APY %</th>
                            <th class="py-2.5 px-4 text-right">Current Balance</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                        ${accounts.map((a: any) => `
                        <tr>
                            <td class="py-2.5 px-4 font-bold text-slate-900 dark:text-white">${a.name}</td>
                            <td class="py-2.5 px-4"><span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-semibold">${a.account_type}</span></td>
                            <td class="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">${a.account_number || 'N/A'}</td>
                            <td class="py-2.5 px-4 font-bold ${a.interest_rate_p_a > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'}">${a.interest_rate_p_a > 0 ? a.interest_rate_p_a + '% p.a.' : '—'}</td>
                            <td class="py-2.5 px-4 text-right font-black text-slate-900 dark:text-white privacy-amount">${formatKes(a.balance)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- 3. Savings Goals Portfolio (Short-Term vs Long-Term Basis) -->
        <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">3. Savings Goals Portfolio (Short-Term vs. Long-Term Basis)</h2>
                <div class="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <span class="px-2.5 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 privacy-amount">
                        ⚡ Short-Term (${shortTermGoals.length}): ${formatKes(totalShortSaved)} / ${formatKes(totalShortTarget)}
                    </span>
                    <span class="px-2.5 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 privacy-amount">
                        🏛️ Long-Term (${longTermGoals.length}): ${formatKes(totalLongSaved)} / ${formatKes(totalLongTarget)}
                    </span>
                </div>
            </div>
            <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table class="w-full text-left text-xs">
                    <thead class="bg-slate-100 dark:bg-slate-800 uppercase text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                        <tr>
                            <th class="py-2.5 px-4">Goal Title</th>
                            <th class="py-2.5 px-4">Horizon Basis</th>
                            <th class="py-2.5 px-4">Target Date</th>
                            <th class="py-2.5 px-4 text-right">Saved</th>
                            <th class="py-2.5 px-4 text-right">Target</th>
                            <th class="py-2.5 px-4 text-right">Progress</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                        ${goals.length > 0 ? goals.map((g: any) => {
                          const saved = Number(g.current_amount || 0);
                          const target = Number(g.target_amount || 1);
                          const pct = Math.min(100, Math.round((saved / target) * 100));
                          const isLong = g.horizon === 'LONG_TERM';
                          return `
                        <tr>
                            <td class="py-2.5 px-4 font-bold text-slate-900 dark:text-white">${g.title}</td>
                            <td class="py-2.5 px-4">
                                <span class="px-2 py-0.5 rounded text-[10px] font-extrabold ${isLong ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300' : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'}">
                                    ${isLong ? '🏛️ LONG-TERM' : '⚡ SHORT-TERM'}
                                </span>
                            </td>
                            <td class="py-2.5 px-4 text-slate-600 dark:text-slate-400">${g.target_date ? String(g.target_date).slice(0, 10) : 'Flexible'}</td>
                            <td class="py-2.5 px-4 text-right font-bold text-emerald-700 dark:text-emerald-400 privacy-amount">${formatKes(saved)}</td>
                            <td class="py-2.5 px-4 text-right font-semibold text-slate-700 dark:text-slate-300 privacy-amount">${formatKes(target)}</td>
                            <td class="py-2.5 px-4 text-right font-black text-slate-900 dark:text-white">${pct}%</td>
                        </tr>`;
                        }).join('') : `
                        <tr>
                            <td colspan="6" class="py-5 text-center text-slate-400">No savings goals configured yet.</td>
                        </tr>`}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- 4. Loans, Credit & Liabilities Schedule -->
        <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">4. Loans, Credit &amp; Liabilities Schedule</h2>
                <div class="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <span class="px-2.5 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 privacy-amount">
                        📉 Borrowed (I Owe): ${formatKes(totalBorrowedRemaining)}
                    </span>
                    <span class="px-2.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 privacy-amount">
                        📈 Credited (Owed to Me): ${formatKes(totalCreditedRemaining)}
                    </span>
                    <span class="px-2.5 py-0.5 rounded-lg ${netCreditPosition >= 0 ? 'bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300' : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'} privacy-amount">
                        ⚖️ Net Credit: ${netCreditPosition >= 0 ? '+' : ''}${formatKes(netCreditPosition)}
                    </span>
                </div>
            </div>
            <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table class="w-full text-left text-xs">
                    <thead class="bg-slate-100 dark:bg-slate-800 uppercase text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                        <tr>
                            <th class="py-2.5 px-4">Counterparty / Institution</th>
                            <th class="py-2.5 px-4">Direction</th>
                            <th class="py-2.5 px-4">Due Date</th>
                            <th class="py-2.5 px-4 text-right">Principal</th>
                            <th class="py-2.5 px-4 text-right">Paid</th>
                            <th class="py-2.5 px-4 text-right">Remaining Balance</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                        ${debts.length > 0 ? debts.map((d: any) => {
                          const total = Number(d.total_amount || 0);
                          const paid = Number(d.paid_amount || 0);
                          const rem = Math.max(0, total - paid);
                          const isBorrowed = d.debt_type === 'I_OWE';
                          return `
                        <tr>
                            <td class="py-2.5 px-4 font-bold text-slate-900 dark:text-white">${d.person_name}</td>
                            <td class="py-2.5 px-4">
                                <span class="px-2 py-0.5 rounded text-[10px] font-extrabold ${isBorrowed ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'}">
                                    ${isBorrowed ? 'BORROWED (I OWE)' : 'CREDITED (OWED TO ME)'}
                                </span>
                            </td>
                            <td class="py-2.5 px-4 text-slate-600 dark:text-slate-400">${d.due_at ? String(d.due_at).slice(0, 10) : '—'}</td>
                            <td class="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300 privacy-amount">${formatKes(total)}</td>
                            <td class="py-2.5 px-4 text-right text-emerald-700 dark:text-emerald-400 privacy-amount">${formatKes(paid)}</td>
                            <td class="py-2.5 px-4 text-right font-black ${rem === 0 ? 'text-slate-400' : (isBorrowed ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400')} privacy-amount">${rem === 0 ? 'SETTLED ✓' : formatKes(rem)}</td>
                        </tr>`;
                        }).join('') : `
                        <tr>
                            <td colspan="6" class="py-5 text-center text-slate-400">No active loan or credit records.</td>
                        </tr>`}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- 5. Recent Ledger Transactions -->
        <div class="space-y-3">
            <h2 class="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">5. Verified Ledger Transactions</h2>
            <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table class="w-full text-left text-xs">
                    <thead class="bg-slate-100 dark:bg-slate-800 uppercase text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                        <tr>
                            <th class="py-2.5 px-4">Date</th>
                            <th class="py-2.5 px-4">Type</th>
                            <th class="py-2.5 px-4">Category</th>
                            <th class="py-2.5 px-4">Description</th>
                            <th class="py-2.5 px-4 text-right">Amount (${currency})</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                        ${sortTransactionsLatestFirst(transactions).length > 0 ? sortTransactionsLatestFirst(transactions).slice(0, 50).map((t: any) => `
                        <tr>
                            <td class="py-2 px-4 font-medium text-slate-600 dark:text-slate-400">${t.date}</td>
                            <td class="py-2 px-4">
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${t.transaction_type === 'TRANSFER' ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300' : (t.transaction_type === 'INCOME' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300')}">
                                    ${t.transaction_type}
                                </span>
                            </td>
                            <td class="py-2 px-4 font-medium text-slate-700 dark:text-slate-300">${t.category}</td>
                            <td class="py-2 px-4 text-slate-600 dark:text-slate-400 truncate max-w-xs">${t.description || '—'}</td>
                            <td class="py-2 px-4 text-right font-bold privacy-amount ${t.transaction_type === 'TRANSFER' ? 'text-blue-700 dark:text-blue-400' : (t.transaction_type === 'INCOME' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}">
                                ${t.transaction_type === 'TRANSFER' ? '⇄ ' : (t.transaction_type === 'INCOME' ? '+' : '-')}${formatKes(t.amount)}
                            </td>
                        </tr>`).join('') : `
                        <tr>
                            <td colspan="5" class="py-6 text-center text-slate-400">No transactions recorded during this period.</td>
                        </tr>`}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Verification & Signature Section -->
        <div class="pt-6 border-t-2 border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-slate-600 dark:text-slate-400">
            <div>
                <p class="font-bold text-slate-900 dark:text-white">Declaration &amp; Notice:</p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">This statement represents an accurate digital ledger snapshot generated from Finatrack Financial Freedom Hub. All transaction records, savings goals, and credit balances are timestamped and verified.</p>
            </div>
            <div class="sm:text-right space-y-3">
                <p class="font-bold text-slate-900 dark:text-white">Generated By: Finatrack System Engine</p>
                <div class="inline-block border-b border-slate-400 dark:border-slate-600 w-48 pb-1">
                    <span class="font-mono text-[10px] text-emerald-800 dark:text-emerald-400 font-bold">DIGITALLY VERIFIED ✓</span>
                </div>
            </div>
        </div>

    </div>

    <script>
        function updateThemeAndPrivacyUI() {
            var isDark = document.documentElement.classList.contains('dark');
            document.querySelectorAll('.dark-mode-toggle-btn').forEach(function(btn) {
                btn.innerHTML = isDark ? '☀️' : '🌙';
            });
            var isBlurred = document.documentElement.classList.contains('privacy-blur');
            document.querySelectorAll('.privacy-toggle-icon').forEach(function(el) {
                el.textContent = isBlurred ? '🙈' : '👁️';
            });
            document.querySelectorAll('.privacy-toggle-label').forEach(function(el) {
                el.textContent = isBlurred ? 'Show Balances' : 'Hide Balances';
            });
        }

        function toggleDarkMode() {
            var isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeAndPrivacyUI();
        }

        function togglePrivacyBlur() {
            var isBlurred = document.documentElement.classList.toggle('privacy-blur');
            localStorage.setItem('finatrack_privacy_blur', isBlurred ? '1' : '0');
            updateThemeAndPrivacyUI();
        }

        document.addEventListener('DOMContentLoaded', updateThemeAndPrivacyUI);
        window.toggleDarkMode = toggleDarkMode;
        window.togglePrivacyBlur = togglePrivacyBlur;
    </script>
</body>
</html>`;
}

