using CarSharing.Application.Admin.Dtos;
using CarSharing.Application.Common.Models;

namespace CarSharing.Application.Admin.Services;

public interface IAdminStatisticsService
{
    Task<Result<AdminLiveStatisticsDto>> GetLiveStatisticsAsync(CancellationToken cancellationToken = default);
    Task<Result<AdminStaffKpiSummaryDto>> GetStaffKpiAsync(CancellationToken cancellationToken = default);
    Task<Result<AdminStaffKpiItemDto>> RecordStaffKpiEventAsync(
        RecordStaffKpiEventRequest request,
        CancellationToken cancellationToken = default);
}
