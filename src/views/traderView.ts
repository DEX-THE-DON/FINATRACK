import { TraderCloseoutLog, TraderCustomerCredit, TraderConfig } from '../routes/trader';

export function renderTraderDashboard(data: {
  username?: string;
  is_logged_in?: boolean;
  trader_config: TraderConfig;
  trader_logs: TraderCloseoutLog[];
  trader_credits: TraderCustomerCredit[];
  toast?: string;
  current_currency?: string;
  today_shift_net?: number;
}): string {
  const {
    username = 'Dennis',
    is_logged_in = false,
    trader_config,
    trader_logs = [],
    trader_credits = [],
    toast = '',
    current_currency = 'Ksh',
  } = data;

  const formatKes = (val: number | string) => 'Ksh ' + (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const todayIso = new Date().toISOString().slice(0, 10);

  // Aggregations
  const totalUnpaidCredit = trader_credits
    .filter(cr => cr.status !== 'PAID')
    .reduce((sum, cr) => sum + Math.max(0, cr.amount - (cr.paid_amount || 0)), 0);

  const unpaidCount = trader_credits.filter(cr => cr.status !== 'PAID').length;

  const latestLog = trader_logs[0] || null;
  const latestNet = latestLog ? latestLog.net_profit : 0;
  const targetFloor = trader_config.daily_profit_target || 1000;
  const isTargetHit = latestNet >= targetFloor;
  const latestOverflow = Math.max(0, latestNet - targetFloor);

  return `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>🥬 Mama Mboga &amp; Soko Hub - Finatrack</title>
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
    <meta name="theme-color" content="#064e3b">
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
                        emerald: { 850: '#064e3b', 950: '#022c22' }
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
<body class="bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 min-h-screen font-sans pb-28 sm:pb-12 antialiased selection:bg-emerald-500 selection:text-white">

    <!-- Top Navigation Header -->
    <header class="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200/80 dark:border-emerald-900/60 shadow-xs">
        <div class="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2">
            <a href="/" class="flex items-center space-x-2.5 shrink-0">
                <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-base sm:text-lg text-white shadow-xs">
                    🥬
                </div>
                <div>
                    <span class="font-extrabold text-base sm:text-lg text-gray-900 dark:text-white tracking-tight block leading-none">Finatrack</span>
                    <span class="hidden sm:block text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mt-0.5">Soko &amp; Stall Hub</span>
                </div>
            </a>

            <!-- Profile Mode Switcher Pill & Navigation Links -->
            <div class="flex items-center gap-1.5 sm:gap-2.5">
                <!-- Profile Switcher Button -->
                <button type="button" onclick="openProfileModal()" class="px-2.5 sm:px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-1 shadow-2xs">
                    <span>🥬 <span class="hidden sm:inline">Mama Mboga Mode</span><span class="sm:hidden">Soko</span></span>
                    <span class="text-[10px] opacity-70">▾</span>
                </button>

                <div class="hidden md:flex items-center space-x-1 bg-gray-100/80 dark:bg-gray-800/80 p-1 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                    <a href="/" class="px-2.5 py-1 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition">
                        ⚡ Finance
                    </a>
                    <a href="/rider" class="px-2.5 py-1 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition">
                        🛵 Rider
                    </a>
                    <a href="/salaried" class="px-2.5 py-1 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition">
                        💼 Salaried
                    </a>
                </div>

                ${is_logged_in ? `
                <div class="flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1.5 rounded-xl shadow-xs">
                    <span class="text-xs">👤</span>
                    <span class="text-xs font-bold text-emerald-800 dark:text-emerald-300 max-w-[90px] truncate hidden sm:inline">${username}</span>
                    <form action="/auth/logout" method="POST" class="inline m-0 p-0">
                        <input type="hidden" name="redirect_to" value="/trader">
                        <button type="submit" title="Logout" class="text-[11px] text-rose-500 dark:text-rose-400 font-bold hover:underline ml-0.5">✕</button>
                    </form>
                </div>` : `
                <a href="/login" class="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1">
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
        <div class="p-3 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-lg flex items-center justify-between">
            <div class="flex items-center space-x-2">
                <span>🔔</span>
                <span>${decodeURIComponent(toast)}</span>
            </div>
            <button onclick="document.getElementById('toast-bar').remove()" class="text-white hover:text-gray-200">✕</button>
        </div>
    </div>` : ''}

    <main class="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">

        <!-- ☀️ Top Soko / Market Briefing Card -->
        <div class="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 border border-emerald-500/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl text-white shadow-xl space-y-4">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
                <div class="space-y-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2.5 py-0.5 bg-emerald-500 text-slate-950 font-black text-[10px] sm:text-[11px] rounded-full uppercase tracking-wider">🥬 Mama Mboga &amp; Soko OS</span>
                        <span class="text-xs text-emerald-300 font-bold">${trader_config.stall_name} • ${trader_config.market_location}</span>
                    </div>
                    <h1 class="text-xl sm:text-3xl font-black text-white leading-tight">Daily Stall &amp; Marikiti Soko Command</h1>
                    <p class="text-xs text-emerald-200/80">Capital is Holy: Keep Tomorrow's Soko Restock Fund separate from today's dinner and living expenses.</p>
                </div>
                <div class="flex items-center gap-2 flex-wrap w-full md:w-auto">
                    <button type="button" onclick="document.getElementById('stall-settings-modal').classList.remove('hidden')" class="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-emerald-500/40 rounded-xl text-xs font-bold text-emerald-300 transition active:scale-95 flex items-center gap-1.5">
                        ⚙️ Soko Settings
                    </button>
                    <a href="/#waterfall-card" class="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-600 hover:to-emerald-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5">
                        👑 Pay Yourself First
                    </a>
                </div>
            </div>

            <!-- Key Numbers Bar -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-1">
                <div class="p-3 bg-slate-950/75 border border-emerald-500/30 rounded-2xl">
                    <span class="text-[10px] font-bold text-emerald-300 uppercase block">🎯 Daily Net Target</span>
                    <span class="text-base sm:text-xl font-black text-white break-words">${formatKes(targetFloor)}</span>
                    <span class="text-[10px] text-emerald-400 block mt-0.5">${isTargetHit ? '🟢 Target Met' : '⏳ Floor to Hit Today'}</span>
                </div>
                <div class="p-3 bg-slate-950/75 border border-amber-500/30 rounded-2xl">
                    <span class="text-[10px] font-bold text-amber-300 uppercase block">📦 Restock Fund</span>
                    <span class="text-base sm:text-xl font-black text-amber-400 break-words">${formatKes(trader_config.default_restock_kes)}</span>
                    <span class="text-[10px] text-gray-400 block mt-0.5">Protected Soko Capital</span>
                </div>
                <div class="p-3 bg-slate-950/75 border border-rose-500/30 rounded-2xl">
                    <span class="text-[10px] font-bold text-rose-300 uppercase block">📒 Daftari (Owed)</span>
                    <span class="text-base sm:text-xl font-black text-rose-400 break-words">${formatKes(totalUnpaidCredit)}</span>
                    <span class="text-[10px] text-rose-300 block mt-0.5">${unpaidCount} customer${unpaidCount === 1 ? '' : 's'}</span>
                </div>
                <div class="p-3 bg-slate-950/75 border border-cyan-500/30 rounded-2xl">
                    <span class="text-[10px] font-bold text-cyan-300 uppercase block">🚀 Latest Net Profit</span>
                    <span class="text-base sm:text-xl font-black text-cyan-400 break-words">${formatKes(latestNet)}</span>
                    <span class="text-[10px] text-cyan-300 block mt-0.5">${latestOverflow > 0 ? `+${formatKes(latestOverflow)} swept` : 'Last closeout'}</span>
                </div>
            </div>
        </div>

        <!-- Main Layout: 2 Columns on Desktop -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

            <!-- Left Col (7 cols): Soko Closeout Logger + Restock Margin Estimator -->
            <div class="lg:col-span-7 space-y-6">

                <!-- 🥬 1. Daily Stall / Market Closeout Logger -->
                <div id="closeout-card" class="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-900/60 p-6 rounded-3xl shadow-sm space-y-4">
                    <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                        <div class="flex items-center space-x-2">
                            <span class="text-2xl">🧺</span>
                            <div>
                                <h2 class="text-lg font-bold text-gray-900 dark:text-white">Daily Soko &amp; Stall Closeout</h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400">Record gross sales, lock tomorrow's restock capital, and compute your pure net daily profit.</p>
                            </div>
                        </div>
                        <span class="text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold rounded-lg">
                            Today: ${todayIso}
                        </span>
                    </div>

                    <form action="/trader/closeout" method="POST" class="space-y-4" oninput="recalcTraderCloseoutPreview()">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    💰 Gross Sales Collected (<span class="curr-symbol-label">Ksh</span>)
                                </label>
                                <input type="number" step="any" name="gross_sales" id="trader_gross" placeholder="e.g. 5500" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-black text-lg text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500" required>
                                <span class="text-[10px] text-gray-400">Total cash in till drawer + M-Pesa Buy Goods</span>
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                                    📦 Tomorrow's Restock Fund (<span class="curr-symbol-label">Ksh</span>)
                                </label>
                                <input type="number" step="any" name="restock_fund" id="trader_restock" value="${trader_config.default_restock_kes}" placeholder="3000" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-amber-300 dark:border-amber-700/60 rounded-xl font-black text-lg text-amber-600 dark:text-amber-400 focus:ring-2 focus:ring-amber-500" required>
                                <span class="text-[10px] text-amber-600 dark:text-amber-400 font-bold">⚠️ Non-negotiable inventory capital for Marikiti</span>
                            </div>
                        </div>

                        <!-- Daily Operating Expenses -->
                        <div>
                            <span class="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-2">
                                🏛️ Stall &amp; Market Operating Expenses (<span class="curr-symbol-label">Ksh</span>)
                            </span>
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                                <div>
                                    <label class="block text-[10px] text-gray-500 mb-0.5">🏛️ Kanjo Ticket</label>
                                    <input type="number" step="any" name="kanjo_fee" id="trader_kanjo" value="50" class="w-full p-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-bold text-gray-900 dark:text-white">
                                </div>
                                <div>
                                    <label class="block text-[10px] text-gray-500 mb-0.5">📦 Porters &amp; Luggage</label>
                                    <input type="number" step="any" name="porter_fee" id="trader_porter" value="100" class="w-full p-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-bold text-gray-900 dark:text-white">
                                </div>
                                <div>
                                    <label class="block text-[10px] text-gray-500 mb-0.5">🛍️ Nylon Bags / Wrap</label>
                                    <input type="number" step="any" name="packaging_fee" id="trader_packaging" value="50" class="w-full p-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-bold text-gray-900 dark:text-white">
                                </div>
                                <div>
                                    <label class="block text-[10px] text-gray-500 mb-0.5">📱 Airtime &amp; Misc</label>
                                    <input type="number" step="any" name="airtime_fee" id="trader_airtime" value="50" class="w-full p-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-bold text-gray-900 dark:text-white">
                                </div>
                            </div>
                        </div>

                        <!-- Live Soko Profit & Overflow Preview -->
                        <div id="trader_preview_box" class="p-3.5 bg-slate-900 text-white rounded-2xl border border-emerald-500/50 space-y-1.5">
                            <div class="flex justify-between items-center text-xs">
                                <span class="text-emerald-300 font-bold uppercase tracking-wider text-[10px]">Live Daily Profit Preview:</span>
                                <span id="trader_status_badge" class="px-2 py-0.5 bg-gray-700 rounded-full text-[10px] font-bold">Waiting for input</span>
                            </div>
                            <div class="flex justify-between items-baseline">
                                <div>
                                    <span class="text-xs text-gray-400">Pure Net Profit:</span>
                                    <p id="trader_preview_net" class="text-2xl font-black text-emerald-400">Ksh 0.00</p>
                                </div>
                                <div class="text-right">
                                    <span class="text-[10px] text-gray-400">Total Burn (Restock + Exp):</span>
                                    <p id="trader_preview_burn" class="text-sm font-bold text-amber-400">Ksh 0.00</p>
                                </div>
                            </div>
                            <p id="trader_preview_overflow" class="text-[11px] text-emerald-300 font-medium">
                                Target Floor: Ksh ${targetFloor.toLocaleString()} Net. Extra profit sweeps 100% into MMF / Chama!
                            </p>
                        </div>

                        <div class="flex items-center gap-3 pt-1">
                            <button type="submit" class="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold py-3 px-4 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2">
                                <span>💾 Save Soko Closeout</span>
                            </button>
                            <a id="trader_split_btn" href="/#waterfall-card" class="px-4 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 shrink-0">
                                <span>👑 Split Profit Now →</span>
                            </a>
                        </div>
                    </form>
                </div>

                <!-- 🛒 2. Quick Marikiti Restock Price & Margin Estimator -->
                <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-3xl shadow-sm space-y-3">
                    <div class="flex items-center space-x-2">
                        <span class="text-xl">📊</span>
                        <div>
                            <h3 class="text-sm font-bold text-gray-900 dark:text-white">Marikiti Soko Buying Price vs. Stall Margin Calculator</h3>
                            <p class="text-[11px] text-gray-500 dark:text-gray-400">Check your gross profit margin before buying crates or sacks at Marikiti.</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs" oninput="calcMarginEstimator()">
                        <div>
                            <label class="block text-gray-500 mb-0.5">Wholesale Buy Price (<span class="curr-symbol-label">Ksh</span>)</label>
                            <input type="number" step="any" id="margin_buy" placeholder="e.g. 1500 per crate" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white">
                        </div>
                        <div>
                            <label class="block text-gray-500 mb-0.5">Expected Total Sales (<span class="curr-symbol-label">Ksh</span>)</label>
                            <input type="number" step="any" id="margin_sell" placeholder="e.g. 2400" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white">
                        </div>
                        <div class="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-200 dark:border-emerald-800 flex flex-col justify-center">
                            <span class="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase">Estimated Gross Profit</span>
                            <span id="margin_profit_display" class="text-base font-black text-emerald-600 dark:text-emerald-400">Ksh 0.00 (0%)</span>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Right Col (5 cols): Daftari ya Mkopo (Customer Credit / Debt Tracker) -->
            <div class="lg:col-span-5 space-y-6">

                <!-- 📒 Daftari ya Mali ya Mkopo -->
                <div id="daftari-card" class="bg-white dark:bg-gray-900 border border-rose-200 dark:border-rose-900/60 p-6 rounded-3xl shadow-sm space-y-4">
                    <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                        <div class="flex items-center space-x-2">
                            <span class="text-2xl">📒</span>
                            <div>
                                <h2 class="text-lg font-bold text-gray-900 dark:text-white">Daftari ya Mkopo</h2>
                                <p class="text-xs text-gray-500 dark:text-gray-400">Track customers taking sukuma, tomatoes &amp; groceries on credit.</p>
                            </div>
                        </div>
                        <button type="button" onclick="document.getElementById('new-credit-drawer').classList.toggle('hidden')" class="px-3 py-1.5 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1">
                            <span>➕ Add Record</span>
                        </button>
                    </div>

                    <!-- Add Customer Credit Drawer -->
                    <form id="new-credit-drawer" action="/trader/credit/add" method="POST" class="hidden p-4 bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl space-y-3 text-xs">
                        <div class="flex justify-between items-center font-bold text-rose-900 dark:text-rose-200">
                            <span>Record New Customer Credit</span>
                            <button type="button" onclick="document.getElementById('new-credit-drawer').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                                <label class="block text-gray-600 dark:text-gray-400 mb-0.5 font-bold">Customer Name</label>
                                <input type="text" name="customer_name" placeholder="e.g. Mama Kevin" class="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg font-bold text-gray-900 dark:text-white" required>
                            </div>
                            <div>
                                <label class="block text-gray-600 dark:text-gray-400 mb-0.5 font-bold">Phone Number (Optional)</label>
                                <input type="tel" name="phone" placeholder="07..." class="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white">
                            </div>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                                <label class="block text-gray-600 dark:text-gray-400 mb-0.5 font-bold">Amount Owed (Ksh)</label>
                                <input type="number" step="any" name="amount" placeholder="e.g. 250" class="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg font-bold text-rose-600 dark:text-rose-400" required>
                            </div>
                            <div>
                                <label class="block text-gray-600 dark:text-gray-400 mb-0.5 font-bold">Promised Pay Date</label>
                                <input type="date" name="due_date" value="${todayIso}" class="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white">
                            </div>
                        </div>
                        <div>
                            <label class="block text-gray-600 dark:text-gray-400 mb-0.5 font-bold">Items Taken on Credit</label>
                            <input type="text" name="items" placeholder="e.g. 2 bundles Sukuma wiki, 1kg Tomatoes" class="w-full p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white" required>
                        </div>
                        <button type="submit" class="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-2 rounded-xl transition shadow-xs">
                            💾 Save to Daftari
                        </button>
                    </form>

                    <!-- Credit Records List -->
                    <div class="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        ${trader_credits.length > 0 ? trader_credits.map(cr => {
                            const remaining = Math.max(0, cr.amount - (cr.paid_amount || 0));
                            const isPaid = cr.status === 'PAID' || remaining === 0;
                            const whatsappMsg = encodeURIComponent(`Habari ${cr.customer_name}, Finatrack reminder ya salio la soko/mboga ni Ksh ${remaining.toLocaleString()}. Unaweza kutuma kwa M-Pesa ukipata nafasi. Asante sana!`);
                            return `
                            <div class="p-3.5 rounded-2xl border ${isPaid ? 'bg-gray-50/60 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800 opacity-60' : 'bg-white dark:bg-gray-950 border-rose-200 dark:border-rose-900/60 shadow-2xs'} space-y-2">
                                <div class="flex justify-between items-start">
                                    <div>
                                        <h4 class="font-extrabold text-sm text-gray-900 dark:text-white">${cr.customer_name}</h4>
                                        <p class="text-[11px] text-gray-500 dark:text-gray-400">${cr.items}</p>
                                    </div>
                                    <div class="text-right">
                                        <span class="text-sm font-black ${isPaid ? 'text-gray-400 line-through' : 'text-rose-600 dark:text-rose-400'}">${formatKes(remaining)}</span>
                                        <span class="text-[9px] block font-bold uppercase ${isPaid ? 'text-emerald-500' : 'text-rose-500'}">${isPaid ? '✅ Settled' : 'Unpaid'}</span>
                                    </div>
                                </div>

                                <div class="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 dark:border-gray-800/80 pt-2">
                                    <span>Due: <strong class="text-gray-700 dark:text-gray-300">${cr.due_date || 'No date'}</strong></span>
                                    <div class="flex items-center gap-1.5">
                                        ${!isPaid && cr.phone ? `
                                        <a href="https://api.whatsapp.com/send?phone=${cr.phone.replace(/[^0-9]/g, '')}&text=${whatsappMsg}" target="_blank" class="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold rounded hover:bg-emerald-100 transition" title="Send WhatsApp friendly reminder">
                                            📱 Reminder
                                        </a>` : ''}

                                        ${!isPaid ? `
                                        <form action="/trader/credit/settle/${cr.id}" method="POST" class="inline">
                                            <input type="hidden" name="amount" value="${remaining}">
                                            <button type="submit" class="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded transition" title="Mark as settled &amp; add to Till">
                                                ✓ Lipa
                                            </button>
                                        </form>` : ''}

                                        <form action="/trader/credit/delete/${cr.id}" method="POST" class="inline" onsubmit="return confirm('Remove this customer record?')">
                                            <button type="submit" class="text-gray-400 hover:text-rose-500 text-xs px-1" title="Delete record">
                                                ✕
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>`;
                        }).join('') : `
                        <div class="p-6 text-center bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-xs text-gray-500">
                            No customers currently in Daftari ya Mkopo. Tapping "Add Record" lets you track customers taking vegetables or goods on credit.
                        </div>`}
                    </div>
                </div>

                <!-- 📜 Recent Soko Closeouts History -->
                <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-3xl shadow-sm space-y-3 text-xs">
                    <h3 class="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <span>📜</span>
                        <span>Recent Soko Closeouts</span>
                    </h3>
                    <div class="space-y-2 max-h-[300px] overflow-y-auto">
                        ${trader_logs.length > 0 ? trader_logs.slice(0, 5).map(l => `
                        <div class="p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-800 flex justify-between items-center">
                            <div>
                                <span class="font-bold text-gray-900 dark:text-white">${l.date}</span>
                                <span class="text-[10px] text-gray-400 block">Gross: ${formatKes(l.gross_sales)} • Restock: ${formatKes(l.restock_fund)}</span>
                            </div>
                            <div class="text-right">
                                <span class="font-black text-emerald-600 dark:text-emerald-400 block">${formatKes(l.net_profit)}</span>
                                <span class="text-[9px] text-gray-400">Pure Net</span>
                            </div>
                        </div>`).join('') : `
                        <p class="text-gray-400 italic">No closeouts logged yet. Submit your first daily closeout above!</p>`}
                    </div>
                </div>

            </div>
        </div>
    </main>

    <!-- Stall Settings Modal -->
    <div id="stall-settings-modal" class="hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div class="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
                <h3 class="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                    <span>⚙️ Soko &amp; Stall Settings</span>
                </h3>
                <button type="button" onclick="document.getElementById('stall-settings-modal').classList.add('hidden')" class="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form action="/trader/config" method="POST" class="space-y-3 text-xs">
                <div>
                    <label class="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Stall / Business Name</label>
                    <input type="text" name="stall_name" value="${trader_config.stall_name}" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white" required>
                </div>
                <div>
                    <label class="block text-gray-600 dark:text-gray-400 mb-1 font-bold">Market Location (e.g. Marikiti, Muthurwa, Kawangware)</label>
                    <input type="text" name="market_location" value="${trader_config.market_location}" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white" required>
                </div>
                <div>
                    <label class="block text-gray-600 dark:text-gray-400 mb-1 font-bold">🎯 Daily Net Profit Floor Target (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" name="daily_profit_target" value="${trader_config.daily_profit_target}" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl font-black text-emerald-600 dark:text-emerald-400 text-sm" required>
                </div>
                <div>
                    <label class="block text-gray-600 dark:text-gray-400 mb-1 font-bold">📦 Standard Daily Restock Capital (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" name="default_restock_kes" value="${trader_config.default_restock_kes}" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl font-black text-amber-600 dark:text-amber-400 text-sm" required>
                </div>
                <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 rounded-xl transition shadow-xs">
                    Save Soko Settings
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
                    <button type="submit" class="w-full p-3.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-left transition flex items-center justify-between group active:scale-98">
                        <div class="flex items-center space-x-3">
                            <span class="text-2xl p-2 bg-emerald-200 dark:bg-emerald-900 rounded-xl">🥬</span>
                            <div>
                                <span class="font-black text-sm text-emerald-950 dark:text-white block">Mama Mboga &amp; Micro-Shop (Active)</span>
                                <span class="text-emerald-700 dark:text-emerald-300">Marikiti Soko Restock, Kanjo Fees &amp; Daftari ya Mkopo</span>
                            </div>
                        </div>
                        <span class="text-emerald-700 dark:text-emerald-300 font-extrabold text-xs">✓ Active</span>
                    </button>
                </form>

                <!-- 3. Salaried Mode -->
                <form action="/profile/switch" method="POST">
                    <input type="hidden" name="profile_mode" value="SALARIED">
                    <button type="submit" class="w-full p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-gray-800/80 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 text-left transition flex items-center justify-between group active:scale-98">
                        <div class="flex items-center space-x-3">
                            <span class="text-2xl p-2 bg-indigo-100 dark:bg-indigo-950 rounded-xl">💼</span>
                            <div>
                                <span class="font-bold text-sm text-gray-900 dark:text-white block group-hover:text-indigo-600">Salaried &amp; Professional</span>
                                <span class="text-gray-500 dark:text-gray-400">Monthly Payday Waterfall &amp; Salary Runway Pacing</span>
                            </div>
                        </div>
                        <span class="text-indigo-600 font-extrabold text-xs">Switch →</span>
                    </button>
                </form>
            </div>
        </div>
    </div>

    <!-- Bottom Mobile Navigation Bar -->
    <nav class="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800/80 px-4 py-2 flex justify-around items-center sm:hidden shadow-lg safe-area-bottom">
        <a href="/" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 active:scale-90 transition-transform font-medium">
            <span class="text-xl">⚡</span>
            <span class="text-[10px] tracking-tight">Finance</span>
        </a>
        <a href="#closeout-card" class="flex flex-col items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold active:scale-90 transition-transform">
            <span class="text-xl">🧺</span>
            <span class="text-[10px] tracking-tight">Closeout</span>
        </a>
        <a href="#daftari-card" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-rose-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">📒</span>
            <span class="text-[10px] tracking-tight">Daftari</span>
        </a>
        <a href="/#waterfall-card" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-amber-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">👑</span>
            <span class="text-[10px] tracking-tight">Split</span>
        </a>
        <button type="button" onclick="openProfileModal()" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-purple-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">🔄</span>
            <span class="text-[10px] tracking-tight">Profile</span>
        </button>
    </nav>

    <script>
        var TARGET_FLOOR = ${targetFloor};

        function updateThemeIcon() {
            var isDark = document.documentElement.classList.contains('dark');
            document.querySelectorAll('.dark-mode-toggle-btn').forEach(function(btn) {
                btn.innerHTML = isDark ? '☀️' : '🌙';
                btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
            });
        }

        function toggleDarkMode() {
            var isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeIcon();
        }

        document.addEventListener('DOMContentLoaded', function() {
            updateThemeIcon();
        });

        function recalcTraderCloseoutPreview() {
            var gross = parseFloat(document.getElementById('trader_gross')?.value || 0) || 0;
            var restock = parseFloat(document.getElementById('trader_restock')?.value || 0) || 0;
            var kanjo = parseFloat(document.getElementById('trader_kanjo')?.value || 0) || 0;
            var porter = parseFloat(document.getElementById('trader_porter')?.value || 0) || 0;
            var pack = parseFloat(document.getElementById('trader_packaging')?.value || 0) || 0;
            var airtime = parseFloat(document.getElementById('trader_airtime')?.value || 0) || 0;

            var burn = restock + kanjo + porter + pack + airtime;
            var net = gross - burn;

            var netEl = document.getElementById('trader_preview_net');
            var burnEl = document.getElementById('trader_preview_burn');
            var badgeEl = document.getElementById('trader_status_badge');
            var overflowEl = document.getElementById('trader_preview_overflow');
            var splitBtn = document.getElementById('trader_split_btn');

            if (netEl) netEl.innerText = 'Ksh ' + net.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            if (burnEl) burnEl.innerText = 'Ksh ' + burn.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

            if (gross > 0) {
                if (net >= TARGET_FLOOR) {
                    var extra = net - TARGET_FLOOR;
                    if (badgeEl) {
                        badgeEl.className = 'px-2 py-0.5 bg-emerald-500 text-slate-950 rounded-full text-[10px] font-black';
                        badgeEl.innerText = '🟢 TARGET CLEARED!';
                    }
                    if (overflowEl) {
                        overflowEl.innerHTML = '🎉 Base Ksh ' + TARGET_FLOOR.toLocaleString() + ' target met! ' + (extra > 0 ? '<strong class=\"text-amber-300\">+Ksh ' + extra.toLocaleString() + ' Overflow sweeps to MMF/Chama!</strong>' : '');
                    }
                } else {
                    var deficit = TARGET_FLOOR - net;
                    if (badgeEl) {
                        badgeEl.className = 'px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-bold';
                        badgeEl.innerText = '🚨 SHORT BY KSH ' + deficit.toLocaleString();
                    }
                    if (overflowEl) {
                        overflowEl.innerText = '⚠️ Net profit is below your Ksh ' + TARGET_FLOOR.toLocaleString() + ' survival floor.';
                    }
                }
                if (splitBtn && net > 0) {
                    splitBtn.href = '/#waterfall-card?amt=' + net + '&target=' + TARGET_FLOOR;
                    splitBtn.innerHTML = '<span>👑 Split Ksh ' + Math.round(net).toLocaleString() + ' →</span>';
                }
            }
        }

        function calcMarginEstimator() {
            var buy = parseFloat(document.getElementById('margin_buy')?.value || 0) || 0;
            var sell = parseFloat(document.getElementById('margin_sell')?.value || 0) || 0;
            var profit = sell - buy;
            var marginPct = sell > 0 ? Math.round((profit / sell) * 100) : 0;

            var disp = document.getElementById('margin_profit_display');
            if (disp) {
                disp.innerText = 'Ksh ' + profit.toLocaleString(undefined, {minimumFractionDigits: 2}) + ' (' + marginPct + '%)';
                if (profit >= 0) {
                    disp.className = 'text-base font-black text-emerald-600 dark:text-emerald-400';
                } else {
                    disp.className = 'text-base font-black text-rose-600 dark:text-rose-400';
                }
            }
        }

        function openProfileModal() {
            document.getElementById('profile-switcher-modal')?.classList.remove('hidden');
        }

        function closeProfileModal() {
            document.getElementById('profile-switcher-modal')?.classList.add('hidden');
        }

        window.recalcTraderCloseoutPreview = recalcTraderCloseoutPreview;
        window.calcMarginEstimator = calcMarginEstimator;
        window.openProfileModal = openProfileModal;
        window.closeProfileModal = closeProfileModal;
        window.toggleDarkMode = toggleDarkMode;
    </script>
</body>
</html>`;
}

