using AccountingSystem.Api.Data;
using AccountingSystem.Api.Models;
using AccountingSystem.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccountingSystem.Api.Controllers;

/// <summary>10. Accounts payable: vendor bills (Dr Inventory or Expense, Cr Accounts Payable) and payments.</summary>
[ApiController, Route("api/[controller]")]
public class PayablesController(AppDbContext db, PostingService posting) : ControllerBase
{
    [HttpGet]
    public async Task<List<Bill>> GetAll() =>
        await db.Bills.Include(b => b.Vendor).Include(b => b.Material).AsNoTracking()
            .OrderByDescending(b => b.Date).ThenByDescending(b => b.Id).ToListAsync();

    [HttpPost]
    public async Task<ActionResult<Bill>> Create(Bill b)
    {
        if (b.Amount <= 0) throw new InvalidOperationException("Amount must be greater than zero.");
        _ = await db.Vendors.FindAsync(b.VendorId) ?? throw new InvalidOperationException("Select a vendor.");

        b.Id = 0; b.Vendor = null; b.Material = null; b.PaidAmount = 0;
        if (string.IsNullOrWhiteSpace(b.BillNo)) b.BillNo = PostingService.Ref("BILL");

        int debitAccount;
        if (b.MaterialId is int materialId)
        {
            var m = await db.Materials.FindAsync(materialId) ?? throw new InvalidOperationException("Material not found.");
            await posting.ReceiveStock(m, b.Quantity, b.Amount, b.Date, "Purchase", b.BillNo);
            debitAccount = await posting.IdOf("1200");
            b.ExpenseAccountId = null;
        }
        else
        {
            var expId = b.ExpenseAccountId ?? await posting.IdOf("5900");
            var exp = await db.Accounts.FindAsync(expId);
            if (exp is null || exp.Type != AccountType.Expense) throw new InvalidOperationException("Select an expense account.");
            debitAccount = exp.Id;
            b.ExpenseAccountId = exp.Id;
            b.Quantity = 0;
        }

        b.JournalEntry = posting.Post(b.Date, "Payable", b.BillNo, b.Description ?? $"Bill {b.BillNo}",
            (debitAccount, b.Amount, 0), (await posting.IdOf("2000"), 0, b.Amount));
        db.Bills.Add(b);
        await db.SaveChangesAsync();
        return Ok(b);
    }

    [HttpPost("{id:int}/pay")]
    public async Task<IActionResult> Pay(int id, PaymentRequest p)
    {
        var b = await db.Bills.FindAsync(id) ?? throw new InvalidOperationException("Bill not found.");
        if (p.Amount <= 0 || p.Amount > b.Balance) throw new InvalidOperationException($"Enter an amount between 0 and {b.Balance:N2}.");

        b.PaidAmount += p.Amount;
        posting.Post(p.Date ?? DateTime.Today, "Payable", PostingService.Ref("PAY"), $"Payment of bill {b.BillNo}",
            (await posting.IdOf("2000"), p.Amount, 0), (await posting.IdOf("1000"), 0, p.Amount));
        await db.SaveChangesAsync();
        return Ok();
    }
}

/// <summary>11. Accounts receivable: unpaid sales and customer receipts (Dr Cash, Cr Accounts Receivable).</summary>
[ApiController, Route("api/[controller]")]
public class ReceivablesController(AppDbContext db, PostingService posting) : ControllerBase
{
    [HttpGet]
    public async Task<List<Sale>> Outstanding() =>
        await db.Sales.Include(s => s.Customer).Include(s => s.Article).AsNoTracking()
            .Where(s => s.Total > s.PaidAmount)
            .OrderBy(s => s.Date).ToListAsync();

    [HttpPost("{id:int}/receive")]
    public async Task<IActionResult> Receive(int id, PaymentRequest p)
    {
        var s = await db.Sales.FindAsync(id) ?? throw new InvalidOperationException("Sale not found.");
        if (p.Amount <= 0 || p.Amount > s.Balance) throw new InvalidOperationException($"Enter an amount between 0 and {s.Balance:N2}.");

        s.PaidAmount += p.Amount;
        posting.Post(p.Date ?? DateTime.Today, "Receivable", PostingService.Ref("RCT"), $"Receipt for {s.InvoiceNo}",
            (await posting.IdOf("1000"), p.Amount, 0), (await posting.IdOf("1100"), 0, p.Amount));
        await db.SaveChangesAsync();
        return Ok();
    }
}
