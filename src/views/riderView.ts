export function renderRiderDashboard(data: any): string {
  const {
    active_bike = null,
    bikes = [],
    rider_logs = [],
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
  const lastShiftNet = lastShift ? (Number(lastShift.total_earned || 0) - lastShiftTotalExp) : 0;

  // CPK (Cost Per Kilometer) across all shifts
  const totalKmCovered = (rider_logs || []).reduce((acc: number, l: any) => acc + Number(l.kilometers || 0), 0);
  const totalFuelExp = (rider_logs || []).reduce((acc: number, l: any) => acc + Number(l.fuel_cost || 0), 0);
  const overallCpk = totalKmCovered > 0 ? (totalFuelExp / totalKmCovered).toFixed(2) : (activePowerType === 'ELECTRIC' ? '1.80' : '4.50');

  // Remittance & Kodi calculations for today
  const todayShifts = (rider_logs || []).filter((l: any) => l.date === today);
  const todayNetEarned = todayShifts.reduce((acc: number, l: any) => {
    const exp = Number(l.fuel_cost || 0) + Number(l.food_spent || 0) + Number(l.airtime_spent || 0) + Number(l.misc_expenses || 0) + Number(l.maintenance_cost || 0);
    return acc + (Number(l.total_earned || 0) - exp);
  }, 0);
  const dailyTarget = Number(active_bike?.daily_target || 2500);
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
                        '<option value="Uber Eats"' + (platform === 'Uber Eats' ? ' selected' : '') + '>Uber Eats</option>' +
                        '<option value="Bolt Deliveries"' + (platform === 'Bolt Deliveries' ? ' selected' : '') + '>Bolt</option>' +
                        '<option value="Glovo / Jumia"' + (platform === 'Glovo / Jumia' ? ' selected' : '') + '>Glovo/Jumia</option>' +
                        '<option value="Boda Trips"' + (platform === 'Boda Trips' ? ' selected' : '') + '>Boda Passenger</option>' +
                        '<option value="Direct Delivery"' + (platform === 'Direct Delivery' ? ' selected' : '') + '>Direct Client</option>' +
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

        window.addEventListener('DOMContentLoaded', () => {
            recalcStintsSummary();
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

        function calcOdometerServiceStatus() {
            const cur = parseFloat(document.getElementById('current_odometer_input')?.value) || 0;
            const last = parseFloat(document.getElementById('last_service_odo_input')?.value) || 0;
            const interval = parseFloat(document.getElementById('service_interval_km_select')?.value) || 3000;
            const nextOdo = last + interval;
            const remaining = nextOdo - cur;
            const nextEl = document.getElementById('next_service_odo_display');
            const badgeEl = document.getElementById('odo_service_badge');
            if (nextEl) nextEl.innerText = nextOdo.toLocaleString() + ' km';
            if (badgeEl) {
                if (remaining <= 0) {
                    badgeEl.className = 'px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 animate-pulse';
                    badgeEl.innerText = '🚨 Overdue by ' + Math.abs(remaining).toLocaleString() + ' km!';
                } else if (remaining <= 500) {
                    badgeEl.className = 'px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300';
                    badgeEl.innerText = '⚠️ Service Soon (' + remaining.toLocaleString() + ' km left)';
                } else {
                    badgeEl.className = 'px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300';
                    badgeEl.innerText = '✅ Good (' + remaining.toLocaleString() + ' km left)';
                }
            }
            try {
                localStorage.setItem('finatrack_current_odo', cur);
                localStorage.setItem('finatrack_last_service_odo', last);
                localStorage.setItem('finatrack_interval_km', interval);
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

        function onDocTypePresetChanged(typeVal) {
            const titleInput = document.getElementById('new-doc-title-input');
            const intervalSelect = document.getElementById('new-doc-interval-select');
            if (!titleInput) return;
            if (typeVal === 'UBER_INSPECT') {
                titleInput.value = 'Uber / Bolt Vehicle Inspection';
                if (intervalSelect) intervalSelect.value = '12';
            } else if (typeVal === 'INSURANCE_PSV') {
                titleInput.value = 'Commercial PSV / Ride-Hail Insurance';
                if (intervalSelect) intervalSelect.value = '12';
            } else if (typeVal === 'SPEED_GOVERNOR') {
                titleInput.value = 'NTSA Speed Governor & Limiter Certificate';
                if (intervalSelect) intervalSelect.value = '12';
            } else if (typeVal === 'PSV_BADGE') {
                titleInput.value = 'NTSA PSV Driver Badge';
                if (intervalSelect) intervalSelect.value = '12';
            } else if (typeVal === 'INSPECTION') {
                titleInput.value = 'NTSA Motor Vehicle Inspection Certificate';
                if (intervalSelect) intervalSelect.value = '12';
            } else if (typeVal === 'INSURANCE_COMP') {
                titleInput.value = 'Comprehensive Vehicle Insurance';
                if (intervalSelect) intervalSelect.value = '12';
            } else if (typeVal === 'INSURANCE_TP') {
                titleInput.value = 'Third-Party Vehicle Insurance';
                if (intervalSelect) intervalSelect.value = '12';
            } else if (typeVal === 'DL') {
                titleInput.value = 'NTSA Driving License (DL)';
                if (intervalSelect) intervalSelect.value = '36';
            } else if (typeVal === 'PSV') {
                titleInput.value = 'County PSV Permit / Sticker';
                if (intervalSelect) intervalSelect.value = '12';
            } else if (typeVal === 'LOGBOOK') {
                titleInput.value = 'Vehicle Logbook';
                if (intervalSelect) intervalSelect.value = '36';
            } else if (typeVal === 'CUSTOM') {
                titleInput.value = '';
                titleInput.focus();
            }
        }

        function toggleMaintDrawer() {
            const container = document.getElementById('maint-log-form-container');
            if (container) container.classList.toggle('hidden');
        }

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

        <!-- ☀️ Daily Rider Shift Briefing & Night Wrap-up Snapshot Card -->
        <div id="shift-briefing-card" class="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-blue-800/40 space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-blue-800/60 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-xl shadow-xs">
                        ☀️
                    </div>
                    <div>
                        <h2 class="text-lg font-black text-white flex items-center gap-2">
                            <span>Daily Shift Briefing & Take-Home Wrap-up</span>
                            <span class="text-[10px] bg-blue-500/20 text-blue-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-blue-400/30">Live Briefing</span>
                        </h2>
                        <p class="text-xs text-blue-200">Daily earnings target, safe fuel/swap allowance, and your latest shift take-home debrief.</p>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <button onclick="document.getElementById('shift-log-card')?.scrollIntoView({behavior: 'smooth'})" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 active:scale-95">
                        <span>⚡ Log Today's Shift</span>
                    </button>
                    <a href="/rider/export/csv" class="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 active:scale-95">
                        <span>📥 CSV</span>
                    </a>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <!-- Morning Targets Card -->
                <div class="p-4 bg-slate-950/80 border border-blue-900/60 rounded-2xl space-y-2">
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-[10px] text-blue-300 font-bold uppercase tracking-wider">🎯 Today's Target</span>
                        <span class="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full font-bold">Goal</span>
                    </div>
                    <p class="text-2xl font-black text-emerald-400 convertible-amount" data-kes="${active_bike?.daily_target || 2500}">Ksh ${(Number(active_bike?.daily_target) || 2500).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    <p class="text-[11px] text-gray-300">Peak Window: <strong class="text-indigo-300">${ti.best_time_window || '11am – 10pm'}</strong></p>
                </div>

                <!-- Safe Operating Allowance -->
                <div class="p-4 bg-slate-950/80 border border-blue-900/60 rounded-2xl space-y-2">
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-[10px] text-blue-300 font-bold uppercase tracking-wider">⛽ Shift Budget Allowance</span>
                        <span class="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-bold">${activePowerType === 'ELECTRIC' ? 'EV Swap' : 'Petrol'}</span>
                    </div>
                    <p class="text-2xl font-black text-cyan-300 convertible-amount" data-kes="${activePowerType === 'ELECTRIC' ? 300 : 600}">Ksh ${(activePowerType === 'ELECTRIC' ? 300 : 600).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    <p class="text-[11px] text-gray-300">Target net yield: <strong class="text-cyan-300 convertible-amount" data-kes="${ti.overall_avg_net_hourly || 280}">Ksh ${(Number(ti.overall_avg_net_hourly) || 280).toFixed(0)}/hr</strong></p>
                </div>

                <!-- Last Shift Debrief -->
                <div class="p-4 bg-slate-950/80 border border-blue-900/60 rounded-2xl space-y-2">
                    <div class="flex justify-between items-center text-xs">
                        <span class="text-[10px] text-blue-300 font-bold uppercase tracking-wider">🌙 Latest Shift Take-Home</span>
                        <span class="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full font-bold">${lastShift ? lastShift.date : 'Recent'}</span>
                    </div>
                    ${lastShift ? `
                    <p class="text-2xl font-black text-emerald-400 convertible-amount" data-kes="${lastShiftNet}">Ksh ${lastShiftNet.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    <p class="text-[11px] text-gray-400">Earned <span class="text-white font-bold convertible-amount" data-kes="${lastShift.total_earned}">Ksh ${Number(lastShift.total_earned).toLocaleString()}</span> − Exp <span class="text-rose-400 font-bold convertible-amount" data-kes="${lastShiftTotalExp}">Ksh ${lastShiftTotalExp.toLocaleString()}</span></p>
                    ` : `
                    <p class="text-base font-bold text-gray-400 mt-2">Ready for first shift</p>
                    <p class="text-[11px] text-gray-500">Log a shift below to see net take-home debrief.</p>
                    `}
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
                        <p class="text-xs text-gray-500 dark:text-gray-400">${active_bike ? `Daily Revenue Target: <strong class="convertible-amount text-blue-600 dark:text-blue-400 font-bold" data-kes="${active_bike?.daily_target || 3500}">Ksh ${(Number(active_bike?.daily_target) || 3500).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong> • Managed by ${active_bike?.owner_name || username}` : 'Register your car (Uber/Bolt), motorbike or electric EV below to start tracking shifts & finance.'}</p>
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
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Daily Target (<span class="curr-symbol-label">Ksh</span>)</label>
                        <input type="number" step="any" inputmode="decimal" name="daily_target" placeholder="3500.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-900 rounded-xl text-base sm:text-sm font-bold convertible-placeholder">
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
                        <input type="number" step="any" id="sim_stint_earned" value="567" oninput="calcSimStintYield()" class="w-full p-2 bg-slate-900 border border-blue-900 rounded-xl text-xs font-bold text-emerald-400">
                    </div>
                    <div class="p-2.5 bg-blue-950/60 border border-blue-800/60 rounded-xl text-center">
                        <p class="text-[10px] text-blue-300 uppercase font-semibold">Calculated Yield</p>
                        <p class="text-base font-black text-cyan-300" id="sim_stint_result">Ksh 189.00 / hr (3.0h)</p>
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
                <details open class="sm:col-span-2 lg:col-span-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 dark:from-blue-950/50 dark:via-indigo-950/30 dark:to-blue-950/50 p-4 sm:p-5 rounded-2xl border-2 border-blue-400 dark:border-blue-700/80 space-y-3.5 shadow-xs">
                    <summary class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer list-none select-none">
                        <div class="space-y-1">
                            <div class="flex items-center space-x-2">
                                <span class="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-wider shadow-xs">MULTI-SESSION STINTS</span>
                                <h3 class="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                                    <span>⚡ Multi-Session Online Stints (Uber / Bolt / Glovo)</span>
                                </h3>
                            </div>
                            <p class="text-[11px] text-gray-600 dark:text-gray-300">Went online 11am–2pm, took a break, then 2:13pm–5pm? Log each stint to pinpoint peak earning hours.</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="event.stopPropagation(); addStintRow();" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs shrink-0 cursor-pointer">
                                <span>➕ Add Stint</span>
                            </button>
                            <button type="button" onclick="event.stopPropagation(); clearAllStints();" class="px-3 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 active:scale-95 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer" title="Clear stints">
                                <span>Reset</span>
                            </button>
                        </div>
                    </summary>

                    <!-- Hidden input to transmit stints JSON -->
                    <input type="hidden" name="stints_json" id="stints_json_input" value="">

                    <!-- Stints Container (Pre-rendered directly in HTML) -->
                    <div id="stints-builder-container" class="space-y-2.5 pt-3 border-t border-blue-200 dark:border-blue-900/60">
                        <div id="stints-list" class="space-y-2">
                            <!-- Stint #1 pre-rendered -->
                            <div class="stint-row p-2.5 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/60 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs shadow-xs">
                                <div class="sm:col-span-1 font-extrabold text-blue-600 dark:text-blue-400 row-num">#1</div>
                                <div class="sm:col-span-4 flex items-center gap-1.5">
                                    <input type="time" value="11:00" class="stint-start w-full p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-lg text-xs font-bold" oninput="recalcStintsSummary()">
                                    <span class="text-gray-400 text-xs font-semibold">to</span>
                                    <input type="time" value="14:00" class="stint-end w-full p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-lg text-xs font-bold" oninput="recalcStintsSummary()">
                                </div>
                                <div class="sm:col-span-2">
                                    <select class="stint-platform w-full p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-lg text-xs font-medium" onchange="recalcStintsSummary()">
                                        <option value="Uber Eats" selected>Uber Eats</option>
                                        <option value="Bolt Deliveries">Bolt</option>
                                        <option value="Glovo / Jumia">Glovo/Jumia</option>
                                        <option value="Boda Trips">Boda Passenger</option>
                                        <option value="Direct Delivery">Direct Client</option>
                                    </select>
                                </div>
                                <div class="sm:col-span-2">
                                    <input type="number" step="any" inputmode="decimal" value="567" placeholder="Earned Ksh" class="stint-earned w-full p-2 border border-emerald-300 dark:border-emerald-700 dark:bg-gray-800 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400" oninput="recalcStintsSummary()">
                                </div>
                                <div class="sm:col-span-3 flex items-center justify-between gap-1.5">
                                    <span class="stint-badge px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-bold text-[11px] whitespace-nowrap border border-blue-200 dark:border-blue-900">
                                        ⚡ Ksh 189/hr (3.0h)
                                    </span>
                                    <button type="button" onclick="this.closest('.stint-row').remove(); recalcStintsSummary();" class="text-rose-500 hover:text-rose-700 font-bold p-1 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md transition" title="Delete stint">✕</button>
                                </div>
                            </div>

                            <!-- Stint #2 pre-rendered -->
                            <div class="stint-row p-2.5 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/60 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs shadow-xs">
                                <div class="sm:col-span-1 font-extrabold text-blue-600 dark:text-blue-400 row-num">#2</div>
                                <div class="sm:col-span-4 flex items-center gap-1.5">
                                    <input type="time" value="14:13" class="stint-start w-full p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-lg text-xs font-bold" oninput="recalcStintsSummary()">
                                    <span class="text-gray-400 text-xs font-semibold">to</span>
                                    <input type="time" value="17:00" class="stint-end w-full p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-lg text-xs font-bold" oninput="recalcStintsSummary()">
                                </div>
                                <div class="sm:col-span-2">
                                    <select class="stint-platform w-full p-2 border dark:border-gray-700 dark:bg-gray-800 rounded-lg text-xs font-medium" onchange="recalcStintsSummary()">
                                        <option value="Uber Eats">Uber Eats</option>
                                        <option value="Bolt Deliveries" selected>Bolt</option>
                                        <option value="Glovo / Jumia">Glovo/Jumia</option>
                                        <option value="Boda Trips">Boda Passenger</option>
                                        <option value="Direct Delivery">Direct Client</option>
                                    </select>
                                </div>
                                <div class="sm:col-span-2">
                                    <input type="number" step="any" inputmode="decimal" value="700" placeholder="Earned Ksh" class="stint-earned w-full p-2 border border-emerald-300 dark:border-emerald-700 dark:bg-gray-800 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400" oninput="recalcStintsSummary()">
                                </div>
                                <div class="sm:col-span-3 flex items-center justify-between gap-1.5">
                                    <span class="stint-badge px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-bold text-[11px] whitespace-nowrap border border-blue-200 dark:border-blue-900">
                                        ⚡ Ksh 251/hr (2.8h)
                                    </span>
                                    <button type="button" onclick="this.closest('.stint-row').remove(); recalcStintsSummary();" class="text-rose-500 hover:text-rose-700 font-bold p-1 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-md transition" title="Delete stint">✕</button>
                                </div>
                            </div>
                        </div>

                        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 border-t border-blue-200/60 dark:border-gray-800 text-xs">
                            <button type="button" onclick="addStintRow()" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl transition shadow-xs flex items-center gap-1 text-xs cursor-pointer">
                                <span>➕ Add Another Session</span>
                            </button>
                            <div class="text-xs font-bold text-gray-700 dark:text-gray-300 bg-white/80 dark:bg-gray-900/80 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900">
                                Total Sessions: <span id="stints-summary-hours" class="text-blue-600 dark:text-blue-400 font-black">5.8 hrs</span> • Gross: <span id="stints-summary-earned" class="text-emerald-600 dark:text-emerald-400 font-extrabold">Ksh 1,267.00</span>
                            </div>
                        </div>
                    </div>
                </details>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Total Earned (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" inputmode="decimal" name="total_earned" placeholder="e.g. 3500.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm font-bold text-emerald-600 dark:text-emerald-400" required>
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
                    <label id="energy-cost-label" class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        ${activePowerType === 'ELECTRIC' ? '🔋 Battery Swap Cost (<span class="curr-symbol-label">Ksh</span>)' : '⛽ Fuel & Petrol Cost (<span class="curr-symbol-label">Ksh</span>)'}
                    </label>
                    <input type="number" step="any" inputmode="decimal" name="fuel_cost" placeholder="0.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm">
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
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">🍲 Food / Lunch (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" inputmode="decimal" name="food_spent" placeholder="0.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">📱 Airtime & Data (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" inputmode="decimal" name="airtime_spent" placeholder="0.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">🛠️ Daily Upkeep / Parking / Misc (<span class="curr-symbol-label">Ksh</span>)</label>
                    <input type="number" step="any" inputmode="decimal" name="misc_expenses" placeholder="0.00" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">📦 Trips Completed</label>
                    <input type="number" step="1" min="0" inputmode="numeric" name="trips_completed" placeholder="e.g. 15 trips" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">🚗 / 🛵 Kilometers Covered (KM)</label>
                    <input type="number" step="any" inputmode="decimal" name="kilometers" placeholder="e.g. 85.5 km" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-base sm:text-sm">
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
                        ${accounts.map((a: any) => `<option value="${a.id}">${a.name} (#${a.account_number || a.account_type})</option>`).join('')}
                    </select>
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
                            <input type="text" name="notes" placeholder="e.g. Due every evening by 9pm via M-Pesa" value="Daily kodi due by 9pm to vehicle owner" class="w-full p-2 bg-slate-900 border border-indigo-800 rounded-xl font-medium text-white">
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

            <!-- 🚗 Odometer, CPK & Service Interval Tracker Box -->
            <div class="p-4 bg-slate-900 text-white rounded-2xl border border-indigo-900/60 space-y-3">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div class="flex items-center space-x-2">
                        <span class="text-xl">🚗</span>
                        <div>
                            <h3 class="font-bold text-sm text-indigo-200">Odometer, Service Countdown & Real CPK</h3>
                            <p class="text-[11px] text-gray-400">Track oil change intervals and cost per kilometer for cars & bikes</p>
                        </div>
                    </div>
                    <span id="odo_service_badge" class="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300">
                        ✅ In Good Standing
                    </span>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div class="p-2.5 bg-slate-950/80 rounded-xl border border-indigo-950">
                        <label class="block text-[10px] text-gray-400 mb-0.5">Current Odometer (km)</label>
                        <input type="number" id="current_odometer_input" value="12450" oninput="calcOdometerServiceStatus()" class="w-full p-1.5 bg-slate-900 border border-indigo-800 rounded-lg font-black text-emerald-400 text-sm">
                    </div>
                    <div class="p-2.5 bg-slate-950/80 rounded-xl border border-indigo-950">
                        <label class="block text-[10px] text-gray-400 mb-0.5">Last Service Odometer (km)</label>
                        <input type="number" id="last_service_odo_input" value="10000" oninput="calcOdometerServiceStatus()" class="w-full p-1.5 bg-slate-900 border border-indigo-800 rounded-lg font-black text-white text-sm">
                    </div>
                    <div class="p-2.5 bg-slate-950/80 rounded-xl border border-indigo-950">
                        <label class="block text-[10px] text-gray-400 mb-0.5">Service Interval</label>
                        <select id="service_interval_km_select" onchange="calcOdometerServiceStatus()" class="w-full p-1.5 bg-slate-900 border border-indigo-800 rounded-lg font-bold text-white text-xs">
                            <option value="2500">2,500 km (Boda / Heavy Delivery)</option>
                            <option value="3000" selected>3,000 km (Motorbike Standard)</option>
                            <option value="5000">5,000 km (Uber / Bolt Petrol Car)</option>
                            <option value="10000">10,000 km (Synthetic Oil / Major Service)</option>
                        </select>
                    </div>
                    <div class="p-2.5 bg-slate-950/80 rounded-xl border border-indigo-950">
                        <p class="text-[10px] text-indigo-300 font-bold uppercase">⛽ Real CPK</p>
                        <p class="text-base font-black text-cyan-400 mt-1">Ksh ${overallCpk} <span class="text-[10px] text-gray-400 font-normal">/ km</span></p>
                        <p class="text-[9px] text-gray-400">Next due at: <strong id="next_service_odo_display" class="text-indigo-200">13,000 km</strong></p>
                    </div>
                </div>
            </div>

            <!-- ➕ Log Service & Repair Collapsible Form -->
            <div id="maint-log-form-container" class="hidden bg-indigo-50/40 dark:bg-indigo-950/30 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900 shadow-md space-y-4">
                <div class="flex justify-between items-center border-b border-indigo-100 dark:border-indigo-900/60 pb-2">
                    <h3 class="text-sm font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
                        <span>🔧 Record Bike Service & Maintenance Details</span>
                    </h3>
                    <button type="button" onclick="toggleMaintDrawer()" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">✕</button>
                </div>

                <form action="/rider/maintenance/log" method="POST" class="space-y-4">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

        <!-- 📜 Statutory Documents & Vehicle Permits Card -->
        <div id="compliance-card" class="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-950/30 rounded-3xl p-6 shadow-sm border border-amber-200 dark:border-amber-900/50 space-y-5">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-amber-100 dark:border-amber-900/40 pb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-xl shadow-xs">
                        📜
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span>Statutory Documents & Vehicle Permits</span>
                            <span class="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">${compliance_deadlines.length} Documents Registered</span>
                        </h2>
                        <p class="text-xs text-gray-500 dark:text-gray-400">Keep your boda road-legal with automated countdowns for Insurance, Driving License (DL), County PSV permits, and NTSA Inspections.</p>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <button type="button" onclick="document.getElementById('new-comp-form-container')?.classList.toggle('hidden')" class="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5">
                        <span>➕ Add Document</span>
                    </button>
                </div>
            </div>

            <!-- ➕ Add New Statutory Document Form -->
            <div id="new-comp-form-container" class="hidden bg-white dark:bg-gray-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900 shadow-md space-y-3">
                <div class="flex justify-between items-center border-b dark:border-gray-800 pb-2">
                    <h3 class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>➕ Register Statutory Document / Permit</span>
                    </h3>
                    <button type="button" onclick="document.getElementById('new-comp-form-container')?.classList.add('hidden')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">✕</button>
                </div>
                <form action="/rider/compliance/create" method="POST" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div class="sm:col-span-2 lg:col-span-1">
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Document Category</label>
                        <select onchange="onDocTypePresetChanged(this.value)" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-xs font-semibold cursor-pointer">
                            <option value="UBER_INSPECT">🚗 Uber / Bolt Vehicle Inspection Report</option>
                            <option value="INSURANCE_PSV">🛡️ Commercial PSV / Ride-Hail Insurance</option>
                            <option value="SPEED_GOVERNOR">⏱️ NTSA Speed Governor & Limiter Certificate</option>
                            <option value="PSV_BADGE">🪪 NTSA PSV Driver Badge / DL Endorsement</option>
                            <option value="INSPECTION">🔍 NTSA Motor Vehicle Inspection Certificate</option>
                            <option value="INSURANCE_COMP">🛡️ Comprehensive Vehicle Insurance</option>
                            <option value="INSURANCE_TP">🛡️ Third-Party Vehicle Insurance</option>
                            <option value="DL">🪪 NTSA Driving License (DL)</option>
                            <option value="PSV">🎫 County PSV Sticker / Permit</option>
                            <option value="LOGBOOK">📖 Vehicle Logbook</option>
                            <option value="CUSTOM">📋 Custom Document Name...</option>
                        </select>
                    </div>
                    <div class="sm:col-span-2 lg:col-span-1">
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Document Title / Number</label>
                        <input type="text" id="new-doc-title-input" name="title" value="Uber / Bolt Vehicle Inspection" placeholder="e.g. Uber / Bolt Inspection, Commercial PSV Insurance" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-xs font-semibold" required>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Expiry Date</label>
                        <input type="date" name="expiry_date" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-xs font-bold" required>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Renewal Cycle</label>
                        <select id="new-doc-interval-select" name="interval_months" class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-xs font-semibold">
                            <option value="12" selected>12 Months (Annual)</option>
                            <option value="3">3 Months (Quarterly)</option>
                            <option value="6">6 Months (Semi-Annual)</option>
                            <option value="36">36 Months (3 Years - DL)</option>
                        </select>
                    </div>
                    <div class="sm:col-span-2 lg:col-span-3">
                        <label class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Policy Number / Provider Notes (Optional)</label>
                        <input type="text" name="notes" placeholder="e.g. Policy #POL-8900-X, Directline Insurance, Agent contact 07..." class="w-full p-2.5 border dark:border-gray-700 dark:bg-gray-800 rounded-xl text-xs">
                    </div>
                    <div class="flex items-end sm:col-span-2 lg:col-span-1">
                        <button type="submit" class="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-xs active:scale-95">
                            Save Document
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
                    let docTypeLabel = 'Statutory Permit';
                    let icon = '📋';
                    let typeBadgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
                    if (titleLower.includes('insurance')) {
                        docTypeLabel = 'Motorbike Insurance';
                        icon = '🛡️';
                        typeBadgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
                    } else if (titleLower.includes('license') || titleLower.includes('dl')) {
                        docTypeLabel = 'Driving License (DL)';
                        icon = '🪪';
                        typeBadgeClass = 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';
                    } else if (titleLower.includes('psv') || titleLower.includes('permit') || titleLower.includes('sticker') || titleLower.includes('county')) {
                        docTypeLabel = 'County PSV Permit';
                        icon = '🎫';
                        typeBadgeClass = 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300';
                    } else if (titleLower.includes('inspection') || titleLower.includes('ntsa')) {
                        docTypeLabel = 'NTSA Inspection';
                        icon = '🔍';
                        typeBadgeClass = 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300';
                    } else if (titleLower.includes('logbook')) {
                        docTypeLabel = 'Vehicle Logbook';
                        icon = '📖';
                        typeBadgeClass = 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
                    }

                    return `
                    <div class="bg-white dark:bg-gray-900 p-4 rounded-2xl border ${isUrgent ? 'border-rose-300 dark:border-rose-900 shadow-sm' : (isSoon ? 'border-amber-300 dark:border-amber-900/60' : 'border-gray-200 dark:border-gray-800')} space-y-3 flex flex-col justify-between shadow-xs">
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

                            ${c.notes ? `<p class="text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 p-2 rounded-lg font-mono">ℹ️ ${c.notes}</p>` : ''}
                        </div>

                        <!-- Action Drawers & Buttons -->
                        <div class="space-y-2 pt-1 border-t dark:border-gray-800">
                            <div class="flex gap-2">
                                <button type="button" onclick="toggleComplianceDrawer('${c.id}')" class="flex-1 py-1.5 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-lg border border-amber-200 dark:border-amber-800 transition active:scale-95 flex items-center justify-center gap-1">
                                    <span>👁️ View Policy & Renew</span>
                                </button>
                            </div>

                            <!-- Inline Renew Drawer -->
                            <div id="comp-drawer-${c.id}" class="hidden p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl space-y-2 text-xs">
                                <form action="/rider/compliance/update/${c.id}" method="POST" class="space-y-2">
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
                                        <label class="block font-bold text-amber-950 dark:text-amber-200 mb-0.5">Policy / Notes</label>
                                        <input type="text" name="notes" value="${c.notes || ''}" placeholder="Policy number, provider details..." class="w-full p-1.5 border border-amber-300 dark:border-amber-700 dark:bg-gray-900 rounded-lg font-medium">
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
                <div class="col-span-full p-4 text-center rounded-xl bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700">
                    <p class="text-xs text-gray-500">No statutory documents registered yet. Click "➕ Add Document" above to register your Insurance or Driving License!</p>
                </div>`}
            </div>
        </div>

        <!-- Shift History Log Table -->
        <div class="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div class="p-6 border-b dark:border-gray-800 flex justify-between items-center">
                <h3 class="font-bold text-gray-900 dark:text-white text-base">Shift History & Working Hour Yields</h3>
                <span class="text-xs text-gray-500">${rider_logs.length} Shifts Recorded</span>
            </div>
            <div class="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
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
                        ${rider_logs.length > 0 ? rider_logs.map((l: any) => {
                            const totalShiftExpenses = Number(l.fuel_cost || 0) + Number(l.food_spent || 0) + Number(l.airtime_spent || 0) + Number(l.misc_expenses || 0) + Number(l.maintenance_cost || 0);
                            const netShiftRemittance = Number(l.total_earned || 0) - totalShiftExpenses;
                            return `
                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                            <td class="p-4 font-medium">${l.date}</td>
                            <td class="p-4">
                                <span class="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">
                                    ⏰ ${l.start_time || '11:00'} – ${l.end_time || '22:00'} (${l.shift_hours}h)
                                </span>
                            </td>
                            <td class="p-4">
                                <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${l.power_type === 'ELECTRIC' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}">
                                    ${l.power_type === 'ELECTRIC' ? `🔋 ${l.fuel_station || 'SPIRO'}` : `⛽ ${l.fuel_station || 'RUBIS'}`}
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
                        }).join('') : `
                        <tr>
                            <td colspan="8" class="p-6 text-center text-gray-400">No shift records logged yet.</td>
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
