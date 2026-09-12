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
                    const converted = (usdValue * USD_TO_KES).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    el.innerText = 'Ksh ' + converted;
                } else {
                    const converted = usdValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    el.innerText = '$' + converted;
                }
            });

            document.querySelectorAll('.convertible-input').forEach(el => {
                const usdValue = parseFloat(el.getAttribute('data-usd')) || 0;
                if (curr === 'Ksh') {
                    el.value = (usdValue * USD_TO_KES).toFixed(2);
                } else {
                    el.value = usdValue.toFixed(2);
                }
            });

            document.querySelectorAll('.curr-symbol-label').forEach(el => {
                el.innerText = curr === 'Ksh' ? 'Ksh' : '$';
            });

            document.querySelectorAll('.convertible-placeholder').forEach(el => {
                const basePlaceholder = el.getAttribute('data-placeholder-base') || '';
                el.placeholder = (curr === 'Ksh' ? 'Ksh ' : '$ ') + basePlaceholder;
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
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
            <div class="flex items-center space-x-3">
                <span class="text-2xl">⚡</span>
                <div>
                    <h1 class="font-extrabold text-lg text-gray-900 dark:text-white tracking-tight leading-none">Finatrack</h1>
                    <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">TypeScript + Cloudflare Edge</span>
                </div>
            </div>
            
            <div class="flex items-center space-x-2.5 sm:space-x-4">
                <a href="/rider" class="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs">
                    <span>🛵 Rider Fleet Tracker</span>
                </a>

                <select id="currency-selector" onchange="setCurrency(this.value)" class="text-xs bg-gray-100 dark:bg-gray-800 border-0 rounded-lg px-2.5 py-1.5 font-bold text-gray-700 dark:text-gray-200 cursor-pointer">
                    <option value="Ksh">KSH (KES)</option>
                    <option value="USD">USD ($)</option>
                </select>

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
</body>
</html>`;
}
