using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class Invoice : BaseEntity
{
    private Invoice() { }

    public string InvoiceNumber { get; private set; } = null!;
    public Guid UserId { get; private set; }
    public Guid PaymentTransactionId { get; private set; }
    public Guid? TripId { get; private set; }
    public InvoiceType Type { get; private set; }
    public InvoiceStatus Status { get; private set; }
    public InvoiceDeliveryStatus DeliveryStatus { get; private set; }
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = "AZN";
    public string PdfPath { get; private set; } = null!;
    public string PdfUrl { get; private set; } = null!;
    public string? FailureReason { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? GeneratedAt { get; private set; }
    public DateTime? DeliveredAt { get; private set; }

    public static Invoice Create(
        string invoiceNumber,
        Guid userId,
        Guid paymentTransactionId,
        Guid? tripId,
        InvoiceType type,
        decimal amount,
        string currency,
        string pdfPath,
        string pdfUrl,
        DateTime now)
    {
        if (string.IsNullOrWhiteSpace(invoiceNumber)) throw new ArgumentException("Invoice number is required.", nameof(invoiceNumber));
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount));

        return new Invoice
        {
            Id = Guid.NewGuid(),
            InvoiceNumber = invoiceNumber.Trim(),
            UserId = userId,
            PaymentTransactionId = paymentTransactionId,
            TripId = tripId,
            Type = type,
            Status = InvoiceStatus.Ready,
            DeliveryStatus = InvoiceDeliveryStatus.Pending,
            Amount = amount,
            Currency = currency.Trim().ToUpperInvariant(),
            PdfPath = pdfPath.Trim(),
            PdfUrl = pdfUrl.Trim(),
            CreatedAt = now,
            GeneratedAt = now
        };
    }

    public void MarkDelivered(DateTime deliveredAt)
    {
        DeliveryStatus = InvoiceDeliveryStatus.Delivered;
        DeliveredAt = deliveredAt;
        FailureReason = null;
    }

    public void MarkDeliveryFailed(string reason)
    {
        DeliveryStatus = InvoiceDeliveryStatus.Failed;
        FailureReason = string.IsNullOrWhiteSpace(reason) ? "Delivery failed." : reason.Trim();
    }
}
