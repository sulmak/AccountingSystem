using AccountingSystem.Api.Data;
using AccountingSystem.Api.Models;
using AccountingSystem.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccountingSystem.Api.Controllers;

/// <summary>7. Income entry: Dr Cash, Cr revenue account.</summary>
[ApiController, Route("api/[controller]")]
public class IncomesController(AppDbContext db, PostingService posting) : ControllerBase
{
    [HttpGet]
    public async Task<List<IncomeEntry>> GetAll() =>
        await db.IncomeEntries.Include(i => i.Account).AsNoTracking()
            .OrderByDescending(i => i.Date).ThenByDescending(i => i.Id).ToListAsync();

    [HttpPost]
    public async Task<ActionResult<IncomeEntry>> Create(IncomeEntry e)
    {
        if (e.Amount <= 0) throw new InvalidOperationException("Amount must be greater than zero.");
        var acc = await db.Accounts.FindAsync(e.AccountId);
        if (acc is null || acc.Type != AccountType.Revenue) throw new InvalidOperationException("Select a revenue account.");

        e.Id = 0; e.Account = null;
        e.JournalEntry = posting.Post(e.Date, "Income", PostingService.Ref("INC"), e.Description ?? acc.Name,
            (await posting.IdOf("1000"), e.Amount, 0), (acc.Id, 0, e.Amount));
        db.IncomeEntries.Add(e);
        await db.SaveChangesAsync();
        return Ok(e);
    }
}

/// <summary>8. Expense entry: Dr expense account, Cr Cash.</summary>
[ApiController, Route("api/[controller]")]
public class ExpensesController(AppDbContext db, PostingService posting) : ControllerBase
{
    [HttpGet]
    public async Task<List<ExpenseEntry>> GetAll() =>
        await db.ExpenseEntries.Include(i => i.Account).AsNoTracking()
            .OrderByDescending(i => i.Date).ThenByDescending(i => i.Id).ToListAsync();

    [HttpPost]
    public async Task<ActionResult<ExpenseEntry>> Create(ExpenseEntry e)
    {
        if (e.Amount <= 0) throw new InvalidOperationException("Amount must be greater than zero.");
        var acc = await db.Accounts.FindAsync(e.AccountId);
        if (acc is null || acc.Type != AccountType.Expense) throw new InvalidOperationException("Select an expense account.");

        e.Id = 0; e.Account = null;
        e.JournalEntry = posting.Post(e.Date, "Expense", PostingService.Ref("EXP"), e.Description ?? acc.Name,
            (acc.Id, e.Amount, 0), (await posting.IdOf("1000"), 0, e.Amount));
        db.ExpenseEntries.Add(e);
        await db.SaveChangesAsync();
        return Ok(e);
    }
}
