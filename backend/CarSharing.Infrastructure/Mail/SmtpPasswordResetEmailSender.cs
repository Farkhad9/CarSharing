using CarSharing.Application.Common.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using System.Net;

namespace CarSharing.Infrastructure.Mail;

public sealed class SmtpPasswordResetEmailSender : IPasswordResetEmailSender
{
    private readonly SmtpOptions _options;
    private readonly ILogger<SmtpPasswordResetEmailSender> _logger;

    public SmtpPasswordResetEmailSender(IOptions<SmtpOptions> options, ILogger<SmtpPasswordResetEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendPasswordResetAsync(
        string toEmail,
        string userName,
        string resetUrl,
        string verificationCode,
        DateTime expiresAt,
        CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation(
                "SMTP disabled. Password reset link for {Email}: {ResetUrl}. Verification code: {VerificationCode}",
                toEmail,
                resetUrl,
                verificationCode);
            return;
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_options.FromName, _options.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Reset your ElectroStreet password";
        message.Body = new BodyBuilder
        {
            TextBody = $"""
                Hello {userName},

                Open this message in HTML view and press the reset button to choose a new ElectroStreet password.
                Your verification code is {verificationCode}.
                This link expires at {expiresAt:yyyy-MM-dd HH:mm} UTC.

                If you did not request this reset, ignore this email.
                """,
            HtmlBody = BuildResetHtml(userName, resetUrl, verificationCode, expiresAt)
        }.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(_options.Host, _options.Port, SecureSocketOptions.StartTls, cancellationToken);
        await client.AuthenticateAsync(_options.UserName, _options.Password, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }

    private static string BuildResetHtml(string userName, string resetUrl, string verificationCode, DateTime expiresAt)
    {
        var safeUserName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(userName) ? "there" : userName);
        var safeUrl = WebUtility.HtmlEncode(resetUrl);
        var safeCode = WebUtility.HtmlEncode(verificationCode);
        var safeExpiry = WebUtility.HtmlEncode($"{expiresAt:yyyy-MM-dd HH:mm} UTC");

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
                            <p style="margin:18px 0 0;color:#ef4444;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">Password reset</p>
                            <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;color:#09090b;">Choose a new password</h1>
                            <p style="margin:12px 0 0;font-size:14px;line-height:1.7;color:#52525b;">Hello {{safeUserName}}, press the button below to reset your ElectroStreet password.</p>
                            <p style="margin:18px auto 0;display:inline-block;border-radius:14px;background:#fef2f2;color:#991b1b;padding:12px 18px;font-size:24px;font-weight:900;letter-spacing:6px;">{{safeCode}}</p>
                            <p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:#71717a;">Enter this 6-digit code on the reset form.</p>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding:22px 28px 10px;">
                            <a href="{{safeUrl}}" style="display:inline-block;width:100%;max-width:260px;border-radius:12px;background:#ef4444;color:#ffffff;text-decoration:none;text-align:center;padding:14px 18px;font-size:14px;font-weight:800;">
                              Reset password
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:8px 28px 28px;text-align:center;">
                            <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">This link expires at {{safeExpiry}}. If you did not request this reset, ignore this email.</p>
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
