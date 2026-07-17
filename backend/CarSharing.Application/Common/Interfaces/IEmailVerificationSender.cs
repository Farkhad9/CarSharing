namespace CarSharing.Application.Common.Interfaces;

public interface IEmailVerificationSender
{
    Task SendVerificationAsync(
        string toEmail,
        string userName,
        string verificationUrl,
        CancellationToken cancellationToken = default);
}
