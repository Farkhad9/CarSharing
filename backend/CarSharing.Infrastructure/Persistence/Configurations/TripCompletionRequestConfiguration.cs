using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public class TripCompletionRequestConfiguration : IEntityTypeConfiguration<TripCompletionRequest>
{
    public void Configure(EntityTypeBuilder<TripCompletionRequest> builder)
    {
        builder.ToTable("TripCompletionRequests");

        builder.HasKey(request => request.Id);

        builder.Property(request => request.Status)
            .IsRequired();

        builder.Property(request => request.BaseRideCost)
            .HasPrecision(18, 2);

        builder.Property(request => request.DiscountAmount)
            .HasPrecision(18, 2);

        builder.Property(request => request.FinalRideCost)
            .HasPrecision(18, 2);

        builder.Property(request => request.Currency)
            .IsRequired()
            .HasMaxLength(3);

        builder.Property(request => request.PromoCode)
            .HasMaxLength(50);

        builder.Property(request => request.RejectionReason)
            .HasMaxLength(500);

        builder.HasMany(request => request.Photos)
            .WithOne()
            .HasForeignKey(photo => photo.TripCompletionRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(request => request.Photos)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasOne<Trip>()
            .WithMany()
            .HasForeignKey(request => request.TripId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(request => new { request.TripId, request.AttemptNumber })
            .IsUnique();

        builder.HasIndex(request => request.Status);
        builder.HasIndex(request => request.UserId);
        builder.HasIndex(request => request.AssigneeId);
    }
}
