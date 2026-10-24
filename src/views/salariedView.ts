import { SalariedConfig, calculateDaysUntilPayday } from '../routes/salaried';

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
  } = data;

  const formatKes = (val: number | string) => 'Ksh ' + (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { daysRemaining, nextPaydayDate } = calculateDaysUntilPayday(salaried_config.payday_day);

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
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#1e1b4b">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <script>
        tailwind.config = {
            darkMode: 'media',
            theme: {
                extend: {
                    colors: {
                        indigo: { 950: '#0f0e26' }
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 min-h-screen font-sans pb-24 sm:pb-12 antialiased selection:bg-indigo-500 selection:text-white">

    <!-- Top Navigation Header -->
    <header class="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-indigo-200 dark:border-indigo-900/60 shadow-xs">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
            <div class="flex items-center space-x-3">
                <a href="/" class="flex items-center space-x-2">
                    <span class="text-2xl">💼</span>
                    <span class="text-xl font-black bg-gradient-to-r from-indigo-600 via-teal-500 to-amber-500 bg-clip-text text-transparent tracking-tight">Finatrack</span>
                </a>
                <span class="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Salaried Hub
                </span>
            </div>

            <!-- Profile Mode Switcher Pill & Navigation Links -->
            <div class="flex items-center space-x-2">
                <!-- Profile Switcher Button -->
                <button type="button" onclick="openProfileModal()" class="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-1.5 shadow-2xs">
                    <span>💼 Salaried Mode</span>
                    <span class="text-[10px] opacity-70">▾</span>
                </button>

                <a href="/" class="hidden md:flex px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition">
                    ⚡ Finance
                </a>
                <a href="/rider" class="hidden md:flex px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition">
                    🛵 Rider
                </a>
                <a href="/trader" class="hidden md:flex px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition">
                    🥬 Mama Mboga
                </a>

                ${is_logged_in ? `
                <a href="/auth/logout" class="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition">
                    Logout
                </a>` : `
                <a href="/login" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs">
                    Login
                </a>`}
            </div>
        </div>
    </header>

    <!-- Toast Notification -->
    ${toast ? `
    <div id="toast-bar" class="max-w-4xl mx-auto px-4 mt-4">
        <div class="p-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg flex items-center justify-between">
            <div class="flex items-center space-x-2">
                <span>🔔</span>
                <span>${decodeURIComponent(toast)}</span>
            </div>
            <button onclick="document.getElementById('toast-bar').remove()" class="text-white hover:text-gray-200">✕</button>
        </div>
    </div>` : ''}

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        <!-- 💼 Top Salary & Payday Briefing Card -->
        <div class="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border-2 border-indigo-500/60 p-6 rounded-3xl text-white shadow-xl space-y-4">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2.5 py-0.5 bg-indigo-500 text-white font-black text-[11px] rounded-full uppercase tracking-wider">💼 Salaried &amp; Professional OS</span>
                        <span class="text-xs text-indigo-300 font-bold">${salaried_config.employer_name} • Payday: ${salaried_config.payday_day}th of every month</span>
                    </div>
                    <h1 class="text-2xl sm:text-3xl font-black text-white">Monthly Payday &amp; Salary Runway Command</h1>
                    <p class="text-xs text-indigo-200/80">Automate your Payday Ritual: Pay yourself first before lifestyle expenses and avoid the mid-month cash crash.</p>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" onclick="document.getElementById('salaried-settings-modal').classList.remove('hidden')" class="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-indigo-500/40 rounded-xl text-xs font-bold text-indigo-300 transition active:scale-95 flex items-center gap-1.5">
                        ⚙️ Payday Settings
                    </button>
                    <a href="/#waterfall-card" class="px-4 py-2 bg-gradient-to-r from-amber-500 to-indigo-500 hover:from-amber-600 hover:to-indigo-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5">
                        👑 Pay Yourself First
                    </a>
                </div>
            </div>

            <!-- Key Numbers Bar -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div class="p-3 bg-slate-950/70 border border-indigo-500/30 rounded-2xl">
                    <span class="text-[10px] font-bold text-indigo-300 uppercase block">⏳ Days to Next Payday</span>
                    <span class="text-2xl font-black text-white">${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</span>
                    <span class="text-[10px] text-indigo-400 block mt-0.5">Landing on ${nextPaydayDate}</span>
                </div>
                <div class="p-3 bg-slate-950/70 border border-emerald-500/30 rounded-2xl">
                    <span class="text-[10px] font-bold text-emerald-300 uppercase block">💵 Safe Daily Spend</span>
                    <span class="text-2xl font-black text-emerald-400">${formatKes(safeDailySpend)}/d</span>
                    <span class="text-[10px] block mt-0.5 ${paceStatus.color} px-1.5 py-0.2 rounded-full inline-block font-extrabold text-[9px] border">${paceStatus.label}</span>
                </div>
                <div class="p-3 bg-slate-950/70 border border-cyan-500/30 rounded-2xl">
                    <span class="text-[10px] font-bold text-cyan-300 uppercase block">🏦 Monthly Net Take-Home</span>
                    <span class="text-2xl font-black text-cyan-400">${formatKes(salaried_config.monthly_net_salary)}</span>
                    <span class="text-[10px] text-gray-400 block mt-0.5">Pure salary after PAYE &amp; deductions</span>
                </div>
                <div class="p-3 bg-slate-950/70 border border-amber-500/30 rounded-2xl">
                    <span class="text-[10px] font-bold text-amber-300 uppercase block">⚡ Blended Inflows (+Hustle)</span>
                    <span class="text-2xl font-black text-amber-400">${formatKes(totalBlendedMonthly)}</span>
                    <span class="text-[10px] text-amber-300 block mt-0.5">${salaried_config.side_hustle_estimate > 0 ? `+${formatKes(salaried_config.side_hustle_estimate)} side hustle` : 'Add side hustle below'}</span>
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
        <a href="/#waterfall-card" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-amber-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">🌊</span>
            <span class="text-[10px] tracking-tight">Split</span>
        </a>
        <a href="/#mmf-card" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-emerald-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">📈</span>
            <span class="text-[10px] tracking-tight">MMF</span>
        </a>
    </nav>

    <script>
        function openProfileModal() {
            document.getElementById('profile-switcher-modal')?.classList.remove('hidden');
        }

        function closeProfileModal() {
            document.getElementById('profile-switcher-modal')?.classList.add('hidden');
        }

        window.openProfileModal = openProfileModal;
        window.closeProfileModal = closeProfileModal;
    </script>
</body>
</html>`;
}
