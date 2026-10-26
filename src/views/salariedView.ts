import { SalariedConfig, SalariedLoanRecord, calculateDaysUntilPayday } from '../routes/salaried';
import { calculateDebtDeadline } from '../utils/math';

export function renderSalariedDashboard(data: {
  username?: string;
  is_logged_in?: boolean;
  salaried_config: SalariedConfig;
  total_balance?: number;
  monthly_income?: number;
  monthly_expenses?: number;
  toast?: string;
  current_currency?: string;
  accounts?: any[];
  allocation_rules?: any[];
  salaried_loans?: SalariedLoanRecord[];
}): string {
  const {
    username = 'Dennis',
    is_logged_in = false,
    salaried_config,
    total_balance = 0.0,
    monthly_expenses = 0.0,
    toast = '',
    accounts = [],
    allocation_rules = [],
    salaried_loans = [],
  } = data;

  const formatKes = (val: number | string) => 'Ksh ' + (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { daysRemaining, nextPaydayDate } = calculateDaysUntilPayday(salaried_config.payday_day);

  // Loans Borrowed (I_OWE) vs Credited / Money Lent Out (OWED_TO_ME) Calculations
  const activeBorrowedLoans = salaried_loans.filter((l) => l.debt_type === 'I_OWE' && l.status === 'ACTIVE');
  const activeCreditedLoans = salaried_loans.filter((l) => l.debt_type === 'OWED_TO_ME' && l.status === 'ACTIVE');

  const totalBorrowedRemaining = activeBorrowedLoans.reduce(
    (sum, l) => sum + Math.max(0, (Number(l.total_amount) || 0) - (Number(l.paid_amount) || 0)),
    0
  );
  const totalBorrowedMonthlyCheckoff = activeBorrowedLoans.reduce(
    (sum, l) => sum + (Number(l.monthly_installment) || 0),
    0
  );
  const totalCreditedRemaining = activeCreditedLoans.reduce(
    (sum, l) => sum + Math.max(0, (Number(l.total_amount) || 0) - (Number(l.paid_amount) || 0)),
    0
  );
  const netCreditPosition = totalCreditedRemaining - totalBorrowedRemaining;
  const todayIso = new Date().toISOString().slice(0, 10);
  const defaultDueIso = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  // Safe daily spend calculation
  const remainingDiscretionary = Math.max(0, salaried_config.living_budget_monthly - monthly_expenses);
  const safeDailySpend = daysRemaining > 0 ? (remainingDiscretionary / daysRemaining) : remainingDiscretionary;
  const burnPaceRatio = remainingDiscretionary > 0 ? (safeDailySpend / (salaried_config.living_budget_monthly / 30)) : 0;

  const paceStatus = burnPaceRatio >= 1.0
    ? { label: '🟢 Safe Spend Pace', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40' }
    : burnPaceRatio >= 0.7
      ? { label: '🟡 Spend With Care', color: 'text-amber-400 bg-amber-500/20 border-amber-500/40' }
      : { label: '🚨 High Burn Danger', color: 'text-rose-400 bg-rose-500/20 border-rose-500/40' };

  const totalBlendedMonthly = salaried_config.monthly_net_salary + (salaried_config.side_hustle_estimate || 0);

  return `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>💼 Salaried &amp; Professional Hub - Finatrack</title>
    <script>
        (function() {
            var theme = localStorage.getItem('theme');
            if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        })();
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#1e1b4b">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                    },
                    colors: {
                        indigo: { 950: '#0f0e26' }
                    }
                }
            }
        }
    </script>
    <style>
        html, body {
            overflow-x: hidden;
            max-width: 100vw;
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
        .dark ::-webkit-scrollbar-thumb { background: #334155; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .shadow-xs { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
        .shadow-2xs { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03); }
        .backdrop-blur-xs { -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
        .rounded-xs { border-radius: 0.125rem; }
        .active\:scale-98:active { transform: scale(0.98); }
        @supports (padding: max(0px)) {
            .safe-area-bottom {
                padding-bottom: max(0.6rem, env(safe-area-inset-bottom));
            }
        }
    </style>
</head>
<body class="bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 min-h-screen font-sans pb-28 sm:pb-12 antialiased selection:bg-indigo-500 selection:text-white">

    <!-- Top Navigation Header -->
    <header class="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200/80 dark:border-indigo-900/60 shadow-xs">
        <div class="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
            <a href="/" class="flex items-center space-x-2.5 shrink-0">
                <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-base sm:text-lg text-white shadow-xs">
                    💼
                </div>
                <div>
                    <span class="font-extrabold text-base sm:text-lg text-gray-900 dark:text-white tracking-tight block leading-none">Finatrack</span>
                    <span class="hidden sm:block text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mt-0.5">Salaried &amp; Pro Hub</span>
                </div>
            </a>

            <!-- Profile Mode Switcher Pill & Navigation Links -->
            <div class="flex items-center gap-1.5 sm:gap-2.5">
                <!-- Profile Switcher Button -->
                <button type="button" onclick="openProfileModal()" class="px-2.5 sm:px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-1 shadow-2xs">
                    <span>💼 <span class="hidden sm:inline">Salaried Mode</span><span class="sm:hidden">Salaried</span></span>
                    <span class="text-[10px] opacity-70">▾</span>
                </button>

                <div class="hidden md:flex items-center space-x-1 bg-gray-100/80 dark:bg-gray-800/80 p-1 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                    <a href="/" class="px-2.5 py-1 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition">
                        ⚡ Finance
                    </a>
                    <a href="/rider" class="px-2.5 py-1 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition">
                        🛵 Rider
                    </a>
                    <a href="/trader" class="px-2.5 py-1 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition">
                        🥬 Trader
                    </a>
                </div>

                ${is_logged_in ? `
                <div class="flex items-center space-x-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 px-2.5 py-1.5 rounded-xl shadow-xs">
                    <span class="text-xs">👤</span>
                    <span class="text-xs font-bold text-indigo-800 dark:text-indigo-300 max-w-[90px] truncate hidden sm:inline">${username}</span>
                    <form action="/auth/logout" method="POST" class="inline m-0 p-0">
                        <input type="hidden" name="redirect_to" value="/salaried">
                        <button type="submit" title="Logout" class="text-[11px] text-rose-500 dark:text-rose-400 font-bold hover:underline ml-0.5">✕</button>
                    </form>
                </div>` : `
                <a href="/login" class="px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1">
                    <span>🔑</span>
                    <span class="hidden sm:inline">Sign In</span>
                </a>`}

                <button onclick="toggleDarkMode()" class="dark-mode-toggle-btn p-1.5 sm:p-2 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition" title="Toggle Dark/Light Mode">
                    🌙
                </button>
            </div>
        </div>
    </header>

    <!-- Toast Notification -->
    ${toast ? `
    <div id="toast-bar" class="max-w-4xl mx-auto px-3.5 sm:px-4 mt-3">
        <div class="p-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg flex items-center justify-between">
            <div class="flex items-center space-x-2">
                <span>🔔</span>
                <span>${decodeURIComponent(toast)}</span>
            </div>
            <button onclick="document.getElementById('toast-bar').remove()" class="text-white hover:text-gray-200">✕</button>
        </div>
    </div>` : ''}

    <main class="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">

        <!-- 💼 Top Salary & Payday Briefing Card -->
        <div class="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl text-white shadow-xl space-y-4">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
                <div class="space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2.5 py-0.5 bg-indigo-500 text-white font-black text-[10px] sm:text-[11px] rounded-full uppercase tracking-wider">💼 Salaried &amp; Professional OS</span>
                        <span class="text-xs text-indigo-300 font-bold">${salaried_config.employer_name} • Payday: ${salaried_config.payday_day}th</span>
                    </div>
                    <h1 class="text-xl sm:text-3xl font-black text-white leading-tight">Monthly Payday &amp; Salary Runway Command</h1>
                    <p class="text-xs text-indigo-200/80">Automate your Payday Ritual: Pay yourself first before lifestyle expenses and avoid the mid-month cash crash.</p>
                </div>
                <div class="flex items-center gap-2 flex-wrap w-full md:w-auto">
                    <a href="#salaried-loans-card" class="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 rounded-xl text-xs font-extrabold text-rose-200 transition active:scale-95 flex items-center gap-1.5">
                        💳 Loans &amp; Credit (${salaried_loans.filter((l) => l.status === 'ACTIVE').length})
                    </a>
                    <button type="button" onclick="document.getElementById('salaried-settings-modal').classList.remove('hidden')" class="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-indigo-500/40 rounded-xl text-xs font-bold text-indigo-300 transition active:scale-95 flex items-center gap-1.5">
                        ⚙️ Payday Settings
                    </button>
                    <a href="/#waterfall-card" class="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-amber-500 to-indigo-500 hover:from-amber-600 hover:to-indigo-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5">
                        👑 Pay Yourself First
                    </a>
                </div>
            </div>

            <!-- Key Numbers Bar -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
                <div class="p-3 bg-slate-950/75 border border-indigo-500/30 rounded-2xl">
                    <span class="text-[10px] font-bold text-indigo-300 uppercase block">⏳ Next Payday</span>
                    <span class="text-lg sm:text-2xl font-black text-white">${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</span>
                    <span class="text-[10px] text-indigo-400 block mt-0.5">Landing ${nextPaydayDate}</span>
                </div>
                <div class="p-3 bg-slate-950/75 border border-emerald-500/30 rounded-2xl">
                    <span class="text-[10px] font-bold text-emerald-300 uppercase block">💵 Safe Daily Spend</span>
                    <span class="text-base sm:text-2xl font-black text-emerald-400 break-words">${formatKes(safeDailySpend)}/d</span>
                    <span class="text-[9px] block mt-0.5 ${paceStatus.color} px-1.5 py-0.5 rounded-full inline-block font-extrabold border">${paceStatus.label}</span>
                </div>
                <div class="p-3 bg-slate-950/75 border border-cyan-500/30 rounded-2xl">
                    <span class="text-[10px] font-bold text-cyan-300 uppercase block">🏦 Net Take-Home</span>
                    <span class="text-base sm:text-2xl font-black text-cyan-400 break-words">${formatKes(salaried_config.monthly_net_salary)}</span>
                    <span class="text-[10px] text-gray-400 block mt-0.5">After PAYE &amp; deductions</span>
                </div>
                <div class="p-3 bg-slate-950/75 border border-amber-500/30 rounded-2xl">
                    <span class="text-[10px] font-bold text-amber-300 uppercase block">⚡ Blended Inflows</span>
                    <span class="text-base sm:text-2xl font-black text-amber-400 break-words">${formatKes(totalBlendedMonthly)}</span>
                    <span class="text-[10px] text-amber-300 block mt-0.5">${salaried_config.side_hustle_estimate > 0 ? `+${formatKes(salaried_config.side_hustle_estimate)} hustle` : 'Salary + side hustle'}</span>
                </div>
            </div>
        </div>

        <!-- Main Action Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

            <!-- Left Col (7 cols): Payday Waterfall Closeout Ritual -->
            <div class="lg:col-span-7 space-y-6">

                <!-- 👑 Monthly Payday Waterfall Ritual -->
                <div id="payday-card" class="bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900/60 p-6 rounded-3xl shadow-sm space-y-4">
                    <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                        <div class="flex items-center space-x-2">
                            <span class="text-2xl">👑</span>
                            <div>
                                <h2 class="text-lg font-bold text-gray-900 dark:text-white">Monthly Payday Waterfall Ritual</h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400">As soon as salary lands, split it into high-yield MMFs, goals, rent/bills, and your daily pocket allowance in 1 tap.</p>
                            </div>
                        </div>
                        <span class="text-xs px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold rounded-lg">
                            Payday: ${salaried_config.payday_day}th
                        </span>
                    </div>

                    <form action="/salaried/payday/split" method="POST" class="space-y-4">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    💰 Net Salary Received (<span class="curr-symbol-label">Ksh</span>)
                                </label>
                                <input type="number" step="any" name="salary_amount" id="salaried_amount_input" value="${salaried_config.monthly_net_salary}" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-black text-lg text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500" required>
                                <span class="text-[10px] text-gray-400">Amount hitting your bank/M-Pesa</span>
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    🏦 Salary Receiving Account
                                </label>
                                <select name="source_account_id" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-xs text-gray-900 dark:text-white">
                                    <option value="">-- Direct External Salary Deposit --</option>
                                    ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                                </select>
                                <span class="text-[10px] text-gray-400">Account salary enters before distribution</span>
                            </div>
                        </div>

                        <!-- 4-Pillar Recommended Split Distribution -->
                        <div class="p-4 bg-indigo-50/60 dark:bg-slate-950/80 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl space-y-3">
                            <span class="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                                Recommended 30-20-25-25 Professional Wealth Blueprint:
                            </span>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                                <div class="p-2.5 bg-white dark:bg-gray-900 rounded-xl border border-emerald-200 dark:border-emerald-800">
                                    <div class="flex justify-between font-bold text-emerald-700 dark:text-emerald-300 text-[11px]">
                                        <span>👑 1. Pay Yourself First (30%)</span>
                                        <span>${formatKes(salaried_config.monthly_net_salary * 0.3)}</span>
                                    </div>
                                    <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Ziidi/Britam MMF (15%) + Sacco Share Capital (15%)</p>
                                </div>

                                <div class="p-2.5 bg-white dark:bg-gray-900 rounded-xl border border-indigo-200 dark:border-indigo-800">
                                    <div class="flex justify-between font-bold text-indigo-700 dark:text-indigo-300 text-[11px]">
                                        <span>🏖️ 2. Goals Vault (20%)</span>
                                        <span>${formatKes(salaried_config.monthly_net_salary * 0.2)}</span>
                                    </div>
                                    <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Malindi 2027, School Fees &amp; Land Deposit Vaults</p>
                                </div>

                                <div class="p-2.5 bg-white dark:bg-gray-900 rounded-xl border border-cyan-200 dark:border-cyan-800">
                                    <div class="flex justify-between font-bold text-cyan-700 dark:text-cyan-300 text-[11px]">
                                        <span>⚡ 3. Fixed Obligations (25%)</span>
                                        <span>${formatKes(salaried_config.monthly_net_salary * 0.25)}</span>
                                    </div>
                                    <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Rent, KPLC token, WiFi, Insurance &amp; Helb</p>
                                </div>

                                <div class="p-2.5 bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-800">
                                    <div class="flex justify-between font-bold text-amber-700 dark:text-amber-300 text-[11px]">
                                        <span>💵 4. Safe Daily Living (25%)</span>
                                        <span>${formatKes(salaried_config.monthly_net_salary * 0.25)}</span>
                                    </div>
                                    <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Safe ~${formatKes((salaried_config.monthly_net_salary * 0.25) / 30)}/day for daily food &amp; pocket cash</p>
                                </div>
                            </div>
                        </div>

                        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold py-3 px-4 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2">
                            <span>🚀 Execute Payday Waterfall Split Now</span>
                        </button>
                    </form>
                </div>

            </div>

            <!-- Right Col (5 cols): Safe Daily Spend Pacing & Side-Hustle Blender -->
            <div class="lg:col-span-5 space-y-6">

                <!-- 🎯 Salary Runway & Safe Daily Spend Card -->
                <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-3xl shadow-sm space-y-4">
                    <div class="flex items-center space-x-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                        <span class="text-2xl">🎯</span>
                        <div>
                            <h2 class="text-base font-bold text-gray-900 dark:text-white">Salary Runway &amp; Daily Safe Spend</h2>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Pacing your discretionary cash to make it comfortably to payday.</p>
                        </div>
                    </div>

                    <div class="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl space-y-3 text-xs">
                        <div class="flex justify-between items-center">
                            <span class="text-gray-500">Days to Payday:</span>
                            <span class="font-extrabold text-gray-900 dark:text-white text-sm">${daysRemaining} days remaining</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-gray-500">Discretionary Cash Left:</span>
                            <span class="font-black text-indigo-600 dark:text-indigo-400 text-sm">${formatKes(remainingDiscretionary)}</span>
                        </div>
                        <div class="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span class="font-bold text-gray-700 dark:text-gray-300">Your Safe Daily Ceiling:</span>
                            <span class="text-lg font-black text-emerald-600 dark:text-emerald-400">${formatKes(safeDailySpend)} / day</span>
                        </div>
                    </div>

                    <div class="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/50 dark:border-indigo-900/40 text-[11px] text-gray-600 dark:text-gray-300">
                        💡 <strong>The Payday Rule</strong>: As long as your daily spend stays under <strong class="text-emerald-600 dark:text-emerald-400">${formatKes(safeDailySpend)}</strong>, you will arrive at payday on the ${salaried_config.payday_day}th with zero debt and zero stress.
                    </div>
                </div>

                <!-- ⚡ Side-Hustle Income Blending Card -->
                <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-3xl shadow-sm space-y-4">
                    <div class="flex items-center space-x-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                        <span class="text-2xl">⚡</span>
                        <div>
                            <h2 class="text-base font-bold text-gray-900 dark:text-white">Side-Hustle Income Blending</h2>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Combine your primary salary with gigs (Uber/Bolt car, consulting, shop).</p>
                        </div>
                    </div>

                    <div class="space-y-2.5 text-xs">
                        <div class="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                            <span class="text-gray-500">Primary Salary:</span>
                            <span class="font-bold text-gray-900 dark:text-white">${formatKes(salaried_config.monthly_net_salary)}</span>
                        </div>
                        <div class="flex justify-between items-center p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                            <span class="text-gray-500">Side-Hustle Estimate:</span>
                            <span class="font-bold text-amber-600 dark:text-amber-400">${formatKes(salaried_config.side_hustle_estimate)}</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-gradient-to-r from-indigo-50 to-amber-50 dark:from-indigo-950/60 dark:to-amber-950/60 rounded-xl border border-indigo-200 dark:border-indigo-800">
                            <span class="font-black text-gray-900 dark:text-white">Total Blended Monthly:</span>
                            <span class="text-base font-black text-indigo-700 dark:text-indigo-300">${formatKes(totalBlendedMonthly)}</span>
                        </div>
                    </div>

                    <button type="button" onclick="document.getElementById('salaried-settings-modal').classList.remove('hidden')" class="w-full py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition">
                        Update Side-Hustle Amount
                    </button>
                </div>

            </div>
        </div>

        <!-- 💳 SALARIED LOANS BORROWED & CREDITED (MONEY LENT OUT) HUB -->
        <div id="salaried-loans-card" class="bg-white dark:bg-gray-900 border-2 border-indigo-200 dark:border-indigo-900/70 p-6 rounded-3xl shadow-sm space-y-5">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
                <div class="flex items-start space-x-3">
                    <span class="text-3xl p-2.5 bg-indigo-50 dark:bg-indigo-950/80 rounded-2xl border border-indigo-200 dark:border-indigo-800">💳</span>
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <h2 class="text-lg sm:text-xl font-black text-gray-900 dark:text-white">Loans Borrowed &amp; Money Credited (Lent Out)</h2>
                            <span class="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                                Checkoff &amp; Personal Credit Ledger
                            </span>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Track SACCO loans, employer salary advances, bank checkoffs, HELB &amp; mobile loans you owe—plus money you credited/lent to colleagues, friends, or clients.
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-2 w-full md:w-auto">
                    <button type="button" onclick="openSalariedLoanForm('I_OWE')" class="flex-1 md:flex-initial px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5">
                        <span>📉 + Log Loan Borrowed</span>
                    </button>
                    <button type="button" onclick="openSalariedLoanForm('OWED_TO_ME')" class="flex-1 md:flex-initial px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5">
                        <span>📈 + Log Money Credited</span>
                    </button>
                </div>
            </div>

            <!-- 3-Column Summary KPI Strip -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div class="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60">
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">📉 Total Loans Borrowed (I Owe)</span>
                        <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-200/70 dark:bg-rose-900/70 text-rose-800 dark:text-rose-200">${activeBorrowedLoans.length} Active</span>
                    </div>
                    <div class="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">${formatKes(totalBorrowedRemaining)}</div>
                    <div class="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                        ${totalBorrowedMonthlyCheckoff > 0
                          ? `Monthly Checkoff / Installments: <strong class="text-rose-600 dark:text-rose-400">${formatKes(totalBorrowedMonthlyCheckoff)}/mo</strong>`
                          : 'SACCO, Salary Advance, Bank, HELB &amp; Mobile Loans'}
                    </div>
                </div>

                <div class="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60">
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">📈 Total Credited / Lent (Owed to Me)</span>
                        <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-200/70 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200">${activeCreditedLoans.length} Active</span>
                    </div>
                    <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">${formatKes(totalCreditedRemaining)}</div>
                    <div class="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                        Money lent to colleagues, friends, family &amp; side-hustle clients
                    </div>
                </div>

                <div class="p-4 rounded-2xl bg-indigo-50/70 dark:bg-slate-950/60 border border-indigo-200 dark:border-indigo-900/60">
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">⚖️ Net Credit / Debt Position</span>
                        <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${netCreditPosition >= 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'}">
                            ${netCreditPosition >= 0 ? 'Net Creditor' : 'Net Borrower'}
                        </span>
                    </div>
                    <div class="text-2xl font-black ${netCreditPosition >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} mt-1">
                        ${netCreditPosition >= 0 ? '+' : '-'}${formatKes(Math.abs(netCreditPosition))}
                    </div>
                    <div class="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                        Credited (${formatKes(totalCreditedRemaining)}) minus Borrowed (${formatKes(totalBorrowedRemaining)})
                    </div>
                </div>
            </div>

            <!-- Collapsible New Loan Borrowed / Money Credited Drawer -->
            <div id="salaried-loan-form-drawer" class="hidden p-5 rounded-2xl bg-gray-50 dark:bg-slate-950/90 border-2 border-indigo-400/60 dark:border-indigo-700 space-y-4">
                <div class="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
                    <div>
                        <h3 id="salaried-loan-form-title" class="text-sm font-black text-gray-900 dark:text-white">📉 Log a Loan Borrowed or 📈 Money Credited / Lent Out</h3>
                        <p class="text-[11px] text-gray-500">Select a quick preset or fill in counterparty, amount, checkoff installment, and due date.</p>
                    </div>
                    <button type="button" onclick="closeSalariedLoanForm()" class="text-xs font-bold text-gray-400 hover:text-gray-700 dark:hover:text-white px-2 py-1 rounded-lg">✕ Close</button>
                </div>

                <!-- Quick Preset Pills -->
                <div class="space-y-1.5">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">⚡ Quick Salaried Presets:</span>
                    <div class="flex flex-wrap gap-1.5">
                        <button type="button" onclick="applySalariedLoanPreset('I_OWE', 'SACCO Loan', 'SACCO Checkoff / Development Loan')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-100/80 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800 hover:bg-rose-200 transition">
                            🏦 SACCO Loan (Borrowed)
                        </button>
                        <button type="button" onclick="applySalariedLoanPreset('I_OWE', 'Salary Advance', 'Employer Salary Advance')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-100/80 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800 hover:bg-rose-200 transition">
                            💼 Salary Advance (Borrowed)
                        </button>
                        <button type="button" onclick="applySalariedLoanPreset('I_OWE', 'Bank Checkoff Loan', 'Bank Personal / Checkoff Loan')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-100/80 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800 hover:bg-rose-200 transition">
                            🏛️ Bank Checkoff Loan
                        </button>
                        <button type="button" onclick="applySalariedLoanPreset('I_OWE', 'HELB Loan', 'HELB Higher Education Loan')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-100/80 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800 hover:bg-rose-200 transition">
                            🎓 HELB Loan
                        </button>
                        <button type="button" onclick="applySalariedLoanPreset('I_OWE', 'Mobile Loan', 'M-Shwari / Fuliza / KCB M-Pesa')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-100/80 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800 hover:bg-rose-200 transition">
                            📱 Mobile Loan (Fuliza/M-Shwari)
                        </button>
                        <button type="button" onclick="applySalariedLoanPreset('OWED_TO_ME', 'Colleague / Friend Credit', 'Colleague')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200 transition">
                            🤝 Lent to Colleague / Friend
                        </button>
                        <button type="button" onclick="applySalariedLoanPreset('OWED_TO_ME', 'Side-Hustle Client Credit', 'Client Invoice / Credit')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200 transition">
                            ⚡ Side-Hustle Client Credit
                        </button>
                    </div>
                </div>

                <form action="/salaried/loans/create" method="POST" class="space-y-4 text-xs">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label class="block font-bold text-gray-700 dark:text-gray-300 mb-1">Transaction Direction</label>
                            <select name="debt_type" id="salaried_loan_type_select" onchange="syncSalariedLoanDirectionUI()" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-extrabold text-gray-900 dark:text-white">
                                <option value="I_OWE">📉 I Borrowed a Loan (I Owe)</option>
                                <option value="OWED_TO_ME">📈 I Credited / Lent Money (Owed to Me)</option>
                            </select>
                        </div>

                        <div>
                            <label class="block font-bold text-gray-700 dark:text-gray-300 mb-1">Category / Facility Type</label>
                            <input type="text" name="loan_category" id="salaried_loan_category_input" value="SACCO Loan" placeholder="e.g. SACCO Loan, Salary Advance, Lent Cash" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white">
                        </div>

                        <div>
                            <label id="salaried_counterparty_label" class="block font-bold text-gray-700 dark:text-gray-300 mb-1">Lender / Institution or Person Name</label>
                            <input type="text" name="person_name" id="salaried_person_name_input" placeholder="e.g. Stima SACCO, Employer HR, John Kamau" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white" required>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label class="block font-bold text-gray-700 dark:text-gray-300 mb-1">Total Loan / Credit Amount (Ksh)</label>
                            <input type="number" step="any" min="1" name="total_amount" placeholder="e.g. 50000" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-black text-sm text-indigo-600 dark:text-indigo-400" required>
                        </div>

                        <div>
                            <label class="block font-bold text-gray-700 dark:text-gray-300 mb-1">Amount Already Paid / Repaid (Ksh)</label>
                            <input type="number" step="any" min="0" name="paid_amount" value="0" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white">
                        </div>

                        <div>
                            <label class="block font-bold text-gray-700 dark:text-gray-300 mb-1">Monthly Checkoff / Installment (Ksh)</label>
                            <input type="number" step="any" min="0" name="monthly_installment" value="0" placeholder="Optional monthly deduction" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label class="block font-bold text-gray-700 dark:text-gray-300 mb-1">Date Issued / Borrowed</label>
                            <input type="date" name="issued_at" value="${todayIso}" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white" required>
                        </div>

                        <div>
                            <label class="block font-bold text-gray-700 dark:text-gray-300 mb-1">Due Date / Final Payoff Date</label>
                            <input type="date" name="due_at" value="${defaultDueIso}" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white" required>
                        </div>

                        <div>
                            <label class="block font-bold text-gray-700 dark:text-gray-300 mb-1">Notes / Purpose</label>
                            <input type="text" name="description" placeholder="e.g. 12% p.a. checkoff, emergency advance" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-medium text-gray-900 dark:text-white">
                        </div>
                    </div>

                    <!-- Optional Account Sync -->
                    <div class="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <label class="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" name="link_account" onchange="document.getElementById('salaried_loan_acc_wrap').classList.toggle('hidden', !this.checked)" class="rounded text-indigo-600 focus:ring-indigo-500">
                            <span class="font-bold text-gray-700 dark:text-gray-300">Sync with Bank / M-Pesa Account Balance (+ for Borrowed received, - for Money Lent out)</span>
                        </label>
                        <div id="salaried_loan_acc_wrap" class="hidden sm:w-64">
                            <select name="account_id" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg font-bold text-xs text-gray-900 dark:text-white">
                                <option value="">-- Select Account --</option>
                                ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (${formatKes(a.balance)})</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="flex justify-end gap-2">
                        <button type="button" onclick="closeSalariedLoanForm()" class="px-4 py-2.5 rounded-xl font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition">
                            Cancel
                        </button>
                        <button type="submit" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-md transition active:scale-95">
                            💾 Save Loan / Credit Record
                        </button>
                    </div>
                </form>
            </div>

            <!-- Filter Tabs -->
            <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <button type="button" id="sal-tab-ALL" onclick="filterSalariedLoans('ALL')" class="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-600 text-white transition">
                        All (${salaried_loans.length})
                    </button>
                    <button type="button" id="sal-tab-I_OWE" onclick="filterSalariedLoans('I_OWE')" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition">
                        📉 Loans Borrowed (${salaried_loans.filter((l) => l.debt_type === 'I_OWE').length})
                    </button>
                    <button type="button" id="sal-tab-OWED_TO_ME" onclick="filterSalariedLoans('OWED_TO_ME')" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition">
                        📈 Money Credited / Lent (${salaried_loans.filter((l) => l.debt_type === 'OWED_TO_ME').length})
                    </button>
                    <button type="button" id="sal-tab-PAID" onclick="filterSalariedLoans('PAID')" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition">
                        ✅ Settled (${salaried_loans.filter((l) => l.status === 'PAID').length})
                    </button>
                </div>
                <span class="text-[11px] text-gray-400">Synced with your unified Finatrack Debt &amp; Credit Ledger</span>
            </div>

            <!-- Loans & Credits List -->
            ${salaried_loans.length === 0 ? `
            <div class="p-8 text-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-2">
                <div class="text-3xl">💳</div>
                <h3 class="text-sm font-bold text-gray-800 dark:text-gray-200">No Borrowed Loans or Credited Money Logged Yet</h3>
                <p class="text-xs text-gray-500 max-w-md mx-auto">
                    Have a SACCO loan, employer salary advance, HELB, or bank checkoff? Or did you credit/lend money to a colleague or friend? Log it above to track every shilling until settled.
                </p>
                <div class="pt-2 flex justify-center gap-2">
                    <button type="button" onclick="openSalariedLoanForm('I_OWE')" class="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition">
                        📉 + Log Loan Borrowed
                    </button>
                    <button type="button" onclick="openSalariedLoanForm('OWED_TO_ME')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition">
                        📈 + Log Money Credited
                    </button>
                </div>
            </div>
            ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${salaried_loans.map((loan) => {
                  const totalAmt = Number(loan.total_amount) || 0;
                  const paidAmt = Number(loan.paid_amount) || 0;
                  const remainingAmt = Math.max(0, totalAmt - paidAmt);
                  const pctPaid = totalAmt > 0 ? Math.min(100, Math.round((paidAmt / totalAmt) * 100)) : 0;
                  const isBorrowed = loan.debt_type === 'I_OWE';
                  const isPaid = loan.status === 'PAID' || remainingAmt <= 0;
                  const deadlineInfo = calculateDebtDeadline(loan.due_at || defaultDueIso);
                  const safeDomId = String(loan.id).replace(/[^a-zA-Z0-9_-]/g, '_');

                  const badgeColors = isPaid
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : deadlineInfo.isOverdue || deadlineInfo.isDangerZone
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                      : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800';

                  return `
                  <div class="salaried-loan-item p-4 rounded-2xl border ${isPaid ? 'border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 opacity-80' : isBorrowed ? 'border-rose-200 dark:border-rose-900/60 bg-white dark:bg-gray-900' : 'border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-gray-900'} shadow-2xs space-y-3"
                       data-debt-type="${loan.debt_type}"
                       data-status="${loan.status}">
                      <div class="flex items-start justify-between gap-2">
                          <div class="space-y-0.5">
                              <div class="flex items-center gap-1.5 flex-wrap">
                                  <span class="px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${isBorrowed ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'}">
                                      ${isBorrowed ? '📉 Borrowed (I Owe)' : '📈 Credited / Lent (Owed to Me)'}
                                  </span>
                                  ${loan.loan_category ? `
                                  <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                      ${loan.loan_category}
                                  </span>` : ''}
                              </div>
                              <h4 class="text-sm font-black text-gray-900 dark:text-white pt-0.5">${loan.person_name}</h4>
                              ${loan.description ? `<p class="text-[11px] text-gray-500 dark:text-gray-400">${loan.description}</p>` : ''}
                          </div>

                          <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeColors}">
                              ${isPaid ? '✅ SETTLED' : deadlineInfo.isOverdue ? `🚨 OVERDUE (${Math.abs(deadlineInfo.daysRemaining)}d)` : `⏳ Due in ${deadlineInfo.daysRemaining}d`}
                          </span>
                      </div>

                      <!-- Financial Amounts Row -->
                      <div class="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 text-xs">
                          <div>
                              <span class="text-[10px] text-gray-400 block">Principal</span>
                              <span class="font-bold text-gray-800 dark:text-gray-200">${formatKes(totalAmt)}</span>
                          </div>
                          <div>
                              <span class="text-[10px] text-gray-400 block">${isBorrowed ? 'Repaid So Far' : 'Collected So Far'}</span>
                              <span class="font-bold text-emerald-600 dark:text-emerald-400">${formatKes(paidAmt)} (${pctPaid}%)</span>
                          </div>
                          <div>
                              <span class="text-[10px] text-gray-400 block">Remaining Balance</span>
                              <span class="font-black ${isBorrowed ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}">${formatKes(remainingAmt)}</span>
                          </div>
                      </div>

                      <!-- Progress Bar -->
                      <div class="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div class="h-full ${isBorrowed ? 'bg-rose-500' : 'bg-emerald-500'} rounded-full transition-all" style="width: ${pctPaid}%"></div>
                      </div>

                      <div class="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                          <span>Issued: <strong>${loan.issued_at}</strong> • Due: <strong>${loan.due_at}</strong></span>
                          ${Number(loan.monthly_installment) > 0 ? `<span class="font-bold text-indigo-600 dark:text-indigo-400">Checkoff: ${formatKes(loan.monthly_installment || 0)}/mo</span>` : ''}
                      </div>

                      <!-- Action Buttons -->
                      <div class="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                          ${!isPaid ? `
                          <button type="button" onclick="document.getElementById('sal-repay-drawer-${safeDomId}').classList.toggle('hidden')" class="px-3 py-1.5 rounded-xl text-xs font-extrabold ${isBorrowed ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} transition active:scale-95">
                              💸 ${isBorrowed ? 'Record Repayment' : 'Collect Credit'}
                          </button>
                          ` : `
                          <span class="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">🎉 Fully Settled</span>
                          `}

                          <div class="flex items-center gap-1.5">
                              <form action="/salaried/loans/toggle-status/${loan.id}" method="POST" class="inline">
                                  <button type="submit" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 transition">
                                      ${isPaid ? '↺ Reopen' : '✓ Mark Paid'}
                                  </button>
                              </form>
                              <form action="/salaried/loans/delete/${loan.id}" method="POST" class="inline">
                                  <button type="submit" class="px-2 py-1 rounded-lg text-[11px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition" title="Delete record">
                                      🗑️
                                  </button>
                              </form>
                          </div>
                      </div>

                      <!-- Inline Repayment / Collection Drawer -->
                      <div id="sal-repay-drawer-${safeDomId}" class="hidden pt-3 border-t border-dashed border-gray-200 dark:border-gray-700">
                          <form action="/salaried/loans/repay/${loan.id}" method="POST" class="space-y-2.5 text-xs">
                              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                      <label class="block text-[10px] font-bold text-gray-500 mb-0.5">${isBorrowed ? 'Repayment Amount (Ksh)' : 'Amount Collected (Ksh)'}</label>
                                      <input type="number" step="any" min="1" name="repayment_amount" value="${Number(loan.monthly_installment) > 0 && Number(loan.monthly_installment) < remainingAmt ? loan.monthly_installment : remainingAmt}" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg font-black text-gray-900 dark:text-white" required>
                                  </div>
                                  <div>
                                      <label class="block text-[10px] font-bold text-gray-500 mb-0.5">${isBorrowed ? 'Deduct From Account (Optional)' : 'Deposit Into Account (Optional)'}</label>
                                      <select name="account_id" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg font-bold text-gray-900 dark:text-white">
                                          <option value="">-- Do Not Sync Account --</option>
                                          ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (${formatKes(a.balance)})</option>`).join('')}
                                      </select>
                                  </div>
                              </div>
                              <button type="submit" class="w-full py-2 rounded-lg font-extrabold text-white ${isBorrowed ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'} transition">
                                  ✓ Confirm ${isBorrowed ? 'Loan Repayment' : 'Credit Collection'}
                              </button>
                          </form>
                      </div>
                  </div>`;
                }).join('')}
            </div>
            `}
        </div>
    </main>

    <!-- Payday Settings Modal -->
    <div id="salaried-settings-modal" class="hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div class="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
                <h3 class="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                    <span>⚙️ Payday &amp; Salary Settings</span>
                </h3>
                <button type="button" onclick="document.getElementById('salaried-settings-modal').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form action="/salaried/config" method="POST" class="space-y-3 text-xs">
                <div>
                    <label class="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Employer / Company Name</label>
                    <input type="text" name="employer_name" value="${salaried_config.employer_name}" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white" required>
                </div>
                <div>
                    <label class="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Monthly Net Salary (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" name="monthly_net_salary" value="${salaried_config.monthly_net_salary}" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl font-black text-indigo-600 dark:text-indigo-400 text-sm" required>
                </div>
                <div>
                    <label class="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Payday Day of Month (e.g. 25, 28, 30)</label>
                    <input type="number" min="1" max="31" name="payday_day" value="${salaried_config.payday_day}" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white" required>
                </div>
                <div>
                    <label class="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Estimated Monthly Side-Hustle Income (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" name="side_hustle_estimate" value="${salaried_config.side_hustle_estimate}" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl font-bold text-amber-600 dark:text-amber-400">
                </div>
                <div>
                    <label class="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Monthly Discretionary Living Budget (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" name="living_budget_monthly" value="${salaried_config.living_budget_monthly}" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white" required>
                </div>
                <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-xl transition shadow-xs">
                    Save Payday Settings
                </button>
            </form>
        </div>
    </div>

    <!-- Universal Profile Switcher Modal -->
    <div id="profile-switcher-modal" class="hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div class="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
                <div>
                    <h3 class="font-extrabold text-base text-gray-900 dark:text-white">Choose Your Finatrack Profile</h3>
                    <p class="text-xs text-gray-500">Switch between profiles anytime. All accounts &amp; wealth data stay unified!</p>
                </div>
                <button type="button" onclick="closeProfileModal()" class="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div class="grid grid-cols-1 gap-2.5 text-xs">
                <!-- 1. Rider Mode -->
                <form action="/profile/switch" method="POST">
                    <input type="hidden" name="profile_mode" value="RIDER">
                    <button type="submit" class="w-full p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-gray-800/80 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 text-left transition flex items-center justify-between group active:scale-98">
                        <div class="flex items-center space-x-3">
                            <span class="text-2xl p-2 bg-blue-100 dark:bg-blue-950 rounded-xl">🛵</span>
                            <div>
                                <span class="font-bold text-sm text-gray-900 dark:text-white block group-hover:text-blue-600">Mobility &amp; Rider Mode</span>
                                <span class="text-gray-500 dark:text-gray-400">Kilometers, Fuel, CPK &amp; 23:50 Shift Closeout Ritual</span>
                            </div>
                        </div>
                        <span class="text-blue-600 font-extrabold text-xs">Switch →</span>
                    </button>
                </form>

                <!-- 2. Mama Mboga Mode -->
                <form action="/profile/switch" method="POST">
                    <input type="hidden" name="profile_mode" value="TRADER">
                    <button type="submit" class="w-full p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-white dark:bg-gray-800/80 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40 text-left transition flex items-center justify-between group active:scale-98">
                        <div class="flex items-center space-x-3">
                            <span class="text-2xl p-2 bg-emerald-100 dark:bg-emerald-950 rounded-xl">🥬</span>
                            <div>
                                <span class="font-bold text-sm text-gray-900 dark:text-white block group-hover:text-emerald-600">Mama Mboga &amp; Micro-Shop</span>
                                <span class="text-gray-500 dark:text-gray-400">Marikiti Soko Restock, Kanjo Fees &amp; Daftari ya Mkopo</span>
                            </div>
                        </div>
                        <span class="text-emerald-600 font-extrabold text-xs">Switch →</span>
                    </button>
                </form>

                <!-- 3. Salaried Mode -->
                <form action="/profile/switch" method="POST">
                    <input type="hidden" name="profile_mode" value="SALARIED">
                    <button type="submit" class="w-full p-3.5 rounded-2xl border-2 border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-left transition flex items-center justify-between group active:scale-98">
                        <div class="flex items-center space-x-3">
                            <span class="text-2xl p-2 bg-indigo-200 dark:bg-indigo-900 rounded-xl">💼</span>
                            <div>
                                <span class="font-black text-sm text-indigo-950 dark:text-white block">Salaried &amp; Professional (Active)</span>
                                <span class="text-indigo-700 dark:text-indigo-300">Monthly Payday Waterfall &amp; Salary Runway Pacing</span>
                            </div>
                        </div>
                        <span class="text-indigo-700 dark:text-indigo-300 font-extrabold text-xs">✓ Active</span>
                    </button>
                </form>
            </div>
        </div>
    </div>

        <!-- Bottom Mobile Navigation Bar -->
    <nav class="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800/80 px-4 py-2 flex justify-around items-center sm:hidden shadow-lg safe-area-bottom">
        <a href="/" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-indigo-600 active:scale-90 transition-transform font-medium">
            <span class="text-xl">⚡</span>
            <span class="text-[10px] tracking-tight">Finance</span>
        </a>
        <a href="#payday-card" class="flex flex-col items-center gap-0.5 text-indigo-600 dark:text-indigo-400 font-bold active:scale-90 transition-transform">
            <span class="text-xl">👑</span>
            <span class="text-[10px] tracking-tight">Payday</span>
        </a>
        <a href="#salaried-loans-card" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-rose-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">💳</span>
            <span class="text-[10px] tracking-tight">Loans</span>
        </a>
        <a href="/#waterfall-card" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-amber-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">🌊</span>
            <span class="text-[10px] tracking-tight">Split</span>
        </a>
        <button type="button" onclick="openProfileModal()" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-purple-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">🔄</span>
            <span class="text-[10px] tracking-tight">Profile</span>
        </button>
    </nav>

    <script>
        function updateThemeIcon() {
            const isDark = document.documentElement.classList.contains('dark');
            document.querySelectorAll('.dark-mode-toggle-btn').forEach(btn => {
                btn.innerHTML = isDark ? '☀️' : '🌙';
                btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
            });
        }

        function toggleDarkMode() {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeIcon();
        }

        document.addEventListener('DOMContentLoaded', () => {
            updateThemeIcon();
        });

        function openProfileModal() {
            document.getElementById('profile-switcher-modal')?.classList.remove('hidden');
        }

        function closeProfileModal() {
            document.getElementById('profile-switcher-modal')?.classList.add('hidden');
        }

        function syncSalariedLoanDirectionUI() {
            const sel = document.getElementById('salaried_loan_type_select');
            const label = document.getElementById('salaried_counterparty_label');
            const title = document.getElementById('salaried-loan-form-title');
            if (!sel) return;
            if (sel.value === 'OWED_TO_ME') {
                if (label) label.textContent = 'Borrower Name (Colleague / Friend / Client who owes you)';
                if (title) title.textContent = '📈 Log Money Credited / Lent Out (Owed to You)';
            } else {
                if (label) label.textContent = 'Lender / Institution Name (SACCO / Employer / Bank)';
                if (title) title.textContent = '📉 Log a Loan Borrowed (I Owe)';
            }
        }

        function openSalariedLoanForm(direction) {
            const drawer = document.getElementById('salaried-loan-form-drawer');
            const sel = document.getElementById('salaried_loan_type_select');
            const catInput = document.getElementById('salaried_loan_category_input');
            if (drawer) drawer.classList.remove('hidden');
            if (sel && direction) {
                sel.value = direction;
                if (catInput) {
                    catInput.value = direction === 'OWED_TO_ME' ? 'Personal Credit / Lent' : 'SACCO Loan';
                }
                syncSalariedLoanDirectionUI();
            }
            drawer?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function closeSalariedLoanForm() {
            document.getElementById('salaried-loan-form-drawer')?.classList.add('hidden');
        }

        function applySalariedLoanPreset(direction, category, placeholderHint) {
            const sel = document.getElementById('salaried_loan_type_select');
            const catInput = document.getElementById('salaried_loan_category_input');
            const personInput = document.getElementById('salaried_person_name_input');
            if (sel) sel.value = direction;
            if (catInput) catInput.value = category;
            if (personInput && !personInput.value) personInput.placeholder = placeholderHint;
            syncSalariedLoanDirectionUI();
        }

        function filterSalariedLoans(filterKey) {
            const items = document.querySelectorAll('.salaried-loan-item');
            items.forEach((el) => {
                const dtype = el.getAttribute('data-debt-type');
                const st = el.getAttribute('data-status');
                let show = true;
                if (filterKey === 'I_OWE') show = dtype === 'I_OWE';
                else if (filterKey === 'OWED_TO_ME') show = dtype === 'OWED_TO_ME';
                else if (filterKey === 'PAID') show = st === 'PAID';
                el.classList.toggle('hidden', !show);
            });

            ['ALL', 'I_OWE', 'OWED_TO_ME', 'PAID'].forEach((k) => {
                const btn = document.getElementById('sal-tab-' + k);
                if (!btn) return;
                if (k === filterKey) {
                    btn.className = 'px-3 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-600 text-white transition';
                } else {
                    btn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition';
                }
            });
        }

        window.openProfileModal = openProfileModal;
        window.closeProfileModal = closeProfileModal;
        window.toggleDarkMode = toggleDarkMode;
        window.openSalariedLoanForm = openSalariedLoanForm;
        window.closeSalariedLoanForm = closeSalariedLoanForm;
        window.applySalariedLoanPreset = applySalariedLoanPreset;
        window.syncSalariedLoanDirectionUI = syncSalariedLoanDirectionUI;
        window.filterSalariedLoans = filterSalariedLoans;
    </script>
</body>
</html>`;
}

