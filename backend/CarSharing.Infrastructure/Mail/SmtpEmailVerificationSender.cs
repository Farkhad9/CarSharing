using CarSharing.Application.Common.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using System.Net;

namespace CarSharing.Infrastructure.Mail;

public sealed class SmtpEmailVerificationSender : IEmailVerificationSender
{
    private readonly SmtpOptions _options;
    private readonly ILogger<SmtpEmailVerificationSender> _logger;

    public SmtpEmailVerificationSender(IOptions<SmtpOptions> options, ILogger<SmtpEmailVerificationSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendVerificationAsync(
        string toEmail,
        string userName,
        string verificationUrl,
        CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("SMTP disabled. Email verification link for {Email}: {VerificationUrl}", toEmail, verificationUrl);
            return;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_options.FromName, _options.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Confirm your ElectroStreet email";
        message.Body = new BodyBuilder
        {
            TextBody = $"""
                Hello {userName},

                Open this message in HTML view and press the confirmation button to activate your ElectroStreet account.

                If you did not create this account, ignore this email.
                """,
            HtmlBody = BuildVerificationHtml(userName, verificationUrl)
        }.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(_options.Host, _options.Port, SecureSocketOptions.StartTls, cancellationToken);
        await client.AuthenticateAsync(_options.UserName, _options.Password, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }

    private static string BuildVerificationHtml(string userName, string verificationUrl)
    {
        var safeUserName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(userName) ? "there" : userName);
        var safeUrl = WebUtility.HtmlEncode(verificationUrl);

        return $$"""
            <!doctype html>
            <html>
              <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;padding:28px 12px;">
                  <tr>
                    <td align="center">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:460px;background:#ffffff;border:1px solid #fee2e2;border-radius:18px;box-shadow:0 18px 45px rgba(127,29,29,0.08);overflow:hidden;">
                        <tr>
                          <td style="padding:28px 28px 8px;text-align:center;">
                            <div style="display:inline-block;border-radius:14px;background:#fef2f2;color:#ef4444;padding:12px 14px;font-size:22px;font-weight:900;">E</div>
                            <p style="margin:18px 0 0;color:#ef4444;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Email verification</p>
                            <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;color:#09090b;">Confirm your email</h1>
                            <p style="margin:12px 0 0;font-size:14px;line-height:1.7;color:#52525b;">Hello {{safeUserName}}, press the button below to activate your ElectroStreet account.</p>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:22px 28px 10px;">
                            <a href="{{safeUrl}}" style="display:inline-block;width:100%;max-width:260px;border-radius:12px;background:#ef4444;color:#ffffff;text-decoration:none;text-align:center;padding:14px 18px;font-size:14px;font-weight:800;">
                              Нажмите для подтверждения
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:8px 28px 28px;text-align:center;">
                            <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">If you did not create this account, ignore this email.</p>
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
