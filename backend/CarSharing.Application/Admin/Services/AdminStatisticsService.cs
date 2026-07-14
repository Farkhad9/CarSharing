using CarSharing.Application.Admin.Dtos;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Domain.Enums;

namespace CarSharing.Application.Admin.Services;

public sealed class AdminStatisticsService : IAdminStatisticsService
{
    private const string BakuTimeZoneName = "Asia/Baku";

    private static readonly Error Unauthenticated = new("AdminStatistics.Unauthenticated", "User must be authenticated.");
    private static readonly Error AdminRequired = new("AdminStatistics.AdminRequired", "Only admin or super admin can access live statistics.");

    private readonly IAdminStatisticsRepository _statisticsRepository;
    private readonly ICurrentUserService _currentUser;

    public AdminStatisticsService(
        IAdminStatisticsRepository statisticsRepository,
        ICurrentUserService currentUser)
    {
        _statisticsRepository = statisticsRepository;
        _currentUser = currentUser;
    }

    public async Task<Result<AdminLiveStatisticsDto>> GetLiveStatisticsAsync(CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<AdminLiveStatisticsDto>.Failure(accessError);

        var bakuNow = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, GetBakuTimeZone());
        var todayStart = bakuNow.Date;
        var weekStart = todayStart.AddDays(-GetMondayBasedDayOffset(bakuNow.DayOfWeek));
        var monthStart = new DateTime(bakuNow.Year, bakuNow.Month, 1);
        var tomorrowStart = todayStart.AddDays(1);
        var chartStart = todayStart.AddDays(-29);

        var period = new AdminStatisticsPeriod(
            ToUtc(todayStart),
            ToUtc(tomorrowStart),
            ToUtc(weekStart),
            ToUtc(monthStart),
            ToUtc(chartStart));

        var snapshot = await _statisticsRepository.GetLiveSnapshotAsync(period, cancellationToken);

        var totalVehicles = snapshot.VehicleStatusCounts.Values.Sum();
        var available = CountVehicles(snapshot, VehicleStatus.Available);
        var reserved = CountVehicles(snapshot, VehicleStatus.Reserved);
        var inUse = CountVehicles(snapshot, VehicleStatus.InUse);
        var charging = CountVehicles(snapshot, VehicleStatus.Charging);
        var maintenance = CountVehicles(snapshot, VehicleStatus.Maintenance);
        var utilization = totalVehicles == 0
            ? 0
            : (int)Math.Round(((decimal)(inUse + reserved) / totalVehicles) * 100, MidpointRounding.AwayFromZero);

        var dto = new AdminLiveStatisticsDto(
            snapshot.GeneratedAt,
            BakuTimeZoneName,
            new AdminRideStatisticsDto(
                snapshot.ActiveRides,
                snapshot.PendingCompletionReviewRides,
                snapshot.AwaitingPaymentRides,
                snapshot.CompletedTripsToday),
            new AdminVehicleStatisticsDto(
                totalVehicles,
                available,
                reserved,
                inUse,
                charging,
                maintenance,
                utilization),
            new AdminChargingStatisticsDto(
                snapshot.ActiveChargingSessions,
                charging),
            new AdminRevenueStatisticsDto(
                snapshot.TodayRevenue,
                snapshot.WeekRevenue,
                snapshot.MonthRevenue,
                snapshot.Currency),
            new AdminPaymentStatisticsDto(
                CountPayments(snapshot, PaymentTransactionStatus.Completed),
                CountPayments(snapshot, PaymentTransactionStatus.Pending),
                CountPayments(snapshot, PaymentTransactionStatus.Failed),
                CountPayments(snapshot, PaymentTransactionStatus.Refunded)),
            snapshot.RevenueChart,
            snapshot.TopVehicles);

        return Result<AdminLiveStatisticsDto>.Success(dto);
    }

    private Error? RequireAdmin()
    {
        if (!_currentUser.IsAuthenticated || _currentUser.UserId is null) return Unauthenticated;
        return _currentUser.Role is UserRole.Admin or UserRole.SuperAdmin ? null : AdminRequired;
    }

    private static int CountVehicles(AdminStatisticsSnapshot snapshot, VehicleStatus status) =>
        snapshot.VehicleStatusCounts.TryGetValue(status, out var count) ? count : 0;

    private static int CountPayments(AdminStatisticsSnapshot snapshot, PaymentTransactionStatus status) =>
        snapshot.PaymentStatusCounts.TryGetValue(status, out var count) ? count : 0;

    private static int GetMondayBasedDayOffset(DayOfWeek dayOfWeek) =>
        dayOfWeek == DayOfWeek.Sunday ? 6 : (int)dayOfWeek - 1;

    private static DateTime ToUtc(DateTime bakuLocalDateTime)
    {
        var timeZone = GetBakuTimeZone();
        return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(bakuLocalDateTime, DateTimeKind.Unspecified), timeZone);
    }

    private static TimeZoneInfo GetBakuTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(BakuTimeZoneName);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Azerbaijan Standard Time");
        }
    }
}
