using AutoMapper;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.Vehicles.Dtos;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using FluentValidation;

namespace CarSharing.Application.Vehicles.Services;

public class VehicleService : IVehicleService
{
    private const int ChargingPercentPerMinute = 10;
    private static readonly Error NotFound = new("Vehicle.NotFound", "Vehicle was not found.");
    private static readonly Error PlateNumberNotUnique = new("Vehicle.PlateNumberNotUnique", "Vehicle with this plate number already exists.");
    private static readonly Error CannotChargeInUseVehicle = new("Vehicle.CannotChargeInUse", "Vehicle cannot be sent to charging while it is in use or reserved.");

    private readonly IVehicleRepository _vehicleRepository;
    private readonly IChargingSessionRepository _chargingSessionRepository;
    private readonly IStaffTaskRepository _staffTaskRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly IValidator<CreateVehicleRequest> _createVehicleValidator;
    private readonly IValidator<UpdateVehicleRequest> _updateVehicleValidator;
    private readonly IValidator<UpdateVehicleStatusRequest> _updateVehicleStatusValidator;

    public VehicleService(
        IVehicleRepository vehicleRepository,
        IChargingSessionRepository chargingSessionRepository,
        IStaffTaskRepository staffTaskRepository,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        IValidator<CreateVehicleRequest> createVehicleValidator,
        IValidator<UpdateVehicleRequest> updateVehicleValidator,
        IValidator<UpdateVehicleStatusRequest> updateVehicleStatusValidator)
    {
        _vehicleRepository = vehicleRepository;
        _chargingSessionRepository = chargingSessionRepository;
        _staffTaskRepository = staffTaskRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _createVehicleValidator = createVehicleValidator;
        _updateVehicleValidator = updateVehicleValidator;
        _updateVehicleStatusValidator = updateVehicleStatusValidator;
    }

    public async Task<Result<IReadOnlyList<VehicleDto>>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var vehicles = await _vehicleRepository.GetAllAsync(cancellationToken);
        var activeSessions = await _chargingSessionRepository.GetActiveAsync(cancellationToken);
        var activeSessionsByVehicleId = new Dictionary<Guid, (ChargingSession Session, StaffTask? Task)>();
        foreach (var session in activeSessions)
        {
            activeSessionsByVehicleId[session.VehicleId] = (
                session,
                await _staffTaskRepository.GetByIdAsync(session.StaffTaskId, cancellationToken));
        }

        var vehicleDtos = vehicles
            .Select(vehicle => MapVehicleWithChargingProgress(
                vehicle,
                activeSessionsByVehicleId.GetValueOrDefault(vehicle.Id).Session,
                activeSessionsByVehicleId.GetValueOrDefault(vehicle.Id).Task))
            .ToList();

        return Result<IReadOnlyList<VehicleDto>>.Success(vehicleDtos);
    }

    public async Task<Result<VehicleDto>> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var vehicle = await _vehicleRepository.GetByIdAsync(id, cancellationToken);
        if (vehicle is null)
        {
            return Result<VehicleDto>.Failure(NotFound);
        }

        var activeSession = await _chargingSessionRepository.GetActiveByVehicleIdAsync(id, cancellationToken);
        var activeTask = activeSession is null
            ? null
            : await _staffTaskRepository.GetByIdAsync(activeSession.StaffTaskId, cancellationToken);
        return Result<VehicleDto>.Success(MapVehicleWithChargingProgress(vehicle, activeSession, activeTask));
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

        if (request.Status == VehicleStatus.Charging && vehicle.Status is VehicleStatus.InUse or VehicleStatus.Reserved)
        {
            return Result<VehicleDto>.Failure(CannotChargeInUseVehicle);
        }

        vehicle.ChangeStatus(request.Status);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<VehicleDto>.Success(_mapper.Map<VehicleDto>(vehicle));
    }

    private static string NormalizePlateNumber(string plateNumber)
    {
        return plateNumber.Trim().ToUpperInvariant();
    }

    private VehicleDto MapVehicleWithChargingProgress(Vehicle vehicle, ChargingSession? activeSession, StaffTask? activeTask)
    {
        var dto = _mapper.Map<VehicleDto>(vehicle);
        if (activeSession is null)
        {
            return dto;
        }

        if (activeTask?.Status != StaffTaskStatus.InProgress)
        {
            dto.BatteryPercent = activeSession.StartBatteryPercent;
            return dto;
        }

        var elapsedMinutes = Math.Max(0, (DateTime.UtcNow - activeTask.UpdatedAt).TotalMinutes);
        dto.BatteryPercent = Math.Min(
            activeSession.TargetBatteryPercent,
            (int)Math.Round(activeSession.StartBatteryPercent + elapsedMinutes * ChargingPercentPerMinute));
        return dto;
    }

    private static IReadOnlyList<Error> ToValidationErrors(FluentValidation.Results.ValidationResult validationResult)
    {
        return validationResult.Errors
            .Select(error => new Error($"Validation.{error.PropertyName}", error.ErrorMessage))
            .ToList();
    }
}
