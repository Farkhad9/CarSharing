using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.StaffTasks.Dtos;
using CarSharing.Application.StaffTasks.Services;
using CarSharing.Application.StaffTasks.Validators;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Xunit;

namespace CarSharing.Application.Tests;

public sealed class StaffTaskManagementTests
{
    [Fact]
    public async Task CreateAsync_ForAdmin_AssignsTaskToActiveStaff()
    {
        var staff = User.CreateStaff("Staff", "Member", "staff-task@test.local", "+994501234500", "hash", "STAFFT1");
        var fixture = CreateFixture(UserRole.Admin, staff);

        var result = await fixture.Service.CreateAsync(new CreateStaffTaskRequest(
            "Inspect charger",
            "Check cable condition",
            staff.Id,
            null,
            StaffTaskPriority.High,
            DateTime.UtcNow.AddHours(4)));

        Assert.True(result.IsSuccess);
        Assert.Equal(staff.Id, result.Value!.AssigneeId);
        Assert.Single(fixture.Tasks.Items);
    }

    [Fact]
    public async Task CreateAsync_ForRider_IsForbidden()
    {
        var staff = User.CreateStaff("Staff", "Member", "staff-task2@test.local", "+994501234501", "hash", "STAFFT2");
        var fixture = CreateFixture(UserRole.Rider, staff);

        var result = await fixture.Service.CreateAsync(new CreateStaffTaskRequest(
            "Inspect charger",
            "Check cable condition",
            staff.Id,
            null,
            StaffTaskPriority.High,
            null));

        Assert.True(result.IsFailure);
        Assert.Equal("StaffTask.AdminRequired", result.Errors.Single().Code);
        Assert.Empty(fixture.Tasks.Items);
    }

    [Fact]
    public async Task CreateAsync_ForBlockedStaff_IsRejected()
    {
        var staff = User.CreateStaff("Staff", "Blocked", "staff-blocked-task@test.local", "+994501234502", "hash", "STAFFT3");
        staff.Block("Suspended", null, Guid.NewGuid(), DateTime.UtcNow);
        var fixture = CreateFixture(UserRole.Admin, staff);

        var result = await fixture.Service.CreateAsync(new CreateStaffTaskRequest(
            "Inspect charger",
            "Check cable condition",
            staff.Id,
            null,
            StaffTaskPriority.High,
            null));

        Assert.True(result.IsFailure);
        Assert.Equal("StaffTask.AssigneeMustBeStaff", result.Errors.Single().Code);
    }

    [Fact]
    public async Task GetMyTasksAsync_ForStaff_ReturnsAssignedTasks()
    {
        var staff = User.CreateStaff("Staff", "Member", "staff-my-task@test.local", "+994501234503", "hash", "STAFFT4");
        var fixture = CreateFixture(UserRole.Staff, staff, staff.Id);
        var task = StaffTask.Create("Task", "Description", staff.Id, null, StaffTaskPriority.Medium, null, DateTime.UtcNow);
        fixture.Tasks.Items.Add(task);

        var result = await fixture.Service.GetMyTasksAsync();

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!);
        Assert.Equal(task.Id, result.Value![0].Id);
    }

    [Fact]
    public async Task ReassignAsync_ForAdmin_MovesTaskToActiveStaff()
    {
        var firstStaff = User.CreateStaff("First", "Staff", "staff-reassign-a@test.local", "+994501234504", "hash", "STAFFT5");
        var secondStaff = User.CreateStaff("Second", "Staff", "staff-reassign-b@test.local", "+994501234505", "hash", "STAFFT6");
        var fixture = CreateFixture(UserRole.Admin, firstStaff, null, secondStaff);
        var task = StaffTask.Create("Charge vehicle", "Move EV to charging station", firstStaff.Id, null, StaffTaskPriority.High, null, DateTime.UtcNow);
        fixture.Tasks.Items.Add(task);

        var result = await fixture.Service.ReassignAsync(task.Id, new ReassignStaffTaskRequest(secondStaff.Id));

        Assert.True(result.IsSuccess);
        Assert.Equal(firstStaff.Id, result.Value!.PreviousAssigneeId);
        Assert.Equal(secondStaff.Id, result.Value.Task.AssigneeId);
        Assert.Equal(secondStaff.Id, task.AssigneeId);
    }

    [Fact]
    public async Task ReassignAsync_ForBlockedStaff_IsRejected()
    {
        var firstStaff = User.CreateStaff("First", "Staff", "staff-reassign-c@test.local", "+994501234506", "hash", "STAFFT7");
        var blockedStaff = User.CreateStaff("Blocked", "Staff", "staff-reassign-d@test.local", "+994501234507", "hash", "STAFFT8");
        blockedStaff.Block("Suspended", null, Guid.NewGuid(), DateTime.UtcNow);
        var fixture = CreateFixture(UserRole.Admin, firstStaff, null, blockedStaff);
        var task = StaffTask.Create("Charge vehicle", "Move EV to charging station", firstStaff.Id, null, StaffTaskPriority.High, null, DateTime.UtcNow);
        fixture.Tasks.Items.Add(task);

        var result = await fixture.Service.ReassignAsync(task.Id, new ReassignStaffTaskRequest(blockedStaff.Id));

        Assert.True(result.IsFailure);
        Assert.Equal("StaffTask.AssigneeMustBeStaff", result.Errors.Single().Code);
        Assert.Equal(firstStaff.Id, task.AssigneeId);
    }

    [Fact]
    public async Task UpdateStatusAsync_ForChargingDone_StoresCurrentBattery()
    {
        var staff = User.CreateStaff("Charge", "Staff", "staff-charge-done@test.local", "+994501234508", "hash", "STAFFT9");
        var fixture = CreateFixture(UserRole.Staff, staff, staff.Id);
        var vehicle = CreateVehicle(0);
        var station = CreateStation();
        var now = DateTime.UtcNow;
        var task = StaffTask.Create(
            "Charge vehicle",
            "Move EV to charging station",
            staff.Id,
            vehicle.Id,
            StaffTaskPriority.High,
            null,
            now.AddMinutes(-10),
            StaffTaskType.Charging);
        task.ChangeStatus(StaffTaskStatus.InProgress, now.AddMinutes(-9));
        var session = ChargingSession.Start(vehicle, station, staff.Id, Guid.NewGuid(), task.Id, 100, now.AddMinutes(-10));
        fixture.Tasks.Items.Add(task);
        fixture.Sessions.Items.Add(session);

        var result = await fixture.Service.UpdateStatusAsync(task.Id, new UpdateStaffTaskStatusRequest(StaffTaskStatus.Done));

        Assert.True(result.IsSuccess);
        Assert.Equal(StaffTaskStatus.Done, task.Status);
        Assert.InRange(session.CurrentBatteryPercent, 89, 91);
    }

    [Fact]
    public async Task UpdateStatusAsync_ForChargingDone_RejectsBatteryUnderMinimum()
    {
        var staff = User.CreateStaff("Charge", "Blocked", "staff-charge-low@test.local", "+994501234509", "hash", "STAFF10");
        var fixture = CreateFixture(UserRole.Staff, staff, staff.Id);
        var vehicle = CreateVehicle(0);
        var station = CreateStation();
        var now = DateTime.UtcNow;
        var task = StaffTask.Create(
            "Charge vehicle",
            "Move EV to charging station",
            staff.Id,
            vehicle.Id,
            StaffTaskPriority.High,
            null,
            now.AddMinutes(-10),
            StaffTaskType.Charging);
        task.ChangeStatus(StaffTaskStatus.InProgress, now.AddMinutes(-3));
        var session = ChargingSession.Start(vehicle, station, staff.Id, Guid.NewGuid(), task.Id, 100, now.AddMinutes(-10));
        fixture.Tasks.Items.Add(task);
        fixture.Sessions.Items.Add(session);

        var result = await fixture.Service.UpdateStatusAsync(task.Id, new UpdateStaffTaskStatusRequest(StaffTaskStatus.Done));

        Assert.True(result.IsFailure);
        Assert.Equal("StaffTask.ChargingNotReady", result.Errors.Single().Code);
        Assert.Equal(StaffTaskStatus.InProgress, task.Status);
        Assert.Equal(0, session.CurrentBatteryPercent);
    }

    private static Fixture CreateFixture(UserRole currentRole, User staff, Guid? currentUserId = null, params User[] additionalUsers)
    {
        var tasks = new TaskRepo();
        var sessions = new ChargingSessionRepo();
        var users = new UserRepo([staff, .. additionalUsers]);
        var service = new StaffTaskService(
            tasks,
            new StaffKpiEventRepo(),
            sessions,
            users,
            new CurrentUser(currentUserId ?? Guid.NewGuid(), currentRole),
            new UnitOfWork(),
            new CreateStaffTaskRequestValidator());

        return new Fixture(service, tasks, sessions);
    }

    private static Vehicle CreateVehicle(int batteryPercent)
    {
        return Vehicle.Create(
            "Hyundai",
            "Sonata",
            2021,
            $"10-CH-{batteryPercent:000}",
            1000,
            batteryPercent,
            batteryPercent * 4,
            0.45m,
            "AZN",
            5,
            "White",
            "CCS2",
            null,
            "Baku",
            "Center",
            40.4,
            49.8);
    }

    private static ChargingStation CreateStation()
    {
        return ChargingStation.Create(
            "Charge Hub",
            ChargingStationStatus.Online,
            "Baku",
            "Center",
            40.4,
            49.8,
            120,
            2,
            2,
            ["CCS2"]);
    }

    private sealed record Fixture(StaffTaskService Service, TaskRepo Tasks, ChargingSessionRepo Sessions);

    private sealed class TaskRepo : IStaffTaskRepository
    {
        public List<StaffTask> Items { get; } = [];

        public Task<IReadOnlyList<StaffTask>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<StaffTask>>(Items);

        public Task<StaffTask?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(task => task.Id == id));

        public Task<IReadOnlyList<StaffTask>> GetByAssigneeIdAsync(Guid assigneeId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<StaffTask>>(Items.Where(task => task.AssigneeId == assigneeId).ToList());

        public Task AddAsync(StaffTask task, CancellationToken cancellationToken = default)
        {
            Items.Add(task);
            return Task.CompletedTask;
        }
    }

    private sealed class ChargingSessionRepo : IChargingSessionRepository
    {
        public List<ChargingSession> Items { get; } = [];

        public Task<IReadOnlyList<ChargingSession>> GetActiveAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ChargingSession>>(Items.Where(session => session.Status == ChargingSessionStatus.Active).ToList());

        public Task<ChargingSession?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(session => session.Id == id));

        public Task<ChargingSession?> GetActiveByVehicleIdAsync(Guid vehicleId, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(session => session.VehicleId == vehicleId && session.Status == ChargingSessionStatus.Active));

        public Task<ChargingSession?> GetActiveByStaffTaskIdAsync(Guid staffTaskId, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(session => session.StaffTaskId == staffTaskId && session.Status == ChargingSessionStatus.Active));

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

    private sealed class StaffKpiEventRepo : IStaffKpiEventRepository
    {
        public List<StaffKpiEvent> Items { get; } = [];

        public Task<IReadOnlyList<StaffKpiEvent>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<StaffKpiEvent>>(Items);

        public Task<IReadOnlyList<StaffKpiEvent>> GetByStaffIdsAsync(
            IReadOnlyCollection<Guid> staffUserIds,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<StaffKpiEvent>>(
                Items.Where(kpiEvent => staffUserIds.Contains(kpiEvent.StaffUserId)).ToList());

        public Task<bool> ExistsAsync(Guid staffUserId, Guid sourceId, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.Any(kpiEvent => kpiEvent.StaffUserId == staffUserId && kpiEvent.SourceId == sourceId));

        public Task AddAsync(StaffKpiEvent kpiEvent, CancellationToken cancellationToken = default)
        {
            Items.Add(kpiEvent);
            return Task.CompletedTask;
        }
    }

    private sealed class UserRepo(IReadOnlyList<User> users) : IUserRepository
    {
        public Task<IReadOnlyList<User>> GetAllAsync(string? search = null, UserRole? role = null, bool? isActive = null, UserVerificationStatus? verificationStatus = null, CancellationToken cancellationToken = default) =>
            Task.FromResult(users);

        public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(users.FirstOrDefault(user => user.Id == id));

        public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
            Task.FromResult(users.FirstOrDefault(user => user.Email == email.Trim().ToLowerInvariant()));

        public Task<User?> GetByRefreshTokenHashAsync(string refreshTokenHash, CancellationToken cancellationToken = default) =>
            Task.FromResult<User?>(null);

        public Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task<bool> ExistsByPhoneAsync(string phone, CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task<bool> ExistsByDriverLicenseNumberAsync(string driverLicenseNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task AddAsync(User entity, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class CurrentUser(Guid userId, UserRole role) : ICurrentUserService
    {
        public Guid? UserId => userId;
        public string? Email => null;
        public UserRole? Role => role;
        public bool IsAuthenticated => true;
    }

    private sealed class UnitOfWork : IUnitOfWork
    {
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);
    }
}
