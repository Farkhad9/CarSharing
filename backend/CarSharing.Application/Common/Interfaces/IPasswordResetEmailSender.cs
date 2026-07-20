namespace CarSharing.Application.Common.Interfaces;

public interface IPasswordResetEmailSender
{
    Task SendPasswordResetAsync(
        string toEmail,
        string userName,
        string resetUrl,
        string verificationCode,
        DateTime expiresAt,
        CancellationToken cancellationToken = default);
}
