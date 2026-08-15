from datetime import date, timedelta
from decimal import Decimal
from database import engine, get_db
import models
import requests
from fastapi import Depends, FastAPI, Form, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Finatrack")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


def get_live_rate() -> float:
  try:
    res = requests.get("https://open.er-api.com/v6/latest/USD", timeout=2)
    if res.status_code == 200:
      rates = res.json().get("rates", {})
      if "KES" in rates:
        return float(rates["KES"])
  except:
    pass
  return 130.00


# --- FINANCE DASHBOARD ROUTES ---


@app.get("/")
def finance_dashboard(request: Request, db: Session = Depends(get_db)):
  account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
  accounts = db.query(account_model).all() if account_model else []
  
  transactions = (
      db.query(models.Transaction)
      .order_by(models.Transaction.date.desc())
      .all()
  ) if hasattr(models, "Transaction") else []
  
  goal_model = getattr(models, "SavingsGoal", getattr(models, "Goal", None))
  raw_goals = db.query(goal_model).all() if goal_model else []
  
  budget_model = getattr(models, "Budget", None)
  budgets = db.query(budget_model).all() if budget_model else []

  # Calculate progress percentage for each goal
  goals = []
  for g in raw_goals:
    current = float(getattr(g, "current_amount", 0) or 0)
    target = float(getattr(g, "target_amount", 1) or 1)
    percentage = round((current / target) * 100, 1) if target > 0 else 0.0
    display_percentage = min(percentage, 100.0)

    goals.append({
        "id": g.id,
        "title": getattr(g, "title", "Goal"),
        "target_amount": target,
        "current_amount": current,
        "target_date": getattr(g, "target_date", None),
        "percentage": percentage,
        "display_percentage": display_percentage,
    })

  # Calculate budget progress
  current_month = date.today().strftime("%Y-%m")
  budget_data = []
  for b in budgets:
    cat = getattr(b, "category", "")
    spent = sum(
        float(tx.amount)
        for tx in transactions
        if getattr(tx, "transaction_type", "").upper() == "EXPENSE"
        and getattr(tx, "category", "").lower() == cat.lower()
        and str(getattr(tx, "date", "")).startswith(current_month)
    )
    limit = float(getattr(b, "limit_amount", 1) or 1)
    percentage = round((spent / limit) * 100, 1) if limit > 0 else 0.0
    display_percentage = min(percentage, 100.0)
    budget_data.append({
        "id": b.id,
        "category": cat,
        "limit_amount": limit,
        "spent": spent,
        "percentage": percentage,
        "display_percentage": display_percentage,
    })

  total_balance = (
      sum([float(acc.balance) for acc in accounts]) if accounts else 0.00
  )
  usd_to_kes = get_live_rate()

  return templates.TemplateResponse(
      request,
      "finance_dashboard.html",
      {
          "accounts": accounts,
          "transactions": transactions,
          "goals": goals,
          "budgets": budget_data,
          "total_balance": total_balance,
          "usd_to_kes": usd_to_kes,
          "today": date.today(),
      },
  )


@app.post("/accounts/create")
def create_account(
    request: Request,
    name: str = Form(...),
    account_type: str = Form(...),
    balance: float = Form(0.00),
    db: Session = Depends(get_db),
):
  currency_pref = request.cookies.get("finatrack_currency", "Ksh")
  final_balance = Decimal(
      str(balance / get_live_rate() if currency_pref == "Ksh" else balance)
  )

  account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
  if account_model:
    acc = account_model(name=name, account_type=account_type, balance=final_balance)
    db.add(acc)
    db.commit()
  return RedirectResponse(url="/", status_code=303)


@app.post("/accounts/update/{acc_id}")
def update_account(
    request: Request,
    acc_id: int,
    name: str = Form(...),
    account_type: str = Form(...),
    balance: float = Form(...),
    db: Session = Depends(get_db),
):
  account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
  acc = db.query(account_model).filter(account_model.id == acc_id).first() if account_model else None
  if acc:
    currency_pref = request.cookies.get("finatrack_currency", "Ksh")
    final_balance = Decimal(
        str(balance / get_live_rate() if currency_pref == "Ksh" else balance)
    )

    acc.name = name
    acc.account_type = account_type
    acc.balance = final_balance
    db.commit()
  return RedirectResponse(url="/", status_code=303)


@app.post("/accounts/delete/{acc_id}")
def delete_account(acc_id: int, db: Session = Depends(get_db)):
  account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
  acc = db.query(account_model).filter(account_model.id == acc_id).first() if account_model else None
  if acc:
    db.delete(acc)
    db.commit()
  return RedirectResponse(url="/", status_code=303)


@app.post("/transfers/create")
def create_transfer(
    request: Request,
    from_account_id: int = Form(...),
    to_account_id: int = Form(...),
    amount: float = Form(...),
    db: Session = Depends(get_db),
):
  if from_account_id != to_account_id:
    account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
    if account_model:
      from_acc = db.query(account_model).filter(account_model.id == from_account_id).first()
      to_acc = db.query(account_model).filter(account_model.id == to_account_id).first()

      if not from_acc or not to_acc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or both selected accounts do not exist."
        )

      currency_pref = request.cookies.get("finatrack_currency", "Ksh")
      final_amount = Decimal(
          str(amount / get_live_rate() if currency_pref == "Ksh" else amount)
      )

      if Decimal(str(from_acc.balance)) >= final_amount:
        from_acc.balance = Decimal(str(from_acc.balance)) - final_amount
        to_acc.balance = Decimal(str(to_acc.balance)) + final_amount
        db.commit()

        if hasattr(models, "Transaction"):
          tx_out = models.Transaction(
              account_id=from_acc.id,
              transaction_type="EXPENSE",
              category="Transfer",
              amount=final_amount,
              description=f"Transfer to {to_acc.name}",
              date=date.today(),
          )
          db.add(tx_out)
          db.commit()

          tx_in = models.Transaction(
              account_id=to_acc.id,
              transaction_type="INCOME",
              category="Transfer",
              amount=final_amount,
              description=f"Transfer from {from_acc.name}",
              date=date.today(),
          )
          db.add(tx_in)
          db.commit()

  return RedirectResponse(url="/", status_code=303)


@app.post("/budgets/create")
def create_budget(
    request: Request,
    category: str = Form(...),
    limit_amount: float = Form(...),
    db: Session = Depends(get_db),
):
  if hasattr(models, "Budget"):
    currency_pref = request.cookies.get("finatrack_currency", "Ksh")
    final_limit = Decimal(
        str(
            limit_amount / get_live_rate()
            if currency_pref == "Ksh"
            else limit_amount
        )
    )

    existing_budget = (
        db.query(models.Budget)
        .filter(models.Budget.category.ilike(category))
        .first()
    )
    if existing_budget:
      existing_budget.limit_amount = final_limit
    else:
      new_budget = models.Budget(category=category, limit_amount=final_limit)
      db.add(new_budget)

    db.commit()
  return RedirectResponse(url="/", status_code=303)


@app.post("/transactions/create")
def create_transaction(
    request: Request,
    account_id: int = Form(...),
    transaction_type: str = Form(...),
    category: str = Form(...),
    amount: float = Form(...),
    description: str = Form(""),
    t_date: date = Form(...),
    db: Session = Depends(get_db),
):
  currency_pref = request.cookies.get("finatrack_currency", "Ksh")
  final_amount = Decimal(
      str(amount / get_live_rate() if currency_pref == "Ksh" else amount)
  )

  account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
  acc = db.query(account_model).filter(account_model.id == account_id).first() if account_model else None
  
  if not acc:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Account with ID {account_id} does not exist."
    )

  if transaction_type.upper() == "INCOME":
    acc.balance = Decimal(str(acc.balance)) + final_amount
  else:
    acc.balance = Decimal(str(acc.balance)) - final_amount
  db.commit()

  if hasattr(models, "Transaction"):
    tx = models.Transaction(
        account_id=account_id,
        transaction_type=transaction_type,
        category=category,
        amount=final_amount,
        description=description or "",
        date=t_date,
    )
    db.add(tx)
    db.commit()

  return RedirectResponse(url="/", status_code=303)


@app.post("/transactions/delete/{tx_id}")
def delete_transaction(tx_id: int, db: Session = Depends(get_db)):
  if hasattr(models, "Transaction"):
    tx = db.query(models.Transaction).filter(models.Transaction.id == tx_id).first()
    if tx:
      account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
      acc = db.query(account_model).filter(account_model.id == tx.account_id).first() if account_model else None
      if acc:
        if tx.transaction_type.upper() == "INCOME":
          acc.balance = Decimal(str(acc.balance)) - Decimal(str(tx.amount))
        else:
          acc.balance = Decimal(str(acc.balance)) + Decimal(str(tx.amount))
      db.delete(tx)
      db.commit()
  return RedirectResponse(url="/", status_code=303)


@app.post("/goals/create")
def create_goal(
    request: Request,
    title: str = Form(...),
    target_amount: float = Form(...),
    target_date: date = Form(None),
    db: Session = Depends(get_db),
):
  currency_pref = request.cookies.get("finatrack_currency", "Ksh")
  final_target = Decimal(
      str(
          target_amount / get_live_rate()
          if currency_pref == "Ksh"
          else target_amount
      )
  )

  goal_model = getattr(models, "SavingsGoal", getattr(models, "Goal", None))
  if goal_model:
    goal = goal_model(title=title, target_amount=final_target, target_date=target_date)
    db.add(goal)
    db.commit()
  return RedirectResponse(url="/", status_code=303)


@app.post("/goals/fund/{goal_id}")
def fund_goal(
    request: Request,
    goal_id: int,
    amount: float = Form(...),
    db: Session = Depends(get_db),
):
  goal_model = getattr(models, "SavingsGoal", getattr(models, "Goal", None))
  goal = db.query(goal_model).filter(goal_model.id == goal_id).first() if goal_model else None
  if goal:
    currency_pref = request.cookies.get("finatrack_currency", "Ksh")
    final_amount = Decimal(
        str(amount / get_live_rate() if currency_pref == "Ksh" else amount)
    )
    goal.current_amount = Decimal(str(goal.current_amount or 0)) + final_amount
    db.commit()
  return RedirectResponse(url="/", status_code=303)


@app.post("/goals/withdraw/{goal_id}")
def withdraw_goal(
    request: Request,
    goal_id: int,
    amount: float = Form(...),
    db: Session = Depends(get_db),
):
  goal_model = getattr(models, "SavingsGoal", getattr(models, "Goal", None))
  goal = db.query(goal_model).filter(goal_model.id == goal_id).first() if goal_model else None
  if goal:
    currency_pref = request.cookies.get("finatrack_currency", "Ksh")
    final_amount = Decimal(
        str(amount / get_live_rate() if currency_pref == "Ksh" else amount)
    )
    goal.current_amount = max(
        Decimal("0.00"), Decimal(str(goal.current_amount or 0)) - final_amount
    )
    db.commit()
  return RedirectResponse(url="/", status_code=303)


@app.post("/goals/delete/{goal_id}")
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
  goal_model = getattr(models, "SavingsGoal", getattr(models, "Goal", None))
  goal = db.query(goal_model).filter(goal_model.id == goal_id).first() if goal_model else None
  if goal:
    db.delete(goal)
    db.commit()
  return RedirectResponse(url="/", status_code=303)


# --- RIDER DASHBOARD ROUTES ---


@app.get("/rider")
def rider_dashboard(request: Request, db: Session = Depends(get_db)):
  rider_log_model = getattr(models, "RiderLog", None)
  logs = db.query(rider_log_model).order_by(rider_log_model.date.desc()).all() if rider_log_model else []
  today_date = date.today()

  def calc_totals(filtered_logs):
    earned = sum([float(l.total_earned) for l in filtered_logs])
    exp = sum([
        float(l.fuel_cost) + float(l.airtime_spent) + float(l.misc_expenses)
        for l in filtered_logs
    ])
    saved = earned - exp
    return earned, exp, saved

  daily_logs = [l for l in logs if l.date == today_date]
  d_earned, d_exp, d_saved = calc_totals(daily_logs)

  start_of_week = today_date - timedelta(days=today_date.weekday())
  weekly_logs = [l for l in logs if l.date >= start_of_week]
  w_earned, w_exp, w_saved = calc_totals(weekly_logs)

  monthly_logs = [
      l
      for l in logs
      if l.date.year == today_date.year and l.date.month == today_date.month
  ]
  m_earned, m_exp, m_saved = calc_totals(monthly_logs)

  yearly_logs = [l for l in logs if l.date.year == today_date.year]
  y_earned, y_exp, y_saved = calc_totals(yearly_logs)

  summary_data = {
      "daily_earned": d_earned,
      "daily_exp": d_exp,
      "daily_saved": d_saved,
      "weekly_earned": w_earned,
      "weekly_exp": w_exp,
      "weekly_saved": w_saved,
      "monthly_earned": m_earned,
      "monthly_exp": m_exp,
      "monthly_saved": m_saved,
      "yearly_earned": y_earned,
      "yearly_exp": y_exp,
      "yearly_saved": y_saved,
  }

  quote = {
      "text": (
          "The secret of getting ahead is getting started. The secret of"
          " getting started is breaking your complex overwhelming tasks into"
          " small manageable tasks."
      ),
      "author": "Mark Twain",
  }
  verse = {
      "text": "Commit to the LORD whatever you do, and he will establish your plans.",
      "reference": "Proverbs 16:3",
  }

  return templates.TemplateResponse(
      request,
      "rider_dashboard.html",
      {
          **summary_data,
          "logs": logs,
          "quote": quote,
          "verse": verse,
          "today": today_date,
          "usd_to_kes": get_live_rate(),
      },
  )


@app.post("/rider/logs")
def create_rider_log(
    request: Request,
    log_date: date = Form(...),
    trips_completed: int = Form(0),
    total_earned: float = Form(0.00),
    fuel_used_liters: float = Form(0.00),
    fuel_cost: float = Form(0.00),
    airtime_spent: float = Form(0.00),
    misc_expenses: float = Form(0.00),
    db: Session = Depends(get_db),
):
  currency_pref = request.cookies.get("finatrack_currency", "Ksh")
  rate = get_live_rate()

  def normalize(val):
    return Decimal(str(val / rate if currency_pref == "Ksh" else val))

  rider_log_model = getattr(models, "RiderLog", None)
  if rider_log_model:
    log = rider_log_model(
        date=log_date,
        trips_completed=trips_completed,
        total_earned=normalize(total_earned),
        fuel_used_liters=Decimal(str(fuel_used_liters)),
        fuel_cost=normalize(fuel_cost),
        airtime_spent=normalize(airtime_spent),
        misc_expenses=normalize(misc_expenses),
    )
    db.add(log)
    db.commit()

  return RedirectResponse(url="/rider", status_code=303)


@app.post("/rider/logs/delete/{log_id}")
def delete_rider_log(log_id: int, db: Session = Depends(get_db)):
  rider_log_model = getattr(models, "RiderLog", None)
  log = db.query(rider_log_model).filter(rider_log_model.id == log_id).first() if rider_log_model else None
  if log:
    db.delete(log)
    db.commit()
  return RedirectResponse(url="/rider", status_code=303)






























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