export function renderFinanceDashboard(data: any): string {
  const {
    accounts = [],
    transactions = [],
    goals = [],
    budgets = [],
    debts = [],
    bills = [],
    mmf_accounts = [],
    allocation_rules = [],
    total_balance = 0.0,
    monthly_income = 0.0,
    monthly_expenses = 0.0,
    net_savings = 0.0,
    total_monthly_passive_income = 0.0,
    usd_to_kes = 129.0,
    toast = '',
    today = new Date().toISOString().slice(0, 10),
    now_iso = new Date().toISOString().slice(0, 16),
    unique_categories = []
  } = data;

  return `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Finatrack - Financial Freedom Hub</title>
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
                        primary: '#10B981',
                        dark: '#0F172A',
                    }
                }
            }
        }
    </script>
    <style>
        .convertible-amount { transition: all 0.2s ease-in-out; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
        .dark ::-webkit-scrollbar-thumb { background: #334155; }
    </style>
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
            document.cookie = "finatrack_currency=" + curr + ";path=/;max-age=31536000";
            
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

            document.querySelectorAll('.convertible-placeholder').forEach(el => {
                const baseKes = parseFloat(el.getAttribute('data-placeholder-base')) || 0;
                el.placeholder = curr === 'Ksh' ? baseKes.toString() : (baseKes / USD_TO_KES).toFixed(2);
            });
        }

        function toggleEdit(id) {
            const displayDiv = document.getElementById('acc-display-' + id);
            const editDiv = document.getElementById('acc-edit-' + id);
            if (editDiv.classList.contains('hidden')) {
                const curr = getCurrency();
                const balInput = editDiv.querySelector('input[name="balance"]');
                if (balInput && balInput.hasAttribute('data-usd')) {
                    const usd = parseFloat(balInput.getAttribute('data-usd')) || 0;
                    balInput.value = curr === 'Ksh' ? (usd * USD_TO_KES).toFixed(2) : usd.toFixed(2);
                }
                editDiv.classList.remove('hidden');
                displayDiv.classList.add('hidden');
            } else {
                editDiv.classList.add('hidden');
                displayDiv.classList.remove('hidden');
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
            updateSplitBreakdown();
            if (!isRunningStandalone()) {
                showInstallUi();
            }
        });

        function updateSplitBreakdown() {
            const inputEl = document.getElementById('split-amount-input');
            const total = parseFloat(inputEl ? inputEl.value : 0) || 0;
            const rules = ${JSON.stringify(allocation_rules)};
            
            rules.forEach(r => {
                const pct = parseFloat(r.percentage) || 0;
                const amt = (total * (pct / 100)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                const spanEl = document.getElementById('rule-calc-' + r.id);
                if (spanEl) spanEl.innerText = 'Ksh ' + amt;
            });
        }

        function parseMpesaClient() {
            const input = document.getElementById('mpesa-batch-input');
            const raw = input ? input.value : '';
            if (!raw.trim()) {
                alert('Please paste at least one M-Pesa SMS message.');
                return;
            }

            const chunks = raw.trim().split(/(?=[A-Z0-9]{8,12}\s+Confirmed)/i);
            const results = [];

            const receivedRegex = /([A-Z0-9]{8,12})\s+(?:Confirmed\.\s+)?(?:You have received\s+)?(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)\s+received from\s+([^.]+?)(?:\s+on|\s+at|\s+New M-PESA balance|\.)/i;
            const sentRegex = /([A-Z0-9]{8,12})\s+(?:Confirmed\.\s+)?(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)\s+sent to\s+([^.]+?)(?:\s+on|\s+at|\s+New M-PESA balance|\.)/i;
            const paidRegex = /([A-Z0-9]{8,12})\s+(?:Confirmed\.\s+)?(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)\s+paid to\s+([^.]+?)(?:\s+on|\s+at|\s+New M-PESA balance|\.)/i;
            const withdrawRegex = /([A-Z0-9]{8,12})\s+(?:Confirmed\.\s+)?(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)\s+withdrawn from\s+([^.]+?)(?:\s+on|\s+at|\s+New M-PESA balance|\.)/i;
            const dtRegex = /on\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})(?:\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?))?/i;

            chunks.forEach(c => {
                const text = c.trim();
                if (text.length < 15) return;
                let code = '', amt = 0, party = '', type = 'EXPENSE', cat = 'Living Expenses';
                let match = text.match(receivedRegex);
                if (match) {
                    code = match[1].toUpperCase();
                    amt = parseFloat(match[2].replace(/,/g, ''));
                    party = match[3].trim();
                    type = 'INCOME';
                    cat = (party.toUpperCase().includes('BOLT') || party.toUpperCase().includes('UBER')) ? 'Rider & Boda Deliveries' : 'M-Pesa Income';
                } else if ((match = text.match(sentRegex))) {
                    code = match[1].toUpperCase();
                    amt = parseFloat(match[2].replace(/,/g, ''));
                    party = match[3].trim();
                    type = 'EXPENSE';
                    cat = 'Living Expenses';
                } else if ((match = text.match(paidRegex))) {
                    code = match[1].toUpperCase();
                    amt = parseFloat(match[2].replace(/,/g, ''));
                    party = match[3].trim();
                    type = 'EXPENSE';
                    const p = party.toUpperCase();
                    if (p.includes('TOTAL') || p.includes('SHELL') || p.includes('RUBIS') || p.includes('PETROL')) cat = 'Fuel & Petrol';
                    else if (p.includes('KPLC') || p.includes('WATER') || p.includes('SAFARICOM')) cat = 'Utilities & Bills';
                    else if (p.includes('NAIVAS') || p.includes('QUICKMART') || p.includes('HOTEL') || p.includes('FOOD')) cat = 'Food & Groceries';
                    else cat = 'Living Expenses';
                } else if ((match = text.match(withdrawRegex))) {
                    code = match[1].toUpperCase();
                    amt = parseFloat(match[2].replace(/,/g, ''));
                    party = match[3].trim();
                    type = 'EXPENSE';
                    cat = 'Cash Withdrawal';
                }

                if (code && amt > 0) {
                    const dtM = text.match(dtRegex);
                    const rawDt = dtM ? dtM[1] : 'Today';
                    const rawTm = dtM && dtM[2] ? dtM[2] : '';
                    results.push({ code, type, amt, party, rawDt, rawTm, cat });
                }
            });

            const previewDiv = document.getElementById('mpesa-preview-area');
            const tableBody = document.getElementById('mpesa-preview-tbody');
            const countBadge = document.getElementById('mpesa-parsed-count');
            const importBtn = document.getElementById('mpesa-import-submit-btn');

            if (results.length > 0) {
                if (countBadge) countBadge.innerText = results.length + ' SMS Extracted';
                if (tableBody) {
                    tableBody.innerHTML = results.map(function(r) {
                        const typeClass = r.type === 'INCOME' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300';
                        return '<tr class="border-b border-gray-100 dark:border-gray-800 text-xs">' +
                            '<td class="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">#' + r.code + '</td>' +
                            '<td class="py-2.5 px-3">' + r.rawDt + ' ' + r.rawTm + '</td>' +
                            '<td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded-full font-bold ' + typeClass + '">' + r.type + '</span></td>' +
                            '<td class="py-2.5 px-3 font-medium">' + r.party + '</td>' +
                            '<td class="py-2.5 px-3 font-bold text-gray-900 dark:text-white">Ksh ' + r.amt.toLocaleString(undefined, {minimumFractionDigits: 2}) + '</td>' +
                            '<td class="py-2.5 px-3"><span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-md font-semibold">' + r.cat + '</span></td>' +
                        '</tr>';
                    }).join('');
                }
                if (previewDiv) previewDiv.classList.remove('hidden');
                if (importBtn) importBtn.removeAttribute('disabled');
            } else {
                alert('Could not detect standard M-Pesa receipt formats. Please ensure message starts with code (e.g. QA12345678 Confirmed...)');
            }
        }

        function pasteSampleMpesa(type) {
            const input = document.getElementById('mpesa-batch-input');
            if (!input) return;
            if (type === 'single') {
                input.value = 'QA12345678 Confirmed. Ksh1,500.00 received from JOHN DOE 0712345678 on 12/9/26 at 11:30 AM. New M-PESA balance is Ksh5,400.00. Transaction cost, Ksh0.00.';
            } else {
                input.value = 'QA11111111 Confirmed. Ksh2,400.00 received from BOLT DELIVERIES on 12/9/26 at 6:00 PM. New M-PESA balance is Ksh7,170.00.\\n' +
                              'QB22222222 Confirmed. Ksh630.00 paid to TOTAL ENERGIES. on 12/9/26 at 7:30 PM. New M-PESA balance is Ksh6,540.00.\\n' +
                              'QC33333333 Confirmed. Ksh450.00 paid to KPLC PREPAID on 12/9/26 at 8:15 PM. New M-PESA balance is Ksh6,090.00.';
            }
            parseMpesaClient();
        }
    </script>
</head>
<body class="bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100 min-h-screen antialiased flex flex-col justify-between font-sans">
    
    <!-- Top Banner Toast -->
    ${toast ? `
    <div id="toast-banner" class="bg-emerald-600 text-white px-4 py-2.5 text-center text-sm font-semibold shadow-md flex items-center justify-center gap-2">
        <span>✅ ${toast}</span>
        <button onclick="document.getElementById('toast-banner').remove()" class="ml-4 text-emerald-200 hover:text-white">✕</button>
    </div>` : ''}

    <!-- Main Navigation Header -->
    <header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30 shadow-xs">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
            <div class="flex items-center space-x-3">
                <span class="text-2xl">⚡</span>
                <div>
                    <h1 class="font-extrabold text-lg text-gray-900 dark:text-white tracking-tight leading-none">Finatrack</h1>
                    <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">TypeScript + Edge</span>
                </div>
            </div>
            
            <div class="flex items-center space-x-2 sm:space-x-3">
                <button onclick="triggerAppInstall()" class="pwa-install-trigger px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center space-x-1.5 hidden">
                    <span>📲</span>
                    <span class="hidden sm:inline">Install App</span>
                    <span class="sm:hidden">Install</span>
                </button>

                <a href="/rider" class="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs">
                    <span>🛵 <span class="hidden md:inline">Rider Fleet</span></span>
                </a>

                <select id="currency-selector" onchange="setCurrency(this.value)" class="text-xs bg-gray-100 dark:bg-gray-800 border-0 rounded-lg px-2.5 py-1.5 font-bold text-gray-700 dark:text-gray-200 cursor-pointer">
                    <option value="Ksh">KSH</option>
                    <option value="USD">USD</option>
                </select>

                <a href="/login" class="px-3 py-1.5 bg-gradient-to-r from-pink-500/10 to-purple-500/10 hover:from-pink-500/20 hover:to-purple-500/20 text-pink-600 dark:text-pink-400 border border-pink-500/30 rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs">
                    <span>🔑 <span class="hidden sm:inline">Sign In</span></span>
                </a>

                <button onclick="toggleDarkMode()" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                    🌙
                </button>
            </div>
        </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1 w-full">
        
        <!-- Net Worth & Overview Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-gradient-to-br from-emerald-600 to-teal-700 p-5 rounded-2xl text-white shadow-sm space-y-1">
                <p class="text-xs font-semibold text-emerald-100 uppercase tracking-wider">Total Net Balance</p>
                <p class="text-2xl sm:text-3xl font-black convertible-amount" data-usd="${total_balance}">${total_balance}</p>
                <p class="text-[11px] text-emerald-200">${accounts.length} Active Accounts Connected</p>
            </div>

            <div class="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs space-y-1">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">This Month's Income</p>
                <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 convertible-amount" data-usd="${monthly_income}">${monthly_income}</p>
                <p class="text-[11px] text-gray-500">From shifts, interest & transfers</p>
            </div>

            <div class="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs space-y-1">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">This Month's Expenses</p>
                <p class="text-2xl font-bold text-rose-600 dark:text-rose-400 convertible-amount" data-usd="${monthly_expenses}">${monthly_expenses}</p>
                <p class="text-[11px] text-gray-500">Fuel, food, utilities & bills</p>
            </div>

            <div class="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs space-y-1">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Monthly Passive Yield</p>
                <p class="text-2xl font-bold text-amber-600 dark:text-amber-400 convertible-amount" data-usd="${total_monthly_passive_income}">${total_monthly_passive_income}</p>
                <p class="text-[11px] text-amber-700 dark:text-amber-300">From MMF & Sacco high yields</p>
            </div>
        </div>

        <!-- 🌊 Dynamic Waterfall Auto-Split Card -->
        <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-md border border-indigo-800/40 space-y-4">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-indigo-800/60 pb-3">
                <div>
                    <div class="flex items-center space-x-2">
                        <span class="text-2xl">🌊</span>
                        <h2 class="text-lg font-bold">Dynamic Waterfall Income Auto-Split (Zero Cent Leakage)</h2>
                    </div>
                    <p class="text-xs text-indigo-200">Automatically calculate and distribute daily earnings across Ziidi MMF (10% auto-save), Lock Savings, Goals, and Living expenses.</p>
                </div>
                <button onclick="document.getElementById('rules-modal').classList.toggle('hidden')" class="text-xs bg-indigo-800/60 hover:bg-indigo-700 border border-indigo-600 px-3 py-1.5 rounded-lg font-semibold transition">
                    ⚙️ Edit Split Rules
                </button>
            </div>

            <form action="/split/distribute" method="POST" class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div>
                    <label class="block text-xs text-indigo-300 mb-1">Enter Today's Income (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" name="amount" id="split-amount-input" value="500" oninput="updateSplitBreakdown()" class="w-full px-3 py-2 bg-slate-950 border border-indigo-700 rounded-xl text-lg font-bold text-white focus:ring-2 focus:ring-emerald-400" required>
                </div>
                <div>
                    <label class="block text-xs text-indigo-300 mb-1">Source / Wallet Account</label>
                    <select name="source_account_id" class="w-full px-3 py-2.5 bg-slate-950 border border-indigo-700 rounded-xl text-sm font-medium text-white">
                        <option value="">-- Direct External Income --</option>
                        ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                    </select>
                </div>
                <div class="flex items-end">
                    <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition shadow-md">
                        🚀 Distribute Funds Now
                    </button>
                </div>
            </form>

            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
                ${allocation_rules.map((r: any) => `
                <div class="p-3 bg-slate-950/70 border border-indigo-900/60 rounded-xl">
                    <div class="flex items-center space-x-1.5 text-xs text-indigo-300 font-bold">
                        <span>${r.icon || '💰'}</span>
                        <span class="truncate">${r.bucket_name}</span>
                    </div>
                    <p class="text-sm font-black text-emerald-400 mt-1" id="rule-calc-${r.id}">Ksh 0.00</p>
                    <p class="text-[10px] text-gray-400 font-medium">${r.percentage}% Allocation</p>
                </div>`).join('')}
            </div>
        </div>

        <!-- 📲 Smart M-Pesa Batch SMS Auto-Parser Card -->
        <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-emerald-500/30 p-6 space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-xl">
                        📲
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>Smart M-Pesa Batch SMS Auto-Parser</span>
                            <span class="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Multi-SMS Regex</span>
                        </h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Paste single or multiple M-Pesa messages directly from your clipboard to extract transactions instantly!</p>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <button type="button" onclick="pasteSampleMpesa('single')" class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg transition">
                        📋 Sample Received
                    </button>
                    <button type="button" onclick="pasteSampleMpesa('batch')" class="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-lg transition">
                        📋 Sample Batch (3 SMS)
                    </button>
                </div>
            </div>

            <form action="/finance/mpesa/import" method="POST" class="space-y-4">
                <div class="space-y-1.5">
                    <label class="block text-xs font-bold text-gray-700 dark:text-gray-300">
                        Paste M-Pesa SMS text (Single or Multiple messages):
                    </label>
                    <textarea id="mpesa-batch-input" name="raw_sms" rows="3" placeholder="QA12345678 Confirmed. Ksh1,500.00 received from JOHN DOE...&#10;QB87654321 Confirmed. Ksh630.00 paid to TOTAL ENERGIES..." class="w-full p-3 font-mono text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500" required></textarea>
                </div>

                <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button type="button" onclick="parseMpesaClient()" class="w-full sm:w-auto px-4 py-2 bg-gray-900 dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs">
                        <span>🔍 Extract & Preview Transactions</span>
                    </button>

                    <div class="flex items-center gap-2 w-full sm:w-auto">
                        <select name="account_id" class="p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-xs font-semibold" required>
                            <option value="">-- Select Target Account --</option>
                            ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                        </select>
                        <button type="submit" id="mpesa-import-submit-btn" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap">
                            <span>📥 1-Tap Import to Ledger</span>
                        </button>
                    </div>
                </div>

                <!-- Preview Area -->
                <div id="mpesa-preview-area" class="hidden space-y-2 pt-2 border-t dark:border-gray-800">
                    <div class="flex justify-between items-center">
                        <span id="mpesa-parsed-count" class="text-xs font-bold text-emerald-600 dark:text-emerald-400">0 SMS Extracted</span>
                        <span class="text-[11px] text-gray-400">Review before importing</span>
                    </div>
                    <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                        <table class="w-full text-left">
                            <thead class="bg-gray-50 dark:bg-gray-800/60 text-[11px] text-gray-500 uppercase">
                                <tr>
                                    <th class="py-2 px-3">Receipt</th>
                                    <th class="py-2 px-3">Date/Time</th>
                                    <th class="py-2 px-3">Type</th>
                                    <th class="py-2 px-3">Party</th>
                                    <th class="py-2 px-3">Amount</th>
                                    <th class="py-2 px-3">Category</th>
                                </tr>
                            </thead>
                            <tbody id="mpesa-preview-tbody" class="divide-y dark:divide-gray-800 bg-white dark:bg-gray-900"></tbody>
                        </table>
                    </div>
                </div>
            </form>
        </div>

        <!-- 📈 MMF & Passive Yields Section -->
        <div class="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 p-6 rounded-2xl border border-amber-200 dark:border-amber-900/50 space-y-4">
            <div class="flex justify-between items-center">
                <div>
                    <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>📈 Money Market Funds & Sacco Yields</span>
                    </h2>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Track passive interest compounding daily (Ziidi MMF 13.5%, Sanlam 14.5%, Britam 13.8%).</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${mmf_accounts.length > 0 ? mmf_accounts.map((m: any) => `
                <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-amber-100 dark:border-amber-900/50 shadow-xs space-y-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-bold text-gray-900 dark:text-white text-base">${m.name}</h3>
                            <span class="text-[10px] font-mono text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-semibold"># ${m.account_number || m.account_type}</span>
                        </div>
                        <span class="text-xs font-black px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                            ${m.interest_rate_p_a}% p.a.
                        </span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div class="p-2 bg-gray-50 dark:bg-gray-800/80 rounded-lg">
                            <p class="text-[10px] text-gray-400">Current Balance</p>
                            <p class="font-bold text-gray-900 dark:text-white convertible-amount" data-usd="${m.balance}">${m.balance}</p>
                        </div>
                        <div class="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
                            <p class="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Monthly Yield</p>
                            <p class="font-bold text-amber-700 dark:text-amber-400 convertible-amount" data-usd="${m.monthly_return}">${m.monthly_return}</p>
                        </div>
                    </div>
                    <p class="text-[10px] text-gray-400">
                        Daily: <strong class="convertible-amount text-emerald-600 dark:text-emerald-400" data-usd="${m.daily_return}"></strong> &nbsp;•&nbsp; Annual: <strong class="convertible-amount" data-usd="${m.annual_return}"></strong>
                    </p>
                    <form action="/accounts/interest/log/${m.id}" method="POST">
                        <button type="submit" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg text-xs transition shadow-xs flex items-center justify-center space-x-1.5">
                            <span>💰 Deposit Monthly Yield</span>
                        </button>
                    </form>
                </div>`).join('') : `
                <div class="md:col-span-3 p-6 text-center bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                    <p class="text-xs text-gray-500">No MMF or High-Yield accounts setup yet. Add Ziidi MMF (Safaricom) or Sacco savings below with an APY rate!</p>
                </div>`}
            </div>
        </div>

        <!-- Accounts & Quick Transfer Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Accounts (2 cols) -->
            <div class="lg:col-span-2 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
                <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">Your Accounts</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${accounts.length > 0 ? accounts.map((acc: any) => `
                    <div class="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3">
                        <div id="acc-display-${acc.id}" class="space-y-2">
                            <div class="flex justify-between items-start">
                                <div>
                                    <h3 class="font-bold text-gray-800 dark:text-gray-100 text-lg">${acc.name}</h3>
                                    <div class="flex flex-wrap items-center gap-1.5 mt-1">
                                        <span class="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full font-medium">${acc.account_type}</span>
                                        ${acc.account_number ? `<span class="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-200/70 dark:bg-gray-700 px-2 py-0.5 rounded-md font-semibold"># ${acc.account_number}</span>` : ''}
                                        ${acc.interest_rate_p_a > 0 ? `<span class="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md">📈 ${acc.interest_rate_p_a}% APY</span>` : ''}
                                    </div>
                                </div>
                                <form action="/accounts/delete/${acc.id}" method="POST" onsubmit="return confirm('Delete account?');">
                                    <button type="submit" class="text-rose-500 text-xs font-semibold hover:text-rose-700">Delete</button>
                                </form>
                            </div>
                            <div class="pt-2">
                                <p class="text-xs text-gray-500 dark:text-gray-400">Balance</p>
                                <p class="font-bold text-xl text-emerald-600 dark:text-emerald-400 convertible-amount" data-usd="${acc.balance}">${acc.balance}</p>
                            </div>
                            <button onclick="toggleEdit('${acc.id}')" class="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold py-1.5 rounded-lg transition mt-2">Edit Account</button>
                        </div>

                        <div id="acc-edit-${acc.id}" class="hidden space-y-2">
                            <form action="/accounts/update/${acc.id}" method="POST" class="space-y-2">
                                <div>
                                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Account Name</label>
                                    <input type="text" name="name" value="${acc.name}" class="w-full p-1.5 border dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded text-xs" required>
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Account / Phone / Till No.</label>
                                    <input type="text" name="account_number" value="${acc.account_number || ''}" placeholder="e.g. 0712345678" class="w-full p-1.5 border dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded text-xs">
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
                                    <select name="account_type" class="w-full p-1.5 border dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded text-xs">
                                        <option value="MOBILE" ${acc.account_type === 'MOBILE' ? 'selected' : ''}>Mobile Money (M-Pesa, Airtel)</option>
                                        <option value="BANK" ${acc.account_type === 'BANK' ? 'selected' : ''}>Bank Account</option>
                                        <option value="SAVINGS" ${acc.account_type === 'SAVINGS' ? 'selected' : ''}>Savings Account (Sacco / Fixed)</option>
                                        <option value="MMF" ${acc.account_type === 'MMF' ? 'selected' : ''}>Money Market Fund (MMF)</option>
                                        <option value="LOOP" ${acc.account_type === 'LOOP' ? 'selected' : ''}>Loop Business</option>
                                        <option value="CASH" ${acc.account_type === 'CASH' ? 'selected' : ''}>Cash / Petty Cash</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Annual APY % (e.g. 13.45)</label>
                                    <input type="number" step="any" name="interest_rate_p_a" value="${acc.interest_rate_p_a || 0.0}" class="w-full p-1.5 border dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded text-xs">
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Balance</label>
                                    <input type="number" step="any" name="balance" value="${acc.balance}" data-usd="${acc.balance}" class="w-full p-1.5 border dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded text-xs convertible-input" required>
                                </div>
                                <div class="flex space-x-2 pt-1">
                                    <button type="submit" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1 rounded text-xs font-semibold">Save</button>
                                    <button type="button" onclick="toggleEdit('${acc.id}')" class="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 text-gray-700 dark:text-gray-200 py-1 rounded text-xs">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>`).join('') : `
                    <div class="md:col-span-2 p-6 bg-gray-50 dark:bg-gray-800/60 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-center space-y-2">
                        <div class="text-3xl">💳</div>
                        <h4 class="font-bold text-gray-700 dark:text-gray-200">No accounts added yet</h4>
                        <p class="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">Add your real accounts below (e.g. M-Pesa, Bank, Sacco, Ziidi MMF, or Cash) to start tracking your real funds!</p>
                    </div>`}
                </div>

                <!-- Add Account Form -->
                <form action="/accounts/create" method="POST" class="pt-4 border-t dark:border-gray-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <input type="text" name="name" placeholder="Account Name (e.g. M-Pesa, Ziidi MMF)" class="p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm" required>
                    <input type="text" name="account_number" placeholder="Account / Phone / Till No." class="p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm">
                    <select name="account_type" class="p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm">
                        <option value="MOBILE">Mobile Money (M-Pesa, Airtel)</option>
                        <option value="BANK">Bank Account</option>
                        <option value="SAVINGS">Savings Account (Sacco / Fixed)</option>
                        <option value="MMF">Money Market Fund (MMF)</option>
                        <option value="LOOP">Loop Business</option>
                        <option value="CASH">Cash / Petty Cash</option>
                    </select>
                    <input type="number" step="any" name="interest_rate_p_a" placeholder="APY % (e.g. 13.45)" class="p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm">
                    <input type="number" step="any" name="balance" placeholder="Initial Balance" data-placeholder-base="Initial Balance" class="p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm convertible-placeholder" required>
                    <div class="sm:col-span-2 lg:col-span-5">
                        <button type="submit" class="w-full bg-gray-900 dark:bg-gray-700 hover:bg-black dark:hover:bg-gray-600 text-white text-sm font-semibold py-2 rounded-lg transition">Add Account</button>
                    </div>
                </form>
            </div>

            <!-- Quick Transfer -->
            <div class="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4 flex flex-col justify-between">
                <div>
                    <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">Quick Transfer</h2>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Move funds instantly between accounts.</p>
                    <form action="/transfers/create" method="POST" class="space-y-3">
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">From Account</label>
                            <select name="from_account_id" class="w-full p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm" required>
                                ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">To Account</label>
                            <select name="to_account_id" class="w-full p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm" required>
                                ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Amount (<span class="curr-symbol-label">Ksh</span>)</label>
                            <input type="number" step="any" name="amount" placeholder="0.00" data-placeholder-base="0.00" class="w-full p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg text-sm convertible-placeholder" required>
                        </div>
                        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-sm transition mt-2">Transfer Funds</button>
                    </form>
                </div>
            </div>
        </div>

        <!-- ⚙️ Data Management & Danger Zone -->
        <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div class="space-y-1 text-center md:text-left">
                <h3 class="text-base font-bold text-gray-800 dark:text-gray-100 flex items-center justify-center md:justify-start gap-2">
                    <span>⚙️ Database & Data Management</span>
                </h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">TypeScript + Cloudflare Edge. You can export a CSV backup or clear records anytime to start afresh.</p>
            </div>
            <div class="flex flex-wrap items-center gap-3">
                <a href="/finance/export/csv" class="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5">
                    <span>📥 Backup CSV</span>
                </a>
                <form action="/system/reset-data" method="POST" onsubmit="return confirm('⚠️ WARNING: This will permanently wipe all transactions, accounts, debts, budgets, bills, and rider logs so you can start completely clean. Are you sure?');">
                    <button type="submit" class="px-4 py-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold rounded-xl transition flex items-center gap-1.5">
                        <span>🗑️ Reset & Clear All Data</span>
                    </button>
                </form>
            </div>
        </div>

    </main>

    <!-- Mobile PWA Install Floating Banner -->
    <div id="pwa-bottom-banner" class="pwa-install-trigger hidden fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-gray-700/60 flex items-center justify-between gap-3 transition-all duration-300">
        <div class="flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-xl shadow-inner">
                ⚡
            </div>
            <div>
                <p class="text-xs font-bold text-white">Install Finatrack App</p>
                <p class="text-[11px] text-gray-300">Fast 1-tap launch & offline ready</p>
            </div>
        </div>
        <div class="flex items-center space-x-2">
            <button onclick="triggerAppInstall()" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black text-xs rounded-xl shadow-xs transition">
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
                    <span class="text-base font-bold text-emerald-600">1</span>
                    <p>Tap the <strong>Share</strong> button <span class="text-base">⎋</span> at the bottom of Safari.</p>
                </div>
                <div class="flex items-start space-x-3 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl">
                    <span class="text-base font-bold text-emerald-600">2</span>
                    <p>Scroll down and tap <strong>"Add to Home Screen" ➕</strong>.</p>
                </div>
                <div class="flex items-start space-x-3 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-xl">
                    <span class="text-base font-bold text-emerald-600">3</span>
                    <p>Tap <strong>"Add"</strong> in the top-right corner to finish installing!</p>
                </div>
            </div>
            <button onclick="document.getElementById('ios-install-modal').classList.add('hidden')" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition">
                Got It
            </button>
        </div>
    </div>
</body>
</html>`;
}
