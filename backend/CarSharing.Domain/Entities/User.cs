using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class User : BaseEntity
{
    private User()
    {
    }

    public string FirstName { get; private set; } = null!;
    public string LastName { get; private set; } = null!;
    public string Email { get; private set; } = null!;
    public string Phone { get; private set; } = null!;
    public string PasswordHash { get; private set; } = null!;
    public decimal Balance { get; private set; }
    public decimal PendingHold { get; private set; }
    public string DriverLicenseNumber { get; private set; } = null!;
    public string? DriverLicenseDocumentUrl { get; private set; }
    public string? PassportDocumentUrl { get; private set; }
    public bool EmailVerified { get; private set; }
    public UserVerificationStatus VerificationStatus { get; private set; } = UserVerificationStatus.Pending;
    public UserRole Role { get; private set; } = UserRole.Rider;
    public bool IsActive { get; private set; } = true;
    public DateTime CreatedAt { get; private set; }
    public DateTime? VerificationSubmittedAt { get; private set; }
    public DateTime? VerifiedAt { get; private set; }
    public string? BlockReason { get; private set; }
    public DateTime? BlockedAt { get; private set; }
    public DateTime? BlockedUntil { get; private set; }
    public Guid? BlockedByUserId { get; private set; }
    public string? RefreshTokenHash { get; private set; }
    public DateTime? RefreshTokenExpiresAt { get; private set; }

    public static User CreateRider(
        string firstName,
        string lastName,
        string email,
        string phone,
        string passwordHash,
        string driverLicenseNumber)
    {
        return new User
        {
            Id = Guid.NewGuid(),
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            Email = email.Trim().ToLowerInvariant(),
            Phone = phone.Trim(),
            PasswordHash = passwordHash,
            Balance = 0,
            PendingHold = 0,
            DriverLicenseNumber = driverLicenseNumber.Trim(),
            EmailVerified = false,
            VerificationStatus = UserVerificationStatus.Pending,
            Role = UserRole.Rider,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            VerifiedAt = null
        };
    }

    public static User CreateAdmin(
        string firstName,
        string lastName,
        string email,
        string phone,
        string passwordHash,
        string driverLicenseNumber)
    {
        var now = DateTime.UtcNow;

        return new User
        {
            Id = Guid.NewGuid(),
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            Email = email.Trim().ToLowerInvariant(),
            Phone = phone.Trim(),
            PasswordHash = passwordHash,
            Balance = 0,
            PendingHold = 0,
            DriverLicenseNumber = driverLicenseNumber.Trim(),
            EmailVerified = true,
            VerificationStatus = UserVerificationStatus.Internal,
            Role = UserRole.Admin,
            IsActive = true,
            CreatedAt = now,
            VerifiedAt = now
        };
    }

    public static User CreateStaff(
        string firstName,
        string lastName,
        string email,
        string phone,
        string passwordHash,
        string driverLicenseNumber)
    {
        return CreateInternalUser(firstName, lastName, email, phone, passwordHash, driverLicenseNumber, UserRole.Staff);
    }

    public static User CreateSuperAdmin(
        string firstName,
        string lastName,
        string email,
        string phone,
        string passwordHash,
        string driverLicenseNumber)
    {
        return CreateInternalUser(firstName, lastName, email, phone, passwordHash, driverLicenseNumber, UserRole.SuperAdmin);
    }

    public void VerifyEmail()
    {
        EmailVerified = true;
        VerifiedAt = DateTime.UtcNow;
    }

    public void ApproveVerification()
    {
        VerificationStatus = UserVerificationStatus.Verified;
        VerifiedAt = DateTime.UtcNow;
    }

    public void RejectVerification()
    {
        VerificationStatus = UserVerificationStatus.Rejected;
        VerifiedAt = null;
    }

    public void ResetVerificationToPending()
    {
        VerificationStatus = UserVerificationStatus.Pending;
        VerifiedAt = null;
    }

    public void SubmitVerificationDocuments(string driverLicenseDocumentUrl, string passportDocumentUrl, DateTime submittedAt)
    {
        DriverLicenseDocumentUrl = driverLicenseDocumentUrl.Trim();
        PassportDocumentUrl = passportDocumentUrl.Trim();
        VerificationStatus = UserVerificationStatus.Pending;
        VerificationSubmittedAt = submittedAt;
        VerifiedAt = null;
    }

    public void ChangeRole(UserRole role)
    {
        Role = role;
        if (role is UserRole.Admin or UserRole.SuperAdmin or UserRole.Staff)
        {
            EmailVerified = true;
            VerificationStatus = UserVerificationStatus.Internal;
            VerifiedAt ??= DateTime.UtcNow;
        }
    }

    public void Activate()
    {
        Unblock();
    }

    public void Deactivate()
    {
        Block("Account disabled.", null, null, DateTime.UtcNow);
    }

    public void Block(string reason, DateTime? blockedUntil, Guid? blockedByUserId, DateTime blockedAt)
    {
        IsActive = false;
        BlockReason = reason.Trim();
        BlockedAt = blockedAt;
        BlockedUntil = blockedUntil;
        BlockedByUserId = blockedByUserId;
        RevokeRefreshToken();
    }

    public void Unblock()
    {
        IsActive = true;
        BlockReason = null;
        BlockedAt = null;
        BlockedUntil = null;
        BlockedByUserId = null;
    }

    public bool IsBlocked(DateTime utcNow)
    {
        return !IsActive && (!BlockedUntil.HasValue || BlockedUntil.Value > utcNow);
    }

    public bool TryExpireBlock(DateTime utcNow)
    {
        if (IsActive || !BlockedUntil.HasValue || BlockedUntil.Value > utcNow)
        {
            return false;
        }

        Unblock();
        return true;
    }

    public void SetRefreshToken(string refreshTokenHash, DateTime expiresAt)
    {
        RefreshTokenHash = refreshTokenHash;
        RefreshTokenExpiresAt = expiresAt;
    }

    public bool HasValidRefreshToken(string refreshTokenHash, DateTime utcNow)
    {
        return RefreshTokenHash == refreshTokenHash
            && RefreshTokenExpiresAt.HasValue
            && RefreshTokenExpiresAt.Value > utcNow;
    }

    public void RevokeRefreshToken()
    {
        RefreshTokenHash = null;
        RefreshTokenExpiresAt = null;
    }

    public void CreditBalance(decimal amount)
    {
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount));
        Balance += amount;
    }

    public bool TryDebitBalance(decimal amount)
    {
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount));
        if (Balance < amount) return false;
        Balance -= amount;
        return true;
    }

    private static User CreateInternalUser(
        string firstName,
        string lastName,
        string email,
        string phone,
        string passwordHash,
        string driverLicenseNumber,
        UserRole role)
    {
        var now = DateTime.UtcNow;

        return new User
        {
            Id = Guid.NewGuid(),
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            Email = email.Trim().ToLowerInvariant(),
            Phone = phone.Trim(),
            PasswordHash = passwordHash,
            Balance = 0,
            PendingHold = 0,
            DriverLicenseNumber = driverLicenseNumber.Trim(),
            EmailVerified = true,
            VerificationStatus = UserVerificationStatus.Internal,
            Role = role,
            IsActive = true,
            CreatedAt = now,
            VerifiedAt = now
        };
    }
}
