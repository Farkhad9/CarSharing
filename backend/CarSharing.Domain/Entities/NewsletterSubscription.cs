namespace CarSharing.Domain.Entities;

public class NewsletterSubscription : BaseEntity
{
    private NewsletterSubscription()
    {
    }

    public string Email { get; private set; } = null!;
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public bool IsActive { get; private set; }

    public static NewsletterSubscription Create(string email, DateTime createdAt)
    {
        return new NewsletterSubscription
        {
            Id = Guid.NewGuid(),
            Email = NormalizeEmail(email),
            CreatedAt = createdAt,
            IsActive = true
        };
    }

    public void Reactivate(DateTime updatedAt)
    {
        IsActive = true;
        UpdatedAt = updatedAt;
    }

    public static string NormalizeEmail(string email)
    {
        return email.Trim().ToLowerInvariant();
    }
}
