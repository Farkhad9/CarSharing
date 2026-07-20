namespace CarSharing.Application.Common.Interfaces;

public interface IAccountSecurityEmailSender
{
    Task SendPasswordChangedAsync(
        string toEmail,
        string userName,
        DateTime changedAtUtc,
        CancellationToken cancellationToken = default);
}
