using CarSharing.Application.Admin.Dtos;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public sealed class AdminStatisticsRepository : IAdminStatisticsRepository
{
    private const string DefaultCurrency = "AZN";

    private readonly AppDbContext _dbContext;

    public AdminStatisticsRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<AdminStatisticsSnapshot> GetLiveSnapshotAsync(
        AdminStatisticsPeriod period,
        CancellationToken cancellationToken = default)
    {
        var rideStatusCounts = await _dbContext.Trips
            .GroupBy(trip => trip.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, cancellationToken);

        var completedTripsToday = await _dbContext.Trips
            .CountAsync(
                trip => trip.Status == TripStatus.Completed
                    && trip.EndedAt >= period.TodayStartUtc
                    && trip.EndedAt < period.TomorrowStartUtc,
                cancellationToken);

        var vehicleStatusCounts = await _dbContext.Vehicles
            .GroupBy(vehicle => vehicle.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, cancellationToken);

        var activeChargingSessions = await _dbContext.ChargingSessions
            .CountAsync(session => session.Status == ChargingSessionStatus.Active, cancellationToken);

        var ridePayments = _dbContext.PaymentTransactions
            .Where(payment => payment.Type == PaymentTransactionType.RidePayment
                && payment.Status == PaymentTransactionStatus.Completed
                && payment.CompletedAt != null);

        var todayRevenue = await SumRideRevenueAsync(ridePayments, period.TodayStartUtc, period.TomorrowStartUtc, cancellationToken);
        var weekRevenue = await SumRideRevenueAsync(ridePayments, period.WeekStartUtc, period.TomorrowStartUtc, cancellationToken);
        var monthRevenue = await SumRideRevenueAsync(ridePayments, period.MonthStartUtc, period.TomorrowStartUtc, cancellationToken);

        var currency = await _dbContext.PaymentTransactions
            .Where(payment => payment.Type == PaymentTransactionType.RidePayment
                && payment.Status == PaymentTransactionStatus.Completed)
            .OrderByDescending(payment => payment.CompletedAt ?? payment.CreatedAt)
            .Select(payment => payment.Currency)
            .FirstOrDefaultAsync(cancellationToken) ?? DefaultCurrency;

        var paymentStatusCounts = await _dbContext.PaymentTransactions
            .GroupBy(payment => payment.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, cancellationToken);

        var chartPayments = await ridePayments
            .Where(payment => payment.CompletedAt >= period.ChartStartUtc
                && payment.CompletedAt < period.TomorrowStartUtc)
            .Select(payment => new ChartPayment(payment.CompletedAt!.Value, payment.Amount))
            .ToListAsync(cancellationToken);

        var topVehicles = await GetTopVehiclesAsync(period.MonthStartUtc, period.TomorrowStartUtc, cancellationToken);

        return new AdminStatisticsSnapshot(
            DateTime.UtcNow,
            GetCount(rideStatusCounts, TripStatus.Active),
            GetCount(rideStatusCounts, TripStatus.PendingCompletionReview),
            GetCount(rideStatusCounts, TripStatus.AwaitingPayment),
            completedTripsToday,
            vehicleStatusCounts,
            activeChargingSessions,
            todayRevenue,
            weekRevenue,
            monthRevenue,
            currency,
            paymentStatusCounts,
            BuildRevenueChart(chartPayments, period.ChartStartUtc, period.TomorrowStartUtc),
            topVehicles);
    }

    public async Task<AdminFinanceStatisticsDto> GetFinanceSnapshotAsync(
        DateTime fromUtc,
        DateTime toUtc,
        CancellationToken cancellationToken = default)
    {
        var ridePayments = _dbContext.PaymentTransactions
            .Where(payment => payment.Type == PaymentTransactionType.RidePayment
                && payment.Status == PaymentTransactionStatus.Completed
                && payment.CompletedAt != null
                && payment.CompletedAt >= fromUtc
                && payment.CompletedAt < toUtc);

        var revenue = await ridePayments
            .SumAsync(payment => (decimal?)payment.Amount, cancellationToken) ?? 0m;

        var currency = await _dbContext.PaymentTransactions
            .Where(payment => payment.Status == PaymentTransactionStatus.Completed)
            .OrderByDescending(payment => payment.CompletedAt ?? payment.CreatedAt)
            .Select(payment => payment.Currency)
            .FirstOrDefaultAsync(cancellationToken) ?? DefaultCurrency;

        var paymentStatusCounts = await _dbContext.PaymentTransactions
            .Where(payment => (payment.CompletedAt ?? payment.CreatedAt) >= fromUtc
                && (payment.CompletedAt ?? payment.CreatedAt) < toUtc)
            .GroupBy(payment => payment.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, cancellationToken);

        var completedTrips = await _dbContext.Trips
            .CountAsync(
                trip => trip.Status == TripStatus.Completed
                    && trip.EndedAt >= fromUtc
                    && trip.EndedAt < toUtc,
                cancellationToken);

        var vehicleStatusCounts = await _dbContext.Vehicles
            .GroupBy(vehicle => vehicle.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.Status, x => x.Count, cancellationToken);

        var fleetSize = vehicleStatusCounts.Values.Sum();
        var activeOrReserved = GetCount(vehicleStatusCounts, VehicleStatus.InUse)
            + GetCount(vehicleStatusCounts, VehicleStatus.Reserved);
        var utilization = fleetSize == 0
            ? 0
            : (int)Math.Round(((decimal)activeOrReserved / fleetSize) * 100, MidpointRounding.AwayFromZero);

        var timeZone = GetBakuTimeZone();

        return new AdminFinanceStatisticsDto(
            DateTime.UtcNow,
            "Asia/Baku",
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(fromUtc, timeZone)),
            DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(toUtc.AddTicks(-1), timeZone)),
            revenue,
            currency,
            completedTrips,
            GetCount(paymentStatusCounts, PaymentTransactionStatus.Completed),
            GetCount(paymentStatusCounts, PaymentTransactionStatus.Pending),
            GetCount(paymentStatusCounts, PaymentTransactionStatus.Failed),
            GetCount(paymentStatusCounts, PaymentTransactionStatus.Refunded),
            fleetSize,
            activeOrReserved,
            utilization,
            await GetTopVehiclesAsync(fromUtc, toUtc, cancellationToken));
    }

    private static async Task<decimal> SumRideRevenueAsync(
        IQueryable<PaymentTransaction> ridePayments,
        DateTime fromUtc,
        DateTime toUtc,
        CancellationToken cancellationToken)
    {
        return await ridePayments
            .Where(payment => payment.CompletedAt >= fromUtc && payment.CompletedAt < toUtc)
            .SumAsync(payment => (decimal?)payment.Amount, cancellationToken) ?? 0m;
    }

    private async Task<IReadOnlyList<AdminTopVehicleDto>> GetTopVehiclesAsync(
        DateTime fromUtc,
        DateTime toUtc,
        CancellationToken cancellationToken)
    {
        return await (
            from payment in _dbContext.PaymentTransactions
            join trip in _dbContext.Trips on payment.TripId equals trip.Id
            join vehicle in _dbContext.Vehicles on trip.VehicleId equals vehicle.Id
            where payment.Type == PaymentTransactionType.RidePayment
                && payment.Status == PaymentTransactionStatus.Completed
                && payment.CompletedAt >= fromUtc
                && payment.CompletedAt < toUtc
            group new { payment, vehicle } by new
            {
                vehicle.Id,
                vehicle.Brand,
                vehicle.Model,
                vehicle.PlateNumber
            }
            into grouped
            orderby grouped.Sum(x => x.payment.Amount) descending
            select new AdminTopVehicleDto(
                grouped.Key.Id,
                (grouped.Key.Brand + " " + grouped.Key.Model).Trim(),
                grouped.Key.PlateNumber,
                grouped.Count(),
                grouped.Sum(x => x.payment.Amount)))
            .Take(5)
            .ToListAsync(cancellationToken);
    }

    private static IReadOnlyList<AdminChartPointDto> BuildRevenueChart(
        IReadOnlyList<ChartPayment> payments,
        DateTime chartStartUtc,
        DateTime tomorrowStartUtc)
    {
        var timeZone = GetBakuTimeZone();
        var startDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(chartStartUtc, timeZone));
        var endDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(tomorrowStartUtc, timeZone)).AddDays(-1);

        var groupedPayments = payments
            .GroupBy(payment => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(payment.CompletedAt, timeZone)))
            .ToDictionary(
                group => group.Key,
                group => new
                {
                    Revenue = group.Sum(payment => (decimal)payment.Amount),
                    Count = group.Count()
                });

        var points = new List<AdminChartPointDto>();
        for (var date = startDate; date <= endDate; date = date.AddDays(1))
        {
            if (groupedPayments.TryGetValue(date, out var value))
            {
                points.Add(new AdminChartPointDto(date, value.Revenue, value.Count));
            }
            else
            {
                points.Add(new AdminChartPointDto(date, 0m, 0));
            }
        }

        return points;
    }

    private static int GetCount<TKey>(IReadOnlyDictionary<TKey, int> counts, TKey key)
        where TKey : notnull =>
        counts.TryGetValue(key, out var count) ? count : 0;

    private static TimeZoneInfo GetBakuTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Asia/Baku");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Azerbaijan Standard Time");
        }
    }

    private sealed record ChartPayment(DateTime CompletedAt, decimal Amount);
}
