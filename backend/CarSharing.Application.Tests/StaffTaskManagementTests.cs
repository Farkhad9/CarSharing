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

    private static Fixture CreateFixture(UserRole currentRole, User staff, Guid? currentUserId = null)
    {
        var tasks = new TaskRepo();
        var users = new UserRepo(staff);
        var service = new StaffTaskService(
            tasks,
            users,
            new CurrentUser(currentUserId ?? Guid.NewGuid(), currentRole),
            new UnitOfWork(),
            new CreateStaffTaskRequestValidator());

        return new Fixture(service, tasks);
    }

    private sealed record Fixture(StaffTaskService Service, TaskRepo Tasks);

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

    private sealed class UserRepo(User user) : IUserRepository
    {
        public Task<IReadOnlyList<User>> GetAllAsync(string? search = null, UserRole? role = null, bool? isActive = null, UserVerificationStatus? verificationStatus = null, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<User>>([user]);

        public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult<User?>(id == user.Id ? user : null);

        public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
            Task.FromResult<User?>(user.Email == email.Trim().ToLowerInvariant() ? user : null);

        public Task<User?> GetByRefreshTokenHashAsync(string refreshTokenHash, CancellationToken cancellationToken = default) =>
            Task.FromResult<User?>(null);

        public Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default) =>
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
