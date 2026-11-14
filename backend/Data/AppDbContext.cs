using AccountingSystem.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AccountingSystem.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();
    public DbSet<JournalLine> JournalLines => Set<JournalLine>();
    public DbSet<Budget> Budgets => Set<Budget>();
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<Article> Articles => Set<Article>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<IncomeEntry> IncomeEntries => Set<IncomeEntry>();
    public DbSet<ExpenseEntry> ExpenseEntries => Set<ExpenseEntry>();
    public DbSet<Liability> Liabilities => Set<Liability>();
    public DbSet<Bill> Bills => Set<Bill>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();

    protected override void ConfigureConventions(ModelConfigurationBuilder b) =>
        b.Properties<decimal>().HavePrecision(18, 4);

    protected override void OnModelCreating(ModelBuilder m)
    {
        foreach (var fk in m.Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys()))
            fk.DeleteBehavior = DeleteBehavior.Restrict;

        m.Entity<JournalLine>().HasOne(l => l.JournalEntry).WithMany(e => e.Lines)
            .HasForeignKey(l => l.JournalEntryId).OnDelete(DeleteBehavior.Cascade);

        m.Entity<Account>().HasIndex(a => a.Code).IsUnique();
        m.Entity<Material>().HasIndex(x => x.Code).IsUnique();
        m.Entity<Article>().HasIndex(x => x.Code).IsUnique();
        m.Entity<Budget>().HasIndex(b => new { b.AccountId, b.Year, b.Month }).IsUnique();
        m.Entity<Article>().HasOne(a => a.Material).WithMany().HasForeignKey(a => a.MaterialId);

        m.Entity<AppSetting>().HasData(new AppSetting { Id = 1, CompanyName = "My Company", Currency = "$", FiscalYearStartMonth = 1 });

        m.Entity<Account>().HasData(
            A(1, "1000", "Cash and Bank", AccountType.Asset),
            A(2, "1100", "Accounts Receivable", AccountType.Asset),
            A(3, "1200", "Inventory", AccountType.Asset),
            A(4, "1500", "Equipment", AccountType.Asset),
            A(5, "2000", "Accounts Payable", AccountType.Liability),
            A(6, "2100", "Loans Payable", AccountType.Liability),
            A(7, "3000", "Owner's Equity", AccountType.Equity),
            A(8, "3100", "Retained Earnings", AccountType.Equity),
            A(9, "4000", "Sales Revenue", AccountType.Revenue),
            A(10, "4100", "Other Income", AccountType.Revenue),
            A(11, "5000", "Cost of Goods Sold", AccountType.Expense),
            A(12, "5100", "Salaries", AccountType.Expense),
            A(13, "5200", "Rent", AccountType.Expense),
            A(14, "5300", "Utilities", AccountType.Expense),
            A(15, "5900", "General Expenses", AccountType.Expense));
    }

    private static Account A(int id, string code, string name, AccountType t) =>
        new() { Id = id, Code = code, Name = name, Type = t, IsActive = true };
}
