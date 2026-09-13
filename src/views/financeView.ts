export function renderFinanceDashboard(data: any): string {
  const {
    accounts = [],
    transactions = [],
    goals = [],
    budgets = [],
    income_targets = {
      weekly: { actual: 0, target: 15000, percentage: 0, displayPercentage: 0, remaining: 15000, dailyRate: 2142.86, statusLabel: '🎯 On Track', statusBadge: 'emerald', daysRemaining: 7 },
      monthly: { actual: 0, target: 65000, percentage: 0, displayPercentage: 0, remaining: 65000, dailyRate: 2166.67, statusLabel: '🎯 On Track', statusBadge: 'emerald', daysRemaining: 30 },
      yearly: { actual: 0, target: 780000, percentage: 0, displayPercentage: 0, remaining: 780000, dailyRate: 2136.99, statusLabel: '🎯 On Track', statusBadge: 'emerald', daysRemaining: 365 }
    },
    expense_targets = {
      weekly: { actual: 0, target: 6000, percentage: 0, displayPercentage: 0, remaining: 6000, dailyRate: 857.14, statusLabel: '🟢 Safe Spend Pace', statusBadge: 'emerald', daysRemaining: 7 },
      monthly: { actual: 0, target: 25000, percentage: 0, displayPercentage: 0, remaining: 25000, dailyRate: 833.33, statusLabel: '🟢 Safe Spend Pace', statusBadge: 'emerald', daysRemaining: 30 },
      yearly: { actual: 0, target: 300000, percentage: 0, displayPercentage: 0, remaining: 300000, dailyRate: 821.92, statusLabel: '🟢 Safe Spend Pace', statusBadge: 'emerald', daysRemaining: 365 }
    },
    category_budgets = [],
    debts = [],
    bills = [],
    mmf_accounts = [],
    allocation_rules = [],
    total_balance = 0.0,
    weekly_income = 0.0,
    weekly_expenses = 0.0,
    monthly_income = 0.0,
    monthly_expenses = 0.0,
    yearly_income = 0.0,
    yearly_expenses = 0.0,
    net_savings = 0.0,
    total_monthly_passive_income = 0.0,
    usd_to_kes = 129.0,
    current_currency = 'Ksh',
    toast = '',
    today = new Date().toISOString().slice(0, 10),
    now_iso = new Date().toISOString().slice(0, 16),
    unique_categories = [],
    username = 'Dennis',
    is_logged_in = false,
  } = data;

  const formatKes = (val: number | string) => 'Ksh ' + (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatNum = (val: number | string) => (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getBadgeStyles = (badge: string) => {
    switch (badge) {
      case 'emerald':
        return 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
      case 'cyan':
        return 'bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800';
      case 'amber':
        return 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800';
      case 'rose':
        return 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800';
      default:
        return 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800';
    }
  };

  const getGoalIcon = (title: string): string => {
    const t = (title || '').toLowerCase();
    if (t.includes('tv') || t.includes('television') || t.includes('screen')) return '📺';
    if (t.includes('cooker') || t.includes('gas') || t.includes('oven') || t.includes('kitchen') || t.includes('stove')) return '🍳';
    if (t.includes('seat') || t.includes('sofa') || t.includes('couch') || t.includes('furniture') || t.includes('chair') || t.includes('table')) return '🛋️';
    if (t.includes('fridge') || t.includes('refrigerator')) return '🧊';
    if (t.includes('bike') || t.includes('boda') || t.includes('motorcycle') || t.includes('car')) return '🛵';
    if (t.includes('laptop') || t.includes('macbook') || t.includes('computer') || t.includes('phone') || t.includes('iphone')) return '💻';
    if (t.includes('house') || t.includes('rent') || t.includes('plot') || t.includes('land')) return '🏠';
    if (t.includes('emergency') || t.includes('fund')) return '🛡️';
    if (t.includes('vacation') || t.includes('trip') || t.includes('holiday')) return '✈️';
    return '🎯';
  };

  const totalGoalsTarget = (goals || []).reduce((sum: number, g: any) => sum + Number(g.target_amount || 0), 0);
  const totalGoalsSaved = (goals || []).reduce((sum: number, g: any) => sum + Number(g.current_amount || 0), 0);
  const overallGoalsPercent = totalGoalsTarget > 0 ? Math.min(100, Math.round((totalGoalsSaved / totalGoalsTarget) * 100)) : 0;

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
    <meta name="application-name" content="Finatrack">
    
    <!-- Icons for PWA, PC, Android, iOS -->
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
    <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png">
    <link rel="icon" type="image/svg+xml" href="/icons/icon.svg">
    <link rel="shortcut icon" href="/favicon.ico">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png">
    <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png">
    <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png">
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
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @supports (padding: max(0px)) {
            .safe-area-bottom {
                padding-bottom: max(0.6rem, env(safe-area-inset-bottom));
            }
        }
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

        let activeCurrency = '${current_currency}';
        try {
            const ls = localStorage.getItem('finatrack_currency');
            if (ls === 'USD' || ls === 'Ksh') activeCurrency = ls;
        } catch (e) {}

        function getCurrency() {
            try {
                const ls = localStorage.getItem('finatrack_currency');
                if (ls === 'USD' || ls === 'Ksh') return ls;
                const match = document.cookie.match(/finatrack_currency=(Ksh|USD)/);
                if (match) return match[1];
            } catch (e) {}
            return activeCurrency || 'Ksh';
        }

        function setCurrency(curr) {
            const validCurr = (curr === 'USD') ? 'USD' : 'Ksh';
            activeCurrency = validCurr;
            try {
                localStorage.setItem('finatrack_currency', validCurr);
            } catch (e) {}
            try {
                document.cookie = "finatrack_currency=" + validCurr + ";path=/;max-age=31536000;SameSite=Lax";
            } catch (e) {}
            applyConversion();
            updateSplitBreakdown();
        }

        function applyConversion() {
            const curr = getCurrency();
            const selectEl = document.getElementById('currency-selector');
            if (selectEl) selectEl.value = curr;

            document.querySelectorAll('.convertible-amount').forEach(el => {
                const kesValue = parseFloat(el.getAttribute('data-kes')) || 0;
                const prefix = el.getAttribute('data-prefix') || '';
                if (curr === 'Ksh') {
                    el.innerText = prefix + 'Ksh ' + kesValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                } else {
                    el.innerText = prefix + '$' + (kesValue / USD_TO_KES).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
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
            if (!displayDiv || !editDiv) {
                console.warn('Account elements not found:', id);
                return;
            }
            if (editDiv.classList.contains('hidden')) {
                const curr = getCurrency();
                const balInput = editDiv.querySelector('input[name="balance"]');
                if (balInput) {
                    const kes = parseFloat(balInput.getAttribute('data-kes')) || parseFloat(balInput.value) || 0;
                    balInput.value = curr === 'Ksh' ? kes.toFixed(2) : (kes / USD_TO_KES).toFixed(2);
                }
                editDiv.classList.remove('hidden');
                displayDiv.classList.add('hidden');
            } else {
                editDiv.classList.add('hidden');
                displayDiv.classList.remove('hidden');
            }
        }

        function onAccountEditSubmit(form) {
            const curr = getCurrency();
            const balInput = form.querySelector('input[name="balance"]');
            if (balInput && curr === 'USD') {
                const usdVal = parseFloat(balInput.value) || 0;
                balInput.value = (usdVal * USD_TO_KES).toFixed(2);
            }
            return true;
        }

        function toggleGoalForm(id, type) {
            const fundDiv = document.getElementById('goal-fund-' + id);
            const withdrawDiv = document.getElementById('goal-withdraw-' + id);
            if (type === 'fund') {
                if (withdrawDiv) withdrawDiv.classList.add('hidden');
                if (fundDiv) fundDiv.classList.toggle('hidden');
            } else if (type === 'withdraw') {
                if (fundDiv) fundDiv.classList.add('hidden');
                if (withdrawDiv) withdrawDiv.classList.toggle('hidden');
            }
        }

        function switchTargetTab(timeframe) {
            ['weekly', 'monthly', 'yearly'].forEach(tf => {
                const pane = document.getElementById('target-pane-' + tf);
                const btn = document.getElementById('target-btn-' + tf);
                if (pane) {
                    if (tf === timeframe) {
                        pane.classList.remove('hidden');
                    } else {
                        pane.classList.add('hidden');
                    }
                }
                if (btn) {
                    if (tf === timeframe) {
                        btn.className = 'target-tab-btn px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-xs bg-emerald-600 text-white';
                    } else {
                        btn.className = 'target-tab-btn px-4 py-1.5 rounded-xl text-xs font-bold transition bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700';
                    }
                }
            });
        }


        function toggleDarkMode() {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        }

        document.addEventListener('DOMContentLoaded', () => {
            const theme = localStorage.getItem('theme');
            if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            applyConversion();
            updateSplitBreakdown();
            if (!isRunningStandalone()) {
                showInstallUi();
            }
        });

        function updateSplitBreakdown() {
            const curr = getCurrency();
            const inputEl = document.getElementById('split-amount-input');
            const total = parseFloat(inputEl ? inputEl.value : 0) || 0;
            const rules = ${JSON.stringify(allocation_rules)};
            
            rules.forEach(r => {
                const pct = parseFloat(r.percentage) || 0;
                const kesAmt = total * (pct / 100);
                const spanEl = document.getElementById('rule-calc-' + r.id);
                if (spanEl) {
                    if (curr === 'Ksh') {
                        spanEl.innerText = 'Ksh ' + kesAmt.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    } else {
                        spanEl.innerText = '$' + (kesAmt / USD_TO_KES).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    }
                }
            });
        }

        function parseMpesaClient() {
            const input = document.getElementById('mpesa-batch-input');
            const raw = input ? input.value : '';
            if (!raw.trim()) {
                alert('Please paste at least one M-Pesa SMS message.');
                return;
            }

            let text = raw
                .replace(new RegExp('[\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]', 'g'), ' ')
                .trim();
            // Normalize common Safaricom punctuation quirks
            text = text.replace(new RegExp('([0-9]|AM|PM|am|pm)\\.New\\s+M-PESA', 'gi'), '$1. New M-PESA');

            const results = [];
            const receivedRegex = new RegExp('([A-Z0-9]{8,12})\\s+(?:Confirmed\\.?\\s+)?(?:You have received\\s+)?(?:Ksh|KES)\\.?\\s*([0-9,]+(?:\\.[0-9]{2})?)\\s+received from\\s+([\\s\\S]+?)(?=(?:\\s+on\\s+\\d|\\s+at\\s+\\d|\\.?\\s*New M-PESA|\\.$|$))', 'i');
            const sentRegex = new RegExp('([A-Z0-9]{8,12})\\s+(?:Confirmed\\.?\\s+)?(?:Ksh|KES)\\.?\\s*([0-9,]+(?:\\.[0-9]{2})?)\\s+sent to\\s+([\\s\\S]+?)(?=(?:\\s+on\\s+\\d|\\s+at\\s+\\d|\\.?\\s*New M-PESA|\\.$|$))', 'i');
            const paidRegex = new RegExp('([A-Z0-9]{8,12})\\s+(?:Confirmed\\.?\\s+)?(?:Ksh|KES)\\.?\\s*([0-9,]+(?:\\.[0-9]{2})?)\\s+paid to\\s+([\\s\\S]+?)(?=(?:\\s+on\\s+\\d|\\s+at\\s+\\d|\\.?\\s*New M-PESA|\\.$|$))', 'i');
            const withdrawRegex = new RegExp('([A-Z0-9]{8,12})\\s+(?:Confirmed\\.?\\s+)?(?:Ksh|KES)\\.?\\s*([0-9,]+(?:\\.[0-9]{2})?)\\s+withdrawn from\\s+([\\s\\S]+?)(?=(?:\\s+on\\s+\\d|\\s+at\\s+\\d|\\.?\\s*New M-PESA|\\.$|$))', 'i');
            const dtRegex = new RegExp('on\\s+(\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})(?:\\s+at\\s+(\\d{1,2}:\\d{2}(?:\\s*(?:AM|PM|am|pm))?))?', 'i');
            const regex = new RegExp('(?:^|\\b)([A-Z0-9]{8,12})\\s+(?:Confirmed|You have received)[\\s\\S]*?(?=(?:\\b[A-Z0-9]{8,12}\\s+(?:Confirmed|You have received))|$)', 'gi');
            const chunks = [];
            let rMatch;
            while ((rMatch = regex.exec(text)) !== null) {
                chunks.push(rMatch[0].trim());
            }

            if (chunks.length === 0) {
                chunks.push(text);
            }

            chunks.forEach(function(c) {
                const itemText = c.trim();
                if (itemText.length < 15) return;
                let code = '', amt = 0, party = '', type = 'EXPENSE', cat = 'Living Expenses';
                let match = itemText.match(receivedRegex);
                if (match) {
                    code = match[1].toUpperCase();
                    amt = parseFloat(match[2].replace(/,/g, ''));
                    party = match[3].trim().replace(/\.+$/, '');
                    type = 'INCOME';
                    cat = (party.toUpperCase().includes('BOLT') || party.toUpperCase().includes('UBER') || party.toUpperCase().includes('GLOVO')) ? 'Rider & Boda Deliveries' : 'M-Pesa Income';
                } else if ((match = itemText.match(sentRegex))) {
                    code = match[1].toUpperCase();
                    amt = parseFloat(match[2].replace(/,/g, ''));
                    party = match[3].trim().replace(/\.+$/, '');
                    type = 'EXPENSE';
                    cat = 'Living Expenses';
                } else if ((match = itemText.match(paidRegex))) {
                    code = match[1].toUpperCase();
                    amt = parseFloat(match[2].replace(/,/g, ''));
                    party = match[3].trim().replace(/\.+$/, '');
                    type = 'EXPENSE';
                    const p = party.toUpperCase();
                    if (p.includes('SPIRO') || p.includes('ROAM') || p.includes('AMPERSAND') || p.includes('KIRI') || p.includes('ARC RIDE') || p.includes('BASIGO') || p.includes('BATTERY') || p.includes('SWAP')) cat = 'EV Battery Swap & Charging';
                    else if (p.includes('TOTAL') || p.includes('SHELL') || p.includes('RUBIS') || p.includes('PETROL') || p.includes('OLA') || p.includes('HASS') || p.includes('OIL')) cat = 'Fuel & Petrol';
                    else if (p.includes('KPLC') || p.includes('WATER') || p.includes('SAFARICOM') || p.includes('ZUKU')) cat = 'Utilities & Bills';
                    else if (p.includes('NAIVAS') || p.includes('QUICKMART') || p.includes('CARREFOUR') || p.includes('HOTEL') || p.includes('FOOD')) cat = 'Food & Groceries';
                    else cat = 'Living Expenses';
                } else if ((match = itemText.match(withdrawRegex))) {
                    code = match[1].toUpperCase();
                    amt = parseFloat(match[2].replace(/,/g, ''));
                    party = match[3].trim().replace(/\.+$/, '');
                    type = 'EXPENSE';
                    cat = 'Cash Withdrawal';
                } else {
                    const genericMatch = itemText.match(/([A-Z0-9]{8,12})\s+.*?(?:Ksh|KES)\.?\s*([0-9,]+(?:\.[0-9]{2})?)/i);
                    if (genericMatch) {
                        code = genericMatch[1].toUpperCase();
                        amt = parseFloat(genericMatch[2].replace(/,/g, ''));
                        type = itemText.toLowerCase().includes('received') ? 'INCOME' : 'EXPENSE';
                        party = 'M-Pesa Transaction';
                        cat = type === 'INCOME' ? 'M-Pesa Income' : 'Living Expenses';
                    }
                }

                if (code && amt > 0) {
                    const dtM = itemText.match(dtRegex);
                    const rawDt = dtM ? dtM[1] : 'Today';
                    const rawTm = dtM && dtM[2] ? dtM[2].trim() : '';
                    results.push({ code: code, type: type, amt: amt, party: party, rawDt: rawDt, rawTm: rawTm, cat: cat });
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
            } else if (type === 'ev') {
                input.value = 'QD44444444 Confirmed. Ksh400.00 paid to SPIRO BATTERY SWAP on 12/9/26 at 4:30 PM. New M-PESA balance is Ksh5,320.00.';
            } else {
                input.value = 'QA11111111 Confirmed. Ksh2,400.00 received from BOLT DELIVERIES on 12/9/26 at 6:00 PM. New M-PESA balance is Ksh7,170.00.\\n' +
                              'QB22222222 Confirmed. Ksh630.00 paid to TOTAL ENERGIES. on 12/9/26 at 7:30 PM. New M-PESA balance is Ksh6,540.00.\\n' +
                              'QD44444444 Confirmed. Ksh400.00 paid to SPIRO BATTERY SWAP on 12/9/26 at 4:30 PM. New M-PESA balance is Ksh5,320.00.\\n' +
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
                    <option value="Ksh" ${current_currency === 'Ksh' ? 'selected' : ''}>KSH</option>
                    <option value="USD" ${current_currency === 'USD' ? 'selected' : ''}>USD</option>
                </select>

                ${is_logged_in ? `
                <div class="flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1.5 rounded-xl shadow-xs">
                    <span class="text-xs">👤</span>
                    <span class="text-xs font-bold text-emerald-800 dark:text-emerald-300 max-w-[100px] truncate hidden sm:inline">${username}</span>
                    <form action="/auth/logout" method="POST" class="inline m-0 p-0">
                        <input type="hidden" name="redirect_to" value="/">
                        <button type="submit" title="Logout" class="text-[10px] text-rose-500 dark:text-rose-400 font-bold hover:underline ml-1">✕</button>
                    </form>
                </div>
                ` : `
                <a href="/login" class="px-3 py-1.5 bg-gradient-to-r from-pink-500/10 to-purple-500/10 hover:from-pink-500/20 hover:to-purple-500/20 text-pink-600 dark:text-pink-400 border border-pink-500/30 rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-xs">
                    <span>🔑 <span class="hidden sm:inline">Sign In</span></span>
                </a>
                `}

                <button onclick="toggleDarkMode()" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                    🌙
                </button>
            </div>
        </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 flex-1 w-full pb-28 sm:pb-8">
        
        <!-- 👋 Welcome Greeting Hero Banner -->
        <div class="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div class="flex items-center space-x-3.5">
                <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-2xl text-white shadow-md">
                    👋
                </div>
                <div>
                    <h2 class="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-tight">
                        ${is_logged_in ? `Welcome back, <span class="text-emerald-600 dark:text-emerald-400 font-extrabold">${username}</span>!` : `Welcome to <span class="text-emerald-600 dark:text-emerald-400 font-extrabold">Finatrack</span>!`}
                    </h2>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${is_logged_in ? 'Your automated financial freedom waterfall & multi-account analytics are active.' : 'Track your MMF yields, savings goals, debts, and automated money waterfall in real-time.'}</p>
                </div>
            </div>
            <div class="flex items-center space-x-2 text-xs">
                ${is_logged_in ? `
                <span class="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-bold rounded-xl flex items-center gap-1.5 shadow-2xs">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Authenticated (${username})</span>
                </span>
                ` : `
                <a href="/login" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition active:scale-95">
                    <span>🔑 Sign In / Register</span>
                </a>
                `}
            </div>
        </div>

        <!-- Mobile Quick Action Pills (Horizontal scroll on phone) -->
        <div class="flex sm:hidden overflow-x-auto gap-2 py-1 no-scrollbar -mx-4 px-4 sticky top-14 z-20 bg-gray-50/90 dark:bg-slate-950/90 backdrop-blur-md">
            <button onclick="document.getElementById('targets-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>🎯 Targets</span>
            </button>
            <button onclick="document.getElementById('tx-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>➕ Add Tx</span>
            </button>
            <button onclick="pasteSampleMpesa('batch'); document.getElementById('mpesa-card')?.scrollIntoView({behavior: 'smooth'});" class="flex items-center space-x-1.5 px-3.5 py-2 bg-gray-900 dark:bg-gray-800 active:scale-95 text-emerald-400 text-xs font-bold rounded-xl shadow-xs shrink-0 border border-gray-700 transition">
                <span>📲 Parse M-Pesa</span>
            </button>
            <button onclick="document.getElementById('goals-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-purple-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>🎯 Goals</span>
            </button>
            <button onclick="document.getElementById('waterfall-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>🌊 Auto-Split</span>
            </button>
            <a href="/rider" class="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>🛵 Log Shift</span>
            </a>
            <button onclick="triggerAppInstall()" class="pwa-install-trigger flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>📲 Install</span>
            </button>
        </div>

        <!-- Net Worth & Overview Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-gradient-to-br from-emerald-600 to-teal-700 p-5 rounded-2xl text-white shadow-sm space-y-1">
                <p class="text-xs font-semibold text-emerald-100 uppercase tracking-wider">Total Net Balance</p>
                <p class="text-2xl sm:text-3xl font-black convertible-amount" data-kes="${total_balance}">${formatKes(total_balance)}</p>
                <p class="text-[11px] text-emerald-200">${accounts.length} Active Accounts Connected</p>
            </div>

            <div class="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs space-y-1">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">This Month's Income</p>
                <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 convertible-amount" data-kes="${monthly_income}">${formatKes(monthly_income)}</p>
                <p class="text-[11px] text-gray-500">From shifts, interest & transfers</p>
            </div>

            <div class="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs space-y-1">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">This Month's Expenses</p>
                <p class="text-2xl font-bold text-rose-600 dark:text-rose-400 convertible-amount" data-kes="${monthly_expenses}">${formatKes(monthly_expenses)}</p>
                <p class="text-[11px] text-gray-500">Fuel, food, utilities & bills</p>
            </div>

            <div class="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs space-y-1">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Monthly Passive Yield</p>
                <p class="text-2xl font-bold text-amber-600 dark:text-amber-400 convertible-amount" data-kes="${total_monthly_passive_income}">${formatKes(total_monthly_passive_income)}</p>
                <p class="text-[11px] text-amber-700 dark:text-amber-300">From MMF & Sacco high yields</p>
            </div>
        </div>

        <!-- 🎯 Targets & Budget Pace Checker Card -->
        <div id="targets-card" class="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 p-5 sm:p-6 rounded-2xl text-white shadow-lg border border-indigo-900/60 space-y-6">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-indigo-800/60 pb-4">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-xl shadow-md shrink-0">
                        🎯
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-white flex items-center gap-2">
                            <span>Income & Expense Target Checkers</span>
                            <span class="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-500/30">Weekly • Monthly • Yearly</span>
                        </h2>
                        <p class="text-xs text-indigo-200">Track target income milestones vs expense budget burn rates with safe daily run-rate pacing.</p>
                    </div>
                </div>

                <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <!-- Timeframe Tab Switcher -->
                    <div class="flex p-1 bg-slate-950/80 border border-indigo-800/80 rounded-xl">
                        <button type="button" id="target-btn-weekly" onclick="switchTargetTab('weekly')" class="target-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold transition text-gray-400 hover:text-white">
                            Weekly
                        </button>
                        <button type="button" id="target-btn-monthly" onclick="switchTargetTab('monthly')" class="target-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-600 text-white shadow-xs">
                            Monthly
                        </button>
                        <button type="button" id="target-btn-yearly" onclick="switchTargetTab('yearly')" class="target-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold transition text-gray-400 hover:text-white">
                            Yearly
                        </button>
                    </div>

                    <button type="button" onclick="document.getElementById('targets-edit-form-container')?.classList.toggle('hidden')" class="px-3 py-2 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 hover:text-white text-xs font-bold rounded-xl border border-indigo-700/60 transition active:scale-95 flex items-center gap-1.5">
                        <span>⚙️ Set Targets</span>
                    </button>
                </div>
            </div>

            <!-- Collapsible Edit Targets Form -->
            <div id="targets-edit-form-container" class="hidden bg-slate-950/90 p-5 rounded-2xl border border-indigo-700/60 shadow-inner space-y-4">
                <div class="flex justify-between items-center border-b border-indigo-800/60 pb-2">
                    <h3 class="text-sm font-bold text-white flex items-center gap-2">
                        <span>⚙️ Customize Income Targets & Expense Ceilings</span>
                    </h3>
                    <button type="button" onclick="document.getElementById('targets-edit-form-container')?.classList.add('hidden')" class="text-gray-400 hover:text-white text-sm">✕</button>
                </div>

                <form action="/targets/update" method="POST" class="space-y-4">
                    <div>
                        <p class="text-xs font-extrabold text-emerald-400 uppercase tracking-wider mb-2">💵 Target Income Milestones (<span class="curr-symbol-label">Ksh</span>)</p>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label class="block text-[11px] text-gray-400 mb-1">Weekly Target Income</label>
                                <input type="number" step="any" inputmode="decimal" name="target_income_weekly" value="${income_targets.weekly.target}" placeholder="15000" data-placeholder-base="15000" class="w-full p-2 bg-slate-900 border border-indigo-700/60 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-emerald-400 convertible-placeholder" required>
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-400 mb-1">Monthly Target Income</label>
                                <input type="number" step="any" inputmode="decimal" name="target_income_monthly" value="${income_targets.monthly.target}" placeholder="65000" data-placeholder-base="65000" class="w-full p-2 bg-slate-900 border border-indigo-700/60 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-emerald-400 convertible-placeholder" required>
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-400 mb-1">Yearly Target Income</label>
                                <input type="number" step="any" inputmode="decimal" name="target_income_yearly" value="${income_targets.yearly.target}" placeholder="780000" data-placeholder-base="780000" class="w-full p-2 bg-slate-900 border border-indigo-700/60 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-emerald-400 convertible-placeholder" required>
                            </div>
                        </div>
                    </div>

                    <div>
                        <p class="text-xs font-extrabold text-rose-400 uppercase tracking-wider mb-2">🛑 Expense Target & Budget Ceilings (<span class="curr-symbol-label">Ksh</span>)</p>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label class="block text-[11px] text-gray-400 mb-1">Weekly Expense Budget</label>
                                <input type="number" step="any" inputmode="decimal" name="target_expense_weekly" value="${expense_targets.weekly.target}" placeholder="6000" data-placeholder-base="6000" class="w-full p-2 bg-slate-900 border border-indigo-700/60 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-rose-400 convertible-placeholder" required>
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-400 mb-1">Monthly Expense Budget</label>
                                <input type="number" step="any" inputmode="decimal" name="target_expense_monthly" value="${expense_targets.monthly.target}" placeholder="25000" data-placeholder-base="25000" class="w-full p-2 bg-slate-900 border border-indigo-700/60 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-rose-400 convertible-placeholder" required>
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-400 mb-1">Yearly Expense Budget</label>
                                <input type="number" step="any" inputmode="decimal" name="target_expense_yearly" value="${expense_targets.yearly.target}" placeholder="300000" data-placeholder-base="300000" class="w-full p-2 bg-slate-900 border border-indigo-700/60 rounded-xl text-xs font-bold text-white focus:ring-2 focus:ring-rose-400 convertible-placeholder" required>
                            </div>
                        </div>
                    </div>

                    <div>
                        <p class="text-xs font-extrabold text-amber-400 uppercase tracking-wider mb-2">🏷️ Monthly Category Spending Limits (<span class="curr-symbol-label">Ksh</span>)</p>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label class="block text-[11px] text-gray-400 mb-1">🏠 Living Expenses</label>
                                <input type="number" step="any" name="cat_limit_living" value="${(budgets.find((b: any) => b.category === 'Living Expenses') || {}).limit || 8000}" placeholder="8000" class="w-full p-2 bg-slate-900 border border-indigo-700/60 rounded-xl text-xs font-bold text-white">
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-400 mb-1">🛒 Food & Groceries</label>
                                <input type="number" step="any" name="cat_limit_food" value="${(budgets.find((b: any) => b.category === 'Food & Groceries') || {}).limit || 6000}" placeholder="6000" class="w-full p-2 bg-slate-900 border border-indigo-700/60 rounded-xl text-xs font-bold text-white">
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-400 mb-1">⛽ Fuel / EV Swaps</label>
                                <input type="number" step="any" name="cat_limit_fuel" value="${(budgets.find((b: any) => b.category.includes('Fuel')) || {}).limit || 7000}" placeholder="7000" class="w-full p-2 bg-slate-900 border border-indigo-700/60 rounded-xl text-xs font-bold text-white">
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-400 mb-1">⚡ Utilities & Bills</label>
                                <input type="number" step="any" name="cat_limit_bills" value="${(budgets.find((b: any) => b.category.includes('Utilities')) || {}).limit || 4000}" placeholder="4000" class="w-full p-2 bg-slate-900 border border-indigo-700/60 rounded-xl text-xs font-bold text-white">
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-end pt-2">
                        <button type="submit" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition shadow-md active:scale-95">
                            💾 Save Target Preferences
                        </button>
                    </div>
                </form>
            </div>

            <!-- TIME PANES: Weekly, Monthly, Yearly -->
            ${(['weekly', 'monthly', 'yearly'] as const).map(tf => {
                const inc = income_targets[tf];
                const exp = expense_targets[tf];
                const isHidden = tf !== 'monthly';
                const tfTitle = tf === 'weekly' ? 'This Week (Mon - Sun)' : tf === 'monthly' ? "This Month's Pace" : 'Yearly Goal Pace';

                return `
                <div id="target-pane-${tf}" class="${isHidden ? 'hidden' : ''} space-y-5">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <!-- 💵 Target Income Checker Card -->
                        <div class="bg-slate-950/80 border border-emerald-500/40 p-5 rounded-2xl shadow-inner space-y-4 flex flex-col justify-between">
                            <div class="space-y-3">
                                <div class="flex justify-between items-start gap-2">
                                    <div class="flex items-center space-x-2">
                                        <span class="text-xl">💵</span>
                                        <div>
                                            <h3 class="text-sm font-bold text-white">Target Income Checker</h3>
                                            <p class="text-[10px] text-emerald-300 font-semibold">${tfTitle}</p>
                                        </div>
                                    </div>
                                    <span class="text-[11px] font-black px-2.5 py-0.5 rounded-full ${getBadgeStyles(inc.statusBadge)}">
                                        ${inc.statusLabel}
                                    </span>
                                </div>

                                <div class="flex justify-between items-baseline pt-1">
                                    <div>
                                        <p class="text-[10px] uppercase font-bold text-gray-400">Earned So Far</p>
                                        <p class="text-2xl font-black text-emerald-400 convertible-amount" data-kes="${inc.actual}">${formatKes(inc.actual)}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-[10px] uppercase font-bold text-gray-400">Target Goal</p>
                                        <p class="text-sm font-black text-gray-200 convertible-amount" data-kes="${inc.target}">${formatKes(inc.target)}</p>
                                    </div>
                                </div>

                                <!-- Progress Bar -->
                                <div class="space-y-1">
                                    <div class="w-full bg-slate-900 h-3 rounded-full overflow-hidden p-0.5 border border-emerald-950">
                                        <div class="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-teal-500 to-emerald-400 shadow-sm" style="width: ${inc.displayPercentage}%;"></div>
                                    </div>
                                    <div class="flex justify-between text-[11px] text-gray-400 font-semibold">
                                        <span class="text-emerald-300 font-black">${inc.percentage}% Achieved</span>
                                        <span>Remaining: <strong class="convertible-amount text-white" data-kes="${inc.remaining}">${formatKes(inc.remaining)}</strong></span>
                                    </div>
                                </div>
                            </div>

                            <div class="p-3 bg-emerald-950/40 rounded-xl border border-emerald-900/60 text-xs">
                                ${inc.actual >= inc.target ? `
                                <div class="flex items-center space-x-2 text-emerald-300 font-bold">
                                    <span>🎉</span>
                                    <span>Goal exceeded by <span class="convertible-amount font-black text-emerald-200" data-kes="${inc.actual - inc.target}">${formatKes(inc.actual - inc.target)}</span>! Fantastic momentum!</span>
                                </div>
                                ` : `
                                <div class="flex justify-between items-center">
                                    <span class="text-emerald-200 font-semibold">⚡ Required Run-Rate:</span>
                                    <span class="font-extrabold text-white"><span class="convertible-amount text-emerald-300" data-kes="${inc.dailyRate}">${formatKes(inc.dailyRate)}</span> <span class="text-[10px] text-gray-400">/ day (${inc.daysRemaining} days left)</span></span>
                                </div>
                                `}
                            </div>
                        </div>

                        <!-- 🛑 Expense Target & Budget Checker Card -->
                        <div class="bg-slate-950/80 border border-rose-500/30 p-5 rounded-2xl shadow-inner space-y-4 flex flex-col justify-between">
                            <div class="space-y-3">
                                <div class="flex justify-between items-start gap-2">
                                    <div class="flex items-center space-x-2">
                                        <span class="text-xl">🛑</span>
                                        <div>
                                            <h3 class="text-sm font-bold text-white">Expense Target / Budget Checker</h3>
                                            <p class="text-[10px] text-rose-300 font-semibold">${tfTitle}</p>
                                        </div>
                                    </div>
                                    <span class="text-[11px] font-black px-2.5 py-0.5 rounded-full ${getBadgeStyles(exp.statusBadge)}">
                                        ${exp.statusLabel}
                                    </span>
                                </div>

                                <div class="flex justify-between items-baseline pt-1">
                                    <div>
                                        <p class="text-[10px] uppercase font-bold text-gray-400">Spent So Far</p>
                                        <p class="text-2xl font-black text-rose-400 convertible-amount" data-kes="${exp.actual}">${formatKes(exp.actual)}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-[10px] uppercase font-bold text-gray-400">Budget Limit</p>
                                        <p class="text-sm font-black text-gray-200 convertible-amount" data-kes="${exp.target}">${formatKes(exp.target)}</p>
                                    </div>
                                </div>

                                <!-- Progress Bar -->
                                <div class="space-y-1">
                                    <div class="w-full bg-slate-900 h-3 rounded-full overflow-hidden p-0.5 border border-rose-950">
                                        <div class="h-full rounded-full transition-all duration-500 ${exp.percentage >= 100 ? 'bg-gradient-to-r from-rose-600 to-red-500' : exp.percentage > exp.expectedPacePct + 15 ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}" style="width: ${exp.displayPercentage}%;"></div>
                                    </div>
                                    <div class="flex justify-between text-[11px] text-gray-400 font-semibold">
                                        <span class="${exp.percentage >= 100 ? 'text-rose-400 font-black' : 'text-gray-300'}">${exp.percentage}% Spent</span>
                                        <span>Remaining: <strong class="convertible-amount text-white" data-kes="${exp.remaining}">${formatKes(exp.remaining)}</strong></span>
                                    </div>
                                </div>
                            </div>

                            <div class="p-3 bg-slate-900/90 rounded-xl border border-indigo-900/60 text-xs">
                                ${exp.actual > exp.target ? `
                                <div class="flex items-center space-x-2 text-rose-400 font-bold">
                                    <span>🚨</span>
                                    <span>Over budget limit by <span class="convertible-amount font-black" data-kes="${exp.actual - exp.target}">${formatKes(exp.actual - exp.target)}</span>!</span>
                                </div>
                                ` : `
                                <div class="flex justify-between items-center">
                                    <span class="text-indigo-200 font-semibold">🛡️ Safe Daily Spend Limit:</span>
                                    <span class="font-extrabold text-white"><span class="convertible-amount text-emerald-400" data-kes="${exp.dailyRate}">${formatKes(exp.dailyRate)}</span> <span class="text-[10px] text-gray-400">/ day max (${exp.daysRemaining} days left)</span></span>
                                </div>
                                `}
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('')}

            <!-- 🏷️ Monthly Category Budgets & Burn Rates Breakdown -->
            <div class="pt-2 border-t border-indigo-800/60 space-y-3">
                <div class="flex justify-between items-center">
                    <h3 class="text-xs font-extrabold uppercase text-indigo-200 tracking-wider flex items-center gap-1.5">
                        <span>🏷️ Monthly Category Budget Burn Rates</span>
                    </h3>
                    <span class="text-[10px] text-gray-400 font-semibold">Live auto-calculated from transactions</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    ${category_budgets.map((b: any) => `
                    <div class="p-3.5 bg-slate-950/70 border border-indigo-900/60 rounded-xl space-y-2.5 flex flex-col justify-between">
                        <div>
                            <div class="flex justify-between items-start">
                                <div class="flex items-center space-x-2">
                                    <span class="text-lg">${b.icon || '🏷️'}</span>
                                    <span class="text-xs font-bold text-gray-200 truncate max-w-[120px]">${b.category}</span>
                                </div>
                                <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${getBadgeStyles(b.burnBadge)}">
                                    ${b.burnLabel}
                                </span>
                            </div>

                            <div class="flex justify-between text-xs mt-2">
                                <span class="font-black text-white convertible-amount" data-kes="${b.spent}">${formatKes(b.spent)}</span>
                                <span class="text-gray-400 text-[11px]">/ <span class="convertible-amount font-semibold" data-kes="${b.limit}">${formatKes(b.limit)}</span></span>
                            </div>

                            <div class="w-full bg-slate-900 h-2 rounded-full overflow-hidden mt-1.5 border border-indigo-950">
                                <div class="h-full rounded-full transition-all duration-500 ${b.burnBadge === 'rose' ? 'bg-rose-500' : b.burnBadge === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${b.displayPercentage}%;"></div>
                            </div>
                        </div>

                        <div class="pt-2 border-t border-indigo-950/80 flex justify-between items-center text-[10px] text-gray-400">
                            <span>Safe daily:</span>
                            <strong class="text-emerald-400 font-bold convertible-amount" data-kes="${b.safeDailySpend}">${formatKes(b.safeDailySpend)}/d</strong>
                        </div>
                    </div>`).join('')}
                </div>
            </div>
        </div>


        <!-- 🌊 Dynamic Waterfall Auto-Split Card -->
        <div id="waterfall-card" class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-md border border-indigo-800/40 space-y-4">
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
        <div id="mpesa-card" class="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-emerald-500/30 p-6 space-y-4">
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

                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" onclick="pasteSampleMpesa('single')" class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg transition active:scale-95">
                        📋 Sample Received
                    </button>
                    <button type="button" onclick="pasteSampleMpesa('ev')" class="px-2.5 py-1.5 bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 text-cyan-700 dark:text-cyan-300 text-xs font-semibold rounded-lg transition active:scale-95 border border-cyan-200 dark:border-cyan-800">
                        ⚡ Sample EV Swap (Spiro)
                    </button>
                    <button type="button" onclick="pasteSampleMpesa('batch')" class="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-lg transition active:scale-95">
                        📋 Sample Batch (4 SMS)
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

        <!-- 🎯 Savings Goals & Asset Targets Card -->
        <div id="goals-card" class="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-950/30 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 space-y-5">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-indigo-100 dark:border-indigo-900/40 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xl shadow-xs">
                        🎯
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>Savings Goals & Purchase Targets</span>
                            <span class="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">${goals.length} Goals Active</span>
                        </h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Track your progress towards planned assets (Smart TV, Gas Cooker, Living Room Seats) and milestone purchases.</p>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <div class="text-right hidden sm:block">
                        <p class="text-[10px] font-bold text-gray-400 uppercase">Total Saved</p>
                        <p class="text-sm font-black text-indigo-600 dark:text-indigo-400 convertible-amount" data-kes="${totalGoalsSaved}">${formatKes(totalGoalsSaved)} <span class="text-xs font-semibold text-gray-400">/ <span class="convertible-amount" data-kes="${totalGoalsTarget}">${formatKes(totalGoalsTarget)}</span></span></p>
                    </div>
                    <button type="button" onclick="document.getElementById('new-goal-form-container')?.classList.toggle('hidden')" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 active:scale-95">
                        <span>➕ New Goal</span>
                    </button>
                </div>
            </div>

            <!-- Total Goals Progress Bar -->
            <div class="bg-white dark:bg-gray-900 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 w-full sm:w-auto">
                    <span class="text-xs font-black text-indigo-700 dark:text-indigo-300">Overall Milestone:</span>
                    <span class="text-xs font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300">${overallGoalsPercent}% Complete</span>
                </div>
                <div class="w-full sm:flex-1 bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" style="width: ${overallGoalsPercent}%;"></div>
                </div>
                <div class="text-xs text-gray-500 font-semibold text-right w-full sm:w-auto">
                    <span class="convertible-amount font-bold text-indigo-600 dark:text-indigo-400" data-kes="${totalGoalsSaved}">${formatKes(totalGoalsSaved)}</span> of <span class="convertible-amount" data-kes="${totalGoalsTarget}">${formatKes(totalGoalsTarget)}</span>
                </div>
            </div>

            <!-- Create New Goal Collapsible Form -->
            <div id="new-goal-form-container" class="hidden bg-white dark:bg-gray-900 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900 shadow-md space-y-3">
                <div class="flex justify-between items-center border-b dark:border-gray-800 pb-2">
                    <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>➕ Set a New Savings Target</span>
                    </h3>
                    <button type="button" onclick="document.getElementById('new-goal-form-container')?.classList.add('hidden')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">✕</button>
                </div>
                <form action="/goals/create" method="POST" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div class="sm:col-span-2 lg:col-span-1">
                        <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Goal Title</label>
                        <input type="text" name="title" placeholder="e.g. 55&quot; 4K Smart TV, Sofa Seat, Gas Cooker" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-xs font-semibold" required>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Target Amount (<span class="curr-symbol-label">Ksh</span>)</label>
                        <input type="number" step="any" inputmode="decimal" name="target_amount" placeholder="45000" data-placeholder-base="45000" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-xs font-bold convertible-placeholder" required>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Target Deadline (Optional)</label>
                        <input type="date" name="target_date" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-xs font-semibold">
                    </div>
                    <div class="flex flex-col justify-end space-y-2">
                        <label class="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-300">
                            <input type="checkbox" name="add_to_split" value="1" class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                            <span>Add 10% Auto-Split Rule</span>
                        </label>
                        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-xl text-xs transition shadow-xs active:scale-95">
                            Create Goal Target
                        </button>
                    </div>
                </form>
            </div>

            <!-- Goals Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${goals.length > 0 ? goals.map((g: any) => {
                    const target = Number(g.target_amount) || 0;
                    const current = Number(g.current_amount) || 0;
                    const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                    const remaining = Math.max(0, target - current);
                    const icon = getGoalIcon(g.title);

                    return `
                    <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-xs space-y-3 flex flex-col justify-between">
                        <div class="space-y-2.5">
                            <div class="flex justify-between items-start">
                                <div class="flex items-center space-x-2.5">
                                    <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xl shadow-xs shrink-0">
                                        ${icon}
                                    </div>
                                    <div>
                                        <h3 class="font-bold text-gray-900 dark:text-white text-sm leading-snug">${g.title}</h3>
                                        ${g.target_date ? `<span class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded">📅 ${g.target_date}</span>` : '<span class="text-[10px] text-gray-400">Open Goal</span>'}
                                    </div>
                                </div>
                                <div class="flex items-center gap-1">
                                    <form action="/goals/delete/${g.id}" method="POST" onsubmit="return confirm('Delete this savings goal?');">
                                        <button type="submit" title="Delete Goal" class="text-gray-400 hover:text-rose-500 p-1 text-xs transition">✕</button>
                                    </form>
                                </div>
                            </div>

                            <!-- Progress Bar -->
                            <div class="space-y-1">
                                <div class="flex justify-between text-xs items-baseline">
                                    <span class="text-xs font-black text-emerald-600 dark:text-emerald-400 convertible-amount" data-kes="${current}">${formatKes(current)}</span>
                                    <span class="text-[11px] font-bold text-gray-400 convertible-amount" data-kes="${target}">Target: ${formatKes(target)}</span>
                                </div>
                                <div class="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
                                    <div class="h-full rounded-full transition-all duration-500 ${percent >= 100 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500'}" style="width: ${percent}%;"></div>
                                </div>
                                <div class="flex justify-between text-[11px] text-gray-400 font-medium">
                                    <span class="font-bold ${percent >= 100 ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-indigo-600 dark:text-indigo-400'}">${percent}% Completed</span>
                                    <span>Remaining: <strong class="convertible-amount font-bold text-gray-700 dark:text-gray-300" data-kes="${remaining}">${formatKes(remaining)}</strong></span>
                                </div>
                            </div>
                        </div>

                        <!-- Action Buttons & Drawers -->
                        <div class="space-y-2 pt-1 border-t dark:border-gray-800">
                            <div class="grid grid-cols-2 gap-2">
                                <button type="button" onclick="toggleGoalForm('${g.id}', 'fund')" class="w-full py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-lg border border-emerald-200 dark:border-emerald-800/60 transition active:scale-95 flex items-center justify-center gap-1">
                                    <span>➕ Add Funds</span>
                                </button>
                                <button type="button" onclick="toggleGoalForm('${g.id}', 'withdraw')" class="w-full py-1.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-lg border border-gray-200 dark:border-gray-700 transition active:scale-95 flex items-center justify-center gap-1">
                                    <span>➖ Withdraw</span>
                                </button>
                            </div>

                            <!-- Inline Deposit Drawer -->
                            <div id="goal-fund-${g.id}" class="hidden p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl space-y-2">
                                <form action="/goals/fund/${g.id}" method="POST" class="space-y-2">
                                    <div>
                                        <label class="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-0.5">Deposit Amount (<span class="curr-symbol-label">Ksh</span>)</label>
                                        <input type="number" step="any" inputmode="decimal" name="amount" placeholder="500" data-placeholder-base="500" class="w-full p-1.5 border border-emerald-300 dark:border-emerald-700 dark:bg-gray-900 dark:text-white rounded-lg text-xs font-bold convertible-placeholder" required>
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200 mb-0.5">Deduct from Account (Optional)</label>
                                        <select name="account_id" class="w-full p-1.5 border border-emerald-300 dark:border-emerald-700 dark:bg-gray-900 dark:text-white rounded-lg text-xs font-medium">
                                            <option value="">-- No Account Deduction (Direct) --</option>
                                            ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (Bal: ${formatKes(a.balance)})</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="flex gap-2 pt-1">
                                        <button type="submit" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded-lg text-xs transition shadow-2xs active:scale-95">Confirm Deposit</button>
                                        <button type="button" onclick="toggleGoalForm('${g.id}', 'fund')" class="px-2.5 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg text-xs">Cancel</button>
                                    </div>
                                </form>
                            </div>

                            <!-- Inline Withdraw Drawer -->
                            <div id="goal-withdraw-${g.id}" class="hidden p-3 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl space-y-2">
                                <form action="/goals/withdraw/${g.id}" method="POST" class="space-y-2">
                                    <div>
                                        <label class="block text-[11px] font-bold text-rose-900 dark:text-rose-200 mb-0.5">Withdraw Amount (<span class="curr-symbol-label">Ksh</span>)</label>
                                        <input type="number" step="any" inputmode="decimal" name="amount" max="${current}" placeholder="500" data-placeholder-base="500" class="w-full p-1.5 border border-rose-300 dark:border-rose-700 dark:bg-gray-900 dark:text-white rounded-lg text-xs font-bold convertible-placeholder" required>
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold text-rose-900 dark:text-rose-200 mb-0.5">Deposit to Account (Optional)</label>
                                        <select name="account_id" class="w-full p-1.5 border border-rose-300 dark:border-rose-700 dark:bg-gray-900 dark:text-white rounded-lg text-xs font-medium">
                                            <option value="">-- Direct Cash Withdrawal --</option>
                                            ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (Bal: ${formatKes(a.balance)})</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="flex gap-2 pt-1">
                                        <button type="submit" class="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 rounded-lg text-xs transition shadow-2xs active:scale-95">Confirm Withdrawal</button>
                                        <button type="button" onclick="toggleGoalForm('${g.id}', 'withdraw')" class="px-2.5 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg text-xs">Cancel</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>`;
                }).join('') : `
                <div class="md:col-span-3 p-6 text-center bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 space-y-2">
                    <p class="text-3xl">🎯</p>
                    <h4 class="font-bold text-gray-700 dark:text-gray-200">No Savings Goals Active</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Click "➕ New Goal" above to create savings goals for your TV, Gas Cooker, Living Room Seats, etc.!</p>
                </div>`}
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
                            <p class="font-bold text-gray-900 dark:text-white convertible-amount" data-kes="${m.balance}">${formatKes(m.balance)}</p>
                        </div>
                        <div class="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
                            <p class="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Monthly Yield</p>
                            <p class="font-bold text-amber-700 dark:text-amber-400 convertible-amount" data-kes="${m.monthly_return}">${formatKes(m.monthly_return)}</p>
                        </div>
                    </div>
                    <p class="text-[10px] text-gray-400">
                        Daily: <strong class="convertible-amount text-emerald-600 dark:text-emerald-400" data-kes="${m.daily_return}">${formatKes(m.daily_return)}</strong> &nbsp;•&nbsp; Annual: <strong class="convertible-amount" data-kes="${m.annual_return}">${formatKes(m.annual_return)}</strong>
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
                                <p class="font-bold text-xl text-emerald-600 dark:text-emerald-400 convertible-amount" data-kes="${acc.balance}">${formatKes(acc.balance)}</p>
                            </div>
                            <button type="button" onclick="toggleEdit('${acc.id}')" class="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold py-1.5 rounded-lg transition mt-2 active:scale-95">Edit Account</button>
                        </div>

                        <div id="acc-edit-${acc.id}" class="hidden space-y-2">
                            <form action="/accounts/update/${acc.id}" method="POST" onsubmit="return onAccountEditSubmit(this)" class="space-y-2">
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
                                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Balance (<span class="curr-symbol-label">Ksh</span>)</label>
                                    <input type="number" step="any" inputmode="decimal" name="balance" value="${acc.balance}" data-kes="${acc.balance}" class="w-full p-1.5 border dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded text-xs convertible-input" required>
                                </div>
                                <div class="flex space-x-2 pt-1">
                                    <button type="submit" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-1 rounded text-xs font-semibold active:scale-95">Save</button>
                                    <button type="button" onclick="toggleEdit('${acc.id}')" class="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 text-gray-700 dark:text-gray-200 py-1 rounded text-xs active:scale-95">Cancel</button>
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
                    <input type="text" name="name" placeholder="Account Name (e.g. M-Pesa, Ziidi MMF)" class="p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-base sm:text-sm" required>
                    <input type="text" name="account_number" placeholder="Account / Phone / Till No." class="p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-base sm:text-sm">
                    <select name="account_type" class="p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-base sm:text-sm">
                        <option value="MOBILE">Mobile Money (M-Pesa, Airtel)</option>
                        <option value="BANK">Bank Account</option>
                        <option value="SAVINGS">Savings Account (Sacco / Fixed)</option>
                        <option value="MMF">Money Market Fund (MMF)</option>
                        <option value="LOOP">Loop Business</option>
                        <option value="CASH">Cash / Petty Cash</option>
                    </select>
                    <input type="number" step="any" inputmode="decimal" name="interest_rate_p_a" placeholder="APY % (e.g. 13.45)" class="p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-base sm:text-sm">
                    <input type="number" step="any" inputmode="decimal" name="balance" placeholder="Initial Balance" data-placeholder-base="Initial Balance" class="p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-base sm:text-sm convertible-placeholder" required>
                    <div class="sm:col-span-2 lg:col-span-5">
                        <button type="submit" class="w-full bg-gray-900 dark:bg-gray-700 hover:bg-black dark:hover:bg-gray-600 text-white text-sm font-semibold py-2.5 rounded-xl transition">Add Account</button>
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
                            <select name="from_account_id" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-base sm:text-sm" required>
                                ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">To Account</label>
                            <select name="to_account_id" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-base sm:text-sm" required>
                                ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Amount (<span class="curr-symbol-label">Ksh</span>)</label>
                            <input type="number" step="any" inputmode="decimal" name="amount" placeholder="0.00" data-placeholder-base="0.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-base sm:text-sm convertible-placeholder" required>
                        </div>
                        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-sm transition mt-2">Transfer Funds</button>
                    </form>
                </div>
            </div>
        </div>

        <!-- ➕ Transactions & Ledger Card -->
        <div id="tx-card" class="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-xl">
                        💳
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white">Record Transaction</h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Manually log an income or expense into your ledger.</p>
                    </div>
                </div>
            </div>

            <!-- Add Tx Form -->
            <form action="/transactions/create" method="POST" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
                    <select name="transaction_type" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-base sm:text-sm font-semibold">
                        <option value="EXPENSE">🔴 Expense</option>
                        <option value="INCOME">🟢 Income</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Account</label>
                    <select name="account_id" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-base sm:text-sm font-semibold">
                        <option value="">-- No Account / Cash --</option>
                        ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Category</label>
                    <select name="category" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-base sm:text-sm font-semibold">
                        <option value="Living Expenses">Living Expenses</option>
                        <option value="Food & Groceries">Food & Groceries</option>
                        <option value="Fuel & Petrol">Fuel & Petrol</option>
                        <option value="Utilities & Bills">Utilities & Bills</option>
                        <option value="Rider & Boda Deliveries">Rider & Boda Deliveries</option>
                        <option value="M-Pesa Income">M-Pesa Income</option>
                        <option value="MMF Interest">MMF Interest</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Amount (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" inputmode="decimal" name="amount" placeholder="0.00" data-placeholder-base="0.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-base sm:text-sm font-bold convertible-placeholder" required>
                </div>
                <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
                    <input type="date" name="t_date" value="${today}" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-base sm:text-sm font-semibold" required>
                </div>
                <div class="flex items-end">
                    <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition shadow-xs active:scale-95">
                        ➕ Save Tx
                    </button>
                </div>
            </form>

            <!-- Recent Transactions Table -->
            <div class="pt-4 border-t dark:border-gray-800 space-y-2">
                <h3 class="text-sm font-bold text-gray-800 dark:text-gray-200">Recent Transactions (${transactions.length})</h3>
                <div class="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-gray-50 dark:bg-gray-800/60 uppercase text-gray-400 text-[10px]">
                            <tr>
                                <th class="py-3 px-3">Date</th>
                                <th class="py-3 px-3">Type</th>
                                <th class="py-3 px-3">Category</th>
                                <th class="py-3 px-3">Amount</th>
                                <th class="py-3 px-3 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y dark:divide-gray-800">
                            ${transactions.length > 0 ? transactions.slice(0, 15).map((t: any) => `
                            <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                                <td class="py-2.5 px-3 font-medium text-gray-600 dark:text-gray-300">${t.date}</td>
                                <td class="py-2.5 px-3">
                                    <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${t.transaction_type === 'INCOME' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'}">
                                        ${t.transaction_type}
                                    </span>
                                </td>
                                <td class="py-2.5 px-3 font-medium text-gray-800 dark:text-gray-200">${t.category}</td>
                                <td class="py-2.5 px-3 font-bold ${t.transaction_type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} convertible-amount" data-kes="${t.amount}" data-prefix="${t.transaction_type === 'INCOME' ? '+' : '-'}">
                                    ${t.transaction_type === 'INCOME' ? '+' : '-'}${formatKes(t.amount)}
                                </td>
                                <td class="py-2.5 px-3 text-center">
                                    <form action="/transactions/delete/${t.id}" method="POST" onsubmit="return confirm('Delete transaction?');">
                                        <button type="submit" class="text-rose-500 hover:text-rose-700 font-bold text-xs p-1">✕</button>
                                    </form>
                                </td>
                            </tr>`).join('') : `
                            <tr>
                                <td colspan="5" class="py-6 text-center text-gray-400">No transactions recorded yet. Use the form above or the M-Pesa SMS auto-parser!</td>
                            </tr>`}
                        </tbody>
                    </table>
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
                    <button type="submit" class="px-4 py-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 active:scale-95">
                        <span>🗑️ Reset & Clear All Data</span>
                    </button>
                </form>
            </div>
        </div>

    </main>

    <!-- ⚙️ Waterfall Split Rules Settings Modal -->
    <div id="rules-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
        <div class="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-gray-800 space-y-4">
            <div class="flex justify-between items-center border-b dark:border-gray-800 pb-3">
                <div class="flex items-center space-x-2">
                    <span class="text-2xl">⚙️</span>
                    <h3 class="font-bold text-gray-900 dark:text-white text-base">Waterfall Split Allocation Rules</h3>
                </div>
                <button onclick="document.getElementById('rules-modal').classList.add('hidden')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Configure how your daily income is split automatically across buckets (total should equal 100%).</p>
            <form action="/rules/update" method="POST" class="space-y-3">
                ${allocation_rules.map((r: any) => `
                <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div class="flex items-center space-x-2">
                        <span class="text-lg">${r.icon || '💰'}</span>
                        <span class="text-xs font-bold text-gray-800 dark:text-gray-200">${r.bucket_name}</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <input type="number" step="1" min="0" max="100" inputmode="numeric" name="percentage_${r.id}" value="${r.percentage}" class="w-16 p-2 text-base sm:text-sm font-bold text-center border dark:border-gray-700 dark:bg-gray-900 rounded-lg" required>
                        <span class="text-xs font-bold text-gray-500">%</span>
                    </div>
                </div>`).join('')}
                <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-xs mt-2 active:scale-95">
                    Save Allocation Rules
                </button>
            </form>
        </div>
    </div>

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
            <button onclick="document.getElementById('ios-install-modal').classList.add('hidden')" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition active:scale-95">Got it!</button>
        </div>
    </div>

    <!-- 📱 Native Mobile Bottom App Dock -->
    <nav class="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800/80 px-4 py-2 flex justify-around items-center sm:hidden shadow-lg safe-area-bottom">
        <a href="/" class="flex flex-col items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold active:scale-90 transition-transform">
            <span class="text-xl">⚡</span>
            <span class="text-[10px] tracking-tight">Finance</span>
        </a>
        <a href="/rider" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-blue-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">🛵</span>
            <span class="text-[10px] tracking-tight">Rider</span>
        </a>
        <a href="#mpesa-card" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-emerald-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">📲</span>
            <span class="text-[10px] tracking-tight">M-Pesa</span>
        </a>
        <a href="#waterfall-card" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-indigo-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">🌊</span>
            <span class="text-[10px] tracking-tight">Split</span>
        </a>
        <a href="/login" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-pink-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">🔑</span>
            <span class="text-[10px] tracking-tight">Account</span>
        </a>
    </nav>
</body>
</html>`;
}
