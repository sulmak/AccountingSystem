using AccountingSystem.Api.Data;
using AccountingSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AccountingSystem.Api.Services;

/// <summary>Creates balanced double-entry journal entries and inventory movements.
/// Nothing is saved here; the calling controller calls SaveChanges once so each business event is atomic.</summary>
public class PostingService(AppDbContext db)
{
    private Dictionary<string, int>? _codes;

    public async Task<int> IdOf(string code)
    {
        _codes ??= await db.Accounts.ToDictionaryAsync(a => a.Code, a => a.Id);
        return _codes.TryGetValue(code, out var id) ? id
            : throw new InvalidOperationException($"System account {code} is missing from the chart of accounts.");
    }

    public static string Ref(string prefix) => $"{prefix}-{DateTime.Now:yyMMdd-HHmmssfff}";

    public JournalEntry Add(JournalEntry je)
    {
        var lockedThrough = db.AppSettings.AsNoTracking().Select(x => x.LockedThrough).FirstOrDefault();
        if (lockedThrough is not null && je.Date.Date <= lockedThrough.Value.Date)
            throw new InvalidOperationException($"The period is locked through {lockedThrough.Value:yyyy-MM-dd}. Use a later date.");
        var debit = je.Lines.Sum(l => l.Debit);
        var credit = je.Lines.Sum(l => l.Credit);
        if (debit != credit)
            throw new InvalidOperationException($"Journal entry is not balanced (debit {debit:N2}, credit {credit:N2}).");
        if (je.Lines.Count < 2) throw new InvalidOperationException("A journal entry needs at least two lines.");
        db.JournalEntries.Add(je);
        return je;
    }

    public JournalEntry Post(DateTime date, string source, string reference, string? description,
        params (int Account, decimal Debit, decimal Credit)[] lines) =>
        Add(new JournalEntry
        {
            Date = date, Source = source, Reference = reference, Description = description,
            Lines = lines.Where(l => l.Debit != 0 || l.Credit != 0)
                         .Select(l => new JournalLine { AccountId = l.Account, Debit = l.Debit, Credit = l.Credit }).ToList()
        });

    public async Task<decimal> OnHand(int materialId) =>
        await db.InventoryTransactions.Where(t => t.MaterialId == materialId)
            .SumAsync(t => (decimal?)t.Quantity) ?? 0;

    /// <summary>Stock receipt; recalculates the material's moving-average unit cost.</summary>
    public async Task ReceiveStock(Material m, decimal qty, decimal totalCost, DateTime date, string type, string? reference)
    {
        if (qty <= 0) throw new InvalidOperationException("Quantity must be greater than zero.");
        var onHand = Math.Max(await OnHand(m.Id), 0);
        m.UnitCost = Math.Round((onHand * m.UnitCost + totalCost) / (onHand + qty), 4);
        db.InventoryTransactions.Add(new InventoryTransaction
        {
            MaterialId = m.Id, Date = date, Quantity = qty, UnitCost = Math.Round(totalCost / qty, 4),
            Type = type, Reference = reference
        });
    }
}
