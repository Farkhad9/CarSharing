using CarSharing.Domain.Enums;

namespace CarSharing.Application.Admin.Dtos;

public sealed record AdminLiveStatisticsDto(
    DateTime GeneratedAt,
    string TimeZone,
    AdminRideStatisticsDto Rides,
    AdminVehicleStatisticsDto Vehicles,
    AdminChargingStatisticsDto Charging,
    AdminRevenueStatisticsDto Revenue,
    AdminPaymentStatisticsDto Payments,
    IReadOnlyList<AdminChartPointDto> RevenueChart,
    IReadOnlyList<AdminTopVehicleDto> TopVehicles);

public sealed record AdminRideStatisticsDto(
    int Active,
    int PendingCompletionReview,
    int AwaitingPayment,
    int CompletedToday);

public sealed record AdminVehicleStatisticsDto(
    int Total,
    int Available,
    int Reserved,
    int InUse,
    int Charging,
    int Maintenance,
    int UtilizationPercent);

public sealed record AdminChargingStatisticsDto(
    int ActiveSessions,
    int VehiclesCharging);

public sealed record AdminRevenueStatisticsDto(
    decimal Today,
    decimal ThisWeek,
    decimal ThisMonth,
    string Currency);

public sealed record AdminPaymentStatisticsDto(
    int Completed,
    int Pending,
    int Failed,
    int Refunded);

public sealed record AdminChartPointDto(
    DateOnly Date,
    decimal Revenue,
    int CompletedRidePayments);

public sealed record AdminTopVehicleDto(
    Guid VehicleId,
    string Label,
    string PlateNumber,
    int CompletedTrips,
    decimal Revenue);

public sealed record AdminStatisticsSnapshot(
    DateTime GeneratedAt,
    int ActiveRides,
    int PendingCompletionReviewRides,
    int AwaitingPaymentRides,
    int CompletedTripsToday,
    IReadOnlyDictionary<VehicleStatus, int> VehicleStatusCounts,
    int ActiveChargingSessions,
    decimal TodayRevenue,
    decimal WeekRevenue,
    decimal MonthRevenue,
    string Currency,
    IReadOnlyDictionary<PaymentTransactionStatus, int> PaymentStatusCounts,
    IReadOnlyList<AdminChartPointDto> RevenueChart,
    IReadOnlyList<AdminTopVehicleDto> TopVehicles);
