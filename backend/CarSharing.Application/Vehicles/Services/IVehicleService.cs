using CarSharing.Application.Common.Models;
using CarSharing.Application.Vehicles.Dtos;

namespace CarSharing.Application.Vehicles.Services;

public interface IVehicleService
{
    Task<Result<IReadOnlyList<VehicleDto>>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<Result<VehicleDto>> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Result<VehicleDto>> CreateAsync(CreateVehicleRequest request, CancellationToken cancellationToken = default);
    Task<Result<VehicleDto>> UpdateAsync(Guid id, UpdateVehicleRequest request, CancellationToken cancellationToken = default);
    Task<Result<VehicleDto>> UpdateImagesAsync(Guid id, UpdateVehicleImagesRequest request, CancellationToken cancellationToken = default);
    Task<Result<VehicleDto>> UpdateStatusAsync(Guid id, UpdateVehicleStatusRequest request, CancellationToken cancellationToken = default);
}
