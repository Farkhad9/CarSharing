using AutoMapper;
using CarSharing.Application.Common.Interfaces;
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
        var service = new VehicleService(
            new VehicleRepo(vehicle),
            new ChargingSessionRepo(),
            new StaffTaskRepo(),
            new UnitOfWork(),
            new CurrentUser(role),
            mapper,
            new CreateVehicleRequestValidator(),
            new UpdateVehicleRequestValidator(),
            new UpdateVehicleStatusRequestValidator());

        return new Fixture(service, vehicle);
    }

    private sealed record Fixture(VehicleService Service, Vehicle Vehicle);

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
