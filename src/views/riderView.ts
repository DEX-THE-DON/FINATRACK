export function renderRiderDashboard(data: any): string {
  const {
    active_bike = null,
    bikes = [],
    rider_logs = [],
    time_intelligence = {},
    maintenance_schedules = [],
    compliance_deadlines = [],
    bike_financings = [],
    allocation_rules = [],
    accounts = [],
    toast = '',
    usd_to_kes = 129.0,
    today = new Date().toISOString().slice(0, 10),
  } = data;

  const ti = time_intelligence;

  return `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Finatrack - Rider Fleet & Time Yield Intelligence</title>
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#0f172a">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Finatrack">
    <link rel="apple-touch-icon" href="/static/icons/icon-192.png">
    <link rel="icon" type="image/svg+xml" href="/static/icons/icon.svg">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        primary: '#3B82F6',
                        dark: '#0F172A',
                    }
                }
            }
        }
    </script>
    <script>
        const USD_TO_KES = ${usd_to_kes};
        let deferredPrompt = null;

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            showInstallUi();
        });

        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            hideInstallUi();
        });

        function isRunningStandalone() {
            return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        }

        function showInstallUi() {
            if (isRunningStandalone()) return;
            document.querySelectorAll('.pwa-install-trigger').forEach(el => el.classList.remove('hidden'));
        }

        function hideInstallUi() {
            document.querySelectorAll('.pwa-install-trigger').forEach(el => el.classList.add('hidden'));
            const banner = document.getElementById('pwa-bottom-banner');
            if (banner) banner.classList.add('hidden');
        }

        function triggerAppInstall() {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        hideInstallUi();
                    }
                    deferredPrompt = null;
                });
            } else {
                const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
                if (isIos) {
                    const modal = document.getElementById('ios-install-modal');
                    if (modal) modal.classList.remove('hidden');
                } else {
                    alert('To install Finatrack:\\n1. Tap your browser menu (⋮ or ⋯)\\n2. Select "Install app" or "Add to Home screen"');
                }
            }
        }

        function getCurrency() {
            return localStorage.getItem('finatrack_currency') || 'Ksh';
        }

        function setCurrency(curr) {
            localStorage.setItem('finatrack_currency', curr);
            document.cookie = "finatrack_currency=" + curr + ";path=/;max-age=31536000";
            applyConversion();
        }

        function applyConversion() {
            const curr = getCurrency();
            const selectEl = document.getElementById('currency-selector');
            if (selectEl) selectEl.value = curr;

            document.querySelectorAll('.convertible-amount').forEach(el => {
                const usdValue = parseFloat(el.getAttribute('data-usd')) || 0;
                if (curr === 'Ksh') {
                    el.innerText = 'Ksh ' + (usdValue * USD_TO_KES).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                } else {
                    el.innerText = '$' + usdValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                }
            });

            document.querySelectorAll('.curr-symbol-label').forEach(el => {
                el.innerText = curr === 'Ksh' ? 'Ksh' : '$';
            });
        }

        function setShiftPreset(start, end) {
            const sInput = document.getElementById('input_start_time');
            const eInput = document.getElementById('input_end_time');
            if (sInput) sInput.value = start;
            if (eInput) eInput.value = end;
            calcDuration();
        }

        function calcDuration() {
            const s = document.getElementById('input_start_time')?.value;
            const e = document.getElementById('input_end_time')?.value;
            if (!s || !e) return;
            const sM = parseInt(s.split(':')[0]) * 60 + parseInt(s.split(':')[1]);
            const eM = parseInt(e.split(':')[0]) * 60 + parseInt(e.split(':')[1]);
            let diff = eM - sM;
            if (diff <= 0) diff += 24 * 60;
            const hrs = (diff / 60).toFixed(1);
            const badge = document.getElementById('shift-duration-badge');
            if (badge) badge.innerText = '⏱️ ' + hrs + ' hrs';
            const hInput = document.getElementById('input_shift_hours');
            if (hInput) hInput.value = hrs;
        }

        function showTimeTab(tabId, btn) {
            document.querySelectorAll('.time-tab-content').forEach(el => el.classList.add('hidden'));
            const target = document.getElementById('time-tab-' + tabId);
            if (target) target.classList.remove('hidden');

            document.querySelectorAll('.time-tab-btn').forEach(b => {
                b.classList.remove('bg-blue-600', 'text-white', 'dark:bg-blue-600');
                b.classList.add('bg-white', 'dark:bg-gray-800', 'text-gray-700', 'dark:text-gray-300');
            });
            if (btn) {
                btn.classList.remove('bg-white', 'dark:bg-gray-800', 'text-gray-700', 'dark:text-gray-300');
                btn.classList.add('bg-blue-600', 'text-white');
            }
        }

        function toggleDarkMode() {
            document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        }

        document.addEventListener('DOMContentLoaded', () => {
            if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            }
            applyConversion();
            calcDuration();
            if (!isRunningStandalone()) {
                showInstallUi();
            }
        });
    </script>
</head>
<body class="bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 min-h-screen antialiased flex flex-col justify-between font-sans">

    ${toast ? `
    <div id="toast-banner" class="bg-blue-600 text-white px-4 py-2.5 text-center text-sm font-semibold shadow-md flex items-center justify-center gap-2">
        <span>✅ ${toast}</span>
        <button onclick="document.getElementById('toast-banner').remove()" class="ml-4 text-blue-200 hover:text-white">✕</button>
    </div>` : ''}

    <header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30 shadow-xs">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
            <div class="flex items-center space-x-3">
                <span class="text-2xl">🛵</span>
                <div>
                    <h1 class="font-extrabold text-lg text-gray-900 dark:text-white tracking-tight leading-none">Rider Fleet Tracker</h1>
                    <span class="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Shift & Time Intelligence</span>
                </div>
            </div>
            
            <div class="flex items-center space-x-2 sm:space-x-3">
                <button onclick="triggerAppInstall()" class="pwa-install-trigger px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center space-x-1.5 hidden">
                    <span>📲</span>
                    <span class="hidden sm:inline">Install App</span>
                    <span class="sm:hidden">Install</span>
                </button>

                <a href="/" class="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs">
                    <span>⚡ <span class="hidden md:inline">Finance Freedom Hub</span></span>
                </a>

                <select id="currency-selector" onchange="setCurrency(this.value)" class="text-xs bg-gray-100 dark:bg-gray-800 border-0 rounded-lg px-2.5 py-1.5 font-bold text-gray-700 dark:text-gray-200 cursor-pointer">
                    <option value="Ksh">KSH</option>
                    <option value="USD">USD</option>
                </select>

                <button onclick="toggleDarkMode()" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                    🌙
                </button>
            </div>
        </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 w-full">
        
        <!-- ⏰ Shift & Time Intelligence KPI Banner -->
        <div class="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-lg border border-blue-800/40 space-y-4">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-blue-800/60 pb-3">
                <div>
                    <h2 class="text-xl font-black flex items-center gap-2">
                        <span>⏰ Shift & Time Working Intelligence</span>
                        <span class="text-xs bg-blue-500/30 text-blue-200 border border-blue-400/40 px-2.5 py-0.5 rounded-full font-bold">Weekly & Monthly Analytics</span>
                    </h2>
                    <p class="text-xs text-blue-200 mt-0.5">Analyze which shift hours, days of the week, and peak windows generate your highest hourly rates.</p>
                </div>
                <div class="flex items-center space-x-2">
                    <a href="/rider/export/csv" class="px-3 py-1.5 bg-blue-800/70 hover:bg-blue-700 border border-blue-600 rounded-xl text-xs font-bold transition flex items-center space-x-1">
                        <span>📥 Export Shift CSV</span>
                    </a>
                </div>
            </div>

            <!-- KPI Cards Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="p-4 bg-slate-950/70 border border-blue-900/60 rounded-2xl">
                    <p class="text-[10px] text-blue-300 font-bold uppercase tracking-wider">⚡ Gross Hourly Rate</p>
                    <p class="text-2xl font-black text-emerald-400 mt-1"><span class="curr-symbol-label">Ksh</span> ${ti.overall_avg_gross_hourly || '0.00'} <span class="text-xs font-normal text-gray-400">/ hr</span></p>
                    <p class="text-[10px] text-gray-400 mt-0.5">Overall gross yield per active hour</p>
                </div>

                <div class="p-4 bg-slate-950/70 border border-blue-900/60 rounded-2xl">
                    <p class="text-[10px] text-blue-300 font-bold uppercase tracking-wider">💵 Net Hourly Take-Home</p>
                    <p class="text-2xl font-black text-cyan-400 mt-1"><span class="curr-symbol-label">Ksh</span> ${ti.overall_avg_net_hourly || '0.00'} <span class="text-xs font-normal text-gray-400">/ hr</span></p>
                    <p class="text-[10px] text-gray-400 mt-0.5">After fuel, lunch & maintenance</p>
                </div>

                <div class="p-4 bg-slate-950/70 border border-blue-900/60 rounded-2xl">
                    <p class="text-[10px] text-blue-300 font-bold uppercase tracking-wider">🏆 Best Day of Week</p>
                    <p class="text-lg font-black text-amber-300 mt-1 truncate">${ti.best_day || 'Friday'}</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">Highest earning day per shift</p>
                </div>

                <div class="p-4 bg-slate-950/70 border border-blue-900/60 rounded-2xl">
                    <p class="text-[10px] text-blue-300 font-bold uppercase tracking-wider">🔥 Peak Shift Window</p>
                    <p class="text-base font-black text-indigo-300 mt-1 truncate">${ti.best_time_window || 'Midday (11am – 10pm)'}</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">Most profitable working time</p>
                </div>
            </div>

            <!-- Tab Buttons -->
            <div class="flex flex-wrap gap-2 pt-2 border-t border-blue-800/40 text-xs font-bold">
                <button type="button" onclick="showTimeTab('windows', this)" class="time-tab-btn px-3 py-1.5 rounded-xl bg-blue-600 text-white transition shadow-sm">🕒 Peak Windows</button>
                <button type="button" onclick="showTimeTab('days', this)" class="time-tab-btn px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition shadow-sm">📅 Best Days of Week</button>
                <button type="button" onclick="showTimeTab('weekly', this)" class="time-tab-btn px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition shadow-sm">🗓️ Weekly Breakdown</button>
                <button type="button" onclick="showTimeTab('monthly', this)" class="time-tab-btn px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition shadow-sm">📈 Monthly Trends</button>
            </div>

            <!-- Windows Tab Content -->
            <div id="time-tab-windows" class="time-tab-content grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                ${(ti.time_window_analysis || []).map((w: any) => `
                <div class="p-3.5 bg-slate-950/80 border border-blue-900/50 rounded-2xl space-y-1.5">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-bold text-blue-200">${w.window_label}</span>
                        <span class="text-[10px] px-1.5 py-0.5 bg-blue-900/60 rounded text-blue-300 font-semibold">${w.share_pct}% share</span>
                    </div>
                    <p class="text-lg font-black text-emerald-400"><span class="curr-symbol-label">Ksh</span> ${w.gross_hourly} <span class="text-xs font-normal text-gray-400">/ hr</span></p>
                    <p class="text-[11px] text-gray-400">Net: <strong class="text-cyan-300">Ksh ${w.net_hourly}/hr</strong> • ${w.shifts_count} shifts</p>
                </div>`).join('')}
            </div>

            <!-- Days Tab Content -->
            <div id="time-tab-days" class="time-tab-content hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                ${(ti.day_analysis || []).map((d: any) => `
                <div class="p-3.5 bg-slate-950/80 border border-blue-900/50 rounded-2xl space-y-1.5">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-bold text-blue-200">${d.day_name}</span>
                        ${d.is_best ? `<span class="text-[10px] px-2 py-0.5 bg-amber-500/40 text-amber-200 border border-amber-400/40 rounded-full font-bold">🏆 Top Day</span>` : ''}
                    </div>
                    <p class="text-base font-black text-emerald-400"><span class="curr-symbol-label">Ksh</span> ${d.avg_earned_display} <span class="text-xs font-normal text-gray-400">/ shift</span></p>
                    <p class="text-[11px] text-gray-400">Top Window: <strong class="text-indigo-300">${d.top_window}</strong></p>
                </div>`).join('')}
            </div>

            <!-- Weekly Tab Content -->
            <div id="time-tab-weekly" class="time-tab-content hidden space-y-2 pt-2">
                ${(ti.weekly_breakdown || []).map((wk: any) => `
                <div class="p-3 bg-slate-950/80 border border-blue-900/50 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                    <div>
                        <span class="font-bold text-blue-200">${wk.week_label}</span>
                        <span class="text-gray-400 ml-2">(${wk.shifts_count} shifts • ${wk.total_hours} hrs worked)</span>
                    </div>
                    <div class="flex items-center space-x-4">
                        <span>Gross: <strong class="text-emerald-400">Ksh ${wk.gross_display}</strong></span>
                        <span>Net: <strong class="text-cyan-400">Ksh ${wk.net_display}</strong></span>
                        <span class="text-amber-300">Top: <strong>${wk.top_day}</strong></span>
                    </div>
                </div>`).join('')}
            </div>

            <!-- Monthly Tab Content -->
            <div id="time-tab-monthly" class="time-tab-content hidden space-y-2 pt-2">
                ${(ti.monthly_breakdown || []).map((m: any) => `
                <div class="p-3 bg-slate-950/80 border border-blue-900/50 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                    <div>
                        <span class="font-bold text-blue-200">${m.month_label}</span>
                        <span class="text-gray-400 ml-2">(${m.shifts_count} shifts • ${m.total_hours} hrs)</span>
                    </div>
                    <div class="flex items-center space-x-4">
                        <span>Net Remittance: <strong class="text-emerald-400">Ksh ${m.net_display}</strong></span>
                        <span>Efficiency: <strong class="text-indigo-300">Ksh ${m.avg_hourly_display}/hr</strong></span>
                    </div>
                </div>`).join('')}
            </div>
        </div>

        <!-- Log Daily Shift Card -->
        <div class="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
            <div class="flex justify-between items-center border-b dark:border-gray-800 pb-3">
                <div>
                    <h2 class="text-lg font-bold text-gray-900 dark:text-white">Log Rider Shift with Exact Working Times</h2>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Specify your shift window (e.g. 11am to 10pm) or pick a 1-tap quick preset.</p>
                </div>
            </div>

            <form action="/rider/logs" method="POST" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Shift Date</label>
                    <input type="date" name="date" value="${today}" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm font-semibold" required>
                </div>

                <!-- Shift Start & End Times -->
                <div class="sm:col-span-2 space-y-1.5">
                    <div class="flex justify-between items-center">
                        <label class="block text-xs font-bold text-blue-600 dark:text-blue-400">⏰ Working Shift Hours</label>
                        <span id="shift-duration-badge" class="text-[11px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-md">⏱️ 11.0 hrs</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <input type="time" name="start_time" id="input_start_time" value="11:00" onchange="calcDuration()" class="p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm font-bold" required>
                        <input type="time" name="end_time" id="input_end_time" value="22:00" onchange="calcDuration()" class="p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm font-bold" required>
                    </div>
                    <input type="hidden" name="shift_hours" id="input_shift_hours" value="11.0">
                    <div class="flex flex-wrap gap-1.5 pt-1">
                        <button type="button" onclick="setShiftPreset('11:00', '22:00')" class="text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-lg font-semibold transition">☀️ 11am – 10pm (11h)</button>
                        <button type="button" onclick="setShiftPreset('06:00', '14:00')" class="text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-lg font-semibold transition">🌅 6am – 2pm (8h)</button>
                        <button type="button" onclick="setShiftPreset('14:00', '23:00')" class="text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-lg font-semibold transition">🌆 2pm – 11pm (9h)</button>
                        <button type="button" onclick="setShiftPreset('20:00', '04:00')" class="text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-lg font-semibold transition">🌙 8pm – 4am (8h)</button>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Total Earned (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" name="total_earned" placeholder="e.g. 3500.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm font-bold text-emerald-600 dark:text-emerald-400" required>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">Petrol Station</label>
                    <select name="fuel_station" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm font-medium">
                        <option value="RUBIS">Rubis Energy</option>
                        <option value="TOTAL">TotalEnergies</option>
                        <option value="SHELL">Shell / Vivo</option>
                        <option value="OLA">Ola Energy</option>
                        <option value="HASS">Hass Petroleum</option>
                        <option value="OTHER">Other Station</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Fuel Cost (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" name="fuel_cost" placeholder="0.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Food / Lunch (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" name="food_spent" placeholder="0.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Deposit Net Into Account</label>
                    <select name="earnings_account_id" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-sm font-medium text-emerald-600">
                        <option value="">-- Don't Deposit --</option>
                        ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                    </select>
                </div>

                <div class="sm:col-span-2 lg:col-span-4">
                    <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition shadow-md">
                        Save Shift Record & Sync With Finance Ledger
                    </button>
                </div>
            </form>
        </div>

        <!-- Shift History Log Table -->
        <div class="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div class="p-6 border-b dark:border-gray-800 flex justify-between items-center">
                <h3 class="font-bold text-gray-900 dark:text-white text-base">Shift History & Working Hour Yields</h3>
                <span class="text-xs text-gray-500">${rider_logs.length} Shifts Recorded</span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead class="bg-gray-50 dark:bg-gray-800/60 uppercase text-gray-400 text-[10px]">
                        <tr>
                            <th class="p-4">Date</th>
                            <th class="p-4">Shift Hours</th>
                            <th class="p-4">Hourly Yield</th>
                            <th class="p-4">Gross Earned</th>
                            <th class="p-4">Fuel & Upkeep</th>
                            <th class="p-4">Net Remittance</th>
                            <th class="p-4 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y dark:divide-gray-800">
                        ${rider_logs.length > 0 ? rider_logs.map((l: any) => `
                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                            <td class="p-4 font-medium">${l.date}</td>
                            <td class="p-4">
                                <span class="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                                    ⏰ ${l.start_time || '11:00'} – ${l.end_time || '22:00'} (${l.shift_hours}h)
                                </span>
                            </td>
                            <td class="p-4 font-bold text-amber-600 dark:text-amber-400">
                                ⚡ Ksh ${Math.round((Number(l.total_earned) * usd_to_kes) / (Number(l.shift_hours) || 1))}/hr
                            </td>
                            <td class="p-4 font-bold text-emerald-600 dark:text-emerald-400 convertible-amount" data-usd="${l.total_earned}">${l.total_earned}</td>
                            <td class="p-4 text-rose-500 font-medium convertible-amount" data-usd="${Number(l.fuel_cost || 0) + Number(l.food_spent || 0) + Number(l.maintenance_cost || 0)}"></td>
                            <td class="p-4 font-extrabold text-blue-600 dark:text-blue-400 convertible-amount" data-usd="${Number(l.total_earned || 0) - (Number(l.fuel_cost || 0) + Number(l.food_spent || 0) + Number(l.maintenance_cost || 0))}"></td>
                            <td class="p-4 text-center">
                                <form action="/rider/logs/delete/${l.id}" method="POST" onsubmit="return confirm('Delete shift log?');">
                                    <button type="submit" class="text-rose-500 hover:text-rose-700 font-bold">Delete</button>
                                </form>
                            </td>
                        </tr>`).join('') : `
                        <tr>
                            <td colspan="7" class="p-6 text-center text-gray-400">No shift records logged yet.</td>
                        </tr>`}
                    </tbody>
                </table>
            </div>
        </div>

    </main>

    <!-- Mobile PWA Install Floating Banner -->
    <div id="pwa-bottom-banner" class="pwa-install-trigger hidden fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-gray-700/60 flex items-center justify-between gap-3 transition-all duration-300">
        <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xl shadow-inner">
                🛵
            </div>
            <div>
                <p class="text-xs font-bold text-white">Install Finatrack App</p>
                <p class="text-[11px] text-gray-300">Fast 1-tap shift logging & offline</p>
            </div>
        </div>
        <div class="flex items-center space-x-2">
            <button onclick="triggerAppInstall()" class="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 text-white font-black text-xs rounded-xl shadow-xs transition">
                Install
            </button>
            <button onclick="document.getElementById('pwa-bottom-banner').remove()" class="p-1 text-gray-400 hover:text-gray-200 text-sm">
                ✕
            </button>
        </div>
    </div>

    <!-- iOS Add to Home Screen Instructions Modal -->
    <div id="ios-install-modal" class="hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4">
        <div class="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800 space-y-4">
            <div class="flex justify-between items-center">
                <div class="flex items-center space-x-2">
                    <span class="text-2xl">📱</span>
                    <h3 class="font-bold text-gray-900 dark:text-white">Install on iPhone / iPad</h3>
                </div>
                <button onclick="document.getElementById('ios-install-modal').classList.add('hidden')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
            </div>
            <div class="space-y-3 text-xs text-gray-600 dark:text-gray-300">
                <div class="flex items-start space-x-3 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl">
                    <span class="text-base font-bold text-blue-600">1</span>
                    <p>Tap the <strong>Share</strong> button <span class="text-base">⎋</span> at the bottom of Safari.</p>
                </div>
                <div class="flex items-start space-x-3 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl">
                    <span class="text-base font-bold text-blue-600">2</span>
                    <p>Scroll down and tap <strong>"Add to Home Screen" ➕</strong>.</p>
                </div>
                <div class="flex items-start space-x-3 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl">
                    <span class="text-base font-bold text-blue-600">3</span>
                    <p>Tap <strong>"Add"</strong> in the top-right corner to finish installing!</p>
                </div>
            </div>
            <button onclick="document.getElementById('ios-install-modal').classList.add('hidden')" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition">
                Got It
            </button>
        </div>
    </div>
</body>
</html>`;
}
