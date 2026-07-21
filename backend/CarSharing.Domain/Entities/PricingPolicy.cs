using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class PricingPolicy : BaseEntity
{
    public static readonly Guid DefaultId = Guid.Parse("b5f9cf72-6528-4a3f-a2a2-8e10c9843d95");

    private PricingPolicy()
    {
    }

    public PricingMode Mode { get; private set; }
    public decimal AdjustmentAmount { get; private set; }
    public Guid? UpdatedByUserId { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public static PricingPolicy CreateDefault(DateTime createdAt)
    {
        return new PricingPolicy
        {
            Id = DefaultId,
            Mode = PricingMode.Standard,
            AdjustmentAmount = 0m,
            UpdatedAt = createdAt
        };
    }

    public void ChangeMode(PricingMode mode, Guid? updatedByUserId, DateTime updatedAt)
    {
        Mode = mode;
        AdjustmentAmount = GetAdjustmentAmount(mode);
        UpdatedByUserId = updatedByUserId;
        UpdatedAt = updatedAt;
    }

    public static decimal GetAdjustmentAmount(PricingMode mode)
    {
        return mode switch
        {
            PricingMode.High => 0.20m,
            PricingMode.Low => -0.10m,
            PricingMode.Standard => 0m,
            _ => throw new ArgumentOutOfRangeException(nameof(mode), mode, null)
        };
    }
}
