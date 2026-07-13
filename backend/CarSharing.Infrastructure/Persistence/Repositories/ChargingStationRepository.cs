using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public sealed class ChargingStationRepository : IChargingStationRepository
{
    private readonly AppDbContext _dbContext;

    public ChargingStationRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<ChargingStation>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.ChargingStations
            .OrderBy(station => station.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<ChargingStation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.ChargingStations
            .FirstOrDefaultAsync(station => station.Id == id, cancellationToken);
    }

    public async Task AddAsync(ChargingStation station, CancellationToken cancellationToken = default)
    {
        await _dbContext.ChargingStations.AddAsync(station, cancellationToken);
    }
}
