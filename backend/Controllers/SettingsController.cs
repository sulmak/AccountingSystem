using AccountingSystem.Api.Data;
using AccountingSystem.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccountingSystem.Api.Controllers;

/// <summary>Admin: company, currency, fiscal year and period lock.</summary>
[ApiController, Route("api/[controller]")]
public class SettingsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<AppSetting> Get() => await db.AppSettings.AsNoTracking().FirstAsync();

    [HttpPut]
    public async Task<IActionResult> Put(AppSetting input)
    {
        if (input.FiscalYearStartMonth is < 1 or > 12) throw new InvalidOperationException("Fiscal year start month must be 1 to 12.");
        if (string.IsNullOrWhiteSpace(input.CompanyName)) throw new InvalidOperationException("Company name is required.");
        var s = await db.AppSettings.FirstAsync();
        s.CompanyName = input.CompanyName.Trim();
        s.Currency = string.IsNullOrWhiteSpace(input.Currency) ? "$" : input.Currency.Trim();
        s.FiscalYearStartMonth = input.FiscalYearStartMonth;
        s.LockedThrough = input.LockedThrough;
        await db.SaveChangesAsync();
        return NoContent();
    }
}
