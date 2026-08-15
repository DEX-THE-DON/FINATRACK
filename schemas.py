from datetime import date
from pydantic import BaseModel


class RiderLogCreate(BaseModel):
  date: date
  trips_completed: int = 0
  fuel_used_liters: float = 0.00
  fuel_cost: float = 0.00
  airtime_spent: float = 0.00
  misc_expenses: float = 0.00
  total_earned: float = 0.00


class RiderLogResponse(RiderLogCreate):
  id: int

  class Config:
    from_attributes = True