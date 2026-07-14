using CarSharing.Application.Admin.Dtos;

namespace CarSharing.Application.Common.Interfaces;

public sealed record AdminStatisticsPeriod(
    DateTime TodayStartUtc,
    DateTime TomorrowStartUtc,
    DateTime WeekStartUtc,
    DateTime MonthStartUtc,
    DateTime ChartStartUtc);

public interface IAdminStatisticsRepository
{
    Task<AdminStatisticsSnapshot> GetLiveSnapshotAsync(
        AdminStatisticsPeriod period,
        CancellationToken cancellationToken = default);
}
