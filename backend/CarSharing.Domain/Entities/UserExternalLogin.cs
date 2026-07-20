namespace CarSharing.Domain.Entities;

public class UserExternalLogin : BaseEntity
{
    private UserExternalLogin()
    {
    }

    public Guid UserId { get; private set; }
    public string Provider { get; private set; } = null!;
    public string ProviderUserId { get; private set; } = null!;
    public DateTime CreatedAt { get; private set; }
    public User User { get; private set; } = null!;

    public static UserExternalLogin Create(Guid userId, string provider, string providerUserId, DateTime createdAt)
    {
        return new UserExternalLogin
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Provider = provider.Trim(),
            ProviderUserId = providerUserId.Trim(),
            CreatedAt = createdAt
        };
    }
}
