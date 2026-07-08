using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.WebApi.Seeding;

public static class DevelopmentAdminSeeder
{
    public static async Task SeedDevelopmentAdminAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();

        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var section = configuration.GetSection("SeedAdmin");
        var email = section["Email"]?.Trim().ToLowerInvariant();
        var password = section["Password"];

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        var exists = await dbContext.Users.AnyAsync(user => user.Email == email);
        if (exists)
        {
            return;
        }

        var admin = User.CreateAdmin(
            section["FirstName"] ?? "System",
            section["LastName"] ?? "Admin",
            email,
            section["Phone"] ?? "+994500000000",
            passwordHasher.Hash(password),
            section["DriverLicenseNumber"] ?? "ADMIN-DEV");

        await dbContext.Users.AddAsync(admin);
        await dbContext.SaveChangesAsync();
    }
}
