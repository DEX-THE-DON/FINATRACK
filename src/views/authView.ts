export function renderAuthView(data: { mode?: 'login' | 'signup'; toast?: string } = {}): string {
  const { mode = 'signup', toast = '' } = data;
  const isLogin = mode === 'login';

  return `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Finatrack — Sign In or Create Account</title>
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
                    }
                }
            }
        }
    </script>
    <style>
        body {
            background-color: #0f172a;
            background-image:
                radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.12) 0%, transparent 45%),
                radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.10) 0%, transparent 45%);
            min-height: 100vh;
        }

        /* Ensure input text & autofill are always clearly visible */
        .auth-input {
            color: #ffffff !important;
            caret-color: #10b981;
            background-color: #020617;
        }
        .auth-input:-webkit-autofill,
        .auth-input:-webkit-autofill:hover,
        .auth-input:-webkit-autofill:focus {
            -webkit-text-fill-color: #ffffff !important;
            -webkit-box-shadow: 0 0 0px 1000px #020617 inset !important;
            transition: background-color 5000s ease-in-out 0s;
        }

        /* Top Segmented Pill Glider */
        .auth-tab-glider {
            transition: transform 0.45s cubic-bezier(0.65, 0, 0.35, 1);
            will-change: transform;
        }
        #auth-card-container.mode-signup .auth-tab-glider {
            transform: translateX(0%);
        }
        #auth-card-container.mode-login .auth-tab-glider {
            transform: translateX(100%);
        }

        /* Mobile (< 768px): Horizontal Sliding Form Track (200% width) */
        .auth-forms-track {
            display: flex;
            width: 200%;
            transition: transform 0.52s cubic-bezier(0.65, 0, 0.35, 1);
            will-change: transform;
        }
        .auth-form-slide {
            flex: 0 0 50%;
            width: 50%;
            box-sizing: border-box;
            transition: opacity 0.4s ease, transform 0.52s cubic-bezier(0.65, 0, 0.35, 1);
        }
        #auth-card-container.mode-login .auth-forms-track {
            transform: translateX(0%);
        }
        #auth-card-container.mode-signup .auth-forms-track {
            transform: translateX(-50%);
        }

        /* Desktop (>= 768px): Classic 2-Column Sliding Overlay Card */
        @media (min-width: 768px) {
            .auth-forms-track {
                width: 100%;
                transform: none !important;
            }
            .auth-form-slide {
                flex: 0 0 50%;
                width: 50%;
            }
            /* Subtle inner slide + fade on the forms as the overlay glides across */
            #auth-card-container.mode-signup #login-slide-panel {
                opacity: 0;
                pointer-events: none;
                transform: translateX(-24px);
            }
            #auth-card-container.mode-signup #signup-slide-panel {
                opacity: 1;
                pointer-events: auto;
                transform: translateX(0);
            }
            #auth-card-container.mode-login #signup-slide-panel {
                opacity: 0;
                pointer-events: none;
                transform: translateX(24px);
            }
            #auth-card-container.mode-login #login-slide-panel {
                opacity: 1;
                pointer-events: auto;
                transform: translateX(0);
            }

            /* Sliding Overlay Panel (50% width, glides Left <-> Right) */
            .auth-sliding-overlay {
                position: absolute;
                top: 0;
                bottom: 0;
                left: 0;
                width: 50%;
                z-index: 30;
                transition: transform 0.58s cubic-bezier(0.65, 0, 0.35, 1);
                will-change: transform;
            }
            /* In Sign Up mode: Overlay sits on the LEFT (0%), revealing Sign Up form on the RIGHT */
            #auth-card-container.mode-signup .auth-sliding-overlay {
                transform: translateX(0%);
            }
            /* In Log In mode: Overlay slides to the RIGHT (100%), revealing Log In form on the LEFT */
            #auth-card-container.mode-login .auth-sliding-overlay {
                transform: translateX(100%);
            }

            /* Inner overlay text track slides smoothly too */
            .overlay-content-track {
                display: flex;
                width: 200%;
                height: 100%;
                transition: transform 0.58s cubic-bezier(0.65, 0, 0.35, 1);
                will-change: transform;
            }
            #auth-card-container.mode-signup .overlay-content-track {
                transform: translateX(0%);
            }
            #auth-card-container.mode-login .overlay-content-track {
                transform: translateX(-50%);
            }
        }
    </style>
</head>
<body class="text-slate-100 flex flex-col justify-between min-h-screen antialiased selection:bg-emerald-500 selection:text-white">

    <!-- Top Simple Header -->
    <header class="w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex justify-between items-center">
        <a href="/" class="flex items-center gap-2.5 group">
            <div class="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-lg shadow-md shadow-emerald-500/20 group-hover:scale-105 transition">
                ⚡
            </div>
            <div>
                <span class="font-extrabold text-lg tracking-tight text-white block leading-none">Finatrack</span>
                <span class="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Personal &amp; Fleet OS</span>
            </div>
        </a>

        <div class="flex items-center gap-2">
            <a href="/" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition">
                ⚡ Finance
            </a>
            <a href="/rider" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition">
                🛵 Rider
            </a>
            <a href="/trader" class="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 border border-slate-700/80 transition">
                🥬 Trader
            </a>
            <a href="/salaried" class="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 border border-slate-700/80 transition">
                💼 Salaried
            </a>
        </div>
    </header>

    <!-- Main Centered Sliding Auth Card -->
    <main class="flex-1 flex items-center justify-center px-3 sm:px-6 py-4 w-full">
        <div id="auth-card-container"
             class="w-full max-w-md md:max-w-4xl bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden ${isLogin ? 'mode-login' : 'mode-signup'}">

            <!-- Optional Toast Banner -->
            ${toast ? `
            <div class="bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 text-center flex items-center justify-center gap-2 border-b border-emerald-500/40">
                <span>✨ ${toast}</span>
            </div>` : ''}

            <!-- Top Segmented Sliding Switcher (Always accessible on Mobile & Desktop) -->
            <div class="px-6 pt-5 pb-2 md:border-b md:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60">
                <div class="flex items-center gap-2 text-xs text-slate-400">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span id="auth-status-label" class="font-semibold text-slate-300">
                        ${isLogin ? 'Signing in to your Finatrack account' : 'Creating a new Finatrack account'}
                    </span>
                </div>

                <div class="relative bg-slate-950 p-1 rounded-xl border border-slate-800 grid grid-cols-2 w-full sm:w-64 select-none">
                    <div id="auth-tab-glider"
                         class="auth-tab-glider absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-emerald-600 shadow-md pointer-events-none">
                    </div>
                    <button type="button"
                            id="tab-signup-btn"
                            onclick="switchAuthTab('signup')"
                            class="relative z-10 py-1.5 text-xs font-bold rounded-lg transition-colors ${!isLogin ? 'text-white' : 'text-slate-400 hover:text-slate-200'}">
                        Sign Up
                    </button>
                    <button type="button"
                            id="tab-login-btn"
                            onclick="switchAuthTab('login')"
                            class="relative z-10 py-1.5 text-xs font-bold rounded-lg transition-colors ${isLogin ? 'text-white' : 'text-slate-400 hover:text-slate-200'}">
                        Log In
                    </button>
                </div>
            </div>

            <!-- Interactive Sliding Body -->
            <div class="relative overflow-hidden min-h-[460px] flex items-center">

                <!-- DESKTOP SLIDING OVERLAY PANEL (Slides Left <-> Right on md+) -->
                <div id="auth-sliding-overlay"
                     class="hidden md:block auth-sliding-overlay bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 text-white overflow-hidden shadow-2xl border-x border-white/10">
                    <div class="overlay-content-track">

                        <!-- Overlay Slide A (Shown when mode === 'signup', sitting on LEFT side) -->
                        <div class="w-1/2 h-full p-8 lg:p-10 flex flex-col justify-between">
                            <div class="flex items-center gap-2">
                                <span class="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-base">⚡</span>
                                <span class="font-bold text-sm tracking-wide text-emerald-100">Finatrack OS</span>
                            </div>

                            <div class="my-auto space-y-4">
                                <span class="inline-block px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                                    Already Registered?
                                </span>
                                <h2 class="text-2xl lg:text-3xl font-extrabold tracking-tight leading-tight">
                                    Welcome Back!
                                </h2>
                                <p class="text-xs lg:text-sm text-emerald-50/90 leading-relaxed">
                                    Already have an account? Slide over to sign in and access your M-Pesa waterfall, MMF yields, and profile hubs.
                                </p>
                                <div class="pt-2">
                                    <button type="button"
                                            onclick="switchAuthTab('login')"
                                            class="px-6 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-emerald-50 font-extrabold text-xs uppercase tracking-wider shadow-lg transition active:scale-95">
                                        Slide to Log In &rarr;
                                    </button>
                                </div>
                            </div>

                            <div class="text-[11px] text-emerald-100/80 flex items-center justify-between pt-4 border-t border-white/15">
                                <span>🛵 Rider • 🥬 Trader • 💼 Salaried</span>
                                <a href="/" class="underline hover:text-white font-semibold">Guest Demo</a>
                            </div>
                        </div>

                        <!-- Overlay Slide B (Shown when mode === 'login', sitting on RIGHT side) -->
                        <div class="w-1/2 h-full p-8 lg:p-10 flex flex-col justify-between">
                            <div class="flex items-center gap-2">
                                <span class="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-base">⚡</span>
                                <span class="font-bold text-sm tracking-wide text-emerald-100">Finatrack OS</span>
                            </div>

                            <div class="my-auto space-y-4">
                                <span class="inline-block px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                                    New to Finatrack?
                                </span>
                                <h2 class="text-2xl lg:text-3xl font-extrabold tracking-tight leading-tight">
                                    Start Your Wealth Journey
                                </h2>
                                <p class="text-xs lg:text-sm text-emerald-50/90 leading-relaxed">
                                    Create your free account in seconds to automate your Pay-Yourself-First splits, MMF compounding, and daily profits.
                                </p>
                                <div class="pt-2">
                                    <button type="button"
                                            onclick="switchAuthTab('signup')"
                                            class="px-6 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-emerald-50 font-extrabold text-xs uppercase tracking-wider shadow-lg transition active:scale-95">
                                        &larr; Slide to Sign Up
                                    </button>
                                </div>
                            </div>

                            <div class="text-[11px] text-emerald-100/80 flex items-center justify-between pt-4 border-t border-white/15">
                                <span>🔒 Private &amp; Encrypted</span>
                                <a href="/" class="underline hover:text-white font-semibold">Guest Demo</a>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- FORMS TRACK (Left 50% = Log In Form, Right 50% = Sign Up Form) -->
                <div id="auth-forms-track" class="auth-forms-track items-center">

                    <!-- PANEL 1 (LEFT): LOG IN FORM -->
                    <div id="login-slide-panel" class="auth-form-slide p-6 sm:p-8 lg:p-10">
                        <div class="mb-5">
                            <h2 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Welcome Back</h2>
                            <p class="text-xs text-slate-400 mt-1">Enter your email and password to log in.</p>
                        </div>

                        <form id="login-form" action="/auth/login" method="POST" class="space-y-4">
                            <div>
                                <label for="login-email" class="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                                <input type="email" id="login-email" name="email" placeholder="you@example.com" required inputmode="email" autocomplete="email" autocapitalize="none"
                                       class="auth-input w-full px-3.5 py-2.5 rounded-xl border border-slate-700 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition">
                            </div>

                            <div>
                                <div class="flex justify-between items-center mb-1.5">
                                    <label for="login-password" class="text-xs font-semibold text-slate-300">Password</label>
                                    <button type="button" onclick="handleForgotPassword()" class="text-xs text-emerald-400 hover:text-emerald-300 font-semibold">
                                        Forgot password?
                                    </button>
                                </div>
                                <div class="relative flex items-center">
                                    <input type="password" id="login-password" name="password" placeholder="Enter your password" required autocomplete="current-password"
                                           class="auth-input w-full pl-3.5 pr-20 py-2.5 rounded-xl border border-slate-700 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition">
                                    <button type="button"
                                            id="login-pw-toggle-btn"
                                            onclick="toggleAuthPassword('login-password', 'login-pw-toggle-btn', 'login-show-pw-check')"
                                            class="absolute right-2 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-600 text-xs font-bold flex items-center gap-1 transition cursor-pointer select-none"
                                            aria-label="Toggle password visibility">
                                        <svg class="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                        <span class="pw-btn-text">Show</span>
                                    </button>
                                </div>
                                <div class="flex items-center justify-between mt-2">
                                    <label class="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                                        <input type="checkbox" id="login-show-pw-check"
                                               onchange="toggleAuthPassword('login-password', 'login-pw-toggle-btn', 'login-show-pw-check', this.checked)"
                                               class="w-3.5 h-3.5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer">
                                        <span>Show password</span>
                                    </label>
                                    <label class="inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                                        <input type="checkbox" id="remember-me" checked class="w-3.5 h-3.5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer">
                                        <span>Keep signed in</span>
                                    </label>
                                </div>
                            </div>

                            <button type="submit" class="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white text-sm font-bold shadow-lg shadow-emerald-600/25 transition">
                                Log In to Finatrack
                            </button>
                        </form>

                        <div class="mt-5 pt-4 border-t border-slate-800 text-center space-y-2">
                            <p class="text-xs text-slate-400">
                                New to Finatrack?
                                <button type="button" onclick="switchAuthTab('signup')" class="text-emerald-400 hover:text-emerald-300 font-bold ml-1 underline">
                                    Create Account
                                </button>
                            </p>
                            <a href="/" class="inline-flex items-center justify-center gap-1 text-xs font-medium text-slate-400 hover:text-white transition">
                                <span>⚡</span> Continue as Guest / Demo Mode &rarr;
                            </a>
                        </div>
                    </div>

                    <!-- PANEL 2 (RIGHT): SIGN UP FORM -->
                    <div id="signup-slide-panel" class="auth-form-slide p-6 sm:p-8 lg:p-10">
                        <div class="mb-4">
                            <h2 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Create Account</h2>
                            <p class="text-xs text-slate-400 mt-1">Set up your profile in under 30 seconds.</p>
                        </div>

                        <form id="signup-form" action="/auth/signup" method="POST" class="space-y-3.5">
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label for="signup-first-name" class="block text-xs font-semibold text-slate-300 mb-1">First Name</label>
                                    <input type="text" id="signup-first-name" name="first_name" placeholder="Dennis" required autocomplete="given-name"
                                           class="auth-input w-full px-3.5 py-2.5 rounded-xl border border-slate-700 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition">
                                </div>
                                <div>
                                    <label for="signup-last-name" class="block text-xs font-semibold text-slate-300 mb-1">Last Name</label>
                                    <input type="text" id="signup-last-name" name="last_name" placeholder="Dex" required autocomplete="family-name"
                                           class="auth-input w-full px-3.5 py-2.5 rounded-xl border border-slate-700 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition">
                                </div>
                            </div>

                            <div>
                                <label for="signup-email" class="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                                <input type="email" id="signup-email" name="email" placeholder="you@example.com" required inputmode="email" autocomplete="email" autocapitalize="none"
                                       class="auth-input w-full px-3.5 py-2.5 rounded-xl border border-slate-700 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition">
                            </div>

                            <div>
                                <label for="signup-password" class="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                                <div class="relative flex items-center">
                                    <input type="password" id="signup-password" name="password" placeholder="At least 6 characters" required minlength="6" autocomplete="new-password"
                                           class="auth-input w-full pl-3.5 pr-20 py-2.5 rounded-xl border border-slate-700 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition">
                                    <button type="button"
                                            id="signup-pw-toggle-btn"
                                            onclick="toggleAuthPassword('signup-password', 'signup-pw-toggle-btn', 'signup-show-pw-check')"
                                            class="absolute right-2 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-600 text-xs font-bold flex items-center gap-1 transition cursor-pointer select-none"
                                            aria-label="Toggle password visibility">
                                        <svg class="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                        <span class="pw-btn-text">Show</span>
                                    </button>
                                </div>
                                <div class="flex items-center justify-between mt-2">
                                    <label class="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                                        <input type="checkbox" id="signup-show-pw-check"
                                               onchange="toggleAuthPassword('signup-password', 'signup-pw-toggle-btn', 'signup-show-pw-check', this.checked)"
                                               class="w-3.5 h-3.5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer">
                                        <span>Show password</span>
                                    </label>
                                    <label class="inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                                        <input type="checkbox" id="terms-agree" required checked class="w-3.5 h-3.5 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer">
                                        <span>Accept privacy terms</span>
                                    </label>
                                </div>
                            </div>

                            <button type="submit" class="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white text-sm font-bold shadow-lg shadow-emerald-600/25 transition">
                                Create Free Account
                            </button>
                        </form>

                        <div class="mt-4 pt-3.5 border-t border-slate-800 text-center space-y-2">
                            <p class="text-xs text-slate-400">
                                Already have an account?
                                <button type="button" onclick="switchAuthTab('login')" class="text-emerald-400 hover:text-emerald-300 font-bold ml-1 underline">
                                    Log In
                                </button>
                            </p>
                            <a href="/" class="inline-flex items-center justify-center gap-1 text-xs font-medium text-slate-400 hover:text-white transition">
                                <span>⚡</span> Continue as Guest / Demo Mode &rarr;
                            </a>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    </main>

    <!-- Footer Copyright -->
    <footer class="w-full text-center py-4 text-xs text-slate-500">
        &copy; ${new Date().getFullYear()} Finatrack. Built for Kenya's Finance, Mobility, Trader &amp; Salaried Pros.
    </footer>

    <script>
        function switchAuthTab(tab) {
            var container = document.getElementById('auth-card-container');
            var tabSignupBtn = document.getElementById('tab-signup-btn');
            var tabLoginBtn = document.getElementById('tab-login-btn');
            var statusLabel = document.getElementById('auth-status-label');

            if (!container) return;

            if (tab === 'login') {
                container.classList.remove('mode-signup');
                container.classList.add('mode-login');
                if (tabLoginBtn) tabLoginBtn.className = 'relative z-10 py-1.5 text-xs font-bold rounded-lg transition-colors text-white';
                if (tabSignupBtn) tabSignupBtn.className = 'relative z-10 py-1.5 text-xs font-bold rounded-lg transition-colors text-slate-400 hover:text-slate-200';
                if (statusLabel) statusLabel.textContent = 'Signing in to your Finatrack account';
            } else {
                container.classList.remove('mode-login');
                container.classList.add('mode-signup');
                if (tabSignupBtn) tabSignupBtn.className = 'relative z-10 py-1.5 text-xs font-bold rounded-lg transition-colors text-white';
                if (tabLoginBtn) tabLoginBtn.className = 'relative z-10 py-1.5 text-xs font-bold rounded-lg transition-colors text-slate-400 hover:text-slate-200';
                if (statusLabel) statusLabel.textContent = 'Creating a new Finatrack account';
            }
        }

        function toggleAuthPassword(inputId, btnId, checkboxId, forceState) {
            var input = document.getElementById(inputId);
            var btn = document.getElementById(btnId);
            var checkbox = document.getElementById(checkboxId);
            if (!input) return;

            var showPlain = typeof forceState === 'boolean' ? forceState : (input.type === 'password');
            input.type = showPlain ? 'text' : 'password';

            if (checkbox && checkbox.checked !== showPlain) {
                checkbox.checked = showPlain;
            }

            if (btn) {
                if (showPlain) {
                    btn.innerHTML = '<svg class="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg><span class="pw-btn-text">Hide</span>';
                } else {
                    btn.innerHTML = '<svg class="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg><span class="pw-btn-text">Show</span>';
                }
            }
        }

        function handleForgotPassword() {
            alert('Password reset link has been dispatched to your email address.');
        }

        window.switchAuthTab = switchAuthTab;
        window.toggleAuthPassword = toggleAuthPassword;
        window.handleForgotPassword = handleForgotPassword;
    </script>
</body>
</html>`;
}
