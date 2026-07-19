using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.Trips.Dtos;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using AutoMapper;
using CarSharing.Application.Pricing.Services;
using FluentValidation;

namespace CarSharing.Application.Trips.Services;

public class TripService : ITripService
{
    private const long MaxPhotoSizeBytes = 15 * 1024 * 1024;

    private static readonly TripPhotoAngle[] RequiredPhotoAngles =
    [
        TripPhotoAngle.Front,
        TripPhotoAngle.Rear,
        TripPhotoAngle.Left,
        TripPhotoAngle.Right
    ];

    private static readonly Error Unauthenticated = new("Trip.Unauthenticated", "User must be authenticated.");
    private static readonly Error Forbidden = new("Trip.Forbidden", "User is not allowed to access this trip.");
    private static readonly Error TripNotFound = new("Trip.NotFound", "Trip was not found.");
    private static readonly Error ReservationNotFound = new("Trip.ReservationNotFound", "Reservation was not found.");
    private static readonly Error VehicleNotFound = new("Trip.VehicleNotFound", "Vehicle was not found.");
    private static readonly Error ReservationNotActive = new("Trip.ReservationNotActive", "Reservation must be active.");
    private static readonly Error ReservationExpired = new("Trip.ReservationExpired", "Reservation has expired.");
    private static readonly Error VehicleNotReserved = new("Trip.VehicleNotReserved", "Vehicle must be reserved before starting the trip.");
    private static readonly Error TripAlreadyStarted = new("Trip.AlreadyStarted", "A trip already exists for this reservation.");
    private static readonly Error TripNotActiveForCompletion = new("Trip.NotActiveForCompletion", "Trip is not ready for completion photos.");
    private static readonly Error CompletionRequestNotFound = new("TripCompletion.NotFound", "Trip completion request was not found.");
    private static readonly Error CompletionRequestNotPending = new("TripCompletion.NotPending", "Trip completion request must be pending review.");
    private static readonly Error CompletionRequestNotRejected = new("TripCompletion.NotRejected", "New photos can be submitted only after the previous request was rejected.");
    private static readonly Error StaffRequired = new("TripCompletion.StaffRequired", "Only staff, admin, or super admin can review completion requests.");
    private static readonly Error PromoCodeRequired = new("Trip.PromoCodeRequired", "Enter a promo code.");
    private static readonly Error PromoCodeNotFound = new("Trip.PromoCodeNotFound", "Promo code was not found.");
    private static readonly Error PromoAlreadyApplied = new("Trip.PromoAlreadyApplied", "A promo code is already applied to this trip.");
    private static readonly Error PromoRequiresAwaitingPayment = new("Trip.PromoRequiresAwaitingPayment", "Promo code can only be applied before payment.");

    private readonly ITripRepository _tripRepository;
    private readonly ITripCompletionRequestRepository _completionRequestRepository;
    private readonly IStaffKpiEventRepository _staffKpiEventRepository;
    private readonly IReservationRepository _reservationRepository;
    private readonly IVehicleRepository _vehicleRepository;
    private readonly ITripPhotoStorage _tripPhotoStorage;
    private readonly IDynamicPricingService _dynamicPricingService;
    private readonly ICurrentUserService _currentUserService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IValidator<StartTripRequest> _startTripValidator;
    private readonly IValidator<RejectTripCompletionRequest> _rejectValidator;
    private readonly IMapper _mapper;

    public TripService(
        ITripRepository tripRepository,
        ITripCompletionRequestRepository completionRequestRepository,
        IStaffKpiEventRepository staffKpiEventRepository,
        IReservationRepository reservationRepository,
        IVehicleRepository vehicleRepository,
        ITripPhotoStorage tripPhotoStorage,
        IDynamicPricingService dynamicPricingService,
        ICurrentUserService currentUserService,
        IUnitOfWork unitOfWork,
        IValidator<StartTripRequest> startTripValidator,
        IValidator<RejectTripCompletionRequest> rejectValidator,
        IMapper mapper)
    {
        _tripRepository = tripRepository;
        _completionRequestRepository = completionRequestRepository;
        _staffKpiEventRepository = staffKpiEventRepository;
        _reservationRepository = reservationRepository;
        _vehicleRepository = vehicleRepository;
        _tripPhotoStorage = tripPhotoStorage;
        _dynamicPricingService = dynamicPricingService;
        _currentUserService = currentUserService;
        _unitOfWork = unitOfWork;
        _startTripValidator = startTripValidator;
        _rejectValidator = rejectValidator;
        _mapper = mapper;
    }

    public async Task<Result<TripDto>> StartAsync(
        StartTripRequest request,
        CancellationToken cancellationToken = default)
    {
        var validationResult = await _startTripValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<TripDto>.Failure(ToValidationErrors(validationResult));
        }

        var userId = _currentUserService.UserId;
        if (userId is null)
        {
            return Result<TripDto>.Failure(Unauthenticated);
        }

        var reservation = await _reservationRepository.GetByIdAsync(request.ReservationId, cancellationToken);
        if (reservation is null)
        {
            return Result<TripDto>.Failure(ReservationNotFound);
        }

        if (reservation.UserId != userId.Value)
        {
            return Result<TripDto>.Failure(Forbidden);
        }

        if (reservation.Status != ReservationStatus.Active)
        {
            return Result<TripDto>.Failure(ReservationNotActive);
        }

        var now = DateTime.UtcNow;
        if (reservation.ExpiresAt <= now)
        {
            return Result<TripDto>.Failure(ReservationExpired);
        }

        var existingTrip = await _tripRepository.GetByReservationIdAsync(reservation.Id, cancellationToken);
        if (existingTrip is not null)
        {
            return Result<TripDto>.Failure(TripAlreadyStarted);
        }

        var vehicle = await _vehicleRepository.GetByIdAsync(reservation.VehicleId, cancellationToken);
        if (vehicle is null)
        {
            return Result<TripDto>.Failure(VehicleNotFound);
        }

        if (vehicle.Status != VehicleStatus.Reserved)
        {
            return Result<TripDto>.Failure(VehicleNotReserved);
        }

        var pricing = await _dynamicPricingService.CalculateAsync(vehicle, now, cancellationToken);
        var trip = Trip.StartFromReservation(
            reservation,
            vehicle,
            now,
            pricing.BasePricePerMinute,
            pricing.DemandMultiplier,
            pricing.ZoneMultiplier,
            pricing.BatteryMultiplier,
            pricing.FinalPricePerMinute);
        reservation.ConvertToTrip(now);
        vehicle.ChangeStatus(VehicleStatus.InUse);

        await _tripRepository.AddAsync(trip, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<TripDto>.Success(MapTrip(trip));
    }

    public async Task<Result<IReadOnlyList<TripDto>>> GetMyActiveAsync(CancellationToken cancellationToken = default)
    {
        var userId = _currentUserService.UserId;
        if (userId is null)
        {
            return Result<IReadOnlyList<TripDto>>.Failure(Unauthenticated);
        }

        var trips = await _tripRepository.GetActiveTripsByUserIdAsync(userId.Value, cancellationToken);
        var items = new List<TripDto>();
        foreach (var trip in trips)
        {
            var latestRequest = await _completionRequestRepository.GetLatestByTripIdAsync(trip.Id, cancellationToken);
            items.Add(MapTrip(trip, latestRequest));
        }

        return Result<IReadOnlyList<TripDto>>.Success(items);
    }

    public async Task<Result<TripDto>> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var trip = await _tripRepository.GetByIdAsync(id, cancellationToken);
        if (trip is null)
        {
            return Result<TripDto>.Failure(TripNotFound);
        }

        if (!CanAccessTrip(trip))
        {
            return Result<TripDto>.Failure(Forbidden);
        }

        var latestRequest = await _completionRequestRepository.GetLatestByTripIdAsync(trip.Id, cancellationToken);
        return Result<TripDto>.Success(MapTrip(trip, latestRequest));
    }

    public async Task<Result<TripDto>> ApplyPromoCodeAsync(
        Guid tripId,
        ApplyTripPromoCodeRequest request,
        CancellationToken cancellationToken = default)
    {
        var userId = _currentUserService.UserId;
        if (userId is null)
        {
            return Result<TripDto>.Failure(Unauthenticated);
        }

        var promoCode = request.PromoCode?.Trim();
        if (string.IsNullOrWhiteSpace(promoCode))
        {
            return Result<TripDto>.Failure(PromoCodeRequired);
        }

        var trip = await _tripRepository.GetByIdAsync(tripId, cancellationToken);
        if (trip is null)
        {
            return Result<TripDto>.Failure(TripNotFound);
        }

        if (trip.UserId != userId.Value)
        {
            return Result<TripDto>.Failure(Forbidden);
        }

        if (trip.Status != TripStatus.AwaitingPayment)
        {
            return Result<TripDto>.Failure(PromoRequiresAwaitingPayment);
        }

        if (!string.IsNullOrWhiteSpace(trip.PromoCode))
        {
            return Result<TripDto>.Failure(PromoAlreadyApplied);
        }

        var discountPercent = promoCode.ToLowerInvariant() switch
        {
            "farkhad" => 20,
            "electro10" => 10,
            "electrostreet10" => 10,
            "student10" => 10,
            _ => 0
        };

        if (discountPercent == 0)
        {
            return Result<TripDto>.Failure(PromoCodeNotFound);
        }

        trip.ApplyPromoCode(promoCode.ToLowerInvariant(), discountPercent);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var latestRequest = await _completionRequestRepository.GetLatestByTripIdAsync(trip.Id, cancellationToken);
        return Result<TripDto>.Success(MapTrip(trip, latestRequest));
    }

    public async Task<Result<TripCompletionRequestDto>> SubmitCompletionAsync(
        Guid tripId,
        IReadOnlyList<TripCompletionPhotoUpload> photos,
        CancellationToken cancellationToken = default)
    {
        var photoErrors = ValidatePhotos(photos);
        if (photoErrors.Count > 0)
        {
            return Result<TripCompletionRequestDto>.Failure(photoErrors);
        }

        var userId = _currentUserService.UserId;
        if (userId is null)
        {
            return Result<TripCompletionRequestDto>.Failure(Unauthenticated);
        }

        var trip = await _tripRepository.GetByIdAsync(tripId, cancellationToken);
        if (trip is null)
        {
            return Result<TripCompletionRequestDto>.Failure(TripNotFound);
        }

        if (trip.UserId != userId.Value)
        {
            return Result<TripCompletionRequestDto>.Failure(Forbidden);
        }

        var latestRequest = await _completionRequestRepository.GetLatestByTripIdAsync(trip.Id, cancellationToken);
        if (trip.Status == TripStatus.PendingCompletionReview
            && latestRequest?.Status != TripCompletionStatus.Rejected)
        {
            return Result<TripCompletionRequestDto>.Failure(CompletionRequestNotRejected);
        }

        if (trip.Status is not TripStatus.Active and not TripStatus.PendingCompletionReview)
        {
            return Result<TripCompletionRequestDto>.Failure(TripNotActiveForCompletion);
        }

        var now = DateTime.UtcNow;
        trip.RequestCompletion(now);

        var attemptNumber = (latestRequest?.AttemptNumber ?? 0) + 1;
        var completionRequest = TripCompletionRequest.Create(trip, attemptNumber, now);

        foreach (var photo in photos)
        {
            await using var content = photo.OpenReadStream();
            var fileUrl = await _tripPhotoStorage.SaveAsync(
                trip.Id,
                completionRequest.Id,
                photo.Angle,
                photo.FileName,
                photo.ContentType,
                content,
                cancellationToken);

            completionRequest.AddPhoto(photo.Angle, fileUrl, now);
        }

        await _completionRequestRepository.AddAsync(completionRequest, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<TripCompletionRequestDto>.Success(await MapCompletionRequestAsync(completionRequest, cancellationToken));
    }

    public async Task<Result<IReadOnlyList<TripCompletionRequestDto>>> GetPendingCompletionRequestsAsync(
        CancellationToken cancellationToken = default)
    {
        if (!CanReviewCompletionRequests())
        {
            return Result<IReadOnlyList<TripCompletionRequestDto>>.Failure(StaffRequired);
        }

        var requests = await _completionRequestRepository.GetPendingReviewAsync(cancellationToken);
        var items = new List<TripCompletionRequestDto>();
        foreach (var request in requests)
        {
            items.Add(await MapCompletionRequestAsync(request, cancellationToken));
        }

        return Result<IReadOnlyList<TripCompletionRequestDto>>.Success(items);
    }

    public async Task<Result<IReadOnlyList<TripCompletionRequestDto>>> GetMyReviewedCompletionRequestsAsync(
        int take = 50,
        CancellationToken cancellationToken = default)
    {
        var reviewerId = _currentUserService.UserId;
        if (reviewerId is null)
        {
            return Result<IReadOnlyList<TripCompletionRequestDto>>.Failure(Unauthenticated);
        }

        if (!CanReviewCompletionRequests())
        {
            return Result<IReadOnlyList<TripCompletionRequestDto>>.Failure(StaffRequired);
        }

        var requests = await _completionRequestRepository.GetReviewedByUserIdAsync(
            reviewerId.Value,
            Math.Clamp(take, 1, 100),
            cancellationToken);

        var items = new List<TripCompletionRequestDto>();
        foreach (var request in requests)
        {
            items.Add(await MapCompletionRequestAsync(request, cancellationToken));
        }

        return Result<IReadOnlyList<TripCompletionRequestDto>>.Success(items);
    }

    public async Task<Result<TripCompletionRequestDto>> GetCompletionRequestByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var request = await _completionRequestRepository.GetByIdAsync(id, cancellationToken);
        if (request is null)
        {
            return Result<TripCompletionRequestDto>.Failure(CompletionRequestNotFound);
        }

        if (!CanAccessCompletionRequest(request))
        {
            return Result<TripCompletionRequestDto>.Failure(Forbidden);
        }

        return Result<TripCompletionRequestDto>.Success(await MapCompletionRequestAsync(request, cancellationToken));
    }

    public async Task<Result<TripCompletionRequestDto>> ApproveCompletionRequestAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var reviewerId = _currentUserService.UserId;
        if (reviewerId is null)
        {
            return Result<TripCompletionRequestDto>.Failure(Unauthenticated);
        }

        if (!CanReviewCompletionRequests())
        {
            return Result<TripCompletionRequestDto>.Failure(StaffRequired);
        }

        var request = await _completionRequestRepository.GetByIdAsync(id, cancellationToken);
        if (request is null)
        {
            return Result<TripCompletionRequestDto>.Failure(CompletionRequestNotFound);
        }

        if (request.Status != TripCompletionStatus.PendingReview)
        {
            return Result<TripCompletionRequestDto>.Failure(CompletionRequestNotPending);
        }

        var trip = await _tripRepository.GetByIdAsync(request.TripId, cancellationToken);
        if (trip is null)
        {
            return Result<TripCompletionRequestDto>.Failure(TripNotFound);
        }

        var now = DateTime.UtcNow;
        request.AssignTo(reviewerId.Value);
        request.Approve(reviewerId.Value, now);
        trip.MarkAwaitingPayment();
        if (_currentUserService.Role == UserRole.Staff)
        {
            await _staffKpiEventRepository.AddAsync(
                StaffKpiEvent.Create(
                    reviewerId.Value,
                    StaffKpiEventType.TripPhotoApproved,
                    StaffTaskType.PhotoVerification,
                    request.Id,
                    "Trip completion photo review",
                    $"Approved completion photos for trip {trip.Id}.",
                    now,
                    request.RequestedAt,
                    now),
                cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<TripCompletionRequestDto>.Success(await MapCompletionRequestAsync(request, cancellationToken));
    }

    public async Task<Result<TripCompletionRequestDto>> RejectCompletionRequestAsync(
        Guid id,
        RejectTripCompletionRequest request,
        CancellationToken cancellationToken = default)
    {
        var validationResult = await _rejectValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<TripCompletionRequestDto>.Failure(ToValidationErrors(validationResult));
        }

        var reviewerId = _currentUserService.UserId;
        if (reviewerId is null)
        {
            return Result<TripCompletionRequestDto>.Failure(Unauthenticated);
        }

        if (!CanReviewCompletionRequests())
        {
            return Result<TripCompletionRequestDto>.Failure(StaffRequired);
        }

        var completionRequest = await _completionRequestRepository.GetByIdAsync(id, cancellationToken);
        if (completionRequest is null)
        {
            return Result<TripCompletionRequestDto>.Failure(CompletionRequestNotFound);
        }

        if (completionRequest.Status != TripCompletionStatus.PendingReview)
        {
            return Result<TripCompletionRequestDto>.Failure(CompletionRequestNotPending);
        }

        var now = DateTime.UtcNow;
        completionRequest.AssignTo(reviewerId.Value);
        completionRequest.Reject(reviewerId.Value, now, request.Reason);
        if (_currentUserService.Role == UserRole.Staff)
        {
            await _staffKpiEventRepository.AddAsync(
                StaffKpiEvent.Create(
                    reviewerId.Value,
                    StaffKpiEventType.TripPhotoRejected,
                    StaffTaskType.PhotoVerification,
                    completionRequest.Id,
                    "Trip completion photo review",
                    request.Reason,
                    now,
                    completionRequest.RequestedAt,
                    now),
                cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<TripCompletionRequestDto>.Success(await MapCompletionRequestAsync(completionRequest, cancellationToken));
    }

    private bool CanAccessTrip(Trip trip)
    {
        if (_currentUserService.UserId == trip.UserId)
        {
            return true;
        }

        return CanReviewCompletionRequests();
    }

    private bool CanAccessCompletionRequest(TripCompletionRequest request)
    {
        if (_currentUserService.UserId == request.UserId)
        {
            return true;
        }

        return CanReviewCompletionRequests();
    }

    private bool CanReviewCompletionRequests()
    {
        return _currentUserService.Role is UserRole.Staff or UserRole.Admin or UserRole.SuperAdmin;
    }

    private static IReadOnlyList<Error> ValidatePhotos(IReadOnlyList<TripCompletionPhotoUpload> photos)
    {
        var errors = new List<Error>();

        foreach (var angle in RequiredPhotoAngles)
        {
            var matches = photos.Where(photo => photo.Angle == angle).ToList();
            if (matches.Count == 0)
            {
                errors.Add(new Error($"Validation.{angle}Photo", $"{angle} photo is required."));
            }
            else if (matches.Count > 1)
            {
                errors.Add(new Error($"Validation.{angle}Photo", $"{angle} photo can be uploaded only once."));
            }
        }

        foreach (var photo in photos)
        {
            if (!RequiredPhotoAngles.Contains(photo.Angle))
            {
                errors.Add(new Error("Validation.PhotoAngle", "Unsupported trip photo angle."));
            }

            if (photo.Length <= 0)
            {
                errors.Add(new Error($"Validation.{photo.Angle}Photo", $"{photo.Angle} photo is empty."));
            }

            if (photo.Length > MaxPhotoSizeBytes)
            {
                errors.Add(new Error($"Validation.{photo.Angle}Photo", $"{photo.Angle} photo must be 15 MB or smaller."));
            }

            if (!photo.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            {
                errors.Add(new Error($"Validation.{photo.Angle}Photo", $"{photo.Angle} photo must be an image."));
            }
        }

        return errors;
    }

    private TripDto MapTrip(Trip trip, TripCompletionRequest? latestCompletionRequest = null)
    {
        var dto = _mapper.Map<TripDto>(trip);
        dto.LatestCompletionRequest = latestCompletionRequest is null
            ? null
            : _mapper.Map<TripCompletionRequestDto>(latestCompletionRequest);
        if (dto.LatestCompletionRequest is not null)
        {
            dto.LatestCompletionRequest.BaseRideCost = trip.BasePrice;
            dto.LatestCompletionRequest.DiscountPercent = trip.DiscountPercent;
            dto.LatestCompletionRequest.DiscountAmount = trip.DiscountAmount;
            dto.LatestCompletionRequest.FinalRideCost = trip.TotalPrice;
            dto.LatestCompletionRequest.PromoCode = trip.PromoCode;
        }

        return dto;
    }

    private async Task<TripCompletionRequestDto> MapCompletionRequestAsync(
        TripCompletionRequest request,
        CancellationToken cancellationToken)
    {
        var dto = _mapper.Map<TripCompletionRequestDto>(request);
        var trip = await _tripRepository.GetByIdAsync(request.TripId, cancellationToken);
        if (trip is not null)
        {
            dto.BaseRideCost = trip.BasePrice;
            dto.DurationMinutes = trip.DurationMinutes;
            dto.DiscountPercent = trip.DiscountPercent;
            dto.DiscountAmount = trip.DiscountAmount;
            dto.FinalRideCost = trip.TotalPrice;
            dto.PromoCode = trip.PromoCode;
        }

        return dto;
    }

    private static IReadOnlyList<Error> ToValidationErrors(FluentValidation.Results.ValidationResult validationResult)
    {
        return validationResult.Errors
            .Select(error => new Error($"Validation.{error.PropertyName}", error.ErrorMessage))
            .ToList();
    }
}
