using System.Text.Json.Serialization;
using AccountingSystem.Api.Data;
using AccountingSystem.Api.Services;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddScoped<PostingService>();

builder.Services.AddControllers()
    .AddMvcOptions(o => o.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true)
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        o.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        o.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins("http://localhost:4300").AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Business-rule violations (unbalanced entry, insufficient stock, ...) become HTTP 400 with a readable title.
app.Use(async (ctx, next) =>
{
    try { await next(); }
    catch (InvalidOperationException ex)
    {
        ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
        await ctx.Response.WriteAsJsonAsync(new { title = ex.Message });
    }
});

using (var scope = app.Services.CreateScope())
{
    // For production use EF migrations: dotnet ef migrations add Initial && dotnet ef database update
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    // DEVELOPMENT ONLY: a database created by an earlier version of this project has no AppSettings
    // table (EnsureCreated never alters an existing database). If that table is missing, rebuild the
    // database once. This wipes test data, and does nothing when the table already exists.
    try { _ = db.AppSettings.Any(); }
    catch (SqlException)
    {
        db.Database.EnsureDeleted();
        db.Database.EnsureCreated();
    }
}

app.UseCors();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.MapControllers();
app.Run();
