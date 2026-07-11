using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public class TripCompletionPhotoConfiguration : IEntityTypeConfiguration<TripCompletionPhoto>
{
    public void Configure(EntityTypeBuilder<TripCompletionPhoto> builder)
    {
        builder.ToTable("TripCompletionPhotos");

        builder.HasKey(photo => photo.Id);

        builder.Property(photo => photo.Angle)
            .IsRequired();

        builder.Property(photo => photo.FileUrl)
            .IsRequired()
            .HasMaxLength(1000);

        builder.HasIndex(photo => new { photo.TripCompletionRequestId, photo.Angle })
            .IsUnique();
    }
}
