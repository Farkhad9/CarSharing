using CarSharing.Application.Messaging.Events;
using CarSharing.Infrastructure.Mail;
using CarSharing.Infrastructure.Persistence;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CarSharing.Infrastructure.Messaging;

public sealed class InvoiceDeliveryRequestedConsumer : IConsumer<InvoiceDeliveryRequestedEvent>
{
    private readonly AppDbContext _dbContext;
    private readonly IReceiptEmailSender _emailSender;
    private readonly ILogger<InvoiceDeliveryRequestedConsumer> _logger;

    public InvoiceDeliveryRequestedConsumer(
        AppDbContext dbContext,
        IReceiptEmailSender emailSender,
        ILogger<InvoiceDeliveryRequestedConsumer> logger)
    {
        _dbContext = dbContext;
        _emailSender = emailSender;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<InvoiceDeliveryRequestedEvent> context)
    {
        var message = context.Message;
        var invoice = await _dbContext.Invoices.FirstOrDefaultAsync(x => x.Id == message.InvoiceId, context.CancellationToken);
        if (invoice is null)
        {
            _logger.LogWarning("Invoice {InvoiceId} was not found for delivery.", message.InvoiceId);
            return;
        }

        try
        {
            await _emailSender.SendReceiptAsync(
                message.UserEmail,
                message.InvoiceNumber,
                message.PdfPath,
                message.PdfUrl,
                context.CancellationToken);
            invoice.MarkDelivered(DateTime.UtcNow);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogWarning(exception, "Receipt delivery failed for invoice {InvoiceNumber}.", message.InvoiceNumber);
            invoice.MarkDeliveryFailed(exception.Message);
        }

        await _dbContext.SaveChangesAsync(context.CancellationToken);
    }
}
