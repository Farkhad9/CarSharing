using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public sealed class ParkingZoneRepository : IParkingZoneRepository
{
    private readonly AppDbContext _dbContext;

    public ParkingZoneRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<ParkingZone>> GetAllAsync(bool includeInactive = false, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.ParkingZones.AsQueryable();
        if (!includeInactive)
        {
            query = query.Where(zone => zone.IsActive);
        }

        return await query
            .OrderBy(zone => zone.Type)
            .ThenBy(zone => zone.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<ParkingZone?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.ParkingZones
            .FirstOrDefaultAsync(zone => zone.Id == id, cancellationToken);
    }

    public async Task AddAsync(ParkingZone zone, CancellationToken cancellationToken = default)
    {
        await _dbContext.ParkingZones.AddAsync(zone, cancellationToken);
    }
}
