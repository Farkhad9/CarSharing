using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Payments.Dtos;
using CarSharing.Application.Payments.Services;
using CarSharing.Application.Payments.Validators;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Xunit;

namespace CarSharing.Application.Tests;

public sealed class PaymentEngineTests
{
    [Fact]
    public async Task PayTrip_WithEnoughBalance_CompletesTripAndMakesVehicleAvailable()
    {
        var fixture = CreateFixture(balance: 100, battery: 40);
        var result = await fixture.Service.PayTripAsync(fixture.Trip.Id);

        Assert.True(result.IsSuccess);
        Assert.Equal(TripStatus.Completed, fixture.Trip.Status);
        Assert.Equal(VehicleStatus.Available, fixture.Vehicle.Status);
        Assert.Equal(90m, fixture.User.Balance);
        Assert.Equal(PaymentTransactionStatus.Completed, fixture.Payments.Items.Single().Status);
    }

    [Fact]
    public async Task PayTrip_WithBatteryBelowForty_MovesVehicleToCharging()
    {
        var fixture = CreateFixture(balance: 100, battery: 39);
        var result = await fixture.Service.PayTripAsync(fixture.Trip.Id);

        Assert.True(result.IsSuccess);
        Assert.Equal(VehicleStatus.Charging, fixture.Vehicle.Status);
    }

    [Fact]
    public async Task PayTrip_WithInsufficientBalance_DoesNotPartiallyDebit()
    {
        var fixture = CreateFixture(balance: 8, battery: 80);
        var result = await fixture.Service.PayTripAsync(fixture.Trip.Id);

        Assert.True(result.IsFailure);
        Assert.Equal("Payment.InsufficientBalance", result.Errors.Single().Code);
        Assert.Equal(8m, fixture.User.Balance);
        Assert.Equal(TripStatus.AwaitingPayment, fixture.Trip.Status);
        Assert.Equal(VehicleStatus.InUse, fixture.Vehicle.Status);
        Assert.Equal(PaymentTransactionStatus.Failed, fixture.Payments.Items.Single().Status);
    }

    [Fact]
    public async Task StripeWebhook_IsIdempotentAndCreditsBalanceOnce()
    {
        var fixture = CreateFixture(balance: 0, battery: 80);
        var checkout = await fixture.Service.CreateTopUpCheckoutAsync(new TopUpBalanceRequest(25));
        Assert.True(checkout.IsSuccess);

        fixture.Stripe.Event = new StripePaymentEvent(checkout.Value!.TransactionId, "cs_test_123", "visa", "4242");
        var first = await fixture.Service.HandleStripeWebhookAsync("payload", "signature");
        var second = await fixture.Service.HandleStripeWebhookAsync("payload", "signature");

        Assert.True(first.IsSuccess);
        Assert.True(second.IsSuccess);
        Assert.Equal(25m, fixture.User.Balance);
        var transaction = fixture.Payments.Items.Single();
        Assert.Equal(PaymentTransactionStatus.Completed, transaction.Status);
        Assert.Equal("visa", transaction.CardBrand);
        Assert.Equal("4242", transaction.CardLast4);
    }

    private static Fixture CreateFixture(decimal balance, int battery)
    {
        var user = User.CreateRider("Test", "Rider", "rider@test.local", "+994501234567", "hash", "ABC12345");
        if (balance > 0) user.CreditBalance(balance);
        var vehicle = Vehicle.Create("Tesla", "Model 3", 2025, "99AA999", 1000, battery, 300,
            1m, "AZN", 5, "White", "CCS", null, "Baku", "Center", 40.4, 49.8);
        var start = DateTime.UtcNow.AddMinutes(-10);
        var reservation = Reservation.Create(user.Id, vehicle.Id, start.AddMinutes(-5), DateTime.UtcNow.AddMinutes(10));
        var trip = Trip.StartFromReservation(reservation, vehicle, start);
        vehicle.ChangeStatus(VehicleStatus.InUse);
        trip.RequestCompletion(start.AddMinutes(10));
        trip.MarkAwaitingPayment();

        var users = new UserRepo(user);
        var trips = new TripRepo(trip);
        var vehicles = new VehicleRepo(vehicle);
        var payments = new PaymentRepo();
        var stripe = new StripeGateway();
        var service = new PaymentService(users, trips, vehicles, payments,
            new CurrentUser(user.Id), new UnitOfWork(), new TopUpBalanceRequestValidator(), stripe);
        return new Fixture(service, user, trip, vehicle, payments, stripe);
    }

    private sealed record Fixture(PaymentService Service, User User, Trip Trip, Vehicle Vehicle,
        PaymentRepo Payments, StripeGateway Stripe);

    private sealed class UserRepo(User user) : IUserRepository
    {
        public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<User?>(id == user.Id ? user : null);
        public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) => Task.FromResult<User?>(user);
        public Task<User?> GetByRefreshTokenHashAsync(string refreshTokenHash, CancellationToken cancellationToken = default) => Task.FromResult<User?>(null);
        public Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task AddAsync(User entity, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class TripRepo(Trip trip) : ITripRepository
    {
        public Task<Trip?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<Trip?>(id == trip.Id ? trip : null);
        public Task<Trip?> GetActiveByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) => Task.FromResult<Trip?>(trip);
        public Task<Trip?> GetByReservationIdAsync(Guid reservationId, CancellationToken cancellationToken = default) => Task.FromResult<Trip?>(trip);
        public Task AddAsync(Trip entity, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class VehicleRepo(Vehicle vehicle) : IVehicleRepository
    {
        public Task<IReadOnlyList<Vehicle>> GetAllAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Vehicle>>([vehicle]);
        public Task<Vehicle?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<Vehicle?>(id == vehicle.Id ? vehicle : null);
        public Task<Vehicle?> GetByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default) => Task.FromResult<Vehicle?>(vehicle);
        public Task<int> CountAvailableByZoneAsync(string zone, CancellationToken cancellationToken = default) => Task.FromResult(vehicle.Status == VehicleStatus.Available && vehicle.Zone == zone ? 1 : 0);
        public Task<bool> ExistsByPlateNumberAsync(string plateNumber, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task<bool> ExistsByPlateNumberAsync(string plateNumber, Guid excludedVehicleId, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task AddAsync(Vehicle entity, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class PaymentRepo : IPaymentTransactionRepository
    {
        public List<PaymentTransaction> Items { get; } = [];
        public Task AddAsync(PaymentTransaction transaction, CancellationToken cancellationToken = default) { Items.Add(transaction); return Task.CompletedTask; }
        public Task<PaymentTransaction?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult(Items.FirstOrDefault(x => x.Id == id));
        public Task<bool> HasCompletedTripPaymentAsync(Guid tripId, CancellationToken cancellationToken = default) => Task.FromResult(Items.Any(x => x.TripId == tripId && x.Status == PaymentTransactionStatus.Completed));
        public Task<IReadOnlyList<PaymentTransaction>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<PaymentTransaction>>(Items.Where(x => x.UserId == userId).ToList());
    }

    private sealed class CurrentUser(Guid id) : ICurrentUserService
    {
        public Guid? UserId => id;
        public string? Email => "rider@test.local";
        public UserRole? Role => UserRole.Rider;
        public bool IsAuthenticated => true;
    }

    private sealed class UnitOfWork : IUnitOfWork
    {
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);
    }

    private sealed class StripeGateway : IStripePaymentGateway
    {
        public StripePaymentEvent? Event { get; set; }
        public Task<StripeCheckoutSession> CreateTopUpSessionAsync(Guid transactionId, Guid userId, string email, decimal amount, string currency, CancellationToken cancellationToken = default)
            => Task.FromResult(new StripeCheckoutSession("cs_test_123", "https://checkout.stripe.test/session"));
        public Task<StripePaymentEvent?> ParseCompletedCheckoutAsync(string payload, string signature, CancellationToken cancellationToken = default)
            => Task.FromResult(Event);
    }
}
