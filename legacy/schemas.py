from datetime import date
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AccountBase(BaseModel):
  name: str
  account_number: Optional[str] = None
  account_type: str = "BANK"
  balance: float = 0.0
  interest_rate_p_a: float = 0.0


class AccountCreate(AccountBase):
  pass


class AccountResponse(AccountBase):
  id: int
  model_config = ConfigDict(from_attributes=True)


class TransactionBase(BaseModel):
  account_id: int
  transaction_type: str  # INCOME or EXPENSE
  category: str
  amount: float
  date: date
  description: Optional[str] = None
  rider_log_id: Optional[int] = None


class TransactionCreate(TransactionBase):
  pass


class TransactionResponse(TransactionBase):
  id: int
  model_config = ConfigDict(from_attributes=True)


class BudgetBase(BaseModel):
  category: str
  limit_amount: float


class BudgetCreate(BudgetBase):
  pass


class BudgetResponse(BudgetBase):
  id: int
  model_config = ConfigDict(from_attributes=True)


class GoalBase(BaseModel):
  title: str
  target_amount: float
  current_amount: float = 0.0
  target_date: Optional[date] = None


class GoalCreate(GoalBase):
  pass


class GoalResponse(GoalBase):
  id: int
  model_config = ConfigDict(from_attributes=True)


class BillBase(BaseModel):
  title: str
  category: str = "UTILITY"
  amount: float
  due_day: int = 1
  payment_account_id: Optional[int] = None
  last_paid_date: Optional[date] = None
  is_recurring: int = 1
  notes: Optional[str] = None


class BillCreate(BillBase):
  pass


class BillResponse(BillBase):
  id: int
  model_config = ConfigDict(from_attributes=True)


class BikeBase(BaseModel):
  plate_number: str
  model_name: Optional[str] = None
  owner_name: Optional[str] = None
  daily_target: float = 2500.0
  is_active: int = 1


class BikeCreate(BikeBase):
  pass


class BikeResponse(BikeBase):
  id: int
  model_config = ConfigDict(from_attributes=True)


class RiderLogBase(BaseModel):
  bike_id: Optional[int] = None
  date: date
  trips_completed: int = 0
  kilometers: float = 0.00
  total_earned: float = 0.00
  fuel_used_liters: float = 0.00
  fuel_cost: float = 0.00
  fuel_station: Optional[str] = None
  fuel_litres: Optional[float] = None
  start_time: Optional[str] = None
  end_time: Optional[str] = None
  shift_hours: float = 8.0
  airtime_spent: float = 0.00
  food_spent: float = 0.00
  misc_expenses: float = 0.00
  maintenance_cost: float = 0.00
  earnings_account_id: Optional[int] = None
  expense_account_id: Optional[int] = None


class RiderLogCreate(RiderLogBase):
  pass


class RiderLogResponse(RiderLogBase):
  id: int
  model_config = ConfigDict(from_attributes=True)


class DebtBase(BaseModel):
  person_name: str
  debt_type: str  # 'I_OWE' or 'OWED_TO_ME'
  total_amount: float
  paid_amount: float = 0.0
  status: str = "ACTIVE"
  description: Optional[str] = None


class DebtCreate(DebtBase):
  due_at: str
  issued_at: Optional[str] = None


class DebtRepay(BaseModel):
  amount: float


class DebtResponse(DebtBase):
  id: int
  model_config = ConfigDict(from_attributes=True)
