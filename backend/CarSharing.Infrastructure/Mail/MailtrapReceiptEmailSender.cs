using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;

namespace CarSharing.Infrastructure.Mail;

public sealed class MailtrapReceiptEmailSender : IReceiptEmailSender
{
    private readonly SmtpOptions _options;
    private readonly ILogger<MailtrapReceiptEmailSender> _logger;

    public MailtrapReceiptEmailSender(IOptions<SmtpOptions> options, ILogger<MailtrapReceiptEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendReceiptAsync(string toEmail, string invoiceNumber, string pdfPath, string pdfUrl, CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("SMTP disabled. Receipt {InvoiceNumber} would be sent to {Email}.", invoiceNumber, toEmail);
            return;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_options.FromName, _options.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = $"ElectroStreet receipt {invoiceNumber}";

        var builder = new BodyBuilder
        {
            TextBody = $"Your ElectroStreet receipt {invoiceNumber} is ready. PDF link: {pdfUrl}"
        };

        if (File.Exists(pdfPath))
        {
            builder.Attachments.Add(pdfPath);
        }

        message.Body = builder.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(_options.Host, _options.Port, SecureSocketOptions.StartTls, cancellationToken);
        await client.AuthenticateAsync(_options.UserName, _options.Password, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}
