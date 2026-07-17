using AutoMapper;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.Vehicles.Dtos;
using CarSharing.Domain.Entities;
using FluentValidation;

namespace CarSharing.Application.Vehicles.Services;

public class VehicleService : IVehicleService
{
    private static readonly Error NotFound = new("Vehicle.NotFound", "Vehicle was not found.");
    private static readonly Error PlateNumberNotUnique = new("Vehicle.PlateNumberNotUnique", "Vehicle with this plate number already exists.");

    private readonly IVehicleRepository _vehicleRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly IValidator<CreateVehicleRequest> _createVehicleValidator;
    private readonly IValidator<UpdateVehicleRequest> _updateVehicleValidator;
    private readonly IValidator<UpdateVehicleStatusRequest> _updateVehicleStatusValidator;

    public VehicleService(
        IVehicleRepository vehicleRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        IValidator<CreateVehicleRequest> createVehicleValidator,
        IValidator<UpdateVehicleRequest> updateVehicleValidator,
        IValidator<UpdateVehicleStatusRequest> updateVehicleStatusValidator)
    {
        _vehicleRepository = vehicleRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _createVehicleValidator = createVehicleValidator;
        _updateVehicleValidator = updateVehicleValidator;
        _updateVehicleStatusValidator = updateVehicleStatusValidator;
    }

    public async Task<Result<IReadOnlyList<VehicleDto>>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var vehicles = await _vehicleRepository.GetAllAsync(cancellationToken);
        return Result<IReadOnlyList<VehicleDto>>.Success(_mapper.Map<IReadOnlyList<VehicleDto>>(vehicles));
    }

    public async Task<Result<VehicleDto>> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var vehicle = await _vehicleRepository.GetByIdAsync(id, cancellationToken);
        if (vehicle is null)
        {
            return Result<VehicleDto>.Failure(NotFound);
        }

        return Result<VehicleDto>.Success(_mapper.Map<VehicleDto>(vehicle));
    }

    public async Task<Result<VehicleDto>> CreateAsync(CreateVehicleRequest request, CancellationToken cancellationToken = default)
    {
        var validationResult = await _createVehicleValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<VehicleDto>.Failure(ToValidationErrors(validationResult));
        }

        var normalizedPlateNumber = NormalizePlateNumber(request.PlateNumber);
        if (await _vehicleRepository.ExistsByPlateNumberAsync(normalizedPlateNumber, cancellationToken))
        {
            return Result<VehicleDto>.Failure(PlateNumberNotUnique);
        }

        var vehicle = Vehicle.Create(
            request.Brand,
            request.Model,
            request.Year,
            normalizedPlateNumber,
            request.MileageKm,
            request.BatteryPercent,
            request.RangeKm,
            request.PricePerMinute,
            request.Currency,
            request.Seats,
            request.Color,
            request.ConnectorType,
            request.ChargingStationId,
            request.LocationLabel,
            request.Zone,
            request.Latitude,
            request.Longitude);

        await _vehicleRepository.AddAsync(vehicle, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<VehicleDto>.Success(_mapper.Map<VehicleDto>(vehicle));
    }

    public async Task<Result<VehicleDto>> UpdateAsync(Guid id, UpdateVehicleRequest request, CancellationToken cancellationToken = default)
    {
        var validationResult = await _updateVehicleValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<VehicleDto>.Failure(ToValidationErrors(validationResult));
        }

        var vehicle = await _vehicleRepository.GetByIdAsync(id, cancellationToken);
        if (vehicle is null)
        {
            return Result<VehicleDto>.Failure(NotFound);
        }

        var normalizedPlateNumber = NormalizePlateNumber(request.PlateNumber);
        if (await _vehicleRepository.ExistsByPlateNumberAsync(normalizedPlateNumber, id, cancellationToken))
        {
            return Result<VehicleDto>.Failure(PlateNumberNotUnique);
        }

        vehicle.UpdateDetails(
            request.Brand,
            request.Model,
            request.Year,
            normalizedPlateNumber,
            request.MileageKm,
            request.BatteryPercent,
            request.RangeKm,
            request.PricePerMinute,
            request.Currency,
            request.Seats,
            request.Color,
            request.ConnectorType,
            request.ChargingStationId,
            request.LocationLabel,
            request.Zone,
            request.Latitude,
            request.Longitude);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<VehicleDto>.Success(_mapper.Map<VehicleDto>(vehicle));
    }

    public async Task<Result<VehicleDto>> UpdateImagesAsync(
        Guid id,
        UpdateVehicleImagesRequest request,
        CancellationToken cancellationToken = default)
    {
        var vehicle = await _vehicleRepository.GetByIdAsync(id, cancellationToken);
        if (vehicle is null)
        {
            return Result<VehicleDto>.Failure(NotFound);
        }

        vehicle.UpdateImages(
            request.MainImageUrl,
            request.GalleryImageUrl1,
            request.GalleryImageUrl2,
            request.GalleryImageUrl3);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<VehicleDto>.Success(_mapper.Map<VehicleDto>(vehicle));
    }

    public async Task<Result<VehicleDto>> UpdateStatusAsync(Guid id, UpdateVehicleStatusRequest request, CancellationToken cancellationToken = default)
    {
        var validationResult = await _updateVehicleStatusValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<VehicleDto>.Failure(ToValidationErrors(validationResult));
        }

        var vehicle = await _vehicleRepository.GetByIdAsync(id, cancellationToken);
        if (vehicle is null)
        {
            return Result<VehicleDto>.Failure(NotFound);
        }

        vehicle.ChangeStatus(request.Status);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<VehicleDto>.Success(_mapper.Map<VehicleDto>(vehicle));
    }

    private static string NormalizePlateNumber(string plateNumber)
    {
        return plateNumber.Trim().ToUpperInvariant();
    }

    private static IReadOnlyList<Error> ToValidationErrors(FluentValidation.Results.ValidationResult validationResult)
    {
        return validationResult.Errors
            .Select(error => new Error($"Validation.{error.PropertyName}", error.ErrorMessage))
            .ToList();
    }
}
