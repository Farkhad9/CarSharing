using CarSharing.Application.Admin.Dtos;
using CarSharing.Application.Admin.Services;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Enums;
using Xunit;

namespace CarSharing.Application.Tests;

public sealed class AdminStatisticsTests
{
    [Fact]
    public async Task GetLiveStatisticsAsync_ForAdmin_ReturnsDashboardSummary()
    {
        var repository = new StatisticsRepo(CreateSnapshot());
        var service = new AdminStatisticsService(repository, new CurrentUser(UserRole.Admin));

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
        var service = new AdminStatisticsService(new StatisticsRepo(CreateSnapshot()), new CurrentUser(UserRole.SuperAdmin));

        var result = await service.GetLiveStatisticsAsync();

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task GetLiveStatisticsAsync_ForRider_IsForbidden()
    {
        var service = new AdminStatisticsService(new StatisticsRepo(CreateSnapshot()), new CurrentUser(UserRole.Rider));

        var result = await service.GetLiveStatisticsAsync();

        Assert.True(result.IsFailure);
        Assert.Equal("AdminStatistics.AdminRequired", result.Errors.Single().Code);
    }

    [Fact]
    public async Task GetLiveStatisticsAsync_ForAnonymousUser_IsUnauthorized()
    {
        var service = new AdminStatisticsService(new StatisticsRepo(CreateSnapshot()), new CurrentUser(null, false));

        var result = await service.GetLiveStatisticsAsync();

        Assert.True(result.IsFailure);
        Assert.Equal("AdminStatistics.Unauthenticated", result.Errors.Single().Code);
    }

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
