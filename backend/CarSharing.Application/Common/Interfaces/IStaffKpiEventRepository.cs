using CarSharing.Domain.Entities;

namespace CarSharing.Application.Common.Interfaces;

public interface IStaffKpiEventRepository
{
    Task<IReadOnlyList<StaffKpiEvent>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StaffKpiEvent>> GetByStaffIdsAsync(
        IReadOnlyCollection<Guid> staffUserIds,
        CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(Guid staffUserId, Guid sourceId, CancellationToken cancellationToken = default);
    Task AddAsync(StaffKpiEvent kpiEvent, CancellationToken cancellationToken = default);
}
