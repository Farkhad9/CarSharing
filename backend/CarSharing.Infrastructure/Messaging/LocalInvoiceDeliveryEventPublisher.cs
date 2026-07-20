using CarSharing.Application.Messaging;
using CarSharing.Application.Messaging.Events;
using CarSharing.Infrastructure.Mail;
using CarSharing.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CarSharing.Infrastructure.Messaging;

public sealed class LocalInvoiceDeliveryEventPublisher : IEventPublisher
{
    private readonly AppDbContext _dbContext;
    private readonly IReceiptEmailSender _emailSender;
    private readonly ILogger<LocalInvoiceDeliveryEventPublisher> _logger;

    public LocalInvoiceDeliveryEventPublisher(
        AppDbContext dbContext,
        IReceiptEmailSender emailSender,
        ILogger<LocalInvoiceDeliveryEventPublisher> logger)
    {
        _dbContext = dbContext;
        _emailSender = emailSender;
        _logger = logger;
    }

    public async Task PublishAsync<TEvent>(TEvent carSharingEvent, CancellationToken cancellationToken = default)
        where TEvent : CarSharingEvent
    {
        if (carSharingEvent is not InvoiceDeliveryRequestedEvent message)
        {
            return;
        }

        var invoice = await _dbContext.Invoices.FirstOrDefaultAsync(x => x.Id == message.InvoiceId, cancellationToken);
        if (invoice is null)
        {
            _logger.LogWarning("Invoice {InvoiceId} was not found for local delivery.", message.InvoiceId);
            return;
        }

        try
        {
            await _emailSender.SendReceiptAsync(
                message.UserEmail,
                message.InvoiceNumber,
                message.PdfPath,
                message.PdfUrl,
                cancellationToken);
            invoice.MarkDelivered(DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogWarning(exception, "Local receipt delivery failed for invoice {InvoiceNumber}.", message.InvoiceNumber);
            invoice.MarkDeliveryFailed(exception.Message);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
