using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public sealed class ChargingStationConfiguration : IEntityTypeConfiguration<ChargingStation>
{
    public void Configure(EntityTypeBuilder<ChargingStation> builder)
    {
        builder.ToTable("ChargingStations");

        builder.HasKey(station => station.Id);

        builder.Property(station => station.Name)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(station => station.Status)
            .IsRequired();

        builder.Property(station => station.LocationLabel)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(station => station.Zone)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(station => station.ConnectorTypes)
            .IsRequired()
            .HasMaxLength(300);

        builder.HasIndex(station => station.Status);
        builder.HasIndex(station => station.Zone);
    }
}
