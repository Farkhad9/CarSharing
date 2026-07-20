using CarSharing.Domain.Entities;

namespace CarSharing.Application.Common.Interfaces;

public interface IParkingZoneRepository
{
    Task<IReadOnlyList<ParkingZone>> GetAllAsync(bool includeInactive = false, CancellationToken cancellationToken = default);
    Task<ParkingZone?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task AddAsync(ParkingZone zone, CancellationToken cancellationToken = default);
}
