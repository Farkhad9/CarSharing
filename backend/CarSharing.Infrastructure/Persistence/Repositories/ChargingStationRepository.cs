using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
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

    public async Task<ChargingStation?> FindMatchingAsync(
        string name,
        string locationLabel,
        double latitude,
        double longitude,
        CancellationToken cancellationToken = default)
    {
        var normalizedName = name.Trim().ToLower();
        var normalizedLocation = locationLabel.Trim().ToLower();

        return await _dbContext.ChargingStations
            .FirstOrDefaultAsync(
                station =>
                    station.Name.ToLower() == normalizedName
                    && station.LocationLabel.ToLower() == normalizedLocation
                    && Math.Abs(station.Latitude - latitude) < 0.00001
                    && Math.Abs(station.Longitude - longitude) < 0.00001,
                cancellationToken);
    }

    public async Task<bool> HasActiveSessionsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.ChargingSessions
            .AnyAsync(
                session => session.ChargingStationId == id
                    && session.Status == ChargingSessionStatus.Active,
                cancellationToken);
    }

    public async Task<bool> HasAssignedVehiclesAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Vehicles
            .AnyAsync(vehicle => vehicle.ChargingStationId == id, cancellationToken);
    }

    public async Task AddAsync(ChargingStation station, CancellationToken cancellationToken = default)
    {
        await _dbContext.ChargingStations.AddAsync(station, cancellationToken);
    }

    public void Remove(ChargingStation station)
    {
        _dbContext.ChargingStations.Remove(station);
    }
}
