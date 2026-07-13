using CarSharing.Domain.Entities;

namespace CarSharing.Application.Common.Interfaces;

public interface IVehicleRepository
{
    Task<IReadOnlyList<Vehicle>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<Vehicle?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Vehicle?> GetByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default);
    Task<int> CountAvailableByZoneAsync(string zone, CancellationToken cancellationToken = default);
    Task<bool> ExistsByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default);
    Task<bool> ExistsByPlateNumberAsync(string plateNumber, Guid excludedVehicleId, CancellationToken cancellationToken = default);
    Task AddAsync(Vehicle vehicle, CancellationToken cancellationToken = default);
}
