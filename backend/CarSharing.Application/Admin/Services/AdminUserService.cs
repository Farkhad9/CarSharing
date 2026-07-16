using CarSharing.Application.Admin.Dtos;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using FluentValidation;

namespace CarSharing.Application.Admin.Services;

public sealed class AdminUserService : IAdminUserService
{
    private static readonly Error Unauthenticated = new("AdminUsers.Unauthenticated", "User is not authenticated.");
    private static readonly Error AdminRequired = new("AdminUsers.AdminRequired", "Admin access is required.");
    private static readonly Error SuperAdminRequired = new("AdminUsers.SuperAdminRequired", "Super admin access is required.");
    private static readonly Error NotFound = new("AdminUsers.NotFound", "User was not found.");
    private static readonly Error EmailNotUnique = new("AdminUsers.EmailNotUnique", "User with this email already exists.");
    private static readonly Error CannotDisableSelf = new("AdminUsers.CannotDisableSelf", "You cannot disable your own account.");
    private static readonly Error CannotManageSuperAdmin = new("AdminUsers.CannotManageSuperAdmin", "Only SuperAdmin can manage a SuperAdmin account.");
    private static readonly Error CannotManageAdminAccount = new("AdminUsers.CannotManageAdminAccount", "Only SuperAdmin can manage admin accounts.");
    private static readonly Error CannotVerifyInternalUser = new("AdminUsers.CannotVerifyInternalUser", "Internal users do not use rider verification.");

    private readonly IUserRepository _userRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IValidator<CreateStaffUserRequest> _createStaffValidator;
    private readonly IValidator<CreateAdminUserRequest> _createAdminValidator;
    private readonly IValidator<UpdateUserRoleRequest> _updateRoleValidator;
    private readonly IValidator<UpdateUserVerificationRequest> _updateVerificationValidator;
    private readonly IValidator<BlockUserRequest> _blockUserValidator;

    public AdminUserService(
        IUserRepository userRepository,
        ICurrentUserService currentUser,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        IValidator<CreateStaffUserRequest> createStaffValidator,
        IValidator<CreateAdminUserRequest> createAdminValidator,
        IValidator<UpdateUserRoleRequest> updateRoleValidator,
        IValidator<UpdateUserVerificationRequest> updateVerificationValidator,
        IValidator<BlockUserRequest> blockUserValidator)
    {
        _userRepository = userRepository;
        _currentUser = currentUser;
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _createStaffValidator = createStaffValidator;
        _createAdminValidator = createAdminValidator;
        _updateRoleValidator = updateRoleValidator;
        _updateVerificationValidator = updateVerificationValidator;
        _blockUserValidator = blockUserValidator;
    }

    public async Task<Result<IReadOnlyList<AdminUserDto>>> GetUsersAsync(
        AdminUsersQuery query,
        CancellationToken cancellationToken = default)
    {
        var access = RequireAdmin();
        if (access is not null)
        {
            return Result<IReadOnlyList<AdminUserDto>>.Failure(access);
        }

        var users = await _userRepository.GetAllAsync(
            query.Search,
            query.Role,
            query.IsActive,
            query.VerificationStatus,
            cancellationToken);

        return Result<IReadOnlyList<AdminUserDto>>.Success(users.Select(ToDto).ToList());
    }

    public async Task<Result<AdminUserDto>> GetUserAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var access = RequireAdmin();
        if (access is not null)
        {
            return Result<AdminUserDto>.Failure(access);
        }

        var user = await _userRepository.GetByIdAsync(id, cancellationToken);
        return user is null
            ? Result<AdminUserDto>.Failure(NotFound)
            : Result<AdminUserDto>.Success(ToDto(user));
    }

    public async Task<Result<AdminUserDto>> CreateStaffAsync(
        CreateStaffUserRequest request,
        CancellationToken cancellationToken = default)
    {
        var access = RequireAdmin();
        if (access is not null)
        {
            return Result<AdminUserDto>.Failure(access);
        }

        var validation = await _createStaffValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return Result<AdminUserDto>.Failure(ToValidationErrors(validation));
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await _userRepository.ExistsByEmailAsync(normalizedEmail, cancellationToken))
        {
            return Result<AdminUserDto>.Failure(EmailNotUnique);
        }

        var user = User.CreateStaff(
            request.FirstName,
            request.LastName,
            normalizedEmail,
            request.Phone,
            _passwordHasher.Hash(request.Password),
            request.DriverLicenseNumber);

        await _userRepository.AddAsync(user, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<AdminUserDto>.Success(ToDto(user));
    }

    public async Task<Result<AdminUserDto>> BlockUserAsync(
        Guid id,
        BlockUserRequest request,
        CancellationToken cancellationToken = default)
    {
        var access = RequireAdmin();
        if (access is not null)
        {
            return Result<AdminUserDto>.Failure(access);
        }

        var validation = await _blockUserValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return Result<AdminUserDto>.Failure(ToValidationErrors(validation));
        }

        var user = await _userRepository.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return Result<AdminUserDto>.Failure(NotFound);
        }

        if (user.Id == _currentUser.UserId)
        {
            return Result<AdminUserDto>.Failure(CannotDisableSelf);
        }

        var managementError = EnsureCanManage(user);
        if (managementError is not null)
        {
            return Result<AdminUserDto>.Failure(managementError);
        }

        var now = DateTime.UtcNow;
        user.Block(request.Reason, GetBlockedUntil(request.Duration, now), _currentUser.UserId, now);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<AdminUserDto>.Success(ToDto(user));
    }

    public async Task<Result<AdminUserDto>> UnblockUserAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var access = RequireAdmin();
        if (access is not null)
        {
            return Result<AdminUserDto>.Failure(access);
        }

        var user = await _userRepository.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return Result<AdminUserDto>.Failure(NotFound);
        }

        var managementError = EnsureCanManage(user);
        if (managementError is not null)
        {
            return Result<AdminUserDto>.Failure(managementError);
        }

        user.Unblock();
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<AdminUserDto>.Success(ToDto(user));
    }

    public async Task<Result<AdminUserDto>> CreateAdminAsync(
        CreateAdminUserRequest request,
        CancellationToken cancellationToken = default)
    {
        var access = RequireSuperAdmin();
        if (access is not null)
        {
            return Result<AdminUserDto>.Failure(access);
        }

        var validation = await _createAdminValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return Result<AdminUserDto>.Failure(ToValidationErrors(validation));
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await _userRepository.ExistsByEmailAsync(normalizedEmail, cancellationToken))
        {
            return Result<AdminUserDto>.Failure(EmailNotUnique);
        }

        var passwordHash = _passwordHasher.Hash(request.Password);
        var user = request.Role == UserRole.SuperAdmin
            ? User.CreateSuperAdmin(request.FirstName, request.LastName, normalizedEmail, request.Phone, passwordHash, request.DriverLicenseNumber)
            : User.CreateAdmin(request.FirstName, request.LastName, normalizedEmail, request.Phone, passwordHash, request.DriverLicenseNumber);

        await _userRepository.AddAsync(user, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<AdminUserDto>.Success(ToDto(user));
    }

    public async Task<Result<AdminUserDto>> UpdateRoleAsync(
        Guid id,
        UpdateUserRoleRequest request,
        CancellationToken cancellationToken = default)
    {
        var access = RequireSuperAdmin();
        if (access is not null)
        {
            return Result<AdminUserDto>.Failure(access);
        }

        var validation = await _updateRoleValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return Result<AdminUserDto>.Failure(ToValidationErrors(validation));
        }

        var user = await _userRepository.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return Result<AdminUserDto>.Failure(NotFound);
        }

        user.ChangeRole(request.Role);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<AdminUserDto>.Success(ToDto(user));
    }

    public async Task<Result<AdminUserDto>> UpdateStatusAsync(
        Guid id,
        UpdateUserStatusRequest request,
        CancellationToken cancellationToken = default)
    {
        var access = RequireAdmin();
        if (access is not null)
        {
            return Result<AdminUserDto>.Failure(access);
        }

        var user = await _userRepository.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return Result<AdminUserDto>.Failure(NotFound);
        }

        if (!request.IsActive && user.Id == _currentUser.UserId)
        {
            return Result<AdminUserDto>.Failure(CannotDisableSelf);
        }

        var managementError = EnsureCanManage(user);
        if (managementError is not null)
        {
            return Result<AdminUserDto>.Failure(managementError);
        }

        if (request.IsActive)
        {
            user.Activate();
        }
        else
        {
            user.Deactivate();
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<AdminUserDto>.Success(ToDto(user));
    }

    public async Task<Result<AdminUserDto>> UpdateVerificationAsync(
        Guid id,
        UpdateUserVerificationRequest request,
        CancellationToken cancellationToken = default)
    {
        var access = RequireAdmin();
        if (access is not null)
        {
            return Result<AdminUserDto>.Failure(access);
        }

        var validation = await _updateVerificationValidator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return Result<AdminUserDto>.Failure(ToValidationErrors(validation));
        }

        var user = await _userRepository.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return Result<AdminUserDto>.Failure(NotFound);
        }

        if (user.Role != UserRole.Rider)
        {
            return Result<AdminUserDto>.Failure(CannotVerifyInternalUser);
        }

        if (request.Status == UserVerificationStatus.Verified)
        {
            user.ApproveVerification();
        }
        else
        {
            user.RejectVerification();
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<AdminUserDto>.Success(ToDto(user));
    }

    private Error? RequireAdmin()
    {
        if (!_currentUser.IsAuthenticated)
        {
            return Unauthenticated;
        }

        return _currentUser.Role is UserRole.Admin or UserRole.SuperAdmin
            ? null
            : AdminRequired;
    }

    private Error? RequireSuperAdmin()
    {
        if (!_currentUser.IsAuthenticated)
        {
            return Unauthenticated;
        }

        return _currentUser.Role == UserRole.SuperAdmin ? null : SuperAdminRequired;
    }

    private Error? EnsureCanManage(User target)
    {
        if (_currentUser.Role == UserRole.SuperAdmin)
        {
            return null;
        }

        return target.Role switch
        {
            UserRole.SuperAdmin => CannotManageSuperAdmin,
            UserRole.Admin => CannotManageAdminAccount,
            _ => null
        };
    }

    private static IReadOnlyList<Error> ToValidationErrors(FluentValidation.Results.ValidationResult validationResult)
    {
        return validationResult.Errors
            .Select(error => new Error($"Validation.{error.PropertyName}", error.ErrorMessage))
            .ToList();
    }

    private static AdminUserDto ToDto(User user)
    {
        return new AdminUserDto(
            user.Id,
            user.FirstName,
            user.LastName,
            user.Email,
            user.Phone,
            user.DriverLicenseNumber,
            user.DriverLicenseDocumentUrl,
            user.PassportDocumentUrl,
            user.Balance,
            user.PendingHold,
            user.EmailVerified,
            user.VerificationStatus,
            user.Role,
            user.IsActive,
            user.BlockReason,
            user.BlockedAt,
            user.BlockedUntil,
            user.BlockedByUserId,
            user.CreatedAt,
            user.VerificationSubmittedAt,
            user.VerifiedAt);
    }

    private static DateTime? GetBlockedUntil(UserBlockDuration duration, DateTime now)
    {
        return duration switch
        {
            UserBlockDuration.FifteenMinutes => now.AddMinutes(15),
            UserBlockDuration.OneDay => now.AddDays(1),
            UserBlockDuration.Forever => null,
            _ => throw new ArgumentOutOfRangeException(nameof(duration), duration, null)
        };
    }
}
