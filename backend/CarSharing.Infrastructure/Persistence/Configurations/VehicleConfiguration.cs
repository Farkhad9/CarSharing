using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public class VehicleConfiguration : IEntityTypeConfiguration<Vehicle>
{
    public void Configure(EntityTypeBuilder<Vehicle> builder)
    {
        builder.ToTable("Vehicles");

        builder.HasKey(vehicle => vehicle.Id);

        builder.Property(vehicle => vehicle.Brand)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(vehicle => vehicle.Model)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(vehicle => vehicle.PlateNumber)
            .IsRequired()
            .HasMaxLength(20);

        builder.HasIndex(vehicle => vehicle.PlateNumber)
            .IsUnique();

        builder.Property(vehicle => vehicle.PricePerMinute)
            .HasPrecision(18, 2);

        builder.Property(vehicle => vehicle.Currency)
            .IsRequired()
            .HasMaxLength(3);

        builder.Property(vehicle => vehicle.Status)
            .IsRequired();

        builder.Property(vehicle => vehicle.Color)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(vehicle => vehicle.ConnectorType)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(vehicle => vehicle.LocationLabel)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(vehicle => vehicle.Zone)
            .IsRequired()
            .HasMaxLength(100);
    }
}
