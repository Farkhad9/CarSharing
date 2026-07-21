using AutoMapper;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.Vehicles.Dtos;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using CarSharing.Application.Pricing.Services;
using FluentValidation;

namespace CarSharing.Application.Vehicles.Services;

public class VehicleService : IVehicleService
{
    private const int ChargingPercentPerMinute = 10;
    private const int RangeKmPerBatteryPercent = 4;
    private static readonly Error NotFound = new("Vehicle.NotFound", "Vehicle was not found.");
    private static readonly Error PlateNumberNotUnique = new("Vehicle.PlateNumberNotUnique", "Vehicle with this plate number already exists.");
    private static readonly Error CannotChargeInUseVehicle = new("Vehicle.CannotChargeInUse", "Vehicle cannot be sent to charging while it is in use or reserved.");
    private static readonly Error SuperAdminRequired = new("Vehicle.SuperAdminRequired", "Super admin access is required.");

    private readonly IVehicleRepository _vehicleRepository;
    private readonly IChargingSessionRepository _chargingSessionRepository;
    private readonly IStaffTaskRepository _staffTaskRepository;
    private readonly ITripRepository _tripRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUser;
    private readonly IDynamicPricingService _dynamicPricingService;
    private readonly IMapper _mapper;
    private readonly IValidator<CreateVehicleRequest> _createVehicleValidator;
    private readonly IValidator<UpdateVehicleRequest> _updateVehicleValidator;
    private readonly IValidator<UpdateVehicleStatusRequest> _updateVehicleStatusValidator;

    public VehicleService(
        IVehicleRepository vehicleRepository,
        IChargingSessionRepository chargingSessionRepository,
        IStaffTaskRepository staffTaskRepository,
        ITripRepository tripRepository,
        IUnitOfWork unitOfWork,
        ICurrentUserService currentUser,
        IDynamicPricingService dynamicPricingService,
        IMapper mapper,
        IValidator<CreateVehicleRequest> createVehicleValidator,
        IValidator<UpdateVehicleRequest> updateVehicleValidator,
        IValidator<UpdateVehicleStatusRequest> updateVehicleStatusValidator)
    {
        _vehicleRepository = vehicleRepository;
        _chargingSessionRepository = chargingSessionRepository;
        _staffTaskRepository = staffTaskRepository;
        _tripRepository = tripRepository;
        _unitOfWork = unitOfWork;
        _currentUser = currentUser;
        _dynamicPricingService = dynamicPricingService;
        _mapper = mapper;
        _createVehicleValidator = createVehicleValidator;
        _updateVehicleValidator = updateVehicleValidator;
        _updateVehicleStatusValidator = updateVehicleStatusValidator;
    }

    public async Task<Result<IReadOnlyList<VehicleDto>>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var vehicles = await _vehicleRepository.GetAllAsync(cancellationToken);
        var activeSessions = await _chargingSessionRepository.GetActiveAsync(cancellationToken);
        var openTripsByVehicleId = (await _tripRepository.GetOpenTripsAsync(cancellationToken))
            .GroupBy(trip => trip.VehicleId)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(trip => trip.StartedAt).First());
        var activeSessionsByVehicleId = new Dictionary<Guid, (ChargingSession Session, StaffTask? Task)>();
        foreach (var session in activeSessions)
        {
            activeSessionsByVehicleId[session.VehicleId] = (
                session,
                await _staffTaskRepository.GetByIdAsync(session.StaffTaskId, cancellationToken));
        }

        var vehicleDtos = new List<VehicleDto>();
        foreach (var vehicle in vehicles)
        {
            vehicleDtos.Add(await MapVehicleAsync(
                vehicle,
                activeSessionsByVehicleId.GetValueOrDefault(vehicle.Id).Session,
                activeSessionsByVehicleId.GetValueOrDefault(vehicle.Id).Task,
                openTripsByVehicleId.GetValueOrDefault(vehicle.Id),
                cancellationToken));
        }

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
        var openTrip = (await _tripRepository.GetOpenTripsAsync(cancellationToken))
            .Where(trip => trip.VehicleId == vehicle.Id)
            .OrderByDescending(trip => trip.StartedAt)
            .FirstOrDefault();
        return Result<VehicleDto>.Success(await MapVehicleAsync(vehicle, activeSession, activeTask, openTrip, cancellationToken));
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

        return Result<VehicleDto>.Success(await MapVehicleAsync(vehicle, cancellationToken: cancellationToken));
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
        vehicle.ChangeStatus(request.Status == default ? VehicleStatus.Available : request.Status);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<VehicleDto>.Success(await MapVehicleAsync(vehicle, cancellationToken: cancellationToken));
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

        return Result<VehicleDto>.Success(await MapVehicleAsync(vehicle, cancellationToken: cancellationToken));
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

        if (_currentUser.Role != UserRole.SuperAdmin && request.Status != VehicleStatus.Charging)
        {
            return Result<VehicleDto>.Failure(SuperAdminRequired);
        }

        vehicle.ChangeStatus(request.Status);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<VehicleDto>.Success(await MapVehicleAsync(vehicle, cancellationToken: cancellationToken));
    }

    private static string NormalizePlateNumber(string plateNumber)
    {
        return plateNumber.Trim().ToUpperInvariant();
    }

    private async Task<VehicleDto> MapVehicleAsync(
        Vehicle vehicle,
        ChargingSession? activeSession = null,
        StaffTask? activeTask = null,
        Trip? openTrip = null,
        CancellationToken cancellationToken = default)
    {
        var dto = _mapper.Map<VehicleDto>(vehicle);
        if (activeSession is not null)
        {
            if (activeTask?.Status != StaffTaskStatus.InProgress)
            {
                dto.BatteryPercent = activeSession.StartBatteryPercent;
            }
            else
            {
                var elapsedMinutes = Math.Max(0, (DateTime.UtcNow - activeTask.UpdatedAt).TotalMinutes);
                dto.BatteryPercent = Math.Min(
                    activeSession.TargetBatteryPercent,
                    (int)Math.Round(activeSession.StartBatteryPercent + elapsedMinutes * ChargingPercentPerMinute));
            }
        }
        else if (openTrip is not null && ShouldApplyOpenTripBattery(vehicle))
        {
            dto.BatteryPercent = openTrip.CalculateBatteryPercentAfterRide(openTrip.StartBatteryPercent, DateTime.UtcNow);
        }

        dto.RangeKm = dto.BatteryPercent * RangeKmPerBatteryPercent;

        var pricing = await _dynamicPricingService.CalculateAsync(vehicle, DateTime.UtcNow, cancellationToken);
        dto.ActivePricePerMinute = pricing.FinalPricePerMinute;
        dto.DemandMultiplier = pricing.DemandMultiplier;
        dto.ZoneMultiplier = pricing.ZoneMultiplier;
        dto.BatteryMultiplier = pricing.BatteryMultiplier;
        dto.PricingAdjustmentAmount = pricing.ManualAdjustmentAmount;
        dto.PricingMode = pricing.PricingMode;
        return dto;
    }

    private static bool ShouldApplyOpenTripBattery(Vehicle vehicle)
    {
        return vehicle.Status == VehicleStatus.InUse;
    }

    private static IReadOnlyList<Error> ToValidationErrors(FluentValidation.Results.ValidationResult validationResult)
    {
        return validationResult.Errors
            .Select(error => new Error($"Validation.{error.PropertyName}", error.ErrorMessage))
            .ToList();
    }
}
