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

public sealed record AdminFinanceStatisticsRequest(
    DateOnly From,
    DateOnly To);

public sealed record AdminFinanceStatisticsDto(
    DateTime GeneratedAt,
    string TimeZone,
    DateOnly From,
    DateOnly To,
    decimal Revenue,
    string Currency,
    int CompletedTrips,
    int CompletedPayments,
    int PendingPayments,
    int FailedPayments,
    int RefundedPayments,
    int FleetSize,
    int ActiveOrReservedVehicles,
    int UtilizationPercent,
    IReadOnlyList<AdminTopVehicleDto> TopVehicles);

public sealed record AdminStaffKpiSummaryDto(
    DateTime GeneratedAt,
    string TimeZone,
    int ActiveStaff,
    int TotalStaff,
    int OrdersCompleted,
    int AverageCompletionMinutes,
    decimal AverageRating,
    int WeeklyChangePercent,
    IReadOnlyList<AdminStaffKpiRowDto> Staff,
    IReadOnlyList<AdminStaffKpiRowDto> Admins);

public sealed record AdminStaffKpiRowDto(
    Guid Id,
    string Name,
    string Email,
    string Role,
    bool Active,
    int OrdersCompleted,
    int AverageCompletionMinutes,
    decimal Rating,
    int Complaints,
    int Praises,
    decimal ActiveShiftHours,
    int WeeklyChangePercent,
    int KycRating,
    int ApplicationsProcessed,
    int SupportTicketsClosed,
    IReadOnlyList<AdminStaffKpiItemDto> CompletedTasks);

public sealed record AdminStaffKpiItemDto(
    Guid Id,
    string Title,
    string Result,
    DateTime CompletedAt);

public sealed record RecordStaffKpiEventRequest(
    Guid StaffUserId,
    StaffKpiEventType Type,
    StaffTaskType TaskType,
    Guid? SourceId,
    string Title,
    string Result,
    DateTime OccurredAt,
    DateTime? StartedAt,
    DateTime? CompletedAt,
    decimal? Rating);

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
