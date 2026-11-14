# Ledgerline - Accounting System (ASP.NET Core 8 + Angular 17)

Pattern (MVC)
- Model      : backend/Models (EF Core entities) + backend/Data (DbContext) + PostingService (double-entry rules)
- Controller : backend/Controllers (REST API; business rules and posting)
- View       : frontend/src/app (Angular components and templates; config-driven screens in core/crud.config.ts)

Run
1. Backend  (needs .NET 8 SDK + SQL Server / LocalDB; edit the connection string in appsettings.json if needed)
     cd backend
     dotnet run                 # http://localhost:5080  (Swagger at /swagger). Database is created on first start.
2. Frontend (needs Node 18.19+ / 20+)
     cd frontend
     npm install
     npm start                  # http://localhost:4200  (/api is proxied to port 5080)

Posting rules (all balanced double entry, saved atomically)
- Sale            : Dr Cash (paid) + Dr A/R (unpaid), Cr Sales 4000; Dr COGS 5000, Cr Inventory 1200; stock issued from the article's material
- Income          : Dr Cash, Cr chosen revenue account
- Expense         : Dr chosen expense account, Cr Cash
- Liability       : Dr Cash, Cr chosen liability account; repayment Dr liability, Cr Cash
- Bill (payable)  : Dr Inventory (material, moving-average cost) or Expense, Cr A/P 2000; payment Dr A/P, Cr Cash
- Receipt (A/R)   : Dr Cash, Cr A/R 1100
- Opening stock   : Dr Inventory, Cr Owner's Equity 3000
System accounts used by code: 1000, 1100, 1200, 2000, 3000, 4000, 5000, 5900 (seeded; do not delete).

Posted transactions are immutable; correct mistakes with a manual journal entry.
For production, replace EnsureCreated() with EF migrations and add authentication.

Dashboard and admin panel (added)
- /dashboard : cash, receivables, inventory, payables, loans; month and fiscal-year results; 6-month chart; budget use; alerts; recent entries.
- /admin     : General settings (company, currency, fiscal year start, close-books date), Chart of accounts, General ledger
               (post / reverse entries, account ledger), Budgets (including fill a whole year), Budget activity.
- If you ran the first version, drop the AccountingDb database once (new table AppSettings); EnsureCreated does not alter existing databases.

Report downloads (added)
- Income statement, Trial balance and General ledger pages have a period selector (monthly, quarterly, half-yearly, yearly, custom dates)
  and Download PDF / Download Excel buttons. Quarters and halves follow the fiscal year start month in Admin > General settings.
- Trial balance shows opening balance, movement in the period and closing balance. General ledger can cover all accounts or one.
- New npm packages: jspdf, jspdf-autotable, exceljs. Run `npm install` again in the frontend folder.
- Local setup used so far: frontend on port 4300 (angular.json), API proxy target https://localhost:44397 (src/proxy.conf.json).

---

**Powered by Md. Atikur Rahman Mridha**
