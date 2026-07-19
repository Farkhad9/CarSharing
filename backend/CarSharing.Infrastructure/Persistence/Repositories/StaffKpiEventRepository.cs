using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public sealed class StaffKpiEventRepository : IStaffKpiEventRepository
{
    private readonly AppDbContext _dbContext;

    public StaffKpiEventRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<StaffKpiEvent>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.StaffKpiEvents
            .OrderByDescending(kpiEvent => kpiEvent.OccurredAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<StaffKpiEvent>> GetByStaffIdsAsync(
        IReadOnlyCollection<Guid> staffUserIds,
        CancellationToken cancellationToken = default)
    {
        if (staffUserIds.Count == 0) return [];

        return await _dbContext.StaffKpiEvents
            .Where(kpiEvent => staffUserIds.Contains(kpiEvent.StaffUserId))
            .OrderByDescending(kpiEvent => kpiEvent.OccurredAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> ExistsAsync(Guid staffUserId, Guid sourceId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.StaffKpiEvents
            .AnyAsync(
                kpiEvent => kpiEvent.StaffUserId == staffUserId && kpiEvent.SourceId == sourceId,
                cancellationToken);
    }

    public async Task AddAsync(StaffKpiEvent kpiEvent, CancellationToken cancellationToken = default)
    {
        await _dbContext.StaffKpiEvents.AddAsync(kpiEvent, cancellationToken);
    }
}
