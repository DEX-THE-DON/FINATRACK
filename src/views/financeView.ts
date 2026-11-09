import { sortTransactionsLatestFirst, calculateWeeklyScorecard, calculateTurnoverTax, isTransferTransaction } from '../utils/math';

export function renderFinanceDashboard(data: any): string {
  const {
    accounts = [],
    transactions = [],
    rider_logs = [],
    notifications = [],
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
    recurring_bills = [],
    mmf_accounts = [],
    total_mmf_balance = 0.0,
    total_mmf_accrued_profit = 0.0,
    total_mmf_principal = 0.0,
    strict_saver_config = null,
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
    today_shift_net = 0,
    last_shift_net = 0,
    pay_yourself_amount = 0,
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
    active_profile = 'RIDER',
    has_quick_pin = false,
  } = data;

  const activeProfileMode = (active_profile === 'TRADER' || active_profile === 'SALARIED') ? active_profile : 'RIDER';
  const activeProfileIcon = activeProfileMode === 'TRADER' ? '🥬' : activeProfileMode === 'SALARIED' ? '💼' : '🛵';
  const activeProfileLabel = activeProfileMode === 'TRADER' ? 'Mama Mboga Mode' : activeProfileMode === 'SALARIED' ? 'Salaried Mode' : 'Rider Mode';
  const activeProfileBadge = activeProfileMode === 'TRADER'
    ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
    : activeProfileMode === 'SALARIED'
      ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
      : 'bg-blue-50 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800';

  const strictNetFloor = Number(strict_saver_config?.net_floor_kes || 1000);
  const defaultSplitInputAmt = pay_yourself_amount > 0
    ? Number(pay_yourself_amount.toFixed(2))
    : (today_shift_net > 0 ? Number(today_shift_net.toFixed(2)) : (last_shift_net > 0 ? Number(last_shift_net.toFixed(2)) : strictNetFloor));

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
    if (t.includes('malindi') || t.includes('coast') || t.includes('beach') || t.includes('watamu') || t.includes('diani') || t.includes('mombasa')) return '🏖️';
    if (t.includes('tv') || t.includes('television') || t.includes('screen')) return '📺';
    if (t.includes('cooker') || t.includes('gas') || t.includes('oven') || t.includes('kitchen') || t.includes('stove')) return '🍳';
    if (t.includes('seat') || t.includes('sofa') || t.includes('couch') || t.includes('furniture') || t.includes('chair') || t.includes('table')) return '🛋️';
    if (t.includes('fridge') || t.includes('refrigerator')) return '🧊';
    if (t.includes('bike') || t.includes('boda') || t.includes('motorcycle') || t.includes('car')) return '🛵';
    if (t.includes('laptop') || t.includes('macbook') || t.includes('computer') || t.includes('phone') || t.includes('iphone')) return '💻';
    if (t.includes('house') || t.includes('rent') || t.includes('plot') || t.includes('land')) return '🏠';
    if (t.includes('emergency') || t.includes('fund') || t.includes('shield')) return '🛡️';
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
                    },
                    colors: {
                        primary: '#10B981',
                        dark: '#0F172A',
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
        .convertible-amount { transition: all 0.2s ease-in-out; }
        html.privacy-blur .convertible-amount,
        html.privacy-blur .privacy-amount {
            filter: blur(7px);
            user-select: none;
        }
        html.privacy-blur .convertible-amount:hover,
        html.privacy-blur .privacy-amount:hover {
            filter: blur(0px);
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
        .dark ::-webkit-scrollbar-thumb { background: #334155; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        /* Tailwind v4 -> v3 CDN compatibility utilities */
        .shadow-xs { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
        .shadow-2xs { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03); }
        .backdrop-blur-xs { -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
        .rounded-xs { border-radius: 0.125rem; }
        .aspect-4\/3 { aspect-ratio: 4 / 3; }
        .active\:scale-98:active { transform: scale(0.98); }
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
        var txSearchQuery = '';
        var txMonthFilter = 'ALL';

        function matchesTxItem(el) {
            var itemType = el.getAttribute('data-tx-type');
            if (txCurrentFilter !== 'ALL' && itemType !== txCurrentFilter) return false;
            if (txMonthFilter && txMonthFilter !== 'ALL') {
                var itemDate = el.getAttribute('data-tx-date') || '';
                if (itemDate.indexOf(txMonthFilter) !== 0) return false;
            }
            if (txSearchQuery) {
                var hay = (el.getAttribute('data-tx-search') || '').toLowerCase();
                if (hay.indexOf(txSearchQuery) === -1) return false;
            }
            return true;
        }

        function onTxSearchOrMonthChange() {
            var sInp = document.getElementById('tx-search-input');
            var mSel = document.getElementById('tx-month-filter');
            txSearchQuery = sInp ? String(sInp.value || '').trim().toLowerCase() : '';
            txMonthFilter = mSel ? String(mSel.value || 'ALL') : 'ALL';
            txCurrentPage = 1;
            applyTxDisplay();
        }

        function clearTxSearchFilters() {
            var sInp = document.getElementById('tx-search-input');
            var mSel = document.getElementById('tx-month-filter');
            if (sInp) sInp.value = '';
            if (mSel) mSel.value = 'ALL';
            txSearchQuery = '';
            txMonthFilter = 'ALL';
            setTxFilter('ALL');
        }

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
                if (matchesTxItem(el)) {
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
            var filteredSumKes = 0;

            mobileItems.forEach(function(el) {
                if (matchesTxItem(el)) {
                    matchingTotal++;
                    var amt = parseFloat(el.getAttribute('data-tx-amount') || '0') || 0;
                    var tType = el.getAttribute('data-tx-type');
                    if (tType === 'INCOME') filteredSumKes += amt;
                    else if (tType === 'EXPENSE') filteredSumKes -= amt;
                }
            });

            var sumPill = document.getElementById('tx-filtered-summary-pill');
            if (sumPill) {
                if (txSearchQuery || (txMonthFilter && txMonthFilter !== 'ALL') || txCurrentFilter !== 'ALL') {
                    sumPill.classList.remove('hidden');
                    var sign = filteredSumKes >= 0 ? '+' : '-';
                    sumPill.textContent = matchingTotal + ' match' + (matchingTotal === 1 ? '' : 'es') + ' • Net: ' + sign + 'Ksh ' + Math.abs(filteredSumKes).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                } else {
                    sumPill.classList.add('hidden');
                }
            }

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
                if (matchesTxItem(el)) {
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
                if (matchesTxItem(el)) {
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

        var accCurrentPage = 1;
        var accPageSize = 5;
        var accCurrentFilter = 'ALL';

        function matchesAccFilter(itemType, filter) {
            if (!filter || filter === 'ALL') return true;
            var t = String(itemType || '').toUpperCase().trim();
            var f = String(filter || '').toUpperCase().trim();
            if (f === 'SAVINGS_MMF') {
                return t === 'MMF' || t === 'SAVINGS' || t.indexOf('MMF') !== -1 || t.indexOf('SAVING') !== -1 || t.indexOf('SACCO') !== -1 || t.indexOf('LOCK') !== -1;
            }
            if (f === 'CASH') {
                return t === 'CASH' || t === 'LOOP' || t.indexOf('CASH') !== -1 || t.indexOf('PETTY') !== -1;
            }
            if (f === 'MOBILE') {
                return t === 'MOBILE' || t === 'MPESA' || t === 'M-PESA' || t.indexOf('MOBILE') !== -1;
            }
            if (f === 'BANK') {
                return t === 'BANK' || t.indexOf('BANK') !== -1;
            }
            return t === f;
        }

        function setAccFilter(type) {
            accCurrentFilter = type;
            accCurrentPage = 1;
            document.querySelectorAll('.acc-filter-btn').forEach(function(b) {
                b.className = 'acc-filter-btn px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer';
            });
            var activeBtn = document.getElementById('acc-filter-btn-' + type);
            if (activeBtn) {
                activeBtn.className = 'acc-filter-btn px-2.5 py-1 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs font-bold transition cursor-pointer';
            }
            applyAccDisplay();
        }

        function accGoToPage(p) {
            accCurrentPage = Number(p) || 1;
            applyAccDisplay();
            var card = document.getElementById('accounts-card');
            if (card) {
                try {
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } catch(e) {}
            }
        }

        function accPrevPage() {
            if (accCurrentPage > 1) {
                accGoToPage(accCurrentPage - 1);
            }
        }

        function accNextPage() {
            var items = document.querySelectorAll('.account-row-item');
            var matchingTotal = 0;
            items.forEach(function(el) {
                var itemType = el.getAttribute('data-acc-type');
                if (matchesAccFilter(itemType, accCurrentFilter)) {
                    matchingTotal++;
                }
            });
            var totalPages = Math.max(1, Math.ceil(matchingTotal / accPageSize));
            if (accCurrentPage < totalPages) {
                accGoToPage(accCurrentPage + 1);
            }
        }

        function applyAccDisplay() {
            var items = document.querySelectorAll('.account-row-item');
            var matchingTotal = 0;

            items.forEach(function(el) {
                var itemType = el.getAttribute('data-acc-type');
                if (matchesAccFilter(itemType, accCurrentFilter)) {
                    matchingTotal++;
                }
            });

            var totalPages = Math.max(1, Math.ceil(matchingTotal / accPageSize));
            if (accCurrentPage > totalPages) accCurrentPage = totalPages;
            if (accCurrentPage < 1) accCurrentPage = 1;

            var startIdx = (accCurrentPage - 1) * accPageSize;
            var endIdx = startIdx + accPageSize;

            var idx = 0;
            items.forEach(function(el) {
                var itemType = el.getAttribute('data-acc-type');
                if (matchesAccFilter(itemType, accCurrentFilter)) {
                    if (idx >= startIdx && idx < endIdx) {
                        el.classList.remove('hidden');
                    } else {
                        el.classList.add('hidden');
                    }
                    idx++;
                } else {
                    el.classList.add('hidden');
                }
            });

            var startDisplay = matchingTotal === 0 ? 0 : startIdx + 1;
            var endDisplay = Math.min(endIdx, matchingTotal);

            var rangeEl = document.getElementById('acc-visible-range');
            if (rangeEl) rangeEl.innerText = startDisplay + '–' + endDisplay;

            var totalEl = document.getElementById('acc-total-filtered-count');
            if (totalEl) totalEl.innerText = String(matchingTotal);

            var pageInfoEl = document.getElementById('acc-page-info');
            if (pageInfoEl) pageInfoEl.innerText = 'Page ' + accCurrentPage + ' of ' + totalPages;

            var prevBtn = document.getElementById('acc-prev-btn');
            if (prevBtn) {
                if (accCurrentPage <= 1) {
                    prevBtn.disabled = true;
                    prevBtn.classList.add('opacity-40', 'cursor-not-allowed');
                    prevBtn.classList.remove('cursor-pointer', 'active:scale-95');
                } else {
                    prevBtn.disabled = false;
                    prevBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                    prevBtn.classList.add('cursor-pointer', 'active:scale-95');
                }
            }

            var nextBtn = document.getElementById('acc-next-btn');
            if (nextBtn) {
                if (accCurrentPage >= totalPages) {
                    nextBtn.disabled = true;
                    nextBtn.classList.add('opacity-40', 'cursor-not-allowed');
                    nextBtn.classList.remove('cursor-pointer', 'active:scale-95');
                } else {
                    nextBtn.disabled = false;
                    nextBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                    nextBtn.classList.add('cursor-pointer', 'active:scale-95');
                }
            }

            var paginationContainer = document.getElementById('acc-pagination-controls');
            if (paginationContainer) {
                if (matchingTotal <= accPageSize) {
                    paginationContainer.classList.add('hidden');
                } else {
                    paginationContainer.classList.remove('hidden');
                }
            }

            var pagesContainer = document.getElementById('acc-pagination-pages');
            if (pagesContainer) {
                var html = '';
                for (var p = 1; p <= totalPages; p++) {
                    var isActive = p === accCurrentPage;
                    html += '<button type="button" onclick="accGoToPage(' + p + ')" class="w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ' +
                        (isActive ? 'bg-emerald-600 text-white shadow-xs' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700') + '">' + p + '</button>';
                }
                pagesContainer.innerHTML = html;
            }
        }

        var debtCurrentPage = 1;
        var debtPageSize = 4;
        var debtCurrentFilter = 'all';

        function switchDebtTab(filter) {
            debtCurrentFilter = filter;
            debtCurrentPage = 1;
            ['all', 'borrowed', 'lent', 'danger'].forEach(function(tab) {
                var btn = document.getElementById('debt-tab-btn-' + tab);
                if (btn) {
                    if (tab === filter) {
                        btn.className = 'debt-tab-btn px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs bg-indigo-600 text-white cursor-pointer';
                    } else {
                        btn.className = 'debt-tab-btn px-3 py-1.5 rounded-xl text-xs font-bold transition bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer';
                    }
                }
            });
            applyDebtDisplay();
        }

        function debtGoToPage(p) {
            debtCurrentPage = p;
            applyDebtDisplay();
            var card = document.getElementById('debts-card');
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function debtPrevPage() {
            if (debtCurrentPage > 1) {
                debtGoToPage(debtCurrentPage - 1);
            }
        }

        function debtNextPage() {
            var cards = document.querySelectorAll('.debt-card-item');
            var matchingTotal = 0;
            cards.forEach(function(card) {
                var isBorrowed = card.getAttribute('data-debt-type') === 'I_OWE';
                var isDanger = card.getAttribute('data-is-danger') === 'true';
                if (debtCurrentFilter === 'all' ||
                    (debtCurrentFilter === 'borrowed' && isBorrowed) ||
                    (debtCurrentFilter === 'lent' && !isBorrowed) ||
                    (debtCurrentFilter === 'danger' && isDanger)) {
                    matchingTotal++;
                }
            });
            var totalPages = Math.max(1, Math.ceil(matchingTotal / debtPageSize));
            if (debtCurrentPage < totalPages) {
                debtGoToPage(debtCurrentPage + 1);
            }
        }

        function applyDebtDisplay() {
            var cards = document.querySelectorAll('.debt-card-item');
            var matchingTotal = 0;
            cards.forEach(function(card) {
                var isBorrowed = card.getAttribute('data-debt-type') === 'I_OWE';
                var isDanger = card.getAttribute('data-is-danger') === 'true';
                if (debtCurrentFilter === 'all' ||
                    (debtCurrentFilter === 'borrowed' && isBorrowed) ||
                    (debtCurrentFilter === 'lent' && !isBorrowed) ||
                    (debtCurrentFilter === 'danger' && isDanger)) {
                    matchingTotal++;
                }
            });

            var totalPages = Math.max(1, Math.ceil(matchingTotal / debtPageSize));
            if (debtCurrentPage > totalPages) debtCurrentPage = totalPages;
            if (debtCurrentPage < 1) debtCurrentPage = 1;

            var startIdx = (debtCurrentPage - 1) * debtPageSize;
            var endIdx = startIdx + debtPageSize;

            var idx = 0;
            cards.forEach(function(card) {
                var isBorrowed = card.getAttribute('data-debt-type') === 'I_OWE';
                var isDanger = card.getAttribute('data-is-danger') === 'true';
                if (debtCurrentFilter === 'all' ||
                    (debtCurrentFilter === 'borrowed' && isBorrowed) ||
                    (debtCurrentFilter === 'lent' && !isBorrowed) ||
                    (debtCurrentFilter === 'danger' && isDanger)) {
                    if (idx >= startIdx && idx < endIdx) {
                        card.classList.remove('hidden');
                    } else {
                        card.classList.add('hidden');
                    }
                    idx++;
                } else {
                    card.classList.add('hidden');
                }
            });

            var startDisplay = matchingTotal === 0 ? 0 : startIdx + 1;
            var endDisplay = Math.min(endIdx, matchingTotal);

            var rangeEl = document.getElementById('debt-visible-range');
            if (rangeEl) rangeEl.innerText = startDisplay + '–' + endDisplay;

            var totalEl = document.getElementById('debt-total-filtered-count');
            if (totalEl) totalEl.innerText = String(matchingTotal);

            var pageInfoEl = document.getElementById('debt-page-info');
            if (pageInfoEl) pageInfoEl.innerText = 'Page ' + debtCurrentPage + ' of ' + totalPages;

            var prevBtn = document.getElementById('debt-prev-btn');
            if (prevBtn) {
                if (debtCurrentPage <= 1) {
                    prevBtn.disabled = true;
                    prevBtn.classList.add('opacity-40', 'cursor-not-allowed');
                    prevBtn.classList.remove('cursor-pointer', 'active:scale-95');
                } else {
                    prevBtn.disabled = false;
                    prevBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                    prevBtn.classList.add('cursor-pointer', 'active:scale-95');
                }
            }

            var nextBtn = document.getElementById('debt-next-btn');
            if (nextBtn) {
                if (debtCurrentPage >= totalPages) {
                    nextBtn.disabled = true;
                    nextBtn.classList.add('opacity-40', 'cursor-not-allowed');
                    nextBtn.classList.remove('cursor-pointer', 'active:scale-95');
                } else {
                    nextBtn.disabled = false;
                    nextBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                    nextBtn.classList.add('cursor-pointer', 'active:scale-95');
                }
            }

            var paginationContainer = document.getElementById('debt-pagination-controls');
            if (paginationContainer) {
                if (matchingTotal <= debtPageSize) {
                    paginationContainer.classList.add('hidden');
                } else {
                    paginationContainer.classList.remove('hidden');
                }
            }

            var pagesContainer = document.getElementById('debt-pagination-pages');
            if (pagesContainer) {
                var html = '';
                for (var p = 1; p <= totalPages; p++) {
                    var isActive = p === debtCurrentPage;
                    html += '<button type="button" onclick="debtGoToPage(' + p + ')" class="w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ' +
                        (isActive ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700') + '">' + p + '</button>';
                }
                pagesContainer.innerHTML = html;
            }
        }

        var mmfCurrentPage = 1;
        var mmfPageSize = 3;

        function mmfGoToPage(p) {
            mmfCurrentPage = Number(p) || 1;
            applyMmfDisplay();
            var card = document.getElementById('mmf-card');
            if (card) {
                try {
                    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } catch(e) {}
            }
        }

        function mmfPrevPage() {
            if (mmfCurrentPage > 1) mmfGoToPage(mmfCurrentPage - 1);
        }

        function mmfNextPage() {
            var items = document.querySelectorAll('.mmf-card-item');
            var totalPages = Math.max(1, Math.ceil(items.length / mmfPageSize));
            if (mmfCurrentPage < totalPages) mmfGoToPage(mmfCurrentPage + 1);
        }

        function applyMmfDisplay() {
            var items = document.querySelectorAll('.mmf-card-item');
            var totalPages = Math.max(1, Math.ceil(items.length / mmfPageSize));
            if (mmfCurrentPage > totalPages) mmfCurrentPage = totalPages;
            if (mmfCurrentPage < 1) mmfCurrentPage = 1;

            var startIdx = (mmfCurrentPage - 1) * mmfPageSize;
            var endIdx = startIdx + mmfPageSize;

            items.forEach(function(item, idx) {
                if (idx >= startIdx && idx < endIdx) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });

            var startDisplay = items.length === 0 ? 0 : startIdx + 1;
            var endDisplay = Math.min(endIdx, items.length);

            var rangeEl = document.getElementById('mmf-visible-range');
            if (rangeEl) rangeEl.innerText = startDisplay + '–' + endDisplay;

            var totalEl = document.getElementById('mmf-total-filtered-count');
            if (totalEl) totalEl.innerText = String(items.length);

            var pageInfoEl = document.getElementById('mmf-page-info');
            if (pageInfoEl) pageInfoEl.innerText = 'Page ' + mmfCurrentPage + ' of ' + totalPages;

            var prevBtn = document.getElementById('mmf-prev-btn');
            if (prevBtn) {
                if (mmfCurrentPage <= 1) {
                    prevBtn.disabled = true;
                    prevBtn.classList.add('opacity-40', 'cursor-not-allowed');
                    prevBtn.classList.remove('cursor-pointer', 'active:scale-95');
                } else {
                    prevBtn.disabled = false;
                    prevBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                    prevBtn.classList.add('cursor-pointer', 'active:scale-95');
                }
            }

            var nextBtn = document.getElementById('mmf-next-btn');
            if (nextBtn) {
                if (mmfCurrentPage >= totalPages) {
                    nextBtn.disabled = true;
                    nextBtn.classList.add('opacity-40', 'cursor-not-allowed');
                    nextBtn.classList.remove('cursor-pointer', 'active:scale-95');
                } else {
                    nextBtn.disabled = false;
                    nextBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                    nextBtn.classList.add('cursor-pointer', 'active:scale-95');
                }
            }

            var paginationContainer = document.getElementById('mmf-pagination-controls');
            if (paginationContainer) {
                if (items.length <= mmfPageSize) {
                    paginationContainer.classList.add('hidden');
                } else {
                    paginationContainer.classList.remove('hidden');
                }
            }

            var pagesContainer = document.getElementById('mmf-pagination-pages');
            if (pagesContainer) {
                var html = '';
                for (var p = 1; p <= totalPages; p++) {
                    var isActive = p === mmfCurrentPage;
                    html += '<button type="button" onclick="mmfGoToPage(' + p + ')" class="w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ' +
                        (isActive ? 'bg-amber-600 text-white shadow-xs' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700') + '">' + p + '</button>';
                }
                pagesContainer.innerHTML = html;
            }
        }

        function updateThemeIcon() {
            const isDark = document.documentElement.classList.contains('dark');
            const btns = document.querySelectorAll('.dark-mode-toggle-btn');
            btns.forEach(btn => {
                btn.innerHTML = isDark ? '☀️' : '🌙';
                btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
            });
            const isBlurred = document.documentElement.classList.contains('privacy-blur');
            document.querySelectorAll('.privacy-toggle-btn').forEach(btn => {
                btn.innerHTML = isBlurred ? '🙈' : '👁️';
                btn.title = isBlurred ? 'Show Balances (Privacy Mode On)' : 'Hide Balances (Privacy Mode)';
            });
        }

        function toggleDarkMode() {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            updateThemeIcon();
        }

        function togglePrivacyBlur() {
            const isBlurred = document.documentElement.classList.toggle('privacy-blur');
            localStorage.setItem('finatrack_privacy_blur', isBlurred ? '1' : '0');
            updateThemeIcon();
        }
        window.togglePrivacyBlur = togglePrivacyBlur;

        // Expose pagination & filter functions globally to guarantee inline button clicks always work
        window.accNextPage = accNextPage;
        window.accPrevPage = accPrevPage;
        window.accGoToPage = accGoToPage;
        window.setAccFilter = setAccFilter;
        window.applyAccDisplay = applyAccDisplay;

        window.mmfNextPage = mmfNextPage;
        window.mmfPrevPage = mmfPrevPage;
        window.mmfGoToPage = mmfGoToPage;
        window.applyMmfDisplay = applyMmfDisplay;

        window.debtNextPage = debtNextPage;
        window.debtPrevPage = debtPrevPage;
        window.debtGoToPage = debtGoToPage;
        window.applyDebtDisplay = applyDebtDisplay;

        window.txNextPage = txNextPage;
        window.txPrevPage = txPrevPage;
        window.txGoToPage = txGoToPage;
        window.applyTxDisplay = applyTxDisplay;
        window.onTxSearchOrMonthChange = onTxSearchOrMonthChange;
        window.clearTxSearchFilters = clearTxSearchFilters;

        function initFinanceDashboard() {
            try {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
                updateThemeIcon();
            } catch(e) {}
            try { applyConversion(); } catch(e) { console.warn('applyConversion error', e); }
            try { updateSplitBreakdown(); } catch(e) { console.warn('updateSplitBreakdown error', e); }
            try { updateRulesModalTotal(); } catch(e) { console.warn('updateRulesModalTotal error', e); }
            try { applyAccDisplay(); } catch(e) { console.warn('applyAccDisplay error', e); }
            try { applyDebtDisplay(); } catch(e) { console.warn('applyDebtDisplay error', e); }
            try { applyMmfDisplay(); } catch(e) { console.warn('applyMmfDisplay error', e); }
            try {
                if (!isRunningStandalone()) {
                    showInstallUi();
                }
            } catch(e) {}
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initFinanceDashboard);
        } else {
            initFinanceDashboard();
        }

        function openRulesModal(focusAdd) {
            var m = document.getElementById('rules-modal');
            if (m) {
                m.classList.remove('hidden');
                updateRulesModalTotal();
                if (focusAdd) {
                    addCustomRuleRow('', '✨', 10, 'CASH', '');
                }
            }
        }

        function syncOrderedRuleIds() {
            var container = document.getElementById('rules-list-container');
            var ids = [];
            if (container) {
                container.querySelectorAll('.rule-row-card').forEach(function(row) {
                    var rid = row.getAttribute('data-rule-id');
                    if (rid) ids.push(rid);
                });
            }
            var orderedInput = document.getElementById('ordered-rule-ids');
            if (orderedInput) orderedInput.value = ids.join(',');
            var countBadge = document.getElementById('rules-count-badge');
            if (countBadge) countBadge.innerText = ids.length + (ids.length === 1 ? ' Option' : ' Options');
            return ids;
        }

        function updateRulesModalTotal() {
            var total = 0;
            var container = document.getElementById('rules-list-container');
            if (container) {
                container.querySelectorAll('.rule-pct-input').forEach(function(input) {
                    total += parseFloat(input.value) || 0;
                });
            }
            total = Math.round(total * 10) / 10;
            var totalEl = document.getElementById('rules-modal-total');
            var barEl = document.getElementById('rules-modal-bar');
            var badgeEl = document.getElementById('rules-modal-badge');
            var pctText = (total % 1 === 0) ? total.toFixed(0) : total.toFixed(1);
            if (totalEl) totalEl.innerText = pctText + '%';
            if (barEl) {
                barEl.style.width = Math.min(100, Math.max(0, total)) + '%';
                if (Math.abs(total - 100) < 0.05) {
                    barEl.className = 'h-full rounded-full transition-all duration-300 bg-emerald-500';
                } else if (total < 100) {
                    barEl.className = 'h-full rounded-full transition-all duration-300 bg-amber-500';
                } else {
                    barEl.className = 'h-full rounded-full transition-all duration-300 bg-rose-500';
                }
            }
            if (badgeEl) {
                if (Math.abs(total - 100) < 0.05) {
                    badgeEl.className = 'px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
                    badgeEl.innerText = '✅ 100% (Balanced)';
                } else if (total < 100) {
                    var diff = Math.round((100 - total) * 10) / 10;
                    badgeEl.className = 'px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800';
                    badgeEl.innerText = '⚠️ ' + diff + '% unallocated';
                } else {
                    var over = Math.round((total - 100) * 10) / 10;
                    badgeEl.className = 'px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800';
                    badgeEl.innerText = '🚨 Exceeds by ' + over + '%';
                }
            }
            syncOrderedRuleIds();
        }

        function addCustomRuleRow(presetName, presetIcon, presetPct, presetType, presetTargetId) {
            var container = document.getElementById('rules-list-container');
            if (!container) return;

            var currentTotal = 0;
            container.querySelectorAll('.rule-pct-input').forEach(function(input) {
                currentTotal += parseFloat(input.value) || 0;
            });
            var defaultPct = presetPct !== undefined && presetPct !== null ? presetPct : 10;
            if (currentTotal < 100 && (!presetPct || presetName === '')) {
                defaultPct = Math.max(1, Math.round((100 - currentTotal) * 10) / 10);
            }

            var newId = 'custom_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            var iconVal = presetIcon || '✨';
            var nameVal = presetName || '';
            var typeVal = presetType || 'CASH';
            var targetIdVal = presetTargetId || '';

            var targetOptionsHtml = '<option value="">-- Smart Auto-Match / Any --</option>';
            var tpl = document.getElementById('rule-target-options-template');
            if (tpl) {
                targetOptionsHtml = tpl.innerHTML;
            }

            var rowDiv = document.createElement('div');
            rowDiv.className = 'rule-row-card p-3 bg-indigo-50/40 dark:bg-indigo-950/30 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50 rounded-2xl border border-indigo-200 dark:border-indigo-800/70 space-y-2.5 transition';
            rowDiv.setAttribute('data-rule-id', newId);

            rowDiv.innerHTML =
                '<div class="flex items-center gap-2">' +
                    '<input type="text" name="icon_' + newId + '" value="' + iconVal + '" class="w-10 p-2 text-center text-base bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-bold shrink-0">' +
                    '<input type="text" name="bucket_name_' + newId + '" value="' + nameVal.replace(/"/g, '&quot;') + '" placeholder="Enter your custom option name (e.g. Emergency Fund, Tithe, Chama)" class="rule-name-input flex-1 p-2 text-xs font-bold bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500" required>' +
                    '<div class="flex items-center space-x-1 shrink-0">' +
                        '<input type="number" step="any" min="0" max="100" inputmode="decimal" name="percentage_' + newId + '" value="' + defaultPct + '" oninput="updateRulesModalTotal()" class="rule-pct-input w-16 p-2 text-xs font-black text-center bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500" required>' +
                        '<span class="text-xs font-bold text-gray-500">%</span>' +
                    '</div>' +
                    '<button type="button" data-remove-id="' + newId + '" onclick="removeRuleRow(this.getAttribute(&quot;data-remove-id&quot;))" title="Remove Option" class="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition shrink-0 cursor-pointer">🗑️</button>' +
                '</div>' +
                '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-indigo-200/60 dark:border-indigo-800/50">' +
                    '<div>' +
                        '<label class="block text-[10px] font-semibold text-gray-400 mb-0.5">Option / Bucket Type</label>' +
                        '<select name="target_type_' + newId + '" class="w-full p-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">' +
                            '<option value="ACCOUNT"' + (typeVal === 'ACCOUNT' ? ' selected' : '') + '>🏦 Bank / MMF / Sacco / Wallet</option>' +
                            '<option value="GOAL"' + (typeVal === 'GOAL' ? ' selected' : '') + '>🎯 Savings Goal</option>' +
                            '<option value="DEBT"' + (typeVal === 'DEBT' ? ' selected' : '') + '>💳 Loan / Debt Repayment</option>' +
                            '<option value="BILL"' + (typeVal === 'BILL' ? ' selected' : '') + '>⚡ Recurring Bill / Utility</option>' +
                            '<option value="CASH"' + (typeVal === 'CASH' ? ' selected' : '') + '>💵 Daily Cash / Living / Float</option>' +
                            '<option value="CUSTOM"' + (typeVal === 'CUSTOM' ? ' selected' : '') + '>✨ Custom / Independent Option</option>' +
                        '</select>' +
                    '</div>' +
                    '<div>' +
                        '<label class="block text-[10px] font-semibold text-gray-400 mb-0.5">Destination Account / Goal / Loan</label>' +
                        '<select name="target_id_' + newId + '" class="rule-target-select w-full p-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">' +
                            targetOptionsHtml +
                        '</select>' +
                    '</div>' +
                '</div>';

            container.appendChild(rowDiv);
            if (targetIdVal) {
                var sel = rowDiv.querySelector('.rule-target-select');
                if (sel) sel.value = targetIdVal;
            }
            updateRulesModalTotal();
            rowDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            var nameInput = rowDiv.querySelector('.rule-name-input');
            if (nameInput) nameInput.focus();
        }

        function addInlineNewRuleToList() {
            var nameEl = document.getElementById('inline-new-bucket-name');
            var pctEl = document.getElementById('inline-new-percentage');
            var iconEl = document.getElementById('inline-new-icon');
            var typeEl = document.getElementById('inline-new-target-type');
            var targetEl = document.getElementById('inline-new-target-id');

            var name = nameEl ? nameEl.value.trim() : '';
            if (!name) {
                if (nameEl) nameEl.focus();
                return;
            }
            var pct = pctEl ? (parseFloat(pctEl.value) || 10) : 10;
            var icon = iconEl ? (iconEl.value.trim() || '✨') : '✨';
            var type = typeEl ? typeEl.value : 'CASH';
            var targetId = targetEl ? targetEl.value : '';

            addCustomRuleRow(name, icon, pct, type, targetId);
            if (nameEl) nameEl.value = '';
            if (pctEl) pctEl.value = '10';
            var drawer = document.getElementById('add-rule-form-container');
            if (drawer) drawer.classList.add('hidden');
        }

        function removeRuleRow(ruleId) {
            var container = document.getElementById('rules-list-container');
            if (!container) return;
            var rows = container.querySelectorAll('.rule-row-card');
            if (rows.length <= 1) {
                alert('You must keep at least 1 split rule option.');
                return;
            }
            var targetRow = null;
            rows.forEach(function(r) {
                if (r.getAttribute('data-rule-id') === String(ruleId)) targetRow = r;
            });
            if (targetRow) {
                targetRow.remove();
                var delInput = document.getElementById('deleted-rule-ids');
                if (delInput) {
                    var existing = delInput.value ? delInput.value.split(',').filter(Boolean) : [];
                    if (existing.indexOf(String(ruleId)) === -1) existing.push(String(ruleId));
                    delInput.value = existing.join(',');
                }
                updateRulesModalTotal();
            }
        }

        function balanceRulesTo100() {
            var container = document.getElementById('rules-list-container');
            if (!container) return;
            var inputs = Array.from(container.querySelectorAll('.rule-pct-input'));
            if (inputs.length === 0) return;

            var currentSum = 0;
            inputs.forEach(function(inp) {
                currentSum += Math.max(0, parseFloat(inp.value) || 0);
            });

            if (currentSum <= 0) {
                distributeRulesEvenly();
                return;
            }

            var runningSum = 0;
            inputs.forEach(function(inp, idx) {
                if (idx === inputs.length - 1) {
                    var rem = Math.max(0, Math.round((100 - runningSum) * 10) / 10);
                    inp.value = String(rem);
                } else {
                    var raw = Math.max(0, parseFloat(inp.value) || 0);
                    var scaled = Math.round(((raw / currentSum) * 100) * 10) / 10;
                    inp.value = String(scaled);
                    runningSum = Math.round((runningSum + scaled) * 10) / 10;
                }
            });
            updateRulesModalTotal();
        }

        function distributeRulesEvenly() {
            var container = document.getElementById('rules-list-container');
            if (!container) return;
            var inputs = Array.from(container.querySelectorAll('.rule-pct-input'));
            if (inputs.length === 0) return;

            var baseShare = Math.floor((100 / inputs.length) * 10) / 10;
            var sum = 0;
            inputs.forEach(function(inp, idx) {
                if (idx === inputs.length - 1) {
                    var rem = Math.max(0, Math.round((100 - sum) * 10) / 10);
                    inp.value = String(rem);
                } else {
                    inp.value = String(baseShare);
                    sum = Math.round((sum + baseShare) * 10) / 10;
                }
            });
            updateRulesModalTotal();
        }

        function saveRulesLocally(e) {
            try {
                syncOrderedRuleIds();
                var container = document.getElementById('rules-list-container');
                if (!container) return;
                var savedList = [];
                container.querySelectorAll('.rule-row-card').forEach(function(row) {
                    var id = row.getAttribute('data-rule-id');
                    if (!id) return;
                    var iconInp = row.querySelector('input[name="icon_' + id + '"]');
                    var nameInp = row.querySelector('input[name="bucket_name_' + id + '"]');
                    var pctInp = row.querySelector('input[name="percentage_' + id + '"]');
                    var typeSel = row.querySelector('select[name="target_type_' + id + '"]');
                    var targetSel = row.querySelector('select[name="target_id_' + id + '"]');
                    savedList.push({
                        id: String(id),
                        bucket_name: nameInp && nameInp.value ? nameInp.value.trim() : 'Custom Option',
                        icon: iconInp && iconInp.value ? iconInp.value.trim() : '💰',
                        percentage: pctInp ? (parseFloat(pctInp.value) || 0) : 0,
                        target_type: typeSel ? typeSel.value : 'CASH',
                        target_id: targetSel && targetSel.value ? targetSel.value : null,
                        is_active: 1
                    });
                });
                var inlineNameEl = document.getElementById('inline-new-bucket-name');
                if (inlineNameEl && inlineNameEl.value && inlineNameEl.value.trim() !== '') {
                    var inlinePctEl = document.getElementById('inline-new-percentage');
                    var inlineIconEl = document.getElementById('inline-new-icon');
                    var inlineTypeEl = document.getElementById('inline-new-target-type');
                    var inlineTargetEl = document.getElementById('inline-new-target-id');
                    savedList.push({
                        id: 'custom_' + Date.now(),
                        bucket_name: inlineNameEl.value.trim(),
                        icon: inlineIconEl && inlineIconEl.value ? inlineIconEl.value.trim() : '✨',
                        percentage: inlinePctEl ? (parseFloat(inlinePctEl.value) || 10) : 10,
                        target_type: inlineTypeEl ? inlineTypeEl.value : 'CASH',
                        target_id: inlineTargetEl && inlineTargetEl.value ? inlineTargetEl.value : null,
                        is_active: 1
                    });
                }
                if (savedList.length > 0) {
                    document.cookie = 'finatrack_allocation_rules=' + encodeURIComponent(JSON.stringify(savedList)) + '; path=/; max-age=31536000; SameSite=Lax';
                }
            } catch (err) {
                console.warn('Could not pre-save rules cookie locally:', err);
            }
        }

        function setSplitAmountPreset(amt) {
            var inputEl = document.getElementById('split-amount-input');
            if (inputEl) {
                inputEl.value = String(amt);
                updateSplitBreakdown();
                inputEl.focus();
            }
        }

        function applySplitRatioPresetClient(presetKey) {
            var presets = {
                PAY_YOURSELF_FLEET: [
                    { bucket_name: 'Pay Yourself #1: Ziidi / Britam MMF', icon: '👑', percentage: 15, target_type: 'ACCOUNT' },
                    { bucket_name: 'Pay Yourself #2: Lock / Sacco Savings', icon: '🔒', percentage: 15, target_type: 'ACCOUNT' },
                    { bucket_name: 'Savings Goals (Malindi & Home)', icon: '🎯', percentage: 20, target_type: 'GOAL' },
                    { bucket_name: 'Recurring Bills & Rent Reserve', icon: '⚡', percentage: 15, target_type: 'BILL' },
                    { bucket_name: 'Fleet Service & Docs Reserve', icon: '🛠️', percentage: 10, target_type: 'ACCOUNT' },
                    { bucket_name: 'Daily Living & Personal Pocket', icon: '💵', percentage: 25, target_type: 'CASH' }
                ],
                AGGRESSIVE_WEALTH: [
                    { bucket_name: 'Pay Yourself #1: Ziidi / Britam MMF', icon: '👑', percentage: 25, target_type: 'ACCOUNT' },
                    { bucket_name: 'Pay Yourself #2: Lock / Sacco Savings', icon: '🔒', percentage: 15, target_type: 'ACCOUNT' },
                    { bucket_name: 'Savings Goals (Malindi & Home)', icon: '🎯', percentage: 20, target_type: 'GOAL' },
                    { bucket_name: 'Bills & Fleet Maintenance Reserve', icon: '⚡', percentage: 15, target_type: 'ACCOUNT' },
                    { bucket_name: 'Daily Living & Personal Pocket', icon: '💵', percentage: 25, target_type: 'CASH' }
                ],
                DEBT_CRUSHER: [
                    { bucket_name: 'Pay Yourself First (MMF / Sacco)', icon: '👑', percentage: 20, target_type: 'ACCOUNT' },
                    { bucket_name: 'Loan / Debt Crusher Payoff', icon: '💳', percentage: 20, target_type: 'DEBT' },
                    { bucket_name: 'Savings Goals (Malindi & Home)', icon: '🎯', percentage: 15, target_type: 'GOAL' },
                    { bucket_name: 'Bills & Fleet Maintenance Reserve', icon: '⚡', percentage: 15, target_type: 'ACCOUNT' },
                    { bucket_name: 'Daily Living & Personal Pocket', icon: '💵', percentage: 30, target_type: 'CASH' }
                ],
                DEFAULT_5: [
                    { bucket_name: 'Ziidi MMF (Safaricom)', icon: '📈', percentage: 20, target_type: 'ACCOUNT' },
                    { bucket_name: 'Lock / Sacco Savings', icon: '🔒', percentage: 20, target_type: 'ACCOUNT' },
                    { bucket_name: 'Savings Goals', icon: '🎯', percentage: 15, target_type: 'GOAL' },
                    { bucket_name: 'Recurring Bills Reserve', icon: '⚡', percentage: 15, target_type: 'ACCOUNT' },
                    { bucket_name: 'Daily Living Expenses', icon: '💵', percentage: 30, target_type: 'CASH' }
                ]
            };

            var list = presets[presetKey] || presets.PAY_YOURSELF_FLEET;
            var container = document.getElementById('rules-list-container');
            if (!container) return;

            var delInput = document.getElementById('deleted-rule-ids');
            var existingDeleted = (delInput && delInput.value) ? delInput.value.split(',').filter(Boolean) : [];
            container.querySelectorAll('.rule-row-card').forEach(function(row) {
                var rid = row.getAttribute('data-rule-id');
                if (rid && existingDeleted.indexOf(rid) === -1) existingDeleted.push(rid);
            });
            if (delInput) delInput.value = existingDeleted.join(',');

            container.innerHTML = '';
            list.forEach(function(item) {
                addCustomRuleRow(item.bucket_name, item.icon, item.percentage, item.target_type, '');
            });
            updateRulesModalTotal();
        }

        function applyGoalPreset(title, targetKes, splitPct, monthsAhead, horizonType) {
            var drawer = document.getElementById('new-goal-form-container');
            if (drawer) {
                drawer.classList.remove('hidden');
                var titleInp = drawer.querySelector('input[name="title"]');
                var amtInp = drawer.querySelector('input[name="target_amount"]');
                var splitInp = drawer.querySelector('input[name="split_percentage"]');
                var dateInp = drawer.querySelector('input[name="target_date"]');
                var horizonSel = document.getElementById('new_goal_horizon_select');
                if (titleInp) titleInp.value = title;
                if (amtInp) amtInp.value = String(targetKes);
                if (splitInp) splitInp.value = String(splitPct || 25);
                if (dateInp && monthsAhead) {
                    var d = new Date();
                    d.setMonth(d.getMonth() + Number(monthsAhead));
                    dateInp.value = d.toISOString().slice(0, 10);
                }
                if (horizonSel) {
                    if (horizonType === 'SHORT_TERM' || horizonType === 'LONG_TERM') {
                        horizonSel.value = horizonType;
                    } else if (monthsAhead) {
                        horizonSel.value = Number(monthsAhead) <= 6 ? 'SHORT_TERM' : 'LONG_TERM';
                    }
                }
                drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        function onGoalDeadlineInputChanged(dateVal) {
            if (!dateVal) return;
            var horizonSel = document.getElementById('new_goal_horizon_select');
            if (!horizonSel) return;
            var targetMs = Date.parse(String(dateVal).slice(0, 10));
            var nowMs = Date.parse(new Date().toISOString().slice(0, 10));
            if (!isNaN(targetMs)) {
                var diffDays = Math.round((targetMs - nowMs) / 86400000);
                horizonSel.value = diffDays <= 185 ? 'SHORT_TERM' : 'LONG_TERM';
            }
        }

        function filterGoalsByHorizon(horizonFilter) {
            var cards = document.querySelectorAll('.goal-card-item');
            var visibleCount = 0;
            cards.forEach(function(card) {
                var h = card.getAttribute('data-goal-horizon') || 'SHORT_TERM';
                if (!horizonFilter || horizonFilter === 'ALL' || h === horizonFilter) {
                    card.classList.remove('hidden');
                    visibleCount++;
                } else {
                    card.classList.add('hidden');
                }
            });

            var emptyFilterEl = document.getElementById('goals-filter-empty-state');
            if (emptyFilterEl) {
                if (cards.length > 0 && visibleCount === 0) {
                    emptyFilterEl.classList.remove('hidden');
                } else {
                    emptyFilterEl.classList.add('hidden');
                }
            }

            ['ALL', 'SHORT_TERM', 'LONG_TERM'].forEach(function(key) {
                var btn = document.getElementById('goal-horizon-tab-' + key);
                if (!btn) return;
                if (key === horizonFilter) {
                    btn.className = 'px-3 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-600 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5';
                } else {
                    btn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer flex items-center gap-1.5';
                }
            });
        }

        window.applyGoalPreset = applyGoalPreset;
        window.onGoalDeadlineInputChanged = onGoalDeadlineInputChanged;
        window.filterGoalsByHorizon = filterGoalsByHorizon;

        function updateSplitBreakdown() {
            const curr = getCurrency();
            const inputEl = document.getElementById('split-amount-input');
            const total = parseFloat(inputEl ? inputEl.value : 0) || 0;
            const rules = ${JSON.stringify(allocation_rules)};
            const baseTargetEl = document.getElementById('split-base-target');
            const baseTarget = parseFloat(baseTargetEl ? baseTargetEl.value : ${strictNetFloor}) || ${strictNetFloor};
            const sweepCheck = document.getElementById('sweep_overflow_check');
            const overflowBanner = document.getElementById('sweep-overflow-banner');
            const overflowText = document.getElementById('sweep-overflow-amt-text');
            const isSweeping = sweepCheck ? sweepCheck.checked : true;
            
            const hasOverflow = total > baseTarget;
            const overflowAmt = hasOverflow ? Math.max(0, total - baseTarget) : 0;
            
            if (overflowBanner) {
                if (hasOverflow && overflowAmt > 0) {
                    overflowBanner.classList.remove('hidden');
                    if (overflowText) {
                        overflowText.innerText = curr === 'Ksh'
                            ? ('Ksh ' + overflowAmt.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))
                            : ('$' + (overflowAmt / USD_TO_KES).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));
                    }
                } else {
                    overflowBanner.classList.add('hidden');
                }
            }

            const allocBase = (hasOverflow && isSweeping) ? baseTarget : total;

            let payYourselfKes = 0;
            let payYourselfPct = 0;
            let obligationsKes = 0;
            let obligationsPct = 0;
            let pocketKes = 0;
            let pocketPct = 0;
            
            rules.forEach(r => {
                const pct = parseFloat(r.percentage) || 0;
                let kesAmt = allocBase * (pct / 100);
                const bName = String(r.bucket_name || '').toLowerCase();
                const tType = String(r.target_type || '').toUpperCase();
                const isMmfBucket = bName.includes('mmf') || bName.includes('ziidi') || bName.includes('britam');

                let extraDisplay = '';
                if (hasOverflow && isSweeping && isMmfBucket) {
                    kesAmt += overflowAmt;
                    extraDisplay = ' <span class="text-[10px] text-amber-500 dark:text-amber-400 font-bold block">(+' + (curr === 'Ksh' ? 'Ksh ' + overflowAmt.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2}) : '$' + (overflowAmt/USD_TO_KES).toFixed(1)) + ' overflow)</span>';
                }

                const spanEl = document.getElementById('rule-calc-' + r.id);
                if (spanEl) {
                    if (curr === 'Ksh') {
                        spanEl.innerHTML = 'Ksh ' + kesAmt.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + extraDisplay;
                    } else {
                        spanEl.innerHTML = '$' + (kesAmt / USD_TO_KES).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + extraDisplay;
                    }
                }

                if (tType === 'GOAL' || bName.includes('pay yourself') || bName.includes('mmf') || bName.includes('ziidi') || bName.includes('britam') || bName.includes('sacco') || bName.includes('lock') || bName.includes('goal') || bName.includes('invest') || bName.includes('chama') || bName.includes('emergenc')) {
                    payYourselfKes += kesAmt;
                    payYourselfPct += pct;
                } else if (tType === 'BILL' || tType === 'DEBT' || bName.includes('bill') || bName.includes('rent') || bName.includes('fleet') || bName.includes('service') || bName.includes('maint') || bName.includes('loan') || bName.includes('debt')) {
                    obligationsKes += kesAmt;
                    obligationsPct += pct;
                } else {
                    pocketKes += kesAmt;
                    pocketPct += pct;
                }
            });

            const fmtAmt = (val) => curr === 'Ksh'
                ? ('Ksh ' + val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}))
                : ('$' + (val / USD_TO_KES).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}));

            const pyfEl = document.getElementById('pyf-summary-wealth');
            if (pyfEl) pyfEl.innerText = fmtAmt(payYourselfKes) + ' (' + Math.round((payYourselfKes / Math.max(1, total)) * 100) + '%)';
            const obEl = document.getElementById('pyf-summary-reserves');
            if (obEl) obEl.innerText = fmtAmt(obligationsKes) + ' (' + Math.round((obligationsKes / Math.max(1, total)) * 100) + '%)';
            const pkEl = document.getElementById('pyf-summary-pocket');
            if (pkEl) pkEl.innerText = fmtAmt(pocketKes) + ' (' + Math.round((pocketKes / Math.max(1, total)) * 100) + '%)';
        }

        function toggleMmfProfitForm(id) {
            var f = document.getElementById('mmf-profit-form-' + id);
            if (f) {
                f.classList.toggle('hidden');
                if (!f.classList.contains('hidden')) {
                    var inp = f.querySelector('input[name="amount"]');
                    if (inp) inp.focus();
                }
            }
        }
        window.toggleMmfProfitForm = toggleMmfProfitForm;

        function openProfileModal() {
            document.getElementById('profile-switcher-modal')?.classList.remove('hidden');
        }
        function closeProfileModal() {
            document.getElementById('profile-switcher-modal')?.classList.add('hidden');
        }
        window.openProfileModal = openProfileModal;
        window.closeProfileModal = closeProfileModal;

        window.RECURRING_BILLS_DATA = ${JSON.stringify(recurring_bills || [])};

        function syncBillToTransaction(billId, doScroll) {
            if (doScroll === undefined) doScroll = true;
            var bills = window.RECURRING_BILLS_DATA || [];
            var bill = bills.find(function(b) { return String(b.id) === String(billId); });
            if (!bill) return;

            var catSelect = document.getElementById('tx-category-select');
            var amtInput = document.getElementById('tx-amount-input');
            var descInput = document.getElementById('tx-description-input') || document.querySelector('input[name="description"]');
            var typeSelect = document.getElementById('tx-type-select') || document.querySelector('select[name="transaction_type"]');
            var accSelect = document.getElementById('tx-account-select') || document.querySelector('select[name="account_id"]');
            var linkedIdInput = document.getElementById('tx-linked-bill-id');
            var syncBanner = document.getElementById('tx-bill-sync-banner');
            var syncText = document.getElementById('tx-bill-sync-text');
            var chipsContainer = document.getElementById('tx-category-bills-chips');

            if (linkedIdInput) linkedIdInput.value = bill.id;
            if (typeSelect) typeSelect.value = 'EXPENSE';
            if (amtInput) amtInput.value = bill.amount;
            if (descInput) descInput.value = (bill.icon || '⚡') + ' ' + bill.name + ' (Monthly Bill)';
            if (accSelect && bill.account_id) accSelect.value = bill.account_id;
            if (chipsContainer) chipsContainer.classList.add('hidden');

            if (catSelect) {
                var billOptionVal = 'BILL:' + bill.id;
                var hasBillOpt = Array.from(catSelect.options).some(function(o) { return o.value === billOptionVal; });
                if (hasBillOpt) {
                    catSelect.value = billOptionVal;
                } else {
                    catSelect.value = bill.category || 'Utilities & Bills';
                }
            }

            if (syncBanner && syncText) {
                syncText.textContent = (bill.icon || '⚡') + ' ' + bill.name + ' (Ksh ' + Number(bill.amount).toLocaleString() + ' • Due ' + bill.due_day + 'th)';
                syncBanner.classList.remove('hidden');
            }

            highlightBillInChecklist(bill.id);

            if (doScroll) {
                var txCard = document.getElementById('tx-card');
                if (txCard) {
                    txCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    txCard.classList.add('ring-2', 'ring-indigo-500');
                    setTimeout(function() {
                        txCard.classList.remove('ring-2', 'ring-indigo-500');
                    }, 1800);
                }
            }
        }
        window.syncBillToTransaction = syncBillToTransaction;

        function unlinkRecurringBillFromTx() {
            var linkedIdInput = document.getElementById('tx-linked-bill-id');
            var syncBanner = document.getElementById('tx-bill-sync-banner');
            var catSelect = document.getElementById('tx-category-select');

            if (linkedIdInput) linkedIdInput.value = '';
            if (syncBanner) syncBanner.classList.add('hidden');
            if (catSelect && catSelect.value.startsWith('BILL:')) {
                catSelect.value = 'Utilities & Bills';
            }
            highlightBillInChecklist(null);
        }
        window.unlinkRecurringBillFromTx = unlinkRecurringBillFromTx;

        function highlightBillInChecklist(activeBillId) {
            var cards = document.querySelectorAll('.recurring-bill-item-card');
            cards.forEach(function(card) {
                var bid = card.getAttribute('data-bill-id');
                var safeId = String(bid).replace(/[^a-zA-Z0-9_-]/g, '_');
                var chip = document.getElementById('bill-sync-chip-' + safeId);
                if (activeBillId && String(bid) === String(activeBillId)) {
                    card.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-50/90', 'dark:bg-indigo-950/50');
                    if (chip) chip.classList.remove('hidden');
                } else {
                    card.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-50/90', 'dark:bg-indigo-950/50');
                    if (chip) chip.classList.add('hidden');
                }
            });
        }
        window.highlightBillInChecklist = highlightBillInChecklist;

        function onTxCategoryChange(val) {
            const container = document.getElementById('custom-category-container');
            const input = document.getElementById('tx-custom-category');
            const chipsContainer = document.getElementById('tx-category-bills-chips');
            const chipsList = document.getElementById('tx-category-bills-chips-list');

            if (val === 'Other') {
                if (container) container.classList.remove('hidden');
                if (input) input.focus();
                unlinkRecurringBillFromTx();
                if (chipsContainer) chipsContainer.classList.add('hidden');
                return;
            } else {
                if (container) container.classList.add('hidden');
            }

            if (val && val.startsWith('BILL:')) {
                var bId = val.replace('BILL:', '');
                syncBillToTransaction(bId, false);
                if (chipsContainer) chipsContainer.classList.add('hidden');
                return;
            }

            // Check if selected category has matching recurring bills (e.g. Utilities & Bills, Living Expenses)
            var bills = window.RECURRING_BILLS_DATA || [];
            var matching = bills.filter(function(b) {
                var bCat = b.category || 'Utilities & Bills';
                return bCat === val || (val === 'Utilities & Bills' && /rent|water|wifi|token|kplc|bill|sha|nhif|internet/i.test(b.name));
            });

            if (matching.length > 0 && chipsContainer && chipsList) {
                chipsList.innerHTML = matching.map(function(b) {
                    return '<button type="button" onclick="syncBillToTransaction(\\'' + b.id + '\\', false)" class="px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/80 dark:hover:bg-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-bold transition flex items-center gap-1 active:scale-95 shadow-xs"><span>' + (b.icon || '⚡') + '</span> <span>' + b.name + '</span> <span class="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold">(Ksh ' + Number(b.amount).toLocaleString() + ')</span></button>';
                }).join('');
                chipsContainer.classList.remove('hidden');
            } else {
                if (chipsContainer) chipsContainer.classList.add('hidden');
                unlinkRecurringBillFromTx();
            }
        }
        window.onTxCategoryChange = onTxCategoryChange;

        let _mpesaParsedList = [];

        function fallbackClientParseSms(rawText) {
            if (!rawText) return [];
            var results = [];
            var chunks = String(rawText).split(/(?=\\b[A-Z0-9]{8,12}\\s+Confirmed)|[\\r\\n]+/i);
            var todayStr = new Date().toISOString().slice(0, 10);
            chunks.forEach(function(chunk, idx) {
                var line = (chunk || '').trim();
                if (!line || line.length < 8) return;
                var amtMatch = line.match(/(?:Ksh|KES)\\s*([0-9,]+(?:\\.[0-9]{1,2})?)/i);
                if (!amtMatch) return;
                var amount = parseFloat(amtMatch[1].replace(/,/g, '')) || 0;
                if (amount <= 0) return;

                var codeMatch = line.match(/\\b([A-Z0-9]{8,12})\\b/);
                var code = (codeMatch && !/^(CONFIRMED|RECEIVED|CREDITED|AVAILABLE)$/i.test(codeMatch[1]))
                    ? codeMatch[1].toUpperCase()
                    : ('SMS' + String(idx + 1).padStart(3, '0'));

                var isIncome = /received\\s+from|credited|deposit|you\\s+have\\s+received/i.test(line);
                var type = isIncome ? 'INCOME' : 'EXPENSE';

                var party = 'M-Pesa / Bank Counterparty';
                var partyMatch = line.match(/(?:received\\s+from|paid\\s+to|sent\\s+to|from|to)\\s+([A-Za-z0-9\\s\\.\\-&]{2,35}?)(?:\\s+on\\b|\\s+Ref|\\s+at\\b|\\.|\\n|$)/i);
                if (partyMatch && partyMatch[1]) {
                    party = partyMatch[1].trim();
                }

                var cat = isIncome ? 'Rider & Boda Deliveries' : 'Living Expenses';
                if (/rubis|total|shell|ola|hass|petrol|fuel|energy/i.test(line)) cat = 'Fuel & Petrol';
                else if (/spiro|roam|ampersand|swap|battery|ev\\b/i.test(line)) cat = 'EV Battery Swap & Charging';
                else if (/kplc|token|water|zuku|safaricom|wifi|bill/i.test(line)) cat = 'Utilities & Bills';
                else if (/airtime|bundle/i.test(line)) cat = 'Airtime & Internet';

                results.push({
                    code: code,
                    type: type,
                    amount_kes: amount,
                    party: party,
                    date: todayStr,
                    time: '',
                    suggested_category: cat,
                    description: (isIncome ? 'Received from ' : 'Paid to ') + party + ' (#' + code + ')'
                });
            });
            return results;
        }

        async function parseMpesaClient() {
            var input = document.getElementById('mpesa-batch-input');
            var raw = input ? input.value : '';
            if (!raw.trim()) {
                alert('Please paste at least one M-Pesa or Kenyan Bank SMS message, or upload/snap a screenshot first.');
                return;
            }

            var previewDiv = document.getElementById('mpesa-preview-area');
            var tableBody = document.getElementById('mpesa-preview-tbody');
            var countBadge = document.getElementById('mpesa-parsed-count');
            var importBtn = document.getElementById('mpesa-import-submit-btn');

            if (previewDiv) previewDiv.classList.remove('hidden');
            if (countBadge) countBadge.innerHTML = '<span class="text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">⏳ Analyzing &amp; extracting transactions...</span>';

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
                txList = fallbackClientParseSms(raw);
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

        var _tesseractLoaded = false;
        function loadTesseractJs() {
            if (window.Tesseract) return Promise.resolve(window.Tesseract);
            if (_tesseractLoaded) {
                return new Promise(function(resolve, reject) {
                    var checkInterval = setInterval(function() {
                        if (window.Tesseract) {
                            clearInterval(checkInterval);
                            resolve(window.Tesseract);
                        }
                    }, 150);
                    setTimeout(function() {
                        clearInterval(checkInterval);
                        if (window.Tesseract) resolve(window.Tesseract);
                        else reject(new Error('OCR engine timed out loading'));
                    }, 20000);
                });
            }
            _tesseractLoaded = true;
            return new Promise(function(resolve, reject) {
                var script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
                script.async = true;
                script.onload = function() {
                    if (window.Tesseract) resolve(window.Tesseract);
                    else reject(new Error('Tesseract not available'));
                };
                script.onerror = function() {
                    _tesseractLoaded = false;
                    reject(new Error('Failed to load OCR library. Check internet connection.'));
                };
                document.head.appendChild(script);
            });
        }

        function preprocessScreenshotForOcr(file) {
            return new Promise(function(resolve) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    var img = new Image();
                    img.onload = function() {
                        try {
                            var maxDim = 1800;
                            var w = img.width;
                            var h = img.height;
                            if (w > maxDim || h > maxDim) {
                                var scale = maxDim / Math.max(w, h);
                                w = Math.round(w * scale);
                                h = Math.round(h * scale);
                            } else if (w < 800 && h < 800) {
                                w = Math.round(w * 1.5);
                                h = Math.round(h * 1.5);
                            }
                            var canvas = document.createElement('canvas');
                            canvas.width = w;
                            canvas.height = h;
                            var ctx = canvas.getContext('2d');
                            if (!ctx) {
                                resolve({ processedUrl: ev.target.result, previewUrl: ev.target.result });
                                return;
                            }
                            ctx.drawImage(img, 0, 0, w, h);
                            var imgData = ctx.getImageData(0, 0, w, h);
                            var d = imgData.data;

                            var totalLum = 0;
                            var sampleCount = 0;
                            for (var i = 0; i < d.length; i += 16) {
                                var lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                                totalLum += lum;
                                sampleCount++;
                            }
                            var avgLum = sampleCount > 0 ? (totalLum / sampleCount) : 180;
                            var isDarkMode = avgLum < 115;

                            for (var j = 0; j < d.length; j += 4) {
                                var gray = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
                                if (isDarkMode) {
                                    gray = 255 - gray;
                                }
                                var contrasted = ((gray - 128) * 1.45) + 128;
                                var finalVal = Math.max(0, Math.min(255, Math.round(contrasted)));
                                d[j] = finalVal;
                                d[j + 1] = finalVal;
                                d[j + 2] = finalVal;
                            }
                            ctx.putImageData(imgData, 0, 0);
                            resolve({
                                processedUrl: canvas.toDataURL('image/png'),
                                previewUrl: ev.target.result
                            });
                        } catch (err) {
                            resolve({ processedUrl: ev.target.result, previewUrl: ev.target.result });
                        }
                    };
                    img.onerror = function() {
                        resolve({ processedUrl: ev.target.result, previewUrl: ev.target.result });
                    };
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        function cleanOcrSmsText(rawText) {
            if (!rawText) return '';
            var text = String(rawText);
            text = text.replace(/Conflrmed|Confinned|Confi\\s*rmed|Confirned/gi, 'Confirmed');
            text = text.replace(/M-PE5A|M\\s*-\\s*PESA/gi, 'M-PESA');
            text = text.replace(/Ksh\\s*[lI](\\d)/g, 'Ksh1$1');
            text = text.replace(/KES\\s*[lI](\\d)/gi, 'KES 1$1');
            text = text.replace(/Ksh\\s*(\\d+)\\s*,\\s*(\\d{3})/gi, 'Ksh$1,$2');
            text = text.replace(/KES\\s*(\\d+)\\s*,\\s*(\\d{3})/gi, 'KES $1,$2');
            text = text.replace(/(\\d)\\s*\\.\\s*(\\d{2})\\b/g, '$1.$2');
            var lines = text.split(/[\\r\\n]+/).map(function(l) { return l.trim(); }).filter(function(l) {
                if (!l) return false;
                if (/^\\d{1,2}:\\d{2}\\s*(AM|PM)?$/i.test(l)) return false;
                if (/^(4G|5G|LTE|VoLTE|Safaricom|M-PESA|Messages|Today|Yesterday)$/i.test(l)) return false;
                return true;
            });
            return lines.join(' ').replace(/\\s{2,}/g, ' ').trim();
        }

        function setSmsInputMode(mode) {
            var tabPaste = document.getElementById('sms-mode-btn-paste');
            var tabScan = document.getElementById('sms-mode-btn-scan');
            var scanPanel = document.getElementById('mpesa-screenshot-scanner-panel');
            if (mode === 'SCAN') {
                if (scanPanel) scanPanel.classList.remove('hidden');
                if (tabScan) tabScan.className = 'px-3 py-1.5 rounded-lg text-xs font-extrabold transition bg-emerald-600 text-white shadow-xs flex items-center gap-1.5';
                if (tabPaste) tabPaste.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5';
            } else {
                if (scanPanel) scanPanel.classList.add('hidden');
                if (tabPaste) tabPaste.className = 'px-3 py-1.5 rounded-lg text-xs font-extrabold transition bg-emerald-600 text-white shadow-xs flex items-center gap-1.5';
                if (tabScan) tabScan.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5';
                var textarea = document.getElementById('mpesa-batch-input');
                if (textarea) textarea.focus();
            }
        }

        function isImageFile(f) {
            if (!f) return false;
            if (f.type && f.type.toLowerCase().indexOf('image/') === 0) return true;
            return /\\.(png|jpe?g|webp|gif|bmp|heic|svg)$/i.test(f.name || '');
        }

        var _currentScreenshotFiles = [];

        async function handleMpesaScreenshots(inputOrFileList) {
            var inputElToReset = null;
            var fileList = null;
            if (inputOrFileList && inputOrFileList.files) {
                inputElToReset = inputOrFileList;
                fileList = inputOrFileList.files;
            } else {
                fileList = inputOrFileList;
            }
            if (!fileList || fileList.length === 0) return;
            var files = Array.from(fileList).filter(isImageFile);
            if (files.length === 0) {
                if (fileList.length > 0 && fileList[0].size > 0) {
                    files = [fileList[0]];
                } else {
                    alert('Please select or snap a valid image (PNG, JPG, WebP).');
                    return;
                }
            }

            _currentScreenshotFiles = files;

            // Ensure scanner panel is open
            setSmsInputMode('SCAN');

            var statusBox = document.getElementById('mpesa-ocr-status-box');
            var statusText = document.getElementById('mpesa-ocr-status-text');
            var progressBar = document.getElementById('mpesa-ocr-progress-bar');
            var thumbsContainer = document.getElementById('mpesa-ocr-thumbs');
            var textarea = document.getElementById('mpesa-batch-input');

            if (statusBox) statusBox.classList.remove('hidden');
            if (thumbsContainer) {
                thumbsContainer.innerHTML = '';
                thumbsContainer.classList.remove('hidden');
            }
            if (statusText) statusText.innerHTML = '<span class="text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">📸 Screenshot loaded! Pre-processing image...</span>';
            if (progressBar) progressBar.style.width = '15%';

            // 1. INSTANT ZERO-DELAY VISUAL PREVIEW: Read images immediately via FileReader BEFORE resetting input
            var dataUrls = [];
            for (var idx = 0; idx < files.length; idx++) {
                var fObj = files[idx];
                var fSizeKb = Math.max(1, Math.round((fObj.size || 1024) / 1024));
                try {
                    var dUrl = await (function(file) {
                        return new Promise(function(resolve) {
                            var r = new FileReader();
                            r.onload = function(e) { resolve(e.target.result); };
                            r.onerror = function() { resolve(null); };
                            r.readAsDataURL(file);
                        });
                    })(fObj);

                    if (dUrl && thumbsContainer) {
                        dataUrls.push({ file: fObj, dataUrl: dUrl, sizeKb: fSizeKb });
                        var card = document.createElement('div');
                        card.className = 'p-3 bg-white dark:bg-gray-900 rounded-xl border border-emerald-300 dark:border-emerald-700 shadow-sm space-y-2 max-w-sm';
                        card.innerHTML = 
                            '<div class="flex items-center justify-between text-xs">' +
                                '<span class="font-extrabold text-gray-900 dark:text-white truncate max-w-[200px]" title="' + (fObj.name || 'Screenshot') + '">📷 ' + (fObj.name || 'Screenshot') + '</span>' +
                                '<span class="text-[10px] text-gray-400 font-mono">' + fSizeKb + ' KB</span>' +
                            '</div>' +
                            '<div class="w-full h-44 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200 dark:border-gray-800">' +
                                '<img src="' + dUrl + '" class="max-h-full max-w-full object-contain" alt="Uploaded Screenshot">' +
                            '</div>';
                        thumbsContainer.appendChild(card);
                    }
                } catch(readErr) {
                    console.warn('Error reading file preview:', readErr);
                }
            }

            // Now safe to reset input value so picking the same file again works
            if (inputElToReset) {
                try { inputElToReset.value = ''; } catch(e) {}
            }

            if (statusBox) statusBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            // 2. RUN OCR SCANNER
            try {
                if (statusText) statusText.innerHTML = '<span class="text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">⏳ Starting OCR engine to read SMS text...</span>';
                if (progressBar) progressBar.style.width = '30%';

                var Tesseract = await loadTesseractJs();
                var extractedChunks = [];

                for (var i = 0; i < files.length; i++) {
                    var curFile = files[i];
                    var prep = await preprocessScreenshotForOcr(curFile);
                    var imgToScan = (prep && prep.processedUrl) ? prep.processedUrl : (dataUrls[i] ? dataUrls[i].dataUrl : curFile);

                    var result = await Tesseract.recognize(imgToScan, 'eng', {
                        logger: function(m) {
                            if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
                                var pct = Math.round(((i + m.progress) / files.length) * 100);
                                if (progressBar) progressBar.style.width = Math.max(30, pct) + '%';
                                if (statusText) {
                                    statusText.innerText = '🔍 Reading SMS from screenshot ' + (i + 1) + ' of ' + files.length + '... (' + Math.round(m.progress * 100) + '%)';
                                }
                            }
                        }
                    });

                    var rawOcr = (result && result.data && result.data.text) ? result.data.text : '';
                    var cleaned = cleanOcrSmsText(rawOcr);
                    if (cleaned) {
                        extractedChunks.push(cleaned);
                    }
                }

                if (progressBar) progressBar.style.width = '100%';
                if (extractedChunks.length > 0) {
                    var nl = String.fromCharCode(10);
                    var combined = extractedChunks.join(nl + nl);
                    if (textarea) {
                        var existing = textarea.value.trim();
                        textarea.value = existing ? (existing + nl + nl + combined) : combined;
                    }
                    if (statusText) {
                        statusText.innerHTML = '<span class="text-emerald-700 dark:text-emerald-300 font-extrabold">✅ Scanned successfully! Extracted SMS placed in text box below &amp; reviewed!</span>';
                    }
                    await parseMpesaClient();
                } else {
                    if (statusText) {
                        statusText.innerHTML = '<div class="space-y-1">' +
                            '<p class="text-amber-700 dark:text-amber-300 font-bold">⚠️ Could not detect clear SMS text in this image.</p>' +
                            '<p class="text-[11px] text-gray-500 dark:text-gray-400">Ensure the screenshot clearly shows the M-Pesa / Bank message (e.g. "Confirmed. Ksh..."). You can also copy &amp; paste text below.</p>' +
                            '</div>';
                    }
                }
            } catch (err) {
                console.warn('Screenshot OCR error:', err);
                if (progressBar) progressBar.style.width = '100%';
                if (statusText) {
                    statusText.innerHTML = '<div class="space-y-1.5">' +
                        '<p class="text-rose-600 dark:text-rose-400 font-bold">⚠️ OCR scanner encountered an issue: ' + (err && err.message ? err.message : 'Network error') + '</p>' +
                        '<div class="flex items-center gap-2">' +
                            '<button type="button" onclick="handleMpesaScreenshots(_currentScreenshotFiles)" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-xs">🔄 Retry OCR</button>' +
                            '<span class="text-[11px] text-gray-500">Or copy &amp; paste the message text into the box below</span>' +
                        '</div>' +
                        '</div>';
                }
            }
        }

        // ==========================================
        // 📷 LIVE CAMERA MODAL FOR M-PESA / BANK SMS SCANNER
        // ==========================================
        var _mpesaCameraStream = null;
        var _mpesaCameraFacingMode = 'environment';

        function stopMpesaCameraStream() {
            if (_mpesaCameraStream) {
                try {
                    _mpesaCameraStream.getTracks().forEach(function(t) { t.stop(); });
                } catch(e) {}
                _mpesaCameraStream = null;
            }
            var videoEl = document.getElementById('mpesa-live-camera-video');
            if (videoEl) videoEl.srcObject = null;
        }

        async function startMpesaCameraStream() {
            var videoEl = document.getElementById('mpesa-live-camera-video');
            var statusEl = document.getElementById('mpesa-live-camera-status');
            var snapBtn = document.getElementById('mpesa-live-camera-snap-btn');

            stopMpesaCameraStream();

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                if (statusEl) {
                    statusEl.innerHTML = '⚠️ Live camera viewfinder requires camera permissions or HTTPS. Tap <strong>&quot;📱 Select / Capture from Device&quot;</strong> below!';
                    statusEl.classList.remove('hidden');
                }
                if (snapBtn) snapBtn.classList.add('hidden');
                return;
            }

            if (statusEl) {
                statusEl.innerHTML = '⏳ Starting camera... Please click <strong>Allow</strong> if your browser asks for camera permission.';
                statusEl.classList.remove('hidden');
            }

            try {
                var stream = null;
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: { ideal: _mpesaCameraFacingMode }, width: { ideal: 1280 }, height: { ideal: 960 } },
                        audio: false
                    });
                } catch (e1) {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                }
                _mpesaCameraStream = stream;
                if (videoEl) {
                    videoEl.srcObject = stream;
                    await videoEl.play().catch(function() {});
                }
                if (statusEl) statusEl.classList.add('hidden');
                if (snapBtn) snapBtn.classList.remove('hidden');
            } catch (err) {
                if (statusEl) {
                    statusEl.innerHTML = '⚠️ Could not access live camera (' + (err && err.message ? err.message : 'Permission denied') + '). Use <strong>&quot;📱 Select / Capture from Device&quot;</strong> below!';
                    statusEl.classList.remove('hidden');
                }
                if (snapBtn) snapBtn.classList.add('hidden');
            }
        }

        function openMpesaCameraModal() {
            var modal = document.getElementById('mpesa-live-camera-modal');
            if (modal) modal.classList.remove('hidden');
            startMpesaCameraStream();
        }

        function closeMpesaCameraModal() {
            stopMpesaCameraStream();
            var modal = document.getElementById('mpesa-live-camera-modal');
            if (modal) modal.classList.add('hidden');
        }

        function flipMpesaCamera() {
            _mpesaCameraFacingMode = (_mpesaCameraFacingMode === 'environment') ? 'user' : 'environment';
            startMpesaCameraStream();
        }

        function captureMpesaCameraFrame() {
            var videoEl = document.getElementById('mpesa-live-camera-video');
            if (!videoEl || !videoEl.videoWidth) {
                alert('Camera stream is not ready yet. Please wait a moment or use the upload button.');
                return;
            }
            var w = videoEl.videoWidth;
            var h = videoEl.videoHeight;
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(videoEl, 0, 0, w, h);
            closeMpesaCameraModal();
            canvas.toBlob(function(blob) {
                if (!blob) return;
                var file = new File([blob], 'Camera_SMS_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.jpg', { type: 'image/jpeg' });
                handleMpesaScreenshots([file]);
            }, 'image/jpeg', 0.88);
        }

        function handleMpesaCameraFallbackInput(inputEl) {
            closeMpesaCameraModal();
            handleMpesaScreenshots(inputEl);
        }

        function handleMpesaDrop(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            var dropZone = document.getElementById('mpesa-drop-zone');
            if (dropZone) dropZone.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-50/80');
            if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length > 0) {
                handleMpesaScreenshots(ev.dataTransfer.files);
            }
        }

        function handleMpesaPasteEvent(ev) {
            if (ev.clipboardData && ev.clipboardData.files && ev.clipboardData.files.length > 0) {
                var imgFiles = Array.from(ev.clipboardData.files).filter(isImageFile);
                if (imgFiles.length > 0) {
                    ev.preventDefault();
                    handleMpesaScreenshots(imgFiles);
                    return;
                }
            }
            setTimeout(function() {
                var el = document.getElementById('mpesa-batch-input');
                if (el && el.value.trim().length > 8) {
                    parseMpesaClient();
                }
            }, 80);
        }

        window.parseMpesaClient = parseMpesaClient;
        window.setSmsInputMode = setSmsInputMode;
        window.pasteSampleMpesa = pasteSampleMpesa;
        window.handleMpesaScreenshots = handleMpesaScreenshots;
        window.handleMpesaDrop = handleMpesaDrop;
        window.handleMpesaPasteEvent = handleMpesaPasteEvent;
        window.openMpesaCameraModal = openMpesaCameraModal;
        window.closeMpesaCameraModal = closeMpesaCameraModal;
        window.flipMpesaCamera = flipMpesaCamera;
        window.captureMpesaCameraFrame = captureMpesaCameraFrame;
        window.handleMpesaCameraFallbackInput = handleMpesaCameraFallbackInput;
        window.toggleMpesaItem = toggleMpesaItem;
        window.updateMpesaCategory = updateMpesaCategory;
        window.removeMpesaItem = removeMpesaItem;
        window.toggleAllMpesaReview = toggleAllMpesaReview;

        // -------------------------------------------------------------
        // 🔢 APP-WIDE 4-DIGIT QUICK PIN CONTROLLER
        // -------------------------------------------------------------
        var appPinBuf = '';
        var appPinStrikes = 0;

        function getStoredAppPin() {
            try {
                var p = localStorage.getItem('finatrack_quick_pin');
                if (p && /^\d{4}$/.test(p)) return p;
                var m = document.cookie.match(/(?:^|;\s*)finatrack_quick_pin=(\d{4})/);
                return m ? m[1] : null;
            } catch (e) { return null; }
        }

        function validateAppPinSetupMatch() {
            var p1El = document.getElementById('new-app-pin-input');
            var p2El = document.getElementById('confirm-app-pin-input');
            var msgEl = document.getElementById('app-pin-setup-match-msg');
            var btnEl = document.getElementById('save-app-pin-btn');
            if (!p1El || !p2El || !msgEl || !btnEl) return;

            var p1 = p1El.value.replace(/[^0-9]/g, '').slice(0, 4);
            var p2 = p2El.value.replace(/[^0-9]/g, '').slice(0, 4);
            p1El.value = p1;
            p2El.value = p2;

            if (p1.length === 0 && p2.length === 0) {
                msgEl.textContent = 'Enter matching 4 digits in both fields';
                msgEl.className = 'text-[11px] font-bold text-center py-1 text-slate-400';
                btnEl.disabled = true;
            } else if (p1.length < 4 || p2.length < 4) {
                msgEl.textContent = '⏳ Both fields must be exactly 4 digits (' + p1.length + '/4 & ' + p2.length + '/4)';
                msgEl.className = 'text-[11px] font-bold text-center py-1 text-amber-400';
                btnEl.disabled = true;
            } else if (p1 === p2) {
                msgEl.textContent = '✅ PINs match! Ready to save.';
                msgEl.className = 'text-[11px] font-bold text-center py-1 text-emerald-400';
                btnEl.disabled = false;
            } else {
                msgEl.textContent = '⚠️ PINs do not match yet.';
                msgEl.className = 'text-[11px] font-bold text-center py-1 text-rose-400';
                btnEl.disabled = true;
            }
        }

        function saveAppPinLocal(ev) {
            try {
                var inp1 = document.getElementById('new-app-pin-input');
                var inp2 = document.getElementById('confirm-app-pin-input');
                var val1 = inp1 ? inp1.value.replace(/[^0-9]/g, '').slice(0, 4) : '';
                var val2 = inp2 ? inp2.value.replace(/[^0-9]/g, '').slice(0, 4) : '';
                if (val1.length !== 4 || val1 !== val2) {
                    if (ev && ev.preventDefault) ev.preventDefault();
                    alert('⚠️ Please enter and confirm matching 4 digits before saving.');
                    return false;
                }
                localStorage.setItem('finatrack_quick_pin', val1);
                return true;
            } catch (e) {
                return true;
            }
        }

        function switchAppPinTab(tab) {
            var saved = getStoredAppPin();
            if (tab === 'keypad' && !saved) {
                tab = 'setup';
            }
            var kp = document.getElementById('app-pin-keypad-panel');
            var sp = document.getElementById('app-pin-setup-panel');
            var tk = document.getElementById('tab-app-pin-keypad');
            var ts = document.getElementById('tab-app-pin-setup');

            if (tab === 'setup') {
                if (kp) kp.classList.add('hidden');
                if (sp) sp.classList.remove('hidden');
                if (tk) tk.className = 'py-1.5 rounded-lg text-slate-400 hover:text-white transition';
                if (ts) ts.className = 'py-1.5 rounded-lg bg-indigo-600 text-white transition';
                validateAppPinSetupMatch();
            } else {
                if (kp) kp.classList.remove('hidden');
                if (sp) sp.classList.add('hidden');
                if (tk) tk.className = 'py-1.5 rounded-lg bg-indigo-600 text-white transition';
                if (ts) ts.className = 'py-1.5 rounded-lg text-slate-400 hover:text-white transition';
            }
        }

        function openAppPinModal() {
            var modal = document.getElementById('app-pin-modal');
            if (!modal) return;
            appPinBuf = '';
            renderAppPinDots();
            var saved = getStoredAppPin();
            if (saved) {
                switchAppPinTab('keypad');
            } else {
                switchAppPinTab('setup');
            }
            modal.classList.remove('hidden');
        }

        function closeAppPinModal() {
            document.getElementById('app-pin-modal')?.classList.add('hidden');
            appPinBuf = '';
            renderAppPinDots();
        }

        function renderAppPinDots() {
            var dots = document.querySelectorAll('.a-pin-dot');
            dots.forEach(function(dot, idx) {
                if (idx < appPinBuf.length) {
                    dot.classList.add('bg-indigo-400', 'border-indigo-400', 'scale-110');
                    dot.classList.remove('bg-slate-950');
                } else {
                    dot.classList.remove('bg-indigo-400', 'border-indigo-400', 'scale-110');
                    dot.classList.add('bg-slate-950');
                }
            });
        }

        function pressAppPin(digit) {
            if (appPinBuf.length < 4) {
                appPinBuf += digit;
                renderAppPinDots();
                if (appPinBuf.length === 4) {
                    setTimeout(verifyAppPinEntered, 120);
                }
            }
        }

        function clearAppPin() {
            appPinBuf = '';
            renderAppPinDots();
            var errEl = document.getElementById('app-pin-error');
            if (errEl) errEl.classList.add('hidden');
        }

        function backspaceAppPin() {
            if (appPinBuf.length > 0) {
                appPinBuf = appPinBuf.slice(0, -1);
                renderAppPinDots();
            }
        }

        function verifyAppPinEntered() {
            var saved = getStoredAppPin();
            var errEl = document.getElementById('app-pin-error');
            var strikesInfo = document.getElementById('app-pin-strikes-info');

            if (!saved || appPinBuf === saved) {
                closeAppPinModal();
                if (errEl) errEl.classList.add('hidden');
                try {
                    localStorage.setItem('finatrack_quick_pin', appPinBuf);
                } catch(e) {}
                var f = document.createElement('form');
                f.method = 'POST';
                f.action = '/auth/pin/verify';
                var inp = document.createElement('input');
                inp.type = 'hidden';
                inp.name = 'pin';
                inp.value = appPinBuf;
                f.appendChild(inp);
                var redir = document.createElement('input');
                redir.type = 'hidden';
                redir.name = 'redirect_to';
                redir.value = '/';
                f.appendChild(redir);
                document.body.appendChild(f);
                f.submit();
                return;
            }

            appPinStrikes += 1;
            appPinBuf = '';
            renderAppPinDots();
            var rem = 3 - appPinStrikes;

            if (appPinStrikes >= 3) {
                window.location.href = '/login?pin_fallback=1&redirect_to=/';
                return;
            }

            if (errEl) {
                errEl.textContent = 'Wrong PIN (' + rem + ' attempt' + (rem === 1 ? '' : 's') + ' left before master login)';
                errEl.classList.remove('hidden');
            }
        }

        window.openAppPinModal = openAppPinModal;
        window.closeAppPinModal = closeAppPinModal;
        window.switchAppPinTab = switchAppPinTab;
        window.pressAppPin = pressAppPin;
        window.clearAppPin = clearAppPin;
        window.backspaceAppPin = backspaceAppPin;
        window.validateAppPinSetupMatch = validateAppPinSetupMatch;
        window.saveAppPinLocal = saveAppPinLocal;
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
    <header class="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800 sticky top-0 z-30 shadow-xs">
        <div class="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-14 sm:h-16 flex justify-between items-center gap-2">
            <a href="/" class="flex items-center space-x-2.5 shrink-0">
                <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-base sm:text-lg text-white shadow-xs">
                    ⚡
                </div>
                <div>
                    <h1 class="font-extrabold text-base sm:text-lg text-gray-900 dark:text-white tracking-tight leading-none">Finatrack</h1>
                    <span class="hidden sm:block text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mt-0.5">Wealth &amp; Cashflow OS</span>
                </div>
            </a>
            
            <div class="flex items-center gap-1.5 sm:gap-2.5">
                <button onclick="triggerAppInstall()" class="pwa-install-trigger px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-extrabold shadow-xs transition flex items-center gap-1 hidden">
                    <span>📲</span>
                    <span class="hidden sm:inline">Install App</span>
                </button>

                <!-- Profile Switcher Button -->
                <button type="button" onclick="openProfileModal()" class="px-2.5 sm:px-3 py-1.5 ${activeProfileBadge} rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-1 shadow-2xs border">
                    <span>${activeProfileIcon} <span class="hidden md:inline">${activeProfileLabel}</span></span>
                    <span class="text-[10px] opacity-70">▾</span>
                </button>

                <div class="hidden lg:flex items-center space-x-1 bg-gray-100/80 dark:bg-gray-800/80 p-1 rounded-xl border border-gray-200/60 dark:border-gray-700/60">
                    <a href="/rider" class="px-2.5 py-1 rounded-lg text-xs font-bold ${activeProfileMode === 'RIDER' ? 'bg-blue-600 text-white shadow-2xs' : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'} transition">
                        🛵 Rider
                    </a>
                    <a href="/trader" class="px-2.5 py-1 rounded-lg text-xs font-bold ${activeProfileMode === 'TRADER' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'} transition">
                        🥬 Trader
                    </a>
                    <a href="/salaried" class="px-2.5 py-1 rounded-lg text-xs font-bold ${activeProfileMode === 'SALARIED' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'} transition">
                        💼 Salaried
                    </a>
                </div>

                <select id="currency-selector" onchange="setCurrency(this.value)" class="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2 sm:px-2.5 py-1.5 font-bold text-gray-700 dark:text-gray-200 cursor-pointer">
                    <option value="Ksh" ${current_currency === 'Ksh' ? 'selected' : ''}>KSH</option>
                    <option value="USD" ${current_currency === 'USD' ? 'selected' : ''}>USD</option>
                </select>

                ${is_logged_in ? `
                <div class="flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1.5 rounded-xl shadow-xs">
                    <span class="text-xs">👤</span>
                    <span class="text-xs font-bold text-emerald-800 dark:text-emerald-300 max-w-[90px] truncate hidden sm:inline">${username}</span>
                    <form action="/auth/logout" method="POST" class="inline m-0 p-0">
                        <input type="hidden" name="redirect_to" value="/">
                        <button type="submit" title="Logout" class="text-[11px] text-rose-500 dark:text-rose-400 font-bold hover:underline ml-0.5">✕</button>
                    </form>
                </div>
                ` : `
                <a href="/login" class="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs">
                    <span>🔑</span>
                    <span class="hidden sm:inline">Sign In</span>
                </a>
                `}

                ${(() => {
                  const urgentNotifs = (notifications || []).filter((n: any) => n.urgency === 'OVERDUE' || n.urgency === 'CRITICAL' || n.urgency === 'WARNING');
                  const badgeCount = urgentNotifs.length;
                  return `
                <div class="relative" id="smart-notif-wrapper">
                    <button type="button" onclick="toggleSmartNotifDropdown()" class="relative px-2 sm:px-2.5 py-1.5 rounded-xl ${badgeCount > 0 ? 'bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'} text-xs font-extrabold hover:bg-amber-100 dark:hover:bg-amber-900/60 transition flex items-center gap-1 shadow-2xs" title="Smart Notifications: Daily Logger, Upcoming Loans & Bills">
                        <span>🔔</span>
                        ${badgeCount > 0 ? `<span class="px-1.5 py-0.2 bg-rose-600 text-white text-[10px] font-black rounded-full leading-tight">${badgeCount}</span>` : ''}
                    </button>
                    <div id="smart-notif-dropdown" class="hidden fixed sm:absolute right-2 sm:right-0 top-14 sm:top-11 w-[calc(100vw-1rem)] sm:w-96 max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                        <div class="p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
                            <div>
                                <h3 class="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                                    <span>🔔 Smart Notification Center</span>
                                    <span class="px-1.5 py-0.5 bg-indigo-600 text-white rounded-full text-[10px]">${(notifications || []).length}</span>
                                </h3>
                                <p class="text-[10px] text-slate-300 mt-0.5">Daily Logger • Upcoming Loans • Recurring Bills</p>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <button type="button" onclick="enableBrowserPushAlerts()" id="browser-push-btn" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10px] transition shadow-2xs">
                                    📲 Push Alerts
                                </button>
                                <button type="button" onclick="toggleSmartNotifDropdown()" class="text-slate-400 hover:text-white text-sm font-bold px-1">✕</button>
                            </div>
                        </div>
                        <div class="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                            ${(notifications || []).length === 0 ? `
                            <div class="p-6 text-center text-xs text-gray-400">
                                <p class="text-2xl mb-1">🎉</p>
                                <p class="font-bold">All caught up! No urgent alerts.</p>
                            </div>
                            ` : (notifications || []).map((n: any) => {
                              const pillCls = n.urgency === 'OVERDUE' || n.urgency === 'CRITICAL'
                                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                : n.urgency === 'WARNING'
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
                              return `
                            <div class="p-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition flex items-start justify-between gap-2.5">
                                <div class="flex items-start gap-2.5 min-w-0">
                                    <span class="text-lg shrink-0 mt-0.5">${n.icon || '🔔'}</span>
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-1.5 flex-wrap">
                                            <p class="text-xs font-extrabold text-gray-900 dark:text-white truncate">${n.title}</p>
                                            <span class="text-[9px] font-black px-1.5 py-0.2 rounded border ${pillCls}">${n.urgency}</span>
                                        </div>
                                        <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">${n.subtitle}</p>
                                    </div>
                                </div>
                                <a href="${n.action_href || '#'}" onclick="handleNotifActionClick('${n.action_href || ''}')" class="shrink-0 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] transition whitespace-nowrap shadow-2xs">
                                    ${n.action_label || 'Open →'}
                                </a>
                            </div>`;
                            }).join('')}
                        </div>
                        <div class="p-2.5 bg-gray-50 dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px]">
                            <a href="#daily-logger-card" onclick="toggleSmartNotifDropdown()" class="font-bold text-emerald-600 dark:text-emerald-400 hover:underline">📝 Open Daily Logger</a>
                            <a href="#debts-card" onclick="toggleSmartNotifDropdown()" class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">💳 Upcoming Loans →</a>
                        </div>
                    </div>
                </div>`;
                })()}

                <button type="button" onclick="openAppPinModal()" class="px-2 sm:px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 text-xs font-extrabold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition flex items-center gap-1 shadow-2xs" title="4-Digit Quick PIN (Fast App Unlock & Screen Lock)">
                    <span>🔢</span>
                    <span class="hidden md:inline">${has_quick_pin ? 'PIN Lock' : 'Set PIN'}</span>
                </button>

                <button onclick="togglePrivacyBlur()" class="privacy-toggle-btn p-1.5 sm:p-2 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition" title="Hide or Show Balances">
                    👁️
                </button>

                <button onclick="toggleDarkMode()" class="dark-mode-toggle-btn p-1.5 sm:p-2 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition" title="Toggle Dark/Light Mode">
                    🌙
                </button>
            </div>
        </div>
    </header>

    <main class="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 flex-1 w-full pb-28 sm:pb-10">
        
        <!-- 👋 Welcome Greeting Hero Banner -->
        <div class="bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-5 border border-gray-200/80 dark:border-gray-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-xl sm:text-2xl text-white shadow-md shrink-0">
                    👋
                </div>
                <div>
                    <h2 class="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-tight">
                        ${is_logged_in ? `Welcome back, <span class="text-emerald-600 dark:text-emerald-400 font-extrabold">${username}</span>!` : `Welcome to <span class="text-emerald-600 dark:text-emerald-400 font-extrabold">Finatrack</span>!`}
                    </h2>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${is_logged_in ? 'Your automated financial freedom waterfall & multi-account analytics are active.' : 'Track your MMF yields, savings goals, debts, and automated money waterfall in real-time.'}</p>
                </div>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
                <a href="/finance/statement" target="_blank" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition active:scale-95 border border-slate-200 dark:border-gray-700">
                    <span>📄 SACCO / PDF Statement</span>
                </a>
                ${is_logged_in ? `
                <span class="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-bold rounded-xl flex items-center gap-1.5 shadow-2xs">
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

        <!-- Mobile Quick Action Pills (Horizontal scroll on phone - non-sticky so it doesn't collide with quick-jump-dock) -->
        <div class="flex sm:hidden overflow-x-auto gap-2 py-1 no-scrollbar -mx-3.5 px-3.5">
            <button onclick="document.getElementById('waterfall-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-emerald-600 active:scale-95 text-slate-950 text-xs font-black rounded-xl shadow-xs shrink-0 transition">
                <span>👑 Pay Yourself First</span>
            </button>
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
                <span>🏖️ Goals / Malindi</span>
            </button>
            <button onclick="document.getElementById('debts-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-rose-600 to-amber-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>💳 Loans & Debts ${dangerCount > 0 ? `<span class="px-1.5 py-0.2 bg-white text-rose-700 rounded-full font-black text-[10px] animate-pulse">🚨 ${dangerCount}</span>` : ''}</span>
            </button>
            <a href="${activeProfileMode === 'TRADER' ? '/trader' : activeProfileMode === 'SALARIED' ? '/salaried' : '/rider'}" class="flex items-center space-x-1.5 px-3.5 py-2 ${activeProfileMode === 'TRADER' ? 'bg-emerald-600' : activeProfileMode === 'SALARIED' ? 'bg-indigo-600' : 'bg-blue-600'} active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>${activeProfileMode === 'TRADER' ? '🥬 Soko Closeout' : activeProfileMode === 'SALARIED' ? '💼 Payday Split' : '🛵 Log Shift'}</span>
            </a>
            <button type="button" onclick="openProfileModal()" class="flex items-center space-x-1.5 px-3.5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>🔄 Switch Persona</span>
            </button>
            <a href="/finance/export/csv" class="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>📥 Export CSV</span>
            </a>
            <button onclick="triggerAppInstall()" class="pwa-install-trigger flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>📲 Install</span>
            </button>
        </div>

        <!-- Net Worth & Overview Stats -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div class="col-span-2 sm:col-span-1 bg-gradient-to-br from-emerald-600 to-teal-700 p-4 sm:p-5 rounded-2xl text-white shadow-sm space-y-1">
                <p class="text-[11px] sm:text-xs font-semibold text-emerald-100 uppercase tracking-wider">Total Net Balance</p>
                <p class="text-2xl sm:text-3xl font-black convertible-amount" data-kes="${total_balance}">${formatKes(total_balance)}</p>
                <p class="text-[11px] text-emerald-200">${accounts.length} Active Accounts Connected</p>
            </div>

            <div class="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-xs space-y-1">
                <p class="text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Monthly Income</p>
                <p class="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 convertible-amount" data-kes="${monthly_income}">${formatKes(monthly_income)}</p>
                <p class="text-[10px] sm:text-[11px] text-gray-500">Shifts, interest &amp; inflows</p>
            </div>

            <div class="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-xs space-y-1">
                <p class="text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Monthly Expenses</p>
                <p class="text-lg sm:text-2xl font-bold text-rose-600 dark:text-rose-400 convertible-amount" data-kes="${monthly_expenses}">${formatKes(monthly_expenses)}</p>
                <p class="text-[10px] sm:text-[11px] text-gray-500">Fuel, food, utilities &amp; bills</p>
            </div>

            <div class="col-span-2 sm:col-span-1 bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-xs space-y-1">
                <p class="text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Monthly Passive Yield</p>
                <p class="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 convertible-amount" data-kes="${total_monthly_passive_income}">${formatKes(total_monthly_passive_income)}</p>
                <p class="text-[10px] sm:text-[11px] text-amber-700 dark:text-amber-300">From MMF &amp; Sacco high yields</p>
            </div>
        </div>

        <!-- 📌 Quick-Jump Sticky Navigation Dock -->
        <nav id="quick-jump-dock" class="sticky top-14 sm:top-16 z-20 bg-gray-50/95 dark:bg-slate-950/95 backdrop-blur-md py-2 px-1 border-y border-gray-200/80 dark:border-gray-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-2xs">
            <a href="#waterfall-card" class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-emerald-500/20 dark:from-amber-500/20 dark:to-emerald-500/20 border border-amber-400 dark:border-amber-700 text-xs font-black text-amber-900 dark:text-amber-300 hover:border-emerald-500 shrink-0 transition shadow-2xs active:scale-95 flex items-center gap-1.5">
                <span>👑 Pay Yourself First (23:50 Split)</span>
                <span class="px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-md text-[10px]">${allocation_rules.length}</span>
            </a>
            <a href="#accounts-card" class="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-800 shrink-0 transition shadow-2xs active:scale-95 flex items-center gap-1.5">
                <span>💳 Accounts</span>
                <span class="px-1.5 py-0.2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-md text-[10px]">${accounts.length}</span>
            </a>
            <a href="#debts-card" class="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800 shrink-0 transition shadow-2xs active:scale-95 flex items-center gap-1.5">
                <span>💸 Loans & Debts</span>
                <span class="px-1.5 py-0.2 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 rounded-md text-[10px]">${debts.length}</span>
            </a>
            <a href="#mmf-card" class="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-800 shrink-0 transition shadow-2xs active:scale-95 flex items-center gap-1.5">
                <span>📈 MMF & Wealth</span>
                <span class="px-1.5 py-0.2 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-md text-[10px]">${mmf_accounts.length}</span>
            </a>
            <a href="#goals-card" class="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-800 shrink-0 transition shadow-2xs active:scale-95 flex items-center gap-1.5">
                <span>🏖️ Goals &amp; Malindi</span>
                <span class="px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md text-[10px]">${goals.length}</span>
            </a>
            <a href="#tx-card" class="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-800 shrink-0 transition shadow-2xs active:scale-95 flex items-center gap-1.5">
                <span>📝 Transactions</span>
                <span class="px-1.5 py-0.2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md text-[10px]">${transactions.length}</span>
            </a>
        </nav>

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
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b dark:border-gray-800 pb-3">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xl shadow-md shrink-0 text-white">
                            🗓️
                        </div>
                        <div>
                            <h2 class="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                                <span>Upcoming Loans, Bills & Renewals</span>
                                ${dangerCount > 0 ? `<span class="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-extrabold text-[10px] rounded-full animate-pulse border border-rose-300 dark:border-rose-800">🚨 ${dangerCount} Urgent</span>` : ''}
                            </h2>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Live countdown for upcoming loans, unpaid recurring bills & permits</p>
                        </div>
                    </div>
                    <a href="#debts-card" onclick="setTimeout(() => document.querySelector('#debts-card input[name=person_name]')?.focus(), 250)" class="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-[11px] font-extrabold transition shrink-0 self-start sm:self-auto">
                        + Add Upcoming Loan
                    </a>
                </div>

                <!-- Filter Tabs for Timeline (All / Upcoming Loans / Bills / Docs) -->
                <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    <button type="button" onclick="filterTimelineItems('ALL')" id="tl-tab-ALL" class="tl-filter-btn px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-indigo-600 text-white shadow-2xs transition">
                        All (${unified_timeline.length})
                    </button>
                    <button type="button" onclick="filterTimelineItems('LOAN')" id="tl-tab-LOAN" class="tl-filter-btn px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition">
                        💳 Upcoming Loans (${unified_timeline.filter((i: any) => i.itemType === 'LOAN' || i.type === 'DEBT').length})
                    </button>
                    <button type="button" onclick="filterTimelineItems('BILL')" id="tl-tab-BILL" class="tl-filter-btn px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition">
                        ⚡ Unpaid Bills (${unified_timeline.filter((i: any) => i.itemType === 'BILL' || i.type === 'BILL').length})
                    </button>
                    <button type="button" onclick="filterTimelineItems('COMPLIANCE')" id="tl-tab-COMPLIANCE" class="tl-filter-btn px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition">
                        📋 Permits (${unified_timeline.filter((i: any) => i.itemType === 'COMPLIANCE' || i.type === 'COMPLIANCE').length})
                    </button>
                </div>

                ${unified_timeline.length === 0 ? `
                <div class="text-center py-8 text-gray-400 text-xs">
                    <p class="text-2xl mb-2">✨</p>
                    <p class="font-bold">No active loans or unpaid deadlines pending.</p>
                    <p class="mt-1">Add an upcoming loan in the Loans & Debts section below or a recurring bill to track it here.</p>
                </div>
                ` : `
                <div class="space-y-2.5 max-h-72 overflow-y-auto no-scrollbar" id="unified-timeline-list">
                    ${unified_timeline.map((item: any) => {
                        const isOverdue = item.isOverdue || item.daysRemaining < 0;
                        const isDanger = item.isDangerZone || item.daysRemaining <= 3;
                        const itemCategory = item.itemType || (item.type === 'DEBT' ? 'LOAN' : item.type) || 'LOAN';
                        const rawLoanId = String(item.id || '').replace(/^debt-/, '');
                        const badgeStyle = isOverdue 
                            ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            : isDanger 
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800';

                        return `
                        <div data-tl-type="${itemCategory}" class="timeline-item-row p-3 rounded-xl border ${isDanger || isOverdue ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20' : 'border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40'} flex items-center justify-between gap-3 text-xs">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 rounded-lg ${isOverdue ? 'bg-rose-600' : isDanger ? 'bg-amber-600' : 'bg-indigo-600'} text-white flex items-center justify-center text-sm shrink-0">
                                    ${item.icon || (itemCategory === 'LOAN' ? '💳' : itemCategory === 'BILL' ? '⚡' : '📋')}
                                </div>
                                <div>
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <p class="font-bold text-gray-900 dark:text-gray-100">${item.title}</p>
                                        <span class="text-[9px] px-1.5 py-0.5 rounded-md font-bold ${badgeStyle}">${item.typeLabel || (itemCategory === 'LOAN' ? 'Loan' : itemCategory === 'BILL' ? 'Bill' : 'Document')}</span>
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
                                ${itemCategory === 'LOAN' ? `
                                <a href="#debts-card" onclick="setTimeout(() => { if (typeof toggleDebtForm === 'function') toggleDebtForm('${rawLoanId}'); }, 250)" class="inline-block mt-1 px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded-md text-[10px] font-bold transition shadow-2xs">💳 Repay →</a>
                                ` : `
                                <a href="${item.actionLink || '#'}" class="inline-block mt-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold">Open →</a>
                                `}
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
                                <input type="number" step="any" inputmode="decimal" name="target_income_weekly" value="${income_targets?.weekly?.target ?? 15000}" placeholder="15000" data-placeholder-base="15000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-400 convertible-placeholder" required>
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">Monthly Target Income</label>
                                <input type="number" step="any" inputmode="decimal" name="target_income_monthly" value="${income_targets?.monthly?.target ?? 65000}" placeholder="65000" data-placeholder-base="65000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-400 convertible-placeholder" required>
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">Yearly Target Income</label>
                                <input type="number" step="any" inputmode="decimal" name="target_income_yearly" value="${income_targets?.yearly?.target ?? 780000}" placeholder="780000" data-placeholder-base="780000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-400 convertible-placeholder" required>
                            </div>
                        </div>
                    </div>

                    <div>
                        <p class="text-xs font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">🛑 Expense Target & Budget Ceilings (<span class="curr-symbol-label">Ksh</span>)</p>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">Weekly Expense Budget</label>
                                <input type="number" step="any" inputmode="decimal" name="target_expense_weekly" value="${expense_targets?.weekly?.target ?? 6000}" placeholder="6000" data-placeholder-base="6000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-400 convertible-placeholder" required>
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">Monthly Expense Budget</label>
                                <input type="number" step="any" inputmode="decimal" name="target_expense_monthly" value="${expense_targets?.monthly?.target ?? 25000}" placeholder="25000" data-placeholder-base="25000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-400 convertible-placeholder" required>
                            </div>
                            <div>
                                <label class="block text-[11px] text-gray-600 dark:text-gray-400 mb-1 font-semibold">Yearly Expense Budget</label>
                                <input type="number" step="any" inputmode="decimal" name="target_expense_yearly" value="${expense_targets?.yearly?.target ?? 300000}" placeholder="300000" data-placeholder-base="300000" class="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-400 convertible-placeholder" required>
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
                        <span class="text-2xl">👑</span>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white">Pay Yourself First &amp; Dynamic Waterfall Auto-Split (23:50 Closeout)</h2>
                    </div>
                    <p class="text-xs text-gray-600 dark:text-indigo-200/80">Automatically calculate and distribute daily shift net earnings across MMF, Savings, Malindi/Home Goals, Loans, Bills, and Fleet Service.</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <form action="/rules/preset" method="POST" class="inline">
                        <input type="hidden" name="preset_key" value="PAY_YOURSELF_FLEET">
                        <button type="submit" title="Apply the 30-20-15-10-25 Pay Yourself First &amp; Fleet Ratio Blueprint" class="text-xs bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-xl font-extrabold transition active:scale-95 shadow-2xs">
                            👑 30-20-15-10-25 Pay Yourself Ratio
                        </button>
                    </form>
                    <button type="button" onclick="openRulesModal(true)" class="text-xs bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-xl font-bold transition active:scale-95 shadow-2xs">
                        ➕ Add Custom Option
                    </button>
                    <button type="button" onclick="openRulesModal(false)" class="text-xs bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-xl font-bold transition active:scale-95 shadow-2xs">
                        ⚙️ Edit Split Rules (${allocation_rules.length})
                    </button>
                </div>
            </div>

            <form action="/split/distribute" method="POST" class="space-y-3">
                <input type="hidden" name="base_target" id="split-base-target" value="${strictNetFloor}">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div>
                        <label class="block text-xs font-semibold text-gray-700 dark:text-indigo-300 mb-1">Enter Today's Net Take-Home (<span class="curr-symbol-label">Ksh</span>)</label>
                        <input type="number" step="any" name="amount" id="split-amount-input" value="${defaultSplitInputAmt}" oninput="updateSplitBreakdown()" class="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl text-lg font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-400" required>
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
                            🚀 Pay Yourself First &amp; Distribute Now
                        </button>
                    </div>
                </div>

                <!-- Quick-Fill Shift Net & Preset Amount Chips -->
                <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-300 mr-1">⚡ 23:50 Shift Closeout Fill:</span>
                    ${Number(today_shift_net || 0) > 0 ? `
                    <button type="button" onclick="setSplitAmountPreset(${Number(today_shift_net).toFixed(2)})" class="px-2.5 py-1 bg-cyan-50 dark:bg-cyan-950/70 hover:bg-cyan-100 dark:hover:bg-cyan-900 border border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 rounded-lg text-[11px] font-extrabold transition active:scale-95">
                        🛵 Today's Shift Net (Ksh ${Number(today_shift_net).toLocaleString()})
                    </button>` : Number(last_shift_net || 0) > 0 ? `
                    <button type="button" onclick="setSplitAmountPreset(${Number(last_shift_net).toFixed(2)})" class="px-2.5 py-1 bg-cyan-50 dark:bg-cyan-950/70 hover:bg-cyan-100 dark:hover:bg-cyan-900 border border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 rounded-lg text-[11px] font-extrabold transition active:scale-95">
                        🛵 Latest Shift Net (Ksh ${Number(last_shift_net).toLocaleString()})
                    </button>` : ''}
                    <button type="button" onclick="setSplitAmountPreset(1500)" class="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-[11px] font-bold transition">Ksh 1,500</button>
                    <button type="button" onclick="setSplitAmountPreset(2000)" class="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-[11px] font-bold transition">Ksh 2,000</button>
                    <button type="button" onclick="setSplitAmountPreset(2500)" class="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-[11px] font-bold transition">Ksh 2,500</button>
                    <button type="button" onclick="setSplitAmountPreset(3500)" class="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-[11px] font-bold transition">Ksh 3,500</button>
                </div>

                <!-- 🚀 100% Overflow Sweeper Banner & Toggle -->
                <div id="sweep-overflow-banner" class="${defaultSplitInputAmt > strictNetFloor ? '' : 'hidden '}p-3 bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-amber-500/15 border border-amber-300 dark:border-amber-700/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div class="flex items-center gap-2.5">
                        <span class="text-xl">🚀</span>
                        <div>
                            <span class="font-black text-amber-900 dark:text-amber-200 block">
                                100% Overflow Rule: Split Base Ksh ${strictNetFloor.toLocaleString()} &amp; Sweep Extra <span id="sweep-overflow-amt-text" class="text-emerald-600 dark:text-emerald-400 font-black underline">Ksh ${(Math.max(0, defaultSplitInputAmt - strictNetFloor)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span> to MMF
                            </span>
                            <span class="text-[11px] text-gray-600 dark:text-gray-300">
                                Strictly adheres to your Ksh ${strictNetFloor.toLocaleString()} survival floor while sweeping 100% of bonus earnings straight into high-yield MMF compounding wealth.
                            </span>
                        </div>
                    </div>
                    <label class="flex items-center gap-2 cursor-pointer shrink-0 font-extrabold text-amber-800 dark:text-amber-300 select-none bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 shadow-2xs">
                        <input type="checkbox" name="sweep_overflow" id="sweep_overflow_check" value="1" checked onchange="updateSplitBreakdown()" class="w-4 h-4 rounded text-amber-600 focus:ring-amber-500">
                        <span>Sweep to MMF</span>
                    </label>
                </div>
            </form>

            <!-- 👑 Live Pay Yourself First Discipline Summary Bar -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-indigo-50/60 dark:bg-slate-950/80 border border-indigo-200/70 dark:border-indigo-900/60 rounded-xl">
                <div class="flex items-center justify-between sm:block px-2 py-1 border-b sm:border-b-0 sm:border-r border-indigo-200/60 dark:border-indigo-900/50">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">👑 1. Pay Yourself First (Wealth + Goals)</span>
                    <span id="pyf-summary-wealth" class="text-sm font-black text-emerald-600 dark:text-emerald-400">Ksh 0.00 (50%)</span>
                </div>
                <div class="flex items-center justify-between sm:block px-2 py-1 border-b sm:border-b-0 sm:border-r border-indigo-200/60 dark:border-indigo-900/50">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">🛡️ 2. Bills, Debt &amp; Fleet Shield</span>
                    <span id="pyf-summary-reserves" class="text-sm font-black text-indigo-600 dark:text-indigo-300">Ksh 0.00 (25%)</span>
                </div>
                <div class="flex items-center justify-between sm:block px-2 py-1">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">💵 3. Guilt-Free Daily Pocket</span>
                    <span id="pyf-summary-pocket" class="text-sm font-black text-amber-600 dark:text-amber-400">Ksh 0.00 (25%)</span>
                </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
                ${allocation_rules.map((r: any) => `
                <div class="p-3 bg-white dark:bg-gray-950/70 border border-gray-200 dark:border-indigo-900/60 rounded-xl shadow-2xs">
                    <div class="flex items-center space-x-1.5 text-xs text-gray-700 dark:text-indigo-300 font-bold">
                        <span>${r.icon || '💰'}</span>
                        <span class="truncate" title="${r.bucket_name}">${r.bucket_name}</span>
                    </div>
                    <p class="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1" id="rule-calc-${r.id}">Ksh 0.00</p>
                    <div class="flex items-center justify-between mt-0.5">
                        <p class="text-[10px] text-gray-500 dark:text-gray-400 font-medium">${r.percentage}% Allocation</p>
                        <span class="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 font-bold uppercase">${r.target_type || 'CUSTOM'}</span>
                    </div>
                </div>`).join('')}
                <button type="button" onclick="openRulesModal(true)" class="p-3 bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 border border-dashed border-indigo-300 dark:border-indigo-800 rounded-xl flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-300 transition active:scale-95 group min-h-[76px]">
                    <span class="text-base group-hover:scale-110 transition-transform">➕</span>
                    <span class="text-[11px] font-bold mt-0.5">Add Your Option</span>
                    <span class="text-[9px] text-gray-500 dark:text-gray-400">Custom Bucket / Goal / Loan</span>
                </button>
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
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                            <span>Smart M-Pesa &amp; Bank SMS Auto-Parser</span>
                            <span class="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">📋 Copy-Paste + 📸 Screenshot OCR</span>
                        </h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Upload or snap a screenshot of your M-Pesa / Bank SMS (Phone &amp; PC) <strong>OR</strong> copy &amp; paste text directly — win-win!</p>
                    </div>
                </div>

                <!-- Dual Input Mode Switcher + Quick Samples -->
                <div class="flex flex-wrap items-center gap-2">
                    <div class="flex items-center p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <button type="button" id="sms-mode-btn-paste" onclick="setSmsInputMode('PASTE')" class="px-3 py-1.5 rounded-lg text-xs font-extrabold transition bg-emerald-600 text-white shadow-xs flex items-center gap-1.5">
                            <span>📋 Copy &amp; Paste</span>
                        </button>
                        <button type="button" id="sms-mode-btn-scan" onclick="setSmsInputMode('SCAN')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5">
                            <span>📸 Scan Screenshot</span>
                        </button>
                    </div>
                    <button type="button" onclick="pasteSampleMpesa('single')" class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg transition active:scale-95">
                        📋 Sample SMS
                    </button>
                    <button type="button" onclick="pasteSampleMpesa('bank')" class="px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-lg transition active:scale-95 border border-indigo-200 dark:border-indigo-800">
                        🏦 Bank SMS
                    </button>
                    <button type="button" onclick="pasteSampleMpesa('batch')" class="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-lg transition active:scale-95">
                        📋 Batch (4 SMS)
                    </button>
                </div>
            </div>

            <form action="/finance/mpesa/import" method="POST" id="mpesa-import-form" class="space-y-4">
                <input type="hidden" id="mpesa-reviewed-json" name="reviewed_transactions" value="">

                <!-- Fallback File Inputs for Phone Gallery/PC & Phone Camera -->
                <input type="file" id="mpesa-screenshot-input" accept="image/*" multiple class="sr-only" onchange="handleMpesaScreenshots(this)">
                <input type="file" id="mpesa-camera-input" accept="image/*" capture="environment" class="sr-only" onchange="handleMpesaScreenshots(this)">

                <!-- 📸 Option B: Screenshot Scanner / Drag-and-Drop Box (Phone & PC) -->
                <div id="mpesa-screenshot-scanner-panel" class="hidden space-y-3">
                    <div id="mpesa-drop-zone"
                        ondragover="event.preventDefault(); this.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50/80');"
                        ondragleave="this.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-50/80');"
                        ondrop="handleMpesaDrop(event)"
                        class="p-4 sm:p-5 rounded-2xl border-2 border-dashed border-emerald-400/70 dark:border-emerald-700/80 bg-emerald-50/40 dark:bg-emerald-950/20 text-center space-y-3 transition">
                        <div class="flex flex-col items-center space-y-1">
                            <span class="text-3xl">📸</span>
                            <h3 class="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white">Upload or Snap M-Pesa / Bank SMS Screenshot(s)</h3>
                            <p class="text-[11px] text-gray-500 dark:text-gray-400 max-w-lg">
                                Works with <strong>Phone Gallery</strong> (1 or multiple screenshots), <strong>Live Camera</strong>, <strong>PC Drag &amp; Drop</strong>, or <strong>Ctrl+V</strong> paste. Supports both Dark Mode &amp; Light Mode screenshots!
                            </p>
                        </div>
                        <div class="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                            <label class="cursor-pointer px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition shadow-xs flex items-center gap-1.5 active:scale-95">
                                <span>🖼️ Upload Screenshot(s) (Phone / PC)</span>
                                <input type="file" accept="image/*" multiple class="sr-only" onchange="handleMpesaScreenshots(this)">
                            </label>
                            <button type="button" onclick="openMpesaCameraModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl transition shadow-xs flex items-center gap-1.5 active:scale-95">
                                <span>📷 Snap Photo with Camera</span>
                            </button>
                        </div>
                    </div>

                    <!-- OCR Progress & Thumbnail Strip -->
                    <div id="mpesa-ocr-status-box" class="hidden p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
                        <div class="flex items-center justify-between gap-2 text-xs">
                            <span id="mpesa-ocr-status-text" class="font-bold text-emerald-700 dark:text-emerald-300">⏳ Preparing screenshot scanner...</span>
                        </div>
                        <div class="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div id="mpesa-ocr-progress-bar" class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300" style="width: 0%"></div>
                        </div>
                        <div id="mpesa-ocr-thumbs" class="hidden flex items-center gap-2 overflow-x-auto pt-1"></div>
                    </div>
                </div>

                <!-- 📋 Option A + Hybrid Editable Textarea (Always Available!) -->
                <div class="space-y-1.5">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <label for="mpesa-batch-input" class="block text-xs font-bold text-gray-700 dark:text-gray-300">
                            📋 Paste SMS Text OR Review Scanned Screenshot Text:
                        </label>
                        <div class="flex items-center gap-1.5">
                            <label class="cursor-pointer px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg text-[11px] font-extrabold transition flex items-center gap-1 active:scale-95">
                                <span>📸 Upload Screenshot</span>
                                <input type="file" accept="image/*" multiple class="sr-only" onchange="handleMpesaScreenshots(this)">
                            </label>
                            <button type="button" onclick="openMpesaCameraModal()" class="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 rounded-lg text-[11px] font-bold transition flex items-center gap-1 active:scale-95">
                                <span>📷 Camera</span>
                            </button>
                            <button type="button" onclick="var el=document.getElementById('mpesa-batch-input'); if(el){el.value='';}" class="px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-500 dark:text-gray-400 rounded-lg text-[10px] font-semibold transition">
                                Clear
                            </button>
                        </div>
                    </div>
                    <textarea id="mpesa-batch-input" name="raw_sms" rows="3" onpaste="handleMpesaPasteEvent(event)" placeholder="Option 1: Paste single or multiple M-Pesa / Bank SMS messages here...&#10;Option 2: Tap '📸 Upload Screenshot' above (or press Ctrl+V with a copied screenshot) to auto-read SMS from an image!" class="w-full p-3 font-mono text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500" required></textarea>
                </div>

                <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button type="button" onclick="parseMpesaClient()" class="w-full sm:w-auto px-4 py-2 bg-gray-900 dark:bg-gray-800 hover:bg-black dark:hover:bg-gray-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs">
                        <span>🔍 Extract &amp; Review Transactions</span>
                    </button>

                    <div class="flex items-center gap-2 w-full sm:w-auto">
                        <select name="account_id" class="p-2 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl text-xs font-semibold" required>
                            <option value="">-- Select Target Account --</option>
                            ${accounts.map((a: any, idx: number) => `<option value="${a.id}" ${idx === 0 ? 'selected' : ''}>${a.name} (#${a.account_number || a.account_type})</option>`).join("")}
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
                    ${goals.length > 0 ? `
                    <form action="/goals/reset-all" method="POST" onsubmit="return confirm('Reset all goal balances to Ksh 0.00?');" class="inline">
                        <button type="submit" title="Reset all goal balances" class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-gray-600 dark:text-gray-400 hover:text-amber-700 text-xs font-bold rounded-xl transition shadow-2xs flex items-center gap-1 active:scale-95 border border-gray-200 dark:border-gray-700">
                            <span>🔄</span>
                        </button>
                    </form>
                    <form action="/goals/clear-all" method="POST" onsubmit="return confirm('Clear all goals and start fresh with your own goals?');" class="inline">
                        <button type="submit" title="Clear all goals" class="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition shadow-2xs flex items-center gap-1 active:scale-95 border border-rose-200 dark:border-rose-800/60">
                            <span>🗑️ Clear All</span>
                        </button>
                    </form>
                    ` : ''}
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

                <!-- ⚡ Short-Term vs 🏔️ Long-Term 1-Tap Goal Blueprints -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div class="space-y-1.5 bg-amber-50/60 dark:bg-amber-950/25 p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/50">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">⚡ Short-Term Basis (1–6 Months • Quick Milestones):</span>
                        <div class="flex flex-wrap gap-1.5">
                            <button type="button" onclick="applyGoalPreset('Tires &amp; Major Service Reserve', 8000, 20, 2, 'SHORT_TERM')" class="px-2.5 py-1 bg-white dark:bg-gray-900 hover:bg-amber-100/70 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg text-[11px] font-bold transition active:scale-95">
                                🛞 Tires / Service (Ksh 8k • 2m)
                            </button>
                            <button type="button" onclick="applyGoalPreset('4-Burner Gas Cooker &amp; Home Upgrade', 15000, 25, 3, 'SHORT_TERM')" class="px-2.5 py-1 bg-white dark:bg-gray-900 hover:bg-amber-100/70 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg text-[11px] font-bold transition active:scale-95">
                                🍳 Home / Cooker (Ksh 15k • 3m)
                            </button>
                            <button type="button" onclick="applyGoalPreset('Work Smartphone Upgrade', 18000, 25, 3, 'SHORT_TERM')" class="px-2.5 py-1 bg-white dark:bg-gray-900 hover:bg-amber-100/70 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg text-[11px] font-bold transition active:scale-95">
                                📱 Smartphone (Ksh 18k • 3m)
                            </button>
                            <button type="button" onclick="applyGoalPreset('School Fees / Term Sinking Fund', 25000, 30, 4, 'SHORT_TERM')" class="px-2.5 py-1 bg-white dark:bg-gray-900 hover:bg-amber-100/70 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg text-[11px] font-bold transition active:scale-95">
                                🎓 School Fees (Ksh 25k • 4m)
                            </button>
                        </div>
                    </div>

                    <div class="space-y-1.5 bg-indigo-50/50 dark:bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">🏔️ Long-Term Basis (&gt; 6 Months • Vacations, Shields &amp; Assets):</span>
                        <div class="flex flex-wrap gap-1.5">
                            <button type="button" onclick="applyGoalPreset('Malindi Vacation 2027 (Mid-Range)', 45000, 40, 10, 'LONG_TERM')" class="px-2.5 py-1 bg-cyan-50 dark:bg-cyan-950/70 hover:bg-cyan-100 dark:hover:bg-cyan-900 border border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 rounded-lg text-[11px] font-extrabold transition active:scale-95">
                                🏖️ Malindi Vacation (Ksh 45k • 10m)
                            </button>
                            <button type="button" onclick="applyGoalPreset('6-Month Emergency Shield', 75000, 35, 12, 'LONG_TERM')" class="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-[11px] font-bold transition active:scale-95">
                                🛡️ Emergency Shield (Ksh 75k • 12m)
                            </button>
                            <button type="button" onclick="applyGoalPreset('Next Vehicle / Bike Asset Deposit', 120000, 45, 18, 'LONG_TERM')" class="px-2.5 py-1 bg-purple-50 dark:bg-purple-950/70 hover:bg-purple-100 dark:hover:bg-purple-900 border border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-300 rounded-lg text-[11px] font-bold transition active:scale-95">
                                🏍️ Asset Deposit (Ksh 120k • 18m)
                            </button>
                            <button type="button" onclick="applyGoalPreset('Plot / Land Deposit Vault', 250000, 50, 24, 'LONG_TERM')" class="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 rounded-lg text-[11px] font-bold transition active:scale-95">
                                🏡 Land / Plot (Ksh 250k • 24m)
                            </button>
                        </div>
                    </div>
                </div>

                <form action="/goals/create" method="POST" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    <div class="sm:col-span-2 lg:col-span-1">
                        <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Goal Title</label>
                        <input type="text" name="title" placeholder="e.g. Malindi Vacation 2027, Smart TV" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-semibold" required>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Horizon (Short / Long)</label>
                        <select name="horizon" id="new_goal_horizon_select" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 text-gray-900 dark:text-white rounded-xl text-xs font-extrabold">
                            <option value="SHORT_TERM">⚡ Short-Term (≤ 6 Months)</option>
                            <option value="LONG_TERM" selected>🏔️ Long-Term (&gt; 6 Months)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Target Amount (<span class="curr-symbol-label">Ksh</span>)</label>
                        <input type="number" step="any" inputmode="decimal" name="target_amount" placeholder="45000" data-placeholder-base="45000" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-bold convertible-placeholder" required>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Sub-Split Share % (Opt)</label>
                        <input type="number" step="0.1" name="split_percentage" placeholder="40" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-bold">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">Target Deadline (Opt)</label>
                        <input type="date" name="target_date" onchange="onGoalDeadlineInputChanged(this.value)" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-semibold">
                    </div>
                    <div class="flex flex-col justify-end space-y-2">
                        <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-xs active:scale-95">
                            Create Goal Target
                        </button>
                    </div>
                </form>
            </div>

            <!-- Total Goals Progress Bar & Short-Term vs Long-Term Filter Bar -->
            ${(() => {
              const shortTermGoals = goals.filter((g: any) => (g.horizon || 'SHORT_TERM') === 'SHORT_TERM');
              const longTermGoals = goals.filter((g: any) => g.horizon === 'LONG_TERM');
              const shortSaved = shortTermGoals.reduce((s: number, g: any) => s + (Number(g.current_amount) || 0), 0);
              const shortTarget = shortTermGoals.reduce((s: number, g: any) => s + (Number(g.target_amount) || 0), 0);
              const longSaved = longTermGoals.reduce((s: number, g: any) => s + (Number(g.current_amount) || 0), 0);
              const longTarget = longTermGoals.reduce((s: number, g: any) => s + (Number(g.target_amount) || 0), 0);
              return `
            <div class="bg-white dark:bg-gray-900 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 shadow-xs space-y-3">
                <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
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

                <!-- Short-Term vs Long-Term Filter Tabs & KPI Summary -->
                <div class="pt-2.5 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
                    <div class="flex flex-wrap items-center gap-1.5">
                        <button type="button" id="goal-horizon-tab-ALL" onclick="filterGoalsByHorizon('ALL')" class="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-600 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5">
                            <span>🎯 All Goals</span>
                            <span class="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">${goals.length}</span>
                        </button>
                        <button type="button" id="goal-horizon-tab-SHORT_TERM" onclick="filterGoalsByHorizon('SHORT_TERM')" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer flex items-center gap-1.5">
                            <span>⚡ Short-Term (≤ 6m)</span>
                            <span class="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-extrabold">${shortTermGoals.length}</span>
                        </button>
                        <button type="button" id="goal-horizon-tab-LONG_TERM" onclick="filterGoalsByHorizon('LONG_TERM')" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer flex items-center gap-1.5">
                            <span>🏔️ Long-Term (&gt; 6m)</span>
                            <span class="px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 text-[10px] font-extrabold">${longTermGoals.length}</span>
                        </button>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 text-[11px]">
                        <span class="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 font-bold">
                            ⚡ Short-Term: <strong class="convertible-amount" data-kes="${shortSaved}">${formatKes(shortSaved)}</strong> / <span class="convertible-amount" data-kes="${shortTarget}">${formatKes(shortTarget)}</span>
                        </span>
                        <span class="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 text-purple-800 dark:text-purple-300 font-bold">
                            🏔️ Long-Term: <strong class="convertible-amount" data-kes="${longSaved}">${formatKes(longSaved)}</strong> / <span class="convertible-amount" data-kes="${longTarget}">${formatKes(longTarget)}</span>
                        </span>
                    </div>
                </div>
            </div>`;
            })()}

            <div id="goals-filter-empty-state" class="hidden p-5 text-center bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-xs text-gray-500">
                No goals in this horizon category yet. Click <strong>"➕ New Goal"</strong> above or switch the filter tab!
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
                    const isLongTerm = g.horizon === 'LONG_TERM';
                    const horizonCode = isLongTerm ? 'LONG_TERM' : 'SHORT_TERM';
                    const oppositeHorizon = isLongTerm ? 'SHORT_TERM' : 'LONG_TERM';

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
                    <div data-goal-horizon="${horizonCode}" class="goal-card-item bg-white dark:bg-gray-900 p-4 rounded-xl border ${isLongTerm ? 'border-purple-200 dark:border-purple-900/60' : 'border-amber-200 dark:border-amber-900/60'} shadow-xs space-y-3 flex flex-col justify-between">
                        <div class="space-y-2.5">
                            <div class="flex justify-between items-start">
                                <div class="flex items-center space-x-2.5">
                                    <div class="w-10 h-10 rounded-xl ${isLongTerm ? 'bg-gradient-to-tr from-indigo-600 to-purple-600' : 'bg-gradient-to-tr from-amber-500 to-teal-600'} text-white flex items-center justify-center text-xl shadow-xs shrink-0">
                                        ${icon}
                                    </div>
                                    <div>
                                        <h3 class="font-bold text-gray-900 dark:text-white text-sm leading-snug">${g.title}</h3>
                                        <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                                            <form action="/goals/horizon/${g.id}" method="POST" class="inline">
                                                <input type="hidden" name="title" value="${String(g.title || '').replace(/"/g, '&quot;')}">
                                                <input type="hidden" name="horizon" value="${oppositeHorizon}">
                                                <button type="submit" title="Click to switch between Short-Term and Long-Term" class="text-[10px] font-extrabold px-1.5 py-0.5 rounded border cursor-pointer transition ${isLongTerm ? 'bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100' : 'bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'}">
                                                    ${isLongTerm ? '🏔️ Long-Term ⇄' : '⚡ Short-Term ⇄'}
                                                </button>
                                            </form>
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
                <div class="md:col-span-3 p-6 text-center bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 space-y-3">
                    <p class="text-3xl">🎯</p>
                    <h4 class="font-bold text-gray-700 dark:text-gray-200">No Savings Goals Added Yet</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Your goals vault is clean and ready! Create your personal savings targets (e.g. Malindi Vacation, Emergency Shield, Land, Vehicle Upgrade, or Home Appliances).</p>
                    <button type="button" onclick="document.getElementById('new-goal-form-container')?.classList.remove('hidden'); document.getElementById('new-goal-form-container')?.scrollIntoView({behavior: 'smooth'});" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl transition shadow-xs inline-flex items-center gap-1.5 active:scale-95">
                        <span>➕ Create Your First Savings Goal</span>
                    </button>
                </div>`}
            </div>
        </div>

        <!-- 👥 SACCO & Chama Dividend Forecaster Card -->
        <div id="sacco-card" class="bg-white dark:bg-gray-900 bg-gradient-to-br from-indigo-500/10 via-teal-500/5 to-transparent dark:from-indigo-950/30 p-5 sm:p-6 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 shadow-sm space-y-4 text-gray-900 dark:text-white">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-indigo-100 dark:border-indigo-900/40 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-teal-500 text-white flex items-center justify-center text-xl shadow-md shrink-0">
                        👥
                    </div>
                    <div>
                        <h2 class="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>SACCO & Chama Forecaster</span>
                            <span class="text-[10px] bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-teal-200 dark:border-teal-500/30">10% - 15% Rebates</span>
                        </h2>
                        <p class="text-xs text-gray-600 dark:text-indigo-200/80">Simulate wealth compounding and annual dividend payouts from your SACCO deposits.</p>
                    </div>
                </div>

                <button type="button" id="sacco-forecaster-toggle" onclick="document.getElementById('sacco-body-container')?.classList.toggle('hidden'); this.querySelector('.sacco-chevron')?.classList.toggle('rotate-180')" class="px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs">
                    <span>📐 Forecaster</span>
                    <span class="sacco-chevron transition-transform text-xs">▾</span>
                </button>
            </div>

            <!-- Collapsible Body Container -->
            <div id="sacco-body-container" class="hidden space-y-4 pt-1">
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
                ${debts.length > 0 ? debts.map((d: any, idx: number) => {
                    const isBorrowed = d.debt_type === 'I_OWE';
                    const danger = d.danger_status;
                    const isDanger = danger?.isDangerZone && !d.is_settled;
                    const totalAmt = Number(d.total ?? d.total_amount ?? 0);
                    const paidAmt = Number(d.paid ?? d.paid_amount ?? 0);
                    const remainingAmt = Number(d.remaining ?? Math.max(0, totalAmt - paidAmt));
                    const percent = d.percent ?? (totalAmt > 0 ? Math.min(100, Math.round((paidAmt / totalAmt) * 100)) : 0);

                    return `
                    <div class="debt-card-item ${idx >= 4 ? 'hidden ' : ''}${isDanger ? 'border-2 border-rose-500 ring-2 ring-rose-500/30 shadow-md' : 'border border-gray-200 dark:border-gray-800 shadow-2xs'} bg-gray-50 dark:bg-gray-950 p-4 rounded-xl space-y-3 flex flex-col justify-between transition-all" data-debt-type="${d.debt_type}" data-is-danger="${isDanger ? 'true' : 'false'}">
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
                                            <option value="">-- Cash / General Expense Ledger --</option>
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

            <!-- Debts Pagination Controls (4 per page) -->
            <div id="debt-pagination-controls" class="${debts.length <= 4 ? 'hidden' : ''} flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
                <div class="text-gray-500 dark:text-gray-400 font-medium">
                    Showing <span id="debt-visible-range" class="font-bold text-gray-900 dark:text-white">1–${Math.min(4, debts.length)}</span> of <span id="debt-total-filtered-count" class="font-bold text-gray-900 dark:text-white">${debts.length}</span> loans & debts
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" id="debt-prev-btn" onclick="debtPrevPage()" class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold transition flex items-center gap-1 opacity-40 cursor-not-allowed" disabled>
                        <span>‹</span> Prev
                    </button>
                    <div id="debt-pagination-pages" class="flex items-center gap-1">
                        ${Array.from({ length: Math.ceil(debts.length / 4) }).map((_, i) => {
                            const pageNum = i + 1;
                            const isActive = pageNum === 1;
                            return `<button type="button" onclick="debtGoToPage(${pageNum})" class="w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${isActive ? 'bg-indigo-600 text-white shadow-xs' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}">${pageNum}</button>`;
                        }).join('')}
                    </div>
                    <button type="button" id="debt-next-btn" onclick="debtNextPage()" class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer ${debts.length <= 4 ? 'opacity-40 cursor-not-allowed' : ''}" ${debts.length <= 4 ? 'disabled' : ''}>
                        <span>Next ›</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- 📈 MMF & Passive Yields Section -->
        <div id="mmf-card" class="bg-white dark:bg-gray-900 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/30 p-6 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm space-y-5">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <span>📈 Money Market Funds (Britam / Ziidi / Sanlam) &amp; Bank Daily Interest</span>
                        <span class="text-xs bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-extrabold px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/60">${mmf_accounts.length} Active</span>
                        <span class="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">🔄 Auto-Adding Daily (Actual/365)</span>
                    </h2>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Calculates &amp; adds daily compounded interest the exact way Kenyan MMFs &amp; Banks do: <code class="text-[11px] font-bold text-amber-700 dark:text-amber-300">(Balance × Rate% ÷ 365) − 15% KRA WHT</code> (e.g. Ksh 40,000 in Britam @ 12% p.a. adds <strong>+Ksh 11.18 net every day</strong>).</p>
                </div>
                <div class="flex flex-wrap items-center gap-2 shrink-0">
                    <button type="button" onclick="document.getElementById('mmf-bank-calc-drawer')?.classList.toggle('hidden')" class="px-3 py-1.5 bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-extrabold transition shadow-2xs">
                        🧮 Bank/MMF Daily Calculator
                    </button>
                    <button type="button" onclick="document.getElementById('mmf-quick-add-drawer')?.classList.toggle('hidden')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition shadow-xs">
                        ➕ Add Britam / MMF / Bank
                    </button>
                </div>
            </div>

            <!-- ➕ Quick-Add Britam / Ziidi / Sanlam / Bank Interest Account Drawer -->
            <div id="mmf-quick-add-drawer" class="hidden p-4 bg-slate-900 text-white rounded-2xl border border-emerald-600/50 space-y-3 shadow-lg">
                <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                        <h3 class="text-xs font-black text-emerald-400 uppercase tracking-wider">➕ Add MMF or Interest-Bearing Bank Account (Auto-Daily Accrual)</h3>
                        <p class="text-[11px] text-slate-300">Tap a preset below (Britam, Ziidi, Sanlam, CIC, Etica, or Bank Savings) or enter your custom balance &amp; rate.</p>
                    </div>
                    <button type="button" onclick="document.getElementById('mmf-quick-add-drawer')?.classList.add('hidden')" class="text-slate-400 hover:text-white text-sm font-bold">✕</button>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                    <span class="text-[10px] font-bold text-slate-400 uppercase mr-1">1-Tap Presets:</span>
                    <button type="button" onclick="fillMmfQuickPreset('Britam Money Market Fund (MMF)', 'MMF', 12.0, 40000)" class="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 rounded-lg text-[11px] font-extrabold transition">🏦 Britam MMF (12.0% • Ksh 40k → +Ksh 11.18/d)</button>
                    <button type="button" onclick="fillMmfQuickPreset('Ziidi MMF (Safaricom)', 'MMF', 13.5, 40000)" class="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 rounded-lg text-[11px] font-extrabold transition">📱 Ziidi MMF (13.5%)</button>
                    <button type="button" onclick="fillMmfQuickPreset('Sanlam Pesa MMF', 'MMF', 14.5, 40000)" class="px-2.5 py-1 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sky-300 rounded-lg text-[11px] font-extrabold transition">📈 Sanlam MMF (14.5%)</button>
                    <button type="button" onclick="fillMmfQuickPreset('CIC Money Market Fund', 'MMF', 13.2, 40000)" class="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/50 text-indigo-300 rounded-lg text-[11px] font-extrabold transition">🛡️ CIC MMF (13.2%)</button>
                    <button type="button" onclick="fillMmfQuickPreset('Etica Wealth MMF', 'MMF', 15.5, 40000)" class="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/50 text-purple-300 rounded-lg text-[11px] font-extrabold transition">🚀 Etica MMF (15.5%)</button>
                    <button type="button" onclick="fillMmfQuickPreset('Bank Goal Savings Account', 'SAVINGS', 9.0, 40000)" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-lg text-[11px] font-bold transition">🏛️ Bank Savings (9.0%)</button>
                </div>
                <form action="/accounts/create" method="POST" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end">
                    <div>
                        <label class="block text-[10px] font-bold text-slate-300 uppercase mb-1">Fund / Bank Name</label>
                        <input type="text" name="name" id="mmf-quick-name" value="Britam Money Market Fund (MMF)" class="w-full p-2 bg-slate-950 border border-slate-700 text-white rounded-xl text-xs font-bold" required>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-300 uppercase mb-1">Account Type</label>
                        <select name="account_type" id="mmf-quick-type" class="w-full p-2 bg-slate-950 border border-slate-700 text-white rounded-xl text-xs font-bold">
                            <option value="MMF" selected>Money Market Fund (MMF)</option>
                            <option value="SAVINGS">Bank / SACCO Savings</option>
                            <option value="BANK">Bank Account</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-amber-300 uppercase mb-1">Annual Rate (% p.a.)</label>
                        <input type="number" step="any" name="interest_rate_p_a" id="mmf-quick-rate" value="12.0" class="w-full p-2 bg-slate-950 border border-amber-600/60 text-amber-300 rounded-xl text-xs font-black" required>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-emerald-300 uppercase mb-1">Current Balance (Ksh)</label>
                        <input type="number" step="any" name="balance" id="mmf-quick-bal" value="40000" class="w-full p-2 bg-slate-950 border border-emerald-600/60 text-emerald-300 rounded-xl text-xs font-black" required>
                    </div>
                    <button type="submit" class="w-full py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition shadow-md">
                        ✅ Save &amp; Start Daily Interest
                    </button>
                </form>
            </div>

            <!-- 🧮 Interactive Kenyan Bank & MMF Daily Interest Simulator (Britam Ksh 40,000 -> +Ksh 11.18/day Demo) -->
            <div id="mmf-bank-calc-drawer" class="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-500/40 space-y-3 shadow-md">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-900/60 pb-2.5">
                    <div>
                        <h3 class="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                            <span>🏦 How Banks &amp; MMFs (Britam / Ziidi / Sanlam) Calculate Your Daily Interest</span>
                        </h3>
                        <p class="text-[11px] text-slate-300">Formula: <code class="text-emerald-300 font-bold">Daily Gross = Balance × (Rate% ÷ 365)</code> → <code class="text-amber-300 font-bold">Less 15% KRA WHT Tax</code> = <strong class="text-white">Net Added Daily to Balance</strong></p>
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5">
                        <button type="button" onclick="setMmfSimPreset(40000, 12.0, true)" class="px-2 py-1 bg-amber-500/20 border border-amber-400/50 text-amber-300 rounded-lg text-[10px] font-black hover:bg-amber-500/30 transition">Britam 40k @ 12% (+Ksh 11.18/d)</button>
                        <button type="button" onclick="setMmfSimPreset(40000, 13.5, true)" class="px-2 py-1 bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 rounded-lg text-[10px] font-bold hover:bg-emerald-500/30 transition">Ziidi 40k @ 13.5% (+Ksh 12.58/d)</button>
                        <button type="button" onclick="setMmfSimPreset(100000, 14.5, true)" class="px-2 py-1 bg-sky-500/20 border border-sky-400/50 text-sky-300 rounded-lg text-[10px] font-bold hover:bg-sky-500/30 transition">Sanlam 100k @ 14.5% (+Ksh 33.77/d)</button>
                    </div>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 items-center text-xs">
                    <div>
                        <label class="block text-[10px] font-bold text-slate-300 uppercase mb-1">Principal / Balance (Ksh)</label>
                        <input type="number" step="any" id="mmf-sim-balance" value="40000" oninput="recalcMmfBankSimulator()" class="w-full p-2 bg-slate-950 border border-slate-700 rounded-xl font-black text-white text-xs">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-amber-300 uppercase mb-1">Annual Rate (% p.a.)</label>
                        <input type="number" step="any" id="mmf-sim-rate" value="12.0" oninput="recalcMmfBankSimulator()" class="w-full p-2 bg-slate-950 border border-amber-600/60 rounded-xl font-black text-amber-300 text-xs">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-300 uppercase mb-1">KRA 15% WHT Tax</label>
                        <select id="mmf-sim-wht" onchange="recalcMmfBankSimulator()" class="w-full p-2 bg-slate-950 border border-slate-700 rounded-xl font-bold text-white text-xs">
                            <option value="1" selected>Deduct 15% WHT (Bank/MMF)</option>
                            <option value="0">No WHT (Already Net Rate)</option>
                        </select>
                    </div>
                    <div class="p-2.5 bg-slate-950/90 border border-emerald-500/50 rounded-xl">
                        <span class="text-[10px] font-bold text-emerald-300 uppercase block">✅ Net Added Daily</span>
                        <span id="mmf-sim-daily-net" class="text-base font-black text-emerald-400">+Ksh 11.18 / day</span>
                        <span id="mmf-sim-daily-gross" class="text-[10px] text-slate-400 block">Gross: Ksh 13.15 − WHT: Ksh 1.97</span>
                    </div>
                    <div class="p-2.5 bg-slate-950/90 border border-cyan-500/40 rounded-xl">
                        <span class="text-[10px] font-bold text-cyan-300 uppercase block">📅 30-Day Compounded</span>
                        <span id="mmf-sim-monthly-net" class="text-base font-black text-cyan-300">+Ksh 336.98 / mo</span>
                        <span id="mmf-sim-weekly-net" class="text-[10px] text-slate-400 block">7-Day: +Ksh 78.30</span>
                    </div>
                    <div class="p-2.5 bg-slate-950/90 border border-amber-500/40 rounded-xl">
                        <span class="text-[10px] font-bold text-amber-300 uppercase block">🏆 1-Yr Compounded</span>
                        <span id="mmf-sim-annual-net" class="text-base font-black text-amber-300">+Ksh 4,291.85 / yr</span>
                        <span id="mmf-sim-net-rate-lbl" class="text-[10px] text-slate-400 block">Net Rate: 10.20% p.a.</span>
                    </div>
                </div>
            </div>

            <!-- ⚖️ Dual-Metric Grand Audit Bar: Total Balance vs Accrued Profits vs Principal Saved -->
            <div class="p-4 bg-gradient-to-r from-amber-950/90 via-slate-900 to-emerald-950/90 border border-amber-500/50 rounded-2xl shadow-md space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="p-3 bg-slate-950/70 border border-amber-400/40 rounded-xl">
                        <div class="flex items-center justify-between text-xs text-amber-300 font-bold mb-1">
                            <span>🏦 Total MMF &amp; Yield Balance</span>
                            <span class="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300">Live App Match</span>
                        </div>
                        <p class="text-2xl font-black text-amber-400 convertible-amount" data-kes="${total_mmf_balance}">${formatKes(total_mmf_balance)}</p>
                        <p class="text-[10px] text-gray-400 mt-0.5">Grand balance matching your Britam / Ziidi / Sanlam / Bank statement.</p>
                    </div>

                    <div class="p-3 bg-slate-950/70 border border-emerald-400/40 rounded-xl">
                        <div class="flex items-center justify-between text-xs text-emerald-300 font-bold mb-1">
                            <span>💰 Total Accrued Real Profits</span>
                            <span class="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300">Pure Yield</span>
                        </div>
                        <p class="text-2xl font-black text-emerald-400 convertible-amount" data-kes="${total_mmf_accrued_profit}">+${formatKes(total_mmf_accrued_profit)}</p>
                        <p class="text-[10px] text-gray-400 mt-0.5">Cumulative daily compounded interest added to your capital.</p>
                    </div>

                    <div class="p-3 bg-slate-950/70 border border-cyan-400/40 rounded-xl">
                        <div class="flex items-center justify-between text-xs text-cyan-300 font-bold mb-1">
                            <span>📥 Principal Saved by You</span>
                            <span class="text-[10px] px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300">Sweat Capital</span>
                        </div>
                        <p class="text-2xl font-black text-cyan-400 convertible-amount" data-kes="${total_mmf_principal}">${formatKes(total_mmf_principal)}</p>
                        <p class="text-[10px] text-gray-400 mt-0.5">Shift earnings &amp; savings you deposited yourself.</p>
                    </div>
                </div>

                <!-- Instant Strict Audit Verification Pill -->
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 border-t border-amber-900/60 text-xs">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-black uppercase tracking-wider">✅ Strict Audit Check</span>
                        <span class="text-gray-300 text-[11px]">
                            Principal (<strong class="text-cyan-300">${formatKes(total_mmf_principal)}</strong>) + Accrued Profits (<strong class="text-emerald-300">${formatKes(total_mmf_accrued_profit)}</strong>) = Total MMF (<strong class="text-amber-300">${formatKes(total_mmf_balance)}</strong>)
                        </span>
                    </div>
                    <span class="text-[11px] font-bold ${Math.abs((total_mmf_principal + total_mmf_accrued_profit) - total_mmf_balance) < 0.05 ? 'text-emerald-400' : 'text-amber-400'}">
                        ${Math.abs((total_mmf_principal + total_mmf_accrued_profit) - total_mmf_balance) < 0.05 ? '🎯 100% Balanced &amp; Verified' : '⚡ Rebalancing in progress'}
                    </span>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${mmf_accounts.length > 0 ? mmf_accounts.map((m: any, idx: number) => {
                  const applyWht = m.apply_wht_15 !== undefined ? Boolean(m.apply_wht_15) : true;
                  const autoDaily = m.auto_daily_accrual !== undefined ? Boolean(m.auto_daily_accrual) : true;
                  const netRatePa = m.net_rate_p_a !== undefined ? Number(m.net_rate_p_a) : Number(((Number(m.interest_rate_p_a || 0)) * (applyWht ? 0.85 : 1)).toFixed(2));
                  const dailyGrossVal = m.daily_gross !== undefined ? Number(m.daily_gross) : Number(((Number(m.balance || 0) * Number(m.interest_rate_p_a || 0)) / 100 / 365).toFixed(2));
                  const dailyTaxVal = m.daily_wht_tax !== undefined ? Number(m.daily_wht_tax) : Number((dailyGrossVal - Number(m.daily_return || 0)).toFixed(2));
                  const weeklyReturnVal = m.weekly_return !== undefined ? Number(m.weekly_return) : Number((Number(m.daily_return || 0) * 7).toFixed(2));
                  return `
                <div class="mmf-card-item ${idx >= 3 ? 'hidden ' : ''}bg-white dark:bg-gray-900 p-4 rounded-xl border border-amber-100 dark:border-amber-900/50 shadow-xs space-y-3 transition-all">
                    <div class="flex justify-between items-start gap-2">
                        <div>
                            <h3 class="font-bold text-gray-900 dark:text-white text-base leading-tight">${m.name}</h3>
                            <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span class="text-[10px] font-mono text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-semibold"># ${m.account_number || m.account_type}</span>
                                <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded ${autoDaily ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}">
                                    ${autoDaily ? '🟢 Auto-Daily ON' : '⏸️ Manual'}
                                </span>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <span class="text-xs font-black px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 block">
                                ${m.interest_rate_p_a}% p.a. ${applyWht ? 'Gross' : 'Net'}
                            </span>
                            ${applyWht ? `<span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">Net: ${netRatePa}% (after 15% WHT)</span>` : ''}
                        </div>
                    </div>

                    <!-- Dual Metric Display: Total MMF Balance vs Accrued Profit -->
                    <div class="grid grid-cols-2 gap-2 text-xs">
                        <div class="p-2.5 bg-gray-50 dark:bg-gray-800/80 rounded-lg border border-gray-100 dark:border-gray-700/60">
                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">🏦 Total Balance</p>
                            <p class="font-black text-gray-900 dark:text-white text-base convertible-amount" data-kes="${m.balance}">${formatKes(m.balance)}</p>
                            <p class="text-[9px] text-gray-400">Principal: <span class="font-bold text-gray-600 dark:text-gray-300">${formatKes(m.principal_deposited || m.balance)}</span></p>
                        </div>
                        <div class="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                            <p class="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">💰 Accrued Real Profit</p>
                            <p class="font-black text-emerald-600 dark:text-emerald-400 text-base convertible-amount" data-kes="${m.total_accrued_profit || 0}">+${formatKes(m.total_accrued_profit || 0)}</p>
                            <p class="text-[9px] text-emerald-600/80 dark:text-emerald-400/80">30-Day Compounded: <span class="font-bold">+${formatKes(m.monthly_return)}</span></p>
                        </div>
                    </div>

                    <!-- Bank-Grade Daily Interest Breakdown Box -->
                    <div class="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-900/50 text-[11px] space-y-1.5">
                        <div class="flex justify-between items-center pb-1 border-b border-amber-200/50 dark:border-amber-900/40">
                            <span class="font-bold text-gray-700 dark:text-gray-200">📈 Added Daily (Net):</span>
                            <span class="text-sm font-black text-emerald-600 dark:text-emerald-400 convertible-amount" data-kes="${m.daily_return}">+${formatKes(m.daily_return)} / day</span>
                        </div>
                        ${applyWht ? `
                        <div class="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400">
                            <span>Gross Daily: <strong>${formatKes(dailyGrossVal)}</strong></span>
                            <span>15% KRA WHT: <strong class="text-rose-500">-${formatKes(dailyTaxVal)}</strong></span>
                        </div>
                        ` : ''}
                        <div class="flex justify-between items-center text-[10px] text-gray-600 dark:text-gray-300">
                            <span>7-Day: <strong class="text-emerald-600 dark:text-emerald-400">+${formatKes(weeklyReturnVal)}</strong></span>
                            <span>30-Day: <strong>+${formatKes(m.monthly_return)}</strong></span>
                            <span>1-Yr: <strong>+${formatKes(m.annual_return)}</strong></span>
                        </div>
                        ${m.recent_profit_logs && m.recent_profit_logs.length > 0 ? `
                        <div class="pt-1 border-t border-amber-200/40 dark:border-amber-900/40">
                            <span class="text-[10px] font-bold text-amber-800 dark:text-amber-300 block mb-0.5">📊 Daily Interest Credits (Auto &amp; Manual):</span>
                            <div class="flex flex-wrap gap-1">
                                ${m.recent_profit_logs.map((l: any) => `
                                <span class="px-1.5 py-0.5 rounded bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]" title="${l.date}: ${l.description}">
                                    ${l.day_name || l.date}: +Ksh ${Number(l.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                </span>`).join('')}
                            </div>
                        </div>` : ''}
                    </div>

                    <!-- Action Bar: 1-Tap Daily Credit + Multi-Day Backfill + Edit Rate/WHT -->
                    <div class="space-y-2 pt-1">
                        <div class="grid grid-cols-3 gap-1.5">
                            <form action="/accounts/interest/log/${m.id}" method="POST">
                                <input type="hidden" name="period" value="daily">
                                <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold py-2 px-1.5 rounded-lg text-[11px] transition shadow-xs flex items-center justify-center gap-1" title="Add today's net interest of ${formatKes(m.daily_return)}">
                                    <span>⚡ +${formatKes(m.daily_return)}</span>
                                </button>
                            </form>
                            <button type="button" onclick="toggleMmfProfitForm('${m.id}')" class="w-full bg-amber-50 dark:bg-amber-950/70 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold py-2 px-1.5 rounded-lg text-[11px] transition active:scale-95 flex items-center justify-center gap-1">
                                <span>📝 Custom</span>
                            </button>
                            <button type="button" onclick="document.getElementById('mmf-config-form-${m.id}')?.classList.toggle('hidden')" class="w-full bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold py-2 px-1.5 rounded-lg text-[11px] transition active:scale-95 flex items-center justify-center gap-1">
                                <span>⚙️ Rate / Days</span>
                            </button>
                        </div>

                        <!-- ⚙️ Expandable Rate, 15% WHT & Multi-Day Compounding Backfill Drawer -->
                        <div id="mmf-config-form-${m.id}" class="hidden p-3 bg-slate-900 text-white rounded-xl border border-indigo-500/40 space-y-2.5 text-xs">
                            <form action="/accounts/interest/config/${m.id}" method="POST" class="space-y-2">
                                <div class="flex items-center justify-between">
                                    <span class="font-black text-amber-300 text-[11px]">⚙️ Bank / MMF Rate &amp; Tax Settings</span>
                                    <div class="flex gap-1">
                                        <button type="button" onclick="this.closest('form').querySelector('input[name=interest_rate_p_a]').value='12.0'" class="px-1.5 py-0.5 bg-slate-800 hover:bg-amber-900 text-amber-300 rounded text-[9px] font-bold">Britam 12%</button>
                                        <button type="button" onclick="this.closest('form').querySelector('input[name=interest_rate_p_a]').value='13.5'" class="px-1.5 py-0.5 bg-slate-800 hover:bg-emerald-900 text-emerald-300 rounded text-[9px] font-bold">Ziidi 13.5%</button>
                                        <button type="button" onclick="this.closest('form').querySelector('input[name=interest_rate_p_a]').value='14.5'" class="px-1.5 py-0.5 bg-slate-800 hover:bg-sky-900 text-sky-300 rounded text-[9px] font-bold">Sanlam 14.5%</button>
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block text-[10px] text-slate-300 mb-0.5">Annual Rate (% p.a.)</label>
                                        <input type="number" step="any" name="interest_rate_p_a" value="${m.interest_rate_p_a}" class="w-full p-1.5 bg-slate-950 border border-slate-700 rounded-lg font-black text-amber-300 text-xs" required>
                                    </div>
                                    <div>
                                        <label class="block text-[10px] text-slate-300 mb-0.5">Balance (Ksh)</label>
                                        <input type="number" step="any" name="balance" value="${m.balance}" class="w-full p-1.5 bg-slate-950 border border-slate-700 rounded-lg font-black text-emerald-300 text-xs" required>
                                    </div>
                                </div>
                                <div class="flex flex-col gap-1.5 pt-1">
                                    <label class="flex items-center gap-2 cursor-pointer text-[11px] text-slate-200">
                                        <input type="checkbox" name="apply_wht_15" value="1" ${applyWht ? 'checked' : ''} class="rounded text-amber-500">
                                        <span>Deduct 15% KRA Withholding Tax (Standard for Britam/Ziidi/Banks)</span>
                                    </label>
                                    <label class="flex items-center gap-2 cursor-pointer text-[11px] text-slate-200">
                                        <input type="checkbox" name="auto_daily_accrual" value="1" ${autoDaily ? 'checked' : ''} class="rounded text-emerald-500">
                                        <span>Automatically add daily interest every day at midnight</span>
                                    </label>
                                </div>
                                <button type="submit" class="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition">
                                    💾 Save Rate &amp; Auto-Daily Settings
                                </button>
                            </form>

                            <div class="pt-2 border-t border-slate-800 space-y-1.5">
                                <span class="block text-[10px] font-bold text-emerald-300">📅 Backfill Past Daily Compounded Interest:</span>
                                <div class="grid grid-cols-3 gap-1.5">
                                    <form action="/accounts/interest/backfill/${m.id}" method="POST">
                                        <input type="hidden" name="days" value="7">
                                        <button type="submit" class="w-full py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 rounded-lg text-[10px] font-bold transition">+7 Days</button>
                                    </form>
                                    <form action="/accounts/interest/backfill/${m.id}" method="POST">
                                        <input type="hidden" name="days" value="15">
                                        <button type="submit" class="w-full py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 rounded-lg text-[10px] font-bold transition">+15 Days</button>
                                    </form>
                                    <form action="/accounts/interest/backfill/${m.id}" method="POST">
                                        <input type="hidden" name="days" value="30">
                                        <button type="submit" class="w-full py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 rounded-lg text-[10px] font-bold transition">+30 Days</button>
                                    </form>
                                </div>
                            </div>
                        </div>

                        <!-- Expandable Custom SMS / App Profit Logger Form -->
                        <form id="mmf-profit-form-${m.id}" action="/accounts/interest/log/${m.id}" method="POST" class="hidden p-2.5 bg-gray-50 dark:bg-gray-800/90 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2 text-xs">
                            <div class="flex justify-between items-center font-bold text-gray-700 dark:text-gray-300 text-[11px]">
                                <span>Enter Exact Interest Received:</span>
                                <span class="text-[10px] text-gray-400">(e.g. from Britam / Ziidi SMS)</span>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-[10px] text-gray-400 mb-0.5">Profit Amount (Ksh)</label>
                                    <input type="number" step="any" name="amount" value="${m.daily_return}" placeholder="e.g. 11.18" class="w-full p-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg font-bold text-emerald-600 dark:text-emerald-400 text-xs" required>
                                </div>
                                <div>
                                    <label class="block text-[10px] text-gray-400 mb-0.5">Date Received</label>
                                    <input type="date" name="date" value="${today}" class="w-full p-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="submit" class="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 rounded-lg text-xs transition shadow-2xs">
                                    💰 Record &amp; Credit Profit
                                </button>
                                <button type="button" onclick="toggleMmfProfitForm('${m.id}')" class="px-2.5 py-1.5 text-gray-400 hover:text-gray-600 text-xs">
                                    Cancel
                                </button>
                            </div>
                        </form>

                        <form action="/accounts/interest/log/${m.id}" method="POST">
                            <input type="hidden" name="period" value="monthly">
                            <button type="submit" class="w-full text-center text-[10px] font-bold text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition py-0.5">
                                📅 Or Credit 30-Day Compounded Yield (+${formatKes(m.monthly_return)})
                            </button>
                        </form>
                    </div>
                </div>`;
                }).join('') : `
                <div class="md:col-span-3 p-6 text-center bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 space-y-2">
                    <p class="text-xs text-gray-500">No MMF or High-Yield accounts setup yet. Click <strong>"➕ Add Britam / MMF / Bank"</strong> above to start auto-adding daily interest!</p>
                </div>`}
            </div>

            <!-- MMF Pagination Controls (3 per page) -->
            <div id="mmf-pagination-controls" class="${mmf_accounts.length <= 3 ? 'hidden' : ''} flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-amber-100 dark:border-amber-900/40 text-xs">
                <div class="text-gray-500 dark:text-gray-400 font-medium">
                    Showing <span id="mmf-visible-range" class="font-bold text-gray-900 dark:text-white">1–${Math.min(3, mmf_accounts.length)}</span> of <span id="mmf-total-filtered-count" class="font-bold text-gray-900 dark:text-white">${mmf_accounts.length}</span> funds
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" id="mmf-prev-btn" onclick="mmfPrevPage()" class="px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-950 font-bold transition flex items-center gap-1 opacity-40 cursor-not-allowed" disabled>
                        <span>‹</span> Prev
                    </button>
                    <div id="mmf-pagination-pages" class="flex items-center gap-1">
                        ${Array.from({ length: Math.ceil(mmf_accounts.length / 3) }).map((_, i) => {
                            const pageNum = i + 1;
                            const isActive = pageNum === 1;
                            return `<button type="button" onclick="mmfGoToPage(${pageNum})" class="w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${isActive ? 'bg-amber-600 text-white shadow-xs' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-950'}">${pageNum}</button>`;
                        }).join('')}
                    </div>
                    <button type="button" id="mmf-next-btn" onclick="mmfNextPage()" class="px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-950 font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer ${mmf_accounts.length <= 3 ? 'opacity-40 cursor-not-allowed' : ''}" ${mmf_accounts.length <= 3 ? 'disabled' : ''}>
                        <span>Next ›</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Accounts & Quick Transfer Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Accounts (2 cols) -->
            <div id="accounts-card" class="lg:col-span-2 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-xl shrink-0">
                            🏦
                        </div>
                        <div>
                            <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span>Your Accounts</span>
                                <span class="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">${accounts.length}</span>
                            </h2>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Wallets, mobile money, banks, MMFs and cash pots</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('add-account-form-container')?.classList.toggle('hidden')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1 active:scale-95">
                        <span>➕ Add Account</span>
                    </button>
                </div>

                <!-- Account Type Filter Pills -->
                <div class="flex flex-wrap items-center gap-1.5 p-1 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/60 text-xs">
                    <button type="button" id="acc-filter-btn-ALL" onclick="setAccFilter('ALL')" class="acc-filter-btn px-2.5 py-1 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs font-bold transition cursor-pointer">
                        All (${accounts.length})
                    </button>
                    <button type="button" id="acc-filter-btn-MOBILE" onclick="setAccFilter('MOBILE')" class="acc-filter-btn px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer">
                        📱 Mobile (${accounts.filter((a: any) => String(a.account_type || '').toUpperCase() === 'MOBILE').length})
                    </button>
                    <button type="button" id="acc-filter-btn-BANK" onclick="setAccFilter('BANK')" class="acc-filter-btn px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer">
                        🏦 Banks (${accounts.filter((a: any) => String(a.account_type || '').toUpperCase() === 'BANK').length})
                    </button>
                    <button type="button" id="acc-filter-btn-SAVINGS_MMF" onclick="setAccFilter('SAVINGS_MMF')" class="acc-filter-btn px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer">
                        📈 MMF & Savings (${accounts.filter((a: any) => ['MMF', 'SAVINGS'].includes(String(a.account_type || '').toUpperCase())).length})
                    </button>
                    <button type="button" id="acc-filter-btn-CASH" onclick="setAccFilter('CASH')" class="acc-filter-btn px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer">
                        💵 Cash (${accounts.filter((a: any) => ['CASH', 'LOOP'].includes(String(a.account_type || '').toUpperCase())).length})
                    </button>
                </div>

                <!-- Collapsible Add Account Drawer -->
                <div id="add-account-form-container" class="hidden p-4 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl space-y-3">
                    <div class="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2">
                        <h3 class="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            <span>➕ Add New Wallet or Bank Account</span>
                        </h3>
                        <button type="button" onclick="document.getElementById('add-account-form-container')?.classList.add('hidden')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs">✕</button>
                    </div>
                    <form action="/accounts/create" method="POST" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <input type="text" name="name" placeholder="Account Name (e.g. M-Pesa, Ziidi MMF)" class="p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-medium" required>
                        <input type="text" name="account_number" placeholder="Account / Phone / Till No." class="p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-medium">
                        <select name="account_type" class="p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-semibold">
                            <option value="MOBILE">Mobile Money (M-Pesa, Airtel)</option>
                            <option value="BANK">Bank Account</option>
                            <option value="SAVINGS">Savings Account (Sacco / Fixed)</option>
                            <option value="MMF">Money Market Fund (MMF)</option>
                            <option value="LOOP">Loop Business</option>
                            <option value="CASH">Cash / Petty Cash</option>
                        </select>
                        <input type="number" step="any" inputmode="decimal" name="interest_rate_p_a" placeholder="APY % (e.g. 13.45)" class="p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-medium">
                        <input type="number" step="any" inputmode="decimal" name="balance" placeholder="Initial Balance" data-placeholder-base="Initial Balance" class="p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-bold convertible-placeholder" required>
                        <div class="sm:col-span-2 lg:col-span-5 flex justify-end gap-2 pt-1">
                            <button type="button" onclick="document.getElementById('add-account-form-container')?.classList.add('hidden')" class="px-3 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold">Cancel</button>
                            <button type="submit" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-xs active:scale-95">Save Account</button>
                        </div>
                    </form>
                </div>

                <!-- Accounts Compact List -->
                <div class="space-y-2.5">
                    ${accounts.length > 0 ? accounts.map((acc: any, idx: number) => {
                        const accIcon = acc.account_type === 'MOBILE' ? '📱' :
                            acc.account_type === 'BANK' ? '🏦' :
                            acc.account_type === 'MMF' ? '📈' :
                            acc.account_type === 'SAVINGS' ? '🐷' :
                            acc.account_type === 'LOOP' ? '🔄' : '💵';

                        const iconBg = acc.account_type === 'MOBILE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                            acc.account_type === 'BANK' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                            acc.account_type === 'MMF' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                            acc.account_type === 'SAVINGS' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

                        return `
                        <div class="account-row-item ${idx >= 5 ? 'hidden ' : ''}p-3.5 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100/80 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl transition-all" data-acc-type="${String(acc.account_type || '').toUpperCase()}">
                            <div id="acc-display-${acc.id}" class="flex items-center justify-between gap-3">
                                <div class="flex items-center gap-3 min-w-0">
                                    <div class="w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center text-lg shrink-0">
                                        ${accIcon}
                                    </div>
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <h3 class="font-bold text-gray-900 dark:text-white text-sm truncate">${acc.name}</h3>
                                            <span class="text-[10px] px-2 py-0.5 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 rounded-full font-semibold border border-gray-200 dark:border-gray-700 shrink-0">${acc.account_type}</span>
                                            ${acc.interest_rate_p_a > 0 ? `<span class="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded shrink-0">📈 ${acc.interest_rate_p_a}%</span>` : ''}
                                        </div>
                                        ${acc.account_number ? `<p class="text-[11px] font-mono text-gray-400 truncate"># ${acc.account_number}</p>` : ''}
                                    </div>
                                </div>
                                <div class="flex items-center gap-3 shrink-0">
                                    <div class="text-right">
                                        <p class="font-black text-sm sm:text-base text-emerald-600 dark:text-emerald-400 convertible-amount" data-kes="${acc.balance}">${formatKes(acc.balance)}</p>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <button type="button" onclick="toggleEdit('${acc.id}')" title="Edit Account" class="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white text-xs transition active:scale-95">
                                            ✏️
                                        </button>
                                        <form action="/accounts/delete/${acc.id}" method="POST" onsubmit="return confirm('Delete account?');" class="inline">
                                            <button type="submit" title="Delete Account" class="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-950 rounded-lg text-rose-500 dark:text-rose-400 hover:text-rose-700 text-xs transition active:scale-95">
                                                🗑️
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>

                            <div id="acc-edit-${acc.id}" class="hidden space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
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
                        </div>`;
                    }).join('') : `
                    <div class="p-6 bg-gray-50 dark:bg-gray-800/60 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-center space-y-2">
                        <div class="text-3xl">💳</div>
                        <h4 class="font-bold text-gray-700 dark:text-gray-200">No accounts added yet</h4>
                        <p class="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">Add your real accounts below (e.g. M-Pesa, Bank, Sacco, Ziidi MMF, or Cash) to start tracking your real funds!</p>
                    </div>`}
                </div>

                <!-- Accounts Pagination Controls (5 per page) -->
                <div id="acc-pagination-controls" class="${accounts.length <= 5 ? 'hidden' : ''} flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
                    <div class="text-gray-500 dark:text-gray-400 font-medium">
                        Showing <span id="acc-visible-range" class="font-bold text-gray-900 dark:text-white">1–${Math.min(5, accounts.length)}</span> of <span id="acc-total-filtered-count" class="font-bold text-gray-900 dark:text-white">${accounts.length}</span> accounts
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" id="acc-prev-btn" onclick="accPrevPage()" class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold transition flex items-center gap-1 opacity-40 cursor-not-allowed" disabled>
                            <span>‹</span> Prev
                        </button>
                        <div id="acc-pagination-pages" class="flex items-center gap-1">
                            ${Array.from({ length: Math.ceil(accounts.length / 5) }).map((_, i) => {
                                const pageNum = i + 1;
                                const isActive = pageNum === 1;
                                return `<button type="button" onclick="accGoToPage(${pageNum})" class="w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${isActive ? 'bg-emerald-600 text-white shadow-xs' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}">${pageNum}</button>`;
                            }).join('')}
                        </div>
                        <button type="button" id="acc-next-btn" onclick="accNextPage()" class="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-bold transition flex items-center gap-1 active:scale-95 cursor-pointer ${accounts.length <= 5 ? 'opacity-40 cursor-not-allowed' : ''}" ${accounts.length <= 5 ? 'disabled' : ''}>
                            <span>Next ›</span>
                        </button>
                    </div>
                </div>
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

        <!-- 🔁 Monthly Recurring Bills & Standing Orders Checklist Card -->
        ${(() => {
            const totalBillsKes = (recurring_bills || []).reduce((s: number, b: any) => s + (Number(b.amount) || 0), 0);
            const paidBillsKes = (recurring_bills || []).filter((b: any) => b.is_paid_this_month).reduce((s: number, b: any) => s + (Number(b.amount) || 0), 0);
            const unpaidBillsKes = Math.max(0, totalBillsKes - paidBillsKes);
            const paidCount = (recurring_bills || []).filter((b: any) => b.is_paid_this_month).length;
            const billsPct = totalBillsKes > 0 ? Math.min(100, Math.round((paidBillsKes / totalBillsKes) * 100)) : 0;
            const curMonthLabel = today.slice(0, 7);

            return `
        <div id="recurring-bills-card" class="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-indigo-100 dark:border-indigo-900/60 p-6 space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xl">
                        🔁
                    </div>
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <h2 class="text-lg font-bold text-gray-900 dark:text-white">Monthly Recurring Bills &amp; Standing Orders Checklist</h2>
                            <span class="px-2 py-0.5 text-[10px] font-black uppercase rounded-full ${paidCount === recurring_bills.length && recurring_bills.length > 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'}">
                                ${paidCount}/${recurring_bills.length} Paid (${curMonthLabel})
                            </span>
                            <span class="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                🔗 Synced with Monthly Expenses
                            </span>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Tick off Rent, KPLC tokens, WiFi, SHA/NHIF &amp; standing orders — automatically syncs with your Monthly Expenses &amp; Category Budgets.</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <form action="/finance/bills/sync-expenses" method="POST" class="inline">
                        <button type="submit" class="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-extrabold transition active:scale-95" title="Reconcile all Recurring Bills &amp; Standing Orders with Monthly Expenses">
                            🔄 Sync Expenses
                        </button>
                    </form>
                    <button type="button" onclick="document.getElementById('add-recurring-bill-drawer').classList.toggle('hidden')" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition active:scale-95 shrink-0">
                        ➕ Add Monthly Bill
                    </button>
                </div>
            </div>

            <!-- 3-Column KPI Strip -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700">
                    <span class="text-[10px] font-bold uppercase text-gray-500 block">📋 Total Monthly Bills</span>
                    <span class="text-xl font-black text-gray-900 dark:text-white convertible-amount" data-kes="${totalBillsKes}">${formatKes(totalBillsKes)}</span>
                    <span class="text-[10px] text-gray-400 block">${recurring_bills.length} fixed monthly obligations</span>
                </div>
                <div class="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60">
                    <span class="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 block">✅ Settled This Month (In Expenses)</span>
                    <span class="text-xl font-black text-emerald-600 dark:text-emerald-400 convertible-amount" data-kes="${paidBillsKes}">${formatKes(paidBillsKes)} (${billsPct}%)</span>
                    <span class="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block">${paidCount} bill${paidCount === 1 ? '' : 's'} cleared &amp; logged in expenses for ${curMonthLabel}</span>
                </div>
                <div class="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60">
                    <span class="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-300 block">⏳ Remaining Unpaid</span>
                    <span class="text-xl font-black text-rose-600 dark:text-rose-400 convertible-amount" data-kes="${unpaidBillsKes}">${formatKes(unpaidBillsKes)}</span>
                    <span class="text-[10px] text-gray-500 block">${recurring_bills.length - paidCount} bill${recurring_bills.length - paidCount === 1 ? '' : 's'} still pending</span>
                </div>
            </div>

            <!-- Progress Bar -->
            <div class="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all" style="width: ${billsPct}%"></div>
            </div>

            <!-- Collapsible Add New Bill Drawer -->
            <div id="add-recurring-bill-drawer" class="hidden p-4 rounded-xl bg-indigo-50/50 dark:bg-slate-950/80 border border-indigo-200 dark:border-indigo-800 space-y-3">
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">➕ Add New Fixed Monthly Bill or Standing Order</h3>
                <form action="/finance/bills/create" method="POST" class="grid grid-cols-1 sm:grid-cols-6 gap-2.5 text-xs">
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 mb-0.5">Icon</label>
                        <input type="text" name="icon" value="⚡" class="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg font-bold text-center">
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-[10px] font-bold text-gray-500 mb-0.5">Bill / Standing Order Name</label>
                        <input type="text" name="name" placeholder="e.g. House Rent, KPLC Token, Zuku WiFi, SHA" class="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg font-bold text-gray-900 dark:text-white" required>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 mb-0.5">Expense Category</label>
                        <select name="category" class="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg font-semibold text-gray-900 dark:text-white">
                            <option value="Utilities & Bills">⚡ Utilities &amp; Bills</option>
                            <option value="Living Expenses">🏠 Living Expenses</option>
                            <option value="Debt & Loan Repayments">💳 Debt / Standing Order</option>
                            <option value="Food & Groceries">🛒 Food &amp; Groceries</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 mb-0.5">Monthly Amount (Ksh)</label>
                        <input type="number" step="any" min="1" name="amount" placeholder="e.g. 2500" class="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg font-black text-indigo-600 dark:text-indigo-400" required>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 mb-0.5">Due Day (1–31)</label>
                        <div class="flex gap-1.5">
                            <input type="number" min="1" max="31" name="due_day" value="5" class="w-16 p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg font-bold text-center text-gray-900 dark:text-white" required>
                            <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-3 py-2 rounded-lg transition">Save</button>
                        </div>
                    </div>
                </form>
            </div>

            <!-- Checklist Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                ${(recurring_bills || []).map((b: any) => {
                    const safeBillDomId = String(b.id).replace(/[^a-zA-Z0-9_-]/g, '_');
                    const isPaid = Boolean(b.is_paid_this_month);
                    return `
                    <div id="recurring-bill-card-${safeBillDomId}" data-bill-id="${b.id}" class="recurring-bill-item-card p-3.5 rounded-xl border ${isPaid ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40'} flex flex-col justify-between gap-2.5 transition-all">
                        <div class="flex items-start justify-between gap-2 cursor-pointer" onclick="syncBillToTransaction('${b.id}')" title="Click to sync and pre-fill Record Transaction form">
                            <div class="flex items-center gap-2.5">
                                <span class="text-xl p-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">${b.icon || '⚡'}</span>
                                <div>
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <h4 class="text-xs font-extrabold ${isPaid ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}">${b.name}</h4>
                                        <span id="bill-sync-chip-${safeBillDomId}" class="hidden px-1.5 py-0.2 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 text-[9px] font-black rounded-full uppercase tracking-wider animate-pulse">🔗 Synced</span>
                                    </div>
                                    <span class="text-[10px] text-gray-500 dark:text-gray-400 block">Due every <strong>${b.due_day}th</strong> • <strong class="text-indigo-600 dark:text-indigo-400">${formatKes(b.amount)}</strong></span>
                                </div>
                            </div>
                            <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}">
                                ${isPaid ? '✅ Paid' : '⏳ Pending'}
                            </span>
                        </div>

                        <div class="flex items-center justify-between gap-1.5 pt-2 border-t border-gray-200/70 dark:border-gray-700/60">
                            <button type="button" onclick="syncBillToTransaction('${b.id}')" class="py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[11px] font-extrabold transition active:scale-95 flex items-center gap-1 shrink-0" title="Sync & Record in Ledger">
                                <span>💳</span>
                                <span class="hidden sm:inline">Sync to Record</span>
                            </button>
                            ${!isPaid ? `
                            <button type="button" onclick="document.getElementById('pay-bill-drawer-${safeBillDomId}').classList.toggle('hidden')" class="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-extrabold transition active:scale-95 text-center">
                                ✓ Quick Mark
                            </button>
                            ` : `
                            <form action="/finance/bills/toggle-pay/${b.id}" method="POST" class="flex-1">
                                <button type="submit" class="w-full py-1 px-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-700 dark:text-gray-300 rounded-lg text-[11px] font-bold transition text-center">
                                    ↺ Undo (${b.last_paid_date || curMonthLabel})
                                </button>
                            </form>
                            `}
                            <form action="/finance/bills/delete/${b.id}" method="POST" class="inline">
                                <button type="submit" class="p-1.5 text-gray-400 hover:text-rose-500 text-xs transition" title="Delete bill">🗑️</button>
                            </form>
                        </div>

                        <!-- Inline Pay & Account Sync Drawer -->
                        <div id="pay-bill-drawer-${safeBillDomId}" class="hidden pt-2 border-t border-dashed border-gray-300 dark:border-gray-700">
                            <form action="/finance/bills/toggle-pay/${b.id}" method="POST" class="space-y-2 text-[11px]">
                                <div class="grid grid-cols-2 gap-1.5">
                                    <div>
                                        <label class="block text-[9px] font-bold text-gray-500">Amount Paid (Ksh)</label>
                                        <input type="number" step="any" name="paid_amount" value="${b.amount}" class="w-full p-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded font-bold text-gray-900 dark:text-white" required>
                                    </div>
                                    <div>
                                        <label class="block text-[9px] font-bold text-gray-500">Pay From Account</label>
                                        <select name="account_id" class="w-full p-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded font-semibold text-gray-900 dark:text-white">
                                            <option value="">-- Cash / Expense Ledger --</option>
                                            ${accounts.map((a: any) => `<option value="${a.id}" ${String(b.account_id || '') === String(a.id) ? 'selected' : ''}>${a.name}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                                <button type="submit" class="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg transition">
                                    ✅ Confirm Paid &amp; Log Expense (${curMonthLabel})
                                </button>
                            </form>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
        })()}

        <!-- ➕ Transactions & Ledger Card -->
        <div id="tx-card" class="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 space-y-4">
            ${(() => {
              const todayShifts = (rider_logs || []).filter((l: any) => String(l.date || '').slice(0, 10) === today);
              const todayEarned = todayShifts.reduce((s: number, l: any) => s + Number(l.total_earned || 0), 0);
              const todayExp = todayShifts.reduce((s: number, l: any) => s + Number(l.fuel_cost || 0) + Number(l.food_spent || 0) + Number(l.airtime_spent || 0) + Number(l.maintenance_cost || 0) + Number(l.misc_expenses || 0), 0);
              const todayNet = todayEarned - todayExp;
              return `
            <!-- 📝 Quick Daily Logger (1-Tap Daily Income & Expenses Closeout) -->
            <div id="daily-logger-card" class="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-slate-900 to-indigo-950/90 border border-emerald-700/50 text-white space-y-3 shadow-md">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5">
                        <span class="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-lg shadow-sm shrink-0">📝</span>
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <h3 class="text-sm font-black tracking-tight">Quick Daily Logger (Earnings & Expenses Closeout)</h3>
                                ${todayShifts.length > 0 ? `
                                <span class="px-2 py-0.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 rounded-full text-[10px] font-extrabold">✅ Logged Today: Net ${formatKes(todayNet)}</span>
                                ` : `
                                <span class="px-2 py-0.5 bg-amber-500/20 border border-amber-400/40 text-amber-300 rounded-full text-[10px] font-extrabold animate-pulse">⏳ Pending Today (${today})</span>
                                `}
                            </div>
                            <p class="text-[11px] text-slate-300">Log your daily gross earnings, fuel, food, airtime & misc in one go — auto-syncs with Rider Hub & Monthly Expenses.</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('quick-daily-logger-form')?.classList.toggle('hidden')" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition shrink-0 self-start sm:self-auto shadow-xs">
                        ⚡ ${todayShifts.length > 0 ? '+ Log Another Shift / Day' : 'Open Daily Logger'}
                    </button>
                </div>

                <form action="/finance/daily-logger" method="POST" id="quick-daily-logger-form" class="${todayShifts.length === 0 ? '' : 'hidden'} pt-2 border-t border-slate-800 space-y-3">
                    <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                        <div>
                            <label class="block text-[10px] font-bold text-emerald-300 uppercase mb-1">🟢 Gross Earned</label>
                            <input type="number" step="any" inputmode="decimal" name="total_earned" placeholder="e.g. 2500" class="w-full p-2 bg-slate-900 border border-emerald-600/60 text-white rounded-xl text-xs font-extrabold" required>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-amber-300 uppercase mb-1">⛽ Fuel / EV Swap</label>
                            <input type="number" step="any" inputmode="decimal" name="fuel_cost" placeholder="0" class="w-full p-2 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-bold">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-rose-300 uppercase mb-1">🍲 Food / Lunch</label>
                            <input type="number" step="any" inputmode="decimal" name="food_spent" placeholder="0" class="w-full p-2 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-bold">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-sky-300 uppercase mb-1">📱 Airtime / Data</label>
                            <input type="number" step="any" inputmode="decimal" name="airtime_spent" placeholder="0" class="w-full p-2 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-bold">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-purple-300 uppercase mb-1">🔧 Maintenance</label>
                            <input type="number" step="any" inputmode="decimal" name="maintenance_cost" placeholder="0" class="w-full p-2 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-bold">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-300 uppercase mb-1">📦 Misc Spend</label>
                            <input type="number" step="any" inputmode="decimal" name="misc_expenses" placeholder="0" class="w-full p-2 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-bold">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-indigo-300 uppercase mb-1">📅 Date</label>
                            <input type="date" name="date" value="${today}" class="w-full p-2 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-bold" required>
                        </div>
                    </div>
                    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                        <div class="flex flex-wrap items-center gap-2 flex-1">
                            <select name="channel" class="p-2 bg-slate-900 border border-emerald-600/60 text-white rounded-xl text-xs font-semibold">
                                <option value="ALL">🌐 All Platforms (Blended Multi-App)</option>
                                <optgroup label="📦 Delivery Platforms (Motorbike &amp; Electric EV)">
                                    <option value="UBER_DELIVERY">🛵 Uber Delivery / Uber Eats (Motorbike)</option>
                                    <option value="UBER_DELIVERY_EV">🔋 Uber Delivery / Uber Eats (Electric Bike / EV)</option>
                                    <option value="GLOVO_DELIVERY">🛵 Glovo Delivery (Motorbike)</option>
                                    <option value="GLOVO_DELIVERY_EV">🔋 Glovo Delivery (Electric Bike / EV)</option>
                                    <option value="BOLT_DELIVERY">🛵 Bolt Delivery / Bolt Food (Motorbike)</option>
                                    <option value="BOLT_DELIVERY_EV">🔋 Bolt Delivery / Bolt Food (Electric Bike / EV)</option>
                                </optgroup>
                                <optgroup label="🚗 Car Rides (Uber, Bolt, Faras, Yego — Petrol &amp; Electric EV)">
                                    <option value="UBER_CAR">🚗 Uber Car Ride (UberX / ChapChap / Comfort)</option>
                                    <option value="UBER_CAR_EV">⚡ Uber Electric Car Ride (Green / EV)</option>
                                    <option value="BOLT_CAR">🚗 Bolt Car Ride (Bolt / Base / Lite)</option>
                                    <option value="BOLT_CAR_EV">⚡ Bolt Electric Car Ride (EV)</option>
                                    <option value="FARAS_CAR">🚗 Faras Car Ride</option>
                                    <option value="FARAS_CAR_EV">⚡ Faras Electric Car Ride (EV)</option>
                                    <option value="YEGO_CAR">🚗 Yego Car Ride</option>
                                    <option value="YEGO_CAR_EV">⚡ Yego Electric Car Ride (EV)</option>
                                    <option value="LITTLE">🚗 Little Cab Car Ride</option>
                                    <option value="INDRIVE">🚗 inDrive Car Ride</option>
                                </optgroup>
                                <optgroup label="🛵 Motorbike / Boda Rides (Uber, Bolt, Faras, Yego — Petrol &amp; EV)">
                                    <option value="UBER_BODA">🛵 Uber Boda (Motorbike)</option>
                                    <option value="UBER_BODA_EV">🔋 Uber Electric Boda (EV)</option>
                                    <option value="BOLT_BODA">🛵 Bolt Boda (Motorbike)</option>
                                    <option value="BOLT_BODA_EV">🔋 Bolt Electric Boda (EV)</option>
                                    <option value="FARAS_BODA">🛵 Faras Boda (Motorbike)</option>
                                    <option value="FARAS_BODA_EV">🔋 Faras Electric Boda (EV)</option>
                                    <option value="YEGO_BODA">🛵 Yego Boda (Motorbike)</option>
                                    <option value="YEGO_BODA_EV">🔋 Yego Electric Boda (EV)</option>
                                    <option value="BODA">🛵 Stage / Private Boda (Motorbike / EV)</option>
                                </optgroup>
                                <optgroup label="💼 Offline &amp; Direct Clients">
                                    <option value="PRIVATE">💼 Private Clients / Offline Fares</option>
                                </optgroup>
                            </select>
                            <select name="account_id" class="p-2 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs font-semibold">
                                <option value="">-- Auto-Select Primary Wallet (M-Pesa) --</option>
                                ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (${formatKes(a.balance)})</option>`).join('')}
                            </select>
                            <input type="text" name="notes" placeholder="Optional note (e.g. Uber/Bolt shift, CBD deliveries)" class="flex-1 min-w-[180px] p-2 bg-slate-900 border border-slate-700 text-white rounded-xl text-xs">
                        </div>
                        <button type="submit" class="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition shadow-md active:scale-95">
                            ✅ Save Daily Logger & Sync Expenses
                        </button>
                    </div>
                </form>
            </div>`;
            })()}

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
            <form action="/transactions/create" method="POST" id="record-transaction-form" class="space-y-3">
                <input type="hidden" name="linked_bill_id" id="tx-linked-bill-id" value="">
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
                        <select name="transaction_type" id="tx-type-select" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-semibold">
                            <option value="EXPENSE">🔴 Expense</option>
                            <option value="INCOME">🟢 Income</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Account / Wallet</label>
                        <select name="account_id" id="tx-account-select" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-semibold">
                            <option value="">-- No Account / Cash --</option>
                            ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Category</label>
                        <select name="category" id="tx-category-select" onchange="onTxCategoryChange(this.value)" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-semibold">
                            <optgroup label="🏷️ Standard Categories">
                                <option value="Living Expenses">🏠 Living Expenses</option>
                                <option value="Food &amp; Groceries">🛒 Food &amp; Groceries</option>
                                <option value="Fuel &amp; Petrol">⛽ Fuel &amp; Petrol</option>
                                <option value="EV Battery Swap &amp; Charging">⚡ EV Battery Swap &amp; Charging</option>
                                <option value="Utilities &amp; Bills">💡 Utilities &amp; Bills</option>
                                <option value="Bike Maintenance &amp; Repairs">🔧 Vehicle / Car Maintenance &amp; Repairs</option>
                                <option value="Rider &amp; Boda Deliveries">🚗 / 🛵 Ride-Hailing (Uber/Bolt) &amp; Deliveries</option>
                                <option value="M-Pesa Income">📲 M-Pesa Income</option>
                                <option value="MMF Interest">📈 MMF Yield / Interest</option>
                                <option value="Debt &amp; Loan Repayments">💳 Debt &amp; Loan Repayments</option>
                                <option value="Other">✏️ Other (Custom...)</option>
                            </optgroup>
                            ${(recurring_bills || []).length > 0 ? `
                            <optgroup label="🔁 Monthly Recurring Bills (Auto-Sync &amp; Settle)">
                                ${(recurring_bills || []).map((b: any) => `
                                    <option value="BILL:${b.id}" data-bill-id="${b.id}" data-bill-name="${b.name}" data-bill-amount="${b.amount}" data-bill-category="${b.category || 'Utilities & Bills'}" data-bill-account="${b.account_id || ''}">
                                        ${b.icon || '⚡'} ${b.name} — Ksh ${Number(b.amount).toLocaleString()} (Due ${b.due_day}th${b.is_paid_this_month ? ' • ✅ Paid' : ' • ⏳ Pending'})
                                    </option>
                                `).join('')}
                            </optgroup>
                            ` : ''}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Amount (<span class="curr-symbol-label">Ksh</span>)</label>
                        <input type="number" step="any" inputmode="decimal" name="amount" id="tx-amount-input" placeholder="0.00" data-placeholder-base="0.00" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-bold convertible-placeholder" required>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
                        <input type="date" name="t_date" id="tx-date-input" value="${today}" class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-base sm:text-sm font-semibold" required>
                    </div>
                </div>

                <!-- Active Recurring Bill Sync Banner -->
                <div id="tx-bill-sync-banner" class="hidden p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-emerald-50 dark:from-indigo-950/70 dark:to-emerald-950/60 border border-indigo-200 dark:border-indigo-800 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-extrabold text-[10px] uppercase tracking-wider">🔁 Synced with Recurring Bill</span>
                        <span id="tx-bill-sync-text" class="font-extrabold text-gray-900 dark:text-white"></span>
                    </div>
                    <div class="flex items-center gap-2">
                        <a href="#recurring-bills-card" class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline text-[11px]">View in Checklist ↑</a>
                        <button type="button" onclick="unlinkRecurringBillFromTx()" class="px-2 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:text-rose-500 rounded-lg text-xs font-bold transition">✕ Unlink</button>
                    </div>
                </div>

                <!-- Matching Recurring Bills Quick Chips (When category is Utilities & Bills or Living Expenses) -->
                <div id="tx-category-bills-chips" class="hidden flex items-center gap-1.5 flex-wrap p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-xs">
                    <span class="text-[11px] font-extrabold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                        <span>⚡</span> Recurring Bills in this Category:
                    </span>
                    <div id="tx-category-bills-chips-list" class="flex items-center gap-1.5 flex-wrap"></div>
                </div>

                <!-- Note / Custom Category Memo & Where money went/came in -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div id="custom-category-container" class="hidden">
                        <label class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">Specify Custom Category</label>
                        <input type="text" name="custom_category" id="tx-custom-category" placeholder="e.g. Medical, Tithe, School Fees, Client Tip..." class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-indigo-300 dark:border-indigo-700 text-gray-900 dark:text-white rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500">
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Where did money go / come from? (Note / Memo)</label>
                        <input type="text" name="description" id="tx-description-input" placeholder="e.g. Paid mechanic Kamau for brake pads, Client tip, Java lunch, KPLC Token..." class="w-full p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500">
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

                <!-- 🔍 Instant Keyword Search & Month Filter Bar -->
                ${(() => {
                    const uniqueMonths = Array.from(new Set((transactions || []).map((t: any) => String(t.date || '').slice(0, 7)).filter((m: string) => m.length === 7))).sort().reverse();
                    return `
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/70">
                    <div class="relative flex-1">
                        <input type="text" id="tx-search-input" oninput="onTxSearchOrMonthChange()" placeholder="🔍 Search transactions by party, category, M-Pesa ref, memo, or amount (e.g. Rubis, Ziidi, Fuel)..." class="w-full pl-3 pr-8 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500">
                    </div>
                    <div class="flex items-center gap-2">
                        <select id="tx-month-filter" onchange="onTxSearchOrMonthChange()" class="p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200">
                            <option value="ALL">📅 All Months</option>
                            ${uniqueMonths.map((m) => `<option value="${m}">${m}</option>`).join('')}
                        </select>
                        <button type="button" onclick="clearTxSearchFilters()" class="px-2.5 py-2 bg-gray-200/80 dark:bg-gray-700 hover:bg-gray-300 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold transition shrink-0">
                            Reset
                        </button>
                        <span id="tx-filtered-summary-pill" class="hidden px-2.5 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-black shrink-0"></span>
                    </div>
                </div>`;
                })()}

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
                            const searchBlob = `${t.category || ''} ${t.description || ''} ${acc ? acc.name : ''} ${t.date || ''} ${t.amount || ''}`.replace(/"/g, '&quot;');
                            return `
                            <div class="tx-item tx-mobile-item p-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100/70 dark:hover:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 transition ${isHidden ? 'hidden' : ''}" data-tx-type="${itemFilterType}" data-tx-date="${t.date || ''}" data-tx-amount="${t.amount || 0}" data-tx-search="${searchBlob}">
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
                                    const searchBlob = `${t.category || ''} ${t.description || ''} ${acc ? acc.name : ''} ${t.date || ''} ${t.amount || ''}`.replace(/"/g, '&quot;');
                                    return `
                                    <tr class="tx-item tx-desktop-item hover:bg-gray-50 dark:hover:bg-gray-800/40 transition ${isHidden ? 'hidden' : ''}" data-tx-type="${itemFilterType}" data-tx-date="${t.date || ''}" data-tx-amount="${t.amount || 0}" data-tx-search="${searchBlob}">
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
        <div class="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl border border-gray-100 dark:border-gray-800 space-y-4 my-8">
            <div class="flex justify-between items-start sm:items-center border-b dark:border-gray-800 pb-3 gap-2">
                <div class="flex items-center space-x-2.5">
                    <span class="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shrink-0">⚙️</span>
                    <div>
                        <h3 class="font-extrabold text-gray-900 dark:text-white text-base">Flexible Waterfall Split Rules</h3>
                        <p class="text-[11px] text-gray-500 dark:text-gray-400">Customize existing buckets or add as many of your own split options as you need</p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <form action="/rules/reset" method="POST" onsubmit="return confirm('Reset split rules back to the 5 default buckets?');">
                        <button type="submit" title="Reset to Default 5 Rules" class="px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-[11px] font-bold text-gray-600 dark:text-gray-300 transition">
                            🔄 Reset Default 5
                        </button>
                    </form>
                    <button type="button" onclick="document.getElementById('rules-modal').classList.add('hidden')" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white text-sm transition">✕</button>
                </div>
            </div>

            <!-- Hidden template for dynamic target destination options -->
            <select id="rule-target-options-template" class="hidden" aria-hidden="true">
                <option value="">-- Smart Auto-Match / General --</option>
                <optgroup label="Connected Accounts (Bank / MMF / Sacco)">
                    ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (${a.account_type || 'Account'})</option>`).join('')}
                </optgroup>
                <optgroup label="Active Savings Goals">
                    ${goals.map((g: any) => `<option value="${g.id}">🎯 ${g.title}</option>`).join('')}
                </optgroup>
                <optgroup label="Loans &amp; Debts">
                    ${debts.map((d: any) => `<option value="${d.id}">💳 ${d.lender_name || d.title || 'Loan'}</option>`).join('')}
                </optgroup>
                <optgroup label="Recurring Bills">
                    ${bills.map((b: any) => `<option value="${b.id}">🧾 ${b.name || b.title || 'Bill'}</option>`).join('')}
                </optgroup>
            </select>

            <!-- Live Total % Indicator, Progress Bar & Quick Balance Helpers -->
            <div class="p-3.5 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-2.5">
                <div class="flex flex-wrap justify-between items-center gap-2 text-xs">
                    <span class="font-bold text-gray-700 dark:text-gray-300">Total Allocation: <strong id="rules-modal-total" class="text-sm font-black text-indigo-600 dark:text-indigo-400">100%</strong></span>
                    <span id="rules-modal-badge" class="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">✅ 100% (Balanced)</span>
                </div>
                <div class="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div id="rules-modal-bar" class="h-full rounded-full transition-all duration-300 bg-emerald-500" style="width: 100%"></div>
                </div>
                <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span class="text-[11px] text-gray-500 dark:text-gray-400">Tip: Add any custom option below, then click <strong>Auto-Balance 100%</strong>.</span>
                    <div class="flex items-center gap-1.5">
                        <button type="button" onclick="balanceRulesTo100()" class="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-950/80 hover:bg-indigo-200 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg text-[11px] font-bold transition active:scale-95">
                            ⚖️ Auto-Balance 100%
                        </button>
                        <button type="button" onclick="distributeRulesEvenly()" class="px-2.5 py-1 bg-gray-200/80 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-[11px] font-bold transition active:scale-95">
                            🟰 Split Evenly
                        </button>
                    </div>
                </div>
            </div>

            <!-- 🏆 1-Tap "Pay Yourself First" Ratio Blueprints -->
            <div class="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/60 space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">👑 1-Tap "Pay Yourself First" Ratio Blueprints</span>
                    <span class="text-[10px] font-semibold text-amber-700 dark:text-amber-400">Preview &amp; customize before saving</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <button type="button" onclick="applySplitRatioPresetClient('PAY_YOURSELF_FLEET')" class="p-2 text-left bg-white dark:bg-gray-900 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 border border-amber-300 dark:border-amber-800 rounded-xl transition active:scale-95">
                        <div class="text-xs font-black text-amber-900 dark:text-amber-200">🏆 30-20-15-10-25 (Pay Yourself + Fleet)</div>
                        <div class="text-[10px] text-gray-600 dark:text-gray-400">30% MMF/Sacco • 20% Goals • 15% Bills • 10% Fleet • 25% Living</div>
                    </button>
                    <button type="button" onclick="applySplitRatioPresetClient('AGGRESSIVE_WEALTH')" class="p-2 text-left bg-white dark:bg-gray-900 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-800 rounded-xl transition active:scale-95">
                        <div class="text-xs font-black text-emerald-900 dark:text-emerald-200">🚀 40-20-15-25 (Aggressive Wealth)</div>
                        <div class="text-[10px] text-gray-600 dark:text-gray-400">40% MMF+Sacco • 20% Goals • 15% Bills/Fleet • 25% Living</div>
                    </button>
                    <button type="button" onclick="applySplitRatioPresetClient('DEBT_CRUSHER')" class="p-2 text-left bg-white dark:bg-gray-900 hover:bg-rose-100/70 dark:hover:bg-rose-900/40 border border-rose-300 dark:border-rose-800 rounded-xl transition active:scale-95">
                        <div class="text-xs font-black text-rose-900 dark:text-rose-200">💳 20-20-15-15-30 (Debt Crusher)</div>
                        <div class="text-[10px] text-gray-600 dark:text-gray-400">20% Loans • 20% Pay Yourself • 15% Goals • 15% Bills • 30% Living</div>
                    </button>
                    <button type="button" onclick="applySplitRatioPresetClient('DEFAULT_5')" class="p-2 text-left bg-white dark:bg-gray-900 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl transition active:scale-95">
                        <div class="text-xs font-black text-indigo-900 dark:text-indigo-200">🔄 20-20-15-15-30 (Classic 5-Bucket)</div>
                        <div class="text-[10px] text-gray-600 dark:text-gray-400">20% MMF • 20% Goals • 15% Sacco • 15% Bills • 30% Living</div>
                    </button>
                </div>
            </div>

            <!-- Quick-Add Custom & Preset Option Chips -->
            <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">⚡ Instant Add Split Option (1-Tap or Custom)</span>
                    <button type="button" onclick="addCustomRuleRow('', '✨', 10, 'CUSTOM', '')" class="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                        <span>➕ Add Blank Custom Option</span>
                    </button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    <button type="button" onclick="addCustomRuleRow('', '✨', 10, 'CUSTOM', '')" class="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-[11px] font-bold transition active:scale-95">
                        ✨ + Custom Option
                    </button>
                    <button type="button" onclick="addCustomRuleRow('Pay Yourself First (MMF + Sacco)', '👑', 30, 'ACCOUNT', '')" class="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-xl text-[11px] font-bold transition active:scale-95">
                        👑 Pay Yourself First (30%)
                    </button>
                    <button type="button" onclick="addCustomRuleRow('Fleet Service &amp; Docs Reserve', '🛠️', 10, 'CUSTOM', '')" class="px-2.5 py-1.5 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900 border border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 rounded-xl text-[11px] font-bold transition active:scale-95">
                        🛠️ Fleet Service &amp; Docs (10%)
                    </button>
                    <button type="button" onclick="addCustomRuleRow('Emergency Fund', '🛡️', 10, 'ACCOUNT', '')" class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-[11px] font-semibold transition active:scale-95">
                        🛡️ Emergency Fund
                    </button>
                    <button type="button" onclick="addCustomRuleRow('Tithe &amp; Giving', '🙏', 10, 'CUSTOM', '')" class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-[11px] font-semibold transition active:scale-95">
                        🙏 Tithe &amp; Giving
                    </button>
                    <button type="button" onclick="addCustomRuleRow('Loan / Debt Payoff', '💳', 15, 'DEBT', '')" class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-[11px] font-semibold transition active:scale-95">
                        💳 Loan Repayment
                    </button>
                    <button type="button" onclick="addCustomRuleRow('Fuel &amp; Rider Float', '⛽', 10, 'CASH', '')" class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-[11px] font-semibold transition active:scale-95">
                        ⛽ Fuel &amp; Float
                    </button>
                    <button type="button" onclick="addCustomRuleRow('Chama / Stock Investment', '📈', 10, 'ACCOUNT', '')" class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-[11px] font-semibold transition active:scale-95">
                        📈 Chama / Invest
                    </button>
                    <button type="button" onclick="addCustomRuleRow('Rent &amp; House Bills', '🏠', 15, 'BILL', '')" class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-[11px] font-semibold transition active:scale-95">
                        🏠 Rent &amp; Housing
                    </button>
                    <button type="button" onclick="addCustomRuleRow('Family / Black Tax Support', '🤝', 5, 'CUSTOM', '')" class="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-[11px] font-semibold transition active:scale-95">
                        🤝 Family Support
                    </button>
                </div>
            </div>

            <!-- Main Unified Rules Update Form -->
            <form action="/rules/update" method="POST" id="rules-update-form" onsubmit="saveRulesLocally(event)" class="space-y-3.5">
                <input type="hidden" name="ordered_rule_ids" id="ordered-rule-ids" value="${allocation_rules.map((r: any) => r.id).join(',')}">
                <input type="hidden" name="deleted_rule_ids" id="deleted-rule-ids" value="">

                <div id="rules-list-container" class="space-y-2.5 max-h-[46vh] overflow-y-auto no-scrollbar pr-1">
                    ${allocation_rules.map((r: any) => `
                    <div class="rule-row-card p-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-2.5 transition" data-rule-id="${r.id}">
                        <div class="flex items-center gap-2">
                            <!-- Emoji Icon -->
                            <input type="text" name="icon_${r.id}" value="${r.icon || '💰'}" class="w-10 p-2 text-center text-base bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl font-bold shrink-0">
                            
                            <!-- Bucket Name -->
                            <input type="text" name="bucket_name_${r.id}" value="${r.bucket_name}" placeholder="Enter custom option name..." class="flex-1 p-2 text-xs font-bold bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white" required>
                            
                            <!-- Percentage -->
                            <div class="flex items-center space-x-1 shrink-0">
                                <input type="number" step="any" min="0" max="100" inputmode="decimal" name="percentage_${r.id}" value="${r.percentage}" oninput="updateRulesModalTotal()" class="rule-pct-input w-16 p-2 text-xs font-black text-center bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500" required>
                                <span class="text-xs font-bold text-gray-500">%</span>
                            </div>

                            <!-- Delete Button -->
                            <button type="button" onclick="removeRuleRow('${r.id}')" title="Remove Option" class="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition shrink-0">
                                🗑️
                            </button>
                        </div>

                        <!-- Target Destination Selector -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-gray-200 dark:border-gray-700/60">
                            <div>
                                <label class="block text-[10px] font-semibold text-gray-400 mb-0.5">Option Category / Type</label>
                                <select name="target_type_${r.id}" class="w-full p-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    <option value="ACCOUNT" ${r.target_type === 'ACCOUNT' ? 'selected' : ''}>🏦 Bank / MMF / Sacco Account</option>
                                    <option value="GOAL" ${r.target_type === 'GOAL' ? 'selected' : ''}>🎯 Savings Goal</option>
                                    <option value="DEBT" ${r.target_type === 'DEBT' ? 'selected' : ''}>💳 Loan / Debt Repayment</option>
                                    <option value="BILL" ${r.target_type === 'BILL' ? 'selected' : ''}>🧾 Recurring Bill Reserve</option>
                                    <option value="CASH" ${r.target_type === 'CASH' ? 'selected' : ''}>💵 Daily Cash / Pocket Wallet</option>
                                    <option value="CUSTOM" ${r.target_type === 'CUSTOM' ? 'selected' : ''}>✨ Custom Personal Option</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-semibold text-gray-400 mb-0.5">Linked Account / Goal / Loan (Optional)</label>
                                <select name="target_id_${r.id}" class="w-full p-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    <option value="">-- Smart Auto-Match / General --</option>
                                    <optgroup label="Connected Accounts (Bank / MMF / Sacco)">
                                        ${accounts.map((a: any) => `<option value="${a.id}" ${r.target_id === a.id ? 'selected' : ''}>${a.name} (${a.account_type || 'Account'})</option>`).join('')}
                                    </optgroup>
                                    <optgroup label="Active Savings Goals">
                                        ${goals.map((g: any) => `<option value="${g.id}" ${r.target_id === g.id ? 'selected' : ''}>🎯 ${g.title}</option>`).join('')}
                                    </optgroup>
                                    <optgroup label="Loans &amp; Debts">
                                        ${debts.map((d: any) => `<option value="${d.id}" ${r.target_id === d.id ? 'selected' : ''}>💳 ${d.lender_name || d.title || 'Loan'}</option>`).join('')}
                                    </optgroup>
                                    <optgroup label="Recurring Bills">
                                        ${bills.map((b: any) => `<option value="${b.id}" ${r.target_id === b.id ? 'selected' : ''}>🧾 ${b.name || b.title || 'Bill'}</option>`).join('')}
                                    </optgroup>
                                </select>
                            </div>
                        </div>
                    </div>`).join('')}
                </div>

                <!-- Inline Custom Option Builder (works either via "+ Append to List" OR directly when clicking Save) -->
                <div id="add-rule-form-container" class="hidden p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 space-y-2.5">
                    <div class="flex justify-between items-center">
                        <h4 class="text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">➕ Build Your Own Custom Split Option</h4>
                        <button type="button" onclick="document.getElementById('add-rule-form-container').classList.add('hidden')" class="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div class="sm:col-span-2">
                            <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Icon</label>
                            <input type="text" id="inline-new-icon" name="new_icon" value="✨" class="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-bold text-center">
                        </div>
                        <div class="sm:col-span-7">
                            <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Your Option Name</label>
                            <input type="text" id="inline-new-bucket-name" name="new_bucket_name" placeholder="e.g. Plot Fund, Mama Mboga, Bike Service, Tithe..." class="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-bold">
                        </div>
                        <div class="sm:col-span-3">
                            <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Split %</label>
                            <input type="number" step="any" min="0" max="100" id="inline-new-percentage" name="new_percentage" value="10" class="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-center text-indigo-600 dark:text-indigo-400">
                        </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Option Category / Type</label>
                            <select id="inline-new-target-type" name="new_target_type" class="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-semibold">
                                <option value="CUSTOM">✨ Custom Personal Option</option>
                                <option value="ACCOUNT">🏦 Bank / MMF / Sacco</option>
                                <option value="GOAL">🎯 Savings Goal</option>
                                <option value="DEBT">💳 Loan / Debt Repayment</option>
                                <option value="BILL">🧾 Recurring Bill Reserve</option>
                                <option value="CASH">💵 Daily Living Cash</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] text-gray-500 font-semibold mb-0.5">Link to Account / Goal / Loan (Optional)</label>
                            <select id="inline-new-target-id" name="new_target_id" class="w-full p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl text-xs font-semibold">
                                <option value="">-- Smart Auto-Match / General --</option>
                                <optgroup label="Accounts">
                                    ${accounts.map((a: any) => `<option value="${a.id}">${a.name}</option>`).join('')}
                                </optgroup>
                                <optgroup label="Goals">
                                    ${goals.map((g: any) => `<option value="${g.id}">🎯 ${g.title}</option>`).join('')}
                                </optgroup>
                                <optgroup label="Loans &amp; Debts">
                                    ${debts.map((d: any) => `<option value="${d.id}">💳 ${d.lender_name || d.title || 'Loan'}</option>`).join('')}
                                </optgroup>
                                <optgroup label="Recurring Bills">
                                    ${bills.map((b: any) => `<option value="${b.id}">🧾 ${b.name || b.title || 'Bill'}</option>`).join('')}
                                </optgroup>
                            </select>
                        </div>
                    </div>
                    <button type="button" onclick="addInlineNewRuleToList()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition active:scale-95 shadow-xs">
                        ➕ Add This Option to List Above
                    </button>
                </div>

                <div class="flex flex-col sm:flex-row gap-2 pt-2 border-t dark:border-gray-800">
                    <button type="button" onclick="addCustomRuleRow('', '✨', 10, 'CUSTOM', '')" class="px-4 py-3 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold rounded-2xl text-xs transition active:scale-95 whitespace-nowrap">
                        <span>➕ Add Another Option</span>
                    </button>
                    <button type="button" onclick="document.getElementById('add-rule-form-container').classList.toggle('hidden')" class="px-3.5 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-bold rounded-2xl text-xs transition active:scale-95 whitespace-nowrap">
                        <span>🛠️ Custom Builder</span>
                    </button>
                    <button type="submit" id="rules-save-btn" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-4 rounded-2xl text-xs transition shadow-md active:scale-95 flex items-center justify-center gap-1.5">
                        <span>💾 Save All Split Options &amp; Percentages</span>
                    </button>
                </div>
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

    <!-- 📷 Live Camera Modal for M-Pesa & Bank SMS Scanner -->
    <div id="mpesa-live-camera-modal" class="hidden fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-gray-900 border border-gray-700 rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl text-white">
            <div class="flex justify-between items-center border-b border-gray-800 pb-3">
                <div class="flex items-center space-x-2.5">
                    <span class="text-2xl">📷</span>
                    <div>
                        <h3 class="font-extrabold text-sm text-white">Snap M-Pesa / Bank SMS Photo</h3>
                        <p class="text-[11px] text-emerald-400 font-semibold">Point camera at receipt or SMS screen &amp; tap Capture</p>
                    </div>
                </div>
                <button type="button" onclick="closeMpesaCameraModal()" class="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center justify-center font-bold">✕</button>
            </div>

            <div class="relative bg-black rounded-2xl overflow-hidden border border-gray-800 aspect-[4/3] flex items-center justify-center">
                <video id="mpesa-live-camera-video" autoplay playsinline muted class="w-full h-full object-cover"></video>
                <div id="mpesa-live-camera-status" class="hidden absolute inset-0 bg-gray-950/90 p-6 flex flex-col items-center justify-center text-center text-xs text-amber-300 space-y-2">
                    ⏳ Starting camera...
                </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button type="button" onclick="flipMpesaCamera()" class="px-3.5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5">
                    <span>🔄 Flip Camera</span>
                </button>

                <button type="button" id="mpesa-live-camera-snap-btn" onclick="captureMpesaCameraFrame()" class="flex-1 py-2.5 px-5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-1.5 active:scale-95">
                    <span>📸 Capture &amp; Scan SMS</span>
                </button>

                <label class="cursor-pointer px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5">
                    <span>📱 Select / Capture from Device</span>
                    <input type="file" accept="image/*" capture="environment" class="sr-only" onchange="handleMpesaCameraFallbackInput(this)">
                </label>
            </div>
        </div>
    </div>

    <!-- Universal Profile Switcher Modal -->
    <div id="profile-switcher-modal" class="hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div class="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
                <div>
                    <h3 class="font-extrabold text-base text-gray-900 dark:text-white">Choose Your Finatrack Profile</h3>
                    <p class="text-xs text-gray-500">Switch between profiles anytime. All accounts, goals &amp; wealth data stay unified!</p>
                </div>
                <button type="button" onclick="closeProfileModal()" class="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div class="grid grid-cols-1 gap-2.5 text-xs">
                <!-- 1. Rider Mode -->
                <form action="/profile/switch" method="POST">
                    <input type="hidden" name="profile_mode" value="RIDER">
                    <button type="submit" class="w-full p-3.5 rounded-2xl border ${activeProfileMode === 'RIDER' ? 'border-2 border-blue-500 bg-blue-50/60 dark:bg-blue-950/40' : 'border-gray-200 dark:border-gray-800 hover:border-blue-500 bg-white dark:bg-gray-800/80 hover:bg-blue-50/50 dark:hover:bg-blue-950/40'} text-left transition flex items-center justify-between group active:scale-98">
                        <div class="flex items-center space-x-3">
                            <span class="text-2xl p-2 bg-blue-100 dark:bg-blue-950 rounded-xl">🛵</span>
                            <div>
                                <span class="font-bold text-sm text-gray-900 dark:text-white block group-hover:text-blue-600">Mobility &amp; Rider Mode ${activeProfileMode === 'RIDER' ? '<span class="text-xs text-blue-600 font-extrabold ml-1">(Active)</span>' : ''}</span>
                                <span class="text-gray-500 dark:text-gray-400">Kilometers, Fuel, CPK &amp; 23:50 Shift Closeout Ritual</span>
                            </div>
                        </div>
                        <span class="text-blue-600 font-extrabold text-xs">${activeProfileMode === 'RIDER' ? '✓ Active' : 'Switch →'}</span>
                    </button>
                </form>

                <!-- 2. Mama Mboga Mode -->
                <form action="/profile/switch" method="POST">
                    <input type="hidden" name="profile_mode" value="TRADER">
                    <button type="submit" class="w-full p-3.5 rounded-2xl border ${activeProfileMode === 'TRADER' ? 'border-2 border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40' : 'border-gray-200 dark:border-gray-800 hover:border-emerald-500 bg-white dark:bg-gray-800/80 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40'} text-left transition flex items-center justify-between group active:scale-98">
                        <div class="flex items-center space-x-3">
                            <span class="text-2xl p-2 bg-emerald-100 dark:bg-emerald-950 rounded-xl">🥬</span>
                            <div>
                                <span class="font-bold text-sm text-gray-900 dark:text-white block group-hover:text-emerald-600">Mama Mboga &amp; Micro-Shop ${activeProfileMode === 'TRADER' ? '<span class="text-xs text-emerald-600 font-extrabold ml-1">(Active)</span>' : ''}</span>
                                <span class="text-gray-500 dark:text-gray-400">Marikiti Soko Restock, Kanjo Fees &amp; Daftari ya Mkopo</span>
                            </div>
                        </div>
                        <span class="text-emerald-600 font-extrabold text-xs">${activeProfileMode === 'TRADER' ? '✓ Active' : 'Switch →'}</span>
                    </button>
                </form>

                <!-- 3. Salaried Mode -->
                <form action="/profile/switch" method="POST">
                    <input type="hidden" name="profile_mode" value="SALARIED">
                    <button type="submit" class="w-full p-3.5 rounded-2xl border ${activeProfileMode === 'SALARIED' ? 'border-2 border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40' : 'border-gray-200 dark:border-gray-800 hover:border-indigo-500 bg-white dark:bg-gray-800/80 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40'} text-left transition flex items-center justify-between group active:scale-98">
                        <div class="flex items-center space-x-3">
                            <span class="text-2xl p-2 bg-indigo-100 dark:bg-indigo-950 rounded-xl">💼</span>
                            <div>
                                <span class="font-bold text-sm text-gray-900 dark:text-white block group-hover:text-indigo-600">Salaried &amp; Professional ${activeProfileMode === 'SALARIED' ? '<span class="text-xs text-indigo-600 font-extrabold ml-1">(Active)</span>' : ''}</span>
                                <span class="text-gray-500 dark:text-gray-400">Monthly Payday Waterfall &amp; Salary Runway Pacing</span>
                            </div>
                        </div>
                        <span class="text-indigo-600 font-extrabold text-xs">${activeProfileMode === 'SALARIED' ? '✓ Active' : 'Switch →'}</span>
                    </button>
                </form>
            </div>
        </div>
    </div>

    <!-- 4-Digit Quick PIN (App-Wide Unlock & Screen Lock) Modal -->
    <div id="app-pin-modal" class="hidden fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <div class="w-full max-w-sm rounded-3xl bg-slate-900 border border-indigo-500/30 p-6 shadow-2xl relative text-slate-100">
            <button type="button" onclick="closeAppPinModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
                ✕ Close
            </button>
            <div class="text-center mb-4">
                <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-2xl mb-2">
                    🔢
                </div>
                <h3 id="app-pin-title" class="text-lg font-extrabold text-white">4-Digit Quick PIN</h3>
                <p id="app-pin-subtitle" class="text-xs text-slate-400">Fast 2-second unlock for all of Finatrack without typing long passwords.</p>
            </div>

            <!-- Mode Switcher: Lock Keypad vs Set/Change PIN -->
            <div class="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold mb-4">
                <button type="button" id="tab-app-pin-keypad" onclick="switchAppPinTab('keypad')" class="py-1.5 rounded-lg bg-indigo-600 text-white transition">🔒 Quick Screen Lock</button>
                <button type="button" id="tab-app-pin-setup" onclick="switchAppPinTab('setup')" class="py-1.5 rounded-lg text-slate-400 hover:text-white transition">⚙️ Set / Confirm PIN</button>
            </div>

            <!-- Panel A: Big Numeric Keypad Screen Lock -->
            <div id="app-pin-keypad-panel" class="space-y-4 text-center">
                <div class="flex items-center justify-center gap-4 my-3" id="app-pin-dots">
                    <div class="a-pin-dot w-4 h-4 rounded-full border-2 border-indigo-400/60 bg-slate-950 transition-all"></div>
                    <div class="a-pin-dot w-4 h-4 rounded-full border-2 border-indigo-400/60 bg-slate-950 transition-all"></div>
                    <div class="a-pin-dot w-4 h-4 rounded-full border-2 border-indigo-400/60 bg-slate-950 transition-all"></div>
                    <div class="a-pin-dot w-4 h-4 rounded-full border-2 border-indigo-400/60 bg-slate-950 transition-all"></div>
                </div>

                <div id="app-pin-error" class="hidden px-3 py-1.5 rounded-lg bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-bold"></div>

                <div class="grid grid-cols-3 gap-2.5 select-none">
                    <button type="button" onclick="pressAppPin('1')" class="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white text-xl font-black border border-slate-700 shadow">1</button>
                    <button type="button" onclick="pressAppPin('2')" class="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white text-xl font-black border border-slate-700 shadow">2</button>
                    <button type="button" onclick="pressAppPin('3')" class="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white text-xl font-black border border-slate-700 shadow">3</button>
                    <button type="button" onclick="pressAppPin('4')" class="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white text-xl font-black border border-slate-700 shadow">4</button>
                    <button type="button" onclick="pressAppPin('5')" class="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white text-xl font-black border border-slate-700 shadow">5</button>
                    <button type="button" onclick="pressAppPin('6')" class="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white text-xl font-black border border-slate-700 shadow">6</button>
                    <button type="button" onclick="pressAppPin('7')" class="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white text-xl font-black border border-slate-700 shadow">7</button>
                    <button type="button" onclick="pressAppPin('8')" class="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white text-xl font-black border border-slate-700 shadow">8</button>
                    <button type="button" onclick="pressAppPin('9')" class="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white text-xl font-black border border-slate-700 shadow">9</button>
                    <button type="button" onclick="clearAppPin()" class="py-3.5 rounded-2xl bg-slate-950 hover:bg-slate-800 text-slate-400 text-xs font-extrabold border border-slate-800">CLR</button>
                    <button type="button" onclick="pressAppPin('0')" class="py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white text-xl font-black border border-slate-700 shadow">0</button>
                    <button type="button" onclick="backspaceAppPin()" class="py-3.5 rounded-2xl bg-slate-950 hover:bg-slate-800 text-amber-400 text-base font-extrabold border border-slate-800">⌫</button>
                </div>

                <div class="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span id="app-pin-strikes-info">3 wrong tries → Master login</span>
                    <a href="/login?pin_fallback=1&redirect_to=/" class="text-indigo-400 hover:underline font-bold">Use Master Password</a>
                </div>
            </div>

            <!-- Panel B: Set, Confirm, & Save 4-Digit PIN -->
            <div id="app-pin-setup-panel" class="hidden space-y-3">
                <form action="/auth/pin/set" method="POST" onsubmit="return saveAppPinLocal(event)" class="space-y-3.5">
                    <input type="hidden" name="redirect_to" value="/">
                    <div>
                        <label class="block text-xs font-bold text-indigo-300 mb-1">1. Choose 4-Digit PIN</label>
                        <input type="password" inputmode="numeric" pattern="\\d{4}" maxlength="4" name="pin" id="new-app-pin-input" placeholder="••••" required oninput="validateAppPinSetupMatch()" class="w-full p-2.5 bg-slate-950 border border-indigo-500/50 rounded-xl text-center text-xl font-black tracking-[0.4em] text-white focus:outline-none focus:border-indigo-400">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-indigo-300 mb-1">2. Confirm 4-Digit PIN</label>
                        <input type="password" inputmode="numeric" pattern="\\d{4}" maxlength="4" name="confirm_pin" id="confirm-app-pin-input" placeholder="••••" required oninput="validateAppPinSetupMatch()" class="w-full p-2.5 bg-slate-950 border border-indigo-500/50 rounded-xl text-center text-xl font-black tracking-[0.4em] text-emerald-400 focus:outline-none focus:border-emerald-400">
                    </div>
                    
                    <div id="app-pin-setup-match-msg" class="text-[11px] font-bold text-center py-1 text-slate-400">
                        Enter matching 4 digits in both fields
                    </div>

                    <button type="submit" id="save-app-pin-btn" disabled class="w-full py-3 bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-500 text-white font-black rounded-xl text-xs shadow-lg transition active:scale-95">
                        💾 Confirm &amp; Save 4-Digit PIN
                    </button>
                </form>
                <form action="/auth/pin/clear" method="POST" onsubmit="try{localStorage.removeItem('finatrack_quick_pin');}catch(e){}">
                    <input type="hidden" name="redirect_to" value="/">
                    <button type="submit" class="w-full py-2 bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 rounded-xl text-xs font-bold transition">
                        🗑️ Remove Quick PIN
                    </button>
                </form>
            </div>
        </div>
    </div>

    <!-- 📱 Native Mobile Bottom App Dock -->
    <nav class="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800/80 px-4 py-2 flex justify-around items-center sm:hidden shadow-lg safe-area-bottom">
        <a href="/" class="flex flex-col items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold active:scale-90 transition-transform">
            <span class="text-xl">⚡</span>
            <span class="text-[10px] tracking-tight">Finance</span>
        </a>
        <a href="${activeProfileMode === 'TRADER' ? '/trader' : activeProfileMode === 'SALARIED' ? '/salaried' : '/rider'}" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-emerald-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">${activeProfileIcon}</span>
            <span class="text-[10px] tracking-tight">${activeProfileMode === 'TRADER' ? 'Soko' : activeProfileMode === 'SALARIED' ? 'Payday' : 'Rider'}</span>
        </a>
        <a href="#mpesa-card" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-emerald-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">📲</span>
            <span class="text-[10px] tracking-tight">M-Pesa</span>
        </a>
        <a href="#waterfall-card" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-indigo-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">🌊</span>
            <span class="text-[10px] tracking-tight">Split</span>
        </a>
        <button type="button" onclick="openProfileModal()" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-purple-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">🔄</span>
            <span class="text-[10px] tracking-tight">Profile</span>
        </button>
    </nav>

    <script>
        function toggleSmartNotifDropdown() {
            const el = document.getElementById('smart-notif-dropdown');
            if (el) el.classList.toggle('hidden');
        }

        function handleNotifActionClick(href) {
            const el = document.getElementById('smart-notif-dropdown');
            if (el) el.classList.add('hidden');
            if (href === '#daily-logger-card') {
                const form = document.getElementById('quick-daily-logger-form');
                if (form) form.classList.remove('hidden');
            }
        }

        function filterTimelineItems(filterType) {
            const rows = document.querySelectorAll('.timeline-item-row');
            rows.forEach((row) => {
                const rowType = row.getAttribute('data-tl-type') || '';
                if (filterType === 'ALL' || rowType === filterType) {
                    row.classList.remove('hidden');
                } else {
                    row.classList.add('hidden');
                }
            });
            document.querySelectorAll('.tl-filter-btn').forEach((btn) => {
                btn.className = 'tl-filter-btn px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition';
            });
            const activeBtn = document.getElementById('tl-tab-' + filterType);
            if (activeBtn) {
                activeBtn.className = 'tl-filter-btn px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-indigo-600 text-white shadow-2xs transition';
            }
        }

        function enableBrowserPushAlerts() {
            const btn = document.getElementById('browser-push-btn');
            if (!('Notification' in window)) {
                alert('Browser push notifications are not supported on this browser, but in-app Smart Notifications are active.');
                return;
            }
            Notification.requestPermission().then((perm) => {
                if (perm === 'granted') {
                    try {
                        localStorage.setItem('finatrack_push_enabled', '1');
                        new Notification('🔔 Finatrack Smart Alerts Active', {
                            body: 'We will remind you about your Daily Logger closeout, Upcoming Loans & Recurring Bills!',
                            icon: '/icon-192.png'
                        });
                    } catch (e) {}
                    if (btn) {
                        btn.textContent = '✅ Push Active';
                        btn.className = 'px-2 py-1 bg-emerald-700 text-emerald-100 font-bold rounded-lg text-[10px]';
                    }
                }
            });
        }

        function fillMmfQuickPreset(name, type, rate, bal) {
            const nameEl = document.getElementById('mmf-quick-name');
            const typeEl = document.getElementById('mmf-quick-type');
            const rateEl = document.getElementById('mmf-quick-rate');
            const balEl = document.getElementById('mmf-quick-bal');
            if (nameEl) nameEl.value = name;
            if (typeEl) typeEl.value = type;
            if (rateEl) rateEl.value = String(rate);
            if (balEl && (!balEl.value || Number(balEl.value) === 0)) balEl.value = String(bal);
        }

        function setMmfSimPreset(bal, rate, applyWht) {
            const balEl = document.getElementById('mmf-sim-balance');
            const rateEl = document.getElementById('mmf-sim-rate');
            const whtEl = document.getElementById('mmf-sim-wht');
            if (balEl) balEl.value = String(bal);
            if (rateEl) rateEl.value = String(rate);
            if (whtEl) whtEl.value = applyWht ? '1' : '0';
            recalcMmfBankSimulator();
        }

        function recalcMmfBankSimulator() {
            const bal = Math.max(0, parseFloat(document.getElementById('mmf-sim-balance')?.value || '0') || 0);
            const grossRate = Math.max(0, parseFloat(document.getElementById('mmf-sim-rate')?.value || '0') || 0);
            const applyWht = (document.getElementById('mmf-sim-wht')?.value || '1') === '1';
            const netRate = applyWht ? grossRate * 0.85 : grossRate;

            const dailyGross = (bal * (grossRate / 100)) / 365;
            const dailyNet = (bal * (netRate / 100)) / 365;
            const dailyTax = Math.max(0, dailyGross - dailyNet);

            const dailyNetFactor = netRate / 100 / 365;
            const weeklyNet = bal * (Math.pow(1 + dailyNetFactor, 7) - 1);
            const monthlyNet = bal * (Math.pow(1 + dailyNetFactor, 30) - 1);
            const annualNet = bal * (Math.pow(1 + dailyNetFactor, 365) - 1);

            const fmt = (n) => 'Ksh ' + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const dNetEl = document.getElementById('mmf-sim-daily-net');
            const dGrossEl = document.getElementById('mmf-sim-daily-gross');
            const mNetEl = document.getElementById('mmf-sim-monthly-net');
            const wNetEl = document.getElementById('mmf-sim-weekly-net');
            const aNetEl = document.getElementById('mmf-sim-annual-net');
            const rLblEl = document.getElementById('mmf-sim-net-rate-lbl');

            if (dNetEl) dNetEl.textContent = '+' + fmt(dailyNet) + ' / day';
            if (dGrossEl) {
                dGrossEl.textContent = applyWht
                    ? ('Gross: ' + fmt(dailyGross) + ' − WHT: ' + fmt(dailyTax))
                    : ('Exact Net Rate (0% WHT deducted)');
            }
            if (mNetEl) mNetEl.textContent = '+' + fmt(monthlyNet) + ' / mo';
            if (wNetEl) wNetEl.textContent = '7-Day: +' + fmt(weeklyNet);
            if (aNetEl) aNetEl.textContent = '+' + fmt(annualNet) + ' / yr';
            if (rLblEl) rLblEl.textContent = 'Net Rate: ' + netRate.toFixed(2) + '% p.a.';
        }

        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('smart-notif-wrapper');
            const dropdown = document.getElementById('smart-notif-dropdown');
            if (wrapper && dropdown && !dropdown.classList.contains('hidden') && !wrapper.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    </script>
</body>
</html>`;
}
