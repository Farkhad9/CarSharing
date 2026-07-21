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

        if (!File.Exists(pdfPath))
        {
            throw new FileNotFoundException($"Receipt PDF file was not found: {pdfPath}", pdfPath);
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_options.FromName, _options.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = $"ElectroStreet receipt {invoiceNumber}";

        var builder = new BodyBuilder
        {
            TextBody = $"""
                Your ElectroStreet receipt {invoiceNumber} is attached as a PDF.

                Keep this message for your records.
                """,
            HtmlBody = $"""
                <!doctype html>
                <html>
                  <body style="margin:0;padding:24px;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
                    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #fee2e2;border-radius:18px;padding:28px;">
                      <p style="margin:0;color:#ef4444;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">ElectroStreet receipt</p>
                      <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">Receipt {invoiceNumber}</h1>
                      <p style="margin:14px 0 0;font-size:14px;line-height:1.7;color:#52525b;">Your official receipt is attached as a PDF file.</p>
                    </div>
                  </body>
                </html>
                """
        };

        var fileName = $"{invoiceNumber}.pdf";
        builder.Attachments.Add(fileName, await File.ReadAllBytesAsync(pdfPath, cancellationToken), ContentType.Parse("application/pdf"));

        message.Body = builder.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(_options.Host, _options.Port, SecureSocketOptions.StartTls, cancellationToken);
        await client.AuthenticateAsync(_options.UserName, _options.Password, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}
