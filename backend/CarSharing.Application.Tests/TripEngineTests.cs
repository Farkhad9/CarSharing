using AutoMapper;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Trips.Dtos;
using CarSharing.Application.Trips.Mapping;
using CarSharing.Application.Trips.Services;
using CarSharing.Application.Trips.Validators;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CarSharing.Application.Tests;

public class TripEngineTests
{
    [Fact]
    public async Task StartAsync_creates_trip_and_marks_reservation_and_vehicle()
    {
        var userId = Guid.NewGuid();
        var reservation = CreateReservation(userId);
        var vehicle = CreateVehicle(reservation.VehicleId);
        var tripRepository = new FakeTripRepository();
        var unitOfWork = new FakeUnitOfWork();
        var service = CreateService(
            userId,
            reservation,
            vehicle,
            tripRepository: tripRepository,
            unitOfWork: unitOfWork);

        var result = await service.StartAsync(
            new StartTripRequest { ReservationId = reservation.Id });

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal(ReservationStatus.ConvertedToTrip, reservation.Status);
        Assert.Equal(VehicleStatus.InUse, vehicle.Status);
        Assert.Single(tripRepository.Trips);
        Assert.Equal(1, unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task SubmitCompletionAsync_fixes_price_and_time_on_first_attempt()
    {
        var userId = Guid.NewGuid();
        var reservation = CreateReservation(userId);
        var vehicle = CreateVehicle(reservation.VehicleId);
        var trip = Trip.StartFromReservation(
            reservation,
            vehicle,
            DateTime.UtcNow.AddMinutes(-10));
        var completionRepository = new FakeCompletionRequestRepository();
        var service = CreateService(
            userId,
            reservation,
            vehicle,
            trip,
            completionRepository: completionRepository);

        var firstResult = await service.SubmitCompletionAsync(
            trip.Id,
            CreatePhotos());

        Assert.True(firstResult.IsSuccess);
        Assert.Equal(1, firstResult.Value!.AttemptNumber);
        Assert.Equal(4, firstResult.Value.Photos.Count);
        Assert.NotNull(trip.EndRequestedAt);
        var firstRequestedAt = trip.EndRequestedAt;
        var firstPrice = trip.TotalPrice;

        var rejectedRequest = completionRepository.Requests.Single();
        rejectedRequest.Reject(
            Guid.NewGuid(),
            DateTime.UtcNow,
            "Photo is unclear");

        var secondResult = await service.SubmitCompletionAsync(
            trip.Id,
            CreatePhotos());

        Assert.True(secondResult.IsSuccess);
        Assert.Equal(2, secondResult.Value!.AttemptNumber);
        Assert.Equal(firstRequestedAt, trip.EndRequestedAt);
        Assert.Equal(firstPrice, trip.TotalPrice);
    }

    [Fact]
    public async Task SubmitCompletionAsync_rejects_duplicate_or_missing_photo_angles()
    {
        var userId = Guid.NewGuid();
        var reservation = CreateReservation(userId);
        var vehicle = CreateVehicle(reservation.VehicleId);
        var trip = Trip.StartFromReservation(
            reservation,
            vehicle,
            DateTime.UtcNow.AddMinutes(-5));
        var service = CreateService(userId, reservation, vehicle, trip);
        var photos = CreatePhotos().ToList();
        photos.RemoveAt(3);
        photos.Add(photos[0]);

        var result = await service.SubmitCompletionAsync(
            trip.Id,
            photos);

        Assert.True(result.IsFailure);
        Assert.Contains(result.Errors, error =>
            error.Code == "Validation.RightPhoto");
        Assert.Contains(result.Errors, error =>
            error.Code == "Validation.FrontPhoto");
    }

    [Fact]
    public async Task ApproveCompletionRequestAsync_moves_trip_to_awaiting_payment()
    {
        var clientId = Guid.NewGuid();
        var staffId = Guid.NewGuid();
        var reservation = CreateReservation(clientId);
        var vehicle = CreateVehicle(reservation.VehicleId);
        var trip = Trip.StartFromReservation(
            reservation,
            vehicle,
            DateTime.UtcNow.AddMinutes(-5));
        vehicle.ChangeStatus(VehicleStatus.InUse);
        trip.RequestCompletion(DateTime.UtcNow);
        var completionRequest = TripCompletionRequest.Create(
            trip,
            1,
            DateTime.UtcNow);
        var completionRepository = new FakeCompletionRequestRepository();
        completionRepository.Requests.Add(completionRequest);
        var service = CreateService(
            staffId,
            reservation,
            vehicle,
            trip,
            completionRepository: completionRepository,
            role: UserRole.Staff);

        var result = await service.ApproveCompletionRequestAsync(
            completionRequest.Id);

        Assert.True(result.IsSuccess);
        Assert.Equal(TripCompletionStatus.Approved, completionRequest.Status);
        Assert.Equal(TripStatus.AwaitingPayment, trip.Status);
        Assert.Equal(VehicleStatus.InUse, vehicle.Status);
    }

    private static TripService CreateService(
        Guid userId,
        Reservation reservation,
        Vehicle vehicle,
        Trip? trip = null,
        FakeTripRepository? tripRepository = null,
        FakeCompletionRequestRepository? completionRepository = null,
        FakeUnitOfWork? unitOfWork = null,
        UserRole role = UserRole.Rider)
    {
        tripRepository ??= new FakeTripRepository();
        if (trip is not null)
        {
            tripRepository.Trips.Add(trip);
        }

        completionRepository ??= new FakeCompletionRequestRepository();
        unitOfWork ??= new FakeUnitOfWork();
        var mapper = new MapperConfiguration(
            configuration => configuration.AddProfile<TripMappingProfile>(),
            NullLoggerFactory.Instance)
            .CreateMapper();

        return new TripService(
            tripRepository,
            completionRepository,
            new FakeReservationRepository(reservation),
            new FakeVehicleRepository(vehicle),
            new FakePhotoStorage(),
            new FakeCurrentUserService(userId, role),
            unitOfWork,
            new StartTripRequestValidator(),
            new RejectTripCompletionRequestValidator(),
            mapper);
    }

    private static Reservation CreateReservation(Guid userId)
    {
        return Reservation.Create(
            userId,
            Guid.NewGuid(),
            DateTime.UtcNow.AddMinutes(-1),
            DateTime.UtcNow.AddMinutes(30),
            currency: "AZN");
    }

    private static Vehicle CreateVehicle(Guid vehicleId)
    {
        var vehicle = Vehicle.Create(
            "Tesla",
            "Model 3",
            2024,
            "10-AA-001",
            100,
            80,
            300,
            0.5m,
            "AZN",
            5,
            "White",
            "Type 2",
            null,
            "Baku",
            "Center",
            40.4,
            49.8);

        typeof(BaseEntity).GetProperty(nameof(BaseEntity.Id))!
            .SetValue(vehicle, vehicleId);
        vehicle.ChangeStatus(VehicleStatus.Reserved);
        return vehicle;
    }

    private static IReadOnlyList<TripCompletionPhotoUpload> CreatePhotos()
    {
        return new[]
        {
            CreatePhoto(TripPhotoAngle.Front),
            CreatePhoto(TripPhotoAngle.Rear),
            CreatePhoto(TripPhotoAngle.Left),
            CreatePhoto(TripPhotoAngle.Right)
        };
    }

    private static TripCompletionPhotoUpload CreatePhoto(TripPhotoAngle angle)
    {
        return new TripCompletionPhotoUpload(
            angle,
            $"{angle}.jpg",
            "image/jpeg",
            100,
            () => new MemoryStream(new byte[] { 1, 2, 3 }));
    }

    private sealed class FakeTripRepository : ITripRepository
    {
        public List<Trip> Trips { get; } = [];

        public Task<Trip?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Trips.SingleOrDefault(trip => trip.Id == id));

        public Task<Trip?> GetActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.FromResult(Trips.LastOrDefault(trip => trip.UserId == userId));

        public Task<Trip?> GetByReservationIdAsync(Guid reservationId, CancellationToken cancellationToken = default) =>
            Task.FromResult(Trips.SingleOrDefault(trip => trip.ReservationId == reservationId));

        public Task AddAsync(Trip trip, CancellationToken cancellationToken = default)
        {
            Trips.Add(trip);
            return Task.CompletedTask;
        }
    }

    private sealed class FakeCompletionRequestRepository : ITripCompletionRequestRepository
    {
        public List<TripCompletionRequest> Requests { get; } = [];

        public Task<TripCompletionRequest?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Requests.SingleOrDefault(request => request.Id == id));

        public Task<TripCompletionRequest?> GetLatestByTripIdAsync(Guid tripId, CancellationToken cancellationToken = default) =>
            Task.FromResult(Requests
                .Where(request => request.TripId == tripId)
                .OrderByDescending(request => request.AttemptNumber)
                .FirstOrDefault());

        public Task<IReadOnlyList<TripCompletionRequest>> GetPendingReviewAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<TripCompletionRequest>>(Requests
                .Where(request => request.Status == TripCompletionStatus.PendingReview)
                .OrderBy(request => request.RequestedAt)
                .ToList());

        public Task AddAsync(TripCompletionRequest request, CancellationToken cancellationToken = default)
        {
            Requests.Add(request);
            return Task.CompletedTask;
        }
    }

    private sealed class FakeReservationRepository : IReservationRepository
    {
        private readonly Reservation _reservation;

        public FakeReservationRepository(Reservation reservation)
        {
            _reservation = reservation;
        }

        public Task<Reservation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult<Reservation?>(_reservation.Id == id ? _reservation : null);

        public Task<IReadOnlyList<Reservation>> GetActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Reservation>>([]);

        public Task<int> CountActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.FromResult(0);

        public Task<IReadOnlyList<Reservation>> GetExpiredActiveAsync(DateTime utcNow, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Reservation>>([]);

        public Task AddAsync(Reservation reservation, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class FakeVehicleRepository : IVehicleRepository
    {
        private readonly Vehicle _vehicle;

        public FakeVehicleRepository(Vehicle vehicle)
        {
            _vehicle = vehicle;
        }

        public Task<IReadOnlyList<Vehicle>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Vehicle>>([_vehicle]);

        public Task<Vehicle?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult<Vehicle?>(_vehicle.Id == id ? _vehicle : null);

        public Task<Vehicle?> GetByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult<Vehicle?>(null);

        public Task<bool> ExistsByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task<bool> ExistsByPlateNumberAsync(string plateNumber, Guid excludedVehicleId, CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task AddAsync(Vehicle vehicle, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class FakePhotoStorage : ITripPhotoStorage
    {
        public Task<string> SaveAsync(
            Guid tripId,
            Guid completionRequestId,
            TripPhotoAngle angle,
            string fileName,
            string contentType,
            Stream content,
            CancellationToken cancellationToken = default) =>
            Task.FromResult($"https://test.local/{tripId}/{completionRequestId}/{angle}.jpg");
    }

    private sealed class FakeCurrentUserService : ICurrentUserService
    {
        public FakeCurrentUserService(Guid userId, UserRole role)
        {
            UserId = userId;
            Role = role;
        }

        public Guid? UserId { get; }
        public string? Email => null;
        public UserRole? Role { get; }
        public bool IsAuthenticated => true;
    }

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public int SaveCalls { get; private set; }

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            SaveCalls++;
            return Task.FromResult(1);
        }
    }
}
