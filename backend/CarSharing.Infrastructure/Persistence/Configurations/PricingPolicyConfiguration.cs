using CarSharing.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public sealed class PricingPolicyConfiguration : IEntityTypeConfiguration<PricingPolicy>
{
    public void Configure(EntityTypeBuilder<PricingPolicy> builder)
    {
        builder.ToTable("PricingPolicies");

        builder.HasKey(policy => policy.Id);

        builder.Property(policy => policy.Mode)
            .IsRequired();

        builder.Property(policy => policy.AdjustmentAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(policy => policy.UpdatedAt)
            .IsRequired();
    }
}
