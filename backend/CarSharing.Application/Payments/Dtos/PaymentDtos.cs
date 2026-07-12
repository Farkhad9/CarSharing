using CarSharing.Domain.Enums;

namespace CarSharing.Application.Payments.Dtos;

public sealed record TopUpBalanceRequest(decimal Amount);
public sealed record TopUpCheckoutDto(Guid TransactionId, string CheckoutUrl);
public sealed record BalanceDto(decimal Balance, decimal PendingHold, string Currency);
public sealed record PaymentTransactionDto(Guid Id, Guid UserId, Guid? TripId, PaymentTransactionType Type,
    PaymentTransactionStatus Status, decimal Amount, string Currency, string? PaymentMethod,
    string? CardBrand, string? CardLast4, string? FailureReason, DateTime CreatedAt, DateTime? CompletedAt);
public sealed record TripPaymentDto(Guid TripId, PaymentTransactionDto Transaction, decimal RemainingBalance);
