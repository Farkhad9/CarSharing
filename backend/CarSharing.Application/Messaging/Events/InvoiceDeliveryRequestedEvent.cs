namespace CarSharing.Application.Messaging.Events;

public sealed record InvoiceDeliveryRequestedEvent(
    Guid EventId,
    string EventType,
    DateTime OccurredAtUtc,
    Guid InvoiceId,
    Guid UserId,
    string UserEmail,
    string InvoiceNumber,
    string PdfPath,
    string PdfUrl,
    decimal Amount,
    string Currency) : CarSharingEvent(EventId, EventType, OccurredAtUtc)
{
    public static InvoiceDeliveryRequestedEvent Create(
        Guid invoiceId,
        Guid userId,
        string userEmail,
        string invoiceNumber,
        string pdfPath,
        string pdfUrl,
        decimal amount,
        string currency,
        DateTime occurredAtUtc) => new(
            Guid.NewGuid(),
            nameof(InvoiceDeliveryRequestedEvent),
            occurredAtUtc,
            invoiceId,
            userId,
            userEmail,
            invoiceNumber,
            pdfPath,
            pdfUrl,
            amount,
            currency);
}
