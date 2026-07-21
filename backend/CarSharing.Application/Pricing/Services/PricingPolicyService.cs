using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.Pricing.Dtos;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;

namespace CarSharing.Application.Pricing.Services;

public sealed class PricingPolicyService : IPricingPolicyService
{
    private static readonly Error Unauthenticated = new("Pricing.Unauthenticated", "User must be authenticated.");
    private static readonly Error AdminRequired = new("Pricing.AdminRequired", "Only admin or super admin can update pricing mode.");
    private static readonly Error InvalidMode = new("Pricing.InvalidMode", "Pricing mode must be Standard, High, or Low.");

    private readonly IPricingPolicyRepository _pricingPolicyRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IUnitOfWork _unitOfWork;

    public PricingPolicyService(
        IPricingPolicyRepository pricingPolicyRepository,
        ICurrentUserService currentUser,
        IUnitOfWork unitOfWork)
    {
        _pricingPolicyRepository = pricingPolicyRepository;
        _currentUser = currentUser;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<PricingPolicyDto>> GetCurrentAsync(CancellationToken cancellationToken = default)
    {
        var policy = await GetOrCreatePolicyAsync(cancellationToken);
        return Result<PricingPolicyDto>.Success(ToDto(policy));
    }

    public async Task<Result<PricingPolicyDto>> UpdateModeAsync(
        UpdatePricingModeRequest request,
        CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null)
        {
            return Result<PricingPolicyDto>.Failure(accessError);
        }

        if (!Enum.IsDefined(typeof(PricingMode), request.Mode))
        {
            return Result<PricingPolicyDto>.Failure(InvalidMode);
        }

        var policy = await GetOrCreatePolicyAsync(cancellationToken);
        policy.ChangeMode(request.Mode, _currentUser.UserId, DateTime.UtcNow);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<PricingPolicyDto>.Success(ToDto(policy));
    }

    private async Task<PricingPolicy> GetOrCreatePolicyAsync(CancellationToken cancellationToken)
    {
        var policy = await _pricingPolicyRepository.GetCurrentAsync(cancellationToken);
        if (policy is not null)
        {
            return policy;
        }

        policy = PricingPolicy.CreateDefault(DateTime.UtcNow);
        await _pricingPolicyRepository.AddAsync(policy, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return policy;
    }

    private Error? RequireAdmin()
    {
        if (!_currentUser.IsAuthenticated)
        {
            return Unauthenticated;
        }

        return _currentUser.Role is UserRole.Admin or UserRole.SuperAdmin ? null : AdminRequired;
    }

    private static PricingPolicyDto ToDto(PricingPolicy policy)
    {
        var label = policy.Mode switch
        {
            PricingMode.High => "High demand",
            PricingMode.Low => "Low price",
            _ => "Standard"
        };

        var description = policy.Mode switch
        {
            PricingMode.High => "Adds 0.20 AZN per minute to every vehicle rate. The rate is locked when the trip starts.",
            PricingMode.Low => "Subtracts 0.10 AZN per minute from every vehicle rate. The rate is locked when the trip starts.",
            _ => "Uses the regular vehicle rate. The rate is locked when the trip starts."
        };

        return new PricingPolicyDto(
            policy.Id,
            policy.Mode,
            policy.AdjustmentAmount,
            label,
            description,
            policy.UpdatedByUserId,
            policy.UpdatedAt);
    }
}
