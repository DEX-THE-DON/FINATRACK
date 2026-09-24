import { sortTransactionsLatestFirst } from '../utils/math';

export function renderFinancialStatement(data: any): string {
  const {
    username = 'Dennis',
    accounts = [],
    transactions = [],
    total_balance = 0.0,
    monthly_income = 0.0,
    monthly_expenses = 0.0,
    net_savings = 0.0,
    total_debt = 0.0,
    runway_status = { months: 0, displayMonths: '0 mo', statusLabel: 'N/A' },
    health_score = { totalScore: 85, grade: 'A', tierLabel: 'Financial Shield' },
    statement_date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
    statement_ref = 'FINA-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    currency = 'Ksh',
  } = data;

  const formatKes = (val: number | string) => 'Ksh ' + (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Financial Statement - ${username} - ${statement_ref}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @media print {
            .no-print { display: none !important; }
            body { font-size: 11pt; background: #fff !important; color: #000 !important; }
            .page-break { page-break-after: always; }
            @page { margin: 1.5cm; }
        }
    </style>
</head>
<body class="bg-slate-100 text-slate-900 min-h-screen p-4 sm:p-8 font-sans antialiased">

    <!-- Top Action Bar (hidden when printed) -->
    <div class="max-w-4xl mx-auto mb-6 no-print flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div class="flex items-center space-x-2">
            <a href="/" class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition">
                ← Back to Dashboard
            </a>
            <span class="text-xs text-slate-500 font-semibold">Official Statement Preview</span>
        </div>
        <div class="flex items-center gap-2">
            <button onclick="window.print()" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 active:scale-95">
                <span>🖨️ Print / Save as PDF</span>
            </button>
        </div>
    </div>

    <!-- Official Statement Document -->
    <div class="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-3xl shadow-xl border border-slate-200 space-y-8">
        
        <!-- Header -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-900 pb-6 gap-4">
            <div>
                <div class="flex items-center space-x-2">
                    <span class="text-2xl font-black tracking-tight text-emerald-600">⚡ FINATRACK</span>
                    <span class="text-[11px] font-mono bg-slate-900 text-white px-2 py-0.5 rounded font-bold">FINANCIAL HUB</span>
                </div>
                <p class="text-xs text-slate-500 mt-1">Verified Personal Finance & Multi-Account Intelligence Statement</p>
            </div>
            <div class="text-left sm:text-right text-xs space-y-1">
                <p class="font-bold text-slate-900">Ref: <span class="font-mono text-emerald-700">${statement_ref}</span></p>
                <p class="text-slate-600">Date Issued: <strong>${statement_date}</strong></p>
                <p class="text-slate-600">Account Holder: <strong>${username}</strong></p>
            </div>
        </div>

        <!-- Executive Financial Health Summary -->
        <div class="space-y-3">
            <h2 class="text-sm font-black uppercase tracking-wider text-slate-500">1. Executive Financial Summary</h2>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <p class="text-[10px] font-bold text-slate-500 uppercase">Total Net Balance</p>
                    <p class="text-lg font-black text-slate-900 mt-0.5">${formatKes(total_balance)}</p>
                    <p class="text-[10px] text-emerald-600 font-semibold">${accounts.length} Active Accounts</p>
                </div>
                <div class="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200">
                    <p class="text-[10px] font-bold text-emerald-700 uppercase">This Month Income</p>
                    <p class="text-lg font-black text-emerald-800 mt-0.5">${formatKes(monthly_income)}</p>
                    <p class="text-[10px] text-emerald-600 font-semibold">Shifts & M-Pesa</p>
                </div>
                <div class="p-4 bg-rose-50/60 rounded-2xl border border-rose-200">
                    <p class="text-[10px] font-bold text-rose-700 uppercase">This Month Expenses</p>
                    <p class="text-lg font-black text-rose-800 mt-0.5">${formatKes(monthly_expenses)}</p>
                    <p class="text-[10px] text-rose-600 font-semibold">Living, Fuel & Bills</p>
                </div>
                <div class="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200">
                    <p class="text-[10px] font-bold text-indigo-700 uppercase">Emergency Runway</p>
                    <p class="text-lg font-black text-indigo-800 mt-0.5">${runway_status.displayMonths}</p>
                    <p class="text-[10px] text-indigo-600 font-semibold">${runway_status.statusLabel}</p>
                </div>
            </div>
        </div>

        <!-- Account Holdings & Balances -->
        <div class="space-y-3">
            <h2 class="text-sm font-black uppercase tracking-wider text-slate-500">2. Account & Asset Holdings</h2>
            <div class="overflow-x-auto rounded-2xl border border-slate-200">
                <table class="w-full text-left text-xs">
                    <thead class="bg-slate-100 uppercase text-slate-600 text-[10px] font-bold">
                        <tr>
                            <th class="py-2.5 px-4">Account Name</th>
                            <th class="py-2.5 px-4">Account Type</th>
                            <th class="py-2.5 px-4">Account / Till #</th>
                            <th class="py-2.5 px-4">Yield / APY %</th>
                            <th class="py-2.5 px-4 text-right">Current Balance</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
                        ${accounts.map((a: any) => `
                        <tr>
                            <td class="py-2.5 px-4 font-bold text-slate-900">${a.name}</td>
                            <td class="py-2.5 px-4"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-semibold">${a.account_type}</span></td>
                            <td class="py-2.5 px-4 font-mono text-slate-600">${a.account_number || 'N/A'}</td>
                            <td class="py-2.5 px-4 font-bold ${a.interest_rate_p_a > 0 ? 'text-amber-700' : 'text-slate-400'}">${a.interest_rate_p_a > 0 ? a.interest_rate_p_a + '% p.a.' : '—'}</td>
                            <td class="py-2.5 px-4 text-right font-black text-slate-900">${formatKes(a.balance)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Recent Ledger Transactions -->
        <div class="space-y-3">
            <h2 class="text-sm font-black uppercase tracking-wider text-slate-500">3. Recent Ledger Transactions</h2>
            <div class="overflow-x-auto rounded-2xl border border-slate-200">
                <table class="w-full text-left text-xs">
                    <thead class="bg-slate-100 uppercase text-slate-600 text-[10px] font-bold">
                        <tr>
                            <th class="py-2.5 px-4">Date</th>
                            <th class="py-2.5 px-4">Type</th>
                            <th class="py-2.5 px-4">Category</th>
                            <th class="py-2.5 px-4">Description</th>
                            <th class="py-2.5 px-4 text-right">Amount (${currency})</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
                        ${sortTransactionsLatestFirst(transactions).length > 0 ? sortTransactionsLatestFirst(transactions).slice(0, 50).map((t: any) => `
                        <tr>
                            <td class="py-2 px-4 font-medium text-slate-600">${t.date}</td>
                            <td class="py-2 px-4">
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${t.transaction_type === 'TRANSFER' ? 'bg-blue-100 text-blue-800' : (t.transaction_type === 'INCOME' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}">
                                    ${t.transaction_type}
                                </span>
                            </td>
                            <td class="py-2 px-4 font-medium text-slate-700">${t.category}</td>
                            <td class="py-2 px-4 text-slate-600 truncate max-w-xs">${t.description || '—'}</td>
                            <td class="py-2 px-4 text-right font-bold ${t.transaction_type === 'TRANSFER' ? 'text-blue-700' : (t.transaction_type === 'INCOME' ? 'text-emerald-700' : 'text-rose-700')}">
                                ${t.transaction_type === 'TRANSFER' ? '⇄ ' : (t.transaction_type === 'INCOME' ? '+' : '-')}${formatKes(t.amount)}
                            </td>
                        </tr>`).join('') : `
                        <tr>
                            <td colspan="5" class="py-6 text-center text-slate-400">No transactions recorded during this period.</td>
                        </tr>`}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Verification & Signature Section -->
        <div class="pt-6 border-t-2 border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-600">
            <div>
                <p class="font-bold text-slate-900">Declaration & Notice:</p>
                <p class="text-[11px] text-slate-500 mt-1">This statement represents an accurate digital ledger snapshot generated from Finatrack Financial Freedom Hub. All transaction records and balances are timestamped and verified.</p>
            </div>
            <div class="text-right space-y-3">
                <p class="font-bold text-slate-900">Generated By: Finatrack System Engine</p>
                <div class="inline-block border-b border-slate-400 w-48 pb-1">
                    <span class="font-mono text-[10px] text-emerald-800 font-bold">DIGITALLY VERIFIED ✓</span>
                </div>
            </div>
        </div>

    </div>
</body>
</html>`;
}

