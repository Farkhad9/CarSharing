using CarSharing.Domain.Enums;

namespace CarSharing.Application.Invoices.Dtos;

public sealed record InvoiceDto(
    Guid Id,
    string InvoiceNumber,
    Guid UserId,
    string? UserEmail,
    Guid PaymentTransactionId,
    Guid? TripId,
    InvoiceType Type,
    InvoiceStatus Status,
    InvoiceDeliveryStatus DeliveryStatus,
    decimal Amount,
    string Currency,
    string PdfUrl,
    DateTime CreatedAt,
    DateTime? GeneratedAt,
    DateTime? DeliveredAt);

public sealed record InvoicePricingBreakdownDto(
    Guid InvoiceId,
    Guid? TripId,
    decimal? BasePricePerMinute,
    decimal? DemandMultiplier,
    decimal? ZoneMultiplier,
    decimal? BatteryMultiplier,
    decimal? FinalPricePerMinute,
    int? DurationMinutes,
    decimal? BasePrice,
    decimal? DiscountAmount,
    decimal TotalPrice,
    string Currency);

public sealed record InvoicePdfModel(
    string InvoiceNumber,
    string CustomerEmail,
    InvoiceType Type,
    decimal Amount,
    string Currency,
    string PaymentMethod,
    string Status,
    DateTime PaidAt,
    decimal? FinalRate,
    int? DurationMinutes,
    decimal Total);
