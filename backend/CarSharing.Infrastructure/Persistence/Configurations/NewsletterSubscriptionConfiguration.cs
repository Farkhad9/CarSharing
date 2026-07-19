using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public sealed class NewsletterSubscriptionConfiguration : IEntityTypeConfiguration<NewsletterSubscription>
{
    public void Configure(EntityTypeBuilder<NewsletterSubscription> builder)
    {
        builder.ToTable("NewsletterSubscriptions");

        builder.HasKey(subscription => subscription.Id);

        builder.HasIndex(subscription => subscription.Email)
            .IsUnique();

        builder.Property(subscription => subscription.Email)
            .IsRequired()
            .HasMaxLength(320);

        builder.Property(subscription => subscription.CreatedAt)
            .IsRequired();

        builder.Property(subscription => subscription.IsActive)
            .IsRequired();
    }
}
