import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

export interface AppEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ENVIRONMENT?: string;
}

// In-memory store for local testing when cloud Supabase credentials are not yet supplied
const inMemoryStore: Record<string, any[]> = {
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

function createMockClient() {
  return {
    auth: {
      async signUp({ email, password }: any) { return { data: { user: { id: 'local-user', email } }, error: null }; },
      async signInWithPassword({ email, password }: any) { return { data: { session: { access_token: 'mock-token', expires_in: 3600 } }, error: null }; },
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

export function getSupabaseClient(env?: AppEnv, authHeader?: string): SupabaseClient<any> {
  const envObj = env || {};
  const procEnv = typeof process !== 'undefined' && process.env ? process.env : ({} as Record<string, string | undefined>);
  let url = envObj.SUPABASE_URL || procEnv.SUPABASE_URL;
  const key = envObj.SUPABASE_ANON_KEY || procEnv.SUPABASE_ANON_KEY;

  if (!url || !key || url.includes('placeholder')) {
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
    },
  });
}
