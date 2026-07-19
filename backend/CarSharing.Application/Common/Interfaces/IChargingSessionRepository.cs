using CarSharing.Domain.Entities;

namespace CarSharing.Application.Common.Interfaces;

public interface IChargingSessionRepository
{
    Task<IReadOnlyList<ChargingSession>> GetActiveAsync(CancellationToken cancellationToken = default);
    Task<ChargingSession?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ChargingSession?> GetActiveByVehicleIdAsync(Guid vehicleId, CancellationToken cancellationToken = default);
    Task<ChargingSession?> GetActiveByStaffTaskIdAsync(Guid staffTaskId, CancellationToken cancellationToken = default);
    Task AddAsync(ChargingSession session, CancellationToken cancellationToken = default);
    Task RemoveByStationIdAsync(Guid stationId, CancellationToken cancellationToken = default);
}
