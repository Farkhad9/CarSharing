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
        fixture.Tasks.Items.Single().ChangeStatus(StaffTaskStatus.InProgress, DateTime.UtcNow.AddMinutes(-40));
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
        fixture.Tasks.Items.Single().ChangeStatus(StaffTaskStatus.InProgress, DateTime.UtcNow.AddMinutes(-40));
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

    [Fact]
    public async Task DeleteStationAsync_RemovesUnusedStation()
    {
        var fixture = CreateFixture();

        var result = await fixture.Service.DeleteStationAsync(fixture.Station.Id);

        Assert.True(result.IsSuccess);
        Assert.True(fixture.Stations.Removed);
    }

    [Fact]
    public async Task DeleteStationAsync_RejectsStationInUse()
    {
        var fixture = CreateFixture();
        fixture.Stations.HasAssignedVehicles = true;

        var result = await fixture.Service.DeleteStationAsync(fixture.Station.Id);

        Assert.True(result.IsFailure);
        Assert.Equal("Charging.StationInUse", result.Errors.Single().Code);
        Assert.False(fixture.Stations.Removed);
    }

    [Fact]
    public async Task DeleteStationAsync_RemovesStationWithCompletedSessionHistory()
    {
        var fixture = CreateFixture();
        var session = ChargingSession.Start(
            fixture.Vehicle,
            fixture.Station,
            fixture.StaffId,
            fixture.AdminId,
            Guid.NewGuid(),
            100,
            DateTime.UtcNow.AddHours(-1));
        session.Complete(fixture.AdminId, 100, null, DateTime.UtcNow);
        fixture.Sessions.Items.Add(session);

        var result = await fixture.Service.DeleteStationAsync(fixture.Station.Id);

        Assert.True(result.IsSuccess);
        Assert.True(fixture.Stations.Removed);
        Assert.Empty(fixture.Sessions.Items);
    }

    [Fact]
    public async Task CreateStationAsync_ReturnsExistingStationForDuplicateSubmit()
    {
        var fixture = CreateFixture();

        var result = await fixture.Service.CreateStationAsync(new CreateChargingStationRequest(
            fixture.Station.Name,
            fixture.Station.Status,
            fixture.Station.LocationLabel,
            fixture.Station.Zone,
            fixture.Station.Latitude,
            fixture.Station.Longitude,
            fixture.Station.PowerKw,
            fixture.Station.TotalPorts,
            fixture.Station.AvailablePorts,
            fixture.Station.GetConnectorTypes()));

        Assert.True(result.IsSuccess);
        Assert.Equal(fixture.Station.Id, result.Value!.Id);
        Assert.Equal(0, fixture.Stations.AddedCount);
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

        return new Fixture(service, vehicle, station, stations, sessions, tasks, currentUser, adminId, staffId);
    }

    private sealed record Fixture(
        ChargingService Service,
        Vehicle Vehicle,
        ChargingStation Station,
        StationRepo Stations,
        SessionRepo Sessions,
        TaskRepo Tasks,
        CurrentUser CurrentUser,
        Guid AdminId,
        Guid StaffId);

    private sealed class StationRepo(ChargingStation station) : IChargingStationRepository
    {
        private ChargingStation? _station = station;

        public bool HasActiveSessions { get; set; }
        public bool HasAssignedVehicles { get; set; }
        public int AddedCount { get; private set; }
        public bool Removed { get; private set; }

        public Task<IReadOnlyList<ChargingStation>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ChargingStation>>(_station is null ? [] : [_station]);

        public Task<ChargingStation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(id == _station?.Id ? _station : null);

        public Task<ChargingStation?> FindMatchingAsync(
            string name,
            string locationLabel,
            double latitude,
            double longitude,
            CancellationToken cancellationToken = default)
        {
            var matches = _station is not null
                && string.Equals(_station.Name, name, StringComparison.OrdinalIgnoreCase)
                && string.Equals(_station.LocationLabel, locationLabel, StringComparison.OrdinalIgnoreCase)
                && Math.Abs(_station.Latitude - latitude) < 0.00001
                && Math.Abs(_station.Longitude - longitude) < 0.00001;

            return Task.FromResult(matches ? _station : null);
        }

        public Task<bool> HasActiveSessionsAsync(Guid stationId, CancellationToken cancellationToken = default) =>
            Task.FromResult(HasActiveSessions);

        public Task<bool> HasAssignedVehiclesAsync(Guid stationId, CancellationToken cancellationToken = default) =>
            Task.FromResult(HasAssignedVehicles);

        public Task AddAsync(ChargingStation entity, CancellationToken cancellationToken = default)
        {
            _station = entity;
            AddedCount++;
            return Task.CompletedTask;
        }

        public void Remove(ChargingStation station)
        {
            if (_station?.Id == station.Id)
            {
                _station = null;
                Removed = true;
            }
        }
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

        public Task<ChargingSession?> GetActiveByStaffTaskIdAsync(Guid staffTaskId, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.StaffTaskId == staffTaskId && x.Status == ChargingSessionStatus.Active));

        public Task AddAsync(ChargingSession session, CancellationToken cancellationToken = default)
        {
            Items.Add(session);
            return Task.CompletedTask;
        }

        public Task RemoveByStationIdAsync(Guid stationId, CancellationToken cancellationToken = default)
        {
            Items.RemoveAll(session => session.ChargingStationId == stationId);
            return Task.CompletedTask;
        }
    }

    private sealed class TaskRepo : IStaffTaskRepository
    {
        public List<StaffTask> Items { get; } = [];

        public Task<IReadOnlyList<StaffTask>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<StaffTask>>(Items);

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
