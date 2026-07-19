using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public sealed class TripReviewConfiguration : IEntityTypeConfiguration<TripReview>
{
    public void Configure(EntityTypeBuilder<TripReview> builder)
    {
        builder.ToTable("TripReviews");

        builder.HasKey(review => review.Id);

        builder.HasIndex(review => review.TripId)
            .IsUnique();

        builder.Property(review => review.Comment)
            .IsRequired()
            .HasMaxLength(600);

        builder.Property(review => review.Rating)
            .IsRequired();

        builder.Property(review => review.CreatedAt)
            .IsRequired();

        builder.Property(review => review.IsPublished)
            .IsRequired();
    }
}
