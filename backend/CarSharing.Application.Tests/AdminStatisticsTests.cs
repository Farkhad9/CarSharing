using CarSharing.Application.Admin.Dtos;
using CarSharing.Application.Admin.Services;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Xunit;

namespace CarSharing.Application.Tests;

public sealed class AdminStatisticsTests
{
    [Fact]
    public async Task GetLiveStatisticsAsync_ForAdmin_ReturnsDashboardSummary()
    {
        var repository = new StatisticsRepo(CreateSnapshot());
        var service = CreateService(repository, new CurrentUser(UserRole.Admin));

        var result = await service.GetLiveStatisticsAsync();

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value!.Rides.Active);
        Assert.Equal(8, result.Value.Vehicles.Total);
        Assert.Equal(2, result.Value.Vehicles.Available);
        Assert.Equal(2, result.Value.Vehicles.Reserved);
        Assert.Equal(2, result.Value.Vehicles.InUse);
        Assert.Equal(50, result.Value.Vehicles.UtilizationPercent);
        Assert.Equal(2, result.Value.Charging.ActiveSessions);
        Assert.Equal(2, result.Value.Charging.VehiclesCharging);
        Assert.Equal(42m, result.Value.Revenue.Today);
        Assert.Equal(190m, result.Value.Revenue.ThisWeek);
        Assert.Equal(720m, result.Value.Revenue.ThisMonth);
        Assert.Equal(9, result.Value.Payments.Completed);
        Assert.Single(result.Value.RevenueChart);
        Assert.Single(result.Value.TopVehicles);
    }

    [Fact]
    public async Task GetLiveStatisticsAsync_ForSuperAdmin_IsAllowed()
    {
        var service = CreateService(new StatisticsRepo(CreateSnapshot()), new CurrentUser(UserRole.SuperAdmin));

        var result = await service.GetLiveStatisticsAsync();

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task GetFinanceStatisticsAsync_ForSuperAdmin_ReturnsPeriodSummary()
    {
        var repository = new StatisticsRepo(CreateSnapshot());
        var service = CreateService(repository, new CurrentUser(UserRole.SuperAdmin));

        var result = await service.GetFinanceStatisticsAsync(new AdminFinanceStatisticsRequest(
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)),
            DateOnly.FromDateTime(DateTime.UtcNow)));

        Assert.True(result.IsSuccess);
        Assert.Equal(321m, result.Value!.Revenue);
        Assert.Equal(6, result.Value.CompletedTrips);
        Assert.Equal(40, result.Value.UtilizationPercent);
    }

    [Fact]
    public async Task GetFinanceStatisticsAsync_ForAdmin_IsForbidden()
    {
        var service = CreateService(new StatisticsRepo(CreateSnapshot()), new CurrentUser(UserRole.Admin));

        var result = await service.GetFinanceStatisticsAsync(new AdminFinanceStatisticsRequest(
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)),
            DateOnly.FromDateTime(DateTime.UtcNow)));

        Assert.True(result.IsFailure);
        Assert.Equal("AdminStatistics.SuperAdminRequired", result.Errors.Single().Code);
    }

    [Fact]
    public async Task GetFinanceStatisticsAsync_ForInvalidPeriod_ReturnsValidationError()
    {
        var service = CreateService(new StatisticsRepo(CreateSnapshot()), new CurrentUser(UserRole.SuperAdmin));

        var result = await service.GetFinanceStatisticsAsync(new AdminFinanceStatisticsRequest(
            DateOnly.FromDateTime(DateTime.UtcNow),
            DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1))));

        Assert.True(result.IsFailure);
        Assert.Equal("Validation.Period", result.Errors.Single().Code);
    }

    [Fact]
    public async Task GetLiveStatisticsAsync_ForRider_IsForbidden()
    {
        var service = CreateService(new StatisticsRepo(CreateSnapshot()), new CurrentUser(UserRole.Rider));

        var result = await service.GetLiveStatisticsAsync();

        Assert.True(result.IsFailure);
        Assert.Equal("AdminStatistics.AdminRequired", result.Errors.Single().Code);
    }

    [Fact]
    public async Task GetLiveStatisticsAsync_ForAnonymousUser_IsUnauthorized()
    {
        var service = CreateService(new StatisticsRepo(CreateSnapshot()), new CurrentUser(null, false));

        var result = await service.GetLiveStatisticsAsync();

        Assert.True(result.IsFailure);
        Assert.Equal("AdminStatistics.Unauthenticated", result.Errors.Single().Code);
    }

    private static AdminStatisticsService CreateService(
        IAdminStatisticsRepository statisticsRepository,
        ICurrentUserService currentUser) =>
        new(
            statisticsRepository,
            new UserRepo([]),
            new StaffTaskRepo([]),
            new StaffKpiEventRepo([]),
            new TripCompletionRequestRepo(),
            new TripRepo(),
            new VehicleRepo(),
            new UnitOfWork(),
            currentUser);

    private static AdminStatisticsSnapshot CreateSnapshot()
    {
        var vehicleId = Guid.NewGuid();

        return new AdminStatisticsSnapshot(
            DateTime.UtcNow,
            ActiveRides: 3,
            PendingCompletionReviewRides: 1,
            AwaitingPaymentRides: 2,
            CompletedTripsToday: 4,
            new Dictionary<VehicleStatus, int>
            {
                [VehicleStatus.Available] = 2,
                [VehicleStatus.Reserved] = 2,
                [VehicleStatus.InUse] = 2,
                [VehicleStatus.Charging] = 2
            },
            ActiveChargingSessions: 2,
            TodayRevenue: 42m,
            WeekRevenue: 190m,
            MonthRevenue: 720m,
            Currency: "AZN",
            new Dictionary<PaymentTransactionStatus, int>
            {
                [PaymentTransactionStatus.Completed] = 9,
                [PaymentTransactionStatus.Pending] = 1,
                [PaymentTransactionStatus.Failed] = 2
            },
            [new AdminChartPointDto(DateOnly.FromDateTime(DateTime.UtcNow), 42m, 4)],
            [new AdminTopVehicleDto(vehicleId, "Tesla Model 3", "10AA001", 4, 120m)]);
    }

    private sealed class StatisticsRepo(AdminStatisticsSnapshot snapshot) : IAdminStatisticsRepository
    {
        public AdminStatisticsPeriod? LastPeriod { get; private set; }

        public Task<AdminStatisticsSnapshot> GetLiveSnapshotAsync(
            AdminStatisticsPeriod period,
            CancellationToken cancellationToken = default)
        {
            LastPeriod = period;
            return Task.FromResult(snapshot);
        }

        public Task<AdminFinanceStatisticsDto> GetFinanceSnapshotAsync(
            DateTime fromUtc,
            DateTime toUtc,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new AdminFinanceStatisticsDto(
                DateTime.UtcNow,
                "Asia/Baku",
                DateOnly.FromDateTime(fromUtc),
                DateOnly.FromDateTime(toUtc.AddDays(-1)),
                321m,
                "AZN",
                6,
                7,
                1,
                2,
                0,
                10,
                4,
                40,
                snapshot.TopVehicles));
    }

    private sealed class UserRepo(IReadOnlyList<User> users) : IUserRepository
    {
        public Task<IReadOnlyList<User>> GetAllAsync(
            string? search = null,
            UserRole? role = null,
            bool? isActive = null,
            UserVerificationStatus? verificationStatus = null,
            CancellationToken cancellationToken = default)
        {
            var result = users
                .Where(user => !role.HasValue || user.Role == role.Value)
                .Where(user => !isActive.HasValue || user.IsActive == isActive.Value)
                .Where(user => !verificationStatus.HasValue || user.VerificationStatus == verificationStatus.Value)
                .ToList();

            return Task.FromResult<IReadOnlyList<User>>(result);
        }

        public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(users.SingleOrDefault(user => user.Id == id));

        public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
            Task.FromResult(users.SingleOrDefault(user => user.Email.Equals(email, StringComparison.OrdinalIgnoreCase)));

        public Task<User?> GetByRefreshTokenHashAsync(string refreshTokenHash, CancellationToken cancellationToken = default) =>
            Task.FromResult(users.SingleOrDefault());

        public Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default) =>
            Task.FromResult(users.Any(user => user.Email.Equals(email, StringComparison.OrdinalIgnoreCase)));

        public Task<bool> ExistsByPhoneAsync(string phone, CancellationToken cancellationToken = default) =>
            Task.FromResult(users.Any(user => user.Phone == phone));

        public Task<bool> ExistsByDriverLicenseNumberAsync(string driverLicenseNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult(users.Any(user => user.DriverLicenseNumber.Equals(driverLicenseNumber, StringComparison.OrdinalIgnoreCase)));

        public Task AddAsync(User user, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class StaffTaskRepo(IReadOnlyList<StaffTask> tasks) : IStaffTaskRepository
    {
        public Task<IReadOnlyList<StaffTask>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(tasks);

        public Task<StaffTask?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(tasks.SingleOrDefault(task => task.Id == id));

        public Task<IReadOnlyList<StaffTask>> GetByAssigneeIdAsync(Guid assigneeId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<StaffTask>>(tasks.Where(task => task.AssigneeId == assigneeId).ToList());

        public Task AddAsync(StaffTask task, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class StaffKpiEventRepo(IReadOnlyList<StaffKpiEvent> events) : IStaffKpiEventRepository
    {
        public Task<IReadOnlyList<StaffKpiEvent>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(events);

        public Task<IReadOnlyList<StaffKpiEvent>> GetByStaffIdsAsync(
            IReadOnlyCollection<Guid> staffUserIds,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<StaffKpiEvent>>(
                events.Where(kpiEvent => staffUserIds.Contains(kpiEvent.StaffUserId)).ToList());

        public Task<bool> ExistsAsync(Guid staffUserId, Guid sourceId, CancellationToken cancellationToken = default) =>
            Task.FromResult(events.Any(kpiEvent => kpiEvent.StaffUserId == staffUserId && kpiEvent.SourceId == sourceId));

        public Task AddAsync(StaffKpiEvent kpiEvent, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class TripCompletionRequestRepo : ITripCompletionRequestRepository
    {
        public Task<TripCompletionRequest?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult<TripCompletionRequest?>(null);

        public Task<TripCompletionRequest?> GetLatestByTripIdAsync(Guid tripId, CancellationToken cancellationToken = default) =>
            Task.FromResult<TripCompletionRequest?>(null);

        public Task<IReadOnlyList<TripCompletionRequest>> GetPendingReviewAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<TripCompletionRequest>>([]);

        public Task<IReadOnlyList<TripCompletionRequest>> GetReviewedByUserIdAsync(Guid reviewedByUserId, int take = 50, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<TripCompletionRequest>>([]);

        public Task AddAsync(TripCompletionRequest request, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class TripRepo : ITripRepository
    {
        public Task<Trip?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult<Trip?>(null);

        public Task<Trip?> GetActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.FromResult<Trip?>(null);

        public Task<IReadOnlyList<Trip>> GetActiveTripsByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Trip>>([]);

        public Task<Trip?> GetByReservationIdAsync(Guid reservationId, CancellationToken cancellationToken = default) =>
            Task.FromResult<Trip?>(null);

        public Task AddAsync(Trip trip, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class VehicleRepo : IVehicleRepository
    {
        public Task<IReadOnlyList<Vehicle>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Vehicle>>([]);

        public Task<Vehicle?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult<Vehicle?>(null);

        public Task<Vehicle?> GetByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult<Vehicle?>(null);

        public Task<int> CountAvailableByZoneAsync(string zone, CancellationToken cancellationToken = default) =>
            Task.FromResult(0);

        public Task<bool> ExistsByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task<bool> ExistsByPlateNumberAsync(string plateNumber, Guid excludedVehicleId, CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task AddAsync(Vehicle vehicle, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class UnitOfWork : IUnitOfWork
    {
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(1);
    }

    private sealed class CurrentUser : ICurrentUserService
    {
        public CurrentUser(UserRole? role, bool isAuthenticated = true)
        {
            Role = role;
            IsAuthenticated = isAuthenticated;
            UserId = isAuthenticated ? Guid.NewGuid() : null;
        }

        public Guid? UserId { get; }
        public string? Email => null;
        public UserRole? Role { get; }
        public bool IsAuthenticated { get; }
    }
}
