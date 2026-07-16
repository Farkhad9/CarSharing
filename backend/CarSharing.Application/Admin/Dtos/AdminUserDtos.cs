using CarSharing.Domain.Enums;

namespace CarSharing.Application.Admin.Dtos;

public sealed class AdminUsersQuery
{
    public string? Search { get; set; }
    public UserRole? Role { get; set; }
    public bool? IsActive { get; set; }
    public UserVerificationStatus? VerificationStatus { get; set; }
}

public sealed record AdminUserDto(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string Phone,
    string DriverLicenseNumber,
    string? DriverLicenseDocumentUrl,
    string? PassportDocumentUrl,
    decimal Balance,
    decimal PendingHold,
    bool EmailVerified,
    UserVerificationStatus VerificationStatus,
    UserRole Role,
    bool IsActive,
    string? BlockReason,
    DateTime? BlockedAt,
    DateTime? BlockedUntil,
    Guid? BlockedByUserId,
    DateTime CreatedAt,
    DateTime? VerificationSubmittedAt,
    DateTime? VerifiedAt);

public sealed record CreateStaffUserRequest(
    string FirstName,
    string LastName,
    string Email,
    string Phone,
    string Password,
    string DriverLicenseNumber);

public sealed record CreateAdminUserRequest(
    string FirstName,
    string LastName,
    string Email,
    string Phone,
    string Password,
    string DriverLicenseNumber,
    UserRole Role);

public sealed record UpdateUserRoleRequest(UserRole Role);

public sealed record UpdateUserStatusRequest(bool IsActive);

public sealed record BlockUserRequest(string Reason, UserBlockDuration Duration);

public enum UserBlockDuration
{
    FifteenMinutes = 1,
    OneDay = 2,
    Forever = 3
}

public sealed record UpdateUserVerificationRequest(UserVerificationStatus Status);
