import { sortTransactionsLatestFirst, calculateWeeklyScorecard, calculateTurnoverTax, isTransferTransaction } from '../utils/math';

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
    runway_status = {
      liquidBalance: 0,
      monthlyBurn: 25000,
      months: 0.0,
      displayMonths: '0.0 mo',
      goalMonths: 6.0,
      percentageOfGoal: 0,
      statusLabel: '🛡️ Building Runway',
      statusBadge: 'amber',
      statusColor: 'text-amber-600 dark:text-amber-400',
      advice: 'Allocate daily waterfall savings into high-yield MMFs to build a 3-6 month safety cushion.',
    },
    health_score = {
      totalScore: 85,
      grade: 'A',
      tierLabel: '🛡️ Robust Financial Shield',
      badgeClass: 'bg-emerald-600 text-white font-black shadow-sm',
      pillarScores: {
        runway: { score: 20, max: 25, label: 'Emergency Runway', detail: '3.0 Months' },
        debt: { score: 25, max: 25, label: 'Debt Health', detail: '0 Debt' },
        incomeTarget: { score: 20, max: 25, label: 'Income Target Pace', detail: '80% Met' },
        budgetDiscipline: { score: 20, max: 25, label: 'Budget Discipline', detail: '75% Burn' },
      },
      recommendations: ['Keep compounding passive yields and stay within monthly expense limits.'],
    },
    ev_roi_stats = {
      totalKm: 0,
      evKm: 0,
      petrolKm: 0,
      actualSpent: 0,
      petrolEquivalentCost: 0,
      netSavingsKes: 0,
      costPerKmActual: 0,
      costPerKmPetrol: 4.50,
      costPerKmEv: 1.80,
      co2SavedKg: 0,
      savingsPercentage: 0,
    },
    unified_timeline = [],
    category_breakdown = [],
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

  const scorecard = data.weekly_scorecard || calculateWeeklyScorecard(transactions);
  const totTax = data.turnover_tax || calculateTurnoverTax(monthly_income);

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

  const getCategoryTheme = (cat: string) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('fuel') || c.includes('petrol')) return { bg: 'bg-amber-500', text: 'text-amber-500', hex: '#f59e0b', icon: '⛽' };
    if (c.includes('ev') || c.includes('battery') || c.includes('swap')) return { bg: 'bg-cyan-500', text: 'text-cyan-500', hex: '#06b6d4', icon: '⚡' };
    if (c.includes('food') || c.includes('grocer')) return { bg: 'bg-emerald-500', text: 'text-emerald-500', hex: '#10b981', icon: '🛒' };
    if (c.includes('utilit') || c.includes('bill') || c.includes('kplc')) return { bg: 'bg-blue-500', text: 'text-blue-500', hex: '#3b82f6', icon: '💡' };
    if (c.includes('maint') || c.includes('bike') || c.includes('repair')) return { bg: 'bg-purple-500', text: 'text-purple-500', hex: '#a855f7', icon: '🔧' };
    if (c.includes('debt') || c.includes('loan')) return { bg: 'bg-rose-500', text: 'text-rose-500', hex: '#f43f5e', icon: '💳' };
    if (c.includes('rider') || c.includes('boda') || c.includes('deliver')) return { bg: 'bg-teal-500', text: 'text-teal-500', hex: '#14b8a6', icon: '🛵' };
    return { bg: 'bg-indigo-500', text: 'text-indigo-500', hex: '#6366f1', icon: '🏠' };
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

  // Master Holding Vault Account for Savings Goals (Discipline & Sub-Splits)
  const goalAllocationRule = (allocation_rules || []).find((r: any) => r.target_type === 'GOAL' || r.bucket_name?.toLowerCase().includes('goal'));
  let masterVaultAccount = (accounts || []).find((a: any) => a.id === goalAllocationRule?.target_id);
  if (!masterVaultAccount && (goals || []).some((g: any) => g.account_id)) {
    const linkedId = (goals || []).find((g: any) => g.account_id)?.account_id;
    masterVaultAccount = (accounts || []).find((a: any) => a.id === linkedId);
  }
  if (!masterVaultAccount) {
    masterVaultAccount = (accounts || []).find((a: any) =>
      a.account_type === 'SAVINGS' ||
      a.name.toLowerCase().includes('lock') ||
      a.name.toLowerCase().includes('sacco') ||
      a.name.toLowerCase().includes('save')
    ) || (accounts || []).find((a: any) => a.account_type === 'MMF') || accounts[0];
  }

  const masterVaultBalance = masterVaultAccount ? Number(masterVaultAccount.balance || 0) : 0;
  const vaultReconciled = masterVaultBalance >= totalGoalsSaved;
  const vaultBuffer = masterVaultBalance - totalGoalsSaved;

  const borrowedDebts = (debts || []).filter((d: any) => d.debt_type === 'I_OWE');
  const lentDebts = (debts || []).filter((d: any) => d.debt_type !== 'I_OWE');
  const totalBorrowedBalance = borrowedDebts.reduce((sum: number, d: any) => sum + (Number(d.remaining) || (Number(d.total_amount || 0) - Number(d.paid_amount || 0))), 0);
  const totalLentBalance = lentDebts.reduce((sum: number, d: any) => sum + (Number(d.remaining) || (Number(d.total_amount || 0) - Number(d.paid_amount || 0))), 0);
  const dangerDebts = (debts || []).filter((d: any) => d.danger_status?.isDangerZone && !d.is_settled);
  const dangerCount = dangerDebts.length;

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

        function recalcGoalSubSplitsTotal() {
            let total = 0;
            document.querySelectorAll('.goal-split-input').forEach(inp => {
                total += parseFloat(inp.value || '0') || 0;
            });
            total = Math.round(total * 10) / 10;
            const badge = document.getElementById('goal-splits-total-badge');
            const totalText = document.getElementById('goal-splits-total-val');
            if (totalText) totalText.textContent = total + '%';
            if (badge) {
                if (Math.abs(total - 100) < 0.1) {
                    badge.className = 'px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
                    badge.textContent = '✅ Exactly 100%';
                } else {
                    badge.className = 'px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
                    badge.textContent = total < 100 ? ('⚠️ ' + total + '% of 100% (' + (100 - total).toFixed(1) + '% remaining)') : ('⚠️ ' + total + '% (Exceeds 100%)');
                }
            }
        }

        function saveGoalSplitsLocally(e) {
            try {
                const inputs = Array.from(document.querySelectorAll('.goal-split-input'));
                const map = {};
                inputs.forEach(inp => {
                    const name = inp.getAttribute('name') || '';
                    const id = name.replace('split_', '');
                    if (id) {
                        map[id] = parseFloat(inp.value || '0') || 0;
                    }
                });
                document.cookie = "finatrack_goal_splits=" + encodeURIComponent(JSON.stringify(map)) + ";path=/;max-age=31536000;SameSite=Lax";
            } catch (err) {
                console.warn('Error saving goal splits locally:', err);
            }
        }

        function distributeGoalSplitsEvenly() {
            const inputs = Array.from(document.querySelectorAll('.goal-split-input'));
            if (inputs.length === 0) return;
            const count = inputs.length;
            const basePct = Math.floor((100 / count) * 10) / 10;
            let sum = 0;
            inputs.forEach((inp, idx) => {
                if (idx === count - 1) {
                    inp.value = Math.max(0, Math.round((100 - sum) * 10) / 10).toFixed(1);
                } else {
                    inp.value = basePct.toFixed(1);
                    sum = Math.round((sum + basePct) * 10) / 10;
                }
            });
            recalcGoalSubSplitsTotal();
            saveGoalSplitsLocally();
        }

        function distributeGoalSplitsProportional() {
            const inputs = Array.from(document.querySelectorAll('.goal-split-input'));
            if (inputs.length === 0) return;
            const remainings = inputs.map(inp => Math.max(0, parseFloat(inp.getAttribute('data-remaining') || '0') || 0));
            const totalRemaining = remainings.reduce((a, b) => a + b, 0);
            if (totalRemaining <= 0) {
                distributeGoalSplitsEvenly();
                return;
            }
            let sum = 0;
            inputs.forEach((inp, idx) => {
                if (idx === inputs.length - 1) {
                    inp.value = Math.max(0, Math.round((100 - sum) * 10) / 10).toFixed(1);
                } else {
                    const pct = Math.round(((remainings[idx] / totalRemaining) * 100) * 10) / 10;
                    inp.value = pct.toFixed(1);
                    sum = Math.round((sum + pct) * 10) / 10;
                }
            });
            recalcGoalSubSplitsTotal();
            saveGoalSplitsLocally();
        }

        var txCurrentPage = 1;
        var txPageSize = 5;
        var txCurrentFilter = 'ALL';

        function setTxFilter(type) {
            txCurrentFilter = type;
            txCurrentPage = 1;
            document.querySelectorAll('.tx-filter-btn').forEach(function(b) {
                b.className = 'tx-filter-btn px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer';
            });
            var activeBtn = document.getElementById('tx-filter-btn-' + type);
            if (activeBtn) {
                activeBtn.className = 'tx-filter-btn px-2.5 py-1 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs font-bold transition cursor-pointer';
            }
            applyTxDisplay();
        }

        function txGoToPage(p) {
            txCurrentPage = p;
            applyTxDisplay();
            var card = document.getElementById('tx-card');
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function txPrevPage() {
            if (txCurrentPage > 1) {
                txGoToPage(txCurrentPage - 1);
            }
        }

        function txNextPage() {
            var mobileItems = document.querySelectorAll('.tx-mobile-item');
            var matchingTotal = 0;
            mobileItems.forEach(function(el) {
                var itemType = el.getAttribute('data-tx-type');
                if (txCurrentFilter === 'ALL' || itemType === txCurrentFilter) {
                    matchingTotal++;
                }
            });
            var totalPages = Math.max(1, Math.ceil(matchingTotal / txPageSize));
            if (txCurrentPage < totalPages) {
                txGoToPage(txCurrentPage + 1);
            }
        }

        function applyTxDisplay() {
            var mobileItems = document.querySelectorAll('.tx-mobile-item');
            var desktopItems = document.querySelectorAll('.tx-desktop-item');
            var matchingTotal = 0;

            mobileItems.forEach(function(el) {
                var itemType = el.getAttribute('data-tx-type');
                if (txCurrentFilter === 'ALL' || itemType === txCurrentFilter) {
                    matchingTotal++;
                }
            });

            var totalPages = Math.max(1, Math.ceil(matchingTotal / txPageSize));
            if (txCurrentPage > totalPages) {
                txCurrentPage = totalPages;
            }
            if (txCurrentPage < 1) {
                txCurrentPage = 1;
            }

            var startIdx = (txCurrentPage - 1) * txPageSize;
            var endIdx = startIdx + txPageSize;

            var mIdx = 0;
            mobileItems.forEach(function(el) {
                var itemType = el.getAttribute('data-tx-type');
                if (txCurrentFilter === 'ALL' || itemType === txCurrentFilter) {
                    if (mIdx >= startIdx && mIdx < endIdx) {
                        el.classList.remove('hidden');
                    } else {
                        el.classList.add('hidden');
                    }
                    mIdx++;
                } else {
                    el.classList.add('hidden');
                }
            });

            var dIdx = 0;
            desktopItems.forEach(function(el) {
                var itemType = el.getAttribute('data-tx-type');
                if (txCurrentFilter === 'ALL' || itemType === txCurrentFilter) {
                    if (dIdx >= startIdx && dIdx < endIdx) {
                        el.classList.remove('hidden');
                    } else {
                        el.classList.add('hidden');
                    }
                    dIdx++;
                } else {
                    el.classList.add('hidden');
                }
            });

            var startDisplay = matchingTotal === 0 ? 0 : startIdx + 1;
            var endDisplay = Math.min(endIdx, matchingTotal);

            var rangeEl = document.getElementById('tx-visible-range');
            if (rangeEl) rangeEl.innerText = startDisplay + '–' + endDisplay;

            var totalEl = document.getElementById('tx-total-filtered-count');
            if (totalEl) totalEl.innerText = String(matchingTotal);

            var pageInfoEl = document.getElementById('tx-page-info');
            if (pageInfoEl) pageInfoEl.innerText = 'Page ' + txCurrentPage + ' of ' + totalPages;

            var prevBtn = document.getElementById('tx-prev-btn');
            if (prevBtn) {
                if (txCurrentPage <= 1) {
                    prevBtn.disabled = true;
                    prevBtn.classList.add('opacity-40', 'cursor-not-allowed');
                } else {
                    prevBtn.disabled = false;
                    prevBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                }
            }

            var nextBtn = document.getElementById('tx-next-btn');
            if (nextBtn) {
                if (txCurrentPage >= totalPages) {
                    nextBtn.disabled = true;
                    nextBtn.classList.add('opacity-40', 'cursor-not-allowed');
                } else {
                    nextBtn.disabled = false;
                    nextBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                }
            }

            var paginationContainer = document.getElementById('tx-pagination-controls');
            if (paginationContainer) {
                if (matchingTotal <= txPageSize) {
                    paginationContainer.classList.add('hidden');
                } else {
                    paginationContainer.classList.remove('hidden');
                }
            }

            var pagesContainer = document.getElementById('tx-pagination-pages');
            if (pagesContainer) {
                var html = '';
                for (var p = 1; p <= totalPages; p++) {
                    var isActive = p === txCurrentPage;
                    html += '<button type="button" onclick="txGoToPage(' + p + ')" class="w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ' +
                        (isActive ? 'bg-emerald-600 text-white shadow-xs' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700') + '">' + p + '</button>';
                }
                pagesContainer.innerHTML = html;
            }
        }

        function updateVaultDepositPreview() {
            const amt = parseFloat(document.getElementById('vault-deposit-amt-input')?.value || '0') || 0;
            const previewContainer = document.getElementById('vault-deposit-live-preview');
            if (!previewContainer) return;
            if (amt <= 0) {
                previewContainer.classList.add('hidden');
                return;
            }
            previewContainer.classList.remove('hidden');
            const items = Array.from(document.querySelectorAll('.vault-deposit-item'));
            items.forEach(item => {
                const pct = parseFloat(item.getAttribute('data-split-pct') || '0') || 0;
                const goalAmt = (amt * (pct / 100));
                const kesSpan = item.querySelector('.vault-deposit-item-amt');
                if (kesSpan) {
                    kesSpan.textContent = 'Ksh ' + goalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
            });
        }

        function updateSaccoProjection() {
            const capital = parseFloat(document.getElementById('sacco-initial-capital')?.value || '0') || 0;
            const monthly = parseFloat(document.getElementById('sacco-monthly-deposit')?.value || '0') || 0;
            const ratePct = parseFloat(document.getElementById('sacco-rate-pct')?.value || '12') || 12;

            const rate = ratePct / 100;
            const year1Capital = capital + (monthly * 12);
            const avgCapital = capital + (monthly * 6);
            const annualDiv = avgCapital * rate;
            const monthlyDiv = annualDiv / 12;

            let compound3Yr = capital;
            for (let yr = 1; yr <= 3; yr++) {
                const avg = compound3Yr + (monthly * 6);
                const div = avg * rate;
                compound3Yr = compound3Yr + (monthly * 12) + div;
            }

            const curr = getCurrency();
            const formatVal = (kes) => {
                if (curr === 'USD') return '$' + (kes / USD_TO_KES).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                return 'Ksh ' + kes.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            };

            const yr1El = document.getElementById('sacco-yr1-capital');
            if (yr1El) { yr1El.setAttribute('data-kes', year1Capital); yr1El.textContent = formatVal(year1Capital); }

            const annEl = document.getElementById('sacco-annual-dividend');
            if (annEl) { annEl.setAttribute('data-kes', annualDiv); annEl.textContent = formatVal(annualDiv); }

            const monEl = document.getElementById('sacco-monthly-dividend');
            if (monEl) { monEl.setAttribute('data-kes', monthlyDiv); monEl.textContent = formatVal(monthlyDiv); }

            const compEl = document.getElementById('sacco-3yr-compound');
            if (compEl) { compEl.setAttribute('data-kes', compound3Yr); compEl.textContent = formatVal(compound3Yr); }
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

        function toggleDebtForm(id) {
            const el = document.getElementById('debt-repay-' + id);
            if (el) el.classList.toggle('hidden');
        }

        function switchDebtTab(filter) {
            ['all', 'borrowed', 'lent', 'danger'].forEach(tab => {
                const btn = document.getElementById('debt-tab-btn-' + tab);
                if (btn) {
                    if (tab === filter) {
                        btn.className = 'debt-tab-btn px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs bg-indigo-600 text-white';
                    } else {
                        btn.className = 'debt-tab-btn px-3 py-1.5 rounded-xl text-xs font-bold transition bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700';
                    }
                }
            });

            document.querySelectorAll('.debt-card-item').forEach(card => {
                const isBorrowed = card.getAttribute('data-debt-type') === 'I_OWE';
                const isDanger = card.getAttribute('data-is-danger') === 'true';

                if (filter === 'all') {
                    card.classList.remove('hidden');
                } else if (filter === 'borrowed') {
                    if (isBorrowed) card.classList.remove('hidden'); else card.classList.add('hidden');
                } else if (filter === 'lent') {
                    if (!isBorrowed) card.classList.remove('hidden'); else card.classList.add('hidden');
                } else if (filter === 'danger') {
                    if (isDanger) card.classList.remove('hidden'); else card.classList.add('hidden');
                }
            });
        }



        function updateThemeIcon() {
            const isDark = document.documentElement.classList.contains('dark');
            const btns = document.querySelectorAll('.dark-mode-toggle-btn');
            btns.forEach(btn => {
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
            const theme = localStorage.getItem('theme');
            if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            updateThemeIcon();
            applyConversion();
            updateSplitBreakdown();
            updateRulesModalTotal();
            if (!isRunningStandalone()) {
                showInstallUi();
            }
        });

        function openRulesModal() {
            const m = document.getElementById('rules-modal');
            if (m) {
                m.classList.remove('hidden');
                updateRulesModalTotal();
            }
        }

        function updateRulesModalTotal() {
            let total = 0;
            document.querySelectorAll('.rule-pct-input').forEach(input => {
                total += parseFloat(input.value) || 0;
            });
            const totalEl = document.getElementById('rules-modal-total');
            const barEl = document.getElementById('rules-modal-bar');
            const badgeEl = document.getElementById('rules-modal-badge');
            if (totalEl) totalEl.innerText = total.toFixed(0) + '%';
            if (barEl) {
                barEl.style.width = Math.min(100, Math.max(0, total)) + '%';
                if (total === 100) {
                    barEl.className = 'h-full rounded-full transition-all duration-300 bg-emerald-500';
                } else if (total < 100) {
                    barEl.className = 'h-full rounded-full transition-all duration-300 bg-amber-500';
                } else {
                    barEl.className = 'h-full rounded-full transition-all duration-300 bg-rose-500';
                }
            }
            if (badgeEl) {
                if (total === 100) {
                    badgeEl.className = 'px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
                    badgeEl.innerText = '✅ 100% (Balanced)';
                } else if (total < 100) {
                    const diff = 100 - total;
                    badgeEl.className = 'px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800';
                    badgeEl.innerText = '⚠️ ' + diff.toFixed(0) + '% unallocated';
                } else {
                    const diff = total - 100;
                    badgeEl.className = 'px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800';
                    badgeEl.innerText = '🚨 Exceeds by ' + diff.toFixed(0) + '%';
                }
            }
        }

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

        function onTxCategoryChange(val) {
            const container = document.getElementById('custom-category-container');
            const input = document.getElementById('tx-custom-category');
            if (container) {
                if (val === 'Other') {
                    container.classList.remove('hidden');
                    if (input) input.focus();
                } else {
                    container.classList.add('hidden');
                }
            }
        }

        let _mpesaParsedList = [];

        async function parseMpesaClient() {
            var input = document.getElementById('mpesa-batch-input');
            var raw = input ? input.value : '';
            if (!raw.trim()) {
                alert('Please paste at least one M-Pesa or Kenyan Bank SMS message.');
                return;
            }

            var previewDiv = document.getElementById('mpesa-preview-area');
            var tableBody = document.getElementById('mpesa-preview-tbody');
            var countBadge = document.getElementById('mpesa-parsed-count');
            var importBtn = document.getElementById('mpesa-import-submit-btn');

            if (previewDiv) previewDiv.classList.remove('hidden');
            if (countBadge) countBadge.innerHTML = '<span class="text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">⏳ Analyzing & extracting transactions...</span>';

            var txList = [];
            try {
                var formData = new FormData();
                formData.append('raw_sms', raw);

                var response = await fetch('/finance/mpesa/parse', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    var data = await response.json();
                    if (data && data.success && Array.isArray(data.transactions) && data.transactions.length > 0) {
                        txList = data.transactions;
                    }
                }
            } catch (fetchErr) {
                console.warn('Network parse error:', fetchErr);
            }

            if (txList.length === 0) {
                _mpesaParsedList = [];
                if (countBadge) countBadge.innerText = '0 SMS Extracted';
                if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" class="py-4 text-center text-xs text-rose-500 font-bold">No standard M-Pesa or Bank SMS formats detected. Please ensure message contains transaction code and amount (KES/Ksh).</td></tr>';
                if (importBtn) importBtn.setAttribute('disabled', 'true');
                return;
            }

            _mpesaParsedList = txList.map(function(tx, idx) {
                return {
                    id: idx,
                    selected: true,
                    code: tx.code || ('TX' + idx),
                    type: tx.type || 'EXPENSE',
                    amount: Number(tx.amount_kes || tx.amount || 0),
                    party: tx.party || tx.counterparty || 'Counterparty',
                    date: tx.date || new Date().toISOString().slice(0, 10),
                    time: tx.time || '',
                    category: tx.suggested_category || tx.category || 'Living Expenses',
                    description: tx.description || ('SMS #' + (tx.code || idx))
                };
            });

            renderMpesaReviewTable();
        }

        function renderMpesaReviewTable() {
            var tableBody = document.getElementById('mpesa-preview-tbody');
            var countBadge = document.getElementById('mpesa-parsed-count');
            var importBtn = document.getElementById('mpesa-import-submit-btn');
            var reviewedInput = document.getElementById('mpesa-reviewed-json');

            if (!tableBody) return;

            var categories = [
                'Rider & Boda Deliveries',
                'Fuel & Petrol',
                'EV Battery Swap & Charging',
                'Vehicle Maintenance',
                'Utilities & Bills',
                'Food & Groceries',
                'Living Expenses',
                'Airtime & Internet',
                'Bank Deposit & Inflow',
                'Salary & Income',
                'M-Pesa Income',
                'Other'
            ];

            var selectedItems = _mpesaParsedList.filter(function(t) { return t.selected; });
            var totalIn = 0;
            var totalOut = 0;
            selectedItems.forEach(function(t) {
                if (t.type === 'INCOME') totalIn += t.amount;
                else totalOut += t.amount;
            });

            if (countBadge) {
                var badgeHtml = '<span class="font-extrabold text-emerald-600 dark:text-emerald-400">' + selectedItems.length + ' of ' + _mpesaParsedList.length + ' SMS Selected</span>';
                if (totalIn > 0 || totalOut > 0) {
                    badgeHtml += '<span class="ml-2 font-medium text-gray-500 dark:text-gray-400">(';
                    if (totalIn > 0) badgeHtml += '<span class="text-emerald-600 font-bold">+Ksh ' + totalIn.toLocaleString(undefined, {minimumFractionDigits: 2}) + '</span> ';
                    if (totalOut > 0) badgeHtml += '<span class="text-rose-600 font-bold">-Ksh ' + totalOut.toLocaleString(undefined, {minimumFractionDigits: 2}) + '</span>';
                    badgeHtml += ')</span>';
                }
                countBadge.innerHTML = badgeHtml;
            }

            if (_mpesaParsedList.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="8" class="py-4 text-center text-xs text-gray-400">No transactions to display.</td></tr>';
                if (importBtn) importBtn.setAttribute('disabled', 'true');
                if (reviewedInput) reviewedInput.value = '';
                return;
            }

            if (importBtn) {
                importBtn.removeAttribute('disabled');
                importBtn.innerHTML = '<span>📥 1-Tap Import (' + selectedItems.length + ') to Ledger</span>';
            }

            if (reviewedInput) {
                reviewedInput.value = JSON.stringify(selectedItems.map(function(t) {
                    return {
                        code: t.code,
                        type: t.type,
                        amount_kes: t.amount,
                        suggested_category: t.category,
                        category: t.category,
                        party: t.party,
                        description: t.description,
                        date: t.date,
                        time: t.time
                    };
                }));
            }

            tableBody.innerHTML = _mpesaParsedList.map(function(r, idx) {
                var typeClass = r.type === 'INCOME' 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' 
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300';
                
                var catOptions = categories.map(function(c) {
                    return '<option value="' + c + '" ' + (c === r.category ? 'selected' : '') + '>' + c + '</option>';
                }).join('');

                var rowClass = r.selected ? '' : 'opacity-40 line-through';

                return '<tr class="border-b border-gray-100 dark:border-gray-800 text-xs transition ' + rowClass + '">' +
                    '<td class="py-2.5 px-3 text-center">' +
                        '<input type="checkbox" onchange="toggleMpesaItem(' + idx + ', this.checked)" ' + (r.selected ? 'checked' : '') + ' class="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer">' +
                    '</td>' +
                    '<td class="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">#' + r.code + '</td>' +
                    '<td class="py-2.5 px-3 whitespace-nowrap text-gray-600 dark:text-gray-300">' + r.date + (r.time ? ' ' + r.time : '') + '</td>' +
                    '<td class="py-2.5 px-3 whitespace-nowrap"><span class="px-2 py-0.5 rounded-full font-bold text-[10px] ' + typeClass + '">' + r.type + '</span></td>' +
                    '<td class="py-2.5 px-3 font-medium max-w-[150px] truncate" title="' + r.party + '">' + r.party + '</td>' +
                    '<td class="py-2.5 px-3 font-bold text-gray-900 dark:text-white whitespace-nowrap">Ksh ' + r.amount.toLocaleString(undefined, {minimumFractionDigits: 2}) + '</td>' +
                    '<td class="py-2.5 px-3">' +
                        '<select onchange="updateMpesaCategory(' + idx + ', this.value)" class="text-xs p-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white">' +
                            catOptions +
                        '</select>' +
                    '</td>' +
                    '<td class="py-2.5 px-2 text-center">' +
                        '<button type="button" onclick="removeMpesaItem(' + idx + ')" class="text-gray-400 hover:text-rose-500 font-bold transition px-1" title="Remove transaction">✕</button>' +
                    '</td>' +
                '</tr>';
            }).join('');
        }

        function toggleMpesaItem(idx, checked) {
            if (_mpesaParsedList[idx]) {
                _mpesaParsedList[idx].selected = checked;
                renderMpesaReviewTable();
            }
        }

        function updateMpesaCategory(idx, cat) {
            if (_mpesaParsedList[idx]) {
                _mpesaParsedList[idx].category = cat;
                var reviewedInput = document.getElementById('mpesa-reviewed-json');
                if (reviewedInput) {
                    var selectedItems = _mpesaParsedList.filter(function(t) { return t.selected; });
                    reviewedInput.value = JSON.stringify(selectedItems.map(function(t) {
                        return {
                            code: t.code,
                            type: t.type,
                            amount_kes: t.amount,
                            suggested_category: t.category,
                            category: t.category,
                            party: t.party,
                            description: t.description,
                            date: t.date,
                            time: t.time
                        };
                    }));
                }
            }
        }

        function removeMpesaItem(idx) {
            _mpesaParsedList.splice(idx, 1);
            renderMpesaReviewTable();
        }

        function toggleAllMpesaReview(checked) {
            _mpesaParsedList.forEach(function(t) { t.selected = checked; });
            renderMpesaReviewTable();
        }

        function pasteSampleMpesa(type) {
            var input = document.getElementById('mpesa-batch-input');
            if (!input) return;
            var nl = String.fromCharCode(10);
            var samples = {
                single: 'QA12345678 Confirmed. Ksh1,500.00 received from JOHN DOE 0712345678 on 12/9/26 at 11:30 AM. New M-PESA balance is Ksh5,400.00. Transaction cost, Ksh0.00.',
                ev: 'QD44444444 Confirmed. Ksh400.00 paid to SPIRO BATTERY SWAP on 12/9/26 at 4:30 PM. New M-PESA balance is Ksh5,320.00.',
                bank: [
                    'Dear Customer, your A/C *******1234 has been credited with KES 4,500.00 on 22/09/2026 10:30:15 from BOLT OPERATIONS Ref: BQD7654321. Available Bal: KES 18,200.00.',
                    'Confirmed. Ksh 5,000.00 received from UBER B.V on 22/09/2026 at 09:15 AM. Ref: KCB123456. New balance is Ksh 22,000.00.',
                    'Dear Customer, your A/C *******1234 has been debited with KES 1,500.00 on 22/09/2026 14:20:00 paid to RUBIS ENERGY Ref: EQ987654. Available Bal: KES 16,700.00.'
                ].join(nl + nl),
                batch: [
                    'QA11111111 Confirmed. Ksh2,400.00 received from BOLT DELIVERIES on 12/9/26 at 6:00 PM. New M-PESA balance is Ksh7,170.00.',
                    'QB22222222 Confirmed. Ksh630.00 paid to TOTAL ENERGIES. on 12/9/26 at 7:30 PM. New M-PESA balance is Ksh6,540.00.',
                    'QD44444444 Confirmed. Ksh400.00 paid to SPIRO BATTERY SWAP on 12/9/26 at 4:30 PM. New M-PESA balance is Ksh5,320.00.',
                    'QC33333333 Confirmed. Ksh450.00 paid to KPLC PREPAID on 12/9/26 at 8:15 PM. New M-PESA balance is Ksh6,090.00.'
                ].join(nl)
            };

            input.value = samples[type] || samples.single;
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

                <button onclick="toggleDarkMode()" class="dark-mode-toggle-btn p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition" title="Toggle Dark/Light Mode">
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
                <a href="/finance/statement" target="_blank" class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition active:scale-95 border border-slate-200 dark:border-gray-700">
                    <span>📄 SACCO / PDF Statement</span>
                </a>
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
            <button onclick="document.getElementById('runway-score-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>🛡️ Runway (${runway_status.displayMonths})</span>
            </button>
            <button onclick="document.getElementById('targets-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>🎯 Targets</span>
            </button>
            <button onclick="document.getElementById('timeline-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>🗓️ Timeline (${unified_timeline.length})</span>
            </button>
            <button onclick="document.getElementById('expense-breakdown-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>📊 Chart</span>
            </button>
            <button onclick="document.getElementById('tx-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>➕ Add Tx</span>
            </button>
            <button onclick="pasteSampleMpesa('batch'); document.getElementById('mpesa-card')?.scrollIntoView({behavior: 'smooth'});" class="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 active:scale-95 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl shadow-xs shrink-0 border border-emerald-200 dark:border-emerald-800 transition">
                <span>📲 Parse M-Pesa</span>
            </button>
            <button onclick="document.getElementById('goals-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-purple-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>🎯 Goals</span>
            </button>
            <button onclick="document.getElementById('waterfall-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>🌊 Auto-Split</span>
            </button>
            <button onclick="document.getElementById('debts-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-rose-600 to-amber-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>💳 Loans & Debts ${dangerCount > 0 ? `<span class="px-1.5 py-0.2 bg-white text-rose-700 rounded-full font-black text-[10px] animate-pulse">🚨 ${dangerCount}</span>` : ''}</span>
            </button>
            <a href="/rider" class="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>🛵 Log Shift</span>
            </a>
            <a href="/finance/export/csv" class="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>📥 Export CSV</span>
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

        <!-- 🛡️ & 🏆 Emergency Runway & Financial Health Score Twin Cards -->
        <div id="runway-score-card" class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <!-- 🛡️ Emergency Fund Runway Meter ("Months of Freedom") -->
            <div class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center text-xl shadow-md shrink-0 text-white">
                            🛡️
                        </div>
                        <div>
                            <h2 class="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span>Emergency Fund Runway</span>
                                <span class="text-[10px] ${getBadgeStyles(runway_status.statusBadge)} font-black px-2 py-0.5 rounded-full uppercase tracking-wider">${runway_status.statusLabel}</span>
                            </h2>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Months of Freedom you can survive without new income</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-2xl font-black text-amber-500 dark:text-amber-400">${runway_status.displayMonths}</span>
                        <p class="text-[10px] text-gray-400">Target: 6.0 mo</p>
                    </div>
                </div>

                <!-- Progress Meter -->
                <div class="space-y-1.5">
                    <div class="flex justify-between text-xs">
                        <span class="text-gray-600 dark:text-gray-300 font-semibold">Freedom Cushion Progress</span>
                        <span class="font-extrabold text-amber-600 dark:text-amber-400">${runway_status.percentageOfGoal}% of 6-mo goal</span>
                    </div>
                    <div class="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 p-0.5">
                        <div class="h-full rounded-full transition-all duration-500 ${runway_status.months >= 3 ? 'bg-gradient-to-r from-amber-500 to-emerald-500' : 'bg-gradient-to-r from-rose-500 to-amber-500'}" style="width: ${Math.min(100, Math.max(2, runway_status.percentageOfGoal))}%"></div>
                    </div>
                </div>

                <!-- Stats Breakdown Row -->
                <div class="grid grid-cols-2 gap-3 pt-1">
                    <div class="p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-xl">
                        <p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Liquid Reserves</p>
                        <p class="text-base font-bold text-emerald-600 dark:text-emerald-400 convertible-amount" data-kes="${runway_status.liquidBalance}">${formatKes(runway_status.liquidBalance)}</p>
                        <p class="text-[10px] text-gray-400">M-Pesa, Cash & MMF</p>
                    </div>
                    <div class="p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-xl">
                        <p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">Monthly Burn Rate</p>
                        <p class="text-base font-bold text-rose-600 dark:text-rose-400 convertible-amount" data-kes="${runway_status.monthlyBurn}">${formatKes(runway_status.monthlyBurn)}</p>
                        <p class="text-[10px] text-gray-400">Essential living expenses</p>
                    </div>
                </div>

                <!-- Actionable Advice -->
                <div class="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-start gap-2.5">
                    <span class="text-base shrink-0">💡</span>
                    <p class="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">${runway_status.advice}</p>
                </div>
            </div>

            <!-- 🏆 Financial Freedom & Health Score (0-100) -->
            <div class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-xl shadow-md shrink-0 text-white">
                            🏆
                        </div>
                        <div>
                            <h2 class="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span>Financial Health Score</span>
                                <span class="text-[10px] px-2 py-0.5 rounded-full ${health_score.badgeClass}">${health_score.grade} Grade</span>
                            </h2>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${health_score.tierLabel}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-3xl font-black ${health_score.totalScore >= 75 ? 'text-emerald-600 dark:text-emerald-400' : health_score.totalScore >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}">${health_score.totalScore}</span>
                        <span class="text-xs text-gray-400">/ 100</span>
                    </div>
                </div>

                <!-- 4 Pillars Breakdown -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-xl space-y-1">
                        <div class="flex justify-between items-center text-xs">
                            <span class="text-gray-700 dark:text-gray-300 font-semibold">🛡️ Runway</span>
                            <span class="font-bold text-emerald-600 dark:text-emerald-400">${health_score.pillarScores.runway.score}/25</span>
                        </div>
                        <div class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div class="h-full bg-emerald-500 rounded-full" style="width: ${(health_score.pillarScores.runway.score / 25) * 100}%"></div>
                        </div>
                        <p class="text-[10px] text-gray-500 dark:text-gray-400">${health_score.pillarScores.runway.detail}</p>
                    </div>

                    <div class="p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-xl space-y-1">
                        <div class="flex justify-between items-center text-xs">
                            <span class="text-gray-700 dark:text-gray-300 font-semibold">💳 Debt Health</span>
                            <span class="font-bold text-cyan-600 dark:text-cyan-400">${health_score.pillarScores.debt.score}/25</span>
                        </div>
                        <div class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div class="h-full bg-cyan-500 rounded-full" style="width: ${(health_score.pillarScores.debt.score / 25) * 100}%"></div>
                        </div>
                        <p class="text-[10px] text-gray-500 dark:text-gray-400">${health_score.pillarScores.debt.detail}</p>
                    </div>

                    <div class="p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-xl space-y-1">
                        <div class="flex justify-between items-center text-xs">
                            <span class="text-gray-700 dark:text-gray-300 font-semibold">🎯 Target Pace</span>
                            <span class="font-bold text-indigo-600 dark:text-indigo-400">${health_score.pillarScores.incomeTarget.score}/25</span>
                        </div>
                        <div class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div class="h-full bg-indigo-500 rounded-full" style="width: ${(health_score.pillarScores.incomeTarget.score / 25) * 100}%"></div>
                        </div>
                        <p class="text-[10px] text-gray-500 dark:text-gray-400">${health_score.pillarScores.incomeTarget.detail}</p>
                    </div>

                    <div class="p-3 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/80 rounded-xl space-y-1">
                        <div class="flex justify-between items-center text-xs">
                            <span class="text-gray-700 dark:text-gray-300 font-semibold">⚖️ Discipline</span>
                            <span class="font-bold text-purple-600 dark:text-purple-400">${health_score.pillarScores.budgetDiscipline.score}/25</span>
                        </div>
                        <div class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div class="h-full bg-purple-500 rounded-full" style="width: ${(health_score.pillarScores.budgetDiscipline.score / 25) * 100}%"></div>
                        </div>
                        <p class="text-[10px] text-gray-500 dark:text-gray-400">${health_score.pillarScores.budgetDiscipline.detail}</p>
                    </div>
                </div>

                <!-- Strategic Recommendations -->
                <div class="pt-1">
                    ${(health_score.recommendations || []).map((rec: string) => `
                    <p class="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1.5"><span class="text-emerald-500 font-bold">✓</span> ${rec}</p>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- ⚡ EV vs. Petrol Cost-Savings & ROI Comparator Banner -->
        <div id="ev-savings-card" class="bg-white dark:bg-gray-900 bg-gradient-to-br from-teal-500/10 via-cyan-500/5 to-transparent dark:from-teal-950/30 p-6 rounded-2xl border border-teal-200 dark:border-teal-900/50 shadow-sm space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-teal-100 dark:border-teal-900/40 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-teal-600 flex items-center justify-center text-xl shadow-md shrink-0 text-white">
                        ⚡
                    </div>
                    <div>
                        <h2 class="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>EV vs. Petrol Cost-Savings & ROI Comparator</span>
                            <span class="text-[10px] bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">${ev_roi_stats.savingsPercentage}% Cheaper</span>
                        </h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Real-time savings analytics based on your logged rider shifts and battery swaps</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <a href="/rider" class="px-3 py-1.5 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900 text-teal-700 dark:text-teal-300 rounded-xl text-xs font-bold border border-teal-200 dark:border-teal-800 transition active:scale-95">
                        🛵 View Rider Shifts
                    </a>
                </div>
            </div>

            <!-- Savings Metrics Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="p-3.5 bg-white dark:bg-gray-900 border border-teal-200 dark:border-teal-900/60 rounded-xl shadow-2xs">
                    <p class="text-[10px] text-teal-700 dark:text-teal-300 uppercase tracking-wider font-semibold">Total Distance</p>
                    <p class="text-xl font-black text-gray-900 dark:text-white mt-0.5">${formatNum(ev_roi_stats.totalKm)} <span class="text-xs font-normal text-gray-500">km</span></p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400">EV: ${formatNum(ev_roi_stats.evKm)} km • Petrol: ${formatNum(ev_roi_stats.petrolKm)} km</p>
                </div>

                <div class="p-3.5 bg-white dark:bg-gray-900 border border-teal-200 dark:border-teal-900/60 rounded-xl shadow-2xs">
                    <p class="text-[10px] text-teal-700 dark:text-teal-300 uppercase tracking-wider font-semibold">Net Shillings Saved</p>
                    <p class="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 convertible-amount" data-kes="${ev_roi_stats.netSavingsKes}">${formatKes(ev_roi_stats.netSavingsKes)}</p>
                    <p class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">vs. pure petrol baseline</p>
                </div>

                <div class="p-3.5 bg-white dark:bg-gray-900 border border-teal-200 dark:border-teal-900/60 rounded-xl shadow-2xs">
                    <p class="text-[10px] text-teal-700 dark:text-teal-300 uppercase tracking-wider font-semibold">Unit Running Cost</p>
                    <p class="text-xl font-black text-cyan-600 dark:text-cyan-400 mt-0.5">Ksh ${ev_roi_stats.costPerKmEv.toFixed(2)} <span class="text-xs font-normal text-gray-500">/ km</span></p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400">Petrol avg: Ksh ${ev_roi_stats.costPerKmPetrol.toFixed(2)}/km</p>
                </div>

                <div class="p-3.5 bg-white dark:bg-gray-900 border border-teal-200 dark:border-teal-900/60 rounded-xl shadow-2xs">
                    <p class="text-[10px] text-teal-700 dark:text-teal-300 uppercase tracking-wider font-semibold">🍃 CO2 Offset</p>
                    <p class="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">${formatNum(ev_roi_stats.co2SavedKg)} <span class="text-xs font-normal text-gray-500">kg</span></p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400">Clean energy reduction</p>
                </div>
            </div>
        </div>

        <!-- 📊 & 🗓️ Expense Breakdown & Unified Deadlines Agenda Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <!-- 📊 Expense Category Breakdown & Distribution Card -->
            <div id="expense-breakdown-card" class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                <div class="flex items-center justify-between border-b dark:border-gray-800 pb-3">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-600 flex items-center justify-center text-xl shadow-md shrink-0 text-white">
                            📊
                        </div>
                        <div>
                            <h2 class="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span>Monthly Expense Distribution</span>
                            </h2>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Category spending breakdown & proportions</p>
                        </div>
                    </div>
                    <span class="text-sm font-black text-rose-600 dark:text-rose-400 convertible-amount" data-kes="${monthly_expenses}">${formatKes(monthly_expenses)}</span>
                </div>

                ${category_breakdown.length === 0 ? `
                <div class="text-center py-8 text-gray-400 text-xs">
                    <p class="text-2xl mb-2">🛍️</p>
                    <p class="font-bold">No expenses logged yet this month.</p>
                    <p class="mt-1">Add transactions or import M-Pesa statements to see your spending distribution.</p>
                </div>
                ` : `
                <!-- Stacked Distribution Bar -->
                <div class="w-full h-3.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                    ${category_breakdown.map((item: any) => {
                        const theme = getCategoryTheme(item.category);
                        return `<div class="h-full rounded-xs transition-all duration-300 ${theme.bg}" style="width: ${Math.max(3, item.percentage)}%" title="${item.category}: ${item.percentage}% (${formatKes(item.amount)})"></div>`;
                    }).join('')}
                </div>

                <!-- Breakdown List -->
                <div class="space-y-2 max-h-72 overflow-y-auto no-scrollbar pt-1">
                    ${category_breakdown.map((item: any) => {
                        const theme = getCategoryTheme(item.category);
                        return `
                        <div class="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-xs">
                            <div class="flex items-center space-x-2.5">
                                <span class="w-7 h-7 rounded-lg ${theme.bg} text-white flex items-center justify-center text-sm shrink-0 shadow-xs">${theme.icon}</span>
                                <div>
                                    <p class="font-bold text-gray-900 dark:text-gray-100">${item.category}</p>
                                    <p class="text-[10px] text-gray-400">${item.percentage}% of monthly spend</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="font-black text-gray-900 dark:text-white convertible-amount" data-kes="${item.amount}">${formatKes(item.amount)}</p>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
                `}
            </div>

            <!-- 🗓️ Unified Upcoming Deadlines & Renewals Timeline -->
            <div id="timeline-card" class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                <div class="flex items-center justify-between border-b dark:border-gray-800 pb-3">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xl shadow-md shrink-0 text-white">
                            🗓️
                        </div>
                        <div>
                            <h2 class="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span>Upcoming Deadlines & Renewals</span>
                                ${dangerCount > 0 ? `<span class="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-extrabold text-[10px] rounded-full animate-pulse border border-rose-300 dark:border-rose-800">🚨 ${dangerCount} Urgent</span>` : ''}
                            </h2>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Unified agenda: loans, bills & vehicle compliance</p>
                        </div>
                    </div>
                </div>

                ${unified_timeline.length === 0 ? `
                <div class="text-center py-8 text-gray-400 text-xs">
                    <p class="text-2xl mb-2">✨</p>
                    <p class="font-bold">No active deadlines pending.</p>
                    <p class="mt-1">Add loan deadlines, recurring bills, or vehicle compliance to track them here.</p>
                </div>
                ` : `
                <div class="space-y-2.5 max-h-72 overflow-y-auto no-scrollbar">
                    ${unified_timeline.map((item: any) => {
                        const isOverdue = item.isOverdue || item.daysRemaining < 0;
                        const isDanger = item.isDangerZone || item.daysRemaining <= 3;
                        const badgeStyle = isOverdue 
                            ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            : isDanger 
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800';

                        return `
                        <div class="p-3 rounded-xl border ${isDanger || isOverdue ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20' : 'border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40'} flex items-center justify-between gap-3 text-xs">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 rounded-lg ${isOverdue ? 'bg-rose-600' : isDanger ? 'bg-amber-600' : 'bg-indigo-600'} text-white flex items-center justify-center text-sm shrink-0">
                                    ${item.icon || (item.itemType === 'LOAN' ? '💳' : item.itemType === 'BILL' ? '⚡' : '📋')}
                                </div>
                                <div>
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <p class="font-bold text-gray-900 dark:text-gray-100">${item.title}</p>
                                        <span class="text-[9px] px-1.5 py-0.5 rounded-md font-bold ${badgeStyle}">${item.typeLabel || (item.itemType === 'LOAN' ? 'Loan' : item.itemType === 'BILL' ? 'Bill' : 'Document')}</span>
                                    </div>
                                    <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                        📅 Due: <strong>${item.dueDate}</strong> • 
                                        <span class="${isOverdue ? 'text-rose-600 dark:text-rose-400 font-extrabold' : isDanger ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-gray-500'}">
                                            ${item.daysRemaining < 0 ? `🚨 ${Math.abs(item.daysRemaining)} days overdue!` : item.daysRemaining === 0 ? '🚨 Due TODAY!' : `⏳ in ${item.daysRemaining} days`}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <div class="text-right shrink-0">
                                ${(item.amount || item.amountKes) ? `<p class="font-black text-gray-900 dark:text-white convertible-amount" data-kes="${item.amount || item.amountKes}">${formatKes(item.amount || item.amountKes)}</p>` : ''}
                                <a href="${item.actionLink || '#'}" class="inline-block mt-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold">View →</a>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
                `}
            </div>
        </div>

        <!-- 📈 Weekly Performance Scorecard & 🇰🇪 KRA Turnover Tax (TOT) Estimator -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <!-- 🗓️ Weekly Financial Performance Scorecard -->
            <div id="weekly-scorecard-card" class="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-6 rounded-2xl border border-indigo-800/60 shadow-md space-y-4 text-white">
                <div class="flex items-center justify-between border-b border-indigo-800/60 pb-3">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-xl shadow-md shrink-0">
                            🏆
                        </div>
                        <div>
                            <h2 class="text-base font-bold text-white flex items-center gap-2">
                                <span>Weekly Performance Scorecard</span>
                                <span class="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 px-2 py-0.5 rounded-full font-bold">7-Day Trailing</span>
                            </h2>
                            <p class="text-xs text-indigo-200/80">Real cashflow momentum across all your active accounts</p>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div class="p-3 bg-slate-950/80 rounded-xl border border-indigo-950">
                        <p class="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">⚡ 7-Day Inflow</p>
                        <p class="text-lg font-black text-emerald-400 mt-1 convertible-amount" data-kes="${scorecard.totalInflow}">Ksh ${scorecard.totalInflow.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                        <p class="text-[10px] text-gray-400">Total money received</p>
                    </div>

                    <div class="p-3 bg-slate-950/80 rounded-xl border border-indigo-950">
                        <p class="text-[10px] text-rose-300 font-bold uppercase tracking-wider">💸 7-Day Outflow</p>
                        <p class="text-lg font-black text-rose-400 mt-1 convertible-amount" data-kes="${scorecard.totalOutflow}">Ksh ${scorecard.totalOutflow.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                        <p class="text-[10px] text-gray-400">Expenses & upkeep</p>
                    </div>

                    <div class="p-3 bg-slate-950/80 rounded-xl border border-indigo-950">
                        <p class="text-[10px] text-cyan-300 font-bold uppercase tracking-wider">🛡️ Net Retained</p>
                        <p class="text-lg font-black text-cyan-300 mt-1 convertible-amount" data-kes="${scorecard.netWeekly}">Ksh ${scorecard.netWeekly.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                        <p class="text-[10px] text-gray-400">Net retained wealth</p>
                    </div>
                </div>

                <div class="p-3.5 bg-slate-950/60 rounded-xl border border-indigo-900/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                    <div>
                        <span class="text-gray-300">⛽ Fuel & Expense Ratio:</span>
                        <strong class="text-amber-400 ml-1 font-mono">${scorecard.fuelRatioPct}% of inflow</strong>
                        <span class="text-[10px] text-gray-400 ml-1">(Ksh ${scorecard.fuelCost.toLocaleString()})</span>
                    </div>
                    <div>
                        <span class="text-gray-300">🌟 Top Day:</span>
                        <strong class="text-emerald-300 ml-1 font-mono">${scorecard.bestDay.day} (Ksh ${scorecard.bestDay.amount.toLocaleString()})</strong>
                    </div>
                </div>
            </div>

            <!-- 🇰🇪 KRA Turnover Tax (TOT) Estimator Card -->
            <div id="turnover-tax-card" class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                <div class="flex items-center justify-between border-b dark:border-gray-800 pb-3">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-rose-600 flex items-center justify-center text-xl shadow-md shrink-0 text-white">
                            🇰🇪
                        </div>
                        <div>
                            <h2 class="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span>KRA Turnover Tax (TOT) Estimator</span>
                                <span class="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">3% Simplified</span>
                            </h2>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Kenya Revenue Authority presumptive & turnover tax reserve calculator</p>
                        </div>
                    </div>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${totTax.isEligible ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}">
                        ${totTax.isEligible ? '🟢 TOT Regime (1M–25M)' : 'ℹ️ Standard Regime'}
                    </span>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div class="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border dark:border-gray-700">
                        <p class="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Monthly Turnover</p>
                        <p class="text-base font-black text-gray-900 dark:text-white mt-1 convertible-amount" data-kes="${monthly_income}">Ksh ${Number(monthly_income).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                        <p class="text-[9px] text-gray-400">Gross monthly inflow</p>
                    </div>
                    <div class="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60">
                        <p class="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase">3% TOT Reserve</p>
                        <p class="text-base font-black text-amber-600 dark:text-amber-400 mt-1 convertible-amount" data-kes="${totTax.monthlyTaxKes}">Ksh ${totTax.monthlyTaxKes.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                        <p class="text-[9px] text-amber-700 dark:text-amber-300">Set aside this month</p>
                    </div>
                    <div class="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border dark:border-gray-700">
                        <p class="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase">Quarterly Est.</p>
                        <p class="text-base font-black text-purple-600 dark:text-purple-400 mt-1 convertible-amount" data-kes="${totTax.quarterlyTaxKes}">Ksh ${totTax.quarterlyTaxKes.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                        <p class="text-[9px] text-gray-400">3-Month liability</p>
                    </div>
                </div>

                <div class="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 space-y-1">
                    <p class="text-[11px] text-amber-900 dark:text-amber-200 font-semibold leading-relaxed">
                        📌 ${totTax.advice}
                    </p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400">
                        Filing Deadline: <strong>20th of every month</strong> via KRA iTax portal.
                    </p>
                </div>
            </div>
        </div>

        <div id="targets-card" class="bg-white dark:bg-gray-900 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/30 p-5 sm:p-6 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm space-y-6 text-gray-900 dark:text-white">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-emerald-100 dark:border-emerald-900/40 pb-4">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-xl shadow-md shrink-0 text-white">
                        🎯
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>Income & Expense Target Checkers</span>
                            <span class="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200 dark:border-emerald-500/30">Weekly • Monthly • Yearly</span>
                        </h2>
                        <p class="text-xs text-gray-600 dark:text-emerald-200/80">Track target income milestones vs expense budget burn rates with safe daily run-rate pacing.</p>
                    </div>
                </div>

                <div class="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <!-- Timeframe Tab Switcher -->
                    <div class="flex p-1 bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl">
                        <button type="button" id="target-btn-weekly" onclick="switchTargetTab('weekly')" class="target-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold transition text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                            Weekly
                        </button>
                        <button type="button" id="target-btn-monthly" onclick="switchTargetTab('monthly')" class="target-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-600 text-white shadow-xs">
                            Monthly
                        </button>
                        <button type="button" id="target-btn-yearly" onclick="switchTargetTab('yearly')" class="target-tab-btn px-3 py-1.5 rounded-lg text-xs font-bold transition text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                            Yearly
                        </button>
                    </div>

                    <button type="button" onclick="document.getElementById('targets-edit-form-container')?.classList.toggle('hidden')" class="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 transition active:scale-95 flex items-center gap-1.5 shadow-2xs">
                        <span>⚙️ Set Targets</span>
                    </button>
                </div>
            </div>

            <!-- Collapsible Edit Targets Form -->
            <div id="targets-edit-form-container" class="hidden bg-white dark:bg-gray-950 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 shadow-md space-y-4">
                <div class="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-2">
                    <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>⚙️ Customize Income Targets & Expense Ceilings</span>
                    </h3>
                    <button type="button" onclick="document.getElementById('targets-edit-form-container')?.classList.add('hidden')" class="text-gray-400 hover:text-gray-600 dark:hover:text-white text-sm">✕</button>
                </div>

                <form action="/targets/update" method="POST" class="space-y-4">
                    <div>
                        <p class="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">💵 Target Income Milestones (<span class="curr-symbol-label">Ksh</span>)</p>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">Weekly Target Income</label>
                                <input type="number" step="any" inputmode="decimal" name="target_income_weekly" value="${income_targets.weekly.target}" placeholder="15000" data-placeholder-base="15000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-400 convertible-placeholder" required>
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">Monthly Target Income</label>
                                <input type="number" step="any" inputmode="decimal" name="target_income_monthly" value="${income_targets.monthly.target}" placeholder="65000" data-placeholder-base="65000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-400 convertible-placeholder" required>
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">Yearly Target Income</label>
                                <input type="number" step="any" inputmode="decimal" name="target_income_yearly" value="${income_targets.yearly.target}" placeholder="780000" data-placeholder-base="780000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-400 convertible-placeholder" required>
                            </div>
                        </div>
                    </div>

                    <div>
                        <p class="text-xs font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">🛑 Expense Target & Budget Ceilings (<span class="curr-symbol-label">Ksh</span>)</p>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">Weekly Expense Budget</label>
                                <input type="number" step="any" inputmode="decimal" name="target_expense_weekly" value="${expense_targets.weekly.target}" placeholder="6000" data-placeholder-base="6000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-400 convertible-placeholder" required>
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">Monthly Expense Budget</label>
                                <input type="number" step="any" inputmode="decimal" name="target_expense_monthly" value="${expense_targets.monthly.target}" placeholder="25000" data-placeholder-base="25000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-400 convertible-placeholder" required>
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">Yearly Expense Budget</label>
                                <input type="number" step="any" inputmode="decimal" name="target_expense_yearly" value="${expense_targets.yearly.target}" placeholder="300000" data-placeholder-base="300000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-400 convertible-placeholder" required>
                            </div>
                        </div>
                    </div>

                    <div>
                        <p class="text-xs font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">🏷️ Monthly Category Spending Limits (<span class="curr-symbol-label">Ksh</span>)</p>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">🏠 Living Expenses</label>
                                <input type="number" step="any" name="cat_limit_living" value="${(budgets.find((b: any) => b.category === 'Living Expenses') || {}).limit || 8000}" placeholder="8000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white">
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">🛒 Food & Groceries</label>
                                <input type="number" step="any" name="cat_limit_food" value="${(budgets.find((b: any) => b.category === 'Food & Groceries') || {}).limit || 6000}" placeholder="6000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white">
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">⛽ Fuel / EV Swaps</label>
                                <input type="number" step="any" name="cat_limit_fuel" value="${(budgets.find((b: any) => b.category.includes('Fuel')) || {}).limit || 7000}" placeholder="7000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white">
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">⚡ Utilities & Bills</label>
                                <input type="number" step="any" name="cat_limit_bills" value="${(budgets.find((b: any) => b.category.includes('Utilities')) || {}).limit || 4000}" placeholder="4000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white">
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
                        <div class="bg-white dark:bg-gray-950 border border-emerald-200 dark:border-emerald-800/80 p-5 rounded-2xl shadow-xs space-y-4 flex flex-col justify-between">
                            <div class="space-y-3">
                                <div class="flex justify-between items-start gap-2">
                                    <div class="flex items-center space-x-2">
                                        <span class="text-xl">💵</span>
                                        <div>
                                            <h3 class="text-sm font-bold text-gray-900 dark:text-white">Target Income Checker</h3>
                                            <p class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">${tfTitle}</p>
                                        </div>
                                    </div>
                                    <span class="text-[11px] font-black px-2.5 py-0.5 rounded-full ${getBadgeStyles(inc.statusBadge)}">
                                        ${inc.statusLabel}
                                    </span>
                                </div>

                                <div class="flex justify-between items-baseline pt-1">
                                    <div>
                                        <p class="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Earned So Far</p>
                                        <p class="text-2xl font-black text-emerald-600 dark:text-emerald-400 convertible-amount" data-kes="${inc.actual}">${formatKes(inc.actual)}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Target Goal</p>
                                        <p class="text-sm font-black text-gray-700 dark:text-gray-200 convertible-amount" data-kes="${inc.target}">${formatKes(inc.target)}</p>
                                    </div>
                                </div>

                                <!-- Progress Bar -->
                                <div class="space-y-1">
                                    <div class="w-full bg-gray-100 dark:bg-gray-800 h-3 rounded-full overflow-hidden p-0.5 border border-gray-200 dark:border-gray-700">
                                        <div class="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-teal-500 to-emerald-500 shadow-xs" style="width: ${inc.displayPercentage}%;"></div>
                                    </div>
                                    <div class="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
                                        <span class="text-emerald-600 dark:text-emerald-400 font-black">${inc.percentage}% Achieved</span>
                                        <span>Remaining: <strong class="convertible-amount text-gray-900 dark:text-white" data-kes="${inc.remaining}">${formatKes(inc.remaining)}</strong></span>
                                    </div>
                                </div>
                            </div>

                            <div class="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/60 text-xs">
                                ${inc.actual >= inc.target ? `
                                <div class="flex items-center space-x-2 text-emerald-700 dark:text-emerald-300 font-bold">
                                    <span>🎉</span>
                                    <span>Goal exceeded by <span class="convertible-amount font-black text-emerald-800 dark:text-emerald-200" data-kes="${inc.actual - inc.target}">${formatKes(inc.actual - inc.target)}</span>! Fantastic momentum!</span>
                                </div>
                                ` : `
                                <div class="flex justify-between items-center">
                                    <span class="text-emerald-800 dark:text-emerald-200 font-semibold">⚡ Required Run-Rate:</span>
                                    <span class="font-extrabold text-gray-900 dark:text-white"><span class="convertible-amount text-emerald-600 dark:text-emerald-300" data-kes="${inc.dailyRate}">${formatKes(inc.dailyRate)}</span> <span class="text-[10px] text-gray-500 dark:text-gray-400">/ day (${inc.daysRemaining} days left)</span></span>
                                </div>
                                `}
                            </div>
                        </div>

                        <!-- 🛑 Expense Target & Budget Checker Card -->
                        <div class="bg-white dark:bg-gray-950 border border-rose-200 dark:border-rose-800/80 p-5 rounded-2xl shadow-xs space-y-4 flex flex-col justify-between">
                            <div class="space-y-3">
                                <div class="flex justify-between items-start gap-2">
                                    <div class="flex items-center space-x-2">
                                        <span class="text-xl">🛑</span>
                                        <div>
                                            <h3 class="text-sm font-bold text-gray-900 dark:text-white">Expense Target / Budget Checker</h3>
                                            <p class="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">${tfTitle}</p>
                                        </div>
                                    </div>
                                    <span class="text-[11px] font-black px-2.5 py-0.5 rounded-full ${getBadgeStyles(exp.statusBadge)}">
                                        ${exp.statusLabel}
                                    </span>
                                </div>

                                <div class="flex justify-between items-baseline pt-1">
                                    <div>
                                        <p class="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Spent So Far</p>
                                        <p class="text-2xl font-black text-rose-600 dark:text-rose-400 convertible-amount" data-kes="${exp.actual}">${formatKes(exp.actual)}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Budget Limit</p>
                                        <p class="text-sm font-black text-gray-700 dark:text-gray-200 convertible-amount" data-kes="${exp.target}">${formatKes(exp.target)}</p>
                                    </div>
                                </div>

                                <!-- Progress Bar -->
                                <div class="space-y-1">
                                    <div class="w-full bg-gray-100 dark:bg-gray-800 h-3 rounded-full overflow-hidden p-0.5 border border-gray-200 dark:border-gray-700">
                                        <div class="h-full rounded-full transition-all duration-500 ${exp.percentage >= 100 ? 'bg-gradient-to-r from-rose-600 to-red-500' : exp.percentage > exp.expectedPacePct + 15 ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}" style="width: ${exp.displayPercentage}%;"></div>
                                    </div>
                                    <div class="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
                                        <span class="${exp.percentage >= 100 ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-gray-600 dark:text-gray-300'}">${exp.percentage}% Spent</span>
                                        <span>Remaining: <strong class="convertible-amount text-gray-900 dark:text-white" data-kes="${exp.remaining}">${formatKes(exp.remaining)}</strong></span>
                                    </div>
                                </div>
                            </div>

                            <div class="p-3 bg-gray-50 dark:bg-gray-900/90 rounded-xl border border-gray-200 dark:border-gray-800 text-xs">
                                ${exp.actual > exp.target ? `
                                <div class="flex items-center space-x-2 text-rose-600 dark:text-rose-400 font-bold">
                                    <span>🚨</span>
                                    <span>Over budget limit by <span class="convertible-amount font-black" data-kes="${exp.actual - exp.target}">${formatKes(exp.actual - exp.target)}</span>!</span>
                                </div>
                                ` : `
                                <div class="flex justify-between items-center">
                                    <span class="text-gray-700 dark:text-gray-300 font-semibold">🛡️ Safe Daily Spend Limit:</span>
                                    <span class="font-extrabold text-gray-900 dark:text-white"><span class="convertible-amount text-emerald-600 dark:text-emerald-400" data-kes="${exp.dailyRate}">${formatKes(exp.dailyRate)}</span> <span class="text-[10px] text-gray-500 dark:text-gray-400">/ day max (${exp.daysRemaining} days left)</span></span>
                                </div>
                                `}
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('')}

            <!-- 🏷️ Monthly Category Budgets & Burn Rates Breakdown -->
            <div class="pt-2 border-t border-emerald-100 dark:border-emerald-900/40 space-y-3">
                <div class="flex justify-between items-center">
                    <h3 class="text-xs font-extrabold uppercase text-gray-700 dark:text-emerald-200 tracking-wider flex items-center gap-1.5">
                        <span>🏷️ Monthly Category Budget Burn Rates</span>
                    </h3>
                    <span class="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">Live auto-calculated from transactions</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    ${category_budgets.map((b: any) => `
                    <div class="p-3.5 bg-white dark:bg-gray-950/70 border border-gray-200 dark:border-gray-800 rounded-xl space-y-2.5 flex flex-col justify-between shadow-2xs">
                        <div>
                            <div class="flex justify-between items-start">
                                <div class="flex items-center space-x-2">
                                    <span class="text-lg">${b.icon || '🏷️'}</span>
                                    <span class="text-xs font-bold text-gray-800 dark:text-gray-200 truncate max-w-[120px]">${b.category}</span>
                                </div>
                                <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${getBadgeStyles(b.burnBadge)}">
                                    ${b.burnLabel}
                                </span>
                            </div>

                            <div class="flex justify-between text-xs mt-2">
                                <span class="font-black text-gray-900 dark:text-white convertible-amount" data-kes="${b.spent}">${formatKes(b.spent)}</span>
                                <span class="text-gray-500 dark:text-gray-400 text-[11px]">/ <span class="convertible-amount font-semibold" data-kes="${b.limit}">${formatKes(b.limit)}</span></span>
                            </div>

                            <div class="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden mt-1.5 border border-gray-200 dark:border-gray-700">
                                <div class="h-full rounded-full transition-all duration-500 ${b.burnBadge === 'rose' ? 'bg-rose-500' : b.burnBadge === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${b.displayPercentage}%;"></div>
                            </div>
                        </div>

                        <div class="pt-2 border-t border-gray-100 dark:border-gray-800/80 flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400">
                            <span>Safe daily:</span>
                            <strong class="text-emerald-600 dark:text-emerald-400 font-bold convertible-amount" data-kes="${b.safeDailySpend}">${formatKes(b.safeDailySpend)}/d</strong>
                        </div>
                    </div>`).join('')}
                </div>
            </div>
        </div>


        <!-- 🌊 Dynamic Waterfall Auto-Split Card -->
        <div id="waterfall-card" class="bg-white dark:bg-gray-900 bg-gradient-to-br from-indigo-500/10 via-teal-500/5 to-transparent dark:from-indigo-950/30 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 shadow-sm space-y-4 text-gray-900 dark:text-white">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-indigo-100 dark:border-indigo-900/40 pb-3">
                <div>
                    <div class="flex items-center space-x-2">
                        <span class="text-2xl">🌊</span>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white">Dynamic Waterfall Income Auto-Split (Zero Cent Leakage)</h2>
                    </div>
                    <p class="text-xs text-gray-600 dark:text-indigo-200/80">Automatically calculate and distribute daily earnings across Ziidi MMF (10% auto-save), Lock Savings, Goals, and Living expenses.</p>
                </div>
                <button type="button" onclick="openRulesModal()" class="text-xs bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-xl font-bold transition active:scale-95 shadow-2xs">
                    ⚙️ Edit Split Rules
                </button>
            </div>

            <form action="/split/distribute" method="POST" class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-indigo-300 mb-1">Enter Today's Income (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" name="amount" id="split-amount-input" value="500" oninput="updateSplitBreakdown()" class="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-lg font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-400" required>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-indigo-300 mb-1">Source / Wallet Account</label>
                    <select name="source_account_id" class="w-full px-3 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white">
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
                <div class="p-3 bg-white dark:bg-gray-950/70 border border-gray-200 dark:border-indigo-900/60 rounded-xl shadow-2xs">
                    <div class="flex items-center space-x-1.5 text-xs text-gray-700 dark:text-indigo-300 font-bold">
                        <span>${r.icon || '💰'}</span>
                        <span class="truncate">${r.bucket_name}</span>
                    </div>
                    <p class="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1" id="rule-calc-${r.id}">Ksh 0.00</p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400 font-medium">${r.percentage}% Allocation</p>
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
                            <span>Smart M-Pesa & Bank SMS Auto-Parser</span>
                            <span class="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">M-Pesa • Equity • KCB • Co-op</span>
                        </h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Paste single or multiple M-Pesa or Kenyan Bank SMS messages directly from your clipboard to extract transactions instantly!</p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" onclick="pasteSampleMpesa('single')" class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg transition active:scale-95">
                        📋 Sample Received
                    </button>
                    <button type="button" onclick="pasteSampleMpesa('bank')" class="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-lg transition active:scale-95 border border-indigo-200 dark:border-indigo-800">
                        🏦 Sample Bank SMS (Equity / KCB)
                    </button>
                    <button type="button" onclick="pasteSampleMpesa('ev')" class="px-2.5 py-1.5 bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 text-cyan-700 dark:text-cyan-300 text-xs font-semibold rounded-lg transition active:scale-95 border border-cyan-200 dark:border-cyan-800">
                        ⚡ Sample EV Swap (Spiro)
                    </button>
                    <button type="button" onclick="pasteSampleMpesa('batch')" class="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-lg transition active:scale-95">
                        📋 Sample Batch (4 SMS)
                    </button>
                </div>
            </div>

            <form action="/finance/mpesa/import" method="POST" id="mpesa-import-form" class="space-y-4">
                <input type="hidden" id="mpesa-reviewed-json" name="reviewed_transactions" value="">
                <div class="space-y-1.5">
                    <label class="block text-xs font-bold text-gray-700 dark:text-gray-300">
                        Paste M-Pesa or Bank SMS text (Single or Multiple messages):
                    </label>
                    <textarea id="mpesa-batch-input" name="raw_sms" rows="3" placeholder="QA12345678 Confirmed. Ksh1,500.00 received from JOHN DOE...&#10;Dear Customer, your A/C has been credited with KES 4,500.00 from BOLT...&#10;Confirmed. Ksh 5,000.00 received from UBER..." class="w-full p-3 font-mono text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500" required></textarea>
                </div>

                <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button type="button" onclick="parseMpesaClient()" class="w-full sm:w-auto px-4 py-2 bg-gray-900 dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs">
                        <span>🔍 Extract & Review Transactions</span>
                    </button>

                    <div class="flex items-center gap-2 w-full sm:w-auto">
                        <select name="account_id" class="p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-xs font-semibold" required>
                            <option value="">-- Select Target Account --</option>
                            ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join("")}
                        </select>
                        <button type="submit" id="mpesa-import-submit-btn" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap">
                            <span>📥 1-Tap Import to Ledger</span>
                        </button>
                    </div>
                </div>

                <!-- Preview Area -->
                <div id="mpesa-preview-area" class="hidden space-y-2 pt-2 border-t dark:border-gray-800">
                    <div class="flex flex-wrap justify-between items-center gap-2">
                        <span id="mpesa-parsed-count" class="text-xs font-bold text-emerald-600 dark:text-emerald-400">0 SMS Extracted</span>
                        <span class="text-[11px] text-gray-400">Review, adjust category or uncheck items before importing</span>
                    </div>
                    <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                        <table class="w-full text-left">
                            <thead class="bg-gray-50 dark:bg-gray-800/60 text-[11px] text-gray-500 uppercase">
                                <tr>
                                    <th class="py-2 px-3 text-center w-8">
                                        <input type="checkbox" id="mpesa-select-all" checked onchange="toggleAllMpesaReview(this.checked)" class="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer" title="Select / Unselect All">
                                    </th>
                                    <th class="py-2 px-3">Receipt</th>
                                    <th class="py-2 px-3">Date/Time</th>
                                    <th class="py-2 px-3">Type</th>
                                    <th class="py-2 px-3">Party</th>
                                    <th class="py-2 px-3">Amount</th>
                                    <th class="py-2 px-3">Category</th>
                                    <th class="py-2 px-2 text-center w-8"></th>
                                </tr>
                            </thead>
                            <tbody id="mpesa-preview-tbody" class="divide-y dark:divide-gray-800 bg-white dark:bg-gray-900"></tbody>
                        </table>
                    </div>
                </div>
            </form>
        </div>

        <!-- 🎯 Savings Goals & Asset Targets Card -->
        <div id="goals-card" class="bg-white dark:bg-gray-900 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-950/30 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 space-y-5">
            <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-indigo-100 dark:border-indigo-900/40 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xl shadow-xs shrink-0">
                        🎯
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>Savings Goals & Purchase Targets</span>
                            <span class="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">${goals.length} Goals Active</span>
                        </h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Manage all goals inside one disciplined Master Holding Vault with automated sub-split allocation shares.</p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                    <div class="text-right hidden sm:block mr-2">
                        <p class="text-[10px] font-bold text-gray-400 uppercase">Total Saved</p>
                        <p class="text-sm font-black text-indigo-600 dark:text-indigo-400 convertible-amount" data-kes="${totalGoalsSaved}">${formatKes(totalGoalsSaved)} <span class="text-xs font-semibold text-gray-400">/ <span class="convertible-amount" data-kes="${totalGoalsTarget}">${formatKes(totalGoalsTarget)}</span></span></p>
                    </div>
                    <button type="button" onclick="document.getElementById('vault-deposit-container')?.classList.toggle('hidden'); document.getElementById('goal-splits-container')?.classList.add('hidden'); document.getElementById('link-vault-container')?.classList.add('hidden'); document.getElementById('new-goal-form-container')?.classList.add('hidden');" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1 active:scale-95">
                        <span>⚡ Vault Deposit & Split</span>
                    </button>
                    <button type="button" onclick="document.getElementById('goal-splits-container')?.classList.toggle('hidden'); recalcGoalSubSplitsTotal(); document.getElementById('vault-deposit-container')?.classList.add('hidden'); document.getElementById('link-vault-container')?.classList.add('hidden'); document.getElementById('new-goal-form-container')?.classList.add('hidden');" class="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1 active:scale-95">
                        <span>⚙️ Goal Splits %</span>
                    </button>
                    <button type="button" onclick="document.getElementById('new-goal-form-container')?.classList.toggle('hidden'); document.getElementById('vault-deposit-container')?.classList.add('hidden'); document.getElementById('goal-splits-container')?.classList.add('hidden'); document.getElementById('link-vault-container')?.classList.add('hidden');" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 active:scale-95">
                        <span>➕ New Goal</span>
                    </button>
                    <form action="/goals/reset-all" method="POST" onsubmit="return confirm('Reset all goal balances to Ksh 0.00?');" class="inline">
                        <button type="submit" title="Reset all goal balances" class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-gray-600 dark:text-gray-400 hover:text-amber-700 text-xs font-bold rounded-xl transition shadow-2xs flex items-center gap-1 active:scale-95 border border-gray-200 dark:border-gray-700">
                            <span>🔄</span>
                        </button>
                    </form>
                </div>
            </div>

            <!-- 🔒 Master Holding Vault & Financial Discipline Banner -->
            <div class="bg-gradient-to-r from-indigo-50/90 via-purple-50/80 to-emerald-50/70 dark:from-indigo-950/90 dark:via-purple-950/80 dark:to-slate-900 text-gray-900 dark:text-white p-4 sm:p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div class="flex items-center space-x-3">
                    <div class="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-400/40 flex items-center justify-center text-2xl shadow-xs shrink-0">
                        🔒
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Master Holding Vault</span>
                            <span class="text-[10px] font-black px-2 py-0.5 rounded-full ${vaultReconciled ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30' : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'}">
                                ${vaultReconciled ? '✅ Fully Backed in Vault' : '⚠️ Vault Underfunded'}
                            </span>
                        </div>
                        <h3 class="text-base font-black text-gray-900 dark:text-white">${masterVaultAccount ? masterVaultAccount.name : 'Lock Savings / Sacco Vault'}</h3>
                        <p class="text-xs text-gray-600 dark:text-indigo-200">
                            Physical Balance: <strong class="text-emerald-600 dark:text-emerald-300 font-black convertible-amount" data-kes="${masterVaultBalance}">${formatKes(masterVaultBalance)}</strong>
                            &bull; Allocated across ${goals.length} Goals: <strong class="text-indigo-700 dark:text-indigo-200 font-bold convertible-amount" data-kes="${totalGoalsSaved}">${formatKes(totalGoalsSaved)}</strong>
                            ${vaultBuffer > 0 ? `&bull; Buffer: <strong class="text-emerald-600 dark:text-emerald-300 convertible-amount" data-kes="${vaultBuffer}">+${formatKes(vaultBuffer)}</strong>` : ''}
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-2 self-end md:self-center">
                    <button type="button" onclick="document.getElementById('link-vault-container')?.classList.toggle('hidden'); document.getElementById('vault-deposit-container')?.classList.add('hidden'); document.getElementById('goal-splits-container')?.classList.add('hidden'); document.getElementById('new-goal-form-container')?.classList.add('hidden');" class="px-3.5 py-1.5 bg-white dark:bg-indigo-900/80 hover:bg-indigo-50 dark:hover:bg-indigo-800 border border-indigo-200 dark:border-indigo-600/60 text-indigo-700 dark:text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1 active:scale-95">
                        <span>🔗 Change Vault Account</span>
                    </button>
                    <button type="button" onclick="document.getElementById('vault-deposit-container')?.classList.toggle('hidden'); document.getElementById('link-vault-container')?.classList.add('hidden'); document.getElementById('goal-splits-container')?.classList.add('hidden'); document.getElementById('new-goal-form-container')?.classList.add('hidden');" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center gap-1 active:scale-95">
                        <span>⚡ Deposit Funds</span>
                    </button>
                </div>
            </div>

            <!-- Drawer 1: Link Master Holding Vault Account -->
            <div id="link-vault-container" class="hidden bg-white dark:bg-gray-900 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900 shadow-md space-y-3">
                <div class="flex justify-between items-center border-b dark:border-gray-800 pb-2">
                    <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>🔒 Link Master Holding Vault Account</span>
                    </h3>
                    <button type="button" onclick="document.getElementById('link-vault-container')?.classList.add('hidden')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">✕</button>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400">Choose the single physical or digital account (e.g. <em>Lock Savings, Sacco, or MMF</em>) where your total savings goals deposits will be physically parked. All goal targets are subdivided inside this account for discipline.</p>
                <form action="/goals/link-vault" method="POST" class="flex flex-col sm:flex-row gap-3 items-end">
                    <div class="flex-1 w-full">
                        <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Select Vault Account</label>
                        <select name="vault_account_id" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-semibold" required>
                            ${accounts.map((a: any) => `<option value="${a.id}" ${masterVaultAccount?.id === a.id ? 'selected' : ''}>${a.name} (${a.account_type}) - Balance: ${formatKes(a.balance)}</option>`).join('')}
                        </select>
                    </div>
                    <button type="submit" class="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition shadow-xs active:scale-95">
                        Set Master Vault
                    </button>
                </form>
            </div>

            <!-- Drawer 2: ⚙️ Manage Goal Sub-Splits % -->
            <div id="goal-splits-container" class="hidden bg-white dark:bg-gray-900 p-5 rounded-2xl border border-purple-200 dark:border-purple-900 shadow-md space-y-4">
                <div class="flex justify-between items-center border-b dark:border-gray-800 pb-2">
                    <div>
                        <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>⚙️ Configure Goal Sub-Splits % Share</span>
                        </h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Specify what percentage share of incoming Vault deposits goes to each active goal (e.g. 40% Smart TV, 30% Gas Cooker, 30% Sofa).</p>
                    </div>
                    <button type="button" onclick="document.getElementById('goal-splits-container')?.classList.add('hidden')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">✕</button>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2 bg-purple-50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-100 dark:border-purple-900/40">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-gray-700 dark:text-gray-300">Total Split Sum:</span>
                        <span id="goal-splits-total-badge" class="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            ✅ 100% Total
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="distributeGoalSplitsEvenly()" class="px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-lg transition active:scale-95 shadow-2xs">
                            ⚖️ Distribute Evenly
                        </button>
                        <button type="button" onclick="distributeGoalSplitsProportional()" class="px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-lg transition active:scale-95 shadow-2xs">
                            📊 Proportional to Remaining
                        </button>
                    </div>
                </div>

                <form action="/goals/splits/update" method="POST" onsubmit="saveGoalSplitsLocally(event)" class="space-y-3">
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        ${goals.map((g: any, idx: number) => {
                            const target = Number(g.target_amount) || 0;
                            const current = Number(g.current_amount) || 0;
                            const remaining = Math.max(0, target - current);
                            const defaultPct = g.split_percentage !== null && g.split_percentage !== undefined ? Number(g.split_percentage) : (Math.floor((100 / Math.max(1, goals.length)) * 10) / 10);
                            const icon = getGoalIcon(g.title);

                            return `
                            <div class="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                                <div class="flex items-center space-x-2">
                                    <span class="text-lg">${icon}</span>
                                    <div class="flex-1 truncate">
                                        <h4 class="text-xs font-bold text-gray-900 dark:text-white truncate">${g.title}</h4>
                                        <p class="text-[10px] text-gray-400 font-semibold">Remaining: ${formatKes(remaining)}</p>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Sub-Split Share (%)</label>
                                    <div class="relative">
                                        <input type="number" step="0.1" min="0" max="100" name="split_${g.id}" value="${defaultPct}" data-remaining="${remaining}" oninput="recalcGoalSubSplitsTotal()" class="goal-split-input w-full p-2 pr-7 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg text-xs font-bold" required>
                                        <span class="absolute right-2.5 top-2 text-xs font-bold text-gray-400">%</span>
                                    </div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>

                    <div class="flex justify-end pt-2">
                        <button type="submit" class="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition shadow-xs active:scale-95">
                            Save Goal Sub-Splits
                        </button>
                    </div>
                </form>
            </div>

            <!-- Drawer 3: ⚡ Direct Vault Deposit & Sub-Split -->
            <div id="vault-deposit-container" class="hidden bg-white dark:bg-gray-900 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900 shadow-md space-y-4">
                <div class="flex justify-between items-center border-b dark:border-gray-800 pb-2">
                    <div>
                        <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>⚡ Direct Master Vault Deposit & Sub-Split</span>
                        </h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Deposit a lump sum into your Master Holding Vault (${masterVaultAccount ? masterVaultAccount.name : 'Lock Savings'}) and instantly sub-allocate it across your goals.</p>
                    </div>
                    <button type="button" onclick="document.getElementById('vault-deposit-container')?.classList.add('hidden')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">✕</button>
                </div>

                <form action="/goals/deposit-vault" method="POST" class="space-y-4">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Deposit Amount (<span class="curr-symbol-label">Ksh</span>)</label>
                            <input type="number" id="vault-deposit-amt-input" step="any" inputmode="decimal" name="amount" placeholder="1500" data-placeholder-base="1500" oninput="updateVaultDepositPreview()" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-bold convertible-placeholder" required>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Source Wallet (Deduct From)</label>
                            <select name="source_account_id" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-medium">
                                <option value="">-- No Deduction (Direct Cash / External) --</option>
                                ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (Bal: ${formatKes(a.balance)})</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Master Holding Vault</label>
                            <select name="vault_account_id" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-semibold">
                                ${accounts.map((a: any) => `<option value="${a.id}" ${masterVaultAccount?.id === a.id ? 'selected' : ''}>${a.name} (Bal: ${formatKes(a.balance)})</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Live Goal Sub-Split Breakdown Preview -->
                    <div id="vault-deposit-live-preview" class="hidden bg-emerald-50/70 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 space-y-2">
                        <span class="text-xs font-black text-emerald-800 dark:text-emerald-300">Live Sub-Allocation Preview:</span>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            ${goals.map((g: any) => {
                                const defaultPct = g.split_percentage !== null && g.split_percentage !== undefined ? Number(g.split_percentage) : (Math.floor((100 / Math.max(1, goals.length)) * 10) / 10);
                                return `
                                <div class="vault-deposit-item p-2 bg-white dark:bg-gray-900 rounded-lg border border-emerald-100 dark:border-emerald-900/40 flex justify-between items-center text-xs" data-split-pct="${defaultPct}">
                                    <span class="font-bold text-gray-800 dark:text-gray-200 truncate pr-2">${g.title} (${defaultPct}%)</span>
                                    <span class="vault-deposit-item-amt font-black text-emerald-600 dark:text-emerald-400 shrink-0">Ksh 0.00</span>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>

                    <div class="flex justify-end pt-1">
                        <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition shadow-xs active:scale-95">
                            Confirm Vault Deposit & Sub-Split
                        </button>
                    </div>
                </form>
            </div>

            <!-- Drawer 4: Create New Goal Collapsible Form -->
            <div id="new-goal-form-container" class="hidden bg-white dark:bg-gray-900 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900 shadow-md space-y-3">
                <div class="flex justify-between items-center border-b dark:border-gray-800 pb-2">
                    <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>➕ Set a New Savings Target</span>
                    </h3>
                    <button type="button" onclick="document.getElementById('new-goal-form-container')?.classList.add('hidden')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">✕</button>
                </div>
                <form action="/goals/create" method="POST" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div class="sm:col-span-2 lg:col-span-1">
                        <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Goal Title</label>
                        <input type="text" name="title" placeholder="e.g. 55&quot; 4K Smart TV, Sofa Seat, Gas Cooker" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-semibold" required>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Target Amount (<span class="curr-symbol-label">Ksh</span>)</label>
                        <input type="number" step="any" inputmode="decimal" name="target_amount" placeholder="45000" data-placeholder-base="45000" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-bold convertible-placeholder" required>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Sub-Split Share % (Optional)</label>
                        <input type="number" step="0.1" name="split_percentage" placeholder="30" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-bold">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Target Deadline (Optional)</label>
                        <input type="date" name="target_date" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-semibold">
                    </div>
                    <div class="flex flex-col justify-end space-y-2">
                        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-xs active:scale-95">
                            Create Goal Target
                        </button>
                    </div>
                </form>
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

            <!-- Goals Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${goals.length > 0 ? goals.map((g: any) => {
                    const target = Number(g.target_amount) || 0;
                    const current = Number(g.current_amount) || 0;
                    const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                    const remaining = Math.max(0, target - current);
                    const icon = getGoalIcon(g.title);
                    const splitPct = g.split_percentage !== null && g.split_percentage !== undefined ? Number(g.split_percentage) : (Math.floor((100 / Math.max(1, goals.length)) * 10) / 10);
                    const perThousand = Math.round(splitPct * 10);

                    let daysLeft = 30;
                    if (g.target_date) {
                        const tTime = Date.parse(g.target_date.slice(0, 10));
                        const nTime = Date.parse(new Date().toISOString().slice(0, 10));
                        const diffMs = tTime - nTime;
                        daysLeft = Math.max(1, Math.round(diffMs / 86400000));
                    }
                    const dailyNeeded = daysLeft > 0 ? (remaining / daysLeft) : 0;
                    const weeklyNeeded = dailyNeeded * 7;

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
                                        <div class="flex items-center gap-1.5 mt-0.5">
                                            ${g.target_date ? `<span class="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded">📅 ${g.target_date}</span>` : '<span class="text-[10px] text-gray-400">Open Goal</span>'}
                                            <span class="text-[10px] font-black text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800/40">⚡ ${splitPct}% Split</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1">
                                    <form action="/goals/reset/${g.id}" method="POST" onsubmit="return confirm('Reset saved balance for ${g.title} to Ksh 0.00?');">
                                        <button type="submit" title="Reset Saved to 0" class="text-gray-400 hover:text-amber-500 p-1 text-xs transition">🔄</button>
                                    </form>
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

                            <!-- Sub-Split Share & Sinking Fund Target Pace Badge -->
                            <div class="bg-indigo-50/60 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-[11px] space-y-1">
                                <div class="flex justify-between items-center">
                                    <span class="text-gray-500 dark:text-gray-400 font-semibold">Vault Share:</span>
                                    <span class="font-extrabold text-purple-700 dark:text-purple-300">${splitPct}% (Ksh ${perThousand} / 1k)</span>
                                </div>
                                <div class="flex justify-between items-center pt-0.5 border-t border-indigo-100/60 dark:border-indigo-900/40">
                                    <span class="text-gray-500 dark:text-gray-400 font-semibold">Save pace:</span>
                                    <span class="text-indigo-600 dark:text-indigo-400 font-bold"><span class="convertible-amount" data-kes="${dailyNeeded}">${formatKes(dailyNeeded)}</span>/d</span>
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

        <!-- 👥 SACCO & Chama Dividend Forecaster Card -->
        <div id="sacco-card" class="bg-white dark:bg-gray-900 bg-gradient-to-br from-indigo-500/10 via-teal-500/5 to-transparent dark:from-indigo-950/30 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 shadow-sm space-y-5 text-gray-900 dark:text-white">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-indigo-100 dark:border-indigo-900/40 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-teal-500 text-white flex items-center justify-center text-xl shadow-md shrink-0">
                        👥
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>SACCO & Chama Dividend Forecaster</span>
                            <span class="text-[10px] bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-teal-200 dark:border-teal-500/30">10% - 15% Annual Rebates</span>
                        </h2>
                        <p class="text-xs text-gray-600 dark:text-indigo-200/80">Simulate wealth compounding and annual dividend payouts from your SACCO deposits and Chama merry-go-rounds.</p>
                    </div>
                </div>
            </div>

            <!-- Dynamic Input Form -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <label class="block text-xs font-bold text-gray-700 dark:text-indigo-300 mb-1">Current Share Capital (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" id="sacco-initial-capital" value="50000" oninput="updateSaccoProjection()" class="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-indigo-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-400">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 dark:text-indigo-300 mb-1">Monthly Deposit / Contribution (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" id="sacco-monthly-deposit" value="5000" oninput="updateSaccoProjection()" class="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-indigo-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-400">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-700 dark:text-indigo-300 mb-1">Annual Dividend / Interest Rate (%)</label>
                    <input type="number" step="any" id="sacco-rate-pct" value="12" oninput="updateSaccoProjection()" class="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-indigo-700 rounded-xl text-sm font-bold text-teal-600 dark:text-teal-400 focus:ring-2 focus:ring-teal-400">
                </div>
            </div>

            <!-- Dynamic Projection Result Badges -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                <div class="p-3 bg-white dark:bg-gray-950/80 border border-gray-200 dark:border-indigo-900/60 rounded-xl shadow-2xs">
                    <p class="text-[10px] text-indigo-600 dark:text-indigo-300 font-bold uppercase tracking-wider">📈 1-Yr Total Capital</p>
                    <p class="text-lg font-black text-gray-900 dark:text-white mt-1 convertible-amount" id="sacco-yr1-capital" data-kes="110000">Ksh 110,000.00</p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400">Principal + 12 monthly deposits</p>
                </div>

                <div class="p-3 bg-white dark:bg-gray-950/80 border border-gray-200 dark:border-indigo-900/60 rounded-xl shadow-2xs">
                    <p class="text-[10px] text-teal-600 dark:text-teal-300 font-bold uppercase tracking-wider">💰 Estimated Annual Payout</p>
                    <p class="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 convertible-amount" id="sacco-annual-dividend" data-kes="9600">Ksh 9,600.00</p>
                    <p class="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">Annual dividend return</p>
                </div>

                <div class="p-3 bg-white dark:bg-gray-950/80 border border-gray-200 dark:border-indigo-900/60 rounded-xl shadow-2xs">
                    <p class="text-[10px] text-indigo-600 dark:text-indigo-300 font-bold uppercase tracking-wider">💵 Monthly Passive Equiv.</p>
                    <p class="text-lg font-black text-teal-600 dark:text-teal-300 mt-1 convertible-amount" id="sacco-monthly-dividend" data-kes="800">Ksh 800.00</p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400">Distributed monthly equivalent</p>
                </div>

                <div class="p-3 bg-white dark:bg-gray-950/80 border border-gray-200 dark:border-indigo-900/60 rounded-xl shadow-2xs">
                    <p class="text-[10px] text-purple-600 dark:text-purple-300 font-bold uppercase tracking-wider">🚀 3-Year Compounding</p>
                    <p class="text-lg font-black text-purple-600 dark:text-purple-300 mt-1 convertible-amount" id="sacco-3yr-compound" data-kes="268480">Ksh 268,480.00</p>
                    <p class="text-[10px] text-purple-700 dark:text-purple-200">Reinvesting dividends</p>
                </div>
            </div>
        </div>

        <!-- 💳 Loans & Debts Tracker (Borrowed vs Lent + Danger Zone Deadlines) -->
        <div id="debts-card" class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white shadow-sm space-y-5">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-600 text-white flex items-center justify-center text-xl shadow-md shrink-0">
                        💳
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>Loans & Debts Tracker</span>
                            <span class="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-rose-200 dark:border-rose-500/30">Danger Zone & Due Dates</span>
                        </h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Segregated tracking for Borrowed Loans (Fuliza, Hustler Fund, Tala) vs Money Lent with deadline alerts.</p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <button type="button" onclick="document.getElementById('new-debt-form-container')?.classList.toggle('hidden')" class="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 active:scale-95">
                        <span>➕ New Loan / Debt</span>
                    </button>
                </div>
            </div>

            <!-- Summary KPI Badges (Borrowed vs Lent vs Danger Zone) -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl space-y-1">
                    <div class="flex justify-between items-center text-xs text-rose-700 dark:text-rose-300 font-bold">
                        <span>🔴 Money Borrowed (I Owe)</span>
                        <span class="text-[10px] bg-rose-100 dark:bg-rose-900/80 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full">${borrowedDebts.length} active</span>
                    </div>
                    <p class="text-xl font-black text-rose-600 dark:text-rose-400 convertible-amount" data-kes="${totalBorrowedBalance}">${formatKes(totalBorrowedBalance)}</p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400">Total liabilities to settle</p>
                </div>

                <div class="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-1">
                    <div class="flex justify-between items-center text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                        <span>🟢 Money Lent Out (Owed to Me)</span>
                        <span class="text-[10px] bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">${lentDebts.length} active</span>
                    </div>
                    <p class="text-xl font-black text-emerald-600 dark:text-emerald-400 convertible-amount" data-kes="${totalLentBalance}">${formatKes(totalLentBalance)}</p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400">Receivables owed to you</p>
                </div>

                <div class="p-3.5 ${dangerCount > 0 ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-500/80 ring-1 ring-amber-400 dark:ring-amber-500/50' : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60'} rounded-xl space-y-1">
                    <div class="flex justify-between items-center text-xs ${dangerCount > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-gray-700 dark:text-gray-300'} font-bold">
                        <span>🚨 Danger Zone Deadlines</span>
                        <span class="text-[10px] ${dangerCount > 0 ? 'bg-amber-500 text-slate-950 font-black' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300'} px-2 py-0.5 rounded-full">${dangerCount} Urgent</span>
                    </div>
                    <p class="text-xl font-black ${dangerCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}">${dangerCount > 0 ? `${dangerCount} Need Action` : 'All Clear 👍'}</p>
                    <p class="text-[10px] text-gray-500 dark:text-gray-400">Due in ≤ 3 days or overdue</p>
                </div>
            </div>

            <!-- Filter Switcher Tabs -->
            <div class="flex flex-wrap items-center gap-2 pt-1">
                <button type="button" id="debt-tab-btn-all" onclick="switchDebtTab('all')" class="debt-tab-btn px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs bg-indigo-600 text-white">
                    All (${debts.length})
                </button>
                <button type="button" id="debt-tab-btn-borrowed" onclick="switchDebtTab('borrowed')" class="debt-tab-btn px-3 py-1.5 rounded-xl text-xs font-bold transition bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
                    🔴 Borrowed Loans (${borrowedDebts.length})
                </button>
                <button type="button" id="debt-tab-btn-lent" onclick="switchDebtTab('lent')" class="debt-tab-btn px-3 py-1.5 rounded-xl text-xs font-bold transition bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
                    🟢 Money Lent (${lentDebts.length})
                </button>
                <button type="button" id="debt-tab-btn-danger" onclick="switchDebtTab('danger')" class="debt-tab-btn px-3 py-1.5 rounded-xl text-xs font-bold transition bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700">
                    🚨 Danger Zone (${dangerCount})
                </button>
            </div>

            <!-- Collapsible Create Loan / Debt Form -->
            <div id="new-debt-form-container" class="hidden bg-gray-50 dark:bg-gray-950 p-5 rounded-2xl border border-gray-200 dark:border-rose-900/60 shadow-md space-y-3">
                <div class="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2">
                    <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>➕ Record New Loan or Debt</span>
                    </h3>
                    <button type="button" onclick="document.getElementById('new-debt-form-container')?.classList.add('hidden')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">✕</button>
                </div>
                <form action="/debts/create" method="POST" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    <div>
                        <label class="block text-gray-600 dark:text-gray-400 font-bold mb-1">Debt Direction / Type</label>
                        <select name="debt_type" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl font-bold" required>
                            <option value="I_OWE">🔴 I Borrowed (Loan I Owe - e.g. Hustler, Fuliza, Tala)</option>
                            <option value="OWED_TO_ME">🟢 I Lent Out (Money Owed to Me - Friend/Advance)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-gray-600 dark:text-gray-400 font-bold mb-1">Lender / Borrower / Platform Name</label>
                        <input type="text" name="person_name" placeholder="e.g. Hustler Fund, Fuliza, Tala, Brian Boda" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl font-semibold" required>
                    </div>
                    <div>
                        <label class="block text-gray-600 dark:text-gray-400 font-bold mb-1">Total Principal (<span class="curr-symbol-label">Ksh</span>)</label>
                        <input type="number" step="any" inputmode="decimal" name="total_amount" placeholder="5000" data-placeholder-base="5000" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl font-bold convertible-placeholder" required>
                    </div>
                    <div>
                        <label class="block text-gray-600 dark:text-gray-400 font-bold mb-1">Already Repaid Amount (<span class="curr-symbol-label">Ksh</span>)</label>
                        <input type="number" step="any" inputmode="decimal" name="paid_amount" placeholder="0" data-placeholder-base="0" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl font-semibold convertible-placeholder">
                    </div>
                    <div>
                        <label class="block text-gray-600 dark:text-gray-400 font-bold mb-1">Due Date / Danger Zone Deadline</label>
                        <input type="date" name="due_at" value="${today}" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl font-semibold" required>
                    </div>
                    <div>
                        <label class="block text-gray-600 dark:text-gray-400 font-bold mb-1">Disbursement / Source Account (Optional)</label>
                        <select name="account_id" class="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl font-semibold">
                            <option value="">-- No Account Link --</option>
                            ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (Bal: ${formatKes(a.balance)})</option>`).join('')}
                        </select>
                    </div>
                    <div class="sm:col-span-2 lg:col-span-2 flex items-center gap-3">
                        <label class="flex items-center space-x-2 text-gray-700 dark:text-gray-300 font-medium cursor-pointer">
                            <input type="checkbox" name="link_account" value="1" class="rounded border-gray-300 dark:border-gray-700 text-rose-600 focus:ring-rose-500">
                            <span>Sync initial loan disbursement to account balance & financial ledger</span>
                        </label>
                    </div>
                    <div class="flex items-end">
                        <button type="submit" class="w-full bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold py-2.5 rounded-xl transition shadow-xs active:scale-95">
                            Save Loan / Debt
                        </button>
                    </div>
                </form>
            </div>

            <!-- Debts Cards Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${debts.length > 0 ? debts.map((d: any) => {
                    const isBorrowed = d.debt_type === 'I_OWE';
                    const danger = d.danger_status;
                    const isDanger = danger?.isDangerZone && !d.is_settled;
                    const totalAmt = Number(d.total ?? d.total_amount ?? 0);
                    const paidAmt = Number(d.paid ?? d.paid_amount ?? 0);
                    const remainingAmt = Number(d.remaining ?? Math.max(0, totalAmt - paidAmt));
                    const percent = d.percent ?? (totalAmt > 0 ? Math.min(100, Math.round((paidAmt / totalAmt) * 100)) : 0);

                    return `
                    <div class="debt-card-item ${isDanger ? 'border-2 border-rose-500 ring-2 ring-rose-500/30 shadow-md' : 'border border-gray-200 dark:border-gray-800 shadow-2xs'} bg-gray-50 dark:bg-gray-950 p-4 rounded-xl space-y-3 flex flex-col justify-between transition-all" data-debt-type="${d.debt_type}" data-is-danger="${isDanger ? 'true' : 'false'}">
                        <div class="space-y-2.5">
                            <div class="flex justify-between items-start gap-2">
                                <div>
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span class="text-xs font-black ${isBorrowed ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">
                                            ${isBorrowed ? '🔴 Borrowed' : '🟢 Lent Out'}
                                        </span>
                                        ${d.is_settled ? `
                                            <span class="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-extrabold px-2 py-0.2 rounded-full">✓ Settled</span>
                                        ` : `
                                            <span class="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-extrabold px-2 py-0.2 rounded-full">Active</span>
                                        `}
                                    </div>
                                    <h3 class="font-bold text-gray-900 dark:text-white text-base mt-0.5">${d.person_name || d.name || 'Unnamed Debt'}</h3>
                                </div>
                                <div class="flex items-center space-x-1 shrink-0">
                                    <form action="/debts/toggle-status/${d.id}" method="POST" class="inline">
                                        <button type="submit" title="Toggle Paid/Active" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-xs transition">
                                            ${d.is_settled ? '🔄 Reopen' : '✓ Mark Paid'}
                                        </button>
                                    </form>
                                    <form action="/debts/delete/${d.id}" method="POST" onsubmit="return confirm('Delete this debt record?');" class="inline">
                                        <button type="submit" class="p-1 hover:bg-rose-100 dark:hover:bg-rose-950 rounded-lg text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 text-xs transition">🗑️</button>
                                    </form>
                                </div>
                            </div>

                            <!-- Danger Zone Alert / Due Date Badge -->
                            ${danger ? `
                            <div class="flex items-center justify-between p-2 rounded-lg ${isDanger ? 'bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800/80' : 'bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800'}">
                                <span class="text-[11px] font-bold ${danger.badgeClass}">
                                    ${danger.label}
                                </span>
                                <span class="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                                    ${danger.formattedDue ? `Due: ${danger.formattedDue}` : ''}
                                </span>
                            </div>
                            ` : ''}

                            <!-- Financial Numbers -->
                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
                                    <p class="text-[10px] text-gray-500 dark:text-gray-400">Total Principal</p>
                                    <p class="font-bold text-gray-900 dark:text-white convertible-amount" data-kes="${totalAmt}">${formatKes(totalAmt)}</p>
                                </div>
                                <div class="p-2 ${isBorrowed ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40' : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40'} rounded-lg">
                                    <p class="text-[10px] ${isBorrowed ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'} font-medium">Remaining Balance</p>
                                    <p class="font-bold ${isBorrowed ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'} convertible-amount" data-kes="${remainingAmt}">${formatKes(remainingAmt)}</p>
                                </div>
                            </div>

                            <!-- Repayment Progress Bar -->
                            <div class="space-y-1">
                                <div class="flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
                                    <span>Repaid: <strong class="text-gray-900 dark:text-white convertible-amount" data-kes="${paidAmt}">${formatKes(paidAmt)}</strong></span>
                                    <span>${percent}%</span>
                                </div>
                                <div class="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                                    <div class="h-full rounded-full transition-all duration-300 ${isBorrowed ? 'bg-rose-500' : 'bg-emerald-500'}" style="width: ${percent}%;"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Repay / Settle Action Drawer -->
                        <div class="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800/80">
                            ${!d.is_settled ? `
                            <button type="button" onclick="toggleDebtForm('${d.id}')" class="w-full bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-bold py-2 rounded-xl text-xs transition border border-gray-200 dark:border-gray-700 shadow-2xs flex items-center justify-center space-x-1 active:scale-95">
                                <span>${isBorrowed ? '💳 Record Repayment' : '📥 Record Collection'}</span>
                            </button>
                            ` : `
                            <p class="text-center text-xs text-emerald-600 dark:text-emerald-400 font-bold py-1">🎉 Fully Settled & Closed</p>
                            `}

                            <div id="debt-repay-${d.id}" class="hidden p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl space-y-2.5">
                                <form action="/debts/repay/${d.id}" method="POST" class="space-y-2">
                                    <div>
                                        <label class="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-0.5">Amount to ${isBorrowed ? 'Repay' : 'Collect'} (<span class="curr-symbol-label">Ksh</span>)</label>
                                        <input type="number" step="any" inputmode="decimal" name="amount" value="${remainingAmt}" max="${remainingAmt}" placeholder="${remainingAmt}" data-placeholder-base="${remainingAmt}" class="w-full p-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg text-xs font-bold convertible-placeholder" required>
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-0.5">${isBorrowed ? 'Payment Source Account' : 'Deposit Destination Account'}</label>
                                        <select name="account_id" class="w-full p-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg text-xs font-medium">
                                            <option value="">-- No Account Ledger Sync --</option>
                                            ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (Bal: ${formatKes(a.balance)})</option>`).join('')}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-0.5">Date</label>
                                        <input type="date" name="payment_date" value="${today}" class="w-full p-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white rounded-lg text-xs font-medium" required>
                                    </div>
                                    <div class="flex gap-2 pt-1">
                                        <button type="submit" class="flex-1 ${isBorrowed ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white font-bold py-1.5 rounded-lg text-xs transition active:scale-95 shadow-2xs">
                                            Confirm ${isBorrowed ? 'Repayment' : 'Collection'}
                                        </button>
                                        <button type="button" onclick="toggleDebtForm('${d.id}')" class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-semibold rounded-lg text-xs">
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>`;
                }).join('') : `
                <div class="md:col-span-3 p-8 text-center bg-gray-50 dark:bg-gray-950 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 space-y-2">
                    <p class="text-3xl">💳</p>
                    <h4 class="font-bold text-gray-700 dark:text-gray-200">No Loans or Debts Recorded</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Track money you borrowed (Hustler Fund, Fuliza, Tala) or money you lent out with automatic danger zone countdowns!</p>
                </div>`}
            </div>
        </div>

        <!-- 📈 MMF & Passive Yields Section -->
        <div class="bg-white dark:bg-gray-900 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 p-6 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm space-y-4">
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
                    <input type="text" name="name" placeholder="Account Name (e.g. M-Pesa, Ziidi MMF)" class="p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-medium" required>
                    <input type="text" name="account_number" placeholder="Account / Phone / Till No." class="p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-medium">
                    <select name="account_type" class="p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-semibold">
                        <option value="MOBILE">Mobile Money (M-Pesa, Airtel)</option>
                        <option value="BANK">Bank Account</option>
                        <option value="SAVINGS">Savings Account (Sacco / Fixed)</option>
                        <option value="MMF">Money Market Fund (MMF)</option>
                        <option value="LOOP">Loop Business</option>
                        <option value="CASH">Cash / Petty Cash</option>
                    </select>
                    <input type="number" step="any" inputmode="decimal" name="interest_rate_p_a" placeholder="APY % (e.g. 13.45)" class="p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-medium">
                    <input type="number" step="any" inputmode="decimal" name="balance" placeholder="Initial Balance" data-placeholder-base="Initial Balance" class="p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-bold convertible-placeholder" required>
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
                            <select name="from_account_id" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-medium" required>
                                ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">To Account</label>
                            <select name="to_account_id" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-medium" required>
                                ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Amount (<span class="curr-symbol-label">Ksh</span>)</label>
                            <input type="number" step="any" inputmode="decimal" name="amount" placeholder="0.00" data-placeholder-base="0.00" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-bold convertible-placeholder" required>
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
            <form action="/transactions/create" method="POST" class="space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
                        <select name="transaction_type" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-semibold">
                            <option value="EXPENSE">🔴 Expense</option>
                            <option value="INCOME">🟢 Income</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Account / Wallet</label>
                        <select name="account_id" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-semibold">
                            <option value="">-- No Account / Cash --</option>
                            ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Category</label>
                        <select name="category" id="tx-category-select" onchange="onTxCategoryChange(this.value)" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-semibold">
                            <option value="Living Expenses">🏠 Living Expenses</option>
                            <option value="Food & Groceries">🛒 Food & Groceries</option>
                            <option value="Fuel & Petrol">⛽ Fuel & Petrol</option>
                            <option value="EV Battery Swap & Charging">⚡ EV Battery Swap & Charging</option>
                            <option value="Utilities & Bills">💡 Utilities & Bills</option>
                            <option value="Bike Maintenance & Repairs">🔧 Vehicle / Car Maintenance & Repairs</option>
                            <option value="Rider & Boda Deliveries">🚗 / 🛵 Ride-Hailing (Uber/Bolt) & Deliveries</option>
                            <option value="M-Pesa Income">📲 M-Pesa Income</option>
                            <option value="MMF Interest">📈 MMF Yield / Interest</option>
                            <option value="Debt & Loan Repayments">💳 Debt & Loan Repayments</option>
                            <option value="Other">✏️ Other (Custom...)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Amount (<span class="curr-symbol-label">Ksh</span>)</label>
                        <input type="number" step="any" inputmode="decimal" name="amount" placeholder="0.00" data-placeholder-base="0.00" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-bold convertible-placeholder" required>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
                        <input type="date" name="t_date" value="${today}" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-semibold" required>
                    </div>
                </div>

                <!-- Note / Custom Category Memo & Where money went/came in -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div id="custom-category-container" class="hidden">
                        <label class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">Specify Custom Category</label>
                        <input type="text" name="custom_category" id="tx-custom-category" placeholder="e.g. Medical, Tithe, School Fees, Client Tip..." class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 text-gray-900 dark:text-white rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500">
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Where did money go / come from? (Note / Memo)</label>
                        <input type="text" name="description" placeholder="e.g. Paid mechanic Kamau for brake pads, Client tip, Java lunch, KPLC Token..." class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500">
                    </div>
                    <div class="flex items-end">
                        <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-4 rounded-xl text-sm transition shadow-xs active:scale-95 flex items-center justify-center gap-1.5">
                            <span>➕ Record Transaction</span>
                        </button>
                    </div>
                </div>
            </form>

            <!-- Recent Transactions Table & Mobile Feed -->
            <div class="pt-4 border-t dark:border-gray-800 space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div class="flex items-center gap-2">
                        <h3 class="text-sm font-bold text-gray-800 dark:text-gray-200">Recent Transactions</h3>
                        <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            ${transactions.length}
                        </span>
                        <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                            <span>⚡</span> Latest First
                        </span>
                    </div>

                    <!-- Type Filter Tabs -->
                    <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto flex-wrap">
                        <button type="button" onclick="setTxFilter('ALL')" id="tx-filter-btn-ALL" class="tx-filter-btn px-2.5 py-1 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs font-bold transition">
                            All (${transactions.length})
                        </button>
                        <button type="button" onclick="setTxFilter('INCOME')" id="tx-filter-btn-INCOME" class="tx-filter-btn px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">
                            Income (${transactions.filter((t: any) => !isTransferTransaction(t) && t.transaction_type === 'INCOME').length})
                        </button>
                        <button type="button" onclick="setTxFilter('EXPENSE')" id="tx-filter-btn-EXPENSE" class="tx-filter-btn px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">
                            Expense (${transactions.filter((t: any) => !isTransferTransaction(t) && t.transaction_type !== 'INCOME').length})
                        </button>
                        <button type="button" onclick="setTxFilter('TRANSFER')" id="tx-filter-btn-TRANSFER" class="tx-filter-btn px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">
                            Transfers (${transactions.filter((t: any) => isTransferTransaction(t)).length})
                        </button>
                    </div>
                </div>

                ${(() => {
                    const sortedTxs = sortTransactionsLatestFirst(transactions);
                    const totalTxs = sortedTxs.length;
                    const initialLimit = 5;

                    if (totalTxs === 0) {
                        return `
                        <div class="py-8 text-center bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                            <p class="text-xs text-gray-400">No transactions recorded yet. Use the form above or the M-Pesa SMS auto-parser!</p>
                        </div>`;
                    }

                    return `
                    <!-- Mobile Feed (Phone View: compact cards, fits screen width, max 5 shown by default) -->
                    <div id="tx-mobile-container" class="block sm:hidden space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        ${sortedTxs.map((t: any, idx: number) => {
                            const isTransfer = isTransferTransaction(t);
                            const isIncome = !isTransfer && t.transaction_type === 'INCOME';
                            const itemFilterType = isTransfer ? 'TRANSFER' : (isIncome ? 'INCOME' : 'EXPENSE');
                            const acc = accounts.find((a: any) => a.id === t.account_id);
                            let timeStr = '';
                            if (t.created_at && String(t.created_at).includes('T')) {
                                try {
                                    const d = new Date(t.created_at);
                                    if (!isNaN(d.getTime())) {
                                        timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    }
                                } catch {}
                            }
                            const isHidden = idx >= initialLimit;
                            return `
                            <div class="tx-item tx-mobile-item p-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100/70 dark:hover:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 transition ${isHidden ? 'hidden' : ''}" data-tx-type="${itemFilterType}">
                                <div class="flex items-center gap-2.5 min-w-0">
                                    <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black ${isTransfer ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300' : (isIncome ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300')}">
                                        ${isTransfer ? '⇄' : (isIncome ? '↓' : '↑')}
                                    </div>
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-1.5 flex-wrap">
                                            <span class="font-bold text-xs text-gray-900 dark:text-white truncate">${t.category}</span>
                                            ${acc ? `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold">• ${acc.name}</span>` : ''}
                                        </div>
                                        <div class="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                                            <span>${t.date}${timeStr ? ' • ' + timeStr : ''}</span>
                                            ${t.description ? `<span class="truncate max-w-[120px] text-gray-500 dark:text-gray-400">• ${t.description}</span>` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <div class="text-right">
                                        <div class="font-extrabold text-xs ${isTransfer ? 'text-blue-600 dark:text-blue-400' : (isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')} convertible-amount" data-kes="${t.amount}" data-prefix="${isTransfer ? '⇄ ' : (isIncome ? '+' : '-')}">
                                            ${isTransfer ? '⇄ ' : (isIncome ? '+' : '-')}${formatKes(t.amount)}
                                        </div>
                                        <span class="text-[9px] font-bold uppercase tracking-wider ${isTransfer ? 'text-blue-500' : (isIncome ? 'text-emerald-500' : 'text-rose-500')}">${isTransfer ? 'TRANSFER' : t.transaction_type}</span>
                                    </div>
                                    <form action="/transactions/delete/${t.id}" method="POST" onsubmit="return confirm('Delete transaction?');">
                                        <button type="submit" class="text-gray-300 dark:text-gray-600 hover:text-rose-600 dark:hover:text-rose-400 font-bold text-xs p-1 transition" title="Delete">✕</button>
                                    </form>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>

                    <!-- Desktop Table View (Tablet & Laptop/Desktop) -->
                    <div id="tx-desktop-container" class="hidden sm:block overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 max-h-[460px] overflow-y-auto">
                        <table class="w-full text-left text-xs">
                            <thead class="sticky top-0 bg-gray-50 dark:bg-gray-800/95 uppercase text-gray-400 text-[10px] backdrop-blur-xs z-10">
                                <tr>
                                    <th class="py-2.5 px-3">Date & Time</th>
                                    <th class="py-2.5 px-3">Type</th>
                                    <th class="py-2.5 px-3">Category & Details</th>
                                    <th class="py-2.5 px-3">Amount</th>
                                    <th class="py-2.5 px-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y dark:divide-gray-800">
                                ${sortedTxs.map((t: any, idx: number) => {
                                    const isTransfer = isTransferTransaction(t);
                                    const isIncome = !isTransfer && t.transaction_type === 'INCOME';
                                    const itemFilterType = isTransfer ? 'TRANSFER' : (isIncome ? 'INCOME' : 'EXPENSE');
                                    const acc = accounts.find((a: any) => a.id === t.account_id);
                                    let timeStr = '';
                                    if (t.created_at && String(t.created_at).includes('T')) {
                                        try {
                                            const d = new Date(t.created_at);
                                            if (!isNaN(d.getTime())) {
                                                timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            }
                                        } catch {}
                                    }
                                    const isHidden = idx >= initialLimit;
                                    return `
                                    <tr class="tx-item tx-desktop-item hover:bg-gray-50 dark:hover:bg-gray-800/40 transition ${isHidden ? 'hidden' : ''}" data-tx-type="${itemFilterType}">
                                        <td class="py-2.5 px-3 whitespace-nowrap">
                                            <div class="font-bold text-gray-800 dark:text-gray-200">${t.date}</div>
                                            ${timeStr ? `<div class="text-[10px] text-gray-400 dark:text-gray-500 font-mono">${timeStr}</div>` : ''}
                                        </td>
                                        <td class="py-2.5 px-3 whitespace-nowrap">
                                            <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${isTransfer ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : (isIncome ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300')}">
                                                ${isTransfer ? 'TRANSFER' : t.transaction_type}
                                            </span>
                                        </td>
                                        <td class="py-2.5 px-3">
                                            <div class="flex flex-col">
                                                <span class="font-bold text-gray-800 dark:text-gray-200">${t.category}</span>
                                                ${t.description ? `<span class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">${t.description}</span>` : ''}
                                                ${acc ? `<span class="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold">• ${acc.name}</span>` : ''}
                                            </div>
                                        </td>
                                        <td class="py-2.5 px-3 font-bold ${isTransfer ? 'text-blue-600 dark:text-blue-400' : (isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')} convertible-amount whitespace-nowrap" data-kes="${t.amount}" data-prefix="${isTransfer ? '⇄ ' : (isIncome ? '+' : '-')}">
                                            ${isTransfer ? '⇄ ' : (isIncome ? '+' : '-')}${formatKes(t.amount)}
                                        </td>
                                        <td class="py-2.5 px-3 text-center whitespace-nowrap">
                                            <form action="/transactions/delete/${t.id}" method="POST" onsubmit="return confirm('Delete transaction?');">
                                                <button type="submit" class="text-rose-500 hover:text-rose-700 font-bold text-xs p-1" title="Delete">✕</button>
                                            </form>
                                        </td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Pagination Controls (5 per page) -->
                    <div id="tx-pagination-controls" class="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800/60 text-xs ${totalTxs <= initialLimit ? 'hidden' : ''}">
                        <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs text-center sm:text-left">
                            <span>Showing <span id="tx-visible-range" class="font-bold text-gray-800 dark:text-gray-200">${totalTxs === 0 ? '0' : `1–${Math.min(initialLimit, totalTxs)}`}</span> of <span id="tx-total-filtered-count" class="font-bold text-gray-800 dark:text-gray-200">${totalTxs}</span></span>
                            <span class="text-gray-300 dark:text-gray-600">•</span>
                            <span id="tx-page-info" class="font-semibold text-emerald-600 dark:text-emerald-400">Page 1 of ${Math.max(1, Math.ceil(totalTxs / initialLimit))}</span>
                        </div>
                        <div class="flex items-center gap-1.5 flex-wrap justify-center">
                            <button type="button" id="tx-prev-btn" onclick="txPrevPage()" class="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-xl transition flex items-center gap-1 active:scale-95 cursor-pointer opacity-40 cursor-not-allowed" disabled>
                                <span>‹ Prev</span>
                            </button>
                            <div id="tx-pagination-pages" class="flex items-center gap-1 flex-wrap">
                                ${Array.from({ length: Math.ceil(totalTxs / initialLimit) }).map((_, i) => {
                                    const pageNum = i + 1;
                                    const isActive = pageNum === 1;
                                    return `<button type="button" onclick="txGoToPage(${pageNum})" class="w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${isActive ? 'bg-emerald-600 text-white shadow-xs' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}">${pageNum}</button>`;
                                }).join('')}
                            </div>
                            <button type="button" id="tx-next-btn" onclick="txNextPage()" class="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-xl transition flex items-center gap-1 active:scale-95 cursor-pointer ${totalTxs <= initialLimit ? 'opacity-40 cursor-not-allowed' : ''}" ${totalTxs <= initialLimit ? 'disabled' : ''}>
                                <span>Next ›</span>
                            </button>
                        </div>
                    </div>
                    `;
                })()}
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
    <div id="rules-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
        <div class="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 max-w-xl w-full shadow-2xl border border-gray-100 dark:border-gray-800 space-y-5 my-8">
            <div class="flex justify-between items-center border-b dark:border-gray-800 pb-3">
                <div class="flex items-center space-x-2.5">
                    <span class="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shrink-0">⚙️</span>
                    <div>
                        <h3 class="font-extrabold text-gray-900 dark:text-white text-base">Waterfall Split Allocation Rules</h3>
                        <p class="text-[11px] text-gray-500 dark:text-gray-400">Configure bucket names, % splits, and target accounts</p>
                    </div>
                </div>
                <button type="button" onclick="document.getElementById('rules-modal').classList.add('hidden')" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white text-sm transition">✕</button>
            </div>

            <!-- Live Total % Indicator & Progress Bar -->
            <div class="p-3.5 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-2">
                <div class="flex justify-between items-center text-xs">
                    <span class="font-bold text-gray-700 dark:text-gray-300">Total Allocation: <strong id="rules-modal-total" class="text-sm font-black text-indigo-600 dark:text-indigo-400">100%</strong></span>
                    <span id="rules-modal-badge" class="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">✅ 100% (Balanced)</span>
                </div>
                <div class="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div id="rules-modal-bar" class="h-full rounded-full transition-all duration-300 bg-emerald-500" style="width: 100%"></div>
                </div>
            </div>

            <!-- Main Rules Update Form -->
            <form action="/rules/update" method="POST" class="space-y-3.5">
                <div class="space-y-2.5 max-h-[50vh] overflow-y-auto no-scrollbar pr-1">
                    ${allocation_rules.map((r: any) => `
                    <div class="p-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-2.5 transition">
                        <div class="flex items-center gap-2">
                            <!-- Emoji Icon -->
                            <input type="text" name="icon_${r.id}" value="${r.icon || '💰'}" class="w-10 p-2 text-center text-base bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-bold shrink-0">
                            
                            <!-- Bucket Name -->
                            <input type="text" name="bucket_name_${r.id}" value="${r.bucket_name}" placeholder="Bucket Name" class="flex-1 p-2 text-xs font-bold bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white" required>
                            
                            <!-- Percentage -->
                            <div class="flex items-center space-x-1 shrink-0">
                                <input type="number" step="any" min="0" max="100" inputmode="decimal" name="percentage_${r.id}" value="${r.percentage}" oninput="updateRulesModalTotal()" class="rule-pct-input w-16 p-2 text-xs font-black text-center bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500" required>
                                <span class="text-xs font-bold text-gray-500">%</span>
                            </div>

                            <!-- Delete Button -->
                            <button type="submit" formaction="/rules/delete/${r.id}" onclick="return confirm('Delete bucket &quot;${r.bucket_name}&quot;?');" title="Delete Bucket" class="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition shrink-0">
                                🗑️
                            </button>
                        </div>

                        <!-- Target Destination Selector -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-gray-200 dark:border-gray-700/60">
                            <div>
                                <label class="block text-[10px] font-semibold text-gray-400 mb-0.5">Bucket Type</label>
                                <select name="target_type_${r.id}" class="w-full p-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    <option value="ACCOUNT" ${r.target_type === 'ACCOUNT' ? 'selected' : ''}>🏦 Bank / MMF / Sacco Account</option>
                                    <option value="GOAL" ${r.target_type === 'GOAL' ? 'selected' : ''}>🎯 Savings Goal</option>
                                    <option value="CASH" ${r.target_type === 'CASH' ? 'selected' : ''}>💵 Daily Cash / Living</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-semibold text-gray-400 mb-0.5">Destination Account / Goal</label>
                                <select name="target_id_${r.id}" class="w-full p-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    <option value="">-- Smart Auto-Match --</option>
                                    <optgroup label="Connected Accounts">
                                        ${accounts.map((a: any) => `<option value="${a.id}" ${r.target_id === a.id ? 'selected' : ''}>${a.name} (${a.account_type || 'Account'})</option>`).join('')}
                                    </optgroup>
                                    <optgroup label="Active Goals">
                                        ${goals.map((g: any) => `<option value="${g.id}" ${r.target_id === g.id ? 'selected' : ''}>${g.title}</option>`).join('')}
                                    </optgroup>
                                </select>
                            </div>
                        </div>
                    </div>`).join('')}
                </div>

                <div class="flex flex-col sm:flex-row gap-2 pt-2 border-t dark:border-gray-800">
                    <button type="submit" id="rules-save-btn" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-4 rounded-2xl text-xs transition shadow-md active:scale-95 flex items-center justify-center gap-1.5">
                        <span>💾 Save Split Rules & Percentages</span>
                    </button>
                    <button type="button" onclick="document.getElementById('add-rule-form-container').classList.toggle('hidden')" class="px-4 py-3 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold rounded-2xl text-xs transition active:scale-95 whitespace-nowrap">
                        <span>➕ Add Bucket</span>
                    </button>
                </div>
            </form>

            <!-- Collapsible Add New Rule Form -->
            <div id="add-rule-form-container" class="hidden p-4 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 space-y-3">
                <div class="flex justify-between items-center">
                    <h4 class="text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">➕ Create New Allocation Bucket</h4>
                    <button type="button" onclick="document.getElementById('add-rule-form-container').classList.add('hidden')" class="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                </div>
                <form action="/rules/create" method="POST" class="space-y-2.5">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div class="sm:col-span-2">
                            <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Bucket Name</label>
                            <input type="text" name="bucket_name" placeholder="e.g. Emergency Fund or Tithe" class="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-bold" required>
                        </div>
                        <div>
                            <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Percentage %</label>
                            <input type="number" step="any" min="0" max="100" name="percentage" value="10" class="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-center text-indigo-600 dark:text-indigo-400" required>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                            <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Icon Emoji</label>
                            <input type="text" name="icon" value="🛡️" class="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-bold text-center">
                        </div>
                        <div>
                            <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Bucket Type</label>
                            <select name="target_type" class="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-semibold">
                                <option value="ACCOUNT">🏦 Bank / MMF / Sacco</option>
                                <option value="GOAL">🎯 Savings Goal</option>
                                <option value="CASH">💵 Daily Living Cash</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Target Destination</label>
                            <select name="target_id" class="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-semibold">
                                <option value="">-- Smart Auto-Match --</option>
                                <optgroup label="Accounts">
                                    ${accounts.map((a: any) => `<option value="${a.id}">${a.name}</option>`).join('')}
                                </optgroup>
                                <optgroup label="Goals">
                                    ${goals.map((g: any) => `<option value="${g.id}">${g.title}</option>`).join('')}
                                </optgroup>
                            </select>
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition active:scale-95 shadow-xs">
                        ➕ Add Bucket to Split Rules
                    </button>
                </form>
            </div>
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
