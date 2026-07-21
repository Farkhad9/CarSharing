using AutoMapper;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Pricing.Services;
using CarSharing.Application.Vehicles.Dtos;
using CarSharing.Application.Vehicles.Mapping;
using CarSharing.Application.Vehicles.Services;
using CarSharing.Application.Vehicles.Validators;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CarSharing.Application.Tests;

public sealed class VehicleManagementTests
{
    [Fact]
    public async Task UpdateStatusAsync_ForAdmin_AllowsChargingTransition()
    {
        var fixture = CreateFixture(UserRole.Admin);

        var result = await fixture.Service.UpdateStatusAsync(
            fixture.Vehicle.Id,
            new UpdateVehicleStatusRequest { Status = VehicleStatus.Charging });

        Assert.True(result.IsSuccess);
        Assert.Equal(VehicleStatus.Charging, fixture.Vehicle.Status);
    }

    [Fact]
    public async Task UpdateStatusAsync_ForAdmin_RejectsMaintenanceDeactivation()
    {
        var fixture = CreateFixture(UserRole.Admin);

        var result = await fixture.Service.UpdateStatusAsync(
            fixture.Vehicle.Id,
            new UpdateVehicleStatusRequest { Status = VehicleStatus.Maintenance });

        Assert.True(result.IsFailure);
        Assert.Equal("Vehicle.SuperAdminRequired", result.Errors.Single().Code);
        Assert.Equal(VehicleStatus.Available, fixture.Vehicle.Status);
    }

    [Fact]
    public async Task UpdateStatusAsync_ForSuperAdmin_AllowsMaintenanceDeactivation()
    {
        var fixture = CreateFixture(UserRole.SuperAdmin);

        var result = await fixture.Service.UpdateStatusAsync(
            fixture.Vehicle.Id,
            new UpdateVehicleStatusRequest { Status = VehicleStatus.Maintenance });

        Assert.True(result.IsSuccess);
        Assert.Equal(VehicleStatus.Maintenance, fixture.Vehicle.Status);
    }

    [Fact]
    public async Task GetAllAsync_DoesNotDrainAvailableVehicleFromStaleOpenTrip()
    {
        var fixture = CreateFixture(UserRole.Admin);
        fixture.Vehicle.UpdateBattery(100);
        var startedAt = DateTime.UtcNow.AddMinutes(-90);
        fixture.Trips.Items.Add(CreateOpenTrip(fixture.Vehicle, startedAt));

        var result = await fixture.Service.GetAllAsync();

        Assert.True(result.IsSuccess);
        var vehicle = Assert.Single(result.Value!);
        Assert.Equal(VehicleStatus.Available, vehicle.Status);
        Assert.Equal(100, vehicle.BatteryPercent);
        Assert.Equal(400, vehicle.RangeKm);
        Assert.Null(vehicle.ActiveTripStartedAt);
    }

    [Fact]
    public async Task GetAllAsync_DrainsInUseVehicleFromOpenTrip()
    {
        var fixture = CreateFixture(UserRole.Admin);
        fixture.Vehicle.UpdateBattery(80);
        fixture.Vehicle.ChangeStatus(VehicleStatus.InUse);
        var startedAt = DateTime.UtcNow.AddMinutes(-50);
        fixture.Trips.Items.Add(CreateOpenTrip(fixture.Vehicle, startedAt));

        var result = await fixture.Service.GetAllAsync();

        Assert.True(result.IsSuccess);
        var vehicle = Assert.Single(result.Value!);
        Assert.Equal(VehicleStatus.InUse, vehicle.Status);
        Assert.Equal(startedAt, vehicle.ActiveTripStartedAt);
        Assert.InRange(vehicle.BatteryPercent, 29, 30);
        Assert.Equal(vehicle.BatteryPercent * 4, vehicle.RangeKm);
    }

    private static Fixture CreateFixture(UserRole role)
    {
        var vehicle = Vehicle.Create(
            "Tesla",
            "Model 3",
            2025,
            "10-AA-001",
            1000,
            80,
            250,
            0.45m,
            "AZN",
            5,
            "White",
            "CCS2",
            null,
            "Baku",
            "City",
            40.3777,
            49.8499);
        var mapper = new MapperConfiguration(
            config => config.AddProfile<VehicleMappingProfile>(),
            NullLoggerFactory.Instance)
            .CreateMapper();
        var vehicleRepository = new VehicleRepo(vehicle);
        var tripRepository = new TripRepo();
        var service = new VehicleService(
            vehicleRepository,
            new ChargingSessionRepo(),
            new StaffTaskRepo(),
            tripRepository,
            new UnitOfWork(),
            new CurrentUser(role),
            new DynamicPricingService(vehicleRepository),
            mapper,
            new CreateVehicleRequestValidator(),
            new UpdateVehicleRequestValidator(),
            new UpdateVehicleStatusRequestValidator());

        return new Fixture(service, vehicle, tripRepository);
    }

    private static Trip CreateOpenTrip(Vehicle vehicle, DateTime startedAt)
    {
        var reservation = Reservation.Create(
            Guid.NewGuid(),
            vehicle.Id,
            startedAt.AddMinutes(-5),
            startedAt.AddMinutes(10),
            "Baku Boulevard",
            vehicle.Latitude + 0.01,
            vehicle.Longitude + 0.01);

        return Trip.StartFromReservation(reservation, vehicle, startedAt);
    }

    private sealed record Fixture(VehicleService Service, Vehicle Vehicle, TripRepo Trips);

    private sealed class VehicleRepo(Vehicle vehicle) : IVehicleRepository
    {
        public Task<IReadOnlyList<Vehicle>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Vehicle>>([vehicle]);

        public Task<Vehicle?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(vehicle.Id == id ? vehicle : null);

        public Task<Vehicle?> GetByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult(vehicle.PlateNumber == plateNumber ? vehicle : null);

        public Task<int> CountAvailableByZoneAsync(string zone, CancellationToken cancellationToken = default) =>
            Task.FromResult(vehicle.Zone == zone && vehicle.Status == VehicleStatus.Available ? 1 : 0);

        public Task<bool> ExistsByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult(vehicle.PlateNumber == plateNumber);

        public Task<bool> ExistsByPlateNumberAsync(string plateNumber, Guid excludedVehicleId, CancellationToken cancellationToken = default) =>
            Task.FromResult(vehicle.PlateNumber == plateNumber && vehicle.Id != excludedVehicleId);

        public Task AddAsync(Vehicle nextVehicle, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class ChargingSessionRepo : IChargingSessionRepository
    {
        public Task<IReadOnlyList<ChargingSession>> GetActiveAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ChargingSession>>([]);

        public Task<ChargingSession?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult<ChargingSession?>(null);

        public Task<ChargingSession?> GetActiveByVehicleIdAsync(Guid vehicleId, CancellationToken cancellationToken = default) =>
            Task.FromResult<ChargingSession?>(null);

        public Task<ChargingSession?> GetActiveByStaffTaskIdAsync(Guid staffTaskId, CancellationToken cancellationToken = default) =>
            Task.FromResult<ChargingSession?>(null);

        public Task AddAsync(ChargingSession session, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task RemoveByStationIdAsync(Guid stationId, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class StaffTaskRepo : IStaffTaskRepository
    {
        public Task<IReadOnlyList<StaffTask>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<StaffTask>>([]);

        public Task<StaffTask?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult<StaffTask?>(null);

        public Task<IReadOnlyList<StaffTask>> GetByAssigneeIdAsync(Guid assigneeId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<StaffTask>>([]);

        public Task AddAsync(StaffTask task, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class TripRepo : ITripRepository
    {
        public List<Trip> Items { get; } = [];

        public Task<Trip?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(trip => trip.Id == id));

        public Task<IReadOnlyList<Trip>> GetOpenTripsAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Trip>>(Items);

        public Task<Trip?> GetActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(trip => trip.UserId == userId));

        public Task<IReadOnlyList<Trip>> GetActiveTripsByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Trip>>(Items.Where(trip => trip.UserId == userId).ToList());

        public Task<Trip?> GetByReservationIdAsync(Guid reservationId, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(trip => trip.ReservationId == reservationId));

        public Task AddAsync(Trip trip, CancellationToken cancellationToken = default)
        {
            Items.Add(trip);
            return Task.CompletedTask;
        }
    }

    private sealed class UnitOfWork : IUnitOfWork
    {
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);
    }

    private sealed class CurrentUser(UserRole role) : ICurrentUserService
    {
        public Guid? UserId { get; } = Guid.NewGuid();
        public string? Email => "admin@test.local";
        public UserRole? Role => role;
        public bool IsAuthenticated => true;
    }
}
