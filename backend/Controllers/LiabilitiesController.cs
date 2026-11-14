using AccountingSystem.Api.Data;
using AccountingSystem.Api.Models;
using AccountingSystem.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccountingSystem.Api.Controllers;

/// <summary>9. Liabilities: borrowing (Dr Cash, Cr liability) and repayment (Dr liability, Cr Cash).</summary>
[ApiController, Route("api/[controller]")]
public class LiabilitiesController(AppDbContext db, PostingService posting) : ControllerBase
{
    [HttpGet]
    public async Task<List<Liability>> GetAll() =>
        await db.Liabilities.Include(l => l.Account).AsNoTracking()
            .OrderByDescending(l => l.Date).ThenByDescending(l => l.Id).ToListAsync();

    [HttpPost]
    public async Task<ActionResult<Liability>> Create(Liability l)
    {
        if (l.Amount <= 0) throw new InvalidOperationException("Amount must be greater than zero.");
        var acc = await db.Accounts.FindAsync(l.AccountId);
        if (acc is null || acc.Type != AccountType.Liability) throw new InvalidOperationException("Select a liability account.");

        l.Id = 0; l.Account = null; l.PaidAmount = 0;
        l.JournalEntry = posting.Post(l.Date, "Liability", PostingService.Ref("LIA"), $"Liability - {l.Lender}",
            (await posting.IdOf("1000"), l.Amount, 0), (acc.Id, 0, l.Amount));
        db.Liabilities.Add(l);
        await db.SaveChangesAsync();
        return Ok(l);
    }

    [HttpPost("{id:int}/repay")]
    public async Task<IActionResult> Repay(int id, PaymentRequest p)
    {
        var l = await db.Liabilities.FindAsync(id) ?? throw new InvalidOperationException("Liability not found.");
        if (p.Amount <= 0 || p.Amount > l.Balance) throw new InvalidOperationException($"Enter an amount between 0 and {l.Balance:N2}.");

        l.PaidAmount += p.Amount;
        posting.Post(p.Date ?? DateTime.Today, "Liability", PostingService.Ref("LPAY"), $"Repayment - {l.Lender}",
            (l.AccountId, p.Amount, 0), (await posting.IdOf("1000"), 0, p.Amount));
        await db.SaveChangesAsync();
        return Ok();
    }
}
