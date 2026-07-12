using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CarSharing.Infrastructure.Persistence.Configurations;

public sealed class PaymentTransactionConfiguration : IEntityTypeConfiguration<PaymentTransaction>
{
    public void Configure(EntityTypeBuilder<PaymentTransaction> builder)
    {
        builder.ToTable("PaymentTransactions");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.Property(x => x.Currency).IsRequired().HasMaxLength(3);
        builder.Property(x => x.PaymentMethod).HasMaxLength(50);
        builder.Property(x => x.ExternalReference).HasMaxLength(255);
        builder.Property(x => x.CardBrand).HasMaxLength(30);
        builder.Property(x => x.CardLast4).HasMaxLength(4);
        builder.Property(x => x.FailureReason).HasMaxLength(500);
        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => x.TripId);
        builder.HasIndex(x => x.ExternalReference).IsUnique().HasFilter("[ExternalReference] IS NOT NULL");
        builder.HasIndex(x => x.TripId).IsUnique()
            .HasFilter($"[TripId] IS NOT NULL AND [Type] = {(int)PaymentTransactionType.RidePayment} AND [Status] = {(int)PaymentTransactionStatus.Completed}");
    }
}
