using AccountingSystem.Api.Data;
using AccountingSystem.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccountingSystem.Api.Controllers;

/// <summary>At-a-glance numbers for the dashboard. Everything is derived from the journal.</summary>
[ApiController, Route("api/[controller]")]
public class DashboardController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<object> Get()
    {
        var setting = await db.AppSettings.AsNoTracking().FirstOrDefaultAsync() ?? new AppSetting();
        var today = DateTime.Today;
        var monthStart = new DateTime(today.Year, today.Month, 1);
        var fsm = Math.Clamp(setting.FiscalYearStartMonth, 1, 12);
        var yearStart = new DateTime(today.Month >= fsm ? today.Year : today.Year - 1, fsm, 1);

        // Financial position (balances to date)
        var accounts = await db.Accounts.AsNoTracking().ToListAsync();
        var net = await db.JournalLines.GroupBy(l => l.AccountId)
            .Select(g => new { AccountId = g.Key, Net = g.Sum(x => x.Debit - x.Credit) })
            .ToDictionaryAsync(x => x.AccountId, x => x.Net);
        decimal Bal(string code)
        {
            var a = accounts.FirstOrDefault(x => x.Code == code);
            return a is null ? 0 : net.GetValueOrDefault(a.Id);
        }
        var loans = -accounts.Where(a => a.Type == AccountType.Liability && a.Code != "2000").Sum(a => net.GetValueOrDefault(a.Id));

        // Profit and loss for a period
        async Task<(decimal Revenue, decimal Expenses)> Pl(DateTime from, DateTime to)
        {
            var rows = await db.JournalLines
                .Where(l => l.JournalEntry!.Date >= from && l.JournalEntry!.Date <= to)
                .Where(l => l.Account!.Type == AccountType.Revenue || l.Account!.Type == AccountType.Expense)
                .GroupBy(l => l.Account!.Type)
                .Select(g => new { Type = g.Key, Net = g.Sum(x => x.Credit - x.Debit) }).ToListAsync();
            return (rows.Where(r => r.Type == AccountType.Revenue).Sum(r => r.Net),
                    -rows.Where(r => r.Type == AccountType.Expense).Sum(r => r.Net));
        }

        var month = await Pl(monthStart, today);
        var year = await Pl(yearStart, today);

        var series = new List<object>();
        for (var i = 5; i >= 0; i--)
        {
            var start = monthStart.AddMonths(-i);
            var p = await Pl(start, start.AddMonths(1).AddDays(-1));
            series.Add(new { label = start.ToString("MMM yy"), revenue = p.Revenue, expenses = p.Expenses });
        }

        var topRaw = await db.JournalLines
            .Where(l => l.JournalEntry!.Date >= monthStart && l.JournalEntry!.Date <= today && l.Account!.Type == AccountType.Expense)
            .GroupBy(l => l.AccountId).Select(g => new { AccountId = g.Key, Amount = g.Sum(x => x.Debit - x.Credit) }).ToListAsync();
        var topExpenses = topRaw.Where(x => x.Amount > 0).OrderByDescending(x => x.Amount).Take(5)
            .Select(x => new { name = accounts.First(a => a.Id == x.AccountId).Name, amount = x.Amount }).ToList();

        // Budget for the current month
        var budgetRows = await db.Budgets.Where(b => b.Year == today.Year && b.Month == today.Month)
            .Select(b => new { b.Account!.Type, b.Amount }).ToListAsync();

        // Items needing attention
        var recv = await db.Sales.Where(s => s.Total > s.PaidAmount).Select(s => new { s.Date, Bal = s.Total - s.PaidAmount }).ToListAsync();
        var bills = await db.Bills.Where(b => b.Amount > b.PaidAmount).Select(b => new { b.DueDate, Bal = b.Amount - b.PaidAmount }).ToListAsync();
        var oldCut = today.AddDays(-30);
        var oldRecv = recv.Where(x => x.Date < oldCut).ToList();
        var overdue = bills.Where(x => x.DueDate != null && x.DueDate < today).ToList();

        var onHand = await db.InventoryTransactions.GroupBy(t => t.MaterialId)
            .Select(g => new { g.Key, Qty = g.Sum(x => x.Quantity) }).ToDictionaryAsync(x => x.Key, x => x.Qty);
        var lowStock = (await db.Materials.AsNoTracking().ToListAsync())
            .Select(m => new { name = m.Name, unit = m.Unit, onHand = onHand.GetValueOrDefault(m.Id), reorder = m.ReorderLevel })
            .Where(m => m.onHand <= m.reorder).OrderBy(m => m.onHand).Take(5).ToList();

        var recent = await db.JournalEntries.AsNoTracking()
            .OrderByDescending(e => e.Date).ThenByDescending(e => e.Id).Take(6)
            .Select(e => new { e.Id, e.Date, e.Reference, e.Description, e.Source, Amount = e.Lines.Sum(l => l.Debit) }).ToListAsync();

        return new
        {
            company = setting.CompanyName, currency = setting.Currency, asOf = today,
            lockedThrough = setting.LockedThrough, yearStart,
            position = new { cash = Bal("1000"), receivables = Bal("1100"), inventory = Bal("1200"), payables = -Bal("2000"), loans },
            month = new { revenue = month.Revenue, expenses = month.Expenses, net = month.Revenue - month.Expenses },
            year = new { revenue = year.Revenue, expenses = year.Expenses, net = year.Revenue - year.Expenses },
            series, topExpenses,
            budget = new
            {
                revenue = new { budget = budgetRows.Where(b => b.Type == AccountType.Revenue).Sum(b => b.Amount), actual = month.Revenue },
                expenses = new { budget = budgetRows.Where(b => b.Type == AccountType.Expense).Sum(b => b.Amount), actual = month.Expenses }
            },
            alerts = new
            {
                overdueBills = new { count = overdue.Count, amount = overdue.Sum(x => x.Bal) },
                oldReceivables = new { count = oldRecv.Count, amount = oldRecv.Sum(x => x.Bal) },
                lowStock
            },
            recent
        };
    }
}
