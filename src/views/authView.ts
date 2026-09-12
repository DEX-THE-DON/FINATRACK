export function renderAuthView(data: { mode?: 'login' | 'signup'; toast?: string } = {}): string {
  const { mode = 'signup', toast = '' } = data;

  return `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Finatrack - Welcome to the Future of Finance</title>
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#0d0a1a">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Finatrack">
    <meta name="application-name" content="Finatrack">
    
    <!-- Icons for PWA, PC, Android, iOS -->
    <link rel="icon" type="image/png" sizes="192x192" href="/static/icons/icon-192.png">
    <link rel="icon" type="image/png" sizes="512x512" href="/static/icons/icon-512.png">
    <link rel="icon" type="image/svg+xml" href="/static/icons/icon.svg">
    <link rel="shortcut icon" href="/favicon.ico">
    <link rel="apple-touch-icon" href="/static/icons/icon-192.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/static/icons/icon-192.png">
    <link rel="apple-touch-icon" sizes="192x192" href="/static/icons/icon-192.png">
    <link rel="apple-touch-icon" sizes="512x512" href="/static/icons/icon-512.png">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                        display: ['"Space Grotesk"', 'sans-serif'],
                    },
                    colors: {
                        synth: {
                            bg: '#0c0817',
                            card: 'rgba(23, 14, 41, 0.75)',
                            pink: '#ff2a85',
                            purple: '#9d4edd',
                            neon: '#00f5d4'
                        }
                    }
                }
            }
        }
    </script>
    <style>
        body {
            background-color: #0b0716;
            background-image: 
                radial-gradient(circle at 50% 20%, rgba(255, 42, 133, 0.18) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(157, 78, 221, 0.15) 0%, transparent 50%),
                radial-gradient(circle at 10% 90%, rgba(0, 245, 212, 0.08) 0%, transparent 40%);
            min-height: 100vh;
        }

        .glass-card {
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(255, 42, 133, 0.12);
        }

        .input-underline {
            background: transparent;
            border: none;
            border-bottom: 1.5px solid rgba(255, 255, 255, 0.25);
            transition: all 0.3s ease;
        }

        .input-underline:focus {
            outline: none;
            border-bottom-color: #ff2a85;
            box-shadow: 0 2px 10px rgba(255, 42, 133, 0.3);
        }

        .btn-neon {
            background: linear-gradient(90deg, #ff2a85 0%, #f72585 50%, #b5179e 100%);
            box-shadow: 0 4px 25px rgba(255, 42, 133, 0.45);
            transition: all 0.3s ease;
        }

        .btn-neon:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(255, 42, 133, 0.65);
            filter: brightness(1.1);
        }

        .sun-glow {
            background: radial-gradient(circle at center, #ff2a85 0%, #f72585 40%, rgba(255, 42, 133, 0) 70%);
            filter: blur(12px);
        }
    </style>
</head>
<body class="text-gray-100 flex flex-col justify-between min-h-screen antialiased selection:bg-pink-500 selection:text-white">

    <!-- Top Minimal Navigation -->
    <header class="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center z-20">
        <a href="/" class="flex items-center space-x-3 group">
            <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-fuchsia-600 to-indigo-600 flex items-center justify-center text-xl shadow-lg shadow-pink-500/30 group-hover:scale-105 transition">
                ⚡
            </div>
            <div>
                <span class="font-display font-extrabold text-xl tracking-tight text-white block leading-none">Finatrack</span>
                <span class="text-[9px] font-bold uppercase tracking-widest text-pink-400">Finance & Fleet Portal</span>
            </div>
        </a>

        <div class="flex items-center space-x-3 sm:space-x-4">
            <a href="/" class="px-4 py-2 rounded-xl text-xs font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition backdrop-blur-md">
                ⚡ Finance Hub
            </a>
            <a href="/rider" class="px-4 py-2 rounded-xl text-xs font-bold text-pink-300 hover:text-white bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 transition backdrop-blur-md">
                🛵 Rider Fleet
            </a>
        </div>
    </header>

    <!-- Main Auth Center Card -->
    <main class="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 z-10">
        
        <div class="glass-card rounded-3xl overflow-hidden w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 relative min-h-[580px]">
            
            <!-- Toast Alert inside Card -->
            ${toast ? `
            <div class="col-span-full bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-bold px-4 py-2.5 text-center flex items-center justify-center gap-2 shadow-md">
                <span>✨ ${toast}</span>
            </div>` : ''}

            <!-- Left Hero Art / Synthwave Horizon -->
            <div class="lg:col-span-6 relative overflow-hidden bg-gradient-to-b from-[#180e2b] via-[#100921] to-[#0a0514] p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/10">
                
                <!-- Ambient Glowing Sun Artwork -->
                <div class="absolute -top-10 left-1/2 -translate-x-1/2 w-64 h-64 sun-glow rounded-full pointer-events-none opacity-80"></div>
                <div class="absolute top-8 left-1/2 -translate-x-1/2 w-44 h-44 rounded-full bg-gradient-to-b from-pink-400 via-rose-500 to-purple-900 border border-pink-300/40 shadow-2xl pointer-events-none opacity-90"></div>

                <!-- Mountain Horizon Silhouette SVG -->
                <div class="absolute bottom-0 inset-x-0 h-48 pointer-events-none opacity-80">
                    <svg viewBox="0 0 500 200" preserveAspectRatio="none" class="w-full h-full">
                        <polygon points="0,200 60,110 130,160 210,80 290,150 380,90 460,140 500,100 500,200" fill="#0c0717" />
                        <polygon points="0,200 100,140 180,175 270,110 350,160 430,120 500,170 500,200" fill="#140c26" opacity="0.7"/>
                        <!-- Retro Grid Horizon Lines -->
                        <line x1="0" y1="170" x2="500" y2="170" stroke="rgba(255,42,133,0.3)" stroke-width="1.5"/>
                        <line x1="0" y1="182" x2="500" y2="182" stroke="rgba(255,42,133,0.4)" stroke-width="1.5"/>
                        <line x1="0" y1="194" x2="500" y2="194" stroke="rgba(255,42,133,0.5)" stroke-width="2"/>
                    </svg>
                </div>

                <!-- Branding Header -->
                <div class="relative z-10">
                    <div class="flex items-center space-x-2.5 mb-4">
                        <span class="text-2xl">⚡</span>
                        <h2 class="font-display font-black text-xl tracking-tight text-white">Finatrack Cloud</h2>
                    </div>
                </div>

                <!-- Center Welcome Text -->
                <div class="relative z-10 my-auto pt-24 pb-8 space-y-3">
                    <h3 class="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight leading-tight">
                        Welcome!<br/>
                        <span class="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-rose-300 to-cyan-300">
                            To Next-Gen Wealth
                        </span>
                    </h3>
                    <p class="text-xs sm:text-sm text-gray-300 leading-relaxed font-normal max-w-sm">
                        Master high-yield Ziidi MMF compound earnings, dynamic waterfall splits, and smart rider fleet operations.
                    </p>
                </div>

                <!-- Footer Social / Community Icons -->
                <div class="relative z-10 flex items-center space-x-4 pt-4 border-t border-white/10 text-gray-400 text-sm">
                    <a href="https://github.com/DEX-THE-DON/FINATRACK" target="_blank" class="hover:text-pink-400 transition transform hover:scale-110">
                        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                    </a>
                    <span class="text-xs text-gray-500">•</span>
                    <span class="text-[11px] text-gray-400 font-medium tracking-wide">Cloudflare Edge & Supabase RLS</span>
                </div>

            </div>

            <!-- Right Interactive Form Panel -->
            <div class="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-between bg-black/20">
                
                <div>
                    <!-- Form Title & Toggle Header -->
                    <div class="flex justify-between items-center mb-8">
                        <h2 id="auth-form-title" class="font-display font-extrabold text-2xl text-white tracking-tight">
                            ${mode === 'signup' ? 'Create Account' : 'Welcome Back'}
                        </h2>

                        <!-- Tab Pill Switcher -->
                        <div class="bg-white/5 border border-white/10 p-1 rounded-xl flex items-center text-xs font-semibold">
                            <button type="button" onclick="switchAuthTab('signup')" id="tab-signup-btn" class="px-3 py-1 rounded-lg transition ${mode === 'signup' ? 'bg-pink-500 text-white shadow-xs' : 'text-gray-400 hover:text-white'}">
                                Sign Up
                            </button>
                            <button type="button" onclick="switchAuthTab('login')" id="tab-login-btn" class="px-3 py-1 rounded-lg transition ${mode === 'login' ? 'bg-pink-500 text-white shadow-xs' : 'text-gray-400 hover:text-white'}">
                                Log In
                            </button>
                        </div>
                    </div>

                    <!-- SIGN UP FORM -->
                    <form id="signup-form" action="/auth/signup" method="POST" class="${mode === 'signup' ? '' : 'hidden'} space-y-5">
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-[11px] font-semibold text-gray-400 tracking-wide uppercase">First Name</label>
                                <div class="relative">
                                    <input type="text" name="first_name" placeholder="Dennis" required class="input-underline w-full py-2 text-sm text-white placeholder-gray-600 focus:placeholder-gray-500 pr-7">
                                    <span class="absolute right-0 top-2.5 text-gray-500 text-xs">👤</span>
                                </div>
                            </div>
                            <div class="space-y-1">
                                <label class="text-[11px] font-semibold text-gray-400 tracking-wide uppercase">Last Name</label>
                                <div class="relative">
                                    <input type="text" name="last_name" placeholder="Dex" required class="input-underline w-full py-2 text-sm text-white placeholder-gray-600 focus:placeholder-gray-500 pr-7">
                                    <span class="absolute right-0 top-2.5 text-gray-500 text-xs">👤</span>
                                </div>
                            </div>
                        </div>

                        <div class="space-y-1">
                            <label class="text-[11px] font-semibold text-gray-400 tracking-wide uppercase">Email Address</label>
                            <div class="relative">
                                <input type="email" name="email" placeholder="you@example.com" required class="input-underline w-full py-2 text-sm text-white placeholder-gray-600 focus:placeholder-gray-500 pr-7">
                                <span class="absolute right-0 top-2.5 text-gray-500 text-xs">✉️</span>
                            </div>
                        </div>

                        <div class="space-y-1">
                            <label class="text-[11px] font-semibold text-gray-400 tracking-wide uppercase">Password</label>
                            <div class="relative">
                                <input type="password" name="password" placeholder="••••••••••••" required minlength="6" class="input-underline w-full py-2 text-sm text-white placeholder-gray-600 focus:placeholder-gray-500 pr-7">
                                <span class="absolute right-0 top-2.5 text-gray-500 text-xs">🔒</span>
                            </div>
                        </div>

                        <div class="flex items-center space-x-2 pt-1">
                            <input type="checkbox" id="terms-agree" required class="w-4 h-4 rounded border-gray-700 bg-white/5 text-pink-500 focus:ring-pink-500 focus:ring-offset-0 cursor-pointer">
                            <label for="terms-agree" class="text-xs text-gray-400 cursor-pointer">
                                I agree to the Finatrack Privacy & Security terms
                            </label>
                        </div>

                        <button type="submit" class="btn-neon w-full py-3 rounded-xl text-sm font-extrabold text-white tracking-wide uppercase mt-2">
                            Create Free Account
                        </button>
                    </form>

                    <!-- LOG IN FORM -->
                    <form id="login-form" action="/auth/login" method="POST" class="${mode === 'login' ? '' : 'hidden'} space-y-5">
                        
                        <div class="space-y-1">
                            <label class="text-[11px] font-semibold text-gray-400 tracking-wide uppercase">Email Address</label>
                            <div class="relative">
                                <input type="email" name="email" placeholder="you@example.com" required class="input-underline w-full py-2 text-sm text-white placeholder-gray-600 focus:placeholder-gray-500 pr-7">
                                <span class="absolute right-0 top-2.5 text-gray-500 text-xs">✉️</span>
                            </div>
                        </div>

                        <div class="space-y-1">
                            <div class="flex justify-between items-center">
                                <label class="text-[11px] font-semibold text-gray-400 tracking-wide uppercase">Password</label>
                                <a href="#" onclick="alert('Password reset link has been dispatched to your email address.'); return false;" class="text-[11px] text-pink-400 hover:text-pink-300">Forgot?</a>
                            </div>
                            <div class="relative">
                                <input type="password" name="password" placeholder="••••••••••••" required class="input-underline w-full py-2 text-sm text-white placeholder-gray-600 focus:placeholder-gray-500 pr-7">
                                <span class="absolute right-0 top-2.5 text-gray-500 text-xs">🔒</span>
                            </div>
                        </div>

                        <div class="flex items-center justify-between pt-1">
                            <div class="flex items-center space-x-2">
                                <input type="checkbox" id="remember-me" checked class="w-4 h-4 rounded border-gray-700 bg-white/5 text-pink-500 focus:ring-pink-500 focus:ring-offset-0 cursor-pointer">
                                <label for="remember-me" class="text-xs text-gray-400 cursor-pointer">
                                    Keep me signed in
                                </label>
                            </div>
                        </div>

                        <button type="submit" class="btn-neon w-full py-3 rounded-xl text-sm font-extrabold text-white tracking-wide uppercase mt-2">
                            Log In to Finatrack
                        </button>
                    </form>

                </div>

                <!-- Bottom Toggle Footer -->
                <div class="pt-6 border-t border-white/10 mt-6 text-center space-y-3">
                    <p id="auth-switch-prompt" class="text-xs text-gray-400">
                        ${mode === 'signup' 
                            ? `Already Have An Account? <button type="button" onclick="switchAuthTab('login')" class="text-pink-400 hover:text-pink-300 font-bold ml-1">Sign In</button>`
                            : `New to Finatrack? <button type="button" onclick="switchAuthTab('signup')" class="text-pink-400 hover:text-pink-300 font-bold ml-1">Create Account</button>`}
                    </p>

                    <div>
                        <a href="/" class="text-[11px] text-gray-500 hover:text-gray-300 transition flex items-center justify-center gap-1">
                            <span>⚡</span> Skip & Explore as Guest / Demo Mode &rarr;
                        </a>
                    </div>
                </div>

            </div>

        </div>

    </main>

    <!-- Footer Copyright -->
    <footer class="w-full text-center py-4 text-xs text-gray-600 z-10">
        &copy; ${new Date().getFullYear()} Finatrack. All rights reserved. Powered by TypeScript & Cloudflare Edge.
    </footer>

    <script>
        function switchAuthTab(tab) {
            const signupForm = document.getElementById('signup-form');
            const loginForm = document.getElementById('login-form');
            const tabSignupBtn = document.getElementById('tab-signup-btn');
            const tabLoginBtn = document.getElementById('tab-login-btn');
            const formTitle = document.getElementById('auth-form-title');
            const switchPrompt = document.getElementById('auth-switch-prompt');

            if (tab === 'signup') {
                signupForm.classList.remove('hidden');
                loginForm.classList.add('hidden');
                tabSignupBtn.className = 'px-3 py-1 rounded-lg transition bg-pink-500 text-white shadow-xs';
                tabLoginBtn.className = 'px-3 py-1 rounded-lg transition text-gray-400 hover:text-white';
                formTitle.innerText = 'Create Account';
                switchPrompt.innerHTML = 'Already Have An Account? <button type="button" onclick="switchAuthTab(\\'login\\')" class="text-pink-400 hover:text-pink-300 font-bold ml-1">Sign In</button>';
            } else {
                signupForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
                tabSignupBtn.className = 'px-3 py-1 rounded-lg transition text-gray-400 hover:text-white';
                tabLoginBtn.className = 'px-3 py-1 rounded-lg transition bg-pink-500 text-white shadow-xs';
                formTitle.innerText = 'Welcome Back';
                switchPrompt.innerHTML = 'New to Finatrack? <button type="button" onclick="switchAuthTab(\\'signup\\')" class="text-pink-400 hover:text-pink-300 font-bold ml-1">Create Account</button>';
            }
        }
    </script>
</body>
</html>`;
}
