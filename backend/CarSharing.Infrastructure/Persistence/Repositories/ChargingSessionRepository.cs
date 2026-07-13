using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public sealed class ChargingSessionRepository : IChargingSessionRepository
{
    private readonly AppDbContext _dbContext;

    public ChargingSessionRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<ChargingSession>> GetActiveAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.ChargingSessions
            .Where(session => session.Status == ChargingSessionStatus.Active)
            .OrderBy(session => session.StartedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<ChargingSession?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.ChargingSessions
            .FirstOrDefaultAsync(session => session.Id == id, cancellationToken);
    }

    public async Task<ChargingSession?> GetActiveByVehicleIdAsync(Guid vehicleId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.ChargingSessions
            .FirstOrDefaultAsync(
                session => session.VehicleId == vehicleId
                    && session.Status == ChargingSessionStatus.Active,
                cancellationToken);
    }

    public async Task AddAsync(ChargingSession session, CancellationToken cancellationToken = default)
    {
        await _dbContext.ChargingSessions.AddAsync(session, cancellationToken);
    }
}
