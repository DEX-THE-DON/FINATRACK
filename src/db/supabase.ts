import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

export interface AppEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ENVIRONMENT?: string;
  PAYSTACK_PUBLIC_KEY?: string;
  PAYSTACK_SECRET_KEY?: string;
  PAYSTACK_PAYWALL_EMAIL?: string;
  PAYSTACK_SHIFT_FEE_KES?: string;
}

// In-memory store for local testing when cloud Supabase credentials are not yet supplied
export const inMemoryStore: Record<string, any[]> = {
  users: [
    {
      id: 'usr-dex',
      email: 'dex@gmail.com',
      password: '', // will accept initial password or matched password
      user_metadata: { full_name: 'Dex', name: 'Dex' },
      created_at: new Date().toISOString(),
    }
  ],
  accounts: [],
  transactions: [],
  goals: [],
  budgets: [],
  debts: [],
  bills: [],
  bikes: [],
  rider_logs: [],
  maintenance_schedules: [],
  compliance_deadlines: [],
  bike_financings: [],
  allocation_rules: [
    { id: '1', bucket_name: 'Ziidi MMF (Safaricom)', target_type: 'ACCOUNT', percentage: 20.0, icon: '📈', is_active: 1 },
    { id: '2', bucket_name: 'Lock / Sacco Savings', target_type: 'ACCOUNT', percentage: 20.0, icon: '🔒', is_active: 1 },
    { id: '3', bucket_name: 'Savings Goals', target_type: 'GOAL', percentage: 15.0, icon: '🎯', is_active: 1 },
    { id: '4', bucket_name: 'Recurring Bills Reserve', target_type: 'ACCOUNT', percentage: 15.0, icon: '⚡', is_active: 1 },
    { id: '5', bucket_name: 'Daily Living Expenses', target_type: 'CASH', percentage: 30.0, icon: '💵', is_active: 1 }
  ],
};

export function createMockClient() {
  return {
    __isMock: true,
    auth: {
      async signUp({ email, password, options }: any) {
        const normEmail = String(email || '').toLowerCase().trim();
        const existing = (inMemoryStore.users || []).find((u: any) => u.email.toLowerCase() === normEmail);
        if (existing && existing.password && existing.password !== password) {
          return { data: { user: null, session: null }, error: { message: 'Email already registered. Please log in.' } };
        }
        const user = existing || {
          id: `usr-${Date.now()}`,
          email: normEmail,
          password,
          user_metadata: options?.data || { full_name: normEmail.split('@')[0] },
          created_at: new Date().toISOString(),
        };
        user.password = password;
        if (!existing) inMemoryStore.users.push(user);
        const session = { access_token: `mock-token-${user.id}`, expires_in: 604800 };
        return { data: { user, session }, error: null };
      },
      async signInWithPassword({ email, password }: any) {
        const normEmail = String(email || '').toLowerCase().trim();
        const user = (inMemoryStore.users || []).find((u: any) => u.email.toLowerCase() === normEmail);
        if (!user) {
          const newUser = {
            id: `usr-${Date.now()}`,
            email: normEmail,
            password,
            user_metadata: { full_name: normEmail.split('@')[0] },
            created_at: new Date().toISOString(),
          };
          inMemoryStore.users.push(newUser);
          const session = { access_token: `mock-token-${newUser.id}`, expires_in: 604800 };
          return { data: { user: newUser, session }, error: null };
        }
        if (user.password && user.password !== password) {
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials. Incorrect password.' } };
        }
        if (!user.password) {
          user.password = password; // bind initial password
        }
        const session = { access_token: `mock-token-${user.id}`, expires_in: 604800 };
        return { data: { user, session }, error: null };
      },
      async getUser(token: string) {
        if (!token) return { data: { user: null }, error: { message: 'Invalid token' } };
        const userId = token.replace(/^mock-token-/, '');
        const user = (inMemoryStore.users || []).find((u: any) => u.id === userId || token.includes(u.id)) || inMemoryStore.users[0];
        if (user) {
          return { data: { user }, error: null };
        }
        return { data: { user: null }, error: { message: 'User not found' } };
      }
    },
    from(table: string) {
      if (!inMemoryStore[table]) inMemoryStore[table] = [];
      let currentData = [...inMemoryStore[table]];

      const builder: any = {
        select(cols = '*') {
          return builder;
        },
        order(col: string, { ascending = true } = {}) {
          currentData.sort((a, b) => {
            if (a[col] < b[col]) return ascending ? -1 : 1;
            if (a[col] > b[col]) return ascending ? 1 : -1;
            return 0;
          });
          return builder;
        },
        limit(n: number) {
          currentData = currentData.slice(0, n);
          return builder;
        },
        eq(col: string, val: any) {
          currentData = currentData.filter((r) => r[col] === val);
          return builder;
        },
        neq(col: string, val: any) {
          currentData = currentData.filter((r) => r[col] !== val);
          return builder;
        },
        is(col: string, val: any) {
          currentData = currentData.filter((r) => r[col] === val || (val === null && (r[col] === null || r[col] === undefined)));
          return builder;
        },
        async single() {
          return { data: currentData[0] || null, error: null };
        },
        insert(items: any) {
          const list = Array.isArray(items) ? items : [items];
          const created = list.map((item) => ({
            id: item.id || `mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            created_at: new Date().toISOString(),
            ...item,
          }));
          inMemoryStore[table].push(...created);
          return {
            select(cols?: string) {
              return {
                single: async () => ({ data: created[0] || null, error: null }),
                then: (resolve: any) => resolve({ data: Array.isArray(items) ? created : created[0], error: null })
              };
            },
            single: async () => ({ data: created[0] || null, error: null }),
            then: (resolve: any) => resolve({ data: Array.isArray(items) ? created : created[0], error: null })
          };
        },
        update(values: any) {
          return {
            eq: (col: string, val: any) => {
              inMemoryStore[table] = inMemoryStore[table].map((r) => r[col] === val ? { ...r, ...values } : r);
              return {
                select: () => ({ single: async () => ({ data: values, error: null }) }),
                then: (resolve: any) => resolve({ data: values, error: null })
              };
            },
            neq: (col: string, val: any) => {
              inMemoryStore[table] = inMemoryStore[table].map((r) => r[col] !== val ? { ...r, ...values } : r);
              return {
                select: () => ({ single: async () => ({ data: values, error: null }) }),
                then: (resolve: any) => resolve({ data: values, error: null })
              };
            },
            then: (resolve: any) => resolve({ data: null, error: null })
          };
        },
        delete() {
          return {
            eq: (col: string, val: any) => {
              inMemoryStore[table] = inMemoryStore[table].filter((r) => r[col] !== val);
              return {
                then: (resolve: any) => resolve({ data: null, error: null })
              };
            },
            neq: (col: string, val: any) => {
              inMemoryStore[table] = inMemoryStore[table].filter((r) => r[col] === val);
              return {
                then: (resolve: any) => resolve({ data: null, error: null })
              };
            },
            then: (resolve: any) => resolve({ data: null, error: null })
          };
        },
        upsert(values: any) {
          const item = {
            id: values.id || `mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            ...values,
          };
          const idx = inMemoryStore[table].findIndex(r => r.category && r.category === values.category);
          if (idx >= 0) inMemoryStore[table][idx] = { ...inMemoryStore[table][idx], ...item };
          else inMemoryStore[table].push(item);
          return {
            then: (resolve: any) => resolve({ data: item, error: null })
          };
        },
        then(resolve: any) {
          resolve({ data: currentData, error: null });
        }
      };

      return builder;
    }
  };
}

let isSupabaseHealthy = true;
let lastHealthCheck = 0;

export function markSupabaseUnhealthy() {
  isSupabaseHealthy = false;
  lastHealthCheck = Date.now();
}

export function getSupabaseClient(env?: AppEnv, authHeader?: string): SupabaseClient<any> {
  const envObj = env || {};
  const procEnv = typeof process !== 'undefined' && process.env ? process.env : ({} as Record<string, string | undefined>);
  let url = envObj.SUPABASE_URL || procEnv.SUPABASE_URL;
  const key = envObj.SUPABASE_ANON_KEY || procEnv.SUPABASE_ANON_KEY;

  if (!url || !key || url.includes('placeholder')) {
    return createMockClient() as any;
  }

  // Circuit breaker: if Supabase was marked offline/unreachable recently (within 5 minutes), fallback immediately
  if (!isSupabaseHealthy && (Date.now() - lastHealthCheck < 300000)) {
    return createMockClient() as any;
  }

  // Strip trailing /rest/v1 or trailing slash so createClient gets the proper base URL
  url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
      fetch: (input: any, init: any) => {
        // Enforce a strict 2000ms timeout so unreachable remote URLs never hang edge/mobile requests
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => {
          markSupabaseUnhealthy();
          controller.abort();
        }, 2000) : null;
        const fetchOpts = controller && init ? { ...init, signal: controller.signal } : init;
        return fetch(input, fetchOpts)
          .catch((err: any) => {
            markSupabaseUnhealthy();
            throw err;
          })
          .finally(() => {
            if (timer) clearTimeout(timer);
          });
      }
    },
  });
}

export async function getRequestContext(c: any) {
  const env = c.env || {};
  const cookieHeader = c.req.header('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((s: string) => {
      const idx = s.indexOf('=');
      return idx > -1 ? [s.slice(0, idx).trim(), s.slice(idx + 1).trim()] : [s.trim(), ''];
    })
  );

  const token = cookies['sb-access-token'] || c.req.header('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const isMockToken = token.startsWith('mock-token-');
  const authHeader = token && !isMockToken ? `Bearer ${token}` : undefined;
  let supabase = getSupabaseClient(env, authHeader);

  let user: any = null;
  let username = '';
  let email = '';
  let isLoggedIn = false;

  if (token) {
    let verified = false;
    // Attempt remote Supabase verification if not explicitly a mock token
    if (!isMockToken) {
      try {
        const { data: userData, error } = await supabase.auth.getUser(token);
        if (!error && userData?.user) {
          user = userData.user;
          isLoggedIn = true;
          email = userData.user.email || '';
          username = userData.user.user_metadata?.full_name || email.split('@')[0] || 'Member';
          verified = true;
        }
      } catch (e) {
        // Supabase network failure or offline in sandbox
        supabase = getSupabaseClient(env, authHeader);
      }
    }

    // Fallback to local / mock store if remote verification failed
    if (!verified) {
      const mock = createMockClient();
      const { data: mockData } = await mock.auth.getUser(token);
      if (mockData?.user) {
        user = mockData.user;
        isLoggedIn = true;
        email = user.email || '';
        username = user.user_metadata?.full_name || email.split('@')[0] || 'Member';
        verified = true;
      }
    }

    // Fallback if session cookies finatrack_user / finatrack_email are present
    if (!verified && (cookies['finatrack_user'] || cookies['finatrack_email'])) {
      const cookieEmail = cookies['finatrack_email'] ? decodeURIComponent(cookies['finatrack_email']) : 'dex@gmail.com';
      const cookieUser = cookies['finatrack_user'] ? decodeURIComponent(cookies['finatrack_user']) : cookieEmail.split('@')[0];
      user = {
        id: 'usr-' + (cookieEmail === 'dex@gmail.com' ? 'dex' : 'session'),
        email: cookieEmail,
        user_metadata: { full_name: cookieUser, name: cookieUser },
      };
      isLoggedIn = true;
      email = cookieEmail;
      username = cookieUser;
    }
  }

  // Restore authenticated session from cookies if user was signed in
  if (!isLoggedIn && (cookies['finatrack_user'] || cookies['finatrack_email'])) {
    const cookieEmail = cookies['finatrack_email'] ? decodeURIComponent(cookies['finatrack_email']) : 'dex@gmail.com';
    const cookieUser = cookies['finatrack_user'] ? decodeURIComponent(cookies['finatrack_user']) : cookieEmail.split('@')[0];
    user = {
      id: 'usr-' + (cookieEmail === 'dex@gmail.com' ? 'dex' : 'session'),
      email: cookieEmail,
      user_metadata: { full_name: cookieUser, name: cookieUser },
    };
    isLoggedIn = true;
    email = cookieEmail;
    username = cookieUser;
  }

  if (!username && cookies['finatrack_user']) {
    try {
      username = decodeURIComponent(cookies['finatrack_user']);
    } catch (_) {}
  }

  if (!email && cookies['finatrack_email']) {
    try {
      email = decodeURIComponent(cookies['finatrack_email']);
    } catch (_) {}
  }

  if (!email && username && username.toLowerCase() === 'dex') {
    email = 'dex@gmail.com';
  }

  const rawId = user?.id ? String(user.id) : null;
  const isValidUuid = rawId ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId) : false;
  const isMockClient = Boolean((supabase as any)?.__isMock);
  const effectiveUserId = isValidUuid ? rawId : (isMockClient ? rawId : null);

  return {
    supabase,
    user,
    userId: effectiveUserId,
    isLoggedIn,
    username: username || 'Member',
    email,
    token,
  };
}

