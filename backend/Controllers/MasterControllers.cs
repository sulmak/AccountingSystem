using AccountingSystem.Api.Data;
using AccountingSystem.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccountingSystem.Api.Controllers;

// 1. Chart of accounts
public class AccountsController(AppDbContext db) : CrudController<Account>(db)
{
    protected override IQueryable<Account> Query() => Db.Accounts.OrderBy(a => a.Code);

    public override async Task<IActionResult> Update(int id, Account input)
    {
        var e = await Db.Accounts.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
        if (e is not null && e.IsSystem && (input.Code != e.Code || input.Type != e.Type || !input.IsActive))
            throw new InvalidOperationException("This is a system account: its code, type and active status cannot be changed.");
        return await base.Update(id, input);
    }

    public override async Task<IActionResult> Delete(int id)
    {
        var e = await Db.Accounts.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
        if (e is not null && e.IsSystem) throw new InvalidOperationException("System accounts cannot be deleted.");
        return await base.Delete(id);
    }
}

// 4. Material master
public class MaterialsController(AppDbContext db) : CrudController<Material>(db)
{
    protected override IQueryable<Material> Query() => Db.Materials.OrderBy(m => m.Code);
}

// 5. Article master (foreign key to material master)
public class ArticlesController(AppDbContext db) : CrudController<Article>(db)
{
    protected override IQueryable<Article> Query() => Db.Articles.Include(a => a.Material).OrderBy(a => a.Code);
}

public class CustomersController(AppDbContext db) : CrudController<Customer>(db)
{
    protected override IQueryable<Customer> Query() => Db.Customers.OrderBy(c => c.Name);
}

public class VendorsController(AppDbContext db) : CrudController<Vendor>(db)
{
    protected override IQueryable<Vendor> Query() => Db.Vendors.OrderBy(v => v.Name);
}

// 2. Budget
public class BudgetsController(AppDbContext db) : CrudController<Budget>(db)
{
    protected override IQueryable<Budget> Query() =>
        Db.Budgets.Include(b => b.Account).OrderByDescending(b => b.Year).ThenBy(b => b.Month).ThenBy(b => b.AccountId);

    /// <summary>Sets the same monthly budget for all 12 months of a year (creates or updates).</summary>
    [HttpPost("fill-year")]
    public async Task<IActionResult> FillYear(FillYearRequest r)
    {
        if (r.Amount < 0) throw new InvalidOperationException("Amount cannot be negative.");
        if (await Db.Accounts.FindAsync(r.AccountId) is null) throw new InvalidOperationException("Account not found.");
        var existing = await Db.Budgets.Where(b => b.AccountId == r.AccountId && b.Year == r.Year).ToListAsync();
        for (var month = 1; month <= 12; month++)
        {
            var b = existing.FirstOrDefault(x => x.Month == month);
            if (b is null) Db.Budgets.Add(new Budget { AccountId = r.AccountId, Year = r.Year, Month = month, Amount = r.Amount });
            else b.Amount = r.Amount;
        }
        await Db.SaveChangesAsync();
        return Ok();
    }
}

public record FillYearRequest(int AccountId, int Year, decimal Amount);
