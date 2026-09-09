from datetime import datetime
from sqlalchemy import Column, Date, DateTime, Float, Integer, String, Text
from database import Base


class Account(Base):
  __tablename__ = 'accounts'

  id = Column(Integer, primary_key=True, index=True)
  name = Column(String, index=True)
  account_number = Column(String, nullable=True, index=True)
  account_type = Column(String, default='BANK')  # MOBILE, BANK, SAVINGS, MMF, LOOP, CASH
  balance = Column(Float, default=0.0)
  interest_rate_p_a = Column(Float, default=0.0)  # Annual percentage yield (e.g. 14.5% for Sanlam MMF)


class Transaction(Base):
  __tablename__ = 'transactions'

  id = Column(Integer, primary_key=True, index=True)
  account_id = Column(Integer, index=True)
  transaction_type = Column(String)  # INCOME or EXPENSE
  category = Column(String, index=True)
  amount = Column(Float)
  date = Column(Date, nullable=False)
  description = Column(Text, nullable=True)
  rider_log_id = Column(Integer, index=True, nullable=True)


class Goal(Base):
  __tablename__ = 'goals'

  id = Column(Integer, primary_key=True, index=True)
  title = Column(String)
  target_amount = Column(Float)
  current_amount = Column(Float, default=0.0)
  target_date = Column(Date, nullable=True)


class Budget(Base):
  __tablename__ = 'budgets'

  id = Column(Integer, primary_key=True, index=True)
  category = Column(String, unique=True, index=True)
  limit_amount = Column(Float)


class Debt(Base):
  __tablename__ = 'debts'

  id = Column(Integer, primary_key=True, index=True)
  person_name = Column(String, index=True, nullable=False)
  debt_type = Column(String, nullable=False)  # 'I_OWE' or 'OWED_TO_ME'
  total_amount = Column(Float, nullable=False)
  paid_amount = Column(Float, default=0.0)
  issued_at = Column(DateTime, default=datetime.utcnow, nullable=False)
  due_at = Column(DateTime, nullable=False, index=True)
  status = Column(String, default='ACTIVE')  # 'ACTIVE', 'PAID', 'OVERDUE'
  description = Column(Text, nullable=True)


class Bill(Base):
  __tablename__ = 'bills'

  id = Column(Integer, primary_key=True, index=True)
  title = Column(String, index=True, nullable=False)  # e.g. KPLC Tokens, Nairobi Water, Zuku Wi-Fi, Rent
  category = Column(String, index=True, default='UTILITY')  # KPLC, WATER, INTERNET, RENT, SUBSCRIPTION, OTHER
  amount = Column(Float, nullable=False)
  due_day = Column(Integer, default=1)  # 1 to 31
  payment_account_id = Column(Integer, nullable=True)
  last_paid_date = Column(Date, nullable=True)
  is_recurring = Column(Integer, default=1)  # 1 = Active
  notes = Column(Text, nullable=True)


class Bike(Base):
  __tablename__ = 'bikes'

  id = Column(Integer, primary_key=True, index=True)
  plate_number = Column(String, unique=True, index=True, nullable=False)  # e.g. KMDN 456Y
  model_name = Column(String, nullable=True)  # e.g. Bajaj Boxer 150, TVS HLX 125
  owner_name = Column(String, nullable=True)
  daily_target = Column(Float, default=2500.0)
  is_active = Column(Integer, default=1)


class RiderLog(Base):
  __tablename__ = 'rider_logs'

  id = Column(Integer, primary_key=True, index=True)
  bike_id = Column(Integer, index=True, nullable=True)
  date = Column(Date, nullable=False, index=True)
  trips_completed = Column(Integer, default=0)
  kilometers = Column(Float, default=0.0)
  total_earned = Column(Float, default=0.0)
  fuel_used_liters = Column(Float, default=0.0)
  fuel_cost = Column(Float, default=0.0)
  fuel_station = Column(String, nullable=True)  # RUBIS, TOTAL, SHELL, OLA, HASS, OTHER
  fuel_litres = Column(Float, nullable=True)
  shift_hours = Column(Float, default=8.0)
  airtime_spent = Column(Float, default=0.0)
  food_spent = Column(Float, default=0.0)
  misc_expenses = Column(Float, default=0.0)
  maintenance_cost = Column(Float, default=0.0)
  earnings_account_id = Column(Integer, nullable=True)
  expense_account_id = Column(Integer, nullable=True)


class MaintenanceSchedule(Base):
  __tablename__ = 'maintenance_schedules'

  id = Column(Integer, primary_key=True, index=True)
  bike_id = Column(Integer, index=True, nullable=True)
  service_type = Column(String, default='Oil Change & Inspection')
  interval_weeks = Column(Integer, default=3)  # 3 or 4 weeks
  last_service_date = Column(Date, nullable=True)
  next_due_date = Column(Date, nullable=True)
  last_brake_pad_date = Column(Date, nullable=True)
  brake_pad_cost_last = Column(Float, default=0.0)
  notes = Column(Text, nullable=True)


class ComplianceDeadline(Base):
  __tablename__ = 'compliance_deadlines'

  id = Column(Integer, primary_key=True, index=True)
  bike_id = Column(Integer, index=True, nullable=True)
  title = Column(String, nullable=False)  # e.g., 'Driving License', 'Motorbike Insurance'
  interval_months = Column(Integer, default=12)  # 6 or 12 months
  last_renewed_date = Column(Date, nullable=True)
  expiry_date = Column(Date, nullable=True)
  notes = Column(Text, nullable=True)


class BikeFinancing(Base):
  __tablename__ = 'bike_financings'

  id = Column(Integer, primary_key=True, index=True)
  bike_id = Column(Integer, index=True, nullable=True)
  provider_name = Column(String, nullable=False)  # Mogo, Spiro, Watu, Zeno
  daily_amount = Column(Float, nullable=False)
  total_cost = Column(Float, nullable=False)
  paid_amount = Column(Float, default=0.0)
  start_date = Column(Date, nullable=True)
  status = Column(String, default='ACTIVE')  # ACTIVE or PAID_OFF
  frequency = Column(String, default='DAILY')
  notes = Column(Text, nullable=True)


class AllocationRule(Base):
  __tablename__ = 'allocation_rules'

  id = Column(Integer, primary_key=True, index=True)
  bucket_name = Column(String, nullable=False)  # e.g. 'Ziidi MMF', 'Lock Savings', 'Emergency Goal', 'Bills Reserve', 'Daily Expenses'
  target_type = Column(String, default='ACCOUNT')  # 'ACCOUNT', 'GOAL', 'CASH'
  target_id = Column(Integer, nullable=True)  # Account ID or Goal ID
  percentage = Column(Float, default=20.0)  # e.g. 20.0%
  icon = Column(String, default='💰')  # 📈, 🔒, 🎯, ⚡, 💵
  is_active = Column(Integer, default=1)


# Aliases for backward compatibility
FinanceAccount = Account
SavingsGoal = Goal
