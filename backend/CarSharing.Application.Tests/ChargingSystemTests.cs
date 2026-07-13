using CarSharing.Application.Charging.Dtos;
using CarSharing.Application.Charging.Services;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Xunit;

namespace CarSharing.Application.Tests;

public sealed class ChargingSystemTests
{
    [Fact]
    public async Task StartChargingAsync_AssignsStationCreatesTaskAndOccupiesPort()
    {
        var fixture = CreateFixture();

        var result = await fixture.Service.StartChargingAsync(new StartChargingSessionRequest(
            fixture.Vehicle.Id,
            fixture.Station.Id,
            fixture.StaffId));

        Assert.True(result.IsSuccess);
        Assert.Equal(VehicleStatus.Charging, fixture.Vehicle.Status);
        Assert.Equal(fixture.Station.Id, fixture.Vehicle.ChargingStationId);
        Assert.Equal(1, fixture.Station.AvailablePorts);
        Assert.Single(fixture.Sessions.Items);
        Assert.Single(fixture.Tasks.Items);
        Assert.Equal(100, result.Value!.Session.TargetBatteryPercent);
    }

    [Fact]
    public async Task StartChargingAsync_RejectsUnavailableStation()
    {
        var fixture = CreateFixture(stationStatus: ChargingStationStatus.Maintenance, availablePorts: 0);

        var result = await fixture.Service.StartChargingAsync(new StartChargingSessionRequest(
            fixture.Vehicle.Id,
            fixture.Station.Id,
            fixture.StaffId));

        Assert.True(result.IsFailure);
        Assert.Equal("Charging.StationUnavailable", result.Errors.Single().Code);
        Assert.Empty(fixture.Sessions.Items);
        Assert.Empty(fixture.Tasks.Items);
    }

    [Fact]
    public async Task CompleteChargingAsync_CompletesSessionTaskAndReleasesPortButKeepsVehicleCharging()
    {
        var fixture = CreateFixture();
        var start = await fixture.Service.StartChargingAsync(new StartChargingSessionRequest(
            fixture.Vehicle.Id,
            fixture.Station.Id,
            fixture.StaffId));
        Assert.True(start.IsSuccess);
        fixture.CurrentUser.Role = UserRole.Staff;
        fixture.CurrentUser.UserIdValue = fixture.StaffId;

        var result = await fixture.Service.CompleteChargingAsync(
            start.Value!.Session.Id,
            new CompleteChargingSessionRequest(100, "Fully charged"));

        Assert.True(result.IsSuccess);
        Assert.Equal(ChargingSessionStatus.Completed, fixture.Sessions.Items.Single().Status);
        Assert.Equal(StaffTaskStatus.Done, fixture.Tasks.Items.Single().Status);
        Assert.Equal(100, fixture.Vehicle.BatteryPercent);
        Assert.Equal(VehicleStatus.Charging, fixture.Vehicle.Status);
        Assert.Equal(2, fixture.Station.AvailablePorts);
    }

    [Fact]
    public async Task ActivateVehicleAsync_MakesFullyChargedVehicleAvailable()
    {
        var fixture = CreateFixture();
        var start = await fixture.Service.StartChargingAsync(new StartChargingSessionRequest(
            fixture.Vehicle.Id,
            fixture.Station.Id,
            fixture.StaffId));
        fixture.CurrentUser.Role = UserRole.Staff;
        fixture.CurrentUser.UserIdValue = fixture.StaffId;
        await fixture.Service.CompleteChargingAsync(start.Value!.Session.Id, new CompleteChargingSessionRequest(100));
        fixture.CurrentUser.Role = UserRole.Admin;
        fixture.CurrentUser.UserIdValue = fixture.AdminId;

        var result = await fixture.Service.ActivateVehicleAsync(fixture.Vehicle.Id);

        Assert.True(result.IsSuccess);
        Assert.Equal(VehicleStatus.Available, fixture.Vehicle.Status);
        Assert.Null(fixture.Vehicle.ChargingStationId);
        Assert.Equal(100, fixture.Vehicle.BatteryPercent);
    }

    private static Fixture CreateFixture(
        ChargingStationStatus stationStatus = ChargingStationStatus.Online,
        int availablePorts = 2)
    {
        var adminId = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var vehicle = Vehicle.Create(
            "Tesla",
            "Model 3",
            2025,
            "10-AA-001",
            1000,
            24,
            120,
            0.42m,
            "AZN",
            5,
            "White",
            "CCS2",
            null,
            "Baku",
            "Center",
            40.4,
            49.8);
        vehicle.ChangeStatus(VehicleStatus.Charging);

        var station = ChargingStation.Create(
            "Ganjlik Mall EV Dock",
            stationStatus,
            "Ganjlik Mall",
            "North",
            40.4,
            49.8,
            120,
            2,
            availablePorts,
            ["CCS2"]);

        var currentUser = new CurrentUser(adminId, UserRole.Admin);
        var stations = new StationRepo(station);
        var sessions = new SessionRepo();
        var tasks = new TaskRepo();
        var vehicles = new VehicleRepo(vehicle);
        var service = new ChargingService(stations, sessions, tasks, vehicles, currentUser, new UnitOfWork());

        return new Fixture(service, vehicle, station, sessions, tasks, currentUser, adminId, staffId);
    }

    private sealed record Fixture(
        ChargingService Service,
        Vehicle Vehicle,
        ChargingStation Station,
        SessionRepo Sessions,
        TaskRepo Tasks,
        CurrentUser CurrentUser,
        Guid AdminId,
        Guid StaffId);

    private sealed class StationRepo(ChargingStation station) : IChargingStationRepository
    {
        public Task<IReadOnlyList<ChargingStation>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ChargingStation>>([station]);

        public Task<ChargingStation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult<ChargingStation?>(id == station.Id ? station : null);

        public Task AddAsync(ChargingStation entity, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class SessionRepo : IChargingSessionRepository
    {
        public List<ChargingSession> Items { get; } = [];

        public Task<IReadOnlyList<ChargingSession>> GetActiveAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ChargingSession>>(Items.Where(x => x.Status == ChargingSessionStatus.Active).ToList());

        public Task<ChargingSession?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Id == id));

        public Task<ChargingSession?> GetActiveByVehicleIdAsync(Guid vehicleId, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.VehicleId == vehicleId && x.Status == ChargingSessionStatus.Active));

        public Task AddAsync(ChargingSession session, CancellationToken cancellationToken = default)
        {
            Items.Add(session);
            return Task.CompletedTask;
        }
    }

    private sealed class TaskRepo : IStaffTaskRepository
    {
        public List<StaffTask> Items { get; } = [];

        public Task<StaffTask?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Id == id));

        public Task<IReadOnlyList<StaffTask>> GetByAssigneeIdAsync(Guid assigneeId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<StaffTask>>(Items.Where(x => x.AssigneeId == assigneeId).ToList());

        public Task AddAsync(StaffTask task, CancellationToken cancellationToken = default)
        {
            Items.Add(task);
            return Task.CompletedTask;
        }
    }

    private sealed class VehicleRepo(Vehicle vehicle) : IVehicleRepository
    {
        public Task<IReadOnlyList<Vehicle>> GetAllAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Vehicle>>([vehicle]);
        public Task<Vehicle?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<Vehicle?>(id == vehicle.Id ? vehicle : null);
        public Task<Vehicle?> GetByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default) => Task.FromResult<Vehicle?>(vehicle);
        public Task<int> CountAvailableByZoneAsync(string zone, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<bool> ExistsByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task<bool> ExistsByPlateNumberAsync(string plateNumber, Guid excludedVehicleId, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task AddAsync(Vehicle entity, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class CurrentUser(Guid userId, UserRole role) : ICurrentUserService
    {
        public Guid UserIdValue { get; set; } = userId;
        public UserRole Role { get; set; } = role;
        public Guid? UserId => UserIdValue;
        UserRole? ICurrentUserService.Role => Role;
        public string? Email => null;
        public bool IsAuthenticated => true;
    }

    private sealed class UnitOfWork : IUnitOfWork
    {
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);
    }
}
