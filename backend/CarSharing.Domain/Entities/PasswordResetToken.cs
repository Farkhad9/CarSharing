namespace CarSharing.Domain.Entities;

public class PasswordResetToken : BaseEntity
{
    private PasswordResetToken()
    {
    }

    public Guid UserId { get; private set; }
    public User User { get; private set; } = null!;
    public string TokenHash { get; private set; } = null!;
    public string CodeHash { get; private set; } = null!;
    public DateTime ExpiresAt { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UsedAt { get; private set; }
    public int FailedCodeAttempts { get; private set; }

    public static PasswordResetToken Create(
        Guid userId,
        string tokenHash,
        string codeHash,
        DateTime expiresAt,
        DateTime createdAt)
    {
        return new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TokenHash = tokenHash,
            CodeHash = codeHash,
            ExpiresAt = expiresAt,
            CreatedAt = createdAt
        };
    }

    public bool IsValid(DateTime utcNow)
    {
        return UsedAt is null && ExpiresAt > utcNow;
    }

    public void MarkUsed(DateTime usedAt)
    {
        UsedAt ??= usedAt;
    }

    public void RegisterFailedCodeAttempt()
    {
        FailedCodeAttempts++;
    }
}
