using CarSharing.Domain.Entities;
using Xunit;

namespace CarSharing.Application.Tests;

public sealed class TripReviewEntityTests
{
    [Fact]
    public void Create_TrimsCommentAndPublishesReview()
    {
        var createdAt = DateTime.UtcNow;

        var review = TripReview.Create(Guid.NewGuid(), Guid.NewGuid(), 5, "  Great ride  ", createdAt);

        Assert.Equal(5, review.Rating);
        Assert.Equal("Great ride", review.Comment);
        Assert.Equal(createdAt, review.CreatedAt);
        Assert.True(review.IsPublished);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public void Create_WithInvalidRating_Throws(int rating)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            TripReview.Create(Guid.NewGuid(), Guid.NewGuid(), rating, "Good", DateTime.UtcNow));
    }

    [Fact]
    public void UpdateContent_ValidatesRatingAndComment()
    {
        var review = TripReview.Create(Guid.NewGuid(), Guid.NewGuid(), 4, "Good", DateTime.UtcNow);

        Assert.Throws<ArgumentOutOfRangeException>(() => review.UpdateContent(6, "Still good"));
        Assert.Throws<ArgumentException>(() => review.UpdateContent(5, "   "));

        review.UpdateContent(5, "  Excellent  ");

        Assert.Equal(5, review.Rating);
        Assert.Equal("Excellent", review.Comment);
    }

    [Fact]
    public void HideAndPublish_TogglesVisibility()
    {
        var review = TripReview.Create(Guid.NewGuid(), Guid.NewGuid(), 4, "Good", DateTime.UtcNow);

        review.Hide();
        Assert.False(review.IsPublished);

        review.Publish();
        Assert.True(review.IsPublished);
    }
}
