using AccountingSystem.Api.Data;
using AccountingSystem.Api.Models;
using AccountingSystem.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccountingSystem.Api.Controllers;

/// <summary>2. General ledger: manual journal entries and per-account ledger.</summary>
[ApiController, Route("api/[controller]")]
public class JournalController(AppDbContext db, PostingService posting) : ControllerBase
{
    [HttpGet]
    public async Task<List<JournalEntry>> GetAll([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var q = db.JournalEntries.Include(e => e.Lines).ThenInclude(l => l.Account).AsNoTracking().AsQueryable();
        if (from is not null) q = q.Where(e => e.Date >= from);
        if (to is not null) q = q.Where(e => e.Date <= to);
        return await q.OrderByDescending(e => e.Date).ThenByDescending(e => e.Id).Take(200).ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<JournalEntry>> Create(JournalEntry input)
    {
        var lines = input.Lines.Where(l => l.Debit != 0 || l.Credit != 0).ToList();
        if (lines.Any(l => l.Debit < 0 || l.Credit < 0 || (l.Debit > 0 && l.Credit > 0)))
            throw new InvalidOperationException("Each line must have either a debit or a credit amount.");
        var ids = lines.Select(l => l.AccountId).Distinct().ToList();
        if (await db.Accounts.CountAsync(a => ids.Contains(a.Id)) != ids.Count)
            throw new InvalidOperationException("One or more accounts do not exist.");

        var je = posting.Add(new JournalEntry
        {
            Date = input.Date, Source = "Manual",
            Reference = string.IsNullOrWhiteSpace(input.Reference) ? PostingService.Ref("JV") : input.Reference,
            Description = input.Description,
            Lines = lines.Select(l => new JournalLine { AccountId = l.AccountId, Debit = l.Debit, Credit = l.Credit, Memo = l.Memo }).ToList()
        });
        await db.SaveChangesAsync();
        return Ok(new { je.Id });
    }

    /// <summary>Posts a mirror entry (debits and credits swapped) dated today. Only the ledger is reversed, not the source document.</summary>
    [HttpPost("{id:int}/reverse")]
    public async Task<IActionResult> Reverse(int id)
    {
        var e = await db.JournalEntries.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new InvalidOperationException("Journal entry not found.");
        if (e.Source == "Reversal") throw new InvalidOperationException("A reversal cannot be reversed.");
        var reference = $"REV-{e.Reference ?? e.Id.ToString()}";
        if (await db.JournalEntries.AnyAsync(x => x.Source == "Reversal" && x.Reference == reference))
            throw new InvalidOperationException("This entry has already been reversed.");

        posting.Add(new JournalEntry
        {
            Date = DateTime.Today, Source = "Reversal", Reference = reference, Description = $"Reversal of {e.Reference} {e.Description}".Trim(),
            Lines = e.Lines.Select(l => new JournalLine { AccountId = l.AccountId, Debit = l.Credit, Credit = l.Debit, Memo = l.Memo }).ToList()
        });
        await db.SaveChangesAsync();
        return Ok();
    }

    /// <summary>Ledger for one account with opening balance and running balance (positive = debit).</summary>
    [HttpGet("ledger/{accountId:int}")]
    public async Task<object> Ledger(int accountId, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var acc = await db.Accounts.FindAsync(accountId) ?? throw new InvalidOperationException("Account not found.");
        var f = from ?? new DateTime(DateTime.Today.Year, 1, 1);
        var t = to ?? DateTime.Today;

        var opening = await db.JournalLines
            .Where(l => l.AccountId == accountId && l.JournalEntry!.Date < f)
            .SumAsync(l => (decimal?)(l.Debit - l.Credit)) ?? 0;

        var lines = await db.JournalLines.Include(l => l.JournalEntry)
            .Where(l => l.AccountId == accountId && l.JournalEntry!.Date >= f && l.JournalEntry!.Date <= t)
            .OrderBy(l => l.JournalEntry!.Date).ThenBy(l => l.Id).ToListAsync();

        var running = opening;
        var rows = new List<object>();
        foreach (var l in lines)
        {
            running += l.Debit - l.Credit;
            rows.Add(new
            {
                date = l.JournalEntry!.Date, reference = l.JournalEntry.Reference,
                description = l.Memo ?? l.JournalEntry.Description, source = l.JournalEntry.Source,
                debit = l.Debit, credit = l.Credit, balance = running
            });
        }
        return new { account = acc, from = f, to = t, opening, rows, closing = running };
    }
}
