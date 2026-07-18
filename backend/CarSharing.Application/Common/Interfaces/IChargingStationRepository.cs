using CarSharing.Domain.Entities;

namespace CarSharing.Application.Common.Interfaces;

public interface IChargingStationRepository
{
    Task<IReadOnlyList<ChargingStation>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<ChargingStation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ChargingStation?> FindMatchingAsync(
        string name,
        string locationLabel,
        double latitude,
        double longitude,
        CancellationToken cancellationToken = default);
    Task<bool> HasActiveSessionsAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> HasAssignedVehiclesAsync(Guid id, CancellationToken cancellationToken = default);
    Task AddAsync(ChargingStation station, CancellationToken cancellationToken = default);
    void Remove(ChargingStation station);
}
