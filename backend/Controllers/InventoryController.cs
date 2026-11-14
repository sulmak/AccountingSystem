using AccountingSystem.Api.Data;
using AccountingSystem.Api.Models;
using AccountingSystem.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccountingSystem.Api.Controllers;

public record StockRow(int MaterialId, string Code, string Name, string Unit, decimal OnHand, decimal UnitCost, decimal Value, bool LowStock);
public record OpeningStockRequest(int MaterialId, decimal Quantity, decimal UnitCost, DateTime? Date);

/// <summary>3. Inventory of material.</summary>
[ApiController, Route("api/[controller]")]
public class InventoryController(AppDbContext db, PostingService posting) : ControllerBase
{
    [HttpGet("stock")]
    public async Task<List<StockRow>> Stock()
    {
        var onHand = await db.InventoryTransactions.GroupBy(t => t.MaterialId)
            .Select(g => new { g.Key, Qty = g.Sum(x => x.Quantity) })
            .ToDictionaryAsync(x => x.Key, x => x.Qty);
        var materials = await db.Materials.AsNoTracking().OrderBy(m => m.Code).ToListAsync();
        return materials.Select(m =>
        {
            var q = onHand.GetValueOrDefault(m.Id);
            return new StockRow(m.Id, m.Code, m.Name, m.Unit, q, m.UnitCost, Math.Round(q * m.UnitCost, 2), q <= m.ReorderLevel);
        }).ToList();
    }

    [HttpGet("transactions")]
    public async Task<List<InventoryTransaction>> Transactions([FromQuery] int? materialId) =>
        await db.InventoryTransactions.Include(t => t.Material).AsNoTracking()
            .Where(t => materialId == null || t.MaterialId == materialId)
            .OrderByDescending(t => t.Date).ThenByDescending(t => t.Id).Take(300).ToListAsync();

    /// <summary>Opening stock: Dr Inventory, Cr Owner's Equity.</summary>
    [HttpPost("opening")]
    public async Task<IActionResult> Opening(OpeningStockRequest r)
    {
        if (r.Quantity <= 0 || r.UnitCost < 0) throw new InvalidOperationException("Enter a quantity above zero and a cost of zero or more.");
        var m = await db.Materials.FindAsync(r.MaterialId) ?? throw new InvalidOperationException("Material not found.");
        var date = r.Date ?? DateTime.Today;
        var value = Math.Round(r.Quantity * r.UnitCost, 2);
        var reference = PostingService.Ref("OPEN");

        await posting.ReceiveStock(m, r.Quantity, value, date, "Opening", reference);
        posting.Post(date, "Inventory", reference, $"Opening stock - {m.Name}",
            (await posting.IdOf("1200"), value, 0), (await posting.IdOf("3000"), 0, value));
        await db.SaveChangesAsync();
        return Ok();
    }
}
