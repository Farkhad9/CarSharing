using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public class VehicleRepository : IVehicleRepository
{
    private readonly AppDbContext _dbContext;

    public VehicleRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<Vehicle>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.Vehicles
            .OrderBy(vehicle => vehicle.Brand)
            .ThenBy(vehicle => vehicle.Model)
            .ThenBy(vehicle => vehicle.PlateNumber)
            .ToListAsync(cancellationToken);
    }

    public async Task<Vehicle?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Vehicles
            .FirstOrDefaultAsync(vehicle => vehicle.Id == id, cancellationToken);
    }

    public async Task<Vehicle?> GetByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Vehicles
            .FirstOrDefaultAsync(vehicle => vehicle.PlateNumber == plateNumber, cancellationToken);
    }

    public async Task<bool> ExistsByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Vehicles
            .AnyAsync(vehicle => vehicle.PlateNumber == plateNumber, cancellationToken);
    }

    public async Task<bool> ExistsByPlateNumberAsync(string plateNumber, Guid excludedVehicleId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Vehicles
            .AnyAsync(vehicle => vehicle.PlateNumber == plateNumber && vehicle.Id != excludedVehicleId, cancellationToken);
    }

    public async Task AddAsync(Vehicle vehicle, CancellationToken cancellationToken = default)
    {
        await _dbContext.Vehicles.AddAsync(vehicle, cancellationToken);
    }
}
