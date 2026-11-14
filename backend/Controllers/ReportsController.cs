using AccountingSystem.Api.Data;
using AccountingSystem.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccountingSystem.Api.Controllers;

public record TbRow(string Code, string Name, string Type, decimal OpeningDebit, decimal OpeningCredit,
    decimal PeriodDebit, decimal PeriodCredit, decimal Debit, decimal Credit);
public record AmountRow(string Code, string Name, decimal Amount);

[ApiController, Route("api/reports")]
public class ReportsController(AppDbContext db) : ControllerBase
{
    private record Sums(int AccountId, decimal Debit, decimal Credit);

    private async Task<List<Sums>> SumLines(IQueryable<JournalLine> lines) =>
        await lines.GroupBy(l => l.AccountId)
            .Select(g => new Sums(g.Key, g.Sum(x => x.Debit), g.Sum(x => x.Credit))).ToListAsync();

    /// <summary>13. Trial balance. With "from" it shows opening balance, movement in the period and closing balance;
    /// without it, everything up to "asOf" is movement and the closing columns are the classic trial balance.</summary>
    [HttpGet("trial-balance")]
    public async Task<object> TrialBalance([FromQuery] DateTime? from, [FromQuery] DateTime? asOf)
    {
        var to = asOf ?? DateTime.Today;
        var start = from ?? new DateTime(1900, 1, 1);
        var accounts = await db.Accounts.ToDictionaryAsync(a => a.Id);

        var opening = from is null
            ? new Dictionary<int, decimal>()
            : (await SumLines(db.JournalLines.Where(l => l.JournalEntry!.Date < start))).ToDictionary(x => x.AccountId, x => x.Debit - x.Credit);
        var period = await SumLines(db.JournalLines.Where(l => l.JournalEntry!.Date >= start && l.JournalEntry!.Date <= to));

        var ids = opening.Keys.Union(period.Select(p => p.AccountId)).ToList();
        var rows = ids.Select(id =>
        {
            var a = accounts[id];
            var on = opening.GetValueOrDefault(id);
            var p = period.FirstOrDefault(x => x.AccountId == id);
            var pd = p?.Debit ?? 0; var pc = p?.Credit ?? 0;
            var cn = on + pd - pc;
            return new TbRow(a.Code, a.Name, a.Type.ToString(), on > 0 ? on : 0, on < 0 ? -on : 0, pd, pc, cn > 0 ? cn : 0, cn < 0 ? -cn : 0);
        }).Where(r => r.OpeningDebit != 0 || r.OpeningCredit != 0 || r.PeriodDebit != 0 || r.PeriodCredit != 0 || r.Debit != 0 || r.Credit != 0)
          .OrderBy(r => r.Code).ToList();

        return new
        {
            from, asOf = to, rows,
            totalOpeningDebit = rows.Sum(r => r.OpeningDebit), totalOpeningCredit = rows.Sum(r => r.OpeningCredit),
            totalPeriodDebit = rows.Sum(r => r.PeriodDebit), totalPeriodCredit = rows.Sum(r => r.PeriodCredit),
            totalDebit = rows.Sum(r => r.Debit), totalCredit = rows.Sum(r => r.Credit)
        };
    }

    /// <summary>General ledger report: every account (or one account) with opening balance, transactions and closing balance.</summary>
    [HttpGet("general-ledger")]
    public async Task<object> GeneralLedger([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int? accountId)
    {
        var f = from ?? new DateTime(DateTime.Today.Year, 1, 1);
        var t = to ?? DateTime.Today;
        var accounts = await db.Accounts.AsNoTracking().Where(a => accountId == null || a.Id == accountId).OrderBy(a => a.Code).ToListAsync();
        var ids = accounts.Select(a => a.Id).ToList();

        var opening = await db.JournalLines.Where(l => ids.Contains(l.AccountId) && l.JournalEntry!.Date < f)
            .GroupBy(l => l.AccountId).Select(g => new { g.Key, Net = g.Sum(x => x.Debit - x.Credit) })
            .ToDictionaryAsync(x => x.Key, x => x.Net);
        var lines = await db.JournalLines.Include(l => l.JournalEntry)
            .Where(l => ids.Contains(l.AccountId) && l.JournalEntry!.Date >= f && l.JournalEntry!.Date <= t)
            .OrderBy(l => l.JournalEntry!.Date).ThenBy(l => l.Id).ToListAsync();
        var byAccount = lines.ToLookup(l => l.AccountId);

        var result = new List<object>();
        foreach (var a in accounts)
        {
            var open = opening.GetValueOrDefault(a.Id);
            var running = open; decimal totalDebit = 0, totalCredit = 0;
            var rows = new List<object>();
            foreach (var l in byAccount[a.Id])
            {
                running += l.Debit - l.Credit; totalDebit += l.Debit; totalCredit += l.Credit;
                rows.Add(new
                {
                    date = l.JournalEntry!.Date, reference = l.JournalEntry.Reference,
                    description = l.Memo ?? l.JournalEntry.Description, source = l.JournalEntry.Source,
                    debit = l.Debit, credit = l.Credit, balance = running
                });
            }
            if (accountId is null && open == 0 && rows.Count == 0) continue;   // skip idle accounts in the full report
            result.Add(new { a.Id, a.Code, a.Name, Type = a.Type.ToString(), opening = open, rows, totalDebit, totalCredit, closing = running });
        }
        return new { from = f, to = t, accounts = result };
    }

    /// <summary>12. Income statement for a period.</summary>
    [HttpGet("income-statement")]
    public async Task<object> IncomeStatement([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var f = from ?? new DateTime(DateTime.Today.Year, 1, 1);
        var t = to ?? DateTime.Today;
        var sums = await SumLines(db.JournalLines.Where(l => l.JournalEntry!.Date >= f && l.JournalEntry!.Date <= t));
        var accounts = await db.Accounts.ToDictionaryAsync(a => a.Id);

        var revenue = new List<AmountRow>();
        var costOfSales = new List<AmountRow>();
        var expenses = new List<AmountRow>();
        foreach (var s in sums.OrderBy(s => accounts[s.AccountId].Code))
        {
            var a = accounts[s.AccountId];
            if (a.Type == AccountType.Revenue) revenue.Add(new(a.Code, a.Name, s.Credit - s.Debit));
            else if (a.Type == AccountType.Expense)
            {
                var row = new AmountRow(a.Code, a.Name, s.Debit - s.Credit);
                if (a.Code == "5000") costOfSales.Add(row); else expenses.Add(row);
            }
        }
        var totalRevenue = revenue.Sum(r => r.Amount);
        var totalCost = costOfSales.Sum(r => r.Amount);
        var totalExpenses = expenses.Sum(r => r.Amount);
        return new
        {
            from = f, to = t, revenue, totalRevenue, costOfSales, totalCostOfSales = totalCost,
            grossProfit = totalRevenue - totalCost, expenses, totalExpenses,
            netIncome = totalRevenue - totalCost - totalExpenses
        };
    }

    /// <summary>2. Budget activity: budget versus actual for a year (and optionally one month).</summary>
    [HttpGet("budget-activity")]
    public async Task<object> BudgetActivity([FromQuery] int year, [FromQuery] int month = 0)
    {
        if (year == 0) year = DateTime.Today.Year;
        var budgets = await db.Budgets.Where(b => b.Year == year && (month == 0 || b.Month == month))
            .GroupBy(b => b.AccountId).Select(g => new { AccountId = g.Key, Amount = g.Sum(x => x.Amount) })
            .ToDictionaryAsync(x => x.AccountId, x => x.Amount);

        var actuals = await SumLines(db.JournalLines.Where(l =>
            l.JournalEntry!.Date.Year == year && (month == 0 || l.JournalEntry.Date.Month == month)));
        var accounts = await db.Accounts.ToDictionaryAsync(a => a.Id);

        var ids = budgets.Keys.Union(actuals
            .Where(s => accounts[s.AccountId].Type is AccountType.Revenue or AccountType.Expense)
            .Select(s => s.AccountId)).ToList();

        var rows = ids.Select(id =>
        {
            var a = accounts[id];
            var s = actuals.FirstOrDefault(x => x.AccountId == id);
            var creditNormal = a.Type is AccountType.Revenue or AccountType.Liability or AccountType.Equity;
            var actual = s is null ? 0 : (creditNormal ? s.Credit - s.Debit : s.Debit - s.Credit);
            var budget = budgets.GetValueOrDefault(id);
            return new
            {
                a.Code, a.Name, Type = a.Type.ToString(), Budget = budget, Actual = actual,
                Variance = actual - budget, PercentUsed = budget == 0 ? (decimal?)null : Math.Round(actual / budget * 100, 1)
            };
        }).OrderBy(r => r.Code).ToList();

        return new { year, month, rows };
    }
}
