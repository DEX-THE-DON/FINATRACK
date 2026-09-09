from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional
from database import engine, get_db
import models
import re
import requests
import urllib.parse
import weasyprint
from fastapi import Depends, FastAPI, Form, HTTPException, Request, Response, status
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import text
from sqlalchemy.orm import Session

# Create database tables & auto-migrate new columns
models.Base.metadata.create_all(bind=engine)
try:
  with engine.connect() as conn:
    conn.execute(text("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_number VARCHAR;"))
    conn.execute(text("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS interest_rate_p_a FLOAT DEFAULT 0.0;"))
    conn.execute(text("ALTER TABLE rider_logs ADD COLUMN IF NOT EXISTS bike_id INTEGER;"))
    conn.execute(text("ALTER TABLE rider_logs ADD COLUMN IF NOT EXISTS fuel_station VARCHAR;"))
    conn.execute(text("ALTER TABLE rider_logs ADD COLUMN IF NOT EXISTS fuel_litres FLOAT;"))
    conn.execute(text("ALTER TABLE rider_logs ADD COLUMN IF NOT EXISTS shift_hours FLOAT DEFAULT 8.0;"))
    conn.execute(text("ALTER TABLE rider_logs ADD COLUMN IF NOT EXISTS earnings_account_id INTEGER;"))
    conn.execute(text("ALTER TABLE rider_logs ADD COLUMN IF NOT EXISTS expense_account_id INTEGER;"))
    conn.execute(text("ALTER TABLE maintenance_schedules ADD COLUMN IF NOT EXISTS bike_id INTEGER;"))
    conn.execute(text("ALTER TABLE compliance_deadlines ADD COLUMN IF NOT EXISTS bike_id INTEGER;"))
    conn.execute(text("ALTER TABLE bike_financings ADD COLUMN IF NOT EXISTS bike_id INTEGER;"))
    conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rider_log_id INTEGER;"))
    conn.commit()

    # Seed default bike if empty
    res_bike = conn.execute(text("SELECT COUNT(*) FROM bikes;")).scalar()
    if res_bike == 0:
      conn.execute(text("""
        INSERT INTO bikes (plate_number, model_name, owner_name, daily_target, is_active)
        VALUES ('KMDN 456Y', 'Bajaj Boxer 150 UG', 'Dennis', 2500.0, 1);
      """))
      conn.commit()

    # Seed default recurring bills if empty
    res_bill = conn.execute(text("SELECT COUNT(*) FROM bills;")).scalar()
    if res_bill == 0:
      conn.execute(text("""
        INSERT INTO bills (title, category, amount, due_day, is_recurring, notes)
        VALUES 
        ('KPLC Prepaid Electricity Tokens', 'KPLC', 1500.0, 5, 1, 'Meter # 142389102'),
        ('Nairobi Water & Sewerage', 'WATER', 650.0, 10, 1, 'Acc # 00192837'),
        ('Home Wi-Fi Fiber (Safaricom / Zuku)', 'INTERNET', 2999.0, 15, 1, 'Monthly unlimited internet');
      """))
      conn.commit()

    # Seed Ziidi MMF (Safaricom) account if not present
    res_ziidi = conn.execute(text("SELECT COUNT(*) FROM accounts WHERE name ILIKE '%Ziidi%';")).scalar()
    if res_ziidi == 0:
      conn.execute(text("""
        INSERT INTO accounts (name, account_number, account_type, balance, interest_rate_p_a)
        VALUES ('Ziidi MMF (Safaricom)', 'M-PESA-GROW', 'MMF', 5000.0, 13.5);
      """))
      conn.commit()

    # Seed default maintenance schedule if empty
    res_maint = conn.execute(text("SELECT COUNT(*) FROM maintenance_schedules;")).scalar()
    if res_maint == 0:
      t_now = date.today().isoformat()
      next_d = (date.today() + timedelta(weeks=3)).isoformat()
      conn.execute(text(f"""
        INSERT INTO maintenance_schedules (service_type, interval_weeks, last_service_date, next_due_date, last_brake_pad_date, notes)
        VALUES ('Oil Change, Chain Lube & Brake Pad Check', 3, '{t_now}', '{next_d}', '{t_now}', 'Standard 3-4 week preventive service bundle');
      """))
      conn.commit()

    # Seed default compliance deadlines if empty
    res_comp = conn.execute(text("SELECT COUNT(*) FROM compliance_deadlines;")).scalar()
    if res_comp == 0:
      t_now = date.today().isoformat()
      dl_exp = (date.today() + timedelta(days=365)).isoformat()
      ins_exp = (date.today() + timedelta(days=180)).isoformat()
      conn.execute(text(f"""
        INSERT INTO compliance_deadlines (title, interval_months, last_renewed_date, expiry_date, notes)
        VALUES 
        ('Driving License (DL)', 12, '{t_now}', '{dl_exp}', 'Class A2 Boda Boda License'),
        ('Motorbike Commercial Insurance', 6, '{t_now}', '{ins_exp}', 'PSV Passenger / Boda Insurance Cover');
      """))
      conn.commit()
except Exception as err:
  print(f"Schema migration/seed note: {err}")

app = FastAPI(title="Finatrack")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/manifest.json")
def pwa_manifest():
  return FileResponse(
      "static/manifest.json", media_type="application/manifest+json"
  )


@app.get("/sw.js")
def pwa_service_worker():
  return FileResponse(
      "static/sw.js",
      media_type="application/javascript",
      headers={"Service-Worker-Allowed": "/"},
  )


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
      .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
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

  # Calculate budget progress and monthly income/expense
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

  monthly_income = sum(
      float(tx.amount)
      for tx in transactions
      if getattr(tx, "transaction_type", "").upper() == "INCOME"
      and str(getattr(tx, "date", "")).startswith(current_month)
  )
  monthly_expense = sum(
      float(tx.amount)
      for tx in transactions
      if getattr(tx, "transaction_type", "").upper() == "EXPENSE"
      and str(getattr(tx, "date", "")).startswith(current_month)
  )

  # Process Debts and Loans
  raw_debts = (
      db.query(models.Debt).order_by(models.Debt.due_at.asc()).all()
      if hasattr(models, "Debt")
      else []
  )
  now = datetime.now()
  processed_debts = []
  total_i_owe = 0.0
  total_owed_to_me = 0.0
  overdue_alerts = []

  for d in raw_debts:
    tot = float(d.total_amount or 0.0)
    paid = float(d.paid_amount or 0.0)
    remaining = max(0.0, tot - paid)
    pct = round((paid / tot) * 100, 1) if tot > 0 else 0.0
    display_pct = min(100.0, max(0.0, pct))

    try:
      if isinstance(d.due_at, datetime):
        due_dt = d.due_at
      elif d.due_at:
        due_dt = datetime.fromisoformat(str(d.due_at).replace(" ", "T"))
      else:
        due_dt = now + timedelta(days=7)
    except Exception:
      due_dt = now + timedelta(days=7)

    try:
      if isinstance(d.issued_at, datetime):
        issued_dt = d.issued_at
      elif d.issued_at:
        issued_dt = datetime.fromisoformat(str(d.issued_at).replace(" ", "T"))
      else:
        issued_dt = now
    except Exception:
      issued_dt = now

    is_settled = remaining <= 0.001
    is_overdue = False
    is_due_soon = False
    timeline_status_label = ""

    if is_settled:
      computed_status = "PAID"
      timeline_status_label = "Fully Settled"
    else:
      if d.debt_type == "I_OWE":
        total_i_owe += remaining
      else:
        total_owed_to_me += remaining

      if due_dt < now:
        is_overdue = True
        computed_status = "OVERDUE"
        diff = now - due_dt
        days = diff.days
        hours = diff.seconds // 3600
        if days > 0:
          timeline_status_label = f"Overdue by {days}d"
        else:
          timeline_status_label = f"Overdue by {hours}h"

        overdue_alerts.append({
            "id": d.id,
            "person_name": d.person_name,
            "debt_type": d.debt_type,
            "remaining": remaining,
            "due_at": due_dt.strftime("%b %d, %Y %H:%M"),
            "status_label": timeline_status_label,
            "severity": "rose",
        })
      elif due_dt - now <= timedelta(days=2):
        is_due_soon = True
        computed_status = "DUE_SOON"
        diff = due_dt - now
        days = diff.days
        hours = diff.seconds // 3600
        if days > 0:
          timeline_status_label = f"Due in {days}d"
        else:
          timeline_status_label = f"Due in {hours}h"

        overdue_alerts.append({
            "id": d.id,
            "person_name": d.person_name,
            "debt_type": d.debt_type,
            "remaining": remaining,
            "due_at": due_dt.strftime("%b %d, %Y %H:%M"),
            "status_label": timeline_status_label,
            "severity": "amber",
        })
      else:
        computed_status = "ACTIVE"
        days_left = (due_dt - now).days
        timeline_status_label = f"Due in {days_left}d"

    processed_debts.append({
        "id": d.id,
        "person_name": d.person_name,
        "debt_type": d.debt_type,
        "total_amount": tot,
        "paid_amount": paid,
        "remaining_amount": remaining,
        "percentage": pct,
        "display_percentage": display_pct,
        "issued_at_str": issued_dt.strftime("%Y-%m-%d %H:%M") if issued_dt else "-",
        "due_at_str": due_dt.strftime("%Y-%m-%d %H:%M"),
        "status": computed_status,
        "timeline_status_label": timeline_status_label,
        "description": d.description or "",
        "is_overdue": is_overdue,
        "is_due_soon": is_due_soon,
        "is_settled": is_settled,
    })

  total_balance = (
      sum([float(acc.balance) for acc in accounts]) if accounts else 0.00
  )
  usd_to_kes = get_live_rate()

  # 1. Net Worth & Emergency Safety Runway
  net_worth = total_balance - total_i_owe
  if monthly_expense > 0:
    emergency_runway_months = round(total_balance / monthly_expense, 1)
  elif total_balance > 0:
    emergency_runway_months = 99.0
  else:
    emergency_runway_months = 0.0

  # 2. MMF & Savings Accounts Interest Yield Calculations
  mmf_accounts = []
  total_monthly_passive_income = 0.0
  total_annual_passive_income = 0.0
  for acc in accounts:
    rate_pa = float(getattr(acc, "interest_rate_p_a", 0.0) or 0.0)
    bal = float(acc.balance or 0.0)
    acc_type = getattr(acc, "account_type", "BANK").upper()
    if rate_pa > 0 or acc_type in ["MMF", "SAVINGS"]:
      ann_ret = bal * (rate_pa / 100.0)
      month_ret = ann_ret / 12.0
      day_ret = ann_ret / 365.0
      total_annual_passive_income += ann_ret
      total_monthly_passive_income += month_ret
      mmf_accounts.append({
          "id": acc.id,
          "name": acc.name,
          "account_number": getattr(acc, "account_number", None),
          "account_type": acc_type,
          "balance": bal,
          "interest_rate_p_a": rate_pa,
          "annual_return": ann_ret,
          "monthly_return": month_ret,
          "daily_return": day_ret,
      })

  # 3. Recurring Bills & Utilities
  bill_model = getattr(models, "Bill", None)
  raw_bills = db.query(bill_model).all() if bill_model else []
  bills_data = []
  today_dt = date.today()
  current_day = today_dt.day
  total_monthly_bills = 0.0
  total_pending_bills = 0.0

  accounts_map = {acc.id: acc.name for acc in accounts}

  for b in raw_bills:
    amt = float(b.amount or 0.0)
    due_day = int(b.due_day or 1)
    total_monthly_bills += amt

    # Determine if paid this month
    is_paid_this_month = False
    if b.last_paid_date:
      if b.last_paid_date.year == today_dt.year and b.last_paid_date.month == today_dt.month:
        is_paid_this_month = True

    if not is_paid_this_month:
      total_pending_bills += amt

    # Calculate countdown
    days_left = due_day - current_day
    is_overdue = (days_left < 0) and (not is_paid_this_month)
    is_due_soon = (0 <= days_left <= 3) and (not is_paid_this_month)

    if is_paid_this_month:
      status_label = f"Paid on {b.last_paid_date.strftime('%b %d')}"
      status_badge = "emerald"
    elif is_overdue:
      status_label = f"Overdue by {abs(days_left)}d (Due day {due_day})"
      status_badge = "rose"
    elif is_due_soon:
      status_label = f"Due in {days_left}d (Day {due_day})" if days_left > 0 else "Due Today!"
      status_badge = "amber"
    else:
      status_label = f"Due in {days_left}d (Day {due_day})"
      status_badge = "indigo"

    bills_data.append({
        "id": b.id,
        "title": b.title,
        "category": b.category or "UTILITY",
        "amount": amt,
        "due_day": due_day,
        "payment_account_id": b.payment_account_id,
        "payment_account_name": accounts_map.get(b.payment_account_id, "Any Account"),
        "last_paid_date": b.last_paid_date,
        "is_recurring": b.is_recurring,
        "notes": b.notes or "",
        "is_paid_this_month": is_paid_this_month,
        "is_overdue": is_overdue,
        "is_due_soon": is_due_soon,
        "days_left": days_left,
        "status_label": status_label,
        "status_badge": status_badge,
    })

  # Unique categories for transaction filter dropdown
  unique_categories = sorted(list(set(
      getattr(tx, "category", "") for tx in transactions if getattr(tx, "category", "")
  )))

  # Query fleet maintenance, compliance, and financing for quick finance overview
  maint_schedule = db.query(models.MaintenanceSchedule).first() if hasattr(models, "MaintenanceSchedule") else None
  maint_data = None
  if maint_schedule and maint_schedule.next_due_date:
    days_left = (maint_schedule.next_due_date - date.today()).days
    maint_data = {
        "id": maint_schedule.id,
        "service_type": maint_schedule.service_type,
        "interval_weeks": maint_schedule.interval_weeks,
        "next_due_date": maint_schedule.next_due_date,
        "last_brake_pad_date": maint_schedule.last_brake_pad_date,
        "days_left": days_left,
        "is_overdue": days_left < 0,
        "is_due_soon": 0 <= days_left <= 5,
        "status_label": f"Overdue by {abs(days_left)}d" if days_left < 0 else (f"Due in {days_left}d" if days_left > 0 else "Due Today!"),
    }

  comp_records = db.query(models.ComplianceDeadline).order_by(models.ComplianceDeadline.expiry_date.asc()).all() if hasattr(models, "ComplianceDeadline") else []
  compliance_data = []
  for c in comp_records:
    if c.expiry_date:
      c_days = (c.expiry_date - date.today()).days
      compliance_data.append({
          "id": c.id,
          "title": c.title,
          "interval_months": c.interval_months,
          "expiry_date": c.expiry_date,
          "days_left": c_days,
          "is_expired": c_days < 0,
          "is_due_soon": 0 <= c_days <= 30,
      })

  financings = db.query(models.BikeFinancing).filter(models.BikeFinancing.status == "ACTIVE").all() if hasattr(models, "BikeFinancing") else []
  financing_data = []
  for f in financings:
    tot = float(f.total_cost or 0.0)
    paid = float(f.paid_amount or 0.0)
    pct = round((paid / tot) * 100, 1) if tot > 0 else 0.0
    financing_data.append({
        "id": f.id,
        "provider_name": f.provider_name,
        "daily_amount": float(f.daily_amount or 0.0),
        "total_cost": tot,
        "paid_amount": paid,
        "remaining": max(0.0, tot - paid),
        "percentage": pct,
        "display_percentage": min(100.0, pct),
    })

  return templates.TemplateResponse(
      request,
      "finance_dashboard.html",
      {
          "accounts": accounts,
          "transactions": transactions,
          "unique_categories": unique_categories,
          "goals": goals,
          "budgets": budget_data,
          "debts": processed_debts,
          "total_i_owe": total_i_owe,
          "total_owed_to_me": total_owed_to_me,
          "overdue_alerts": overdue_alerts,
          "total_balance": total_balance,
          "net_worth": net_worth,
          "emergency_runway_months": emergency_runway_months,
          "monthly_income": monthly_income,
          "monthly_expense": monthly_expense,
          "mmf_accounts": mmf_accounts,
          "total_monthly_passive_income": total_monthly_passive_income,
          "total_annual_passive_income": total_annual_passive_income,
          "bills": bills_data,
          "total_monthly_bills": total_monthly_bills,
          "total_pending_bills": total_pending_bills,
          "usd_to_kes": usd_to_kes,
          "today": date.today(),
          "now_iso": datetime.now().strftime("%Y-%m-%dT%H:%M"),
          "maintenance": maint_data,
          "compliances": compliance_data,
          "financings": financing_data,
      },
  )


@app.post("/accounts/create")
def create_account(
    request: Request,
    name: str = Form(...),
    account_number: Optional[str] = Form(None),
    account_type: str = Form(...),
    interest_rate_p_a: float = Form(0.0),
    balance: float = Form(0.00),
    db: Session = Depends(get_db),
):
  currency_pref = request.cookies.get("finatrack_currency", "Ksh")
  final_balance = Decimal(
      str(balance / get_live_rate() if currency_pref == "Ksh" else balance)
  )

  acc_num = account_number.strip() if account_number and account_number.strip() else None

  account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
  if account_model:
    acc = account_model(
        name=name.strip(),
        account_number=acc_num,
        account_type=account_type,
        interest_rate_p_a=float(interest_rate_p_a or 0.0),
        balance=final_balance,
    )
    db.add(acc)
    db.commit()
  return RedirectResponse(url="/", status_code=303)


@app.post("/accounts/update/{acc_id}")
def update_account(
    request: Request,
    acc_id: int,
    name: str = Form(...),
    account_number: Optional[str] = Form(None),
    account_type: str = Form(...),
    interest_rate_p_a: float = Form(0.0),
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

    acc.name = name.strip()
    acc.account_number = account_number.strip() if account_number and account_number.strip() else None
    acc.account_type = account_type
    acc.interest_rate_p_a = float(interest_rate_p_a or 0.0)
    acc.balance = final_balance
    db.commit()
  return RedirectResponse(url="/", status_code=303)


@app.post("/accounts/interest/log/{acc_id}")
def log_account_interest(
    request: Request,
    acc_id: int,
    db: Session = Depends(get_db),
):
  account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
  acc = db.query(account_model).filter(account_model.id == acc_id).first() if account_model else None
  if acc:
    rate_pa = float(getattr(acc, "interest_rate_p_a", 0.0) or 0.0)
    bal = float(acc.balance or 0.0)
    if rate_pa > 0 and bal > 0:
      monthly_interest = round(bal * (rate_pa / 100.0) / 12.0, 2)
      acc.balance = bal + monthly_interest

      if hasattr(models, "Transaction"):
        tx = models.Transaction(
            account_id=acc.id,
            transaction_type="INCOME",
            category="Interest & Yield",
            amount=monthly_interest,
            description=f"Monthly MMF Interest Yield ({acc.name} @ {rate_pa}% p.a.)",
            date=date.today(),
        )
        db.add(tx)
      db.commit()
  return RedirectResponse(url="/?toast=Monthly+interest+deposited+successfully", status_code=303)


# --- RECURRING BILLS & UTILITY ROUTES ---


@app.post("/bills/create")
def create_bill(
    request: Request,
    title: str = Form(...),
    category: str = Form("UTILITY"),
    amount: float = Form(...),
    due_day: int = Form(1),
    payment_account_id: Optional[int] = Form(None),
    notes: Optional[str] = Form(""),
    db: Session = Depends(get_db),
):
  if hasattr(models, "Bill"):
    currency_pref = request.cookies.get("finatrack_currency", "Ksh")
    rate = get_live_rate()
    norm_amount = float(amount / rate if currency_pref == "Ksh" else amount)

    bill = models.Bill(
        title=title.strip(),
        category=category.strip(),
        amount=norm_amount,
        due_day=due_day,
        payment_account_id=payment_account_id if payment_account_id else None,
        notes=notes.strip() if notes else None,
        is_recurring=1,
    )
    db.add(bill)
    db.commit()
  return RedirectResponse(url="/?toast=Recurring+bill+added+successfully", status_code=303)


@app.post("/bills/pay/{bill_id}")
def pay_bill(
    request: Request,
    bill_id: int,
    payment_account_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
  if hasattr(models, "Bill"):
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if bill:
      today_dt = date.today()
      bill.last_paid_date = today_dt

      acc_id = payment_account_id or bill.payment_account_id
      if acc_id and hasattr(models, "Transaction"):
        account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
        acc = db.query(account_model).filter(account_model.id == acc_id).first() if account_model else None
        if acc:
          acc.balance = float(acc.balance or 0.0) - float(bill.amount or 0.0)
          tx = models.Transaction(
              account_id=acc.id,
              transaction_type="EXPENSE",
              category=f"Utility: {bill.category}",
              amount=float(bill.amount or 0.0),
              description=f"Bill Payment: {bill.title}",
              date=today_dt,
          )
          db.add(tx)

      db.commit()
  return RedirectResponse(url="/?toast=Bill+paid+and+expense+recorded", status_code=303)


@app.post("/bills/delete/{bill_id}")
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
  if hasattr(models, "Bill"):
    bill = db.query(models.Bill).filter(models.Bill.id == bill_id).first()
    if bill:
      db.delete(bill)
      db.commit()
  return RedirectResponse(url="/?toast=Bill+removed", status_code=303)


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
        curr_bal = float(acc.balance or 0.0)
        tx_amt = float(tx.amount or 0.0)
        if tx.transaction_type.upper() == "INCOME":
          acc.balance = curr_bal - tx_amt
        else:
          acc.balance = curr_bal + tx_amt
      db.delete(tx)
      db.commit()
  return RedirectResponse(url="/", status_code=303)


@app.post("/goals/create")
def create_goal(
    request: Request,
    title: str = Form(...),
    target_amount: float = Form(...),
    target_date: Optional[str] = Form(None),
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

  parsed_date = None
  if target_date and target_date.strip():
    try:
      parsed_date = date.fromisoformat(target_date.strip())
    except ValueError:
      parsed_date = None

  goal_model = getattr(models, "SavingsGoal", getattr(models, "Goal", None))
  if goal_model:
    goal = goal_model(title=title, target_amount=final_target, target_date=parsed_date)
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


# --- DEBT & LOAN ROUTES ---


@app.post("/debts/create")
def create_debt(
    request: Request,
    person_name: str = Form(...),
    debt_type: str = Form(...),  # 'I_OWE' or 'OWED_TO_ME'
    total_amount: float = Form(...),
    issued_at: Optional[str] = Form(None),
    due_at: Optional[str] = Form(None),
    description: Optional[str] = Form(""),
    db: Session = Depends(get_db),
):
  currency_pref = request.cookies.get("finatrack_currency", "Ksh")
  final_amount = float(
      Decimal(
          str(
              total_amount / get_live_rate()
              if currency_pref == "Ksh"
              else total_amount
          )
      )
  )

  # Parse timestamps (HTML input datetime-local format: YYYY-MM-DDTHH:MM)
  issued_dt = datetime.now()
  if issued_at and issued_at.strip():
    try:
      issued_dt = datetime.fromisoformat(issued_at.strip())
    except Exception:
      issued_dt = datetime.now()

  due_dt = datetime.now() + timedelta(days=7)
  if due_at and due_at.strip():
    try:
      due_dt = datetime.fromisoformat(due_at.strip())
    except Exception:
      due_dt = datetime.now() + timedelta(days=7)

  if hasattr(models, "Debt"):
    debt = models.Debt(
        person_name=person_name.strip(),
        debt_type=debt_type,
        total_amount=final_amount,
        paid_amount=0.0,
        issued_at=issued_dt,
        due_at=due_dt,
        status="ACTIVE",
        description=description.strip() if description else None,
    )
    db.add(debt)
    db.commit()
    print(f"Successfully saved debt: {debt.person_name} ({debt.debt_type}) amount={debt.total_amount}")

  return RedirectResponse(url="/?toast=Debt+recorded+successfully#debts-section", status_code=303)


@app.post("/debts/repay/{debt_id}")
def repay_debt(
    request: Request,
    debt_id: int,
    amount: float = Form(...),
    db: Session = Depends(get_db),
):
  if hasattr(models, "Debt"):
    debt = db.query(models.Debt).filter(models.Debt.id == debt_id).first()
    if debt:
      currency_pref = request.cookies.get("finatrack_currency", "Ksh")
      repay_val = float(
          Decimal(
              str(
                  amount / get_live_rate()
                  if currency_pref == "Ksh"
                  else amount
              )
          )
      )
      new_paid = float(debt.paid_amount or 0.0) + repay_val
      tot = float(debt.total_amount or 0.0)
      debt.paid_amount = min(new_paid, tot) if tot > 0 else new_paid
      if debt.paid_amount >= tot:
        debt.status = "PAID"
      db.commit()

  return RedirectResponse(url="/?toast=Payment+recorded+successfully#debts-section", status_code=303)


@app.post("/debts/delete/{debt_id}")
def delete_debt(debt_id: int, db: Session = Depends(get_db)):
  if hasattr(models, "Debt"):
    debt = db.query(models.Debt).filter(models.Debt.id == debt_id).first()
    if debt:
      db.delete(debt)
      db.commit()
  return RedirectResponse(url="/?toast=Debt+record+deleted#debts-section", status_code=303)


# --- M-PESA SMS PARSER UTILITY ---

def parse_mpesa_sms(sms_text: str) -> dict:
  text = (sms_text or "").strip()
  if not text:
    return {"error": "Empty message"}

  # 1. Receipt code
  code_match = re.search(r"\b([A-Z0-9]{10})\b", text)
  receipt_code = code_match.group(1) if code_match else ""

  # 2. Amount: Ksh1,250.00 or Ksh 450.00 or Ksh450
  amt_match = re.search(r"Ksh\s*([\d,]+(?:\.\d{1,2})?)", text, re.IGNORECASE)
  amount = 0.0
  if amt_match:
    amount = float(amt_match.group(1).replace(",", ""))

  # 3. Recipient / Merchant
  recipient = ""
  is_income = False
  if "received" in text.lower():
    is_income = True
    from_match = re.search(
        r"from\s+([A-Z0-9\s]+?)(?:\s+\d{10}|\s+on|\.|$)", text, re.IGNORECASE
    )
    if from_match:
      recipient = from_match.group(1).strip()
  elif "bought" in text.lower() and "airtime" in text.lower():
    recipient = "Safaricom Airtime"
  else:
    to_match = re.search(
        r"(?:paid to|sent to)\s+([A-Z0-9\s\.\,\'\-]+?)(?:\s+Till|\s+for account|\s+Business|\s+on|\.|$)",
        text,
        re.IGNORECASE,
    )
    if to_match:
      recipient = to_match.group(1).strip()

  # 4. Date & Time
  date_match = re.search(
      r"on\s+(\d{1,2}/\d{1,2}/\d{2,4})(?:\s+at\s+([0-9:AMP\s]+))?",
      text,
      re.IGNORECASE,
  )
  date_str = date_match.group(1) if date_match else ""
  time_str = date_match.group(2).strip() if (date_match and date_match.group(2)) else ""

  # 5. Smart Category & Target Field
  upper_text = text.upper()
  category = "Misc"
  field = "misc_expenses"
  icon = "📝"

  if is_income:
    category = "Rider Income"
    field = "total_earned"
    icon = "💰"
  elif any(
      k in upper_text
      for k in [
          "RUBIS", "SHELL", "TOTAL", "PETROL", "DIESEL", "FILLING", "ENERGY",
          "ENERGIES", "OLA ENERGY", "ASTROL", "NATIONAL OIL", "HASS", "STATION"
      ]
  ):
    category = "Fuel"
    field = "fuel_cost"
    icon = "⛽"
  elif any(
      k in upper_text
      for k in [
          "HOTEL", "CAFE", "RESTAURANT", "FOOD", "KIBANDA", "KITCHEN", "CHOMA",
          "CHIPS", "BUTCHERY", "SNACK", "BAKERY", "EATERY", "DISPENSARY",
          "MEALS", "LUNCH", "DINNER", "SUPPER"
      ]
  ):
    category = "Food & Lunch"
    field = "food_spent"
    icon = "🍲"
  elif "AIRTIME" in upper_text or "SAFARICOM DATA" in upper_text or "BUNDLES" in upper_text:
    category = "Airtime"
    field = "airtime_spent"
    icon = "📱"
  elif any(
      k in upper_text
      for k in [
          "SPARE", "GARAGE", "MOTOR", "CYCLE", "MECHANIC", "BRAKE", "TYRE",
          "PUNCTURE", "HARDWARE", "AUTO"
      ]
  ):
    category = "Maintenance & Repairs"
    field = "maintenance_cost"
    icon = "🔧"
  elif any(k in upper_text for k in ["ZIIDI", "ZIIDI MMF", "M-PESA GROW", "GROW MMF"]):
    category = "Ziidi MMF Investment"
    field = "investment"
    icon = "📈"
  elif any(k in upper_text for k in ["MOGO", "SPIRO", "WATU", "ZENO"]):
    category = "Bike Financing (Lipa Mdogo)"
    field = "financing"
    icon = "🛵"

  return {
      "receipt_code": receipt_code,
      "amount": amount,
      "recipient": recipient,
      "date": date_str,
      "time": time_str,
      "category": category,
      "field": field,
      "icon": icon,
      "raw": text,
  }


@app.post("/rider/mpesa/parse")
async def api_parse_mpesa(request: Request):
  data = await request.json()
  sms_text = data.get("sms", "")
  return parse_mpesa_sms(sms_text)


def parse_mpesa_batch(batch_text: str) -> dict:
  text = (batch_text or "").strip()
  if not text:
    return {"count": 0, "totals": {}, "items": []}

  raw_chunks = re.split(r"(?=[A-Z0-9]{10}\s+Confirmed)", text, flags=re.IGNORECASE)
  if len(raw_chunks) <= 1:
    raw_chunks = [l for l in text.split("\n") if "Confirmed" in l or "Ksh" in l]

  results = []
  totals = {
      "total_earned": 0.0,
      "fuel_cost": 0.0,
      "food_spent": 0.0,
      "airtime_spent": 0.0,
      "maintenance_cost": 0.0,
      "misc_expenses": 0.0,
      "trips_count": 0,
  }

  for chunk in raw_chunks:
    if not chunk.strip():
      continue
    p = parse_mpesa_sms(chunk)
    if p and p.get("amount", 0) > 0:
      results.append(p)
      f = p.get("field", "misc_expenses")
      if f in totals:
        totals[f] += p["amount"]
      if f == "total_earned":
        totals["trips_count"] += 1

  return {
      "count": len(results),
      "totals": {k: round(v, 2) for k, v in totals.items()},
      "items": results,
  }


@app.post("/rider/mpesa/batch-parse")
async def api_parse_mpesa_batch(request: Request):
  data = await request.json()
  sms_text = data.get("sms", "")
  return parse_mpesa_batch(sms_text)


@app.post("/api/mpesa/webhook")
async def mpesa_sms_webhook(request: Request, db: Session = Depends(get_db)):
  sms_text = ""
  try:
    data = await request.json()
    sms_text = data.get("sms") or data.get("message") or data.get("text") or ""
  except Exception:
    form = await request.form()
    sms_text = form.get("sms") or form.get("message") or form.get("text") or ""

  if not sms_text:
    return {"status": "ignored", "reason": "No SMS text provided"}

  parsed = parse_mpesa_sms(sms_text)
  amount = parsed.get("amount", 0.0)
  field = parsed.get("field")
  category = parsed.get("category")
  receipt = parsed.get("receipt_code")

  if amount <= 0:
    return {
        "status": "ignored",
        "reason": "Could not parse amount from SMS",
        "parsed": parsed,
    }

  today_date = date.today()
  rate = get_live_rate()
  amt_norm = amount / rate

  rider_log_model = getattr(models, "RiderLog", None)
  if not rider_log_model:
    return {"status": "error", "reason": "RiderLog model not found"}

  log = db.query(rider_log_model).filter(rider_log_model.date == today_date).first()
  if not log:
    log = rider_log_model(
        date=today_date,
        trips_completed=0,
        kilometers=0.0,
        total_earned=0.0,
        fuel_cost=0.0,
        food_spent=0.0,
        maintenance_cost=0.0,
        airtime_spent=0.0,
        misc_expenses=0.0,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

  if field == "fuel_cost":
    log.fuel_cost = float(log.fuel_cost or 0.0) + amt_norm
  elif field == "food_spent":
    log.food_spent = float(log.food_spent or 0.0) + amt_norm
  elif field == "airtime_spent":
    log.airtime_spent = float(log.airtime_spent or 0.0) + amt_norm
  elif field == "maintenance_cost":
    log.maintenance_cost = float(log.maintenance_cost or 0.0) + amt_norm
  elif field == "total_earned":
    log.total_earned = float(log.total_earned or 0.0) + amt_norm
    log.trips_completed = int(log.trips_completed or 0) + 1
  else:
    log.misc_expenses = float(log.misc_expenses or 0.0) + amt_norm

  account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
  mpesa_acc = None
  if account_model:
    mpesa_acc = (
        db.query(account_model)
        .filter(account_model.name.ilike("%M-Pesa%"))
        .first()
        or db.query(account_model).first()
    )

  if mpesa_acc and hasattr(models, "Transaction"):
    tx_type = "INCOME" if field == "total_earned" else "EXPENSE"
    if tx_type == "INCOME":
      mpesa_acc.balance = float(mpesa_acc.balance or 0.0) + amt_norm
    else:
      mpesa_acc.balance = float(mpesa_acc.balance or 0.0) - amt_norm

    tx = models.Transaction(
        account_id=mpesa_acc.id,
        transaction_type=tx_type,
        category=category,
        amount=amt_norm,
        description=f"Auto M-Pesa SMS ({receipt}): {parsed.get('recipient')}",
        date=today_date,
        rider_log_id=log.id,
    )
    db.add(tx)

    # 10% Auto-Save into Ziidi MMF on Outgoing Transactions (Send Money, Paybill, Buy Goods, Fuel, Food, Airtime)
    if tx_type == "EXPENSE":
      ziidi_acc = db.query(account_model).filter(account_model.name.ilike("%Ziidi%")).first()
      if ziidi_acc:
        auto_save_amt = round(amt_norm * 0.10, 2)
        if auto_save_amt > 0:
          ziidi_acc.balance = float(ziidi_acc.balance or 0.0) + auto_save_amt
          tx_ziidi = models.Transaction(
              account_id=ziidi_acc.id,
              transaction_type="INCOME",
              category="Ziidi 10% Auto-Save",
              amount=auto_save_amt,
              description=f"10% Auto-Save from M-Pesa {category} ({receipt})",
              date=today_date,
              rider_log_id=log.id,
          )
          db.add(tx_ziidi)

  db.commit()
  return {
      "status": "success",
      "action": "auto_logged",
      "category": category,
      "amount_kes": amount,
      "field_updated": field,
      "receipt": receipt,
      "recipient": parsed.get("recipient"),
  }


# --- RIDER DASHBOARD ROUTES ---


@app.get("/rider")
def rider_dashboard(
    request: Request,
    bike_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
  # 1. Multi-Bike Fleet Selector
  bike_model = getattr(models, "Bike", None)
  bikes = db.query(bike_model).all() if bike_model else []

  selected_bike_id = bike_id
  if not selected_bike_id:
    cookie_bike = request.cookies.get("finatrack_bike_id")
    if cookie_bike and cookie_bike.isdigit():
      selected_bike_id = int(cookie_bike)

  selected_bike = None
  if selected_bike_id and bikes:
    selected_bike = next((b for b in bikes if b.id == selected_bike_id), None)
  if not selected_bike and bikes:
    selected_bike = bikes[0]
    selected_bike_id = selected_bike.id

  rider_log_model = getattr(models, "RiderLog", None)
  all_logs = (
      db.query(rider_log_model)
      .order_by(rider_log_model.date.desc())
      .all()
      if rider_log_model
      else []
  )

  # Filter logs for selected bike if multiple bikes exist
  if selected_bike_id and any(getattr(l, "bike_id", None) == selected_bike_id for l in all_logs):
    logs = [l for l in all_logs if getattr(l, "bike_id", None) in [selected_bike_id, None]]
  else:
    logs = all_logs

  today_date = date.today()

  def calc_totals(filtered_logs):
    earned = sum([float(l.total_earned) for l in filtered_logs])
    exp = sum([
        float(l.fuel_cost)
        + float(l.airtime_spent)
        + float(getattr(l, "food_spent", 0.0) or 0.0)
        + float(l.misc_expenses)
        + float(getattr(l, "maintenance_cost", 0))
        for l in filtered_logs
    ])
    saved = earned - exp
    total_km = sum([float(getattr(l, "kilometers", 0)) for l in filtered_logs])
    total_liters = sum([float(getattr(l, "fuel_litres", 0.0) or l.fuel_used_liters or 0.0) for l in filtered_logs])
    fuel_efficiency = (
        round(total_km / total_liters, 2) if total_liters > 0 else 0.0
    )
    return earned, exp, saved, fuel_efficiency

  daily_logs = [l for l in logs if l.date == today_date]
  d_earned, d_exp, d_saved, d_efficiency = calc_totals(daily_logs)

  start_of_week = today_date - timedelta(days=today_date.weekday())
  weekly_logs = [l for l in logs if l.date >= start_of_week]
  w_earned, w_exp, w_saved, w_efficiency = calc_totals(weekly_logs)

  monthly_logs = [
      l
      for l in logs
      if l.date.year == today_date.year and l.date.month == today_date.month
  ]
  m_earned, m_exp, m_saved, m_efficiency = calc_totals(monthly_logs)

  yearly_logs = [l for l in logs if l.date.year == today_date.year]
  y_earned, y_exp, y_saved, y_efficiency = calc_totals(yearly_logs)

  summary_data = {
      "daily_earned": d_earned,
      "daily_exp": d_exp,
      "daily_saved": d_saved,
      "daily_efficiency": d_efficiency,
      "weekly_earned": w_earned,
      "weekly_exp": w_exp,
      "weekly_saved": w_saved,
      "weekly_efficiency": w_efficiency,
      "monthly_earned": m_earned,
      "monthly_exp": m_exp,
      "monthly_saved": m_saved,
      "monthly_efficiency": m_efficiency,
      "yearly_earned": y_earned,
      "yearly_exp": y_exp,
      "yearly_saved": y_saved,
      "yearly_efficiency": y_efficiency,
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
      "text": (
          "Commit to the LORD whatever you do, and he will establish your plans."
      ),
      "reference": "Proverbs 16:3",
  }

  account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
  accounts = db.query(account_model).all() if account_model else []
  accounts_map = {acc.id: acc.name for acc in accounts}

  # Enrich logs with account names and station info
  enriched_logs = []
  for l in logs:
    enriched_logs.append({
        "id": l.id,
        "bike_id": getattr(l, "bike_id", None),
        "date": l.date,
        "trips_completed": l.trips_completed,
        "kilometers": l.kilometers,
        "total_earned": l.total_earned,
        "fuel_used_liters": l.fuel_used_liters,
        "fuel_litres": getattr(l, "fuel_litres", None),
        "fuel_station": getattr(l, "fuel_station", None) or "OTHER",
        "shift_hours": getattr(l, "shift_hours", 8.0) or 8.0,
        "fuel_cost": l.fuel_cost,
        "food_spent": float(getattr(l, "food_spent", 0.0) or 0.0),
        "airtime_spent": l.airtime_spent,
        "misc_expenses": l.misc_expenses,
        "maintenance_cost": l.maintenance_cost,
        "earnings_account_id": getattr(l, "earnings_account_id", None),
        "expense_account_id": getattr(l, "expense_account_id", None),
        "earnings_account_name": accounts_map.get(getattr(l, "earnings_account_id", None)),
        "expense_account_name": accounts_map.get(getattr(l, "expense_account_id", None)),
    })

  # 1. Maintenance status (Oil change, chain, brake pads)
  maint_schedule = db.query(models.MaintenanceSchedule).first() if hasattr(models, "MaintenanceSchedule") else None
  maint_data = None
  if maint_schedule and maint_schedule.next_due_date:
    days_left = (maint_schedule.next_due_date - today_date).days
    maint_data = {
        "id": maint_schedule.id,
        "service_type": maint_schedule.service_type,
        "interval_weeks": maint_schedule.interval_weeks,
        "last_service_date": maint_schedule.last_service_date,
        "next_due_date": maint_schedule.next_due_date,
        "last_brake_pad_date": maint_schedule.last_brake_pad_date,
        "brake_pad_cost_last": float(maint_schedule.brake_pad_cost_last or 0.0),
        "days_left": days_left,
        "is_overdue": days_left < 0,
        "is_due_soon": 0 <= days_left <= 5,
        "status_label": f"Overdue by {abs(days_left)} days" if days_left < 0 else (f"Due in {days_left} days" if days_left > 0 else "Due Today!"),
    }

  # 2. Compliance / Licenses Deadlines (DL, PSV Insurance)
  comp_records = db.query(models.ComplianceDeadline).order_by(models.ComplianceDeadline.expiry_date.asc()).all() if hasattr(models, "ComplianceDeadline") else []
  compliance_data = []
  for c in comp_records:
    if c.expiry_date:
      c_days = (c.expiry_date - today_date).days
      compliance_data.append({
          "id": c.id,
          "title": c.title,
          "interval_months": c.interval_months,
          "expiry_date": c.expiry_date,
          "last_renewed_date": c.last_renewed_date,
          "days_left": c_days,
          "is_expired": c_days < 0,
          "is_due_soon": 0 <= c_days <= 30,
          "notes": c.notes or "",
      })

  # 3. Bike Financing (Lipa Mdogo Mdogo: Mogo, Spiro, Watu, Zeno)
  financings = db.query(models.BikeFinancing).order_by(models.BikeFinancing.id.desc()).all() if hasattr(models, "BikeFinancing") else []
  financing_data = []
  for f in financings:
    tot = float(f.total_cost or 0.0)
    paid = float(f.paid_amount or 0.0)
    pct = round((paid / tot) * 100, 1) if tot > 0 else 0.0
    rem = max(0.0, tot - paid)
    financing_data.append({
        "id": f.id,
        "provider_name": f.provider_name,
        "daily_amount": float(f.daily_amount or 0.0),
        "total_cost": tot,
        "paid_amount": paid,
        "remaining": rem,
        "percentage": pct,
        "display_percentage": min(100.0, pct),
        "status": f.status,
        "frequency": f.frequency,
        "notes": f.notes or "",
    })

  # 4. Petrol Station Fuel Efficiency Comparison (Rubis, Total, Shell, Ola, Hass, Other)
  station_map = {}
  for l in logs:
    st = getattr(l, "fuel_station", None) or "OTHER"
    st = st.upper().strip()
    km = float(getattr(l, "kilometers", 0.0) or 0.0)
    litres = float(getattr(l, "fuel_litres", 0.0) or l.fuel_used_liters or 0.0)
    cost = float(getattr(l, "fuel_cost", 0.0) or 0.0)
    if km > 0 or litres > 0 or cost > 0:
      if st not in station_map:
        station_map[st] = {"station": st, "total_km": 0.0, "total_litres": 0.0, "total_cost": 0.0, "shifts": 0}
      station_map[st]["total_km"] += km
      station_map[st]["total_litres"] += litres
      station_map[st]["total_cost"] += cost
      station_map[st]["shifts"] += 1

  station_stats = []
  for st_name, data in station_map.items():
    eff = round(data["total_km"] / data["total_litres"], 2) if data["total_litres"] > 0 else 0.0
    station_stats.append({
        "station": st_name,
        "total_km": round(data["total_km"], 1),
        "total_litres": round(data["total_litres"], 1),
        "total_cost": round(data["total_cost"], 2),
        "shifts": data["shifts"],
        "efficiency_km_l": eff,
    })
  station_stats.sort(key=lambda x: x["efficiency_km_l"], reverse=True)

  # 5. Daily Shift Target & Performance Gamification
  daily_target = float(getattr(selected_bike, "daily_target", 2500.0) or 2500.0) if selected_bike else 2500.0
  target_pct = round((d_earned / daily_target) * 100, 1) if daily_target > 0 else 0.0
  display_target_pct = min(100.0, target_pct)

  today_trips = sum(int(getattr(l, "trips_completed", 0) or 0) for l in daily_logs)
  today_km = sum(float(getattr(l, "kilometers", 0.0) or 0.0) for l in daily_logs)
  today_hours = sum(float(getattr(l, "shift_hours", 8.0) or 8.0) for l in daily_logs) or 8.0

  hourly_rate = round(d_earned / max(1.0, today_hours), 1)
  earnings_per_km = round(d_earned / max(1.0, today_km), 1) if today_km > 0 else 0.0

  # 6. WhatsApp Daily Shift Summary Generator
  bike_label = f"{selected_bike.plate_number} ({selected_bike.model_name})" if selected_bike else "KMDN 456Y"
  wa_lines = [
      "🏍️ *FINATRACK DAILY SHIFT REPORT*",
      f"📅 Date: {today_date.strftime('%d %b %Y')}",
      f"🏍️ Bike: {bike_label}",
      "----------------------------------",
      f"💰 *Gross Earned:* Ksh {int(d_earned):,} ({today_trips} trips, {int(today_km)} km)",
      f"⛽ *Fuel Spent:* Ksh {int(d_exp):,}",
      "----------------------------------",
      f"💵 *NET REMITTANCE:* Ksh {int(d_saved):,}",
      f"🎯 *Shift Goal:* {target_pct}% of Ksh {int(daily_target):,}",
      "----------------------------------",
      "✅ Generated via Finatrack Fleet OS",
  ]
  whatsapp_text = "\n".join(wa_lines)
  whatsapp_url = f"https://api.whatsapp.com/send?text={urllib.parse.quote(whatsapp_text)}"

  # 7. Chart Data Aggregation: Daily, Weekly, and Monthly
  all_logs_chronological = sorted(logs, key=lambda x: (x.date, x.id))

  # Daily (Last 10 shifts)
  recent_logs = all_logs_chronological[-10:] if len(all_logs_chronological) > 10 else all_logs_chronological
  daily_dates = [l.date.strftime("%b %d") for l in recent_logs]
  daily_earnings = [round(float(l.total_earned or 0.0), 2) for l in recent_logs]
  daily_fuel = [round(float(l.fuel_cost or 0.0), 2) for l in recent_logs]
  daily_upkeep = [
      round(
          float(l.fuel_cost or 0.0)
          + float(l.maintenance_cost or 0.0)
          + float(getattr(l, "food_spent", 0.0) or 0.0)
          + float(l.airtime_spent or 0.0)
          + float(l.misc_expenses or 0.0),
          2,
      )
      for l in recent_logs
  ]

  # Weekly (Group by Calendar Week)
  weeks_map = {}
  for l in all_logs_chronological:
    year, week, _ = l.date.isocalendar()
    key = f"{year}-W{week:02d}"
    if key not in weeks_map:
      weeks_map[key] = {
          "label": f"Wk {week}",
          "earnings": 0.0,
          "fuel": 0.0,
          "upkeep": 0.0,
      }
    tot_exp = (
        float(l.fuel_cost or 0.0)
        + float(l.maintenance_cost or 0.0)
        + float(getattr(l, "food_spent", 0.0) or 0.0)
        + float(l.airtime_spent or 0.0)
        + float(l.misc_expenses or 0.0)
    )
    weeks_map[key]["earnings"] += float(l.total_earned or 0.0)
    weeks_map[key]["fuel"] += float(l.fuel_cost or 0.0)
    weeks_map[key]["upkeep"] += tot_exp

  sorted_weeks = sorted(weeks_map.keys())[-8:]
  weekly_dates = [weeks_map[k]["label"] for k in sorted_weeks]
  weekly_earnings = [round(weeks_map[k]["earnings"], 2) for k in sorted_weeks]
  weekly_fuel = [round(weeks_map[k]["fuel"], 2) for k in sorted_weeks]
  weekly_upkeep = [round(weeks_map[k]["upkeep"], 2) for k in sorted_weeks]

  # Monthly (Group by Month)
  months_map = {}
  for l in all_logs_chronological:
    m_key = l.date.strftime("%Y-%m")
    m_label = l.date.strftime("%b %Y")
    if m_key not in months_map:
      months_map[m_key] = {
          "label": m_label,
          "earnings": 0.0,
          "fuel": 0.0,
          "upkeep": 0.0,
      }
    tot_exp = (
        float(l.fuel_cost or 0.0)
        + float(l.maintenance_cost or 0.0)
        + float(getattr(l, "food_spent", 0.0) or 0.0)
        + float(l.airtime_spent or 0.0)
        + float(l.misc_expenses or 0.0)
    )
    months_map[m_key]["earnings"] += float(l.total_earned or 0.0)
    months_map[m_key]["fuel"] += float(l.fuel_cost or 0.0)
    months_map[m_key]["upkeep"] += tot_exp

  sorted_months = sorted(months_map.keys())[-6:]
  monthly_dates = [months_map[k]["label"] for k in sorted_months]
  monthly_earnings = [round(months_map[k]["earnings"], 2) for k in sorted_months]
  monthly_fuel = [round(months_map[k]["fuel"], 2) for k in sorted_months]
  monthly_upkeep = [round(months_map[k]["upkeep"], 2) for k in sorted_months]

  chart_periods = {
      "daily": {
          "dates": daily_dates,
          "earnings": daily_earnings,
          "fuel": daily_fuel,
          "upkeep": daily_upkeep,
      },
      "weekly": {
          "dates": weekly_dates,
          "earnings": weekly_earnings,
          "fuel": weekly_fuel,
          "upkeep": weekly_upkeep,
      },
      "monthly": {
          "dates": monthly_dates,
          "earnings": monthly_earnings,
          "fuel": monthly_fuel,
          "upkeep": monthly_upkeep,
      },
  }

  # Expense Donut breakdown across all rider logs
  tot_fuel = sum([float(l.fuel_cost or 0.0) for l in logs])
  tot_maint = sum([float(l.maintenance_cost or 0.0) for l in logs])
  tot_food = sum([float(getattr(l, "food_spent", 0.0) or 0.0) for l in logs])
  tot_airtime = sum([float(l.airtime_spent or 0.0) for l in logs])
  tot_misc = sum([float(l.misc_expenses or 0.0) for l in logs])
  expense_donut = [
      round(tot_fuel, 2),
      round(tot_maint, 2),
      round(tot_food, 2),
      round(tot_airtime, 2),
      round(tot_misc, 2),
  ]

  response = templates.TemplateResponse(
      request,
      "rider_dashboard.html",
      {
          **summary_data,
          "bikes": bikes,
          "selected_bike": selected_bike,
          "selected_bike_id": selected_bike_id,
          "daily_target": daily_target,
          "target_pct": target_pct,
          "display_target_pct": display_target_pct,
          "today_trips": today_trips,
          "today_km": today_km,
          "today_hours": today_hours,
          "hourly_rate": hourly_rate,
          "earnings_per_km": earnings_per_km,
          "whatsapp_text": whatsapp_text,
          "whatsapp_url": whatsapp_url,
          "station_stats": station_stats,
          "logs": enriched_logs,
          "accounts": accounts,
          "maintenance": maint_data,
          "compliances": compliance_data,
          "financings": financing_data,
          "chart_periods": chart_periods,
          "chart_dates": daily_dates,
          "chart_earnings": daily_earnings,
          "chart_upkeep": daily_upkeep,
          "chart_fuel": daily_fuel,
          "expense_donut": expense_donut,
          "quote": quote,
          "verse": verse,
          "today": today_date,
          "usd_to_kes": get_live_rate(),
      },
  )
  if selected_bike_id:
    response.set_cookie(key="finatrack_bike_id", value=str(selected_bike_id), max_age=30 * 24 * 3600)
  return response


@app.get("/rider/export/pdf")
def export_rider_pdf(
    request: Request,
    timeframe: str = "this_month",
    rider_name: Optional[str] = "",
    bike_reg: Optional[str] = "",
    sacco_name: Optional[str] = "",
    db: Session = Depends(get_db),
):
  today = date.today()
  rate = get_live_rate()

  rider_log_model = getattr(models, "RiderLog", None)
  logs = (
      db.query(rider_log_model)
      .order_by(rider_log_model.date.asc())
      .all()
      if rider_log_model
      else []
  )

  # Filter logs by timeframe
  timeframe_label = "All Time"
  filtered_logs = logs
  if timeframe == "this_week":
    start_of_week = today - timedelta(days=today.weekday())
    filtered_logs = [l for l in logs if l.date >= start_of_week]
    timeframe_label = f"Week of {start_of_week.strftime('%b %d')} - {today.strftime('%b %d, %Y')}"
  elif timeframe == "this_month":
    filtered_logs = [
        l for l in logs if l.date.year == today.year and l.date.month == today.month
    ]
    timeframe_label = f"Month of {today.strftime('%B %Y')}"
  elif timeframe == "last_30_days":
    start_date = today - timedelta(days=30)
    filtered_logs = [l for l in logs if l.date >= start_date]
    timeframe_label = f"Last 30 Days ({start_date.strftime('%b %d')} - {today.strftime('%b %d, %Y')})"

  account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
  accounts = db.query(account_model).all() if account_model else []
  accounts_map = {acc.id: acc.name for acc in accounts}

  parsed_logs = []
  total_trips = 0
  total_km = 0.0
  total_earned = 0.0
  total_fuel = 0.0
  total_food = 0.0
  total_maint = 0.0
  total_other = 0.0

  for l in filtered_logs:
    e_kes = float(l.total_earned or 0.0) * rate
    f_kes = float(l.fuel_cost or 0.0) * rate
    fd_kes = float(getattr(l, "food_spent", 0.0) or 0.0) * rate
    m_kes = float(l.maintenance_cost or 0.0) * rate
    o_kes = (float(l.airtime_spent or 0.0) + float(l.misc_expenses or 0.0)) * rate

    total_trips += int(l.trips_completed or 0)
    total_km += float(l.kilometers or 0.0)
    total_earned += e_kes
    total_fuel += f_kes
    total_food += fd_kes
    total_maint += m_kes
    total_other += o_kes

    parsed_logs.append({
        "date": l.date.strftime("%d/%m/%Y"),
        "trips_completed": l.trips_completed,
        "kilometers": l.kilometers,
        "total_earned": e_kes,
        "fuel_cost": f_kes,
        "food_spent": fd_kes,
        "maintenance_cost": m_kes,
        "airtime_spent": float(l.airtime_spent or 0.0) * rate,
        "misc_expenses": float(l.misc_expenses or 0.0) * rate,
        "earnings_account_name": accounts_map.get(l.earnings_account_id),
    })

  total_exp = total_fuel + total_food + total_maint + total_other
  net_remittance = total_earned - total_exp

  maint = (
      db.query(models.MaintenanceSchedule).first()
      if hasattr(models, "MaintenanceSchedule")
      else None
  )
  next_service_due = (
      maint.next_due_date.strftime("%d/%m/%Y")
      if (maint and maint.next_due_date)
      else "Current"
  )

  dl_comp = (
      db.query(models.ComplianceDeadline)
      .filter(models.ComplianceDeadline.title.ilike("%License%"))
      .first()
      if hasattr(models, "ComplianceDeadline")
      else None
  )
  dl_status = (
      f"Valid (Exp: {dl_comp.expiry_date.strftime('%d/%m/%Y')})"
      if (dl_comp and dl_comp.expiry_date)
      else "Active / Valid"
  )

  ins_comp = (
      db.query(models.ComplianceDeadline)
      .filter(models.ComplianceDeadline.title.ilike("%Insurance%"))
      .first()
      if hasattr(models, "ComplianceDeadline")
      else None
  )
  psv_status = (
      f"Valid (Exp: {ins_comp.expiry_date.strftime('%d/%m/%Y')})"
      if (ins_comp and ins_comp.expiry_date)
      else "Active PSV"
  )

  financing = (
      db.query(models.BikeFinancing).filter(models.BikeFinancing.status == "ACTIVE").first()
      if hasattr(models, "BikeFinancing")
      else None
  )
  fin_data = None
  if financing:
    tot_kes = float(financing.total_cost or 0.0) * rate
    paid_kes = float(financing.paid_amount or 0.0) * rate
    pct = round((paid_kes / tot_kes) * 100, 1) if tot_kes > 0 else 0.0
    fin_data = {
        "provider_name": financing.provider_name,
        "daily_amount": float(financing.daily_amount or 0.0) * rate,
        "total_cost": tot_kes,
        "paid_amount": paid_kes,
        "remaining": max(0.0, tot_kes - paid_kes),
        "percentage": pct,
        "status": financing.status,
    }

  statement_ref = f"FT-{today.strftime('%Y%m')}-{int(today.strftime('%d%H%M'))}"
  generated_date = today.strftime("%d %B %Y")

  rendered_html = templates.get_template("pdf_statement.html").render({
      "timeframe_label": timeframe_label,
      "generated_date": generated_date,
      "statement_ref": statement_ref,
      "rider_name": rider_name or "Dennis Mwangi",
      "bike_reg": bike_reg or "KMDN 456Y",
      "sacco_name": sacco_name or "Nairobi Central Boda SACCO",
      "dl_status": dl_status,
      "psv_status": psv_status,
      "next_service_due": next_service_due,
      "logs": parsed_logs,
      "total_trips": total_trips,
      "total_km": total_km,
      "total_earned": total_earned,
      "total_fuel": total_fuel,
      "total_food": total_food,
      "total_maint": total_maint,
      "total_other": total_other,
      "total_exp": total_exp,
      "net_remittance": net_remittance,
      "financing": fin_data,
  })

  pdf_bytes = weasyprint.HTML(string=rendered_html).write_pdf()
  filename = f"Finatrack_Statement_{timeframe}_{today.strftime('%Y%m%d')}.pdf"
  return Response(
      content=pdf_bytes,
      media_type="application/pdf",
      headers={"Content-Disposition": f"attachment; filename={filename}"},
  )


@app.post("/rider/logs")
def create_rider_log(
    request: Request,
    log_date: date = Form(...),
    bike_id: Optional[int] = Form(None),
    trips_completed: int = Form(0),
    kilometers: float = Form(0.00),
    total_earned: float = Form(0.00),
    fuel_station: Optional[str] = Form("OTHER"),
    fuel_litres: Optional[float] = Form(None),
    fuel_used_liters: float = Form(0.00),
    fuel_cost: float = Form(0.00),
    shift_hours: float = Form(8.0),
    food_spent: float = Form(0.00),
    airtime_spent: float = Form(0.00),
    misc_expenses: float = Form(0.00),
    maintenance_cost: float = Form(0.00),
    earnings_account_id: Optional[int] = Form(None),
    expense_account_id: Optional[int] = Form(None),
    sync_finance: Optional[str] = Form("on"),
    db: Session = Depends(get_db),
):
  currency_pref = request.cookies.get("finatrack_currency", "Ksh")
  rate = get_live_rate()

  def normalize(val):
    return float(val / rate if currency_pref == "Ksh" else val)

  earned_norm = normalize(total_earned)
  fuel_norm = normalize(fuel_cost)
  food_norm = normalize(food_spent)
  maint_norm = normalize(maintenance_cost)
  airtime_norm = normalize(airtime_spent)
  misc_norm = normalize(misc_expenses)

  final_litres = fuel_litres if fuel_litres is not None and fuel_litres > 0 else fuel_used_liters

  rider_log_model = getattr(models, "RiderLog", None)
  if rider_log_model:
    log = rider_log_model(
        bike_id=bike_id,
        date=log_date,
        trips_completed=trips_completed,
        kilometers=float(kilometers),
        total_earned=earned_norm,
        fuel_station=fuel_station or "OTHER",
        fuel_litres=float(final_litres),
        fuel_used_liters=float(final_litres),
        fuel_cost=fuel_norm,
        shift_hours=float(shift_hours or 8.0),
        food_spent=food_norm,
        airtime_spent=airtime_norm,
        misc_expenses=misc_norm,
        maintenance_cost=maint_norm,
        earnings_account_id=earnings_account_id,
        expense_account_id=expense_account_id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    # Sync to Finance Transactions & Accounts if checked
    is_sync = sync_finance in ["on", "true", "1", True]
    if is_sync and hasattr(models, "Transaction"):
      account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))

      # 1. Credit Earnings Account & Record Income
      if earned_norm > 0 and earnings_account_id:
        earn_acc = db.query(account_model).filter(account_model.id == earnings_account_id).first()
        if earn_acc:
          earn_acc.balance = float(earn_acc.balance or 0.0) + earned_norm
          tx_earn = models.Transaction(
              account_id=earnings_account_id,
              transaction_type="INCOME",
              category="Rider Earnings",
              amount=earned_norm,
              description=f"Rider daily earnings ({trips_completed} trips, {kilometers} km)",
              date=log_date,
              rider_log_id=log.id,
          )
          db.add(tx_earn)

      # 2. Debit Expense Account & Record Expenses
      if expense_account_id:
        exp_acc = db.query(account_model).filter(account_model.id == expense_account_id).first()
        if exp_acc:
          # Fuel expense
          if fuel_norm > 0:
            exp_acc.balance = float(exp_acc.balance or 0.0) - fuel_norm
            st_name = fuel_station if fuel_station else "Station"
            tx_fuel = models.Transaction(
                account_id=expense_account_id,
                transaction_type="EXPENSE",
                category="Fuel",
                amount=fuel_norm,
                description=f"Motorcycle fuel ({final_litres}L @ {st_name})",
                date=log_date,
                rider_log_id=log.id,
            )
            db.add(tx_fuel)

          # Food & Lunch expense
          if food_norm > 0:
            exp_acc.balance = float(exp_acc.balance or 0.0) - food_norm
            tx_food = models.Transaction(
                account_id=expense_account_id,
                transaction_type="EXPENSE",
                category="Food & Dining",
                amount=food_norm,
                description="Rider shift lunch / food",
                date=log_date,
                rider_log_id=log.id,
            )
            db.add(tx_food)

          # Maintenance expense
          if maint_norm > 0:
            exp_acc.balance = float(exp_acc.balance or 0.0) - maint_norm
            tx_maint = models.Transaction(
                account_id=expense_account_id,
                transaction_type="EXPENSE",
                category="Maintenance",
                amount=maint_norm,
                description="Motorcycle repair / maintenance",
                date=log_date,
                rider_log_id=log.id,
            )
            db.add(tx_maint)

          # Airtime expense
          if airtime_norm > 0:
            exp_acc.balance = float(exp_acc.balance or 0.0) - airtime_norm
            tx_airtime = models.Transaction(
                account_id=expense_account_id,
                transaction_type="EXPENSE",
                category="Airtime",
                amount=airtime_norm,
                description="Delivery communications / airtime",
                date=log_date,
                rider_log_id=log.id,
            )
            db.add(tx_airtime)

          # Misc expense
          if misc_norm > 0:
            exp_acc.balance = float(exp_acc.balance or 0.0) - misc_norm
            tx_misc = models.Transaction(
                account_id=expense_account_id,
                transaction_type="EXPENSE",
                category="Miscellaneous",
                amount=misc_norm,
                description="Rider shift miscellaneous expense",
                date=log_date,
                rider_log_id=log.id,
            )
            db.add(tx_misc)

      db.commit()

  return RedirectResponse(url="/rider?toast=Rider+shift+log+and+finance+transactions+saved", status_code=303)


# --- MULTI-BIKE FLEET ROUTES ---


@app.post("/rider/bikes/create")
def create_bike(
    plate_number: str = Form(...),
    model_name: Optional[str] = Form("Bajaj Boxer 150"),
    owner_name: Optional[str] = Form(""),
    daily_target: float = Form(2500.0),
    db: Session = Depends(get_db),
):
  if hasattr(models, "Bike"):
    clean_plate = plate_number.strip().upper()
    existing = db.query(models.Bike).filter(models.Bike.plate_number == clean_plate).first()
    if not existing:
      bike = models.Bike(
          plate_number=clean_plate,
          model_name=model_name.strip() if model_name else "Bajaj Boxer 150",
          owner_name=owner_name.strip() if owner_name else None,
          daily_target=float(daily_target or 2500.0),
          is_active=1,
      )
      db.add(bike)
      db.commit()
  return RedirectResponse(url="/rider?toast=Motorcycle+added+to+fleet", status_code=303)


@app.post("/rider/bikes/switch/{bike_id}")
def switch_bike(bike_id: int):
  resp = RedirectResponse(url="/rider?toast=Switched+active+motorcycle", status_code=303)
  resp.set_cookie(key="finatrack_bike_id", value=str(bike_id), max_age=30 * 24 * 3600)
  return resp


@app.post("/rider/bikes/delete/{bike_id}")
def delete_bike(bike_id: int, db: Session = Depends(get_db)):
  if hasattr(models, "Bike"):
    bike = db.query(models.Bike).filter(models.Bike.id == bike_id).first()
    if bike:
      db.delete(bike)
      db.commit()
  return RedirectResponse(url="/rider?toast=Motorcycle+removed+from+fleet", status_code=303)


@app.post("/rider/logs/delete/{log_id}")
def delete_rider_log(log_id: int, db: Session = Depends(get_db)):
  account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))

  # 1. Reverse linked finance transactions and restore account balances
  if hasattr(models, "Transaction"):
    linked_txs = db.query(models.Transaction).filter(models.Transaction.rider_log_id == log_id).all()
    for tx in linked_txs:
      if account_model and tx.account_id:
        acc = db.query(account_model).filter(account_model.id == tx.account_id).first()
        if acc:
          if tx.transaction_type.upper() == "INCOME":
            acc.balance = float(acc.balance or 0.0) - float(tx.amount)
          else:
            acc.balance = float(acc.balance or 0.0) + float(tx.amount)
      db.delete(tx)

  # 2. Delete rider log
  rider_log_model = getattr(models, "RiderLog", None)
  log = db.query(rider_log_model).filter(rider_log_model.id == log_id).first() if rider_log_model else None
  if log:
    db.delete(log)

  db.commit()
  return RedirectResponse(url="/rider?toast=Log+and+linked+finance+records+deleted", status_code=303)


# --- MOTORCYCLE MAINTENANCE & COMPLIANCE ROUTES ---


@app.post("/rider/maintenance/complete/{maint_id}")
def complete_maintenance(
    request: Request,
    maint_id: int,
    bought_brake_pads: Optional[str] = Form(None),
    brake_pad_cost: float = Form(0.0),
    service_cost: float = Form(0.0),
    payment_account_id: Optional[int] = Form(None),
    notes: Optional[str] = Form(""),
    db: Session = Depends(get_db),
):
  if hasattr(models, "MaintenanceSchedule"):
    maint = db.query(models.MaintenanceSchedule).filter(models.MaintenanceSchedule.id == maint_id).first()
    if maint:
      today = date.today()
      maint.last_service_date = today
      maint.next_due_date = today + timedelta(weeks=maint.interval_weeks or 3)
      if notes:
        maint.notes = notes

      has_brake_pads = bought_brake_pads in ["on", "true", "1", True]
      if has_brake_pads:
        maint.last_brake_pad_date = today
        maint.brake_pad_cost_last = brake_pad_cost

      # Log financial expense if cost incurred
      rate = get_live_rate()
      currency_pref = request.cookies.get("finatrack_currency", "Ksh")
      total_cost = service_cost + (brake_pad_cost if has_brake_pads else 0.0)
      if total_cost > 0 and payment_account_id:
        norm_cost = float(total_cost / rate if currency_pref == "Ksh" else total_cost)
        account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
        acc = db.query(account_model).filter(account_model.id == payment_account_id).first() if account_model else None
        if acc:
          acc.balance = float(acc.balance or 0.0) - norm_cost
          desc = "Motorcycle full service (Oil + Chain)"
          if has_brake_pads:
            desc += " + New Brake Pads"
          tx = models.Transaction(
              account_id=payment_account_id,
              transaction_type="EXPENSE",
              category="Maintenance",
              amount=norm_cost,
              description=desc,
              date=today,
          )
          db.add(tx)

      db.commit()

  return RedirectResponse(url="/rider?toast=Maintenance+servicing+recorded+successfully", status_code=303)


@app.post("/rider/maintenance/brake-pads")
def log_brake_pads_purchase(
    request: Request,
    brake_pad_cost: float = Form(...),
    replacement_date: date = Form(...),
    payment_account_id: Optional[int] = Form(None),
    notes: Optional[str] = Form(""),
    db: Session = Depends(get_db),
):
  if hasattr(models, "MaintenanceSchedule"):
    maint = db.query(models.MaintenanceSchedule).first()
    if not maint:
      maint = models.MaintenanceSchedule(
          service_type="Oil Change (Oil, Chain & Brake Pads)",
          interval_weeks=3,
          last_service_date=date.today(),
          next_due_date=date.today() + timedelta(weeks=3),
      )
      db.add(maint)

    maint.last_brake_pad_date = replacement_date
    maint.brake_pad_cost_last = brake_pad_cost
    if notes:
      maint.notes = notes

    # If paid from an account, record expense
    if brake_pad_cost > 0 and payment_account_id:
      rate = get_live_rate()
      currency_pref = request.cookies.get("finatrack_currency", "Ksh")
      norm_cost = float(brake_pad_cost / rate if currency_pref == "Ksh" else brake_pad_cost)
      account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
      acc = db.query(account_model).filter(account_model.id == payment_account_id).first() if account_model else None
      if acc:
        acc.balance = float(acc.balance or 0.0) - norm_cost
        tx = models.Transaction(
            account_id=payment_account_id,
            transaction_type="EXPENSE",
            category="Maintenance",
            amount=norm_cost,
            description="Motorcycle brake pads replacement",
            date=replacement_date,
        )
        db.add(tx)

    db.commit()

  return RedirectResponse(url="/rider?toast=Brake+pads+replacement+recorded+successfully", status_code=303)


@app.post("/rider/maintenance/interval/{maint_id}")
def update_maintenance_interval(maint_id: int, interval_weeks: int = Form(...), db: Session = Depends(get_db)):
  if hasattr(models, "MaintenanceSchedule"):
    maint = db.query(models.MaintenanceSchedule).filter(models.MaintenanceSchedule.id == maint_id).first()
    if maint:
      maint.interval_weeks = interval_weeks
      base_date = maint.last_service_date or date.today()
      maint.next_due_date = base_date + timedelta(weeks=interval_weeks)
      db.commit()
  return RedirectResponse(url="/rider?toast=Service+interval+updated", status_code=303)


@app.post("/rider/compliance/renew/{comp_id}")
def renew_compliance(
    request: Request,
    comp_id: int,
    interval_months: int = Form(...),  # 6 or 12
    cost: float = Form(0.0),
    payment_account_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
  if hasattr(models, "ComplianceDeadline"):
    comp = db.query(models.ComplianceDeadline).filter(models.ComplianceDeadline.id == comp_id).first()
    if comp:
      today = date.today()
      comp.last_renewed_date = today
      comp.interval_months = interval_months
      comp.expiry_date = today + timedelta(days=int(interval_months * 30.4))

      # Record financial expense if cost provided
      if cost > 0 and payment_account_id:
        rate = get_live_rate()
        currency_pref = request.cookies.get("finatrack_currency", "Ksh")
        norm_cost = float(cost / rate if currency_pref == "Ksh" else cost)
        account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
        acc = db.query(account_model).filter(account_model.id == payment_account_id).first() if account_model else None
        if acc:
          acc.balance = float(acc.balance or 0.0) - norm_cost
          tx = models.Transaction(
              account_id=payment_account_id,
              transaction_type="EXPENSE",
              category="Licenses & Insurance",
              amount=norm_cost,
              description=f"{comp.title} Renewal ({interval_months} months)",
              date=today,
          )
          db.add(tx)

      db.commit()

  return RedirectResponse(url="/rider?toast=License+renewed+successfully", status_code=303)


@app.post("/rider/maintenance/setup")
def setup_maintenance(
    interval_weeks: int = Form(3),
    last_service_date: date = Form(...),
    last_brake_pad_date: Optional[date] = Form(None),
    notes: Optional[str] = Form(""),
    db: Session = Depends(get_db),
):
  if hasattr(models, "MaintenanceSchedule"):
    maint = db.query(models.MaintenanceSchedule).first()
    if not maint:
      maint = models.MaintenanceSchedule()
      db.add(maint)

    maint.service_type = "Oil Change (Oil, Chain & Brake Pads)"
    maint.interval_weeks = interval_weeks
    maint.last_service_date = last_service_date
    maint.next_due_date = last_service_date + timedelta(weeks=interval_weeks)
    if last_brake_pad_date:
      maint.last_brake_pad_date = last_brake_pad_date
    if notes:
      maint.notes = notes

    db.commit()

  return RedirectResponse(url="/rider?toast=Maintenance+schedule+saved+successfully", status_code=303)


@app.post("/rider/compliance/create")
def create_compliance(
    title: str = Form(...),
    interval_months: int = Form(12),
    expiry_date: date = Form(...),
    notes: Optional[str] = Form(""),
    db: Session = Depends(get_db),
):
  if hasattr(models, "ComplianceDeadline"):
    comp = models.ComplianceDeadline(
        title=title.strip(),
        interval_months=interval_months,
        last_renewed_date=date.today(),
        expiry_date=expiry_date,
        notes=notes,
    )
    db.add(comp)
    db.commit()

  return RedirectResponse(url="/rider?toast=License+or+permit+deadline+added", status_code=303)


@app.post("/rider/compliance/delete/{comp_id}")
def delete_compliance(comp_id: int, db: Session = Depends(get_db)):
  if hasattr(models, "ComplianceDeadline"):
    comp = db.query(models.ComplianceDeadline).filter(models.ComplianceDeadline.id == comp_id).first()
    if comp:
      db.delete(comp)
      db.commit()
  return RedirectResponse(url="/rider?toast=Regulatory+deadline+removed", status_code=303)


# --- LIPA MDOGO MDOGO (BIKE FINANCING) ROUTES ---


@app.post("/rider/financing/create")
def create_bike_financing(
    request: Request,
    provider_name: str = Form(...),  # Mogo, Spiro, Watu, Zeno
    daily_amount: float = Form(...),
    total_cost: float = Form(...),
    paid_amount: float = Form(0.0),
    frequency: str = Form("DAILY"),
    db: Session = Depends(get_db),
):
  if hasattr(models, "BikeFinancing"):
    rate = get_live_rate()
    currency_pref = request.cookies.get("finatrack_currency", "Ksh")
    norm_daily = float(daily_amount / rate if currency_pref == "Ksh" else daily_amount)
    norm_total = float(total_cost / rate if currency_pref == "Ksh" else total_cost)
    norm_paid = float(paid_amount / rate if currency_pref == "Ksh" else paid_amount)

    plan = models.BikeFinancing(
        provider_name=provider_name.strip(),
        daily_amount=norm_daily,
        total_cost=norm_total,
        paid_amount=norm_paid,
        start_date=date.today(),
        frequency=frequency,
        status="ACTIVE",
    )
    db.add(plan)
    db.commit()

  return RedirectResponse(url="/rider?toast=Bike+financing+plan+added", status_code=303)


@app.post("/rider/financing/pay/{plan_id}")
def pay_bike_financing(
    request: Request,
    plan_id: int,
    amount: float = Form(...),
    payment_account_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
  if hasattr(models, "BikeFinancing"):
    plan = db.query(models.BikeFinancing).filter(models.BikeFinancing.id == plan_id).first()
    if plan:
      rate = get_live_rate()
      currency_pref = request.cookies.get("finatrack_currency", "Ksh")
      norm_amt = float(amount / rate if currency_pref == "Ksh" else amount)

      plan.paid_amount = float(plan.paid_amount or 0.0) + norm_amt
      if plan.paid_amount >= float(plan.total_cost or 0.0):
        plan.status = "PAID_OFF"

      # Record in personal finance accounts if account provided
      if payment_account_id:
        account_model = getattr(models, "FinanceAccount", getattr(models, "Account", None))
        acc = db.query(account_model).filter(account_model.id == payment_account_id).first() if account_model else None
        if acc:
          acc.balance = float(acc.balance or 0.0) - norm_amt
          tx = models.Transaction(
              account_id=payment_account_id,
              transaction_type="EXPENSE",
              category="Bike Financing (Lipa Mdogo Mdogo)",
              amount=norm_amt,
              description=f"{plan.provider_name} motorcycle installment",
              date=date.today(),
          )
          db.add(tx)

      db.commit()

  return RedirectResponse(url="/rider?toast=Installment+recorded+successfully", status_code=303)


@app.post("/rider/financing/delete/{plan_id}")
def delete_bike_financing(plan_id: int, db: Session = Depends(get_db)):
  if hasattr(models, "BikeFinancing"):
    plan = db.query(models.BikeFinancing).filter(models.BikeFinancing.id == plan_id).first()
    if plan:
      db.delete(plan)
      db.commit()
  return RedirectResponse(url="/rider?toast=Financing+plan+removed", status_code=303)