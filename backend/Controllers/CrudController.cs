using AccountingSystem.Api.Data;
using AccountingSystem.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AccountingSystem.Api.Controllers;

/// <summary>Generic controller for master data (list, get, create, update, delete).</summary>
[ApiController, Route("api/[controller]")]
public abstract class CrudController<T> : ControllerBase where T : class, IEntity
{
    protected readonly AppDbContext Db;
    protected CrudController(AppDbContext db) => Db = db;

    protected virtual IQueryable<T> Query() => Db.Set<T>().OrderBy(x => x.Id);

    [HttpGet]
    public async Task<List<T>> GetAll() => await Query().AsNoTracking().ToListAsync();

    [HttpGet("{id:int}")]
    public async Task<ActionResult<T>> Get(int id)
    {
        var e = await Query().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (e is null) return NotFound();
        return e;
    }

    [HttpPost]
    public virtual async Task<ActionResult<T>> Create(T input)
    {
        input.Id = 0;
        Db.Add(input);
        await Save();
        return Ok(input);
    }

    [HttpPut("{id:int}")]
    public virtual async Task<IActionResult> Update(int id, T input)
    {
        var e = await Db.Set<T>().FindAsync(id);
        if (e is null) return NotFound();
        input.Id = id;
        Db.Entry(e).CurrentValues.SetValues(input);   // scalar properties only
        await Save();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public virtual async Task<IActionResult> Delete(int id)
    {
        var e = await Db.Set<T>().FindAsync(id);
        if (e is null) return NotFound();
        Db.Remove(e);
        await Save("This record is used elsewhere and cannot be deleted.");
        return NoContent();
    }

    private async Task Save(string? message = null)
    {
        try { await Db.SaveChangesAsync(); }
        catch (DbUpdateException) { throw new InvalidOperationException(message ?? "Could not save. The code may already exist, or a referenced record is missing."); }
    }
}
