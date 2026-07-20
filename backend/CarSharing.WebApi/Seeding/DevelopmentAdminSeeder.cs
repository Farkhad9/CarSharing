using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using CarSharing.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace CarSharing.WebApi.Seeding;

public static class DevelopmentAdminSeeder
{
    public static async Task SeedDevelopmentAdminAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();

        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        await SeedAdminAsync(configuration.GetSection("SeedAdmin"), dbContext, passwordHasher);
        await SeedSuperAdminAsync(configuration.GetSection("SeedSuperAdmin"), dbContext, passwordHasher);
        await SeedParkingZonesAsync(dbContext);
    }

    private static async Task SeedAdminAsync(
        IConfigurationSection section,
        AppDbContext dbContext,
        IPasswordHasher passwordHasher)
    {
        var email = section["Email"]?.Trim().ToLowerInvariant();
        var password = section["Password"];

        var legacyAdmin = await dbContext.Users
            .FirstOrDefaultAsync(user => user.Email == "admin@carsharing.local");
        if (legacyAdmin is not null && legacyAdmin.Email != email)
        {
            dbContext.Users.Remove(legacyAdmin);
            await dbContext.SaveChangesAsync();
        }

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

    private static async Task SeedSuperAdminAsync(
        IConfigurationSection section,
        AppDbContext dbContext,
        IPasswordHasher passwordHasher)
    {
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

        var superAdmin = User.CreateSuperAdmin(
            section["FirstName"] ?? "System",
            section["LastName"] ?? "SuperAdmin",
            email,
            section["Phone"] ?? "+994500000001",
            passwordHasher.Hash(password),
            section["DriverLicenseNumber"] ?? "SUPER-DEV");

        await dbContext.Users.AddAsync(superAdmin);
        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedParkingZonesAsync(AppDbContext dbContext)
    {
        if (await dbContext.ParkingZones.AnyAsync())
        {
            return;
        }

        var zones = new[]
        {
            CreateZone(
                "Seaside Parking Zone",
                ParkingZoneType.Parking,
                true,
                [
                    [40.3682, 49.8355],
                    [40.3722, 49.8582],
                    [40.3810, 49.8611],
                    [40.3794, 49.8340]
                ]),
            CreateZone(
                "Central Drop-off Zone",
                ParkingZoneType.Parking,
                true,
                [
                    [40.3696, 49.8248],
                    [40.3773, 49.8243],
                    [40.3785, 49.8418],
                    [40.3713, 49.8441]
                ]),
            CreateZone(
                "No Parking: Old City",
                ParkingZoneType.Restricted,
                false,
                [
                    [40.3638, 49.8297],
                    [40.3679, 49.8319],
                    [40.3671, 49.8388],
                    [40.3627, 49.8373]
                ]),
            CreateZone(
                "No Parking: Khyrdalan West",
                ParkingZoneType.Restricted,
                false,
                [
                    [40.4208, 49.7359],
                    [40.4241, 49.7884],
                    [40.3988, 49.8176],
                    [40.3864, 49.7633]
                ]),
            CreateZone(
                "No Parking: Khyrdalan East",
                ParkingZoneType.Restricted,
                false,
                [
                    [40.4712, 49.8553],
                    [40.4655, 49.9188],
                    [40.4302, 49.9093],
                    [40.4165, 49.8491]
                ])
        };

        await dbContext.ParkingZones.AddRangeAsync(zones);
        await dbContext.SaveChangesAsync();
    }

    private static ParkingZone CreateZone(
        string name,
        ParkingZoneType type,
        bool allowsTripEnd,
        double[][] boundary)
    {
        var centerLatitude = boundary.Average(point => point[0]);
        var centerLongitude = boundary.Average(point => point[1]);
        var boundaryJson = JsonSerializer.Serialize(
            boundary.Select(point => new { Latitude = point[0], Longitude = point[1] }));

        return ParkingZone.Create(
            name,
            type,
            centerLatitude,
            centerLongitude,
            0,
            boundaryJson,
            allowsTripEnd);
    }
}
