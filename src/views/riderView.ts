export function renderRiderDashboard(data: any): string {
  const {
    active_bike = null,
    bikes = [],
    rider_logs = [],
    odometer_config = null,
    strict_saver_config = null,
    time_intelligence = {},
    maintenance_schedules = [],
    compliance_deadlines = [],
    bike_financings = [],
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
    allocation_rules = [],
    accounts = [],
    toast = '',
    usd_to_kes = 129.0,
    current_currency = 'Ksh',
    today = new Date().toISOString().slice(0, 10),
    username = 'Dennis',
    is_logged_in = false,
  } = data;

  const ti = time_intelligence;
  const activePowerType = (active_bike && active_bike.power_type) || 'PETROL';

  const lastShift = rider_logs && rider_logs.length > 0 ? rider_logs[0] : null;
  const lastShiftTotalExp = lastShift ? (Number(lastShift.fuel_cost || 0) + Number(lastShift.food_spent || 0) + Number(lastShift.airtime_spent || 0) + Number(lastShift.misc_expenses || 0) + Number(lastShift.maintenance_cost || 0)) : 0;
  const lastShiftPersonalSpend = lastShift ? (Number(lastShift.food_spent || 0) + Number(lastShift.airtime_spent || 0) + Number(lastShift.misc_expenses || 0)) : 0;
  const lastShiftNet = lastShift ? (Number(lastShift.total_earned || 0) - lastShiftTotalExp) : 0;

  // CPK (Cost Per Kilometer) & Odometer synchronization across all shifts
  const totalKmCovered = Number(((rider_logs || []).reduce((acc: number, l: any) => acc + Number(l.kilometers || 0), 0)).toFixed(1));
  const totalFuelExp = (rider_logs || []).reduce((acc: number, l: any) => acc + Number(l.fuel_cost || 0), 0);
  const totalShiftMaintExp = (rider_logs || []).reduce((acc: number, l: any) => acc + Number(l.maintenance_cost || 0), 0);
  const totalScheduleMaintExp = (maintenance_schedules || []).reduce((acc: number, m: any) => acc + Number(m.cost_kes || 0), 0);
  const totalMaintExp = totalShiftMaintExp + totalScheduleMaintExp;
  const shiftsWithKmCount = (rider_logs || []).filter((l: any) => Number(l.kilometers || 0) > 0).length;

  const lastServiceOdo = Number(odometer_config?.last_service_odo ?? 10000);
  const baseOdometer = Number(odometer_config?.base_odometer ?? (totalKmCovered > 0 ? lastServiceOdo : 12450));
  const currentOdometer = Number(odometer_config?.current_odometer ?? Number((baseOdometer + totalKmCovered).toFixed(1)));
  const serviceIntervalKm = Number(odometer_config?.service_interval_km ?? 3000);
  const nextServiceOdo = Number((lastServiceOdo + serviceIntervalKm).toFixed(1));
  const remainingServiceKm = Number((nextServiceOdo - currentOdometer).toFixed(1));
  const kmSinceLastService = Math.max(0, Number((currentOdometer - lastServiceOdo).toFixed(1)));

  const effectiveCpkDistance = totalKmCovered > 0 ? totalKmCovered : kmSinceLastService;
  const defaultCpkFallback = activePowerType === 'ELECTRIC' ? '1.80' : '4.50';
  const overallCpk = effectiveCpkDistance > 0 && totalFuelExp > 0
    ? (totalFuelExp / effectiveCpkDistance).toFixed(2)
    : (totalKmCovered > 0 ? (totalFuelExp / totalKmCovered).toFixed(2) : defaultCpkFallback);
  const allInCpk = effectiveCpkDistance > 0 && (totalFuelExp + totalMaintExp) > 0
    ? ((totalFuelExp + totalMaintExp) / effectiveCpkDistance).toFixed(2)
    : overallCpk;

  // Remittance, Strict Saver Floor, Home-Lunch Bonus & Savings Account Tracker
  const todayShifts = (rider_logs || []).filter((l: any) => l.date === today);
  const todayNetEarned = todayShifts.reduce((acc: number, l: any) => {
    const exp = Number(l.fuel_cost || 0) + Number(l.food_spent || 0) + Number(l.airtime_spent || 0) + Number(l.misc_expenses || 0) + Number(l.maintenance_cost || 0);
    return acc + (Number(l.total_earned || 0) - exp);
  }, 0);
  const latestShiftLog = (rider_logs || [])[0];
  const latestShiftNet = latestShiftLog
    ? Math.max(0, Number(latestShiftLog.total_earned || 0) - (Number(latestShiftLog.fuel_cost || 0) + Number(latestShiftLog.food_spent || 0) + Number(latestShiftLog.airtime_spent || 0) + Number(latestShiftLog.misc_expenses || 0) + Number(latestShiftLog.maintenance_cost || 0)))
    : 0;
  const strictNetFloor = Number(strict_saver_config?.net_floor_kes || active_bike?.daily_target || 1000);
  const strictFuelAllowance = Number(strict_saver_config?.fuel_allowance_kes ?? (activePowerType === 'ELECTRIC' ? 300 : 500));
  const strictLunchAllowance = Number(strict_saver_config?.lunch_allowance_kes ?? 150);
  const strictAirtimeAllowance = Number(strict_saver_config?.airtime_allowance_kes ?? 50);
  const strictPersonalCap = strictLunchAllowance + strictAirtimeAllowance;
  const strictDailyKodi = Number(strict_saver_config?.daily_kodi_kes ?? 0);
  const saveUnspentLunch = strict_saver_config?.save_unspent_lunch !== false;

  const linkedSavingsAcc = (accounts || []).find((a: any) => String(a.id) === String(strict_saver_config?.savings_account_id || ''))
    || (accounts || []).find((a: any) => ['SAVINGS', 'INVESTMENT', 'MMF'].includes(String(a.account_type || '').toUpperCase()) || /mmf|sacco|lock|save|ziidi/i.test(String(a.name || '')));
  const savingsAccountId = strict_saver_config?.savings_account_id || (linkedSavingsAcc ? String(linkedSavingsAcc.id) : '');
  const savingsAccountName = (strict_saver_config?.savings_account_name && strict_saver_config.savings_account_name !== 'Strict Savings Account')
    ? strict_saver_config.savings_account_name
    : (linkedSavingsAcc?.name || 'Strict Savings Account');
  const startingSavingsBalance = Number(strict_saver_config?.starting_savings_balance || 0);

  // Chronological ledger across all shifts to compute cumulative savings & overdue
  let cumulativeSavedFromShifts = 0;
  let cumulativeOverdueKes = 0;
  const chronologicalShifts = [...(rider_logs || [])].reverse();
  for (const s of chronologicalShifts) {
    const sGross = Number(s.total_earned || 0);
    const sFuel = Number(s.fuel_cost || 0);
    const sFood = Number(s.food_spent || 0);
    const sAirtime = Number(s.airtime_spent || 0);
    const sMisc = Number(s.misc_expenses || 0) + Number(s.maintenance_cost || 0);
    const sNet = sGross - (sFuel + sFood + sAirtime + sMisc);
    const sLunchBonus = saveUnspentLunch ? Math.max(0, strictLunchAllowance - sFood) : 0;
    const sStrictTarget = strictNetFloor + sLunchBonus;

    cumulativeSavedFromShifts += Math.max(0, sNet);
    if (sNet >= sStrictTarget) {
      const sExtra = sNet - sStrictTarget;
      cumulativeOverdueKes = Math.max(0, cumulativeOverdueKes - sExtra);
    } else {
      const sDeficit = sStrictTarget - Math.max(0, sNet);
      cumulativeOverdueKes += sDeficit;
    }
  }

  const expectedSavingsAccountBalance = startingSavingsBalance + cumulativeSavedFromShifts;
  const lastShiftFood = lastShift ? Number(lastShift.food_spent || 0) : 0;
  const lastShiftLunchSaved = (lastShift && saveUnspentLunch) ? Math.max(0, strictLunchAllowance - lastShiftFood) : 0;
  const lastShiftStrictTarget = strictNetFloor + lastShiftLunchSaved;
  const lastShiftMetStrict = lastShift ? (lastShiftNet >= lastShiftStrictTarget) : false;
  const lastShiftShortfall = lastShift ? Math.max(0, lastShiftStrictTarget - Math.max(0, lastShiftNet)) : 0;
  const lastShiftOverflow = lastShift ? Math.max(0, lastShiftNet - lastShiftStrictTarget) : 0;
  const requiredGrossBeforeHome = strictNetFloor + strictFuelAllowance + strictPersonalCap + strictDailyKodi + cumulativeOverdueKes;
  const closeoutSplitAmount = todayNetEarned > 0 ? todayNetEarned : (latestShiftNet > 0 ? latestShiftNet : strictNetFloor);
  const dailyTarget = Number(active_bike?.daily_target || strictNetFloor);
  const dailyTargetMetPct = Math.min(100, Math.round((todayNetEarned / (dailyTarget || 1)) * 100));

  const formatKes = (val: number | string) => 'Ksh ' + (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatNum = (val: number | string) => (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getDaysDiff = (targetDateStr?: string | null): { days: number; label: string; status: 'EXPIRED' | 'URGENT' | 'SOON' | 'GOOD' } => {
    if (!targetDateStr) return { days: 999, label: 'No date set', status: 'GOOD' };
    const target = new Date(targetDateStr).getTime();
    const now = new Date().setHours(0,0,0,0);
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { days: diff, label: `EXPIRED (${Math.abs(diff)} days ago)`, status: 'EXPIRED' };
    if (diff === 0) return { days: 0, label: 'Expires TODAY!', status: 'EXPIRED' };
    if (diff <= 30) return { days: diff, label: `⏳ Expiring in ${diff} days! (Renew soon)`, status: 'URGENT' };
    if (diff <= 95) return { days: diff, label: `⏳ Expiring in ~${Math.round(diff/30)} months (${diff} days)`, status: 'SOON' };
    return { days: diff, label: `✅ Valid (${diff} days remaining)`, status: 'GOOD' };
  };

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
                        primary: '#3B82F6',
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
        const bikesData = ${JSON.stringify(bikes)};
        let currentPowerType = '${activePowerType}';
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

        function recalcStintsSummary() {
            var rows = document.querySelectorAll('.stint-row');
            var items = [];
            var totalEarned = 0;
            var totalMins = 0;

            rows.forEach(function(row, idx) {
                var numEl = row.querySelector('.row-num');
                if (numEl) numEl.textContent = '#' + (idx + 1);

                var sIn = row.querySelector('.stint-start');
                var eIn = row.querySelector('.stint-end');
                var pIn = row.querySelector('.stint-platform');
                var earnIn = row.querySelector('.stint-earned');

                var sVal = (sIn && sIn.value) ? sIn.value : '11:00';
                var eVal = (eIn && eIn.value) ? eIn.value : '14:00';
                var pVal = (pIn && pIn.value) ? pIn.value : 'Uber Eats';
                var earnVal = parseFloat((earnIn && earnIn.value) ? earnIn.value : '0') || 0;

                var sM = parseInt(sVal.split(':')[0], 10) * 60 + parseInt(sVal.split(':')[1], 10);
                var eM = parseInt(eVal.split(':')[0], 10) * 60 + parseInt(eVal.split(':')[1], 10);
                var diff = eM - sM;
                if (diff <= 0) diff += 24 * 60;
                var hrs = diff / 60;
                totalMins += diff;
                totalEarned += earnVal;

                var hrYield = hrs > 0 ? (earnVal / hrs).toFixed(0) : '0';
                var badge = row.querySelector('.stint-badge');
                if (badge) {
                    badge.innerText = '⚡ Ksh ' + hrYield + '/hr (' + hrs.toFixed(1) + 'h)';
                }

                items.push({
                    id: 'stint_' + (idx + 1),
                    start_time: sVal,
                    end_time: eVal,
                    platform: pVal,
                    earned: earnVal.toString()
                });
            });

            var totalHrs = (totalMins / 60).toFixed(1);
            var hrsEl = document.getElementById('stints-summary-hours');
            if (hrsEl) hrsEl.textContent = totalHrs + ' hrs';
            var earnEl = document.getElementById('stints-summary-earned');
            if (earnEl) earnEl.textContent = 'Ksh ' + totalEarned.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

            if (items.length > 0 && totalEarned > 0) {
                var pEarn = document.querySelector('input[name="total_earned"]');
                if (pEarn) pEarn.value = totalEarned.toFixed(2);
                var pHours = document.getElementById('input_shift_hours');
                if (pHours) pHours.value = totalHrs;
                var pBadge = document.getElementById('shift-duration-badge');
                if (pBadge) pBadge.innerText = '⏱️ ' + totalHrs + ' hrs (Multi-Stint)';
                if (items[0].start_time) {
                    var sStart = document.getElementById('input_start_time');
                    if (sStart) sStart.value = items[0].start_time;
                }
                if (items[items.length - 1].end_time) {
                    var sEnd = document.getElementById('input_end_time');
                    if (sEnd) sEnd.value = items[items.length - 1].end_time;
                }
            }

            var jsonInput = document.getElementById('stints_json_input');
            if (jsonInput) {
                jsonInput.value = items.length > 0 ? JSON.stringify(items) : '';
            }
            if (typeof updateStrictSaverAudit === 'function') {
                updateStrictSaverAudit();
            }
        }

        function addStintRow(start, end, earned, platform) {
            var list = document.getElementById('stints-list');
            if (!list) return;
            var rows = list.querySelectorAll('.stint-row');
            if (!start || typeof start !== 'string') {
                if (rows.length > 0) {
                    var lastEndInput = rows[rows.length - 1].querySelector('.stint-end');
                    var lastEnd = (lastEndInput && lastEndInput.value) ? lastEndInput.value : '17:00';
                    var parts = lastEnd.split(':');
                    var startH = parseInt(parts[0], 10) || 17;
                    var startM = parseInt(parts[1], 10) || 0;
                    var endH = (startH + 3) % 24;
                    start = String(startH).padStart(2, '0') + ':' + String(startM).padStart(2, '0');
                    end = String(endH).padStart(2, '0') + ':' + String(startM).padStart(2, '0');
                } else {
                    start = '11:00';
                    end = '14:00';
                }
            }
            if (!end || typeof end !== 'string') end = '20:00';
            if (!platform) platform = 'Uber Eats';
            if (earned === undefined || typeof earned !== 'string' && typeof earned !== 'number') earned = '';

            var newIdx = rows.length + 1;
            var rowDiv = document.createElement('div');
            rowDiv.className = 'stint-row p-2.5 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/60 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs shadow-xs';
            rowDiv.innerHTML = '<div class="sm:col-span-1 font-extrabold text-blue-600 dark:text-blue-400 row-num">#' + newIdx + '</div>' +
                '<div class="sm:col-span-4 flex items-center gap-1.5">' +
                    '<input type="time" value="' + start + '" class="stint-start w-full p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-lg text-xs font-bold">' +
                    '<span class="text-gray-400 text-xs font-semibold">to</span>' +
                    '<input type="time" value="' + end + '" class="stint-end w-full p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-lg text-xs font-bold">' +
                '</div>' +
                '<div class="sm:col-span-2">' +
                    '<select class="stint-platform w-full p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-lg text-xs font-medium">' +
                        '<option value="Uber Car / Ride"' + (platform === 'Uber Car / Ride' ? ' selected' : '') + '>Uber Car / Ride</option>' +
                        '<option value="Bolt Car / Ride"' + (platform === 'Bolt Car / Ride' ? ' selected' : '') + '>Bolt Car / Ride</option>' +
                        '<option value="Little Cab"' + (platform === 'Little Cab' ? ' selected' : '') + '>Little Cab</option>' +
                        '<option value="Faras"' + (platform === 'Faras' ? ' selected' : '') + '>Faras</option>' +
                        '<option value="inDrive"' + (platform === 'inDrive' ? ' selected' : '') + '>inDrive</option>' +
                        '<option value="Uber Eats"' + (platform === 'Uber Eats' ? ' selected' : '') + '>Uber Eats</option>' +
                        '<option value="Bolt Deliveries"' + (platform === 'Bolt Deliveries' ? ' selected' : '') + '>Bolt</option>' +
                        '<option value="Glovo / Jumia"' + (platform === 'Glovo / Jumia' ? ' selected' : '') + '>Glovo/Jumia</option>' +
                        '<option value="Boda Passenger"' + (platform === 'Boda Passenger' ? ' selected' : '') + '>Boda Passenger</option>' +
                        '<option value="Direct Client"' + (platform === 'Direct Client' ? ' selected' : '') + '>Direct Client</option>' +
                    '</select>' +
                '</div>' +
                '<div class="sm:col-span-2">' +
                    '<input type="number" step="any" inputmode="decimal" value="' + earned + '" placeholder="Earned Ksh" class="stint-earned w-full p-2 border border-emerald-300 dark:border-emerald-700 dark:bg-gray-800 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400">' +
                '</div>' +
                '<div class="sm:col-span-3 flex items-center justify-between gap-1.5">' +
                    '<span class="stint-badge px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-bold text-[11px] whitespace-nowrap border border-blue-200 dark:border-blue-900">' +
                        '⚡ Ksh 0/hr (0.0h)' +
                    '</span>' +
                    '<button type="button" class="btn-del-stint text-rose-500 hover:text-rose-700 font-bold p-1 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md transition" title="Delete stint">✕</button>' +
                '</div>';

            var delBtn = rowDiv.querySelector('.btn-del-stint');
            if (delBtn) {
                delBtn.onclick = function() {
                    rowDiv.remove();
                    recalcStintsSummary();
                };
            }

            var inputs = rowDiv.querySelectorAll('input, select');
            inputs.forEach(function(inp) {
                inp.oninput = recalcStintsSummary;
                inp.onchange = recalcStintsSummary;
            });

            list.appendChild(rowDiv);
            recalcStintsSummary();
        }

        function clearAllStints() {
            var list = document.getElementById('stints-list');
            if (list) list.innerHTML = '';
            recalcStintsSummary();
            var pEarn = document.querySelector('input[name="total_earned"]');
            if (pEarn) pEarn.value = '';
            calcDuration();
        }

        var shiftCurrentPage = 1;
        var shiftPageSize = 5;
        var shiftCurrentFilter = 'ALL';

        function setShiftFilter(type) {
            shiftCurrentFilter = type;
            shiftCurrentPage = 1;
            document.querySelectorAll('.shift-filter-btn').forEach(function(b) {
                b.className = 'shift-filter-btn px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer';
            });
            var activeBtn = document.getElementById('shift-filter-btn-' + type);
            if (activeBtn) {
                activeBtn.className = 'shift-filter-btn px-2.5 py-1 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs font-bold transition cursor-pointer';
            }
            applyShiftDisplay();
        }

        function shiftGoToPage(p) {
            shiftCurrentPage = p;
            applyShiftDisplay();
            var card = document.getElementById('shift-history-card');
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function shiftPrevPage() {
            if (shiftCurrentPage > 1) {
                shiftGoToPage(shiftCurrentPage - 1);
            }
        }

        function shiftNextPage() {
            var mobileItems = document.querySelectorAll('.shift-mobile-item');
            var matchingTotal = 0;
            mobileItems.forEach(function(el) {
                var itemType = el.getAttribute('data-power-type') || 'PETROL';
                if (shiftCurrentFilter === 'ALL' || itemType === shiftCurrentFilter) {
                    matchingTotal++;
                }
            });
            var totalPages = Math.max(1, Math.ceil(matchingTotal / shiftPageSize));
            if (shiftCurrentPage < totalPages) {
                shiftGoToPage(shiftCurrentPage + 1);
            }
        }

        function applyShiftDisplay() {
            var mobileItems = document.querySelectorAll('.shift-mobile-item');
            var desktopItems = document.querySelectorAll('.shift-desktop-item');
            var matchingTotal = 0;

            mobileItems.forEach(function(el) {
                var itemType = el.getAttribute('data-power-type') || 'PETROL';
                if (shiftCurrentFilter === 'ALL' || itemType === shiftCurrentFilter) {
                    matchingTotal++;
                }
            });

            var totalPages = Math.max(1, Math.ceil(matchingTotal / shiftPageSize));
            if (shiftCurrentPage > totalPages) {
                shiftCurrentPage = totalPages;
            }
            if (shiftCurrentPage < 1) {
                shiftCurrentPage = 1;
            }

            var startIdx = (shiftCurrentPage - 1) * shiftPageSize;
            var endIdx = startIdx + shiftPageSize;

            var mIdx = 0;
            mobileItems.forEach(function(el) {
                var itemType = el.getAttribute('data-power-type') || 'PETROL';
                if (shiftCurrentFilter === 'ALL' || itemType === shiftCurrentFilter) {
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
                var itemType = el.getAttribute('data-power-type') || 'PETROL';
                if (shiftCurrentFilter === 'ALL' || itemType === shiftCurrentFilter) {
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

            var rangeEl = document.getElementById('shift-visible-range');
            if (rangeEl) rangeEl.innerText = startDisplay + '–' + endDisplay;

            var totalEl = document.getElementById('shift-total-filtered-count');
            if (totalEl) totalEl.innerText = String(matchingTotal);

            var pageInfoEl = document.getElementById('shift-page-info');
            if (pageInfoEl) pageInfoEl.innerText = 'Page ' + shiftCurrentPage + ' of ' + totalPages;

            var prevBtn = document.getElementById('shift-prev-btn');
            if (prevBtn) {
                if (shiftCurrentPage <= 1) {
                    prevBtn.disabled = true;
                    prevBtn.classList.add('opacity-40', 'cursor-not-allowed');
                } else {
                    prevBtn.disabled = false;
                    prevBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                }
            }

            var nextBtn = document.getElementById('shift-next-btn');
            if (nextBtn) {
                if (shiftCurrentPage >= totalPages) {
                    nextBtn.disabled = true;
                    nextBtn.classList.add('opacity-40', 'cursor-not-allowed');
                } else {
                    nextBtn.disabled = false;
                    nextBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                }
            }

            var paginationContainer = document.getElementById('shift-pagination-controls');
            if (paginationContainer) {
                if (matchingTotal <= shiftPageSize) {
                    paginationContainer.classList.add('hidden');
                } else {
                    paginationContainer.classList.remove('hidden');
                }
            }

            var pagesContainer = document.getElementById('shift-pagination-pages');
            if (pagesContainer) {
                var html = '';
                for (var p = 1; p <= totalPages; p++) {
                    var isActive = p === shiftCurrentPage;
                    html += '<button type="button" onclick="shiftGoToPage(' + p + ')" class="w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ' +
                        (isActive ? 'bg-blue-600 text-white shadow-xs' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700') + '">' + p + '</button>';
                }
                pagesContainer.innerHTML = html;
            }
        }

        const SHIFT_TOTAL_KM = ${totalKmCovered};
        const SHIFT_TOTAL_FUEL = ${totalFuelExp};
        const SHIFT_TOTAL_MAINT = ${totalMaintExp};
        let BASE_ODOMETER = ${baseOdometer};

        window.addEventListener('DOMContentLoaded', () => {
            recalcStintsSummary();
            applyShiftDisplay();
            calcOdometerServiceStatus(false);
        });

        function calcSimStintYield() {
            const s = document.getElementById('sim_stint_start')?.value;
            const e = document.getElementById('sim_stint_end')?.value;
            const earn = parseFloat(document.getElementById('sim_stint_earned')?.value || '0') || 0;
            if (!s || !e) return;
            const sM = parseInt(s.split(':')[0]) * 60 + parseInt(s.split(':')[1]);
            const eM = parseInt(e.split(':')[0]) * 60 + parseInt(e.split(':')[1]);
            let diff = eM - sM;
            if (diff <= 0) diff += 24 * 60;
            const hrs = diff / 60;
            const yieldVal = hrs > 0 ? (earn / hrs).toFixed(2) : '0.00';
            const resEl = document.getElementById('sim_stint_result');
            if (resEl) {
                const curr = getCurrency();
                if (curr === 'USD') {
                    resEl.innerText = '$' + (parseFloat(yieldVal) / USD_TO_KES).toFixed(2) + ' / hr (' + hrs.toFixed(1) + 'h)';
                } else {
                    resEl.innerText = 'Ksh ' + parseFloat(yieldVal).toLocaleString(undefined, {minimumFractionDigits: 2}) + ' / hr (' + hrs.toFixed(1) + 'h)';
                }
            }
        }

        function shareStintWhatsApp(date, startTime, endTime, hours, trips, gross, fuel, food, airtime, misc, net, powerType, plate) {
            const hrs = parseFloat(hours) || 8;
            const g = parseFloat(gross) || 0;
            const f = parseFloat(fuel) || 0;
            const fd = parseFloat(food) || 0;
            const air = parseFloat(airtime) || 0;
            const m = parseFloat(misc) || 0;
            const n = parseFloat(net) || 0;
            const yieldVal = hrs > 0 ? (g / hrs).toFixed(2) : '0.00';
            const upkeep = fd + air + m;
            const savedMmf = (n * 0.20).toFixed(2);
            
            const text = "🏁 *Finatrack Daily Shift Performance*\\n" +
                         "📅 *Date:* " + date + "\\n" +
                         "🚗 *Vehicle:* " + (plate || 'Fleet Vehicle') + " (" + (powerType || 'PETROL') + ")\\n" +
                         "⏱️ *Working Hours:* " + (startTime || '11:00') + " - " + (endTime || '22:00') + " (" + hrs + "h) | *Trips:* " + (trips || 0) + "\\n" +
                         "💰 *Gross Inflow:* Ksh " + g.toLocaleString() + "\\n" +
                         "⛽ *Fuel / Energy:* Ksh " + f.toLocaleString() + "\\n" +
                         "🍲 *Upkeep & Lunch:* Ksh " + upkeep.toLocaleString() + "\\n" +
                         "🛡️ *Net Profit:* Ksh " + n.toLocaleString() + " (*Yield:* Ksh " + yieldVal + "/hr)\\n" +
                         "💧 *Waterfall Saved:* Ksh " + savedMmf + " to Ziidi MMF\\n" +
                         "----------------------------\\n" +
                         "_Logged via Finatrack Fleet_ 🇰🇪";

            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).catch(() => {});
                }
            } catch(e) {}
            
            const waUrl = "https://api.whatsapp.com/send?text=" + encodeURIComponent(text);
            window.open(waUrl, '_blank');
        }

        function syncOdoFromLastService() {
            const lastEl = document.getElementById('last_service_odo_input');
            const curEl = document.getElementById('current_odometer_input');
            const liveKm = parseFloat(document.getElementById('shift_km_input')?.value) || 0;
            const last = parseFloat(lastEl?.value) || 0;
            const syncedCur = Number((last + SHIFT_TOTAL_KM + liveKm).toFixed(1));
            BASE_ODOMETER = last;
            if (curEl) curEl.value = String(syncedCur);
            calcOdometerServiceStatus(true);
        }

        function onShiftKmOrFuelInput() {
            const liveKm = Math.max(0, parseFloat(document.getElementById('shift_km_input')?.value) || 0);
            const liveFuel = Math.max(0, parseFloat(document.getElementById('shift_fuel_cost_input')?.value) || 0);
            const curEl = document.getElementById('current_odometer_input');
            const last = parseFloat(document.getElementById('last_service_odo_input')?.value) || 0;
            const interval = parseFloat(document.getElementById('service_interval_km_select')?.value) || 3000;
            const projectedOdo = Number((BASE_ODOMETER + SHIFT_TOTAL_KM + liveKm).toFixed(1));

            if (curEl && (liveKm > 0 || document.activeElement?.id === 'shift_km_input')) {
                curEl.value = String(projectedOdo);
            }

            const previewEl = document.getElementById('shift-live-cpk-odo-preview');
            if (previewEl) {
                if (liveKm > 0 || liveFuel > 0) {
                    previewEl.classList.remove('hidden');
                    const shiftCpk = liveKm > 0 ? (liveFuel / liveKm).toFixed(2) : '0.00';
                    const nextDue = last + interval;
                    const rem = Number((nextDue - projectedOdo).toFixed(1));
                    previewEl.innerText = '⚡ Shift CPK: Ksh ' + shiftCpk + '/km • New Odo: ' + projectedOdo.toLocaleString() + ' km (' + (rem > 0 ? rem.toLocaleString() + ' km to service' : 'Service Due!') + ')';
                } else {
                    previewEl.classList.add('hidden');
                }
            }

            calcOdometerServiceStatus(false);
            updateStrictSaverAudit();
        }

        var STRICT_NET_FLOOR = ${strictNetFloor};
        var STRICT_FUEL_ALLOWANCE = ${strictFuelAllowance};
        var STRICT_LUNCH_ALLOWANCE = ${strictLunchAllowance};
        var STRICT_AIRTIME_ALLOWANCE = ${strictAirtimeAllowance};
        var STRICT_PERSONAL_CAP = ${strictPersonalCap};
        var STRICT_DAILY_KODI = ${strictDailyKodi};
        var STRICT_SAVE_UNSPENT_LUNCH = ${saveUnspentLunch ? 'true' : 'false'};
        var STRICT_SHORTFALL = ${cumulativeOverdueKes};
        var STRICT_EXPECTED_ACC_BALANCE = ${expectedSavingsAccountBalance};
        var STRICT_SAVINGS_ACC_NAME = ${JSON.stringify(savingsAccountName)};

        function setShiftLunchMode(ateAtHome) {
            var foodInput = document.querySelector('input[name="food_spent"]');
            if (foodInput) {
                foodInput.value = ateAtHome ? '0' : String(STRICT_LUNCH_ALLOWANCE);
            }
            var badgeEl = document.getElementById('shift-lunch-bonus-badge');
            if (badgeEl) {
                if (ateAtHome) {
                    badgeEl.className = 'mt-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400';
                    badgeEl.innerText = '🏠 12:00 PM Home-Lunch Rule Active: +Ksh ' + STRICT_LUNCH_ALLOWANCE.toLocaleString() + ' unspent lunch locked into today\\'s savings!';
                } else {
                    badgeEl.className = 'mt-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400';
                    badgeEl.innerText = '🍲 Standard Lunch Allowance: Ksh ' + STRICT_LUNCH_ALLOWANCE.toLocaleString() + ' (or click Ate at Home to save +Ksh ' + STRICT_LUNCH_ALLOWANCE.toLocaleString() + ')';
                }
            }
            updateStrictSaverAudit();
        }

        function updateStrictContractPreview() {
            var nf = Math.max(100, parseFloat(document.getElementById('strict_net_floor_input')?.value) || 1000);
            var fa = Math.max(0, parseFloat(document.getElementById('strict_fuel_allowance_input')?.value) || 0);
            var la = Math.max(0, parseFloat(document.getElementById('strict_lunch_allowance_input')?.value) || 0);
            var aa = Math.max(0, parseFloat(document.getElementById('strict_airtime_allowance_input')?.value) || 0);
            var pc = la + aa;
            var dk = Math.max(0, parseFloat(document.getElementById('strict_daily_kodi_input')?.value) || 0);
            var sul = document.getElementById('strict_save_unspent_lunch_select')?.value !== '0';
            STRICT_NET_FLOOR = nf;
            STRICT_FUEL_ALLOWANCE = fa;
            STRICT_LUNCH_ALLOWANCE = la;
            STRICT_AIRTIME_ALLOWANCE = aa;
            STRICT_PERSONAL_CAP = pc;
            STRICT_DAILY_KODI = dk;
            STRICT_SAVE_UNSPENT_LUNCH = sul;
            var reqGross = nf + fa + pc + dk + STRICT_SHORTFALL;
            var reqEl = document.getElementById('strict_required_gross_display');
            if (reqEl) reqEl.innerText = 'Ksh ' + reqGross.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            var floorEl = document.getElementById('strict_net_floor_display');
            if (floorEl) floorEl.innerText = 'Ksh ' + nf.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            var capEl = document.getElementById('strict_cap_display');
            if (capEl) capEl.innerText = 'Ksh ' + pc.toLocaleString();
            updateStrictSaverAudit();
        }

        function updateStrictSaverAudit() {
            var gross = Math.max(0, parseFloat(document.querySelector('input[name="total_earned"]')?.value) || 0);
            var fuel = Math.max(0, parseFloat(document.getElementById('shift_fuel_cost_input')?.value) || 0);
            var foodRaw = document.querySelector('input[name="food_spent"]')?.value;
            var food = Math.max(0, parseFloat(foodRaw) || 0);
            var airtime = Math.max(0, parseFloat(document.querySelector('input[name="airtime_spent"]')?.value) || 0);
            var misc = Math.max(0, parseFloat(document.querySelector('input[name="misc_expenses"]')?.value) || 0);

            var personalSpend = food + airtime + misc;
            var totalExp = fuel + personalSpend;
            var pureNet = gross - totalExp;
            var lunchSaved = STRICT_SAVE_UNSPENT_LUNCH ? Math.max(0, STRICT_LUNCH_ALLOWANCE - food) : 0;
            var strictTargetToday = STRICT_NET_FLOOR + lunchSaved;
            var projectedAccBalance = STRICT_EXPECTED_ACC_BALANCE + Math.max(0, pureNet);

            var netVerdictEl = document.getElementById('live-strict-net-verdict');
            var capVerdictEl = document.getElementById('live-strict-cap-verdict');
            var splitLinkEl = document.getElementById('live-strict-split-link');

            if (netVerdictEl) {
                if (gross <= 0) {
                    netVerdictEl.className = 'text-xs font-extrabold text-indigo-300';
                    netVerdictEl.innerText = '🎯 Strict Daily Contract: Save Ksh ' + strictTargetToday.toLocaleString() + (lunchSaved > 0 ? ' (Ksh ' + STRICT_NET_FLOOR.toLocaleString() + ' Target + 🏠 Ksh ' + lunchSaved.toLocaleString() + ' Home-Lunch Saved)' : ' Net Target') + ' • 🏦 Your ' + STRICT_SAVINGS_ACC_NAME + ' currently reads: Ksh ' + STRICT_EXPECTED_ACC_BALANCE.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                } else if (pureNet >= strictTargetToday) {
                    var extraProfit = pureNet - strictTargetToday;
                    netVerdictEl.className = 'text-xs font-extrabold text-emerald-400';
                    netVerdictEl.innerText = '🎉 CONGRATS! You saved Ksh ' + pureNet.toLocaleString() + ' today (Ksh ' + STRICT_NET_FLOOR.toLocaleString() + ' Target' + (lunchSaved > 0 ? ' + Ksh ' + lunchSaved.toLocaleString() + ' Home-Lunch Saved' : '') + (extraProfit > 0 ? ' + Ksh ' + extraProfit.toLocaleString() + ' Extra Profit' : '') + ')! 🏦 Your ' + STRICT_SAVINGS_ACC_NAME + ' should now read: Ksh ' + projectedAccBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                } else {
                    var todayDeficit = strictTargetToday - Math.max(0, pureNet);
                    var totalOverdue = STRICT_SHORTFALL + todayDeficit;
                    netVerdictEl.className = 'text-xs font-extrabold text-rose-400';
                    netVerdictEl.innerText = '💪 LET\\'S CATCH UP! You have an overdue of Ksh ' + totalOverdue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' (Today\\'s Net: Ksh ' + Math.max(0, pureNet).toLocaleString() + ' vs Ksh ' + strictTargetToday.toLocaleString() + ' strict target' + (lunchSaved > 0 ? ' incl. Ksh ' + lunchSaved.toLocaleString() + ' home-lunch lock' : '') + '). 🏦 Your ' + STRICT_SAVINGS_ACC_NAME + ' should now read: Ksh ' + projectedAccBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                }
            }

            if (capVerdictEl) {
                if (personalSpend <= STRICT_PERSONAL_CAP && fuel <= STRICT_FUEL_ALLOWANCE) {
                    capVerdictEl.className = 'text-[11px] font-bold text-emerald-300';
                    capVerdictEl.innerText = '🟢 Shift Expenses Within Budget! Fuel: Ksh ' + fuel.toLocaleString() + '/' + STRICT_FUEL_ALLOWANCE.toLocaleString() + ' • Lunch: Ksh ' + food.toLocaleString() + '/' + STRICT_LUNCH_ALLOWANCE.toLocaleString() + (lunchSaved > 0 ? ' (🏠 +Ksh ' + lunchSaved.toLocaleString() + ' Lunch Saved!)' : '') + ' • Airtime: Ksh ' + airtime.toLocaleString() + '/' + STRICT_AIRTIME_ALLOWANCE.toLocaleString();
                } else {
                    var overCap = Math.max(0, personalSpend - STRICT_PERSONAL_CAP) + Math.max(0, fuel - STRICT_FUEL_ALLOWANCE);
                    capVerdictEl.className = 'text-[11px] font-black text-amber-300';
                    capVerdictEl.innerText = '⚠️ Expense Check: Fuel Ksh ' + fuel.toLocaleString() + '/' + STRICT_FUEL_ALLOWANCE.toLocaleString() + ' • Lunch Ksh ' + food.toLocaleString() + '/' + STRICT_LUNCH_ALLOWANCE.toLocaleString() + ' • Airtime Ksh ' + airtime.toLocaleString() + '/' + STRICT_AIRTIME_ALLOWANCE.toLocaleString() + (overCap > 0 ? ' (Ksh ' + overCap.toLocaleString() + ' above standard budget)' : '');
                }
            }

            if (splitLinkEl && pureNet > 0) {
                splitLinkEl.href = '/?pay_yourself_amount=' + pureNet.toFixed(2) + '#waterfall-card';
                splitLinkEl.innerText = '👑 23:50 Split Ksh ' + pureNet.toLocaleString() + ' Now →';
            }
        }

        function calcOdometerServiceStatus(fromUserEdit) {
            const curInput = document.getElementById('current_odometer_input');
            const lastInput = document.getElementById('last_service_odo_input');
            const intervalSelect = document.getElementById('service_interval_km_select');
            const cur = parseFloat(curInput?.value) || 0;
            const last = parseFloat(lastInput?.value) || 0;
            const interval = parseFloat(intervalSelect?.value) || 3000;
            const liveKm = Math.max(0, parseFloat(document.getElementById('shift_km_input')?.value) || 0);
            const liveFuel = Math.max(0, parseFloat(document.getElementById('shift_fuel_cost_input')?.value) || 0);

            if (fromUserEdit) {
                BASE_ODOMETER = Math.max(0, Number((cur - SHIFT_TOTAL_KM - liveKm).toFixed(1)));
            }

            const nextOdo = Number((last + interval).toFixed(1));
            const remaining = Number((nextOdo - cur).toFixed(1));
            const drivenSinceService = Math.max(0, Number((cur - last).toFixed(1)));

            const nextEl = document.getElementById('next_service_odo_display');
            const badgeEl = document.getElementById('odo_service_badge');
            const drivenEl = document.getElementById('km_since_service_display');
            const svcOdoInput = document.getElementById('service_odometer_form_input');

            if (nextEl) nextEl.innerText = nextOdo.toLocaleString() + ' km';
            if (drivenEl) drivenEl.innerText = drivenSinceService.toLocaleString() + ' km';
            if (svcOdoInput && !svcOdoInput.dataset.touched) svcOdoInput.value = String(cur);

            if (badgeEl) {
                if (remaining <= 0) {
                    badgeEl.className = 'px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 animate-pulse';
                    badgeEl.innerText = '🚨 Overdue by ' + Math.abs(remaining).toLocaleString() + ' km!';
                } else if (remaining <= 500) {
                    badgeEl.className = 'px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300';
                    badgeEl.innerText = '⚠️ Service Soon (' + remaining.toLocaleString() + ' km left)';
                } else {
                    badgeEl.className = 'px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300';
                    badgeEl.innerText = '✅ In Good Standing (' + remaining.toLocaleString() + ' km left)';
                }
            }

            // Calculate Real CPK from shift logs (plus live shift inputs) or odometer delta fallback
            const totalKmWithLive = Number((SHIFT_TOTAL_KM + liveKm).toFixed(1));
            const totalFuelWithLive = SHIFT_TOTAL_FUEL + liveFuel;
            const cpkDist = totalKmWithLive > 0 ? totalKmWithLive : drivenSinceService;
            const defaultCpk = currentPowerType === 'ELECTRIC' ? 1.80 : 4.50;
            const realFuelCpk = (cpkDist > 0 && totalFuelWithLive > 0)
                ? (totalFuelWithLive / cpkDist).toFixed(2)
                : (totalKmWithLive > 0 ? (totalFuelWithLive / totalKmWithLive).toFixed(2) : defaultCpk.toFixed(2));
            const realAllInCpk = (cpkDist > 0 && (totalFuelWithLive + SHIFT_TOTAL_MAINT) > 0)
                ? ((totalFuelWithLive + SHIFT_TOTAL_MAINT) / cpkDist).toFixed(2)
                : realFuelCpk;

            const cpkEl = document.getElementById('real_cpk_display');
            if (cpkEl) {
                cpkEl.innerHTML = 'Ksh ' + realFuelCpk + ' <span class="text-[10px] text-gray-400 font-normal">/ km</span>';
            }
            const cpkAllInEl = document.getElementById('real_all_in_cpk_display');
            if (cpkAllInEl) {
                cpkAllInEl.innerText = 'All-in (Fuel+Maint): Ksh ' + realAllInCpk + '/km';
            }
            const shiftKmBadgeEl = document.getElementById('odo_shift_km_total_badge');
            if (shiftKmBadgeEl) {
                shiftKmBadgeEl.innerText = totalKmWithLive.toLocaleString() + ' km logged in shifts';
            }

            try {
                localStorage.setItem('finatrack_current_odo', String(cur));
                localStorage.setItem('finatrack_last_service_odo', String(last));
                localStorage.setItem('finatrack_interval_km', String(interval));
                const cfgObj = {
                    base_odometer: BASE_ODOMETER,
                    last_service_odo: last,
                    service_interval_km: interval,
                    updated_at: new Date().toISOString()
                };
                document.cookie = "finatrack_odometer_config=" + encodeURIComponent(JSON.stringify(cfgObj)) + ";path=/;max-age=31536000;SameSite=Lax";
            } catch(e) {}
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

        function calcServiceTotal() {
            const oil = parseFloat(document.getElementById('service_oil_cost')?.value) || 0;
            const pads = parseFloat(document.getElementById('service_brake_pad_cost')?.value) || 0;
            const plug = parseFloat(document.getElementById('service_spark_plug_cost')?.value) || 0;
            const labor = parseFloat(document.getElementById('service_labor_cost')?.value) || 0;
            const other = parseFloat(document.getElementById('service_other_cost')?.value) || 0;
            const total = oil + pads + plug + labor + other;
            const totalInput = document.getElementById('service_total_cost');
            if (totalInput) totalInput.value = total > 0 ? total.toFixed(2) : '';
            const badge = document.getElementById('service_total_badge');
            if (badge) {
                const curr = getCurrency();
                badge.innerText = curr === 'Ksh' ? 'Ksh ' + total.toLocaleString(undefined, {minimumFractionDigits: 2}) : '$' + (total / USD_TO_KES).toLocaleString(undefined, {minimumFractionDigits: 2});
            }
        }

        function toggleComplianceDrawer(id) {
            const drawer = document.getElementById('comp-drawer-' + id);
            if (drawer) drawer.classList.toggle('hidden');
        }

        function computeDefaultExpiryDate(monthsAhead) {
            const d = new Date();
            d.setMonth(d.getMonth() + (parseInt(monthsAhead, 10) || 12));
            return d.toISOString().slice(0, 10);
        }

        function onDocIntervalChanged(monthsVal) {
            const expiryInput = document.getElementById('new-doc-expiry-input');
            if (expiryInput) {
                expiryInput.value = computeDefaultExpiryDate(monthsVal);
            }
        }

        function onDocTypePresetChanged(typeVal) {
            const titleInput = document.getElementById('new-doc-title-input');
            const intervalSelect = document.getElementById('new-doc-interval-select');
            const expiryInput = document.getElementById('new-doc-expiry-input');
            const notesInput = document.getElementById('new-doc-notes-input');
            const selectEl = document.getElementById('new-doc-category-select');
            if (selectEl && selectEl.value !== typeVal) {
                selectEl.value = typeVal;
            }
            if (!titleInput) return;

            let months = '12';
            let placeholderNotes = 'e.g. Reference / Policy number, issuing authority, or renewal notes...';

            if (typeVal === 'GOOD_CONDUCT') {
                titleInput.value = 'Certificate of Good Conduct (DCI Police Clearance)';
                months = '12';
                placeholderNotes = 'e.g. eCitizen Ref #PCC-..., DCI / Huduma Centre (Required by Uber, Bolt & SACCOs)';
            } else if (typeVal === 'DL') {
                titleInput.value = 'NTSA Driving License (Smart DL)';
                months = '36';
                placeholderNotes = 'e.g. DL #..., Class A2 / B / C endorsement';
            } else if (typeVal === 'PSV_BADGE') {
                titleInput.value = 'NTSA PSV Driver Badge';
                months = '12';
                placeholderNotes = 'e.g. NTSA TIMS Badge #..., Ride-Hailing / PSV Endorsement';
            } else if (typeVal === 'FOOD_HANDLER') {
                titleInput.value = 'County Food Handler Medical Certificate';
                months = '6';
                placeholderNotes = 'e.g. Nairobi County Health Cert #... (Bolt Food / Glovo / Uber Eats)';
            } else if (typeVal === 'KRA_TCC') {
                titleInput.value = 'KRA Tax Compliance Certificate (TCC)';
                months = '12';
                placeholderNotes = 'e.g. KRA PIN A0..., iTax TCC Serial #...';
            } else if (typeVal === 'HEALTH_COVER') {
                titleInput.value = 'SHA / NHIF & Rider Personal Accident Cover';
                months = '12';
                placeholderNotes = 'e.g. SHA / NHIF Member #..., Personal Accident Policy';
            } else if (typeVal === 'SACCO_ID') {
                titleInput.value = 'SACCO / Stage Membership Permit';
                months = '12';
                placeholderNotes = 'e.g. SACCO Member #..., Stage / Welfare Sticker';
            } else if (typeVal === 'NATIONAL_ID') {
                titleInput.value = 'National ID / Passport';
                months = '60';
                placeholderNotes = 'e.g. ID / Passport #...';
            } else if (typeVal === 'UBER_INSPECT') {
                titleInput.value = 'Uber / Bolt Vehicle Inspection Report';
                months = '12';
                placeholderNotes = 'e.g. Partner Inspection Centre, Sticker / Pass Ref #...';
            } else if (typeVal === 'INSURANCE_PSV') {
                titleInput.value = 'Commercial PSV / Ride-Hail Insurance';
                months = '12';
                placeholderNotes = 'e.g. Policy #POL-..., Directline / Heritage / Britam';
            } else if (typeVal === 'SPEED_GOVERNOR') {
                titleInput.value = 'NTSA Speed Governor & Limiter Certificate';
                months = '12';
                placeholderNotes = 'e.g. Governor Serial #..., Vendor & Sim Expiry';
            } else if (typeVal === 'INSPECTION') {
                titleInput.value = 'NTSA Motor Vehicle Inspection Certificate';
                months = '12';
                placeholderNotes = 'e.g. NTSA Booking Ref #..., Likoni Rd / Industrial Area';
            } else if (typeVal === 'INSURANCE_COMP') {
                titleInput.value = 'Comprehensive Vehicle / Motorbike Insurance';
                months = '12';
                placeholderNotes = 'e.g. Policy #..., Underwriter & Agent Contact';
            } else if (typeVal === 'INSURANCE_TP') {
                titleInput.value = 'Third-Party Vehicle / Motorbike Insurance';
                months = '12';
                placeholderNotes = 'e.g. Policy #..., Monthly or Annual Third-Party Cover';
            } else if (typeVal === 'PSV') {
                titleInput.value = 'County PSV Sticker / Parking Permit';
                months = '12';
                placeholderNotes = 'e.g. County Receipt #..., Zone / Stage Permit';
            } else if (typeVal === 'LOGBOOK') {
                titleInput.value = 'Vehicle Logbook / Asset Registration';
                months = '36';
                placeholderNotes = 'e.g. Logbook #..., NTSA TIMS Registered Owner';
            } else if (typeVal === 'CUSTOM') {
                titleInput.value = '';
                months = '12';
                placeholderNotes = 'Enter any reference number, issuer, or notes for your custom document...';
                titleInput.focus();
            }

            if (intervalSelect) intervalSelect.value = months;
            if (expiryInput && !expiryInput.value) {
                expiryInput.value = computeDefaultExpiryDate(months);
            } else if (expiryInput) {
                expiryInput.value = computeDefaultExpiryDate(months);
            }
            if (notesInput) notesInput.placeholder = placeholderNotes;
        }

        function selectDocPresetQuick(presetKey) {
            const container = document.getElementById('new-comp-form-container');
            if (container) {
                container.classList.remove('hidden');
            }
            onDocTypePresetChanged(presetKey);
            if (container) {
                container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        function toggleMaintDrawer() {
            const container = document.getElementById('maint-log-form-container');
            if (container) container.classList.toggle('hidden');
        }

        // ==========================================
        // 📄 DIGITAL GLOVEBOX & DOCUMENT SCANNER (PHONE & PC)
        // ==========================================
        var _gloveboxTesseractLoaded = false;
        function loadGloveboxTesseract() {
            if (window.Tesseract) return Promise.resolve(window.Tesseract);
            if (_gloveboxTesseractLoaded) {
                return new Promise(function(resolve, reject) {
                    var interval = setInterval(function() {
                        if (window.Tesseract) {
                            clearInterval(interval);
                            resolve(window.Tesseract);
                        }
                    }, 150);
                    setTimeout(function() {
                        clearInterval(interval);
                        if (window.Tesseract) resolve(window.Tesseract);
                        else reject(new Error('OCR engine timed out'));
                    }, 20000);
                });
            }
            _gloveboxTesseractLoaded = true;
            return new Promise(function(resolve, reject) {
                var s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
                s.async = true;
                s.onload = function() {
                    if (window.Tesseract) resolve(window.Tesseract);
                    else reject(new Error('Tesseract failed'));
                };
                s.onerror = function() {
                    _gloveboxTesseractLoaded = false;
                    reject(new Error('Network error loading OCR'));
                };
                document.head.appendChild(s);
            });
        }

        function getDocScansStore() {
            try {
                var raw = localStorage.getItem('finatrack_doc_scans_v1');
                return raw ? JSON.parse(raw) : {};
            } catch(e) {
                return {};
            }
        }

        function saveDocScansStore(store) {
            try {
                localStorage.setItem('finatrack_doc_scans_v1', JSON.stringify(store));
            } catch(e) {
                console.warn('Could not save to localStorage:', e);
            }
        }

        function normalizeDocKey(title, docId) {
            var base = (title || '').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40);
            return docId ? (docId + '_' + base) : ('doc_' + base);
        }

        var _pendingNewDocScan = null;

        function compressDocumentFile(file) {
            return new Promise(function(resolve) {
                if (file.type === 'application/pdf') {
                    var r = new FileReader();
                    r.onload = function(e) {
                        resolve({
                            dataUri: e.target.result,
                            type: 'pdf',
                            name: file.name,
                            sizeKb: Math.round(file.size / 1024)
                        });
                    };
                    r.readAsDataURL(file);
                    return;
                }

                var reader = new FileReader();
                reader.onload = function(ev) {
                    var img = new Image();
                    img.onload = function() {
                        try {
                            var maxW = 1200;
                            var maxH = 1600;
                            var w = img.width;
                            var h = img.height;
                            if (w > maxW || h > maxH) {
                                var ratio = Math.min(maxW / w, maxH / h);
                                w = Math.round(w * ratio);
                                h = Math.round(h * ratio);
                            }
                            var canvas = document.createElement('canvas');
                            canvas.width = w;
                            canvas.height = h;
                            var ctx = canvas.getContext('2d');
                            if (!ctx) {
                                resolve({ dataUri: ev.target.result, type: 'image', name: file.name, sizeKb: Math.round(file.size / 1024) });
                                return;
                            }
                            ctx.drawImage(img, 0, 0, w, h);
                            var compressedUri = canvas.toDataURL('image/jpeg', 0.82);
                            resolve({
                                dataUri: compressedUri,
                                type: 'image',
                                name: file.name,
                                sizeKb: Math.round(compressedUri.length * 0.75 / 1024)
                            });
                        } catch(e) {
                            resolve({ dataUri: ev.target.result, type: 'image', name: file.name, sizeKb: Math.round(file.size / 1024) });
                        }
                    };
                    img.onerror = function() {
                        resolve({ dataUri: ev.target.result, type: 'image', name: file.name, sizeKb: Math.round(file.size / 1024) });
                    };
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        async function handleNewDocScanSelect(file) {
            if (!file) return;
            var previewBox = document.getElementById('new-doc-scan-preview-box');
            var thumbImg = document.getElementById('new-doc-scan-thumb');
            var metaText = document.getElementById('new-doc-scan-meta');
            var ocrStatus = document.getElementById('new-doc-scan-ocr-status');

            if (previewBox) previewBox.classList.remove('hidden');
            if (metaText) metaText.innerText = 'Compressing ' + file.name + '...';

            var res = await compressDocumentFile(file);
            _pendingNewDocScan = res;

            if (thumbImg) {
                if (res.type === 'pdf') {
                    thumbImg.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="%23e11d48" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';
                } else {
                    thumbImg.src = res.dataUri;
                }
            }
            if (metaText) {
                metaText.innerHTML = '<strong>' + res.name + '</strong> (' + res.sizeKb + ' KB) • Ready to attach';
            }
            if (ocrStatus) {
                ocrStatus.innerHTML = '<button type="button" onclick="runOcrOnPendingDocScan()" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[11px] font-bold transition shadow-xs active:scale-95">🔍 Auto-Read Expiry &amp; Ref # from Document</button>';
            }
        }

        async function runOcrOnPendingDocScan() {
            if (!_pendingNewDocScan || _pendingNewDocScan.type === 'pdf') {
                alert('OCR text extraction works best on photo/image scans. If using PDF, enter details manually.');
                return;
            }
            var ocrStatus = document.getElementById('new-doc-scan-ocr-status');
            if (ocrStatus) {
                ocrStatus.innerHTML = '<span class="text-xs font-bold text-amber-600 dark:text-amber-400 animate-pulse">⏳ Scanning document for Expiry Date &amp; Reference #...</span>';
            }
            try {
                var Tesseract = await loadGloveboxTesseract();
                var result = await Tesseract.recognize(_pendingNewDocScan.dataUri, 'eng');
                var text = (result && result.data && result.data.text) ? result.data.text : '';

                // Extract dates: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, or DD Month YYYY
                var datePatterns = [
                    /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/,
                    /\b(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/,
                    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2})\b/i
                ];

                var foundExpiry = null;
                var expiryInput = document.getElementById('new-doc-expiry-input');
                var notesInput = document.getElementById('new-doc-notes-input');

                // Search for expiry date
                for (var p = 0; p < datePatterns.length; p++) {
                    var m = text.match(datePatterns[p]);
                    if (m) {
                        try {
                            if (p === 0) {
                                var day = ('0' + m[1]).slice(-2);
                                var mo = ('0' + m[2]).slice(-2);
                                var yr = m[3];
                                foundExpiry = yr + '-' + mo + '-' + day;
                            } else if (p === 1) {
                                foundExpiry = m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
                            } else if (p === 2) {
                                var dObj = new Date(m[0]);
                                if (!isNaN(dObj.getTime())) {
                                    foundExpiry = dObj.toISOString().slice(0, 10);
                                }
                            }
                            if (foundExpiry) break;
                        } catch(e) {}
                    }
                }

                // Reference / Policy # check (e.g. PCC-..., POL-..., DL..., TIMS...)
                var refMatch = text.match(/\b(PCC[A-Z0-9\-]+|POL[\-0-9A-Z]+|DL[0-9A-Z]+|NTSA[0-9A-Z]+|PIN[A-Z0-9]+)\b/i);

                if (foundExpiry && expiryInput) {
                    expiryInput.value = foundExpiry;
                }
                if (refMatch && notesInput && !notesInput.value) {
                    notesInput.value = 'Ref: ' + refMatch[0];
                }

                if (ocrStatus) {
                    ocrStatus.innerHTML = '<span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">✅ Scanned! ' + (foundExpiry ? 'Found Expiry: ' + foundExpiry : 'Please verify expiry date.') + (refMatch ? ' (' + refMatch[0] + ')' : '') + '</span>';
                }
            } catch(err) {
                console.warn('OCR doc error:', err);
                if (ocrStatus) {
                    ocrStatus.innerHTML = '<span class="text-xs text-rose-500 font-semibold">⚠️ Could not auto-read text. Image is still attached!</span>';
                }
            }
        }

        function savePendingDocScanOnCreate() {
            if (!_pendingNewDocScan) return true;
            try {
                var title = document.getElementById('new-doc-title-input')?.value || 'Document';
                var key = normalizeDocKey(title, null);
                var store = getDocScansStore();
                store[key] = {
                    title: title,
                    dataUri: _pendingNewDocScan.dataUri,
                    type: _pendingNewDocScan.type,
                    name: _pendingNewDocScan.name,
                    sizeKb: _pendingNewDocScan.sizeKb,
                    attachedAt: new Date().toISOString()
                };
                saveDocScansStore(store);
            } catch(e) {
                console.warn('Error saving pending doc scan:', e);
            }
            return true;
        }

        function attachScanToExistingDoc(docId, title, file) {
            if (!file) return;
            compressDocumentFile(file).then(function(res) {
                var store = getDocScansStore();
                var key = normalizeDocKey(title, docId);
                store[key] = {
                    docId: docId,
                    title: title,
                    dataUri: res.dataUri,
                    type: res.type,
                    name: res.name,
                    sizeKb: res.sizeKb,
                    attachedAt: new Date().toISOString()
                };
                saveDocScansStore(store);
                refreshDocCardScanBadges();
                showGloveboxModal(docId, title);
            });
        }

        function refreshDocCardScanBadges() {
            var store = getDocScansStore();
            document.querySelectorAll('[data-comp-doc-id]').forEach(function(card) {
                var id = card.getAttribute('data-comp-doc-id');
                var title = card.getAttribute('data-comp-doc-title');
                var keyWithId = normalizeDocKey(title, id);
                var keyNoId = normalizeDocKey(title, null);
                var item = store[keyWithId] || store[keyNoId];

                var badgeEl = card.querySelector('.glovebox-status-badge');
                var viewBtn = card.querySelector('.glovebox-view-btn');

                if (item && item.dataUri) {
                    if (badgeEl) {
                        badgeEl.className = 'glovebox-status-badge text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1';
                        badgeEl.innerHTML = '<span>📎</span> Scanned Copy Ready';
                    }
                    if (viewBtn) {
                        viewBtn.classList.remove('hidden');
                    }
                } else {
                    if (badgeEl) {
                        badgeEl.className = 'glovebox-status-badge text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400';
                        badgeEl.innerText = '📷 No Scan Attached';
                    }
                    if (viewBtn) {
                        viewBtn.classList.add('hidden');
                    }
                }
            });
        }

        function showGloveboxModal(docId, title) {
            var store = getDocScansStore();
            var keyWithId = normalizeDocKey(title, docId);
            var keyNoId = normalizeDocKey(title, null);
            var item = store[keyWithId] || store[keyNoId];

            var modal = document.getElementById('doc-glovebox-modal');
            var modalTitle = document.getElementById('glovebox-modal-title');
            var modalViewer = document.getElementById('glovebox-modal-viewer');
            var downloadBtn = document.getElementById('glovebox-download-btn');
            var deleteBtn = document.getElementById('glovebox-delete-scan-btn');

            if (!modal) return;
            if (modalTitle) modalTitle.innerText = title;

            if (item && item.dataUri) {
                if (modalViewer) {
                    if (item.type === 'pdf') {
                        modalViewer.innerHTML = '<iframe src="' + item.dataUri + '" class="w-full h-[65vh] rounded-xl border border-gray-700" title="' + title + '"></iframe>';
                    } else {
                        modalViewer.innerHTML = '<div class="max-h-[68vh] overflow-auto flex items-center justify-center p-2 bg-slate-950 rounded-xl border border-gray-800">' +
                            '<img src="' + item.dataUri + '" alt="' + title + '" class="max-w-full max-h-[65vh] object-contain rounded-lg shadow-lg">' +
                            '</div>';
                    }
                }
                if (downloadBtn) {
                    downloadBtn.href = item.dataUri;
                    downloadBtn.download = (title.replace(/[^a-z0-9]/gi, '_') || 'document') + (item.type === 'pdf' ? '.pdf' : '.jpg');
                    downloadBtn.classList.remove('hidden');
                }
                if (deleteBtn) {
                    deleteBtn.onclick = function() {
                        if (confirm('Remove scanned copy for ' + title + '?')) {
                            delete store[keyWithId];
                            delete store[keyNoId];
                            saveDocScansStore(store);
                            refreshDocCardScanBadges();
                            modal.classList.add('hidden');
                        }
                    };
                    deleteBtn.classList.remove('hidden');
                }
            } else {
                if (modalViewer) {
                    modalViewer.innerHTML = '<div class="p-8 text-center space-y-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">' +
                        '<span class="text-4xl">📷</span>' +
                        '<h4 class="font-bold text-gray-800 dark:text-gray-200">No Scanned Copy Attached Yet</h4>' +
                        '<p class="text-xs text-gray-500 dark:text-gray-400">Snap a photo with your phone camera or upload a PDF/Image below.</p>' +
                        '<div class="flex justify-center gap-2 pt-2">' +
                        '<button type="button" onclick="document.getElementById(\\'doc-card-file-input-' + docId + '\\')?.click()" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition shadow-xs">📷 Scan / Upload Now</button>' +
                        '</div>' +
                        '</div>';
                }
                if (downloadBtn) downloadBtn.classList.add('hidden');
                if (deleteBtn) deleteBtn.classList.add('hidden');
            }

            modal.classList.remove('hidden');
        }

        document.addEventListener('DOMContentLoaded', function() {
            refreshDocCardScanBadges();
        });
        setTimeout(refreshDocCardScanBadges, 800);


        // ==========================================
        // ⚡ DYNAMIC EV VS PETROL ADAPTATION ENGINE
        // ==========================================
        function setPowerType(type) {
            currentPowerType = type;
            const hiddenPowerInput = document.getElementById('input_power_type');
            if (hiddenPowerInput) hiddenPowerInput.value = type;

            const btnPetrol = document.getElementById('btn-power-petrol');
            const btnElectric = document.getElementById('btn-power-electric');
            const stationLabel = document.getElementById('station-field-label');
            const stationSelect = document.getElementById('fuel_station_select');
            const costLabel = document.getElementById('energy-cost-label');
            const metricContainer = document.getElementById('metric-field-container');

            const maintPetrol = document.getElementById('maint-checklist-petrol');
            const maintElectric = document.getElementById('maint-checklist-electric');

            const lbl1 = document.getElementById('label_item_1');
            const lbl2 = document.getElementById('label_item_2');
            const lbl3 = document.getElementById('label_item_3');
            const lbl4 = document.getElementById('label_item_4');
            const lbl5 = document.getElementById('label_item_5');
            const svcTitle = document.getElementById('service_type_input');
            const notesInput = document.getElementById('service_notes_input');

            if (type === 'ELECTRIC') {
                if (btnElectric) {
                    btnElectric.className = 'px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs transition active:scale-95';
                }
                if (btnPetrol) {
                    btnPetrol.className = 'px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-xs transition active:scale-95';
                }
                if (stationLabel) stationLabel.innerHTML = '🔋 EV Battery Swap Station';
                if (costLabel) costLabel.innerHTML = '🔋 Battery Swap Cost (<span class="curr-symbol-label">Ksh</span>)';

                if (stationSelect) {
                    stationSelect.innerHTML = '<option value="SPIRO">Spiro Swap Station</option>' +
                                              '<option value="ROAM">Roam Hub / Station</option>' +
                                              '<option value="AMPERSAND">Ampersand Swap Point</option>' +
                                              '<option value="KIRI">Kiri EV Hub</option>' +
                                              '<option value="ARC_RIDE">ARC Ride Station</option>' +
                                              '<option value="BASIGO">BasiGo Hub</option>' +
                                              '<option value="OTHER">Other EV Network</option>';
                }

                if (metricContainer) {
                    metricContainer.innerHTML = '<label class="block text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">🔋 Swaps Count</label>' +
                                                '<input type="number" step="1" min="0" inputmode="numeric" name="swaps_count" value="1" placeholder="e.g. 2 swaps" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">';
                }

                if (lbl1) lbl1.innerHTML = '🔋 Battery Terminals & Latch';
                if (lbl2) lbl2.innerHTML = '🛑 Regenerative Braking & Pads';
                if (lbl3) lbl3.innerHTML = '⚡ Motor Controller & BMS (0 if OK)';
                if (lbl4) lbl4.innerHTML = '👨‍🔧 EV Technician Labor Fee';
                if (lbl5) lbl5.innerHTML = '🛵 Drive Belt / Tire / Wiring';
                if (svcTitle && svcTitle.value === 'Oil Change, Brake Pads & Labor Service') {
                    svcTitle.value = 'EV Battery Latch, Regen Braking & Tech Inspection';
                }
                if (notesInput) {
                    notesInput.placeholder = 'e.g. Cleaned battery latch terminals, checked motor controller harness, tuned regen braking.';
                }

                if (maintElectric) maintElectric.classList.remove('hidden');
                if (maintPetrol) maintPetrol.classList.add('hidden');
            } else {
                if (btnPetrol) {
                    btnPetrol.className = 'px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-xs shadow-xs transition active:scale-95';
                }
                if (btnElectric) {
                    btnElectric.className = 'px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-xs transition active:scale-95';
                }
                if (stationLabel) stationLabel.innerHTML = '⛽ Petrol Station';
                if (costLabel) costLabel.innerHTML = '⛽ Fuel & Petrol Cost (<span class="curr-symbol-label">Ksh</span>)';

                if (stationSelect) {
                    stationSelect.innerHTML = '<option value="RUBIS">Rubis Energy</option>' +
                                              '<option value="TOTAL">TotalEnergies</option>' +
                                              '<option value="SHELL">Shell / Vivo</option>' +
                                              '<option value="OLA">Ola Energy</option>' +
                                              '<option value="HASS">Hass Petroleum</option>' +
                                              '<option value="OTHER">Other Station</option>';
                }

                if (metricContainer) {
                    metricContainer.innerHTML = '<label class="block text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">⛽ Fuel Litres (Optional)</label>' +
                                                '<input type="number" step="any" inputmode="decimal" name="fuel_litres" placeholder="0.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm">';
                }

                if (lbl1) lbl1.innerHTML = '🛢️ Engine Oil & Filter';
                if (lbl2) lbl2.innerHTML = '🛑 Brake Pads / Shoes';
                if (lbl3) lbl3.innerHTML = '⚡ Spark Plug (0 if OK)';
                if (lbl4) lbl4.innerHTML = '👨‍🔧 Mechanic Labor Fee';
                if (lbl5) lbl5.innerHTML = '🔩 Other Spares / Chain';
                if (svcTitle && svcTitle.value === 'EV Battery Latch, Regen Braking & Tech Inspection') {
                    svcTitle.value = 'Oil Change, Brake Pads & Labor Service';
                }
                if (notesInput) {
                    notesInput.placeholder = 'e.g. Changed oil (20W-50) & brake pads. Spark plug was good so did not buy new one. Paid mechanic labor.';
                }

                if (maintPetrol) maintPetrol.classList.remove('hidden');
                if (maintElectric) maintElectric.classList.add('hidden');
            }

            applyConversion();
        }

        function onBikeSelectChanged(bikeId) {
            const bike = bikesData.find(b => b.id === bikeId);
            if (bike && bike.power_type) {
                setPowerType(bike.power_type);
            }
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
            calcDuration();
            setPowerType(currentPowerType);
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
                    <span class="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">EV & ICE Time Intelligence</span>
                </div>
            </div>
            
            <div class="flex items-center space-x-2 sm:space-x-3">
                <button onclick="triggerAppInstall()" class="pwa-install-trigger px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center space-x-1.5 hidden">
                    <span>📲</span>
                    <span class="hidden sm:inline">Install App</span>
                    <span class="sm:hidden">Install</span>
                </button>

                <a href="/finance/statement" class="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs">
                    <span>📄 <span class="hidden md:inline">SACCO Statement</span></span>
                </a>

                <a href="/" class="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs">
                    <span>⚡ <span class="hidden md:inline">Finance Freedom Hub</span></span>
                </a>

                <select id="currency-selector" onchange="setCurrency(this.value)" class="text-xs bg-gray-100 dark:bg-gray-800 border-0 rounded-lg px-2.5 py-1.5 font-bold text-gray-700 dark:text-gray-200 cursor-pointer">
                    <option value="Ksh" ${current_currency === 'Ksh' ? 'selected' : ''}>KSH</option>
                    <option value="USD" ${current_currency === 'USD' ? 'selected' : ''}>USD</option>
                </select>

                ${is_logged_in ? `
                <div class="flex items-center space-x-1.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 px-2.5 py-1.5 rounded-xl shadow-xs">
                    <span class="text-xs">👤</span>
                    <span class="text-xs font-bold text-blue-800 dark:text-blue-300 max-w-[100px] truncate hidden sm:inline">${username}</span>
                    <form action="/auth/logout" method="POST" class="inline m-0 p-0">
                        <input type="hidden" name="redirect_to" value="/rider">
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
                <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-2xl text-white shadow-md">
                    🛵
                </div>
                <div>
                    <h2 class="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-tight">
                        ${is_logged_in ? `Welcome back, <span class="text-blue-600 dark:text-blue-400 font-extrabold">${username}</span>!` : `Welcome to <span class="text-blue-600 dark:text-blue-400 font-extrabold">Rider Fleet Tracker</span>!`}
                    </h2>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Dynamic EV battery swap & ICE fuel intelligence with automatic financial ledger synchronization.</p>
                </div>
            </div>
            <div class="flex items-center space-x-2 text-xs">
                ${is_logged_in ? `
                <span class="px-3 py-1 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 font-bold rounded-xl flex items-center gap-1.5 shadow-2xs">
                    <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span>Authenticated (${username})</span>
                </span>
                ` : `
                <a href="/login" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition active:scale-95">
                    <span>🔑 Sign In / Register</span>
                </a>
                `}
            </div>
        </div>

        <!-- Mobile Quick Action Pills (Horizontal scroll on phone) -->
        <div class="flex sm:hidden overflow-x-auto gap-2 py-1 no-scrollbar -mx-4 px-4 sticky top-14 z-20 bg-gray-50/90 dark:bg-slate-950/90 backdrop-blur-md">
            <a href="/?pay_yourself_amount=${closeoutSplitAmount.toFixed(2)}#waterfall-card" class="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-emerald-600 active:scale-95 text-slate-950 text-xs font-black rounded-xl shadow-xs shrink-0 transition">
                <span>👑 Pay Yourself (23:50)</span>
            </a>
            <button onclick="document.getElementById('shift-log-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>⏱️ Log Shift</span>
            </button>
            <button onclick="document.getElementById('maint-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>🛠️ Service</span>
            </button>
            <button onclick="document.getElementById('compliance-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>📜 Documents</span>
            </button>
            <button onclick="document.getElementById('fleet-card')?.scrollIntoView({behavior: 'smooth'})" class="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 active:scale-95 text-emerald-400 text-xs font-bold rounded-xl shadow-xs shrink-0 border border-slate-700 transition">
                <span>🛵 Fleet</span>
            </button>
            <a href="/" class="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>⚡ Finance</span>
            </a>
            <button onclick="triggerAppInstall()" class="pwa-install-trigger flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition">
                <span>📲 Install</span>
            </button>
        </div>

        <!-- ☀️ Daily Rider Shift Briefing & Strict Saver Contract Card -->
        <div id="shift-briefing-card" class="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-blue-800/40 space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-blue-800/60 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-xl shadow-xs">
                        🛡️
                    </div>
                    <div>
                        <h2 class="text-lg font-black text-white flex items-center gap-2">
                            <span>Strict Money Follower &amp; Daily Shift Contract</span>
                            <span class="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-400/30">Strict Saver Mode</span>
                        </h2>
                        <p class="text-xs text-blue-200">Memorize 1 Gross number while on the road • Audit Net Floor &amp; Expense Cap when you log at home at 23:50.</p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" onclick="document.getElementById('strict-contract-drawer')?.classList.toggle('hidden')" class="px-3 py-1.5 bg-indigo-900/80 hover:bg-indigo-800 border border-indigo-500/50 text-indigo-200 text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 active:scale-95">
                        <span>⚙️ Edit Strict Rules</span>
                    </button>
                    <a href="/?pay_yourself_amount=${closeoutSplitAmount.toFixed(2)}#waterfall-card" class="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 text-xs font-black rounded-xl transition shadow-xs flex items-center gap-1.5 active:scale-95">
                        <span>👑 23:50 Pay Yourself First (Ksh ${closeoutSplitAmount.toLocaleString()})</span>
                    </a>
                    <button onclick="document.getElementById('shift-log-card')?.scrollIntoView({behavior: 'smooth'})" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 active:scale-95">
                        <span>⚡ Log Shift (At Home)</span>
                    </button>
                </div>
            </div>

            <!-- Collapsible Strict Saver Contract Editor -->
            <div id="strict-contract-drawer" class="hidden p-4 bg-slate-950/90 border border-indigo-700/60 rounded-2xl space-y-3">
                <div class="flex flex-wrap justify-between items-center gap-2 border-b border-indigo-900/60 pb-2">
                    <div>
                        <h3 class="text-xs font-black text-amber-300 uppercase tracking-wider">🛡️ Set Your Strict Money Follower Contract (Fuel 500 • Lunch 150 • Airtime 50 • Net Target 1,000)</h3>
                        <p class="text-[11px] text-gray-400">When you leave home at 12:00 PM having already eaten lunch, unspent lunch is automatically locked into your savings alongside your target and extra profit.</p>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="text-[10px] text-gray-400 font-bold">Quick Target:</span>
                        <button type="button" onclick="document.getElementById('strict_net_floor_input').value='1000'; updateStrictContractPreview();" class="px-2 py-0.5 bg-slate-800 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 rounded-lg text-[10px] font-bold">Ksh 1,000</button>
                        <button type="button" onclick="document.getElementById('strict_net_floor_input').value='1500'; updateStrictContractPreview();" class="px-2 py-0.5 bg-slate-800 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 rounded-lg text-[10px] font-bold">Ksh 1,500</button>
                        <button type="button" onclick="document.getElementById('strict_net_floor_input').value='2000'; updateStrictContractPreview();" class="px-2 py-0.5 bg-slate-800 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 rounded-lg text-[10px] font-bold">Ksh 2,000</button>
                    </div>
                </div>
                <form action="/rider/strict-contract" method="POST" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end text-xs">
                    <input type="hidden" name="bike_id" value="${active_bike?.id || ''}">
                    <div>
                        <label class="block text-[11px] font-bold text-emerald-300 mb-1">🎯 1. Strict Net Target (After Exp)</label>
                        <input type="number" step="any" id="strict_net_floor_input" name="net_floor_kes" value="${strictNetFloor}" oninput="updateStrictContractPreview()" class="w-full p-2 bg-slate-900 border border-emerald-700 rounded-xl font-black text-emerald-400 text-sm" required>
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-cyan-300 mb-1">⛽ 2. Daily Fuel / Swap Budget</label>
                        <input type="number" step="any" id="strict_fuel_allowance_input" name="fuel_allowance_kes" value="${strictFuelAllowance}" oninput="updateStrictContractPreview()" class="w-full p-2 bg-slate-900 border border-cyan-800 rounded-xl font-bold text-cyan-300 text-sm" required>
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-amber-300 mb-1">🍲 3. Daily Lunch Budget (Default 150)</label>
                        <input type="number" step="any" id="strict_lunch_allowance_input" name="lunch_allowance_kes" value="${strictLunchAllowance}" oninput="updateStrictContractPreview()" class="w-full p-2 bg-slate-900 border border-amber-800 rounded-xl font-bold text-amber-300 text-sm" required>
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-rose-300 mb-1">📱 4. Daily Airtime Budget (Default 50)</label>
                        <input type="number" step="any" id="strict_airtime_allowance_input" name="airtime_allowance_kes" value="${strictAirtimeAllowance}" oninput="updateStrictContractPreview()" class="w-full p-2 bg-slate-900 border border-rose-800 rounded-xl font-bold text-rose-300 text-sm" required>
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-emerald-300 mb-1">🏠 5. 12 PM Home-Lunch Savings Rule</label>
                        <select id="strict_save_unspent_lunch_select" name="save_unspent_lunch" onchange="updateStrictContractPreview()" class="w-full p-2 bg-slate-900 border border-emerald-700 rounded-xl font-bold text-emerald-300 text-xs">
                            <option value="1" ${saveUnspentLunch ? 'selected' : ''}>🔒 Strict: Save Unspent Lunch (+Ksh ${strictLunchAllowance})</option>
                            <option value="0" ${!saveUnspentLunch ? 'selected' : ''}>Relaxed: Don't Lock Unspent Lunch</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-indigo-300 mb-1">🏦 6. Target Account You Save To</label>
                        <select name="savings_account_id" onchange="if(this.selectedOptions[0] && this.value){document.getElementById('strict_savings_acc_name_input').value=this.selectedOptions[0].dataset.accname || '';}" class="w-full p-2 bg-slate-900 border border-indigo-700 rounded-xl font-bold text-indigo-200 text-xs">
                            <option value="">-- Custom / Strict Savings Vault --</option>
                            ${(accounts || []).map((a: any) => `<option value="${a.id}" data-accname="${a.name}" ${String(savingsAccountId) === String(a.id) ? 'selected' : ''}>${a.name} (${a.account_type})</option>`).join('')}
                        </select>
                        <input type="hidden" id="strict_savings_acc_name_input" name="savings_account_name" value="${savingsAccountName}">
                    </div>
                    <div>
                        <label class="block text-[11px] font-bold text-purple-300 mb-1">💰 7. Opening Balance Before Shifts</label>
                        <input type="number" step="any" name="starting_savings_balance" value="${startingSavingsBalance}" class="w-full p-2 bg-slate-900 border border-purple-800 rounded-xl font-bold text-purple-300 text-sm">
                    </div>
                    <div class="flex gap-2 items-end">
                        <input type="hidden" id="strict_daily_kodi_input" name="daily_kodi_kes" value="${strictDailyKodi}">
                        <button type="submit" class="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition shadow-md active:scale-95">
                            🔒 Lock Strict Contract
                        </button>
                    </div>
                </form>
            </div>

            <!-- 🎉 LIVE CONGRATS vs 💪 LET'S CATCH UP (OVERDUE) & EXPECTED ACCOUNT BALANCE BANNER -->
            ${lastShift ? (
              (lastShiftMetStrict && cumulativeOverdueKes <= 0) ? `
              <div class="p-4 bg-gradient-to-r from-emerald-950/95 via-teal-950/90 to-slate-950 border-2 border-emerald-500/70 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div class="space-y-1">
                      <div class="flex items-center gap-2 flex-wrap">
                          <span class="px-2.5 py-0.5 bg-emerald-500 text-slate-950 font-black text-[11px] rounded-full uppercase tracking-wider">🎉 CONGRATS! TARGET &amp; PROFIT HIT</span>
                          <span class="text-xs font-bold text-emerald-300">Latest Shift (${lastShift.date})</span>
                      </div>
                      <p class="text-sm sm:text-base font-black text-white">
                          You saved <span class="text-emerald-400 convertible-amount" data-kes="${lastShiftNet}">Ksh ${lastShiftNet.toLocaleString(undefined, {minimumFractionDigits: 2})}</span> on your shift!
                          <span class="text-xs font-bold text-emerald-200">
                              (Ksh ${strictNetFloor.toLocaleString()} Target${lastShiftLunchSaved > 0 ? ` + 🏠 Ksh ${lastShiftLunchSaved.toLocaleString()} Home-Lunch Saved` : ''}${lastShiftOverflow > 0 ? ` + 🚀 Ksh ${lastShiftOverflow.toLocaleString()} Extra Profit` : ''})
                          </span>
                      </p>
                      <p class="text-xs text-emerald-200/90">
                          🏦 Your <strong class="text-amber-300 underline decoration-amber-400/60">${savingsAccountName}</strong> should now read:
                          <strong class="text-base font-black text-amber-300 ml-1 convertible-amount" data-kes="${expectedSavingsAccountBalance}">Ksh ${expectedSavingsAccountBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                      </p>
                  </div>
                  <div class="bg-slate-950/90 border border-emerald-500/50 px-4 py-2.5 rounded-xl text-right shrink-0">
                      <span class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 block">🏦 ${savingsAccountName} Should Read</span>
                      <span class="text-xl font-black text-emerald-400 convertible-amount" data-kes="${expectedSavingsAccountBalance}">Ksh ${expectedSavingsAccountBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      <span class="text-[10px] text-gray-400 block">✅ Ksh 0.00 Overdue</span>
                  </div>
              </div>
              ` : `
              <div class="p-4 bg-gradient-to-r from-rose-950/95 via-amber-950/85 to-slate-950 border-2 border-rose-500/70 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div class="space-y-1">
                      <div class="flex items-center gap-2 flex-wrap">
                          <span class="px-2.5 py-0.5 bg-rose-500 text-white font-black text-[11px] rounded-full uppercase tracking-wider animate-pulse">💪 LET'S CATCH UP! OVERDUE ACTIVE</span>
                          <span class="text-xs font-bold text-rose-200">Latest Shift (${lastShift.date}): Saved Ksh ${lastShiftNet.toLocaleString()} vs Ksh ${lastShiftStrictTarget.toLocaleString()} Strict Target</span>
                      </div>
                      <p class="text-sm sm:text-base font-black text-white">
                          Let's catch up! You have an overdue of <span class="text-rose-400 underline convertible-amount" data-kes="${cumulativeOverdueKes}">Ksh ${cumulativeOverdueKes.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span> to recover.
                      </p>
                      <p class="text-xs text-amber-200/90">
                          🏦 Your <strong class="text-amber-300">${savingsAccountName}</strong> should currently read <strong class="text-white font-black convertible-amount" data-kes="${expectedSavingsAccountBalance}">Ksh ${expectedSavingsAccountBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                          (and will read <strong class="text-emerald-300 font-black convertible-amount" data-kes="${expectedSavingsAccountBalance + cumulativeOverdueKes}">Ksh ${(expectedSavingsAccountBalance + cumulativeOverdueKes).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong> once you clear the overdue!).
                      </p>
                  </div>
                  <div class="bg-slate-950/90 border border-rose-500/50 px-4 py-2.5 rounded-xl text-right shrink-0">
                      <span class="text-[10px] font-extrabold uppercase tracking-wider text-rose-300 block">⚠️ Overdue To Catch Up</span>
                      <span class="text-xl font-black text-rose-400 convertible-amount" data-kes="${cumulativeOverdueKes}">Ksh ${cumulativeOverdueKes.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      <span class="text-[10px] text-amber-300 block">🏦 Account Now: Ksh ${expectedSavingsAccountBalance.toLocaleString()}</span>
                  </div>
              </div>
              `
            ) : `
              <div class="p-4 bg-slate-950/90 border border-indigo-500/40 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div class="space-y-1">
                      <span class="text-[10px] font-black uppercase tracking-wider text-amber-300">🏦 Strict Savings &amp; Overdue Tracker (${savingsAccountName})</span>
                      <p class="text-xs sm:text-sm font-bold text-white">
                          Daily Rule: <strong class="text-emerald-400">Ksh ${strictNetFloor.toLocaleString()} Net Target</strong> + <strong class="text-cyan-300">Ksh ${strictFuelAllowance.toLocaleString()} Fuel</strong> + <strong class="text-amber-300">Ksh ${strictLunchAllowance.toLocaleString()} Lunch</strong> + <strong class="text-rose-300">Ksh ${strictAirtimeAllowance.toLocaleString()} Airtime</strong>.
                          If you eat lunch at home at 12:00 PM (<code class="text-emerald-300">Lunch = 0</code>), that <strong>Ksh ${strictLunchAllowance.toLocaleString()}</strong> is automatically added to your savings!
                      </p>
                  </div>
                  <div class="bg-slate-900 border border-indigo-700/60 px-3.5 py-2 rounded-xl text-right shrink-0">
                      <span class="text-[10px] text-indigo-300 font-bold block">🏦 ${savingsAccountName} Should Read</span>
                      <span class="text-lg font-black text-emerald-400">Ksh ${expectedSavingsAccountBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
              </div>
            `}

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <!-- 1. Strict Net Take-Home Floor -->
                <div class="p-4 bg-slate-950/80 border border-emerald-800/60 rounded-2xl space-y-2">
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">🎯 1. Strict Net Target (+ Home Lunch)</span>
                        <span class="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-bold">Pure Savings</span>
                    </div>
                    <p id="strict_net_floor_display" class="text-2xl font-black text-emerald-400 convertible-amount" data-kes="${strictNetFloor}">Ksh ${strictNetFloor.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    <p class="text-[11px] text-gray-300">With Lunch: <strong class="text-emerald-300">Save Ksh ${strictNetFloor.toLocaleString()}</strong> • Ate at Home (12 PM): <strong class="text-amber-300">Save Ksh ${(strictNetFloor + strictLunchAllowance).toLocaleString()}</strong> (+ extra profit)</p>
                </div>

                <!-- 2. Hard Shift Expense Cap (Fuel 500 + Lunch 150 + Airtime 50) -->
                <div class="p-4 bg-slate-950/80 border border-blue-900/60 rounded-2xl space-y-2">
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-[10px] text-rose-300 font-bold uppercase tracking-wider">🛑 2. Strict Shift Expense Budget</span>
                        <span class="text-[10px] px-2 py-0.5 ${lastShiftPersonalSpend <= strictPersonalCap ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'} rounded-full font-bold">
                            ${lastShiftPersonalSpend <= strictPersonalCap ? '🟢 Within Cap' : '🚨 Over Cap!'}
                        </span>
                    </div>
                    <p class="text-2xl font-black text-cyan-300">
                        <span id="strict_cap_display">Ksh ${strictPersonalCap.toLocaleString()}</span>
                        <span class="text-xs font-normal text-gray-400">+ Ksh ${strictFuelAllowance.toLocaleString()} ${activePowerType === 'ELECTRIC' ? 'Swap' : 'Fuel'}</span>
                    </p>
                    <p class="text-[11px] text-gray-300">
                        🍲 Lunch: <strong class="text-amber-300">Ksh ${strictLunchAllowance}</strong> (or <strong class="text-emerald-400">Ksh 0</strong> if ate at home) • 📱 Airtime: <strong class="text-rose-300">Ksh ${strictAirtimeAllowance}</strong> • ⛽ Fuel: <strong class="text-cyan-300">Ksh ${strictFuelAllowance}</strong>
                    </p>
                </div>

                <!-- 3. On-Road "Can I Go Home?" Gross Target & Post-Shift Overflow Verdict -->
                <div class="p-4 bg-slate-950/80 border border-amber-700/60 rounded-2xl space-y-2">
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-[10px] text-amber-300 font-bold uppercase tracking-wider">🏁 3. Required Gross Before Home</span>
                        <span class="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-bold">Roadside Rule</span>
                    </div>
                    <p id="strict_required_gross_display" class="text-2xl font-black text-amber-400 convertible-amount" data-kes="${requiredGrossBeforeHome}">Ksh ${requiredGrossBeforeHome.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    <p class="text-[11px] text-gray-300">
                        ${cumulativeOverdueKes > 0
                          ? `⚠️ Includes <strong class="text-rose-400">+Ksh ${cumulativeOverdueKes.toLocaleString()} overdue catch-up</strong> on top of Ksh ${(strictNetFloor + strictFuelAllowance + strictPersonalCap + strictDailyKodi).toLocaleString()} standard gross`
                          : `Ksh ${strictNetFloor.toLocaleString()} Target + Ksh ${strictFuelAllowance.toLocaleString()} Fuel + Ksh ${strictLunchAllowance.toLocaleString()} Lunch + Ksh ${strictAirtimeAllowance.toLocaleString()} Airtime`}
                    </p>
                </div>
            </div>
        </div>

        <!-- 🛵 Active Motorbike & Fleet Management Card -->
        <div id="fleet-card" class="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b dark:border-gray-800 pb-4">
                <div class="flex items-center space-x-3">
                    <div class="w-12 h-12 rounded-2xl ${active_bike ? (activePowerType === 'ELECTRIC' ? 'bg-gradient-to-tr from-emerald-500 to-teal-600' : 'bg-gradient-to-tr from-amber-500 to-rose-600') : 'bg-slate-700'} flex items-center justify-center text-2xl text-white shadow-md">
                        ${active_bike ? (activePowerType === 'ELECTRIC' ? '⚡' : '🏍️') : '🛵'}
                    </div>
                    <div>
                        <div class="flex items-center space-x-2">
                            <h2 class="text-lg font-black text-gray-900 dark:text-white">${active_bike ? `Active Vehicle: ${active_bike.plate_number} (${active_bike.model_name || 'Fleet Vehicle'})` : 'No Vehicle Registered Yet'}</h2>
                            ${active_bike ? `
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${activePowerType === 'ELECTRIC' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : (activePowerType === 'HYBRID' ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300' : (activePowerType === 'DIESEL' ? 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300' : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'))}">
                                ${activePowerType === 'ELECTRIC' ? '⚡ Electric EV' : (activePowerType === 'HYBRID' ? '🔋 Hybrid Electric' : (activePowerType === 'DIESEL' ? '🛢️ Diesel Engine (ICE)' : '⛽ Petrol Engine (ICE)'))}
                            </span>` : `
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                Quick Setup
                            </span>`}
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${active_bike ? `Strict Net Take-Home Floor: <strong class="convertible-amount text-emerald-600 dark:text-emerald-400 font-bold" data-kes="${active_bike?.daily_target || strictNetFloor}">Ksh ${(Number(active_bike?.daily_target) || strictNetFloor).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong> (Required Gross: Ksh ${requiredGrossBeforeHome.toLocaleString()}) • Managed by ${active_bike?.owner_name || username}` : 'Register your car (Uber/Bolt), motorbike or electric EV below to start tracking shifts & finance.'}</p>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <button type="button" onclick="document.getElementById('add-bike-form-container').classList.toggle('hidden')" class="px-3.5 py-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95">
                        <span>➕ Register Vehicle (Car / Bike / EV)</span>
                    </button>
                </div>
            </div>

            <!-- Add Vehicle Collapsible Form -->
            <div id="add-bike-form-container" class="${bikes.length === 0 ? '' : 'hidden'} p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                <h3 class="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">Register Car (Uber / Bolt / Taxi), Motorbike or Electric EV to Fleet</h3>
                <form action="/bikes/create" method="POST" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Plate Number</label>
                        <input type="text" name="plate_number" placeholder="e.g. KDA 123B / KMEV 456C" required class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-900 rounded-xl text-base sm:text-sm font-bold uppercase">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Make / Model / Class</label>
                        <input type="text" name="model_name" placeholder="e.g. Toyota Vitz / Demio / Alto / Boxer 150" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-900 rounded-xl text-base sm:text-sm font-semibold">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Power System</label>
                        <select name="power_type" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-900 rounded-xl text-base sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            <option value="PETROL">⛽ Petrol (Vitz, Demio, Alto, Boxer, TVS)</option>
                            <option value="HYBRID">🔋 Hybrid (Aqua, Prius, Fielder, Note)</option>
                            <option value="DIESEL">🛢️ Diesel Engine (Probox, Commercial Van)</option>
                            <option value="ELECTRIC">⚡ Electric EV (Nissan Leaf, BYD, Spiro, Roam)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Strict Net Target After Expenses (<span class="curr-symbol-label">Ksh</span>)</label>
                        <input type="number" step="any" inputmode="decimal" name="daily_target" value="${strictNetFloor}" placeholder="1000.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-900 rounded-xl text-base sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 convertible-placeholder">
                    </div>
                    <div class="flex items-end">
                        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-xs">
                            Save to Fleet
                        </button>
                    </div>
                </form>
            </div>

            <!-- Fleet Switcher Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                ${bikes.length > 0 ? bikes.map((b: any) => `
                <div class="p-3.5 rounded-2xl border ${b.is_active ? 'bg-blue-50/60 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700' : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700'} flex justify-between items-center">
                    <div class="space-y-0.5">
                        <div class="flex items-center space-x-2">
                            <span class="font-black text-sm text-gray-900 dark:text-white font-mono">${b.plate_number}</span>
                            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${b.power_type === 'ELECTRIC' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : (b.power_type === 'HYBRID' ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300' : (b.power_type === 'DIESEL' ? 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300' : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'))}">
                                ${b.power_type === 'ELECTRIC' ? '⚡ EV' : (b.power_type === 'HYBRID' ? '🔋 Hybrid' : (b.power_type === 'DIESEL' ? '🛢️ Diesel' : '⛽ Petrol'))}
                            </span>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${b.model_name || 'Vehicle'} • Target: <strong class="convertible-amount font-bold text-gray-800 dark:text-gray-200" data-kes="${b.daily_target}">Ksh ${(Number(b.daily_target) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong></p>
                    </div>
                    <div class="flex items-center space-x-1.5">
                        ${b.is_active ? `
                        <span class="px-2.5 py-1 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-2xs">Active</span>
                        ` : `
                        <form action="/bikes/activate/${b.id}" method="POST">
                            <button type="submit" class="px-2.5 py-1 bg-white dark:bg-gray-700 hover:bg-gray-100 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl transition active:scale-95">
                                Select
                            </button>
                        </form>
                        `}
                        <form action="/bikes/delete/${b.id}" method="POST" onsubmit="return confirm('Remove vehicle ${b.plate_number} from fleet?');">
                            <button type="submit" title="Remove vehicle" class="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition active:scale-95">
                                🗑️
                            </button>
                        </form>
                    </div>
                </div>`).join('') : `
                <div class="col-span-full p-4 text-center rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-dashed border-gray-300 dark:border-gray-700">
                    <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">🚗 No vehicles in your fleet yet. Fill the registration form above to add your first ride-hailing car, motorbike, or electric EV.</p>
                </div>
                `}
            </div>
        </div>

        <!-- ⚡ EV vs. Petrol Cost-Savings & ROI Comparator Banner -->
        <div id="ev-savings-card" class="bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 p-6 rounded-3xl text-white shadow-lg border border-teal-800/50 space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-teal-800/60 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-teal-600 flex items-center justify-center text-xl shadow-md shrink-0">
                        ⚡
                    </div>
                    <div>
                        <h2 class="text-base font-bold text-white flex items-center gap-2">
                            <span>EV vs. Petrol Cost-Savings & ROI Comparator</span>
                            <span class="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">${ev_roi_stats.savingsPercentage}% Cheaper</span>
                        </h2>
                        <p class="text-xs text-teal-200">Real-time savings comparing actual battery swap / fuel spend against petrol baseline</p>
                    </div>
                </div>
            </div>

            <!-- Savings Metrics Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="p-3.5 bg-slate-950/80 border border-teal-900/60 rounded-xl">
                    <p class="text-[10px] text-teal-300 uppercase tracking-wider font-semibold">Total Distance</p>
                    <p class="text-xl font-black text-white mt-0.5">${formatNum(ev_roi_stats.totalKm)} <span class="text-xs font-normal text-gray-400">km</span></p>
                    <p class="text-[10px] text-gray-400">EV: ${formatNum(ev_roi_stats.evKm)} km • Petrol: ${formatNum(ev_roi_stats.petrolKm)} km</p>
                </div>

                <div class="p-3.5 bg-slate-950/80 border border-teal-900/60 rounded-xl">
                    <p class="text-[10px] text-teal-300 uppercase tracking-wider font-semibold">Net Shillings Saved</p>
                    <p class="text-xl font-black text-emerald-400 mt-0.5 convertible-amount" data-kes="${ev_roi_stats.netSavingsKes}">${formatKes(ev_roi_stats.netSavingsKes)}</p>
                    <p class="text-[10px] text-emerald-300">vs. pure petrol baseline</p>
                </div>

                <div class="p-3.5 bg-slate-950/80 border border-teal-900/60 rounded-xl">
                    <p class="text-[10px] text-teal-300 uppercase tracking-wider font-semibold">Unit Running Cost</p>
                    <p class="text-xl font-black text-cyan-300 mt-0.5">Ksh ${ev_roi_stats.costPerKmEv.toFixed(2)} <span class="text-xs font-normal text-gray-400">/ km</span></p>
                    <p class="text-[10px] text-gray-400">Petrol avg: Ksh ${ev_roi_stats.costPerKmPetrol.toFixed(2)}/km</p>
                </div>

                <div class="p-3.5 bg-slate-950/80 border border-teal-900/60 rounded-xl">
                    <p class="text-[10px] text-teal-300 uppercase tracking-wider font-semibold">🍃 CO2 Offset</p>
                    <p class="text-xl font-black text-emerald-300 mt-0.5">${formatNum(ev_roi_stats.co2SavedKg)} <span class="text-xs font-normal text-gray-400">kg</span></p>
                    <p class="text-[10px] text-gray-400">Clean energy reduction</p>
                </div>
            </div>
        </div>

        <!-- ⏰ Shift & Time Intelligence KPI Banner -->
        <div id="intelligence-card" class="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-lg border border-blue-800/40 space-y-4">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-blue-800/60 pb-3">
                <div>
                    <h2 class="text-xl font-black flex items-center gap-2">
                        <span>⏰ Shift & Time Working Intelligence</span>
                        <span class="text-xs bg-blue-500/30 text-blue-200 border border-blue-400/40 px-2.5 py-0.5 rounded-full font-bold">Weekly & Monthly Analytics</span>
                    </h2>
                    <p class="text-xs text-blue-200 mt-0.5">Analyze which shift hours, days of the week, and peak windows generate your highest hourly rates.</p>
                </div>
                <div class="flex items-center space-x-2">
                    ${lastShift ? `
                    <button type="button" onclick="shareStintWhatsApp('${lastShift.date}', '${lastShift.start_time || '11:00'}', '${lastShift.end_time || '22:00'}', ${lastShift.shift_hours || 8}, ${lastShift.trips_completed || 0}, ${lastShift.total_earned || 0}, ${lastShift.fuel_cost || 0}, ${lastShift.food_spent || 0}, ${lastShift.airtime_spent || 0}, ${lastShift.misc_expenses || 0}, ${lastShiftNet}, '${lastShift.power_type || activePowerType}', '${active_bike ? active_bike.plate_number : ''}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 rounded-xl text-xs font-bold text-white transition flex items-center space-x-1.5 shadow-sm active:scale-95" title="Share last shift to WhatsApp">
                        <span>📲 Share to WhatsApp</span>
                    </button>
                    ` : ''}
                    <a href="/rider/export/csv" class="px-3 py-1.5 bg-blue-800/70 hover:bg-blue-700 border border-blue-600 rounded-xl text-xs font-bold transition flex items-center space-x-1">
                        <span>📥 Export Shift CSV</span>
                    </a>
                </div>
            </div>

            <!-- KPI Cards Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="p-4 bg-slate-950/70 border border-blue-900/60 rounded-2xl">
                    <p class="text-[10px] text-blue-300 font-bold uppercase tracking-wider">⚡ Gross Hourly Rate</p>
                    <p class="text-2xl font-black text-emerald-400 mt-1"><span class="convertible-amount" data-kes="${ti.overall_avg_gross_hourly || 0}">Ksh ${(Number(ti.overall_avg_gross_hourly) || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span> <span class="text-xs font-normal text-gray-400">/ hr</span></p>
                    <p class="text-[10px] text-gray-400 mt-0.5">Overall gross yield per active hour</p>
                </div>

                <div class="p-4 bg-slate-950/70 border border-blue-900/60 rounded-2xl">
                    <p class="text-[10px] text-blue-300 font-bold uppercase tracking-wider">💵 Net Hourly Take-Home</p>
                    <p class="text-2xl font-black text-cyan-400 mt-1"><span class="convertible-amount" data-kes="${ti.overall_avg_net_hourly || 0}">Ksh ${(Number(ti.overall_avg_net_hourly) || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span> <span class="text-xs font-normal text-gray-400">/ hr</span></p>
                    <p class="text-[10px] text-gray-400 mt-0.5">After fuel/swaps, lunch & upkeep</p>
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
            <div id="time-tab-windows" class="time-tab-content grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
                ${(ti.time_window_analysis || []).map((w: any) => `
                <div class="p-3 bg-slate-950/80 border border-blue-900/50 rounded-2xl space-y-1.5 flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-center text-xs">
                            <span class="font-bold text-blue-200">${w.window_label}</span>
                            <span class="text-[10px] px-1.5 py-0.5 bg-blue-900/60 rounded text-blue-300 font-semibold">${w.share_pct}%</span>
                        </div>
                        <p class="text-lg font-black text-emerald-400 mt-1"><span class="convertible-amount" data-kes="${w.gross_hourly || 0}">Ksh ${(Number(w.gross_hourly) || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span> <span class="text-xs font-normal text-gray-400">/ hr</span></p>
                    </div>
                    <p class="text-[11px] text-gray-400 pt-1 border-t border-blue-900/40">Net: <strong class="text-cyan-300 convertible-amount" data-kes="${w.net_hourly || 0}">Ksh ${(Number(w.net_hourly) || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>/hr • ${w.shifts_count} sessions</p>
                </div>`).join('')}
            </div>

            <!-- ⚡ Quick Stint & Session Yield Analyzer -->
            <div class="p-4 bg-slate-950/80 border border-blue-800/50 rounded-2xl space-y-3 pt-3">
                <div class="flex justify-between items-center text-xs">
                    <span class="font-bold text-blue-200">⚡ Live Stint Yield Analyzer (e.g. 11am – 2pm vs 2:13pm – 5pm)</span>
                    <span class="text-[10px] text-gray-400">Calculate any session on Uber / Bolt</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                    <div>
                        <label class="block text-[10px] text-gray-400 mb-0.5">Start Time</label>
                        <input type="time" id="sim_stint_start" value="11:00" onchange="calcSimStintYield()" class="w-full p-2 bg-slate-900 border border-blue-900 rounded-xl text-xs font-bold text-white">
                    </div>
                    <div>
                        <label class="block text-[10px] text-gray-400 mb-0.5">End Time</label>
                        <input type="time" id="sim_stint_end" value="14:00" onchange="calcSimStintYield()" class="w-full p-2 bg-slate-900 border border-blue-900 rounded-xl text-xs font-bold text-white">
                    </div>
                    <div>
                        <label class="block text-[10px] text-gray-400 mb-0.5">Earned (<span class="curr-symbol-label">Ksh</span>)</label>
                        <input type="number" step="any" id="sim_stint_earned" placeholder="e.g. 600" oninput="calcSimStintYield()" class="w-full p-2 bg-slate-900 border border-blue-900 rounded-xl text-xs font-bold text-emerald-400">
                    </div>
                    <div class="p-2.5 bg-blue-950/60 border border-blue-800/60 rounded-xl text-center">
                        <p class="text-[10px] text-blue-300 uppercase font-semibold">Calculated Yield</p>
                        <p class="text-base font-black text-cyan-300" id="sim_stint_result">Ksh 0.00 / hr (3.0h)</p>
                    </div>
                </div>
            </div>

            <!-- Days Tab Content -->
            <div id="time-tab-days" class="time-tab-content hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                ${(ti.day_analysis || []).map((d: any) => `
                <div class="p-3.5 bg-slate-950/80 border border-blue-900/50 rounded-2xl space-y-1.5">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-bold text-blue-200">${d.day_name}</span>
                        ${d.is_best ? `<span class="text-[10px] px-2 py-0.5 bg-amber-500/40 text-amber-200 border border-amber-400/40 rounded-full font-bold">🏆 Top Day</span>` : ''}
                    </div>
                    <p class="text-base font-black text-emerald-400"><span class="convertible-amount" data-kes="${d.avg_earned || 0}">Ksh ${(Number(d.avg_earned) || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span> <span class="text-xs font-normal text-gray-400">/ shift</span></p>
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
                        <span>Gross: <strong class="text-emerald-400 convertible-amount" data-kes="${wk.gross || 0}">Ksh ${(Number(wk.gross) || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></span>
                        <span>Net: <strong class="text-cyan-400 convertible-amount" data-kes="${wk.net || 0}">Ksh ${(Number(wk.net) || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></span>
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
                        <span>Net Remittance: <strong class="text-emerald-400 convertible-amount" data-kes="${m.net || 0}">Ksh ${(Number(m.net) || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></span>
                        <span>Efficiency: <strong class="text-indigo-300 convertible-amount" data-kes="${m.avg_hourly || 0}">Ksh ${(Number(m.avg_hourly) || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>/hr</span>
                    </div>
                </div>`).join('')}
            </div>
        </div>

        <!-- ⏱️ Log Daily Shift Card (Dynamic EV & ICE Adaptation) -->
        <div id="shift-log-card" class="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b dark:border-gray-800 pb-3">
                <div>
                    <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>Log Rider Shift & Exact Working Window</span>
                    </h2>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Fields dynamically adapt whether you ride an Electric EV (battery swap) or Petrol motorbike.</p>
                </div>

                <!-- 1-Tap Power Type Switcher Pills -->
                <div class="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <button type="button" onclick="setPowerType('PETROL')" id="btn-power-petrol" class="px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 ${activePowerType === 'PETROL' ? 'bg-amber-600 text-white shadow-xs' : 'text-gray-700 dark:text-gray-300'}">
                        ⛽ Petrol Engine
                    </button>
                    <button type="button" onclick="setPowerType('ELECTRIC')" id="btn-power-electric" class="px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 ${activePowerType === 'ELECTRIC' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-700 dark:text-gray-300'}">
                        🔋 Electric (EV)
                    </button>
                </div>
            </div>

            <form action="/rider/logs" method="POST" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <input type="hidden" name="power_type" id="input_power_type" value="${activePowerType}">

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Assigned Fleet Bike</label>
                    <select name="bike_id" onchange="onBikeSelectChanged(this.value)" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-bold">
                        ${bikes.length > 0 ? bikes.map((b: any) => `<option value="${b.id}" ${b.is_active ? 'selected' : ''}>${b.plate_number} (${b.model_name || 'Bike'}) - ${b.power_type === 'ELECTRIC' ? '⚡ EV' : '⛽ ICE'}</option>`).join('') : '<option value="">-- No Vehicle (Register Above) --</option>'}
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Shift Date</label>
                    <input type="date" name="date" value="${today}" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-semibold" required>
                </div>

                <!-- Shift Start & End Times -->
                <div class="sm:col-span-2 space-y-1.5">
                    <div class="flex justify-between items-center">
                        <label class="block text-xs font-bold text-blue-600 dark:text-blue-400">⏰ Working Shift Hours</label>
                        <span id="shift-duration-badge" class="text-[11px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-md">⏱️ 11.0 hrs</span>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <input type="time" name="start_time" id="input_start_time" value="11:00" onchange="calcDuration()" class="p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-bold" required>
                        <input type="time" name="end_time" id="input_end_time" value="22:00" onchange="calcDuration()" class="p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-bold" required>
                    </div>
                    <input type="hidden" name="shift_hours" id="input_shift_hours" value="11.0">
                    <div class="flex flex-wrap gap-1.5 pt-1">
                        <button type="button" onclick="setShiftPreset('11:00', '22:00')" class="text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 active:scale-95 border border-blue-200 dark:border-blue-800 px-2 py-1 rounded-lg font-semibold transition">☀️ 11am – 10pm (11h)</button>
                        <button type="button" onclick="setShiftPreset('06:00', '14:00')" class="text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 active:scale-95 border border-blue-200 dark:border-blue-800 px-2 py-1 rounded-lg font-semibold transition">🌅 6am – 2pm (8h)</button>
                        <button type="button" onclick="setShiftPreset('14:00', '23:00')" class="text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 active:scale-95 border border-blue-200 dark:border-blue-800 px-2 py-1 rounded-lg font-semibold transition">🌆 2pm – 11pm (9h)</button>
                        <button type="button" onclick="setShiftPreset('20:00', '04:00')" class="text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 active:scale-95 border border-blue-200 dark:border-blue-800 px-2 py-1 rounded-lg font-semibold transition">🌙 8pm – 4am (8h)</button>
                    </div>
                </div>

                <!-- ⚡ Optional Online Stints / Multi-Session Splitter (Uber / Bolt) -->
                <details class="sm:col-span-2 lg:col-span-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 dark:from-blue-950/50 dark:via-indigo-950/30 dark:to-blue-950/50 p-4 sm:p-5 rounded-2xl border border-blue-300 dark:border-blue-800/80 space-y-3.5 shadow-xs">
                    <summary class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer list-none select-none">
                        <div class="space-y-1">
                            <div class="flex items-center space-x-2">
                                <span class="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-wider shadow-xs">MULTI-SESSION STINTS (OPTIONAL)</span>
                                <h3 class="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                                    <span>⚡ Multi-Session Online Stints (Uber / Bolt / Glovo)</span>
                                </h3>
                            </div>
                            <p class="text-[11px] text-gray-600 dark:text-gray-300">Took a break between sessions? Click "➕ Add Stint" to log each session separately.</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="event.stopPropagation(); this.closest('details').open = true; addStintRow();" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs shrink-0 cursor-pointer">
                                <span>➕ Add Stint</span>
                            </button>
                            <button type="button" onclick="event.stopPropagation(); clearAllStints();" class="px-3 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 active:scale-95 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer" title="Clear stints">
                                <span>Reset</span>
                            </button>
                        </div>
                    </summary>

                    <!-- Hidden input to transmit stints JSON -->
                    <input type="hidden" name="stints_json" id="stints_json_input" value="">

                    <!-- Stints Container (Starts empty — no dummy data) -->
                    <div id="stints-builder-container" class="space-y-2.5 pt-3 border-t border-blue-200 dark:border-blue-900/60">
                        <div id="stints-list" class="space-y-2"></div>

                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 border-t border-blue-200/60 dark:border-gray-800 text-xs">
                            <button type="button" onclick="addStintRow()" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl transition shadow-xs flex items-center gap-1 text-xs cursor-pointer">
                                <span>➕ Add Session</span>
                            </button>
                            <div class="text-xs font-bold text-gray-700 dark:text-gray-300 bg-white/80 dark:bg-gray-900/80 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900">
                                Total Sessions: <span id="stints-summary-hours" class="text-blue-600 dark:text-blue-400 font-black">0.0 hrs</span> • Gross: <span id="stints-summary-earned" class="text-emerald-600 dark:text-emerald-400 font-extrabold">Ksh 0.00</span>
                            </div>
                        </div>
                    </div>
                </details>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Total Earned (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" inputmode="decimal" name="total_earned" oninput="updateStrictSaverAudit()" placeholder="e.g. ${requiredGrossBeforeHome.toFixed(0)}" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-bold text-emerald-600 dark:text-emerald-400" required>
                </div>

                <!-- Dynamic Station Select -->
                <div>
                    <label id="station-field-label" class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        ${activePowerType === 'ELECTRIC' ? '🔋 EV Battery Swap Station' : '⛽ Petrol Station'}
                    </label>
                    <select name="fuel_station" id="fuel_station_select" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-medium">
                        ${activePowerType === 'ELECTRIC' ? `
                        <option value="SPIRO">Spiro Swap Station</option>
                        <option value="ROAM">Roam Hub / Station</option>
                        <option value="AMPERSAND">Ampersand Swap Point</option>
                        <option value="KIRI">Kiri EV Hub</option>
                        <option value="ARC_RIDE">ARC Ride Station</option>
                        <option value="BASIGO">BasiGo Hub</option>
                        <option value="OTHER">Other EV Network</option>
                        ` : `
                        <option value="RUBIS">Rubis Energy</option>
                        <option value="TOTAL">TotalEnergies</option>
                        <option value="SHELL">Shell / Vivo</option>
                        <option value="OLA">Ola Energy</option>
                        <option value="HASS">Hass Petroleum</option>
                        <option value="OTHER">Other Station</option>
                        `}
                    </select>
                </div>

                <!-- Dynamic Cost Label -->
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label id="energy-cost-label" class="block text-xs font-semibold text-gray-600 dark:text-gray-400">
                            ${activePowerType === 'ELECTRIC' ? '🔋 Battery Swap Cost (<span class="curr-symbol-label">Ksh</span>)' : '⛽ Fuel & Petrol Cost (<span class="curr-symbol-label">Ksh</span>)'}
                        </label>
                        <button type="button" onclick="document.getElementById('shift_fuel_cost_input').value=String(STRICT_FUEL_ALLOWANCE); onShiftKmOrFuelInput();" class="px-2 py-0.5 bg-cyan-50 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 rounded-md text-[10px] font-bold hover:bg-cyan-100 transition">
                            ⛽ Ksh ${strictFuelAllowance}
                        </button>
                    </div>
                    <input type="number" step="any" inputmode="decimal" id="shift_fuel_cost_input" name="fuel_cost" value="${strictFuelAllowance}" oninput="onShiftKmOrFuelInput()" placeholder="${strictFuelAllowance}" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-semibold">
                </div>

                <!-- Dynamic Metric (Litres vs Swaps Count) -->
                <div id="metric-field-container">
                    ${activePowerType === 'ELECTRIC' ? `
                    <label class="block text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">🔋 Swaps Count</label>
                    <input type="number" step="1" min="0" inputmode="numeric" name="swaps_count" value="1" placeholder="e.g. 2 swaps" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    ` : `
                    <label class="block text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">⛽ Fuel Litres (Optional)</label>
                    <input type="number" step="any" inputmode="decimal" name="fuel_litres" placeholder="0.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm">
                    `}
                </div>

                <div>
                    <div class="flex items-center justify-between gap-1 mb-1">
                        <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400">🍲 Food / Lunch (<span class="curr-symbol-label">Ksh</span>)</label>
                        <div class="flex items-center gap-1">
                            <button type="button" onclick="setShiftLunchMode(true)" class="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-md text-[10px] font-extrabold hover:bg-emerald-100 transition" title="Left home around 12 PM already fed — lock Ksh ${strictLunchAllowance} lunch into savings!">
                                🏠 Ate at Home (0 → Save +${strictLunchAllowance})
                            </button>
                            <button type="button" onclick="setShiftLunchMode(false)" class="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-md text-[10px] font-bold hover:bg-amber-100 transition">
                                🍲 ${strictLunchAllowance}
                            </button>
                        </div>
                    </div>
                    <input type="number" step="any" inputmode="decimal" name="food_spent" value="${strictLunchAllowance}" oninput="updateStrictSaverAudit()" placeholder="${strictLunchAllowance}" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-semibold">
                    <p id="shift-lunch-bonus-badge" class="mt-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                        🍲 Standard Lunch: Ksh ${strictLunchAllowance} (Click "🏠 Ate at Home" if you left at 12 PM fed to save +Ksh ${strictLunchAllowance}!)
                    </p>
                </div>

                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400">📱 Airtime &amp; Data (<span class="curr-symbol-label">Ksh</span>)</label>
                        <button type="button" onclick="document.querySelector('input[name=\\'airtime_spent\\']').value=String(STRICT_AIRTIME_ALLOWANCE); updateStrictSaverAudit();" class="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-md text-[10px] font-bold hover:bg-rose-100 transition">
                            📱 Ksh ${strictAirtimeAllowance}
                        </button>
                    </div>
                    <input type="number" step="any" inputmode="decimal" name="airtime_spent" value="${strictAirtimeAllowance}" oninput="updateStrictSaverAudit()" placeholder="${strictAirtimeAllowance}" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-semibold">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">🛠️ Daily Upkeep / Parking / Misc (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" inputmode="decimal" name="misc_expenses" oninput="updateStrictSaverAudit()" placeholder="0.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">📦 Trips Completed</label>
                    <input type="number" step="1" min="0" inputmode="numeric" name="trips_completed" placeholder="e.g. 15 trips" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 flex items-center justify-between">
                        <span>🚗 / 🛵 Kilometers Covered (KM)</span>
                        <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Syncs Odo & CPK</span>
                    </label>
                    <input type="number" step="any" inputmode="decimal" id="shift_km_input" name="kilometers" oninput="onShiftKmOrFuelInput()" placeholder="e.g. 85.5 km" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-bold text-indigo-600 dark:text-indigo-300">
                    <p id="shift-live-cpk-odo-preview" class="hidden mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"></p>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">🚖 Main Platform / Channel</label>
                    <select name="channel" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-medium">
                        <option value="ALL">All Platforms (Blended)</option>
                        <option value="UBER">🚗 Uber Car / Uber ChapChap</option>
                        <option value="BOLT">🚗 Bolt Car / Boda</option>
                        <option value="LITTLE">🚗 Little Cab</option>
                        <option value="FARAS">🚗 Faras</option>
                        <option value="INDRIVE">🚗 inDrive</option>
                        <option value="BODA">🛵 Boda Passenger / Delivery</option>
                        <option value="PRIVATE">💼 Private Clients / Offline Fares</option>
                    </select>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Target Account (Sync Income & Expenses)</label>
                    <select name="earnings_account_id" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-medium text-emerald-600">
                        <option value="">-- Don't Sync to Account --</option>
                        ${accounts.map((a: any) => `<option value="${a.id}" ${String(savingsAccountId) === String(a.id) ? 'selected' : ''}>${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                    </select>
                </div>

                <!-- 🛡️ Live Post-Shift Strict Saver Audit & Expected Account Balance Bar -->
                <div class="sm:col-span-2 lg:col-span-4 p-4 bg-slate-900 dark:bg-slate-950 border-2 border-indigo-600/60 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md">
                    <div class="space-y-1">
                        <p id="live-strict-net-verdict" class="text-xs font-extrabold text-indigo-300">
                            🎯 Strict Daily Contract: Ksh ${strictNetFloor.toLocaleString()} Net + Ksh ${strictFuelAllowance.toLocaleString()} Fuel + Ksh ${strictLunchAllowance.toLocaleString()} Lunch + Ksh ${strictAirtimeAllowance.toLocaleString()} Airtime • 🏦 Your ${savingsAccountName} currently reads: Ksh ${expectedSavingsAccountBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </p>
                        <p id="live-strict-cap-verdict" class="text-[11px] font-bold text-emerald-300">
                            🟢 Standard Shift Budget: Fuel Ksh ${strictFuelAllowance} • Lunch Ksh ${strictLunchAllowance} (or click "🏠 Ate at Home" to save +Ksh ${strictLunchAllowance}) • Airtime Ksh ${strictAirtimeAllowance}
                        </p>
                    </div>
                    <a id="live-strict-split-link" href="/?pay_yourself_amount=${closeoutSplitAmount.toFixed(2)}#waterfall-card" class="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black rounded-xl text-[11px] shrink-0 transition active:scale-95">
                        👑 23:50 Split Ksh ${closeoutSplitAmount.toLocaleString()} →
                    </a>
                </div>

                <div class="sm:col-span-2 lg:col-span-4">
                    <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2">
                        <span>🚀 Save Shift Record & Sync With Finance Ledger</span>
                    </button>
                </div>
            </form>
        </div>

        <!-- 🤝 Owner Remittance & Daily Lease Tracker (Kodi / Hire-Purchase) Card -->
        <div id="remittance-card" class="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 rounded-3xl p-6 shadow-sm border border-indigo-800/50 space-y-5 text-white">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-indigo-800/60 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-xl shadow-md">
                        🤝
                    </div>
                    <div>
                        <h2 class="text-lg font-bold flex items-center gap-2">
                            <span>Owner Remittance & Daily Lease Tracker (Kodi)</span>
                            <span class="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 px-2 py-0.5 rounded-full font-bold">Fleet Partnership</span>
                        </h2>
                        <p class="text-xs text-indigo-200/80">Track daily owner lease targets (Ksh 500/day bike, Ksh 1,500/day car) and hire-purchase progress.</p>
                    </div>
                </div>

                <button type="button" onclick="document.getElementById('new-financing-form-container')?.classList.toggle('hidden')" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5">
                    <span>➕ Configure Lease / Kodi</span>
                </button>
            </div>

            <!-- Configure Lease Form (Collapsible) -->
            <div id="new-financing-form-container" class="hidden p-4 bg-slate-950/80 rounded-2xl border border-indigo-800/60 space-y-3">
                <form action="/rider/financing/create" method="POST" class="space-y-3 text-xs">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label class="block font-bold text-gray-300 mb-1">Owner / Provider Name</label>
                            <input type="text" name="provider_name" placeholder="e.g. Mzee Mwangi (Owner) or Watu Credit" value="Owner Remittance" class="w-full p-2 bg-slate-900 border border-indigo-800 rounded-xl font-bold text-white" required>
                        </div>
                        <div>
                            <label class="block font-bold text-gray-300 mb-1">Daily Target / Kodi (<span class="curr-symbol-label">Ksh</span>)</label>
                            <input type="number" step="any" inputmode="decimal" name="daily_amount" placeholder="e.g. 500 (boda) or 1500 (car)" value="500" class="w-full p-2 bg-slate-900 border border-indigo-800 rounded-xl font-black text-emerald-400" required>
                        </div>
                        <div>
                            <label class="block font-bold text-gray-300 mb-1">Total Lease / Hire-Purchase (<span class="curr-symbol-label">Ksh</span>)</label>
                            <input type="number" step="any" inputmode="decimal" name="total_cost" placeholder="e.g. 180000" value="180000" class="w-full p-2 bg-slate-900 border border-indigo-800 rounded-xl font-bold text-white">
                        </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block font-bold text-gray-300 mb-1">Vehicle</label>
                            <select name="bike_id" class="w-full p-2 bg-slate-900 border border-indigo-800 rounded-xl font-semibold text-white">
                                ${bikes.map((b: any) => `<option value="${b.id}">${b.plate_number} (${b.model_name || 'Vehicle'})</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold text-gray-300 mb-1">Notes / Terms</label>
                            <input type="text" name="notes" placeholder="e.g. Due every night by 23:50 via M-Pesa" value="Daily kodi due by 23:50 to vehicle owner" class="w-full p-2 bg-slate-900 border border-indigo-800 rounded-xl font-medium text-white">
                        </div>
                    </div>
                    <div class="flex justify-end gap-2 pt-1">
                        <button type="button" onclick="document.getElementById('new-financing-form-container')?.classList.add('hidden')" class="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg">Cancel</button>
                        <button type="submit" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-lg text-white">Save Lease Target</button>
                    </div>
                </form>
            </div>

            <!-- Active Lease / Kodi Displays -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Daily Kodi Status Card -->
                <div class="p-4 bg-slate-950/70 border border-indigo-900/60 rounded-2xl space-y-3">
                    <div class="flex justify-between items-center text-xs">
                        <span class="font-bold text-indigo-300">Today's Remittance Status</span>
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black ${todayNetEarned >= dailyTarget ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}">
                            ${todayNetEarned >= dailyTarget ? '✅ Target Met' : '⏳ In Progress'}
                        </span>
                    </div>
                    <div class="flex justify-between items-baseline">
                        <div>
                            <p class="text-[10px] text-gray-400 uppercase">Today's Net Take-Home</p>
                            <p class="text-2xl font-black text-cyan-400">Ksh ${todayNetEarned.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[10px] text-gray-400 uppercase">Target Kodi</p>
                            <p class="text-sm font-bold text-gray-300">Ksh ${dailyTarget.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                        </div>
                    </div>
                    <div class="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-indigo-950">
                        <div class="h-full rounded-full transition-all duration-300 ${todayNetEarned >= dailyTarget ? 'bg-emerald-500' : 'bg-cyan-500'}" style="width: ${dailyTargetMetPct}%"></div>
                    </div>
                    <p class="text-[11px] text-gray-400">
                        ${todayNetEarned >= dailyTarget ? '🎉 You have covered your daily owner lease and generated profit!' : `Ksh ${(Math.max(0, dailyTarget - todayNetEarned)).toLocaleString(undefined, {minimumFractionDigits: 2})} remaining to clear owner remittance.`}
                    </p>
                    <div class="pt-2 border-t border-indigo-900/50 flex flex-wrap items-center justify-between gap-2">
                        <span class="text-[10px] font-bold text-amber-300">👑 23:50 Shift Closeout: Don't sleep with unsplit cash in M-Pesa</span>
                        <a href="/?pay_yourself_amount=${closeoutSplitAmount.toFixed(2)}#waterfall-card" class="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 text-slate-950 font-black rounded-xl text-[11px] transition shadow-sm active:scale-95">
                            🌊 Pay Yourself First (Split Ksh ${closeoutSplitAmount.toLocaleString()}) →
                        </a>
                    </div>
                </div>

                <!-- Hire-Purchase / Financing Cards List -->
                ${bike_financings.length > 0 ? bike_financings.map((f: any) => {
                    const tot = Number(f.total_cost || 1);
                    const pd = Number(f.paid_amount || 0);
                    const pct = Math.min(100, Math.round((pd / tot) * 100));
                    const rem = Math.max(0, tot - pd);
                    return `
                    <div class="p-4 bg-slate-950/70 border border-indigo-900/60 rounded-2xl space-y-3 flex flex-col justify-between">
                        <div class="space-y-2">
                            <div class="flex justify-between items-start">
                                <div>
                                    <h4 class="font-bold text-sm text-white">${f.provider_name}</h4>
                                    <span class="text-[10px] text-indigo-300">Target: Ksh ${Number(f.daily_amount || 500).toLocaleString()}/day</span>
                                </div>
                                <span class="text-[10px] font-black px-2 py-0.5 rounded-full ${pct >= 100 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300'}">
                                    ${pct}% Paid
                                </span>
                            </div>
                            <div class="flex justify-between text-xs pt-1">
                                <span class="text-gray-400">Paid: <strong class="text-emerald-400 font-mono">Ksh ${pd.toLocaleString()}</strong></span>
                                <span class="text-gray-400">Rem: <strong class="text-amber-400 font-mono">Ksh ${rem.toLocaleString()}</strong></span>
                            </div>
                            <div class="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                                <div class="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500" style="width: ${pct}%"></div>
                            </div>
                        </div>

                        <form action="/rider/financing/pay/${f.id}" method="POST" class="flex gap-2 pt-2 border-t border-indigo-950">
                            <input type="number" step="any" name="amount" value="${f.daily_amount || 500}" class="w-24 p-1 bg-slate-900 border border-indigo-800 rounded-lg text-xs font-bold text-white text-center">
                            <button type="submit" class="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition active:scale-95 shadow-xs">
                                💳 Log Kodi Remittance
                            </button>
                        </form>
                    </div>`;
                }).join('') : `
                <div class="p-4 bg-slate-950/40 border border-dashed border-indigo-900/60 rounded-2xl flex flex-col items-center justify-center text-center space-y-1">
                    <p class="text-xl">🤝</p>
                    <p class="text-xs font-bold text-indigo-200">No Hire-Purchase / Long-term Lease Configured</p>
                    <p class="text-[11px] text-gray-400">Click "➕ Configure Lease / Kodi" above if you are on a daily lease or hire-purchase agreement.</p>
                </div>`}
            </div>
        </div>

        <!-- 🛠️ Vehicle Maintenance & Service Log System -->
        <div id="maint-card" class="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-5">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b dark:border-gray-800 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xl shadow-xs">
                        🛠️
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>Vehicle Maintenance & Fleet Health (Car & Boda)</span>
                            <span class="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">Fleet Health</span>
                        </h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Record oil changes, brake pads, spark plugs, mechanic labor, and track cost per kilometer (CPK).</p>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <button type="button" onclick="toggleMaintDrawer()" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5">
                        <span>➕ Log Service / Repair</span>
                    </button>
                </div>
            </div>

            <!-- 🚗 Odometer, CPK & Service Interval Tracker Box (Synced with Daily Shift Logger) -->
            <form action="/rider/odometer/update" method="POST" class="p-4 bg-slate-900 text-white rounded-2xl border border-indigo-900/60 space-y-3">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div class="flex items-center space-x-2">
                        <span class="text-xl">🚗</span>
                        <div>
                            <div class="flex flex-wrap items-center gap-2">
                                <h3 class="font-bold text-sm text-indigo-200">Odometer, Service Countdown & Real CPK</h3>
                                <span id="odo_shift_km_total_badge" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                                    +${totalKmCovered.toLocaleString()} km logged in ${shiftsWithKmCount} shift${shiftsWithKmCount === 1 ? '' : 's'}
                                </span>
                            </div>
                            <p class="text-[11px] text-gray-400">Auto-increments from Daily Shift <strong class="text-indigo-300">Kilometers Covered (KM)</strong> & calculates real fuel + maintenance CPK</p>
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <span id="odo_service_badge" class="px-2.5 py-1 rounded-full text-xs font-black ${remainingServiceKm <= 0 ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 animate-pulse' : remainingServiceKm <= 500 ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300'}">
                            ${remainingServiceKm <= 0 ? `🚨 Overdue by ${Math.abs(remainingServiceKm).toLocaleString()} km!` : remainingServiceKm <= 500 ? `⚠️ Service Soon (${remainingServiceKm.toLocaleString()} km left)` : `✅ In Good Standing (${remainingServiceKm.toLocaleString()} km left)`}
                        </span>
                    </div>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div class="p-2.5 bg-slate-950/80 rounded-xl border border-indigo-950 space-y-1">
                        <div class="flex items-center justify-between">
                            <label class="block text-[10px] text-gray-400">Current Odometer (km)</label>
                            <span class="text-[9px] text-emerald-400 font-bold">Base ${baseOdometer.toLocaleString()} + ${totalKmCovered.toLocaleString()} km</span>
                        </div>
                        <input type="number" step="any" name="current_odometer" id="current_odometer_input" value="${currentOdometer}" oninput="calcOdometerServiceStatus(true)" class="w-full p-1.5 bg-slate-900 border border-indigo-800 rounded-lg font-black text-emerald-400 text-sm">
                        <p class="text-[9px] text-gray-400">Driven since service: <strong id="km_since_service_display" class="text-emerald-300">${kmSinceLastService.toLocaleString()} km</strong></p>
                    </div>
                    <div class="p-2.5 bg-slate-950/80 rounded-xl border border-indigo-950 space-y-1">
                        <label class="block text-[10px] text-gray-400">Last Service Odometer (km)</label>
                        <input type="number" step="any" name="last_service_odo" id="last_service_odo_input" value="${lastServiceOdo}" oninput="calcOdometerServiceStatus(false)" class="w-full p-1.5 bg-slate-900 border border-indigo-800 rounded-lg font-black text-white text-sm">
                        <button type="button" onclick="syncOdoFromLastService()" class="text-[9px] text-indigo-300 hover:text-indigo-200 underline font-semibold text-left">
                            🔄 Set Current = Last Service + Shift KM
                        </button>
                    </div>
                    <div class="p-2.5 bg-slate-950/80 rounded-xl border border-indigo-950 space-y-1">
                        <label class="block text-[10px] text-gray-400">Service Interval</label>
                        <select name="service_interval_km" id="service_interval_km_select" onchange="calcOdometerServiceStatus(false)" class="w-full p-1.5 bg-slate-900 border border-indigo-800 rounded-lg font-bold text-white text-xs">
                            <option value="2000" ${serviceIntervalKm === 2000 ? 'selected' : ''}>2,000 km (Heavy Boda / Boxer)</option>
                            <option value="2500" ${serviceIntervalKm === 2500 ? 'selected' : ''}>2,500 km (Boda / Heavy Delivery)</option>
                            <option value="3000" ${serviceIntervalKm === 3000 ? 'selected' : ''}>3,000 km (Motorbike Standard)</option>
                            <option value="5000" ${serviceIntervalKm === 5000 ? 'selected' : ''}>5,000 km (Uber / Bolt Petrol Car)</option>
                            <option value="10000" ${serviceIntervalKm === 10000 ? 'selected' : ''}>10,000 km (Synthetic Oil / Major Service)</option>
                        </select>
                        <p class="text-[9px] text-gray-400">Next due at: <strong id="next_service_odo_display" class="text-indigo-200">${nextServiceOdo.toLocaleString()} km</strong></p>
                    </div>
                    <div class="p-2.5 bg-slate-950/80 rounded-xl border border-indigo-950 flex flex-col justify-between">
                        <div>
                            <div class="flex items-center justify-between">
                                <p class="text-[10px] text-indigo-300 font-bold uppercase">⛽ Real CPK</p>
                                <span class="text-[9px] text-cyan-300 font-semibold">${totalKmCovered > 0 ? `${totalKmCovered.toLocaleString()} km shifts` : 'Shift-synced'}</span>
                            </div>
                            <p id="real_cpk_display" class="text-base font-black text-cyan-400 mt-0.5">Ksh ${overallCpk} <span class="text-[10px] text-gray-400 font-normal">/ km</span></p>
                            <p id="real_all_in_cpk_display" class="text-[9px] text-gray-400">All-in (Fuel+Maint): Ksh ${allInCpk}/km</p>
                        </div>
                        <div class="pt-1.5 flex items-center justify-between gap-1.5">
                            <span class="text-[9px] text-gray-400">Fuel: Ksh ${totalFuelExp.toLocaleString()}</span>
                            <button type="submit" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-lg text-[10px] transition shadow-xs">
                                💾 Save Odometer
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            <!-- ➕ Log Service & Repair Collapsible Form -->
            <div id="maint-log-form-container" class="hidden bg-indigo-50/40 dark:bg-indigo-950/30 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900 shadow-md space-y-4">
                <div class="flex justify-between items-center border-b border-indigo-100 dark:border-indigo-900/60 pb-2">
                    <h3 class="text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                        <span>🔧 Record Bike Service & Maintenance Details</span>
                    </h3>
                    <button type="button" onclick="toggleMaintDrawer()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">✕</button>
                </div>

                <form action="/rider/maintenance/log" method="POST" class="space-y-4">
                    <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Service Date</label>
                            <input type="date" name="service_date" value="${today}" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-900 rounded-xl text-xs font-semibold" required>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Vehicle / Bike</label>
                            <select name="bike_id" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-900 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                ${bikes.length > 0 ? bikes.map((b: any) => `<option value="${b.id}" ${b.is_active ? 'selected' : ''}>${b.plate_number} (${b.model_name || 'Bike'})</option>`).join('') : '<option value="">-- No Vehicle Selected --</option>'}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Odometer at Service (km)</label>
                            <input type="number" step="any" id="service_odometer_form_input" name="service_odometer" value="${currentOdometer}" oninput="this.dataset.touched='1'" placeholder="e.g. 12450" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-900 rounded-xl text-xs font-black text-emerald-600 dark:text-emerald-400">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Service Summary Title</label>
                            <input type="text" id="service_type_input" name="service_type" value="Oil Change, Brake Pads & Labor Service" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-900 rounded-xl text-xs font-bold" required>
                        </div>
                    </div>

                    <!-- Itemized Cost Breakdown -->
                    <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/60 space-y-3">
                        <div class="flex justify-between items-center">
                            <span class="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Itemized Costs (<span class="curr-symbol-label">Ksh</span>)</span>
                            <span class="text-xs text-gray-400">Leave 0 if not replaced / inspected & good</span>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                            <div>
                                <label id="label_item_1" class="block font-semibold text-gray-600 dark:text-gray-400 mb-1">🛢️ Engine Oil & Filter</label>
                                <input type="number" step="any" inputmode="decimal" id="service_oil_cost" name="oil_cost" placeholder="e.g. 500" oninput="calcServiceTotal()" class="w-full p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-lg font-bold">
                            </div>
                            <div>
                                <label id="label_item_2" class="block font-semibold text-gray-600 dark:text-gray-400 mb-1">🛑 Brake Pads / Shoes</label>
                                <input type="number" step="any" inputmode="decimal" id="service_brake_pad_cost" name="brake_pad_cost" placeholder="e.g. 350" oninput="calcServiceTotal()" class="w-full p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-lg font-bold">
                            </div>
                            <div>
                                <label id="label_item_3" class="block font-semibold text-gray-600 dark:text-gray-400 mb-1">⚡ Spark Plug (0 if OK)</label>
                                <input type="number" step="any" inputmode="decimal" id="service_spark_plug_cost" name="spark_plug_cost" placeholder="0" oninput="calcServiceTotal()" class="w-full p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-lg font-bold">
                            </div>
                            <div>
                                <label id="label_item_4" class="block font-semibold text-gray-600 dark:text-gray-400 mb-1">👨‍🔧 Mechanic Labor Fee</label>
                                <input type="number" step="any" inputmode="decimal" id="service_labor_cost" name="labor_cost" placeholder="e.g. 200" oninput="calcServiceTotal()" class="w-full p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-lg font-bold">
                            </div>
                            <div>
                                <label id="label_item_5" class="block font-semibold text-gray-600 dark:text-gray-400 mb-1">🔩 Other Spares / Chain</label>
                                <input type="number" step="any" inputmode="decimal" id="service_other_cost" name="other_cost" placeholder="0" oninput="calcServiceTotal()" class="w-full p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-lg font-bold">
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Total Service Cost (<span class="curr-symbol-label">Ksh</span>)</label>
                            <div class="relative">
                                <input type="number" step="any" inputmode="decimal" id="service_total_cost" name="total_cost" placeholder="Total Cost" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-900 rounded-xl text-xs font-black text-rose-600 dark:text-rose-400" required>
                                <span id="service_total_badge" class="absolute right-3 top-2.5 text-xs font-extrabold text-rose-500 pointer-events-none"></span>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Deduct from Account (Optional)</label>
                            <select name="account_id" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-900 rounded-xl text-xs font-semibold">
                                <option value="">-- No Ledger Deduction (Cash / Outside) --</option>
                                ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (Bal: ${formatKes(a.balance)})</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Next Service Interval</label>
                            <select name="interval_weeks" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-900 rounded-xl text-xs font-semibold">
                                <option value="3">Every 3 Weeks (~1,500 km - Boda / High Delivery)</option>
                                <option value="4">Every 4 Weeks (~2,000 km - Monthly)</option>
                                <option value="6" selected>Every 6 Weeks (~3,500 km - Ride-Hailing Car)</option>
                                <option value="8">Every 8 Weeks (~5,000 km - Standard Car Service)</option>
                                <option value="12">Every 12 Weeks (~7,500 km - Major Inspection)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Service Notes & Part Details</label>
                        <input type="text" id="service_notes_input" name="notes" placeholder="e.g. Changed oil (5W-30 / 20W-50), oil filter & brake pads. Inspected suspension & tires." value="Engine oil plus brake pads changed, inspected and in good condition, labor paid." class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-900 rounded-xl text-xs font-medium">
                    </div>

                    <div class="flex justify-end gap-2 pt-1">
                        <button type="button" onclick="toggleMaintDrawer()" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold">Cancel</button>
                        <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition shadow-xs active:scale-95">💾 Save Service & Update Ledger</button>
                    </div>
                </form>
            </div>

            <!-- Active Maintenance Schedules Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                ${maintenance_schedules.length > 0 ? maintenance_schedules.map((m: any) => {
                    const nextDiff = getDaysDiff(m.next_due_date);
                    const isUrgent = nextDiff.status === 'EXPIRED' || nextDiff.status === 'URGENT';
                    return `
                    <div class="bg-white dark:bg-gray-800 p-4 rounded-2xl border ${isUrgent ? 'border-amber-300 dark:border-amber-700/80 bg-amber-50/20' : 'border-gray-200 dark:border-gray-700'} space-y-3 flex flex-col justify-between shadow-2xs">
                        <div class="space-y-2">
                            <div class="flex justify-between items-start">
                                <div>
                                    <h4 class="font-bold text-gray-900 dark:text-white text-sm">${m.service_type}</h4>
                                    <span class="text-[10px] text-gray-500 dark:text-gray-400">Interval: Every ${m.interval_weeks || 3} Weeks</span>
                                </div>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isUrgent ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 animate-pulse' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'}">
                                    ${nextDiff.label}
                                </span>
                            </div>

                            <div class="grid grid-cols-2 gap-2 text-xs">
                                <div class="p-2 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                    <p class="text-[10px] text-gray-400">Last Serviced</p>
                                    <p class="font-bold text-gray-800 dark:text-gray-200">${m.last_service_date || 'N/A'}</p>
                                </div>
                                <div class="p-2 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                    <p class="text-[10px] text-gray-400">Next Due Date</p>
                                    <p class="font-bold ${isUrgent ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}">${m.next_due_date || 'N/A'}</p>
                                </div>
                            </div>

                            ${m.notes ? `<p class="text-[11px] text-gray-600 dark:text-gray-300 bg-gray-50/70 dark:bg-gray-900/70 p-2 rounded-lg border dark:border-gray-800 font-mono">📝 ${m.notes}</p>` : ''}
                        </div>

                        <div class="flex items-center justify-between pt-2 border-t dark:border-gray-700/60 text-xs">
                            <form action="/rider/maintenance/service/${m.id}" method="POST">
                                <button type="submit" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition active:scale-95">
                                    ✓ Done Today
                                </button>
                            </form>
                            <form action="/rider/maintenance/delete/${m.id}" method="POST" onsubmit="return confirm('Delete this maintenance schedule?');">
                                <button type="submit" class="text-gray-400 hover:text-rose-500 text-xs p-1">Delete</button>
                            </form>
                        </div>
                    </div>`;
                }).join('') : `
                <div class="col-span-full p-4 text-center rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-dashed border-gray-300 dark:border-gray-700">
                    <p class="text-xs text-gray-500">No active maintenance records. Click "➕ Log Service / Repair" above to log yesterday's service!</p>
                </div>`}
            </div>
        </div>

        <!-- 📜 Driver, Personal & Vehicle Compliance Documents Card -->
        <div id="compliance-card" class="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-950/30 rounded-3xl p-6 shadow-sm border border-amber-200 dark:border-amber-900/50 space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-amber-100 dark:border-amber-900/40 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-xl shadow-xs">
                        📜
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                            <span>Driver, Personal &amp; Vehicle Documents</span>
                            <span class="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">${compliance_deadlines.length} Documents Registered</span>
                        </h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Track Certificate of Good Conduct (DCI), Driving License (DL), PSV Badge, Food Handler Cert, KRA TCC, Insurance, Inspections, or any custom document.</p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" onclick="selectDocPresetQuick('GOOD_CONDUCT')" class="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold rounded-xl transition shadow-2xs flex items-center gap-1 active:scale-95">
                        <span>👮 + Good Conduct</span>
                    </button>
                    <button type="button" onclick="selectDocPresetQuick('CUSTOM')" class="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-xl transition shadow-2xs flex items-center gap-1 active:scale-95">
                        <span>✨ + Custom Doc</span>
                    </button>
                    <button type="button" onclick="document.getElementById('new-comp-form-container')?.classList.toggle('hidden')" class="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5">
                        <span>➕ Add Document</span>
                    </button>
                </div>
            </div>

            <!-- ⚡ 1-Tap Quick-Add Document Chips -->
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 shrink-0 mr-1">⚡ Quick Add:</span>
                <button type="button" onclick="selectDocPresetQuick('GOOD_CONDUCT')" class="px-2.5 py-1 bg-white dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-amber-200 dark:border-gray-700 rounded-xl text-[11px] font-bold text-gray-800 dark:text-gray-200 shrink-0 transition active:scale-95">
                    👮 Good Conduct (DCI)
                </button>
                <button type="button" onclick="selectDocPresetQuick('DL')" class="px-2.5 py-1 bg-white dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-amber-200 dark:border-gray-700 rounded-xl text-[11px] font-semibold text-gray-700 dark:text-gray-300 shrink-0 transition active:scale-95">
                    🪪 Driving License (DL)
                </button>
                <button type="button" onclick="selectDocPresetQuick('PSV_BADGE')" class="px-2.5 py-1 bg-white dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-amber-200 dark:border-gray-700 rounded-xl text-[11px] font-semibold text-gray-700 dark:text-gray-300 shrink-0 transition active:scale-95">
                    🪪 PSV Driver Badge
                </button>
                <button type="button" onclick="selectDocPresetQuick('INSURANCE_PSV')" class="px-2.5 py-1 bg-white dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-amber-200 dark:border-gray-700 rounded-xl text-[11px] font-semibold text-gray-700 dark:text-gray-300 shrink-0 transition active:scale-95">
                    🛡️ Vehicle / PSV Insurance
                </button>
                <button type="button" onclick="selectDocPresetQuick('UBER_INSPECT')" class="px-2.5 py-1 bg-white dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-amber-200 dark:border-gray-700 rounded-xl text-[11px] font-semibold text-gray-700 dark:text-gray-300 shrink-0 transition active:scale-95">
                    🚗 Uber / Bolt Inspection
                </button>
                <button type="button" onclick="selectDocPresetQuick('FOOD_HANDLER')" class="px-2.5 py-1 bg-white dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-amber-200 dark:border-gray-700 rounded-xl text-[11px] font-semibold text-gray-700 dark:text-gray-300 shrink-0 transition active:scale-95">
                    🏥 Food Handler Cert
                </button>
                <button type="button" onclick="selectDocPresetQuick('KRA_TCC')" class="px-2.5 py-1 bg-white dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-amber-200 dark:border-gray-700 rounded-xl text-[11px] font-semibold text-gray-700 dark:text-gray-300 shrink-0 transition active:scale-95">
                    🏛️ KRA Tax Compliance
                </button>
                <button type="button" onclick="selectDocPresetQuick('HEALTH_COVER')" class="px-2.5 py-1 bg-white dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-amber-200 dark:border-gray-700 rounded-xl text-[11px] font-semibold text-gray-700 dark:text-gray-300 shrink-0 transition active:scale-95">
                    🏥 SHA / NHIF Cover
                </button>
                <button type="button" onclick="selectDocPresetQuick('SACCO_ID')" class="px-2.5 py-1 bg-white dark:bg-gray-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-amber-200 dark:border-gray-700 rounded-xl text-[11px] font-semibold text-gray-700 dark:text-gray-300 shrink-0 transition active:scale-95">
                    🏍️ SACCO / Stage Permit
                </button>
                <button type="button" onclick="selectDocPresetQuick('CUSTOM')" class="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-800 rounded-xl text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0 transition active:scale-95">
                    ✨ Custom Document
                </button>
            </div>

            <!-- ➕ Add New Statutory / Personal Document Form -->
            <div id="new-comp-form-container" class="hidden bg-white dark:bg-gray-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900 shadow-md space-y-4">
                <div class="flex justify-between items-center border-b dark:border-gray-800 pb-2">
                    <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>➕ Register Driver, Personal or Vehicle Document</span>
                    </h3>
                    <button type="button" onclick="document.getElementById('new-comp-form-container')?.classList.add('hidden')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">✕</button>
                </div>

                <!-- 📷 Scan or Upload Document Copy (Phone & PC) -->
                <div class="p-3.5 rounded-xl border border-dashed border-amber-300 dark:border-amber-700/80 bg-amber-50/40 dark:bg-amber-950/20 space-y-2.5">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <span class="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                <span>📄</span> Scan or Upload Document Copy (Digital Glovebox)
                            </span>
                            <p class="text-[11px] text-gray-500 dark:text-gray-400">Attach photo (Camera/Gallery) or PDF (e.g. Good Conduct, Insurance, DL) so you can pull it up roadside in 1 tap!</p>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            <input type="file" id="new-doc-camera-input" accept="image/*" capture="environment" class="hidden" onchange="handleNewDocScanSelect(this.files[0])">
                            <input type="file" id="new-doc-file-input" accept="image/*,application/pdf" class="hidden" onchange="handleNewDocScanSelect(this.files[0])">
                            <button type="button" onclick="document.getElementById('new-doc-camera-input')?.click()" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1 active:scale-95">
                                <span>📷 Snap with Camera</span>
                            </button>
                            <button type="button" onclick="document.getElementById('new-doc-file-input')?.click()" class="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition border border-gray-300 dark:border-gray-700 flex items-center gap-1 active:scale-95">
                                <span>📁 Upload File / PDF</span>
                            </button>
                        </div>
                    </div>

                    <!-- Live Attached Scan Thumbnail & OCR Trigger -->
                    <div id="new-doc-scan-preview-box" class="hidden flex items-center justify-between gap-3 p-2 bg-white dark:bg-gray-900 rounded-lg border border-amber-200 dark:border-amber-900/60 text-xs">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <img id="new-doc-scan-thumb" src="" alt="Scan Thumbnail" class="w-10 h-10 object-cover rounded-md border border-gray-200 dark:border-gray-700 bg-gray-900 shrink-0">
                            <div class="min-w-0">
                                <p id="new-doc-scan-meta" class="font-bold text-gray-900 dark:text-white truncate">Attached</p>
                                <div id="new-doc-scan-ocr-status" class="mt-0.5"></div>
                            </div>
                        </div>
                        <button type="button" onclick="_pendingNewDocScan=null; document.getElementById('new-doc-scan-preview-box')?.classList.add('hidden');" class="text-rose-500 hover:text-rose-700 text-xs font-bold p-1">✕</button>
                    </div>
                </div>

                <form action="/rider/compliance/create" method="POST" onsubmit="savePendingDocScanOnCreate()" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div class="sm:col-span-2 lg:col-span-1">
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Document Preset / Category</label>
                        <select id="new-doc-category-select" onchange="onDocTypePresetChanged(this.value)" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-xs font-semibold cursor-pointer">
                            <optgroup label="👤 Driver &amp; Personal Documents">
                                <option value="GOOD_CONDUCT" selected>👮 Certificate of Good Conduct (DCI)</option>
                                <option value="DL">🪪 NTSA Driving License (Smart DL)</option>
                                <option value="PSV_BADGE">🪪 NTSA PSV Driver Badge / Endorsement</option>
                                <option value="FOOD_HANDLER">🏥 County Food Handler Medical Cert</option>
                                <option value="KRA_TCC">🏛️ KRA Tax Compliance Certificate (TCC)</option>
                                <option value="HEALTH_COVER">🏥 SHA / NHIF &amp; Personal Accident Cover</option>
                                <option value="SACCO_ID">🏍️ SACCO / Stage Membership Permit</option>
                                <option value="NATIONAL_ID">🪪 National ID / Passport</option>
                            </optgroup>
                            <optgroup label="🚗 Vehicle, Insurance &amp; Permits">
                                <option value="UBER_INSPECT">🚗 Uber / Bolt Vehicle Inspection Report</option>
                                <option value="INSURANCE_PSV">🛡️ Commercial PSV / Ride-Hail Insurance</option>
                                <option value="INSURANCE_COMP">🛡️ Comprehensive Vehicle / Bike Insurance</option>
                                <option value="INSURANCE_TP">🛡️ Third-Party Vehicle / Bike Insurance</option>
                                <option value="INSPECTION">🔍 NTSA Motor Vehicle Inspection Cert</option>
                                <option value="SPEED_GOVERNOR">⏱️ NTSA Speed Governor &amp; Limiter Cert</option>
                                <option value="PSV">🎫 County PSV Sticker / Parking Permit</option>
                                <option value="LOGBOOK">📖 Vehicle Logbook / Asset Registration</option>
                            </optgroup>
                            <optgroup label="✨ Custom Option">
                                <option value="CUSTOM">📋 Type Any Custom Document Name...</option>
                            </optgroup>
                        </select>
                    </div>
                    <div class="sm:col-span-2 lg:col-span-1">
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Document Name (Editable)</label>
                        <input type="text" id="new-doc-title-input" name="title" value="Certificate of Good Conduct (DCI Police Clearance)" placeholder="e.g. Certificate of Good Conduct, Driving License, Insurance..." class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-xs font-semibold" required>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Expiry / Renewal Date</label>
                        <input type="date" id="new-doc-expiry-input" name="expiry_date" value="${(() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); })()}" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-xs font-bold" required>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Renewal Cycle</label>
                        <select id="new-doc-interval-select" name="interval_months" onchange="onDocIntervalChanged(this.value)" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-xs font-semibold">
                            <option value="1">1 Month (Monthly Cover / Sticker)</option>
                            <option value="3">3 Months (Quarterly)</option>
                            <option value="6">6 Months (Semi-Annual / Food Handler)</option>
                            <option value="12" selected>12 Months (Annual - Good Conduct / Insurance)</option>
                            <option value="24">24 Months (2 Years)</option>
                            <option value="36">36 Months (3 Years - Smart DL)</option>
                            <option value="60">60 Months (5 Years)</option>
                        </select>
                    </div>
                    <div class="sm:col-span-2 lg:col-span-2">
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Ref / Policy Number / Notes (Optional)</label>
                        <input type="text" id="new-doc-notes-input" name="notes" placeholder="e.g. eCitizen Ref #PCC-..., DCI / Huduma Centre, or Policy #..." class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-xs">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Fee Paid (<span class="curr-symbol-label">Ksh</span>, Optional)</label>
                        <input type="number" step="any" inputmode="decimal" name="renewal_cost" placeholder="e.g. 1050 (0 if already paid)" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-xs font-bold">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Deduct Account (If Fee Paid)</label>
                        <select name="account_id" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-xs font-semibold">
                            <option value="">-- Don't Deduct Account --</option>
                            ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (Bal: ${formatKes(a.balance)})</option>`).join('')}
                        </select>
                    </div>
                    <div class="sm:col-span-2 lg:col-span-4 flex justify-end gap-2 pt-1">
                        <button type="button" onclick="document.getElementById('new-comp-form-container')?.classList.add('hidden')" class="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold">
                            Cancel
                        </button>
                        <button type="submit" class="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition shadow-xs active:scale-95">
                            💾 Save Document to Tracker
                        </button>
                    </div>
                </form>
            </div>

            <!-- Documents Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${compliance_deadlines.length > 0 ? compliance_deadlines.map((c: any) => {
                    const diff = getDaysDiff(c.expiry_date);
                    const isUrgent = diff.status === 'EXPIRED' || diff.status === 'URGENT';
                    const isSoon = diff.status === 'SOON';
                    const badgeColor = isUrgent ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-black animate-pulse' : (isSoon ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold');
                    
                    const titleLower = (c.title || '').toLowerCase();
                    let docTypeLabel = 'Personal / Vehicle Doc';
                    let icon = '📋';
                    let typeBadgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
                    if (titleLower.includes('good conduct') || titleLower.includes('police') || titleLower.includes('dci') || titleLower.includes('clearance')) {
                        docTypeLabel = 'Good Conduct (DCI)';
                        icon = '👮';
                        typeBadgeClass = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300';
                    } else if (titleLower.includes('food') || titleLower.includes('medical') || titleLower.includes('health') || titleLower.includes('sha') || titleLower.includes('nhif')) {
                        docTypeLabel = 'Health & Medical';
                        icon = '🏥';
                        typeBadgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
                    } else if (titleLower.includes('kra') || titleLower.includes('tax') || titleLower.includes('tcc')) {
                        docTypeLabel = 'KRA Tax Compliance';
                        icon = '🏛️';
                        typeBadgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
                    } else if (titleLower.includes('badge')) {
                        docTypeLabel = 'PSV Driver Badge';
                        icon = '🪪';
                        typeBadgeClass = 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';
                    } else if (titleLower.includes('insurance')) {
                        docTypeLabel = 'Vehicle Insurance';
                        icon = '🛡️';
                        typeBadgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
                    } else if (titleLower.includes('license') || titleLower.includes('dl')) {
                        docTypeLabel = 'Driving License (DL)';
                        icon = '🪪';
                        typeBadgeClass = 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';
                    } else if (titleLower.includes('sacco') || titleLower.includes('stage')) {
                        docTypeLabel = 'SACCO / Stage Permit';
                        icon = '🏍️';
                        typeBadgeClass = 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300';
                    } else if (titleLower.includes('psv') || titleLower.includes('permit') || titleLower.includes('sticker') || titleLower.includes('county')) {
                        docTypeLabel = 'County PSV Permit';
                        icon = '🎫';
                        typeBadgeClass = 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300';
                    } else if (titleLower.includes('governor') || titleLower.includes('limiter')) {
                        docTypeLabel = 'Speed Governor';
                        icon = '⏱️';
                        typeBadgeClass = 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300';
                    } else if (titleLower.includes('inspection') || titleLower.includes('ntsa') || titleLower.includes('uber') || titleLower.includes('bolt')) {
                        docTypeLabel = 'Vehicle Inspection';
                        icon = '🔍';
                        typeBadgeClass = 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300';
                    } else if (titleLower.includes('logbook')) {
                        docTypeLabel = 'Vehicle Logbook';
                        icon = '📖';
                        typeBadgeClass = 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
                    }

                    const safeTitle = (c.title || '').replace(/'/g, "\\'");

                    return `
                    <div class="bg-white dark:bg-gray-900 p-4 rounded-2xl border ${isUrgent ? 'border-rose-300 dark:border-rose-900 shadow-sm' : (isSoon ? 'border-amber-300 dark:border-amber-900/60' : 'border-gray-200 dark:border-gray-800')} space-y-3 flex flex-col justify-between shadow-xs" data-comp-doc-id="${c.id}" data-comp-doc-title="${c.title}">
                        <div class="space-y-2.5">
                            <div class="flex justify-between items-start">
                                <div class="flex items-center space-x-2.5">
                                    <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center text-xl shadow-xs shrink-0">
                                        ${icon}
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-1.5 flex-wrap">
                                            <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-md ${typeBadgeClass}">${docTypeLabel}</span>
                                        </div>
                                        <h3 class="font-bold text-gray-900 dark:text-white text-sm leading-snug mt-0.5">${c.title}</h3>
                                        <span class="text-[10px] text-gray-500 dark:text-gray-400">Renewal Cycle: ${c.interval_months || 12} Mos</span>
                                    </div>
                                </div>
                                <form action="/rider/compliance/delete/${c.id}" method="POST" onsubmit="return confirm('Delete this document record?');">
                                    <button type="submit" title="Delete" class="text-gray-400 hover:text-rose-500 text-xs p-1">✕</button>
                                </form>
                            </div>

                            <div class="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-1.5">
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-400 font-medium">Expiry Date:</span>
                                    <span class="font-extrabold text-gray-800 dark:text-gray-200">${c.expiry_date || 'N/A'}</span>
                                </div>
                                <div class="text-center">
                                    <span class="inline-block px-2.5 py-1 rounded-lg text-xs ${badgeColor}">
                                        ${diff.label}
                                    </span>
                                </div>
                            </div>

                            <!-- 📄 Digital Glovebox Status Bar -->
                            <div class="flex items-center justify-between p-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs">
                                <span class="glovebox-status-badge text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                    📷 No Scan Attached
                                </span>
                                <div class="flex items-center gap-1">
                                    <input type="file" id="doc-card-file-input-${c.id}" accept="image/*,application/pdf" class="hidden" onchange="attachScanToExistingDoc('${c.id}', '${safeTitle}', this.files[0])">
                                    <input type="file" id="doc-card-cam-input-${c.id}" accept="image/*" capture="environment" class="hidden" onchange="attachScanToExistingDoc('${c.id}', '${safeTitle}', this.files[0])">
                                    <button type="button" onclick="showGloveboxModal('${c.id}', '${safeTitle}')" class="glovebox-view-btn hidden px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition active:scale-95 shadow-2xs">
                                        👁️ View Scan
                                    </button>
                                    <button type="button" onclick="document.getElementById('doc-card-file-input-${c.id}')?.click()" class="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/60 hover:bg-amber-200 text-amber-800 dark:text-amber-200 rounded-lg text-[10px] font-bold transition active:scale-95">
                                        📷 Attach
                                    </button>
                                </div>
                            </div>

                            ${c.notes ? `<p class="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 p-2 rounded-lg font-mono">ℹ️ ${c.notes}</p>` : ''}
                        </div>

                        <!-- Action Drawers & Buttons -->
                        <div class="space-y-2 pt-1 border-t dark:border-gray-800">
                            <div class="flex gap-2">
                                <button type="button" onclick="toggleComplianceDrawer('${c.id}')" class="flex-1 py-1.5 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-lg border border-amber-200 dark:border-amber-800 transition active:scale-95 flex items-center justify-center gap-1">
                                    <span>👁️ Edit / Renew Document</span>
                                </button>
                            </div>

                            <!-- Inline Renew Drawer -->
                            <div id="comp-drawer-${c.id}" class="hidden p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl space-y-2 text-xs">
                                <form action="/rider/compliance/update/${c.id}" method="POST" class="space-y-2">
                                    <div>
                                        <label class="block font-bold text-amber-950 dark:text-amber-200 mb-0.5">Document Name</label>
                                        <input type="text" name="title" value="${c.title || ''}" class="w-full p-1.5 border border-amber-300 dark:border-amber-700 dark:bg-gray-900 rounded-lg font-bold" required>
                                    </div>
                                    <div>
                                        <label class="block font-bold text-amber-950 dark:text-amber-200 mb-0.5">New Expiry Date</label>
                                        <input type="date" name="expiry_date" value="${c.expiry_date || ''}" class="w-full p-1.5 border border-amber-300 dark:border-amber-700 dark:bg-gray-900 rounded-lg font-bold" required>
                                    </div>
                                    <div>
                                        <label class="block font-bold text-amber-950 dark:text-amber-200 mb-0.5">Renewal Cost (<span class="curr-symbol-label">Ksh</span>)</label>
                                        <input type="number" step="any" inputmode="decimal" name="renewal_cost" placeholder="0.00" class="w-full p-1.5 border border-amber-300 dark:border-amber-700 dark:bg-gray-900 rounded-lg font-bold">
                                    </div>
                                    <div>
                                        <label class="block font-bold text-amber-950 dark:text-amber-200 mb-0.5">Deduct Account (Optional)</label>
                                        <select name="account_id" class="w-full p-1.5 border border-amber-300 dark:border-amber-700 dark:bg-gray-900 rounded-lg">
                                            <option value="">-- No Ledger Deduction --</option>
                                            ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (Bal: ${formatKes(a.balance)})</option>`).join('')}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block font-bold text-amber-950 dark:text-amber-200 mb-0.5">Ref / Policy / Notes</label>
                                        <input type="text" name="notes" value="${c.notes || ''}" placeholder="Reference number, provider details..." class="w-full p-1.5 border border-amber-300 dark:border-amber-700 dark:bg-gray-900 rounded-lg font-medium">
                                    </div>
                                    <div class="flex gap-2 pt-1">
                                        <button type="submit" class="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 rounded-lg transition shadow-2xs active:scale-95">Save Update</button>
                                        <button type="button" onclick="toggleComplianceDrawer('${c.id}')" class="px-2.5 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold">Cancel</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>`;
                }).join('') : `
                <div class="col-span-full p-5 text-center rounded-xl bg-white dark:bg-gray-900 border border-dashed border-amber-300 dark:border-gray-700 space-y-2">
                    <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">No documents registered yet. Tap <strong>👮 Good Conduct (DCI)</strong>, <strong>🪪 Driving License</strong>, or <strong>➕ Add Document</strong> above to track your expiry dates!</p>
                </div>`}
            </div>
        </div>

        <!-- Shift History Log Table & Mobile Feed with 5-Row Pagination -->
        <div id="shift-history-card" class="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden space-y-2">
            <div class="p-5 sm:p-6 border-b dark:border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div class="flex items-center gap-2">
                    <h3 class="font-bold text-gray-900 dark:text-white text-base">Shift History & Working Hour Yields</h3>
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                        ${rider_logs.length} Shifts
                    </span>
                </div>

                <!-- Power System Filter Pills -->
                <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto flex-wrap">
                    <button type="button" onclick="setShiftFilter('ALL')" id="shift-filter-btn-ALL" class="shift-filter-btn px-2.5 py-1 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs font-bold transition cursor-pointer">
                        All (${rider_logs.length})
                    </button>
                    <button type="button" onclick="setShiftFilter('ELECTRIC')" id="shift-filter-btn-ELECTRIC" class="shift-filter-btn px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer">
                        Electric EV (${rider_logs.filter((l: any) => l.power_type === 'ELECTRIC').length})
                    </button>
                    <button type="button" onclick="setShiftFilter('PETROL')" id="shift-filter-btn-PETROL" class="shift-filter-btn px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer">
                        Petrol / ICE (${rider_logs.filter((l: any) => l.power_type !== 'ELECTRIC').length})
                    </button>
                </div>
            </div>

            ${(() => {
                const totalShifts = rider_logs.length;
                const shiftLimit = 5;

                if (totalShifts === 0) {
                    return `
                    <div class="p-8 text-center text-gray-400">
                        <p class="text-xs">No shift records logged yet. Log your first shift above!</p>
                    </div>`;
                }

                return `
                <!-- Mobile Feed (Phone View: compact cards, max 5 per page) -->
                <div id="shift-mobile-container" class="block sm:hidden p-4 space-y-2.5">
                    ${rider_logs.map((l: any, idx: number) => {
                        const totalShiftExpenses = Number(l.fuel_cost || 0) + Number(l.food_spent || 0) + Number(l.airtime_spent || 0) + Number(l.misc_expenses || 0) + Number(l.maintenance_cost || 0);
                        const netShiftRemittance = Number(l.total_earned || 0) - totalShiftExpenses;
                        const hrYield = Math.round(Number(l.total_earned) / (Number(l.shift_hours) || 1));
                        const isElectric = l.power_type === 'ELECTRIC';
                        const isHidden = idx >= shiftLimit;
                        return `
                        <div class="shift-item shift-mobile-item p-3.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100/70 dark:hover:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2.5 transition ${isHidden ? 'hidden' : ''}" data-power-type="${isElectric ? 'ELECTRIC' : 'PETROL'}">
                            <div class="flex items-center justify-between gap-2">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="font-bold text-xs text-gray-900 dark:text-white">${l.date}</span>
                                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                        ⏰ ${l.start_time || '11:00'}–${l.end_time || '22:00'} (${l.shift_hours}h)
                                    </span>
                                </div>
                                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${isElectric ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'} shrink-0">
                                    ${isElectric ? `🔋 ${l.fuel_station || 'SPIRO'}` : `⛽ ${l.fuel_station || 'RUBIS'}`}
                                </span>
                            </div>

                            <div class="grid grid-cols-3 gap-2 p-2.5 bg-white dark:bg-gray-900/80 rounded-xl border border-gray-100 dark:border-gray-800/60 text-center">
                                <div>
                                    <p class="text-[9px] text-gray-400 uppercase font-semibold">Yield</p>
                                    <p class="text-xs font-black text-amber-600 dark:text-amber-400 mt-0.5">⚡ Ksh ${hrYield.toLocaleString()}/h</p>
                                </div>
                                <div>
                                    <p class="text-[9px] text-gray-400 uppercase font-semibold">Gross</p>
                                    <p class="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5 convertible-amount" data-kes="${l.total_earned}">+Ksh ${(Number(l.total_earned) || 0).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
                                </div>
                                <div>
                                    <p class="text-[9px] text-gray-400 uppercase font-semibold">Net Profit</p>
                                    <p class="text-xs font-black text-blue-600 dark:text-blue-400 mt-0.5 convertible-amount" data-kes="${netShiftRemittance}">Ksh ${netShiftRemittance.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</p>
                                </div>
                            </div>

                            ${totalShiftExpenses > 0 ? `
                            <div class="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 px-1">
                                <span>Expenses: <strong class="text-rose-500 font-bold">-Ksh ${totalShiftExpenses.toLocaleString()}</strong></span>
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    ${Number(l.fuel_cost || 0) > 0 ? `<span class="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">⛽ ${l.fuel_cost}</span>` : ''}
                                    ${Number(l.food_spent || 0) > 0 ? `<span class="bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded">🍲 ${l.food_spent}</span>` : ''}
                                    ${Number(l.airtime_spent || 0) > 0 ? `<span class="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">📱 ${l.airtime_spent}</span>` : ''}
                                </div>
                            </div>
                            ` : ''}

                            <div class="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800/60">
                                <button type="button" onclick="shareStintWhatsApp('${l.date}', '${l.start_time || '11:00'}', '${l.end_time || '22:00'}', ${l.shift_hours || 8}, ${l.trips_completed || 0}, ${l.total_earned || 0}, ${l.fuel_cost || 0}, ${l.food_spent || 0}, ${l.airtime_spent || 0}, ${l.misc_expenses || 0}, ${netShiftRemittance}, '${l.power_type || 'PETROL'}', '${active_bike ? active_bike.plate_number : ''}')" class="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95">
                                    <span>📲 Share Stint</span>
                                </button>
                                <form action="/rider/logs/delete/${l.id}" method="POST" onsubmit="return confirm('Delete shift log?');">
                                    <button type="submit" class="text-rose-400 hover:text-rose-600 font-bold text-xs p-1">Delete ✕</button>
                                </form>
                            </div>
                        </div>`;
                    }).join('')}
                </div>

                <!-- Desktop Table View (Tablet & Laptop/Desktop) -->
                <div id="shift-desktop-container" class="hidden sm:block overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-gray-50 dark:bg-gray-800/60 uppercase text-gray-400 text-[10px]">
                            <tr>
                                <th class="p-4">Date</th>
                                <th class="p-4">Shift Hours</th>
                                <th class="p-4">Power & Station</th>
                                <th class="p-4">Hourly Yield</th>
                                <th class="p-4">Gross Earned</th>
                                <th class="p-4">Energy & Upkeep</th>
                                <th class="p-4">Net Remittance</th>
                                <th class="p-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y dark:divide-gray-800">
                            ${rider_logs.map((l: any, idx: number) => {
                                const totalShiftExpenses = Number(l.fuel_cost || 0) + Number(l.food_spent || 0) + Number(l.airtime_spent || 0) + Number(l.misc_expenses || 0) + Number(l.maintenance_cost || 0);
                                const netShiftRemittance = Number(l.total_earned || 0) - totalShiftExpenses;
                                const isElectric = l.power_type === 'ELECTRIC';
                                const isHidden = idx >= shiftLimit;
                                return `
                            <tr class="shift-item shift-desktop-item hover:bg-gray-50 dark:hover:bg-gray-800/40 transition ${isHidden ? 'hidden' : ''}" data-power-type="${isElectric ? 'ELECTRIC' : 'PETROL'}">
                                <td class="p-4 font-medium">${l.date}</td>
                                <td class="p-4">
                                    <span class="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                                        ⏰ ${l.start_time || '11:00'} – ${l.end_time || '22:00'} (${l.shift_hours}h)
                                    </span>
                                </td>
                                <td class="p-4">
                                    <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${isElectric ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}">
                                        ${isElectric ? `🔋 ${l.fuel_station || 'SPIRO'}` : `⛽ ${l.fuel_station || 'RUBIS'}`}
                                    </span>
                                </td>
                                <td class="p-4 font-bold text-amber-600 dark:text-amber-400">
                                    ⚡ <span class="convertible-amount" data-kes="${Math.round(Number(l.total_earned) / (Number(l.shift_hours) || 1))}">Ksh ${(Math.round(Number(l.total_earned) / (Number(l.shift_hours) || 1))).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>/hr
                                </td>
                                <td class="p-4 font-bold text-emerald-600 dark:text-emerald-400 convertible-amount" data-kes="${l.total_earned}">Ksh ${(Number(l.total_earned) || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                <td class="p-4 text-rose-500 font-medium">
                                    <div class="font-bold convertible-amount" data-kes="${totalShiftExpenses}">
                                        Ksh ${totalShiftExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </div>
                                    <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex flex-wrap gap-1">
                                        ${Number(l.fuel_cost || 0) > 0 ? `<span>⛽ ${l.fuel_cost}</span>` : ''}
                                        ${Number(l.food_spent || 0) > 0 ? `<span>🍲 ${l.food_spent}</span>` : ''}
                                        ${Number(l.airtime_spent || 0) > 0 ? `<span>📱 ${l.airtime_spent}</span>` : ''}
                                        ${Number(l.misc_expenses || 0) > 0 ? `<span>🛠️ ${l.misc_expenses}</span>` : ''}
                                    </div>
                                </td>
                                <td class="p-4 font-extrabold text-blue-600 dark:text-blue-400 convertible-amount" data-kes="${netShiftRemittance}">Ksh ${netShiftRemittance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                <td class="p-4 text-center">
                                    <div class="flex items-center justify-center gap-1.5">
                                        <button type="button" onclick="shareStintWhatsApp('${l.date}', '${l.start_time || '11:00'}', '${l.end_time || '22:00'}', ${l.shift_hours || 8}, ${l.trips_completed || 0}, ${l.total_earned || 0}, ${l.fuel_cost || 0}, ${l.food_spent || 0}, ${l.airtime_spent || 0}, ${l.misc_expenses || 0}, ${netShiftRemittance}, '${l.power_type || 'PETROL'}', '${active_bike ? active_bike.plate_number : ''}')" class="p-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold transition active:scale-95 shadow-2xs" title="Share Stint to WhatsApp">
                                            <span>📲</span>
                                        </button>
                                        <form action="/rider/logs/delete/${l.id}" method="POST" onsubmit="return confirm('Delete shift log?');">
                                            <button type="submit" class="text-rose-500 hover:text-rose-700 font-bold p-1 text-xs">Delete</button>
                                        </form>
                                    </div>
                                </td>
                            </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Shift Pagination Controls (5 per page) -->
                <div id="shift-pagination-controls" class="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${totalShifts <= shiftLimit ? 'hidden' : ''}">
                    <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs text-center sm:text-left">
                        <span>Showing <span id="shift-visible-range" class="font-bold text-gray-800 dark:text-gray-200">${totalShifts === 0 ? '0' : `1–${Math.min(shiftLimit, totalShifts)}`}</span> of <span id="shift-total-filtered-count" class="font-bold text-gray-800 dark:text-gray-200">${totalShifts}</span> shifts</span>
                        <span class="text-gray-300 dark:text-gray-600">•</span>
                        <span id="shift-page-info" class="font-semibold text-blue-600 dark:text-blue-400">Page 1 of ${Math.max(1, Math.ceil(totalShifts / shiftLimit))}</span>
                    </div>
                    <div class="flex items-center gap-1.5 flex-wrap justify-center">
                        <button type="button" id="shift-prev-btn" onclick="shiftPrevPage()" class="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-xl transition flex items-center gap-1 active:scale-95 cursor-pointer opacity-40 cursor-not-allowed" disabled>
                            <span>‹ Prev</span>
                        </button>
                        <div id="shift-pagination-pages" class="flex items-center gap-1 flex-wrap">
                            ${Array.from({ length: Math.ceil(totalShifts / shiftLimit) }).map((_, i) => {
                                const pageNum = i + 1;
                                const isActive = pageNum === 1;
                                return `<button type="button" onclick="shiftGoToPage(${pageNum})" class="w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${isActive ? 'bg-blue-600 text-white shadow-xs' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}">${pageNum}</button>`;
                            }).join('')}
                        </div>
                        <button type="button" id="shift-next-btn" onclick="shiftNextPage()" class="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-xl transition flex items-center gap-1 active:scale-95 cursor-pointer ${totalShifts <= shiftLimit ? 'opacity-40 cursor-not-allowed' : ''}" ${totalShifts <= shiftLimit ? 'disabled' : ''}>
                            <span>Next ›</span>
                        </button>
                    </div>
                </div>
                `;
            })()}
        </div>

    </main>

    <!-- 📄 Digital Glovebox Lightbox Modal (Full-Screen Roadside Document Viewer) -->
    <div id="doc-glovebox-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
        <div class="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4 my-auto">
            <div class="flex justify-between items-center border-b dark:border-gray-800 pb-3 gap-2">
                <div class="flex items-center space-x-2.5 min-w-0">
                    <span class="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl shrink-0">📄</span>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">Digital Glovebox</span>
                        </div>
                        <h3 id="glovebox-modal-title" class="font-extrabold text-gray-900 dark:text-white text-base truncate">Document Copy</h3>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <a id="glovebox-download-btn" href="#" download="document.jpg" class="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition flex items-center gap-1 active:scale-95 border border-indigo-200 dark:border-indigo-800">
                        <span>📥 Download</span>
                    </a>
                    <button type="button" id="glovebox-delete-scan-btn" class="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 text-xs transition" title="Remove Scan">
                        🗑️
                    </button>
                    <button type="button" onclick="document.getElementById('doc-glovebox-modal')?.classList.add('hidden')" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white text-sm transition">✕</button>
                </div>
            </div>

            <div id="glovebox-modal-viewer" class="w-full">
                <!-- Injected dynamically by showGloveboxModal -->
            </div>

            <div class="flex justify-between items-center pt-2 border-t dark:border-gray-800 text-xs text-gray-500">
                <span>Finatrack Roadside Digital Glovebox 🇰🇪</span>
                <button type="button" onclick="document.getElementById('doc-glovebox-modal')?.classList.add('hidden')" class="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold rounded-xl active:scale-95">
                    Close Viewer
                </button>
            </div>
        </div>
    </div>

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
            <button onclick="document.getElementById('ios-install-modal').classList.add('hidden')" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl transition">
                Got It
            </button>
        </div>
    </div>

    <!-- 📱 Native Mobile Bottom App Dock -->
    <nav class="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-800/80 px-4 py-2 flex justify-around items-center sm:hidden shadow-lg safe-area-bottom">
        <a href="/" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-emerald-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">⚡</span>
            <span class="text-[10px] tracking-tight">Finance</span>
        </a>
        <a href="/rider" class="flex flex-col items-center gap-0.5 text-blue-600 dark:text-blue-400 font-bold active:scale-90 transition-transform">
            <span class="text-xl">🛵</span>
            <span class="text-[10px] tracking-tight">Rider</span>
        </a>
        <a href="#shift-log-card" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-blue-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">⏱️</span>
            <span class="text-[10px] tracking-tight">Shift Log</span>
        </a>
        <a href="/#waterfall-card" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-indigo-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">🌊</span>
            <span class="text-[10px] tracking-tight">Split</span>
        </a>
        <a href="/login" class="flex flex-col items-center gap-0.5 text-gray-500 dark:text-gray-400 hover:text-pink-500 active:scale-90 transition-transform font-medium">
            <span class="text-xl">🔑</span>
            <span class="text-[10px] tracking-tight">Account</span>
        </a>
    </nav>

    <script>
        (function() {
            recalcStintsSummary();
        })();
    </script>
</body>
</html>`;
}
