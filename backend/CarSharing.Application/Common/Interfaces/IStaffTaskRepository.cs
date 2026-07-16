using CarSharing.Domain.Entities;

namespace CarSharing.Application.Common.Interfaces;

public interface IStaffTaskRepository
{
    Task<IReadOnlyList<StaffTask>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<StaffTask?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StaffTask>> GetByAssigneeIdAsync(Guid assigneeId, CancellationToken cancellationToken = default);
    Task AddAsync(StaffTask task, CancellationToken cancellationToken = default);
}
