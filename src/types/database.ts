export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          account_number: string | null;
          account_type: string;
          balance: number;
          interest_rate_p_a: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          account_number?: string | null;
          account_type?: string;
          balance?: number;
          interest_rate_p_a?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          account_number?: string | null;
          account_type?: string;
          balance?: number;
          interest_rate_p_a?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string | null;
          account_id: string | null;
          transaction_type: string;
          category: string;
          amount: number;
          date: string;
          description: string | null;
          rider_log_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          account_id?: string | null;
          transaction_type: string;
          category: string;
          amount: number;
          date?: string;
          description?: string | null;
          rider_log_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          account_id?: string | null;
          transaction_type?: string;
          category?: string;
          amount?: number;
          date?: string;
          description?: string | null;
          rider_log_id?: string | null;
          created_at?: string;
        };
      };
      goals: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          target_amount: number;
          current_amount: number;
          target_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          target_amount: number;
          current_amount?: number;
          target_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          target_amount?: number;
          current_amount?: number;
          target_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      budgets: {
        Row: {
          id: string;
          user_id: string | null;
          category: string;
          limit_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          category: string;
          limit_amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          category?: string;
          limit_amount?: number;
          created_at?: string;
        };
      };
      debts: {
        Row: {
          id: string;
          user_id: string | null;
          person_name: string;
          debt_type: string;
          total_amount: number;
          paid_amount: number;
          issued_at: string;
          due_at: string;
          status: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          person_name: string;
          debt_type: string;
          total_amount: number;
          paid_amount?: number;
          issued_at?: string;
          due_at: string;
          status?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          person_name?: string;
          debt_type?: string;
          total_amount?: number;
          paid_amount?: number;
          issued_at?: string;
          due_at?: string;
          status?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      bills: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          category: string;
          amount: number;
          due_day: number;
          payment_account_id: string | null;
          last_paid_date: string | null;
          is_recurring: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          category?: string;
          amount: number;
          due_day?: number;
          payment_account_id?: string | null;
          last_paid_date?: string | null;
          is_recurring?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          category?: string;
          amount?: number;
          due_day?: number;
          payment_account_id?: string | null;
          last_paid_date?: string | null;
          is_recurring?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      bikes: {
        Row: {
          id: string;
          user_id: string | null;
          plate_number: string;
          model_name: string | null;
          owner_name: string | null;
          power_type: 'PETROL' | 'ELECTRIC';
          daily_target: number;
          is_active: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          plate_number: string;
          model_name?: string | null;
          owner_name?: string | null;
          power_type?: 'PETROL' | 'ELECTRIC';
          daily_target?: number;
          is_active?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          plate_number?: string;
          model_name?: string | null;
          owner_name?: string | null;
          power_type?: 'PETROL' | 'ELECTRIC';
          daily_target?: number;
          is_active?: number;
          created_at?: string;
        };
      };
      rider_logs: {
        Row: {
          id: string;
          user_id: string | null;
          bike_id: string | null;
          power_type: string | null;
          date: string;
          start_time: string | null;
          end_time: string | null;
          shift_hours: number;
          trips_completed: number;
          kilometers: number;
          total_earned: number;
          fuel_station: string | null;
          fuel_litres: number | null;
          swaps_count: number | null;
          fuel_cost: number;
          food_spent: number;
          airtime_spent: number;
          maintenance_cost: number;
          misc_expenses: number;
          earnings_account_id: string | null;
          expense_account_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          bike_id?: string | null;
          power_type?: string | null;
          date: string;
          start_time?: string | null;
          end_time?: string | null;
          shift_hours?: number;
          trips_completed?: number;
          kilometers?: number;
          total_earned?: number;
          fuel_station?: string | null;
          fuel_litres?: number | null;
          swaps_count?: number | null;
          fuel_cost?: number;
          food_spent?: number;
          airtime_spent?: number;
          maintenance_cost?: number;
          misc_expenses?: number;
          earnings_account_id?: string | null;
          expense_account_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          bike_id?: string | null;
          power_type?: string | null;
          date?: string;
          start_time?: string | null;
          end_time?: string | null;
          shift_hours?: number;
          trips_completed?: number;
          kilometers?: number;
          total_earned?: number;
          fuel_station?: string | null;
          fuel_litres?: number | null;
          swaps_count?: number | null;
          fuel_cost?: number;
          food_spent?: number;
          airtime_spent?: number;
          maintenance_cost?: number;
          misc_expenses?: number;
          earnings_account_id?: string | null;
          expense_account_id?: string | null;
          created_at?: string;
        };
      };
      maintenance_schedules: {
        Row: {
          id: string;
          user_id: string | null;
          bike_id: string | null;
          service_type: string;
          interval_weeks: number;
          last_service_date: string | null;
          next_due_date: string | null;
          last_brake_pad_date: string | null;
          brake_pad_cost_last: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          bike_id?: string | null;
          service_type?: string;
          interval_weeks?: number;
          last_service_date?: string | null;
          next_due_date?: string | null;
          last_brake_pad_date?: string | null;
          brake_pad_cost_last?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          bike_id?: string | null;
          service_type?: string;
          interval_weeks?: number;
          last_service_date?: string | null;
          next_due_date?: string | null;
          last_brake_pad_date?: string | null;
          brake_pad_cost_last?: number | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      compliance_deadlines: {
        Row: {
          id: string;
          user_id: string | null;
          bike_id: string | null;
          title: string;
          interval_months: number;
          last_renewed_date: string | null;
          expiry_date: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          bike_id?: string | null;
          title: string;
          interval_months?: number;
          last_renewed_date?: string | null;
          expiry_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          bike_id?: string | null;
          title?: string;
          interval_months?: number;
          last_renewed_date?: string | null;
          expiry_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      bike_financings: {
        Row: {
          id: string;
          user_id: string | null;
          bike_id: string | null;
          provider_name: string;
          daily_amount: number;
          total_cost: number;
          paid_amount: number;
          start_date: string | null;
          status: string;
          frequency: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          bike_id?: string | null;
          provider_name: string;
          daily_amount: number;
          total_cost: number;
          paid_amount?: number;
          start_date?: string | null;
          status?: string;
          frequency?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          bike_id?: string | null;
          provider_name?: string;
          daily_amount?: number;
          total_cost?: number;
          paid_amount?: number;
          start_date?: string | null;
          status?: string;
          frequency?: string;
          notes?: string | null;
          created_at?: string;
        };
      };
      allocation_rules: {
        Row: {
          id: string;
          user_id: string | null;
          bucket_name: string;
          target_type: string;
          target_id: string | null;
          percentage: number;
          icon: string;
          is_active: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          bucket_name: string;
          target_type?: string;
          target_id?: string | null;
          percentage?: number;
          icon?: string;
          is_active?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          bucket_name?: string;
          target_type?: string;
          target_id?: string | null;
          percentage?: number;
          icon?: string;
          is_active?: number;
          created_at?: string;
        };
      };
    };
  };
}
