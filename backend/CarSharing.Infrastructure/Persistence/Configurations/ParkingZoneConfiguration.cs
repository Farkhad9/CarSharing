using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public sealed class ParkingZoneConfiguration : IEntityTypeConfiguration<ParkingZone>
{
    public void Configure(EntityTypeBuilder<ParkingZone> builder)
    {
        builder.ToTable("ParkingZones");

        builder.HasKey(zone => zone.Id);

        builder.Property(zone => zone.Name)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(zone => zone.Type)
            .IsRequired();

        builder.Property(zone => zone.BoundaryJson)
            .IsRequired()
            .HasColumnType("nvarchar(max)");

        builder.Property(zone => zone.AllowsTripEnd)
            .IsRequired();

        builder.Property(zone => zone.IsActive)
            .IsRequired();

        builder.HasIndex(zone => zone.Type);
        builder.HasIndex(zone => zone.IsActive);
    }
}
