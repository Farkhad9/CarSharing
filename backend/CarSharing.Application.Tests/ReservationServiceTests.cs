using AutoMapper;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Reservations.Dtos;
using CarSharing.Application.Reservations.Mapping;
using CarSharing.Application.Reservations.Services;
using CarSharing.Application.Reservations.Validators;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace CarSharing.Application.Tests;

public sealed class ReservationServiceTests
{
    [Fact]
    public async Task CreateAsync_WithAvailableVehicle_ReservesForFifteenMinutesAndCopiesVehicleSnapshot()
    {
        var fixture = CreateFixture();

        var result = await fixture.Service.CreateAsync(CreateRequest(fixture.Vehicle.Id));

        Assert.True(result.IsSuccess);
        var reservation = Assert.Single(fixture.Reservations.Items);
        Assert.Equal(fixture.UserId, reservation.UserId);
        Assert.Equal(TimeSpan.FromMinutes(15), reservation.ExpiresAt - reservation.ReservedAt);
        Assert.Equal(ReservationStatus.Active, reservation.Status);
        Assert.Equal(VehicleStatus.Reserved, fixture.Vehicle.Status);
        Assert.Equal(fixture.Vehicle.Brand, result.Value!.Brand);
        Assert.Equal(fixture.Vehicle.Model, result.Value.Model);
        Assert.Equal(fixture.Vehicle.PricePerMinute, result.Value.PricePerMinute);
        Assert.Equal("Fountain Square", result.Value.DestinationLabel);
        Assert.Equal(1, fixture.UnitOfWork.SaveCalls);
    }

    [Fact]
    public async Task CreateAsync_WhenVehicleIsNotAvailable_IsRejectedWithoutChangingReservations()
    {
        var fixture = CreateFixture(VehicleStatus.Reserved);

        var result = await fixture.Service.CreateAsync(CreateRequest(fixture.Vehicle.Id));

        Assert.True(result.IsFailure);
        Assert.Equal("Reservation.VehicleNotAvailable", result.Errors.Single().Code);
        Assert.Empty(fixture.Reservations.Items);
        Assert.Equal(VehicleStatus.Reserved, fixture.Vehicle.Status);
        Assert.Equal(0, fixture.UnitOfWork.SaveCalls);
    }

    [Fact]
    public async Task CreateAsync_WhenUserAlreadyHasTwoActiveReservations_IsRejected()
    {
        var fixture = CreateFixture();
        fixture.Reservations.ActiveCountOverride = 2;

        var result = await fixture.Service.CreateAsync(CreateRequest(fixture.Vehicle.Id));

        Assert.True(result.IsFailure);
        Assert.Equal("Reservation.TooManyActiveReservations", result.Errors.Single().Code);
        Assert.Empty(fixture.Reservations.Items);
        Assert.Equal(VehicleStatus.Available, fixture.Vehicle.Status);
        Assert.Equal(0, fixture.UnitOfWork.SaveCalls);
    }

    [Fact]
    public async Task CancelAsync_ForOwner_ReleasesReservedVehicleAndStoresReason()
    {
        var fixture = CreateFixture(VehicleStatus.Reserved);
        var reservation = CreateReservation(fixture.UserId, fixture.Vehicle.Id, DateTime.UtcNow.AddMinutes(-5));
        fixture.Reservations.Items.Add(reservation);

        var result = await fixture.Service.CancelAsync(
            reservation.Id,
            new CancelReservationRequest { Reason = "Changed plans" });

        Assert.True(result.IsSuccess);
        Assert.Equal(ReservationStatus.Cancelled, reservation.Status);
        Assert.Equal("Changed plans", reservation.CancelReason);
        Assert.NotNull(reservation.CancelledAt);
        Assert.Equal(VehicleStatus.Available, fixture.Vehicle.Status);
        Assert.Equal("Changed plans", result.Value!.CancelReason);
        Assert.Equal(1, fixture.UnitOfWork.SaveCalls);
    }

    [Fact]
    public async Task ExpireActiveReservationsAsync_ReleasesExpiredReservedVehicle()
    {
        var fixture = CreateFixture(VehicleStatus.Reserved);
        var reservation = CreateReservation(fixture.UserId, fixture.Vehicle.Id, DateTime.UtcNow.AddMinutes(-30), expiresInMinutes: -5);
        fixture.Reservations.Items.Add(reservation);

        var result = await fixture.Service.ExpireActiveReservationsAsync();

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value);
        Assert.Equal(ReservationStatus.Expired, reservation.Status);
        Assert.NotNull(reservation.ExpiredAt);
        Assert.Equal(VehicleStatus.Available, fixture.Vehicle.Status);
        Assert.Equal(1, fixture.UnitOfWork.SaveCalls);
    }

    private static Fixture CreateFixture(VehicleStatus vehicleStatus = VehicleStatus.Available)
    {
        var userId = Guid.NewGuid();
        var vehicle = Vehicle.Create(
            "Kia",
            "Sorento",
            2025,
            "10KS079",
            1200,
            80,
            320,
            0.45m,
            "AZN",
            5,
            "Red",
            "CCS2",
            null,
            "Ganjlik Mall",
            "City",
            40.4002,
            49.8511);
        vehicle.ChangeStatus(vehicleStatus);

        var mapper = new MapperConfiguration(
            config => config.AddProfile<ReservationMappingProfile>(),
            NullLoggerFactory.Instance)
            .CreateMapper();
        var reservations = new ReservationRepo();
        var unitOfWork = new UnitOfWork();
        var service = new ReservationService(
            reservations,
            new VehicleRepo(vehicle),
            new CurrentUser(userId),
            unitOfWork,
            mapper,
            new CreateReservationRequestValidator(),
            new CancelReservationRequestValidator());

        return new Fixture(service, reservations, vehicle, unitOfWork, userId);
    }

    private static CreateReservationRequest CreateRequest(Guid vehicleId)
    {
        return new CreateReservationRequest
        {
            VehicleId = vehicleId,
            PassengerCount = 2,
            DestinationLabel = "Fountain Square",
            DestinationLatitude = 40.3716,
            DestinationLongitude = 49.8372
        };
    }

    private static Reservation CreateReservation(Guid userId, Guid vehicleId, DateTime reservedAt, int expiresInMinutes = 15)
    {
        return Reservation.Create(
            userId,
            vehicleId,
            reservedAt,
            reservedAt.AddMinutes(expiresInMinutes),
            "Fountain Square",
            40.3716,
            49.8372);
    }

    private sealed record Fixture(
        ReservationService Service,
        ReservationRepo Reservations,
        Vehicle Vehicle,
        UnitOfWork UnitOfWork,
        Guid UserId);

    private sealed class ReservationRepo : IReservationRepository
    {
        public List<Reservation> Items { get; } = [];
        public int? ActiveCountOverride { get; set; }

        public Task<Reservation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(reservation => reservation.Id == id));

        public Task<IReadOnlyList<Reservation>> GetActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Reservation>>(
                Items.Where(reservation => reservation.UserId == userId && reservation.Status == ReservationStatus.Active).ToList());

        public Task<int> CountActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.FromResult(ActiveCountOverride
                ?? Items.Count(reservation => reservation.UserId == userId && reservation.Status == ReservationStatus.Active));

        public Task<IReadOnlyList<Reservation>> GetExpiredActiveAsync(DateTime utcNow, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Reservation>>(
                Items.Where(reservation => reservation.Status == ReservationStatus.Active && reservation.ExpiresAt <= utcNow).ToList());

        public Task AddAsync(Reservation reservation, CancellationToken cancellationToken = default)
        {
            Items.Add(reservation);
            return Task.CompletedTask;
        }
    }

    private sealed class VehicleRepo(Vehicle vehicle) : IVehicleRepository
    {
        public Task<IReadOnlyList<Vehicle>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Vehicle>>([vehicle]);

        public Task<Vehicle?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(vehicle.Id == id ? vehicle : null);

        public Task<Vehicle?> GetByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult(vehicle.PlateNumber == plateNumber ? vehicle : null);

        public Task<int> CountAvailableByZoneAsync(string zone, CancellationToken cancellationToken = default) =>
            Task.FromResult(vehicle.Zone == zone && vehicle.Status == VehicleStatus.Available ? 1 : 0);

        public Task<bool> ExistsByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult(vehicle.PlateNumber == plateNumber);

        public Task<bool> ExistsByPlateNumberAsync(string plateNumber, Guid excludedVehicleId, CancellationToken cancellationToken = default) =>
            Task.FromResult(vehicle.PlateNumber == plateNumber && vehicle.Id != excludedVehicleId);

        public Task AddAsync(Vehicle nextVehicle, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class CurrentUser(Guid userId) : ICurrentUserService
    {
        public Guid? UserId { get; } = userId;
        public string? Email => "rider@test.local";
        public UserRole? Role => UserRole.Rider;
        public bool IsAuthenticated => true;
    }

    private sealed class UnitOfWork : IUnitOfWork
    {
        public int SaveCalls { get; private set; }

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            SaveCalls++;
            return Task.FromResult(1);
        }
    }
}
