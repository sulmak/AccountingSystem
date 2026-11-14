using AccountingSystem.Api.Data;
using AccountingSystem.Api.Models;
using AccountingSystem.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccountingSystem.Api.Controllers;

/// <summary>6. Sales entry. Posts revenue, receivable (if unpaid), cost of goods sold and stock issue in one transaction.</summary>
[ApiController, Route("api/[controller]")]
public class SalesController(AppDbContext db, PostingService posting) : ControllerBase
{
    [HttpGet]
    public async Task<List<Sale>> GetAll() =>
        await db.Sales.Include(s => s.Customer).Include(s => s.Article).AsNoTracking()
            .OrderByDescending(s => s.Date).ThenByDescending(s => s.Id).ToListAsync();

    [HttpPost]
    public async Task<ActionResult<Sale>> Create(Sale s)
    {
        var article = await db.Articles.Include(a => a.Material).FirstOrDefaultAsync(a => a.Id == s.ArticleId)
            ?? throw new InvalidOperationException("Select an article.");
        var material = article.Material!;
        if (s.Quantity <= 0) throw new InvalidOperationException("Quantity must be greater than zero.");
        if (s.UnitPrice <= 0) s.UnitPrice = article.SalePrice;

        s.Total = Math.Round(s.Quantity * s.UnitPrice, 2);
        if (s.PaidAmount < 0 || s.PaidAmount > s.Total) throw new InvalidOperationException("Paid amount must be between zero and the sale total.");
        if (s.PaidAmount < s.Total && s.CustomerId is null) throw new InvalidOperationException("Select a customer for a sale that is not fully paid.");

        var materialQty = s.Quantity * article.MaterialQtyPerUnit;
        var onHand = await posting.OnHand(material.Id);
        if (onHand < materialQty)
            throw new InvalidOperationException($"Not enough stock of {material.Name}: {onHand:0.##} {material.Unit} available, {materialQty:0.##} needed.");

        s.Id = 0; s.Customer = null; s.Article = null;
        s.InvoiceNo = $"INV-{DateTime.Now:yyMMdd}-{await db.Sales.CountAsync() + 1:D4}";
        var cogs = Math.Round(materialQty * material.UnitCost, 2);

        s.JournalEntry = posting.Post(s.Date, "Sale", s.InvoiceNo, $"Sale of {article.Name}",
            (await posting.IdOf("1000"), s.PaidAmount, 0),
            (await posting.IdOf("1100"), s.Total - s.PaidAmount, 0),
            (await posting.IdOf("4000"), 0, s.Total),
            (await posting.IdOf("5000"), cogs, 0),
            (await posting.IdOf("1200"), 0, cogs));

        db.InventoryTransactions.Add(new InventoryTransaction
        {
            MaterialId = material.Id, Date = s.Date, Quantity = -materialQty,
            UnitCost = material.UnitCost, Type = "Sale", Reference = s.InvoiceNo
        });
        db.Sales.Add(s);
        await db.SaveChangesAsync();
        return Ok(s);
    }
}
