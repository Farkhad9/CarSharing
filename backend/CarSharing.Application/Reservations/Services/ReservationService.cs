using AutoMapper;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.Reservations.Dtos;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using FluentValidation;

namespace CarSharing.Application.Reservations.Services;

public class ReservationService : IReservationService
{
    private const int ReservationDurationMinutes = 15;
    private const int MaxActiveReservationsPerUser = 2;

    private static readonly Error Unauthenticated = new("Reservation.Unauthenticated", "User must be authenticated.");
    private static readonly Error NotFound = new("Reservation.NotFound", "Reservation was not found.");
    private static readonly Error VehicleNotFound = new("Reservation.VehicleNotFound", "Vehicle was not found.");
    private static readonly Error VehicleNotAvailable = new("Reservation.VehicleNotAvailable", "Vehicle is not available for reservation.");
    private static readonly Error TooManyActiveReservations = new("Reservation.TooManyActiveReservations", "User can have up to 2 active reservations.");
    private static readonly Error PassengerCapacityExceeded = new("Reservation.PassengerCapacityExceeded", "Passenger count exceeds vehicle seat capacity.");
    private static readonly Error Forbidden = new("Reservation.Forbidden", "User is not allowed to access this reservation.");
    private static readonly Error CannotCancel = new("Reservation.CannotCancel", "Only active reservations can be cancelled.");

    private readonly IReservationRepository _reservationRepository;
    private readonly IVehicleRepository _vehicleRepository;
    private readonly ICurrentUserService _currentUserService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly IValidator<CreateReservationRequest> _createReservationValidator;
    private readonly IValidator<CancelReservationRequest> _cancelReservationValidator;

    public ReservationService(
        IReservationRepository reservationRepository,
        IVehicleRepository vehicleRepository,
        ICurrentUserService currentUserService,
        IUnitOfWork unitOfWork,
        IMapper mapper,
        IValidator<CreateReservationRequest> createReservationValidator,
        IValidator<CancelReservationRequest> cancelReservationValidator)
    {
        _reservationRepository = reservationRepository;
        _vehicleRepository = vehicleRepository;
        _currentUserService = currentUserService;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _createReservationValidator = createReservationValidator;
        _cancelReservationValidator = cancelReservationValidator;
    }

    public async Task<Result<ReservationDto>> CreateAsync(
        CreateReservationRequest request,
        CancellationToken cancellationToken = default)
    {
        var validationResult = await _createReservationValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<ReservationDto>.Failure(ToValidationErrors(validationResult));
        }

        var userId = _currentUserService.UserId;
        if (userId is null)
        {
            return Result<ReservationDto>.Failure(Unauthenticated);
        }

        var vehicle = await _vehicleRepository.GetByIdAsync(request.VehicleId, cancellationToken);
        if (vehicle is null)
        {
            return Result<ReservationDto>.Failure(VehicleNotFound);
        }

        if (vehicle.Status != VehicleStatus.Available)
        {
            return Result<ReservationDto>.Failure(VehicleNotAvailable);
        }

        if (request.PassengerCount > vehicle.Seats)
        {
            return Result<ReservationDto>.Failure(PassengerCapacityExceeded);
        }

        var activeReservationCount = await _reservationRepository.CountActiveByUserIdAsync(userId.Value, cancellationToken);
        if (activeReservationCount >= MaxActiveReservationsPerUser)
        {
            return Result<ReservationDto>.Failure(TooManyActiveReservations);
        }

        var now = DateTime.UtcNow;
        var reservation = Reservation.Create(
            userId.Value,
            vehicle.Id,
            now,
            now.AddMinutes(ReservationDurationMinutes));

        vehicle.ChangeStatus(VehicleStatus.Reserved);

        await _reservationRepository.AddAsync(reservation, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ReservationDto>.Success(_mapper.Map<ReservationDto>(reservation));
    }

    public async Task<Result<IReadOnlyList<ReservationDto>>> GetMyActiveAsync(CancellationToken cancellationToken = default)
    {
        var userId = _currentUserService.UserId;
        if (userId is null)
        {
            return Result<IReadOnlyList<ReservationDto>>.Failure(Unauthenticated);
        }

        var reservations = await _reservationRepository.GetActiveByUserIdAsync(userId.Value, cancellationToken);
        return Result<IReadOnlyList<ReservationDto>>.Success(_mapper.Map<IReadOnlyList<ReservationDto>>(reservations));
    }

    public async Task<Result<ReservationDto>> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var reservation = await _reservationRepository.GetByIdAsync(id, cancellationToken);
        if (reservation is null)
        {
            return Result<ReservationDto>.Failure(NotFound);
        }

        if (!CanAccess(reservation))
        {
            return Result<ReservationDto>.Failure(Forbidden);
        }

        return Result<ReservationDto>.Success(_mapper.Map<ReservationDto>(reservation));
    }

    public async Task<Result<ReservationDto>> CancelAsync(
        Guid id,
        CancelReservationRequest request,
        CancellationToken cancellationToken = default)
    {
        var validationResult = await _cancelReservationValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<ReservationDto>.Failure(ToValidationErrors(validationResult));
        }

        var reservation = await _reservationRepository.GetByIdAsync(id, cancellationToken);
        if (reservation is null)
        {
            return Result<ReservationDto>.Failure(NotFound);
        }

        if (!CanAccess(reservation))
        {
            return Result<ReservationDto>.Failure(Forbidden);
        }

        if (reservation.Status != ReservationStatus.Active)
        {
            return Result<ReservationDto>.Failure(CannotCancel);
        }

        var vehicle = await _vehicleRepository.GetByIdAsync(reservation.VehicleId, cancellationToken);
        if (vehicle is null)
        {
            return Result<ReservationDto>.Failure(VehicleNotFound);
        }

        reservation.Cancel(DateTime.UtcNow, request.Reason);

        if (vehicle.Status == VehicleStatus.Reserved)
        {
            vehicle.ChangeStatus(VehicleStatus.Available);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<ReservationDto>.Success(_mapper.Map<ReservationDto>(reservation));
    }

    public async Task<Result<int>> ExpireActiveReservationsAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var reservations = await _reservationRepository.GetExpiredActiveAsync(now, cancellationToken);

        foreach (var reservation in reservations)
        {
            reservation.Expire(now);

            var vehicle = await _vehicleRepository.GetByIdAsync(reservation.VehicleId, cancellationToken);
            if (vehicle?.Status == VehicleStatus.Reserved)
            {
                vehicle.ChangeStatus(VehicleStatus.Available);
            }
        }

        if (reservations.Count > 0)
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return Result<int>.Success(reservations.Count);
    }

    private bool CanAccess(Reservation reservation)
    {
        if (_currentUserService.UserId == reservation.UserId)
        {
            return true;
        }

        return _currentUserService.Role is UserRole.Admin or UserRole.SuperAdmin or UserRole.Staff or UserRole.Employee;
    }

    private static IReadOnlyList<Error> ToValidationErrors(FluentValidation.Results.ValidationResult validationResult)
    {
        return validationResult.Errors
            .Select(error => new Error($"Validation.{error.PropertyName}", error.ErrorMessage))
            .ToList();
    }
}
