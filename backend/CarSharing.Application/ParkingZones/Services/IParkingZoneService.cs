using CarSharing.Application.Common.Models;
using CarSharing.Application.ParkingZones.Dtos;

namespace CarSharing.Application.ParkingZones.Services;

public interface IParkingZoneService
{
    Task<Result<IReadOnlyList<ParkingZoneDto>>> GetAllAsync(bool includeInactive = false, CancellationToken cancellationToken = default);
    Task<Result<ParkingZoneDto>> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<ParkingZoneDto>> CreateAsync(UpsertParkingZoneRequest request, CancellationToken cancellationToken = default);
    Task<Result<ParkingZoneDto>> UpdateAsync(Guid id, UpsertParkingZoneRequest request, CancellationToken cancellationToken = default);
    Task<Result<bool>> DeactivateAsync(Guid id, CancellationToken cancellationToken = default);
}
