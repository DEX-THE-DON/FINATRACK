-- ==============================================================================
-- FINATRACK - SUPABASE POSTGRESQL SCHEMA WITH EXACT NUMERIC FINANCIAL PRECISION
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. ACCOUNTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    account_number TEXT,
    account_type TEXT NOT NULL DEFAULT 'BANK', -- 'MOBILE', 'BANK', 'SAVINGS', 'MMF', 'LOOP', 'CASH'
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Exact financial decimal
    interest_rate_p_a NUMERIC(5, 2) NOT NULL DEFAULT 0.00, -- APY % (e.g. 13.45)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. TRANSACTIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL, -- 'INCOME' or 'EXPENSE'
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    rider_log_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. SAVINGS GOALS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL,
    current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    target_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 4. MONTHLY BUDGETS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    limit_amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_budget_category UNIQUE (user_id, category)
);

-- ------------------------------------------------------------------------------
-- 5. DEBTS & LOANS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    person_name TEXT NOT NULL,
    debt_type TEXT NOT NULL, -- 'I_OWE' or 'OWED_TO_ME'
    total_amount NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'PAID', 'OVERDUE'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 6. RECURRING BILLS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'UTILITY', -- 'KPLC', 'WATER', 'INTERNET', 'RENT', 'SUBSCRIPTION', 'UTILITY'
    amount NUMERIC(12, 2) NOT NULL,
    due_day INTEGER NOT NULL DEFAULT 1,
    payment_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    last_paid_date DATE,
    is_recurring INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 7. MOTORBIKES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bikes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plate_number TEXT NOT NULL,
    model_name TEXT,
    owner_name TEXT,
    power_type TEXT NOT NULL DEFAULT 'PETROL', -- 'PETROL' or 'ELECTRIC'
    daily_target NUMERIC(12, 2) NOT NULL DEFAULT 2500.00,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_bike_plate UNIQUE (user_id, plate_number)
);

-- ------------------------------------------------------------------------------
-- 8. RIDER SHIFT LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rider_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    bike_id UUID REFERENCES bikes(id) ON DELETE SET NULL,
    power_type TEXT NOT NULL DEFAULT 'PETROL', -- 'PETROL' or 'ELECTRIC'
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TEXT, -- e.g. '11:00'
    end_time TEXT,   -- e.g. '22:00'
    shift_hours NUMERIC(4, 2) NOT NULL DEFAULT 8.00,
    trips_completed INTEGER NOT NULL DEFAULT 0,
    kilometers NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    total_earned NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    fuel_station TEXT, -- 'RUBIS', 'TOTAL', 'SHELL', 'OLA', 'HASS', 'SPIRO', 'ROAM', 'AMPERSAND', 'OTHER'
    fuel_litres NUMERIC(6, 2) DEFAULT 0.00,
    swaps_count INTEGER DEFAULT 0,
    fuel_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    food_spent NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    airtime_spent NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    maintenance_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    misc_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    earnings_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    expense_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 9. MAINTENANCE SCHEDULES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    bike_id UUID REFERENCES bikes(id) ON DELETE SET NULL,
    service_type TEXT NOT NULL DEFAULT 'Oil Change & Inspection',
    interval_weeks INTEGER NOT NULL DEFAULT 3,
    last_service_date DATE,
    next_due_date DATE,
    last_brake_pad_date DATE,
    brake_pad_cost_last NUMERIC(12, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 10. COMPLIANCE DEADLINES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compliance_deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    bike_id UUID REFERENCES bikes(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    interval_months INTEGER NOT NULL DEFAULT 12,
    last_renewed_date DATE,
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 11. BIKE FINANCING / HIRE PURCHASE TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bike_financings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    bike_id UUID REFERENCES bikes(id) ON DELETE SET NULL,
    provider_name TEXT NOT NULL, -- 'Mogo', 'Spiro', 'Watu', 'Zeno'
    daily_amount NUMERIC(12, 2) NOT NULL,
    total_cost NUMERIC(12, 2) NOT NULL,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    start_date DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' or 'PAID_OFF'
    frequency TEXT NOT NULL DEFAULT 'DAILY',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 12. DYNAMIC WATERFALL ALLOCATION RULES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS allocation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    bucket_name TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'ACCOUNT', -- 'ACCOUNT', 'GOAL', 'CASH'
    target_id UUID,
    percentage NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    icon TEXT NOT NULL DEFAULT '💰',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures each user only reads and modifies their own financial records
-- ==============================================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE bike_financings ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_rules ENABLE ROW LEVEL SECURITY;

-- Helper macro for RLS policies
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'accounts', 'transactions', 'goals', 'budgets', 'debts', 'bills',
            'bikes', 'rider_logs', 'maintenance_schedules', 'compliance_deadlines',
            'bike_financings', 'allocation_rules'
        ])
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS "user_isolation_policy" ON %I;
            CREATE POLICY "user_isolation_policy" ON %I
                FOR ALL
                USING (auth.uid() = user_id)
                WITH CHECK (auth.uid() = user_id);
        ', tbl, tbl);
    END LOOP;
END $$;

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_rider_logs_user_date ON rider_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_debts_user_status ON debts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_user_due ON bills(user_id, due_day);
