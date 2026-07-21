namespace CarSharing.Domain.Entities;

public class TripReview : BaseEntity
{
    private TripReview()
    {
    }

    public Guid TripId { get; private set; }
    public Guid UserId { get; private set; }
    public int Rating { get; private set; }
    public string Comment { get; private set; } = null!;
    public DateTime CreatedAt { get; private set; }
    public bool IsPublished { get; private set; }

    public static TripReview Create(Guid tripId, Guid userId, int rating, string comment, DateTime createdAt)
    {
        if (rating is < 1 or > 5)
        {
            throw new ArgumentOutOfRangeException(nameof(rating), "Rating must be between 1 and 5.");
        }

        if (string.IsNullOrWhiteSpace(comment))
        {
            throw new ArgumentException("Comment is required.", nameof(comment));
        }

        return new TripReview
        {
            Id = Guid.NewGuid(),
            TripId = tripId,
            UserId = userId,
            Rating = rating,
            Comment = comment.Trim(),
            CreatedAt = createdAt,
            IsPublished = true
        };
    }

    public void UpdateContent(int rating, string comment)
    {
        if (rating is < 1 or > 5)
        {
            throw new ArgumentOutOfRangeException(nameof(rating), "Rating must be between 1 and 5.");
        }

        if (string.IsNullOrWhiteSpace(comment))
        {
            throw new ArgumentException("Comment is required.", nameof(comment));
        }

        Rating = rating;
        Comment = comment.Trim();
    }

    public void Publish()
    {
        IsPublished = true;
    }

    public void Hide()
    {
        IsPublished = false;
    }
}
