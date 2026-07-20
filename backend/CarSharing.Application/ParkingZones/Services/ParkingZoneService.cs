using System.Text.Json;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.ParkingZones.Dtos;
using CarSharing.Application.ParkingZones.Validators;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using FluentValidation;

namespace CarSharing.Application.ParkingZones.Services;

public sealed class ParkingZoneService : IParkingZoneService
{
    private readonly IParkingZoneRepository _parkingZoneRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IValidator<UpsertParkingZoneRequest> _validator;

    public ParkingZoneService(
        IParkingZoneRepository parkingZoneRepository,
        IUnitOfWork unitOfWork,
        IValidator<UpsertParkingZoneRequest> validator)
    {
        _parkingZoneRepository = parkingZoneRepository;
        _unitOfWork = unitOfWork;
        _validator = validator;
    }

    public async Task<Result<IReadOnlyList<ParkingZoneDto>>> GetAllAsync(bool includeInactive = false, CancellationToken cancellationToken = default)
    {
        var zones = await _parkingZoneRepository.GetAllAsync(includeInactive, cancellationToken);
        return Result<IReadOnlyList<ParkingZoneDto>>.Success(zones.Select(ToDto).ToList());
    }

    public async Task<Result<ParkingZoneDto>> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var zone = await _parkingZoneRepository.GetByIdAsync(id, cancellationToken);
        return zone is null
            ? Result<ParkingZoneDto>.Failure(new Error("ParkingZone.NotFound", "Parking zone was not found."))
            : Result<ParkingZoneDto>.Success(ToDto(zone));
    }

    public async Task<Result<ParkingZoneDto>> CreateAsync(UpsertParkingZoneRequest request, CancellationToken cancellationToken = default)
    {
        var validation = await ValidateAsync(request, cancellationToken);
        if (validation.Count > 0)
        {
            return Result<ParkingZoneDto>.Failure(validation);
        }

        var boundary = NormalizeBoundary(request.Boundary);
        var center = CalculateCenter(boundary);
        var zone = ParkingZone.Create(
            request.Name,
            request.Type,
            center.Latitude,
            center.Longitude,
            CalculateRadiusMeters(center, boundary),
            JsonSerializer.Serialize(boundary),
            AllowsTripEnd(request));

        await _parkingZoneRepository.AddAsync(zone, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ParkingZoneDto>.Success(ToDto(zone));
    }

    public async Task<Result<ParkingZoneDto>> UpdateAsync(Guid id, UpsertParkingZoneRequest request, CancellationToken cancellationToken = default)
    {
        var zone = await _parkingZoneRepository.GetByIdAsync(id, cancellationToken);
        if (zone is null)
        {
            return Result<ParkingZoneDto>.Failure(new Error("ParkingZone.NotFound", "Parking zone was not found."));
        }

        var validation = await ValidateAsync(request, cancellationToken);
        if (validation.Count > 0)
        {
            return Result<ParkingZoneDto>.Failure(validation);
        }

        var boundary = NormalizeBoundary(request.Boundary);
        var center = CalculateCenter(boundary);
        zone.Update(
            request.Name,
            request.Type,
            center.Latitude,
            center.Longitude,
            CalculateRadiusMeters(center, boundary),
            JsonSerializer.Serialize(boundary),
            AllowsTripEnd(request),
            request.IsActive);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ParkingZoneDto>.Success(ToDto(zone));
    }

    public async Task<Result<bool>> DeactivateAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var zone = await _parkingZoneRepository.GetByIdAsync(id, cancellationToken);
        if (zone is null)
        {
            return Result<bool>.Failure(new Error("ParkingZone.NotFound", "Parking zone was not found."));
        }

        zone.Deactivate();
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true);
    }

    private async Task<IReadOnlyList<Error>> ValidateAsync(UpsertParkingZoneRequest request, CancellationToken cancellationToken)
    {
        var validationResult = await _validator.ValidateAsync(request, cancellationToken);
        return validationResult.Errors
            .Select(error => new Error($"Validation.{error.PropertyName}", error.ErrorMessage))
            .ToList();
    }

    private static bool AllowsTripEnd(UpsertParkingZoneRequest request)
    {
        return request.Type != ParkingZoneType.Restricted && request.AllowsTripEnd;
    }

    private static IReadOnlyList<ParkingZonePointDto> NormalizeBoundary(IReadOnlyList<ParkingZonePointDto> boundary)
    {
        return boundary
            .Select(point => new ParkingZonePointDto(Math.Round(point.Latitude, 6), Math.Round(point.Longitude, 6)))
            .ToList();
    }

    private static ParkingZonePointDto CalculateCenter(IReadOnlyList<ParkingZonePointDto> boundary)
    {
        return new ParkingZonePointDto(
            boundary.Average(point => point.Latitude),
            boundary.Average(point => point.Longitude));
    }

    private static double CalculateRadiusMeters(ParkingZonePointDto center, IReadOnlyList<ParkingZonePointDto> boundary)
    {
        return Math.Round(boundary.Max(point => DistanceMeters(center, point)), 2);
    }

    private static double DistanceMeters(ParkingZonePointDto first, ParkingZonePointDto second)
    {
        const double earthRadiusMeters = 6371000;
        var dLat = DegreesToRadians(second.Latitude - first.Latitude);
        var dLng = DegreesToRadians(second.Longitude - first.Longitude);
        var lat1 = DegreesToRadians(first.Latitude);
        var lat2 = DegreesToRadians(second.Latitude);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
            + Math.Cos(lat1) * Math.Cos(lat2) * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);

        return earthRadiusMeters * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double DegreesToRadians(double degrees)
    {
        return degrees * Math.PI / 180;
    }

    private static ParkingZoneDto ToDto(ParkingZone zone)
    {
        var boundary = JsonSerializer.Deserialize<IReadOnlyList<ParkingZonePointDto>>(zone.BoundaryJson) ?? [];
        return new ParkingZoneDto(
            zone.Id,
            zone.Name,
            zone.Type,
            zone.CenterLatitude,
            zone.CenterLongitude,
            zone.RadiusInMeters,
            boundary,
            zone.AllowsTripEnd,
            zone.IsActive);
    }
}
