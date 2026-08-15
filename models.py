from sqlalchemy import Column, Date, DateTime, Float, Integer, String, Text
from database import Base  # Assuming your database.py sets up Base and engine


class Account(Base):
  __tablename__ = 'accounts'

  id = Column(Integer, primary_key=True, index=True)
  name = Column(String, index=True)
  account_type = Column(String, default='BANK')  # MOBILE, BANK, CASH
  balance = Column(Float, default=0.0)


class Transaction(Base):
  __tablename__ = 'transactions'

  id = Column(Integer, primary_key=True, index=True)
  account_id = Column(Integer)
  transaction_type = Column(String)  # INCOME or EXPENSE
  category = Column(String, index=True)
  amount = Column(Float)
  date = Column(String)  # YYYY-MM-DD
  description = Column(Text, nullable=True)


class RiderLog(Base):
  __tablename__ = 'rider_logs'

  id = Column(Integer, primary_key=True, index=True)
  date = Column(Date, nullable=False)
  trips_completed = Column(Integer, default=0)
  total_earned = Column(Float, default=0.0)
  fuel_used_liters = Column(Float, default=0.0)
  fuel_cost = Column(Float, default=0.0)
  airtime_spent = Column(Float, default=0.0)
  misc_expenses = Column(Float, default=0.0)


class Goal(Base):
  __tablename__ = 'goals'

  id = Column(Integer, primary_key=True, index=True)
  title = Column(String)
  target_amount = Column(Float)
  current_amount = Column(Float, default=0.0)
  target_date = Column(String, nullable=True)


class Budget(Base):
  __tablename__ = 'budgets'

  id = Column(Integer, primary_key=True, index=True)
  category = Column(String, unique=True, index=True)
  limit_amount = Column(Float)



class RiderLog(Base):
  __tablename__ = 'rider_logs'
  __table_args__ = {'extend_existing': True}

  id = Column(Integer, primary_key=True, index=True)
  date = Column(Date, nullable=False)
  trips_completed = Column(Integer, default=0)
  kilometers = Column(Float, default=0.0)
  total_earned = Column(Float, default=0.0)
  fuel_used_liters = Column(Float, default=0.0)
  fuel_cost = Column(Float, default=0.0)
  airtime_spent = Column(Float, default=0.0)
  misc_expenses = Column(Float, default=0.0)
  maintenance_cost = Column(Float, default=0.0)