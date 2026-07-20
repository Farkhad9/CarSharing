using CarSharing.Application.Common.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using System.Net;

namespace CarSharing.Infrastructure.Mail;

public sealed class SmtpAccountSecurityEmailSender : IAccountSecurityEmailSender
{
    private readonly SmtpOptions _options;
    private readonly ILogger<SmtpAccountSecurityEmailSender> _logger;

    public SmtpAccountSecurityEmailSender(IOptions<SmtpOptions> options, ILogger<SmtpAccountSecurityEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendPasswordChangedAsync(
        string toEmail,
        string userName,
        DateTime changedAtUtc,
        CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("SMTP disabled. Password changed notification suppressed for {Email}.", toEmail);
            return;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_options.FromName, _options.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Your ElectroStreet password was changed";
        message.Body = new BodyBuilder
        {
            TextBody = $"""
                Hello {userName},

                Your ElectroStreet password was changed at {changedAtUtc:yyyy-MM-dd HH:mm} UTC.

                If this was you, no further action is needed.
                If this was not you, reset your password immediately and contact ElectroStreet support.
                """,
            HtmlBody = BuildPasswordChangedHtml(userName, changedAtUtc)
        }.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(_options.Host, _options.Port, SecureSocketOptions.StartTls, cancellationToken);
        await client.AuthenticateAsync(_options.UserName, _options.Password, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }

    private static string BuildPasswordChangedHtml(string userName, DateTime changedAtUtc)
    {
        var safeUserName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(userName) ? "there" : userName);
        var safeChangedAt = WebUtility.HtmlEncode($"{changedAtUtc:yyyy-MM-dd HH:mm} UTC");

        return $$"""
            <!doctype html>
            <html>
              <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:28px 12px;">
                  <tr>
                    <td align="center">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border:1px solid #fee2e2;border-radius:18px;box-shadow:0 18px 45px rgba(127,29,29,0.08);overflow:hidden;">
                        <tr>
                          <td style="padding:28px;text-align:center;">
                            <div style="display:inline-block;border-radius:14px;background:#fef2f2;color:#ef4444;padding:12px 14px;font-size:22px;font-weight:900;">E</div>
                            <p style="margin:18px 0 0;color:#ef4444;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Security alert</p>
                            <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;color:#09090b;">Your password was changed</h1>
                            <p style="margin:12px 0 0;font-size:14px;line-height:1.7;color:#52525b;">Hello {{safeUserName}}, your ElectroStreet password was changed at <strong>{{safeChangedAt}}</strong>.</p>
                            <p style="margin:16px 0 0;font-size:13px;line-height:1.7;color:#71717a;">If this was you, no further action is needed. If this was not you, reset your password immediately and contact ElectroStreet support.</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """;
    }
}
