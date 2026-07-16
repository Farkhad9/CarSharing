using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public sealed class StaffTaskRepository : IStaffTaskRepository
{
    private readonly AppDbContext _dbContext;

    public StaffTaskRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<StaffTask>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.StaffTasks
            .OrderByDescending(task => task.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<StaffTask?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.StaffTasks
            .FirstOrDefaultAsync(task => task.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<StaffTask>> GetByAssigneeIdAsync(Guid assigneeId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.StaffTasks
            .Where(task => task.AssigneeId == assigneeId)
            .OrderByDescending(task => task.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(StaffTask task, CancellationToken cancellationToken = default)
    {
        await _dbContext.StaffTasks.AddAsync(task, cancellationToken);
    }
}
