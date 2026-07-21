using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Pricing.Services;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Xunit;

namespace CarSharing.Application.Tests;

public sealed class DynamicPricingTests
{
    [Theory]
    [InlineData(PricingMode.Low, 0.50)]
    [InlineData(PricingMode.Standard, 0.60)]
    [InlineData(PricingMode.High, 0.80)]
    public async Task CalculateAsync_uses_only_admin_pricing_mode(PricingMode mode, decimal expectedRate)
    {
        var vehicle = CreateVehicle(pricePerMinute: 0.60m, zone: "Airport", batteryPercent: 95);
        var policy = PricingPolicy.CreateDefault(DateTime.UtcNow);
        policy.ChangeMode(mode, Guid.NewGuid(), DateTime.UtcNow);
        var service = new DynamicPricingService(new FakeVehicleRepository(vehicle), new FakePricingPolicyRepository(policy));

        var result = await service.CalculateAsync(vehicle, new DateTime(2026, 7, 21, 14, 0, 0, DateTimeKind.Utc));

        Assert.Equal(expectedRate, result.FinalPricePerMinute);
        Assert.Equal(PricingPolicy.GetAdjustmentAmount(mode), result.ManualAdjustmentAmount);
        Assert.Equal(1.00m, result.DemandMultiplier);
        Assert.Equal(1.00m, result.ZoneMultiplier);
        Assert.Equal(1.00m, result.BatteryMultiplier);
    }

    [Fact]
    public void Trip_keeps_price_that_was_locked_at_start()
    {
        var vehicle = CreateVehicle(pricePerMinute: 0.60m);
        var reservation = Reservation.Create(
            Guid.NewGuid(),
            vehicle.Id,
            DateTime.UtcNow.AddMinutes(-20),
            DateTime.UtcNow.AddMinutes(5),
            "Fountain Square parking",
            40.3716,
            49.8372);
        var start = DateTime.UtcNow.AddMinutes(-10);
        var trip = Trip.StartFromReservation(
            reservation,
            vehicle,
            start,
            basePricePerMinute: 0.60m,
            demandMultiplier: 1.00m,
            zoneMultiplier: 1.00m,
            batteryMultiplier: 1.00m,
            finalPricePerMinute: 0.80m);

        trip.RequestCompletion(start.AddMinutes(10));

        Assert.Equal(10, trip.DurationMinutes);
        Assert.Equal(6.00m, trip.BasePrice);
        Assert.Equal(8.00m, trip.TotalPrice);
    }

    private static Vehicle CreateVehicle(decimal pricePerMinute, string zone = "Center", int batteryPercent = 80)
    {
        return Vehicle.Create(
            "Tesla",
            "Model 3",
            2024,
            $"10AA{Random.Shared.Next(100, 999)}",
            100,
            batteryPercent,
            batteryPercent * 4,
            pricePerMinute,
            "AZN",
            5,
            "White",
            "Type 2",
            null,
            "Baku",
            zone,
            40.4,
            49.8);
    }

    private sealed class FakePricingPolicyRepository(PricingPolicy policy) : IPricingPolicyRepository
    {
        public Task<PricingPolicy?> GetCurrentAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<PricingPolicy?>(policy);

        public Task AddAsync(PricingPolicy policy, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class FakeVehicleRepository(Vehicle vehicle) : IVehicleRepository
    {
        public Task<IReadOnlyList<Vehicle>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Vehicle>>([vehicle]);

        public Task<Vehicle?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult<Vehicle?>(vehicle.Id == id ? vehicle : null);

        public Task<Vehicle?> GetByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult<Vehicle?>(vehicle.PlateNumber == plateNumber ? vehicle : null);

        public Task<int> CountAvailableByZoneAsync(string zone, CancellationToken cancellationToken = default) =>
            Task.FromResult(vehicle.Status == VehicleStatus.Available && vehicle.Zone == zone ? 1 : 0);

        public Task<bool> ExistsByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task<bool> ExistsByPlateNumberAsync(string plateNumber, Guid excludedVehicleId, CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task AddAsync(Vehicle vehicle, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
