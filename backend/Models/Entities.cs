using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace AccountingSystem.Api.Models;

public interface IEntity { int Id { get; set; } }

public enum AccountType { Asset = 1, Liability = 2, Equity = 3, Revenue = 4, Expense = 5 }

// 1. Chart of accounts
public class Account : IEntity
{
    public int Id { get; set; }
    [Required, MaxLength(20)] public string Code { get; set; } = "";
    [Required, MaxLength(150)] public string Name { get; set; } = "";
    public AccountType Type { get; set; }
    public int? ParentId { get; set; }
    public bool IsActive { get; set; } = true;

    /// <summary>Accounts the automatic postings depend on; they cannot be deleted, retyped or deactivated.</summary>
    public static readonly string[] SystemCodes = { "1000", "1100", "1200", "2000", "3000", "4000", "5000", "5900" };
    [NotMapped] public bool IsSystem => SystemCodes.Contains(Code);
}

public class AppSetting : IEntity
{
    public int Id { get; set; }
    [MaxLength(150)] public string CompanyName { get; set; } = "My Company";
    [MaxLength(10)] public string Currency { get; set; } = "$";
    [Range(1, 12)] public int FiscalYearStartMonth { get; set; } = 1;
    /// <summary>Nothing can be posted on or before this date (period close).</summary>
    public DateTime? LockedThrough { get; set; }
}

// 2. General ledger (journal header + lines) and budget
public class JournalEntry : IEntity
{
    public int Id { get; set; }
    public DateTime Date { get; set; } = DateTime.Today;
    [MaxLength(60)] public string? Reference { get; set; }
    [MaxLength(300)] public string? Description { get; set; }
    [MaxLength(30)] public string Source { get; set; } = "Manual";
    public List<JournalLine> Lines { get; set; } = new();
}

public class JournalLine
{
    public int Id { get; set; }
    public int JournalEntryId { get; set; }
    [JsonIgnore] public JournalEntry? JournalEntry { get; set; }
    public int AccountId { get; set; }
    public Account? Account { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    [MaxLength(300)] public string? Memo { get; set; }
}

public class Budget : IEntity
{
    public int Id { get; set; }
    public int AccountId { get; set; }
    public Account? Account { get; set; }
    public int Year { get; set; }
    [Range(1, 12)] public int Month { get; set; }
    public decimal Amount { get; set; }
}

// 3-5. Inventory of material, material master, article master (FK -> material)
public class Material : IEntity
{
    public int Id { get; set; }
    [Required, MaxLength(30)] public string Code { get; set; } = "";
    [Required, MaxLength(150)] public string Name { get; set; } = "";
    [MaxLength(20)] public string Unit { get; set; } = "pcs";
    public decimal UnitCost { get; set; }        // moving-average cost
    public decimal ReorderLevel { get; set; }
}

public class Article : IEntity
{
    public int Id { get; set; }
    [Required, MaxLength(30)] public string Code { get; set; } = "";
    [Required, MaxLength(150)] public string Name { get; set; } = "";
    public int MaterialId { get; set; }          // foreign key -> Material master
    public Material? Material { get; set; }
    public decimal MaterialQtyPerUnit { get; set; } = 1;
    public decimal SalePrice { get; set; }
}

public class InventoryTransaction : IEntity
{
    public int Id { get; set; }
    public int MaterialId { get; set; }
    public Material? Material { get; set; }
    public DateTime Date { get; set; }
    public decimal Quantity { get; set; }        // + receipt, - issue
    public decimal UnitCost { get; set; }
    [MaxLength(30)] public string Type { get; set; } = "";
    [MaxLength(60)] public string? Reference { get; set; }
}

public class Customer : IEntity
{
    public int Id { get; set; }
    [Required, MaxLength(150)] public string Name { get; set; } = "";
    [MaxLength(40)] public string? Phone { get; set; }
    [MaxLength(120)] public string? Email { get; set; }
}

public class Vendor : IEntity
{
    public int Id { get; set; }
    [Required, MaxLength(150)] public string Name { get; set; } = "";
    [MaxLength(40)] public string? Phone { get; set; }
    [MaxLength(120)] public string? Email { get; set; }
}

// 6. Sales (unpaid part is an account receivable)
public class Sale : IEntity
{
    public int Id { get; set; }
    [MaxLength(30)] public string InvoiceNo { get; set; } = "";
    public DateTime Date { get; set; } = DateTime.Today;
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public int ArticleId { get; set; }
    public Article? Article { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Total { get; set; }
    public decimal PaidAmount { get; set; }
    [NotMapped] public decimal Balance => Total - PaidAmount;
    public int? JournalEntryId { get; set; }
    [JsonIgnore] public JournalEntry? JournalEntry { get; set; }
}

// 7. Income entry
public class IncomeEntry : IEntity
{
    public int Id { get; set; }
    public DateTime Date { get; set; } = DateTime.Today;
    public int AccountId { get; set; }
    public Account? Account { get; set; }
    public decimal Amount { get; set; }
    [MaxLength(300)] public string? Description { get; set; }
    public int? JournalEntryId { get; set; }
    [JsonIgnore] public JournalEntry? JournalEntry { get; set; }
}

// 8. Expense entry
public class ExpenseEntry : IEntity
{
    public int Id { get; set; }
    public DateTime Date { get; set; } = DateTime.Today;
    public int AccountId { get; set; }
    public Account? Account { get; set; }
    public decimal Amount { get; set; }
    [MaxLength(300)] public string? Description { get; set; }
    public int? JournalEntryId { get; set; }
    [JsonIgnore] public JournalEntry? JournalEntry { get; set; }
}

// 9. Liability (loans and other borrowings)
public class Liability : IEntity
{
    public int Id { get; set; }
    public DateTime Date { get; set; } = DateTime.Today;
    [Required, MaxLength(150)] public string Lender { get; set; } = "";
    public int AccountId { get; set; }
    public Account? Account { get; set; }
    public decimal Amount { get; set; }
    public DateTime? DueDate { get; set; }
    public decimal PaidAmount { get; set; }
    [NotMapped] public decimal Balance => Amount - PaidAmount;
    public int? JournalEntryId { get; set; }
    [JsonIgnore] public JournalEntry? JournalEntry { get; set; }
}

// 10. Accounts payable (vendor bills)
public class Bill : IEntity
{
    public int Id { get; set; }
    [MaxLength(40)] public string BillNo { get; set; } = "";
    public DateTime Date { get; set; } = DateTime.Today;
    public DateTime? DueDate { get; set; }
    public int VendorId { get; set; }
    public Vendor? Vendor { get; set; }
    public int? MaterialId { get; set; }         // set => purchase of material (goes to inventory)
    public Material? Material { get; set; }
    public decimal Quantity { get; set; }
    public int? ExpenseAccountId { get; set; }   // used when MaterialId is empty
    [MaxLength(300)] public string? Description { get; set; }
    public decimal Amount { get; set; }
    public decimal PaidAmount { get; set; }
    [NotMapped] public decimal Balance => Amount - PaidAmount;
    public int? JournalEntryId { get; set; }
    [JsonIgnore] public JournalEntry? JournalEntry { get; set; }
}

public record PaymentRequest(decimal Amount, DateTime? Date);
