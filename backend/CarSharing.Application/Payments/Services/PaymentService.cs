using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.Payments.Dtos;
using CarSharing.Application.Invoices.Services;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using FluentValidation;

namespace CarSharing.Application.Payments.Services;

public sealed class PaymentService : IPaymentService
{
    private const int LowBatteryChargingThresholdPercent = 30;

    private static readonly Error Unauthenticated = new("Payment.Unauthenticated", "User must be authenticated.");
    private static readonly Error UserNotFound = new("Payment.UserNotFound", "User was not found.");
    private static readonly Error TripNotFound = new("Payment.TripNotFound", "Trip was not found.");
    private static readonly Error VehicleNotFound = new("Payment.VehicleNotFound", "Vehicle was not found.");
    private static readonly Error Forbidden = new("Payment.Forbidden", "User is not allowed to pay for this trip.");
    private static readonly Error TripNotAwaitingPayment = new("Payment.TripNotAwaitingPayment", "Trip must be awaiting payment.");
    private static readonly Error AlreadyPaid = new("Payment.AlreadyPaid", "Trip has already been paid.");
    private static readonly Error EmailNotVerified = new("Payment.EmailNotVerified", "Please confirm your email before topping up your balance.");
    private static readonly Error VerificationRequired = new("Payment.VerificationRequired", "Please complete identity verification before topping up your balance.");

    private readonly IUserRepository _userRepository;
    private readonly ITripRepository _tripRepository;
    private readonly IVehicleRepository _vehicleRepository;
    private readonly IPaymentTransactionRepository _paymentRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IValidator<TopUpBalanceRequest> _topUpValidator;
    private readonly IStripePaymentGateway _stripeGateway;
    private readonly IInvoiceService _invoiceService;

    public PaymentService(IUserRepository userRepository, ITripRepository tripRepository,
        IVehicleRepository vehicleRepository, IPaymentTransactionRepository paymentRepository,
        ICurrentUserService currentUser, IUnitOfWork unitOfWork,
        IValidator<TopUpBalanceRequest> topUpValidator, IStripePaymentGateway stripeGateway,
        IInvoiceService invoiceService)
    {
        _userRepository = userRepository;
        _tripRepository = tripRepository;
        _vehicleRepository = vehicleRepository;
        _paymentRepository = paymentRepository;
        _currentUser = currentUser;
        _unitOfWork = unitOfWork;
        _topUpValidator = topUpValidator;
        _stripeGateway = stripeGateway;
        _invoiceService = invoiceService;
    }

    public async Task<Result<BalanceDto>> GetBalanceAsync(CancellationToken cancellationToken = default)
    {
        var userResult = await GetCurrentUserAsync(cancellationToken);
        return userResult.Error is not null
            ? Result<BalanceDto>.Failure(userResult.Error)
            : Result<BalanceDto>.Success(new BalanceDto(userResult.User!.Balance, userResult.User.PendingHold, "AZN"));
    }

    public async Task<Result<TopUpCheckoutDto>> CreateTopUpCheckoutAsync(TopUpBalanceRequest request, CancellationToken cancellationToken = default)
    {
        var validation = await _topUpValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return Result<TopUpCheckoutDto>.Failure(validation.Errors
                .Select(x => new Error($"Validation.{x.PropertyName}", x.ErrorMessage)).ToList());
        }

        var userResult = await GetCurrentUserAsync(cancellationToken);
        if (userResult.Error is not null) return Result<TopUpCheckoutDto>.Failure(userResult.Error);
        if (!userResult.User!.EmailVerified) return Result<TopUpCheckoutDto>.Failure(EmailNotVerified);
        if (userResult.User.VerificationStatus is not UserVerificationStatus.Verified and not UserVerificationStatus.Internal)
        {
            return Result<TopUpCheckoutDto>.Failure(VerificationRequired);
        }

        var now = DateTime.UtcNow;
        var transaction = PaymentTransaction.CreateTopUp(userResult.User.Id, request.Amount, "Stripe", now);
        await _paymentRepository.AddAsync(transaction, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        try
        {
            var checkout = await _stripeGateway.CreateTopUpSessionAsync(transaction.Id, userResult.User.Id,
                userResult.User.Email, request.Amount, transaction.Currency, cancellationToken);
            transaction.SetExternalPayment(checkout.Id);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return Result<TopUpCheckoutDto>.Success(new TopUpCheckoutDto(transaction.Id, checkout.Url));
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            transaction.Fail("External payment gateway is unavailable.");
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return Result<TopUpCheckoutDto>.Failure(new Error(
                "Payment.GatewayUnavailable",
                "Stripe checkout is temporarily unavailable. Please try again later."));
        }
    }

    public async Task<Result<bool>> HandleStripeWebhookAsync(string payload, string signature, CancellationToken cancellationToken = default)
    {
        var paymentEvent = await _stripeGateway.ParseCompletedCheckoutAsync(payload, signature, cancellationToken);
        if (paymentEvent is null) return Result<bool>.Success(false);

        var transaction = await _paymentRepository.GetByIdAsync(paymentEvent.TransactionId, cancellationToken);
        if (transaction is null) return Result<bool>.Failure(new Error("Payment.TransactionNotFound", "Transaction was not found."));
        if (transaction.Status == PaymentTransactionStatus.Completed) return Result<bool>.Success(true);
        if (transaction.Status != PaymentTransactionStatus.Pending)
            return Result<bool>.Failure(new Error("Payment.InvalidTransaction", "Transaction cannot be completed."));

        var user = await _userRepository.GetByIdAsync(transaction.UserId, cancellationToken);
        if (user is null) return Result<bool>.Failure(UserNotFound);

        transaction.SetExternalPayment(paymentEvent.SessionId, paymentEvent.CardBrand, paymentEvent.CardLast4);
        transaction.Complete(DateTime.UtcNow);

        if (transaction.Type == PaymentTransactionType.TopUp)
        {
            user.CreditBalance(transaction.Amount);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _invoiceService.CreateForCompletedPaymentAsync(transaction, user, null, cancellationToken);
            return Result<bool>.Success(true);
        }

        if (transaction.Type == PaymentTransactionType.RidePayment && transaction.TripId is not null)
        {
            var trip = await _tripRepository.GetByIdAsync(transaction.TripId.Value, cancellationToken);
            if (trip is null) return Result<bool>.Failure(TripNotFound);
            if (trip.Status != TripStatus.AwaitingPayment)
                return Result<bool>.Failure(TripNotAwaitingPayment);

            var vehicle = await _vehicleRepository.GetByIdAsync(trip.VehicleId, cancellationToken);
            if (vehicle is null) return Result<bool>.Failure(VehicleNotFound);

            var finalBatteryPercent = trip.CalculateBatteryPercentAfterRide(trip.StartBatteryPercent, DateTime.UtcNow);
            vehicle.UpdateBattery(finalBatteryPercent);
            trip.CompletePayment();
            vehicle.ChangeStatus(GetPostTripVehicleStatus(finalBatteryPercent));
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            await _invoiceService.CreateForCompletedPaymentAsync(transaction, user, trip, cancellationToken);
            return Result<bool>.Success(true);
        }

        return Result<bool>.Failure(new Error("Payment.InvalidTransaction", "Transaction cannot be completed."));
    }

    public async Task<Result<TopUpCheckoutDto>> CreateTripPaymentCheckoutAsync(Guid tripId, CancellationToken cancellationToken = default)
    {
        var userResult = await GetCurrentUserAsync(cancellationToken);
        if (userResult.Error is not null) return Result<TopUpCheckoutDto>.Failure(userResult.Error);

        var trip = await _tripRepository.GetByIdAsync(tripId, cancellationToken);
        if (trip is null) return Result<TopUpCheckoutDto>.Failure(TripNotFound);
        if (trip.UserId != userResult.User!.Id) return Result<TopUpCheckoutDto>.Failure(Forbidden);
        if (await _paymentRepository.HasCompletedTripPaymentAsync(tripId, cancellationToken))
            return Result<TopUpCheckoutDto>.Failure(AlreadyPaid);
        if (trip.Status != TripStatus.AwaitingPayment)
            return Result<TopUpCheckoutDto>.Failure(TripNotAwaitingPayment);

        var transaction = PaymentTransaction.CreateTripCardPayment(userResult.User.Id, trip.Id, trip.TotalPrice, DateTime.UtcNow);
        await _paymentRepository.AddAsync(transaction, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        try
        {
            var checkout = await _stripeGateway.CreateTripPaymentSessionAsync(
                transaction.Id,
                userResult.User.Id,
                trip.Id,
                userResult.User.Email,
                transaction.Amount,
                transaction.Currency,
                cancellationToken);
            transaction.SetExternalPayment(checkout.Id);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return Result<TopUpCheckoutDto>.Success(new TopUpCheckoutDto(transaction.Id, checkout.Url));
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var gatewayMessage = string.IsNullOrWhiteSpace(exception.Message)
                ? "External payment gateway is unavailable."
                : exception.Message;
            transaction.Fail(gatewayMessage);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return Result<TopUpCheckoutDto>.Failure(new Error(
                "Payment.GatewayUnavailable",
                $"Card checkout could not be opened: {gatewayMessage}"));
        }
    }

    public async Task<Result<TripPaymentDto>> PayTripAsync(Guid tripId, CancellationToken cancellationToken = default)
    {
        var userResult = await GetCurrentUserAsync(cancellationToken);
        if (userResult.Error is not null) return Result<TripPaymentDto>.Failure(userResult.Error);

        var trip = await _tripRepository.GetByIdAsync(tripId, cancellationToken);
        if (trip is null) return Result<TripPaymentDto>.Failure(TripNotFound);
        if (trip.UserId != userResult.User!.Id) return Result<TripPaymentDto>.Failure(Forbidden);
        if (await _paymentRepository.HasCompletedTripPaymentAsync(tripId, cancellationToken))
            return Result<TripPaymentDto>.Failure(AlreadyPaid);
        if (trip.Status != TripStatus.AwaitingPayment)
            return Result<TripPaymentDto>.Failure(TripNotAwaitingPayment);

        var now = DateTime.UtcNow;
        var transaction = PaymentTransaction.CreateTripPayment(userResult.User.Id, trip.Id, trip.TotalPrice, now);
        await _paymentRepository.AddAsync(transaction, cancellationToken);

        if (!userResult.User.TryDebitBalance(trip.TotalPrice))
        {
            var missing = Math.Round(trip.TotalPrice - userResult.User.Balance, 2, MidpointRounding.AwayFromZero);
            transaction.Fail($"Insufficient balance. Top up at least {missing:F2} {trip.Currency}.");
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return Result<TripPaymentDto>.Failure(new Error("Payment.InsufficientBalance",
                $"Insufficient balance. Top up at least {missing:F2} {trip.Currency}."));
        }

        var vehicle = await _vehicleRepository.GetByIdAsync(trip.VehicleId, cancellationToken);
        if (vehicle is null) return Result<TripPaymentDto>.Failure(VehicleNotFound);

        transaction.Complete(now);
        var finalBatteryPercent = trip.CalculateBatteryPercentAfterRide(trip.StartBatteryPercent, now);
        vehicle.UpdateBattery(finalBatteryPercent);
        trip.CompletePayment();
        vehicle.ChangeStatus(GetPostTripVehicleStatus(finalBatteryPercent));
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await _invoiceService.CreateForCompletedPaymentAsync(transaction, userResult.User, trip, cancellationToken);

        return Result<TripPaymentDto>.Success(new TripPaymentDto(trip.Id, Map(transaction), userResult.User.Balance));
    }

    public async Task<Result<IReadOnlyList<PaymentTransactionDto>>> GetMyTransactionsAsync(CancellationToken cancellationToken = default)
    {
        var userResult = await GetCurrentUserAsync(cancellationToken);
        if (userResult.Error is not null) return Result<IReadOnlyList<PaymentTransactionDto>>.Failure(userResult.Error);
        var items = await _paymentRepository.GetByUserIdAsync(userResult.User!.Id, cancellationToken);
        return Result<IReadOnlyList<PaymentTransactionDto>>.Success(items.Select(Map).ToList());
    }

    private async Task<(User? User, Error? Error)> GetCurrentUserAsync(CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is null) return (null, Unauthenticated);
        var user = await _userRepository.GetByIdAsync(_currentUser.UserId.Value, cancellationToken);
        return user is null ? (null, UserNotFound) : (user, null);
    }

    private static PaymentTransactionDto Map(PaymentTransaction x) => new(x.Id, x.UserId, x.TripId, x.Type,
        x.Status, x.Amount, x.Currency, x.PaymentMethod, x.CardBrand, x.CardLast4, x.FailureReason, x.CreatedAt, x.CompletedAt);

    private static VehicleStatus GetPostTripVehicleStatus(int finalBatteryPercent) =>
        finalBatteryPercent <= LowBatteryChargingThresholdPercent
            ? VehicleStatus.Charging
            : VehicleStatus.Available;
}
