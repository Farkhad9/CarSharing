using CarSharing.Application.Charging.Dtos;
using CarSharing.Application.Common.Models;

namespace CarSharing.Application.Charging.Services;

public interface IChargingService
{
    Task<Result<IReadOnlyList<ChargingStationDto>>> GetStationsAsync(CancellationToken cancellationToken = default);
    Task<Result<ChargingStationDto>> GetStationByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<ChargingStationDto>> CreateStationAsync(CreateChargingStationRequest request, CancellationToken cancellationToken = default);
    Task<Result<ChargingStationDto>> UpdateStationStatusAsync(Guid id, UpdateChargingStationStatusRequest request, CancellationToken cancellationToken = default);
    Task<Result<bool>> DeleteStationAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<IReadOnlyList<ChargingSessionDto>>> GetActiveSessionsAsync(CancellationToken cancellationToken = default);
    Task<Result<ChargingSessionDetailsDto>> StartChargingAsync(StartChargingSessionRequest request, CancellationToken cancellationToken = default);
    Task<Result<ChargingSessionDetailsDto>> CompleteChargingAsync(Guid sessionId, CompleteChargingSessionRequest request, CancellationToken cancellationToken = default);
    Task<Result<bool>> ActivateVehicleAsync(Guid vehicleId, CancellationToken cancellationToken = default);
}
