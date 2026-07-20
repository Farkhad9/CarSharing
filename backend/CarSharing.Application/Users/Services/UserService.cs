using AutoMapper;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.Users.Dtos;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using FluentValidation;
using System.Security.Cryptography;
using System.Text;

namespace CarSharing.Application.Users.Services;

public class UserService : IUserService
{
    private const int AccessTokenExpirationMinutes = 60;
    private const int RefreshTokenExpirationDays = 14;
    private const int PasswordResetExpirationMinutes = 45;
    private const int MaxPasswordResetCodeAttempts = 5;
    private const string PasswordResetSafeMessage = "If an account exists, reset instructions were sent.";
    private const string ExternalLoginPasswordMarker = "EXTERNAL_LOGIN_ONLY";

    private static readonly Error EmailNotUnique = new("User.EmailNotUnique", "User with this email already exists.");
    private static readonly Error PhoneNotUnique = new("User.PhoneNotUnique", "User with this phone number already exists.");
    private static readonly Error DriverLicenseNotUnique = new("User.DriverLicenseNotUnique", "User with this driver license number already exists.");
    private static readonly Error InvalidCredentials = new("User.InvalidCredentials", "Invalid email or password.");
    private static readonly Error InvalidCurrentPassword = new("User.InvalidCurrentPassword", "Current password is incorrect.");
    private static readonly Error NotFound = new("User.NotFound", "User was not found.");
    private static readonly Error InvalidRefreshToken = new("User.InvalidRefreshToken", "Refresh token is invalid or expired.");
    private static readonly Error Disabled = new("User.Disabled", "User account is disabled.");
    private static readonly Error InvalidPasswordResetToken = new("User.InvalidPasswordResetToken", "Reset link is invalid or expired.");
    private static readonly Error ExternalLoginNotAllowed = new("User.ExternalLoginNotAllowed", "Use the dedicated staff or admin sign-in for this account.");
    private static readonly Error PasswordAlreadySet = new("User.PasswordAlreadySet", "Password is already set for this account.");
    private static readonly Error PasswordNotSet = new("User.PasswordNotSet", "Password is not set for this account yet.");

    private readonly IUserRepository _userRepository;
    private readonly IUserExternalLoginRepository _userExternalLoginRepository;
    private readonly IPasswordResetTokenRepository _passwordResetTokenRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IPasswordResetEmailSender _passwordResetEmailSender;
    private readonly IAccountSecurityEmailSender _accountSecurityEmailSender;
    private readonly IMapper _mapper;
    private readonly IValidator<RegisterUserRequest> _registerUserValidator;
    private readonly IValidator<LoginUserRequest> _loginUserValidator;
    private readonly IValidator<RequestPasswordResetRequest> _requestPasswordResetValidator;
    private readonly IValidator<ResetPasswordRequest> _resetPasswordValidator;
    private readonly IValidator<ChangePasswordRequest> _changePasswordValidator;
    private readonly IValidator<SetPasswordRequest> _setPasswordValidator;

    public UserService(
        IUserRepository userRepository,
        IUserExternalLoginRepository userExternalLoginRepository,
        IPasswordResetTokenRepository passwordResetTokenRepository,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        IJwtTokenGenerator jwtTokenGenerator,
        IPasswordResetEmailSender passwordResetEmailSender,
        IAccountSecurityEmailSender accountSecurityEmailSender,
        IMapper mapper,
        IValidator<RegisterUserRequest> registerUserValidator,
        IValidator<LoginUserRequest> loginUserValidator,
        IValidator<RequestPasswordResetRequest> requestPasswordResetValidator,
        IValidator<ResetPasswordRequest> resetPasswordValidator,
        IValidator<ChangePasswordRequest> changePasswordValidator,
        IValidator<SetPasswordRequest> setPasswordValidator)
    {
        _userRepository = userRepository;
        _userExternalLoginRepository = userExternalLoginRepository;
        _passwordResetTokenRepository = passwordResetTokenRepository;
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _jwtTokenGenerator = jwtTokenGenerator;
        _passwordResetEmailSender = passwordResetEmailSender;
        _accountSecurityEmailSender = accountSecurityEmailSender;
        _mapper = mapper;
        _registerUserValidator = registerUserValidator;
        _loginUserValidator = loginUserValidator;
        _requestPasswordResetValidator = requestPasswordResetValidator;
        _resetPasswordValidator = resetPasswordValidator;
        _changePasswordValidator = changePasswordValidator;
        _setPasswordValidator = setPasswordValidator;
    }

    public async Task<Result<UserDto>> RegisterAsync(RegisterUserRequest request, CancellationToken cancellationToken = default)
    {
        var validationResult = await _registerUserValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<UserDto>.Failure(ToValidationErrors(validationResult));
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var normalizedPhone = NormalizeAzerbaijanPhone(request.Phone);
        if (await _userRepository.ExistsByEmailAsync(normalizedEmail, cancellationToken))
        {
            return Result<UserDto>.Failure(EmailNotUnique);
        }

        if (await _userRepository.ExistsByPhoneAsync(normalizedPhone, cancellationToken))
        {
            return Result<UserDto>.Failure(PhoneNotUnique);
        }

        var normalizedDriverLicenseNumber = NormalizeDriverLicenseNumber(request.DriverLicenseNumber);
        if (await _userRepository.ExistsByDriverLicenseNumberAsync(normalizedDriverLicenseNumber, cancellationToken))
        {
            return Result<UserDto>.Failure(DriverLicenseNotUnique);
        }

        var user = User.CreateRider(
            request.FirstName,
            request.LastName,
            normalizedEmail,
            normalizedPhone,
            _passwordHasher.Hash(request.Password),
            normalizedDriverLicenseNumber);

        await _userRepository.AddAsync(user, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<UserDto>.Success(_mapper.Map<UserDto>(user));
    }

    public async Task<Result<AuthResponse>> LoginAsync(LoginUserRequest request, CancellationToken cancellationToken = default)
    {
        var validationResult = await _loginUserValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<AuthResponse>.Failure(ToValidationErrors(validationResult));
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _userRepository.GetByEmailAsync(normalizedEmail, cancellationToken);

        if (user is null || !_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            return Result<AuthResponse>.Failure(InvalidCredentials);
        }

        var now = DateTime.UtcNow;
        if (user.IsBlocked(now))
        {
            return Result<AuthResponse>.Failure(ToBlockedError(user));
        }

        if (user.TryExpireBlock(now))
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        if (!user.IsActive)
        {
            return Result<AuthResponse>.Failure(Disabled);
        }

        var response = IssueTokens(user);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<AuthResponse>.Success(response);
    }

    public async Task<Result<AuthResponse>> ExternalLoginAsync(
        ExternalLoginRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Provider) ||
            string.IsNullOrWhiteSpace(request.ProviderUserId) ||
            string.IsNullOrWhiteSpace(request.Email))
        {
            return Result<AuthResponse>.Failure(InvalidCredentials);
        }

        var provider = NormalizeExternalProvider(request.Provider);
        var providerUserId = request.ProviderUserId.Trim();
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var externalLogin = await _userExternalLoginRepository.GetByProviderAsync(provider, providerUserId, cancellationToken);
        var user = externalLogin is null
            ? await _userRepository.GetByEmailAsync(normalizedEmail, cancellationToken)
            : await _userRepository.GetByIdAsync(externalLogin.UserId, cancellationToken);

        if (user is null)
        {
            var now = DateTime.UtcNow;
            user = User.CreateExternalRider(
                request.FirstName ?? "ElectroStreet",
                request.LastName ?? "Rider",
                normalizedEmail,
                GenerateExternalPlaceholder("phone", provider, providerUserId),
                $"{ExternalLoginPasswordMarker}:{Guid.NewGuid():N}",
                GenerateExternalPlaceholder("lic", provider, providerUserId).ToUpperInvariant(),
                now);

            await _userRepository.AddAsync(user, cancellationToken);
            await _userExternalLoginRepository.AddAsync(
                UserExternalLogin.Create(user.Id, provider, providerUserId, now),
                cancellationToken);
        }
        else
        {
            if (user.Role != UserRole.Rider)
            {
                return Result<AuthResponse>.Failure(ExternalLoginNotAllowed);
            }

            if (!user.IsActive)
            {
                return Result<AuthResponse>.Failure(Disabled);
            }

            if (externalLogin is null &&
                !await _userExternalLoginRepository.ExistsAsync(user.Id, provider, providerUserId, cancellationToken))
            {
                await _userExternalLoginRepository.AddAsync(
                    UserExternalLogin.Create(user.Id, provider, providerUserId, DateTime.UtcNow),
                    cancellationToken);
            }
        }

        var response = IssueTokens(user);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<AuthResponse>.Success(response);
    }

    public async Task<Result<AuthResponse>> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return Result<AuthResponse>.Failure(InvalidRefreshToken);
        }

        var refreshTokenHash = HashRefreshToken(refreshToken);
        var user = await _userRepository.GetByRefreshTokenHashAsync(refreshTokenHash, cancellationToken);

        if (user is null || !user.HasValidRefreshToken(refreshTokenHash, DateTime.UtcNow))
        {
            return Result<AuthResponse>.Failure(InvalidRefreshToken);
        }

        var now = DateTime.UtcNow;
        if (user.IsBlocked(now))
        {
            return Result<AuthResponse>.Failure(ToBlockedError(user));
        }

        if (user.TryExpireBlock(now))
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        if (!user.IsActive)
        {
            return Result<AuthResponse>.Failure(Disabled);
        }

        var response = IssueTokens(user);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<AuthResponse>.Success(response);
    }

    public async Task<Result<bool>> LogoutAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return Result<bool>.Success(true);
        }

        var refreshTokenHash = HashRefreshToken(refreshToken);
        var user = await _userRepository.GetByRefreshTokenHashAsync(refreshTokenHash, cancellationToken);

        if (user is null)
        {
            return Result<bool>.Success(true);
        }

        user.RevokeRefreshToken();

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true);
    }

    public async Task<Result<PasswordResetResponse>> RequestPasswordResetAsync(
        RequestPasswordResetRequest request,
        string resetBaseUrl,
        CancellationToken cancellationToken = default)
    {
        var validationResult = await _requestPasswordResetValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<PasswordResetResponse>.Failure(ToValidationErrors(validationResult));
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _userRepository.GetByEmailAsync(normalizedEmail, cancellationToken);
        if (user is null || !user.IsActive)
        {
            return Result<PasswordResetResponse>.Success(new PasswordResetResponse(PasswordResetSafeMessage));
        }

        var now = DateTime.UtcNow;
        var outstandingTokens = await _passwordResetTokenRepository.GetUnusedByUserIdAsync(user.Id, cancellationToken);
        foreach (var outstandingToken in outstandingTokens)
        {
            outstandingToken.MarkUsed(now);
        }

        var token = GeneratePasswordResetToken();
        var verificationCode = GeneratePasswordResetCode();
        var tokenHash = HashToken(token);
        var codeHash = HashToken(verificationCode);
        var expiresAt = now.AddMinutes(PasswordResetExpirationMinutes);
        await _passwordResetTokenRepository.AddAsync(
            PasswordResetToken.Create(user.Id, tokenHash, codeHash, expiresAt, now),
            cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var resetUrl = BuildPasswordResetUrl(resetBaseUrl, token);
        await _passwordResetEmailSender.SendPasswordResetAsync(
            user.Email,
            $"{user.FirstName} {user.LastName}".Trim(),
            resetUrl,
            verificationCode,
            expiresAt,
            cancellationToken);

        return Result<PasswordResetResponse>.Success(new PasswordResetResponse(PasswordResetSafeMessage));
    }

    public async Task<Result<PasswordResetResponse>> ResetPasswordAsync(
        ResetPasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        var validationResult = await _resetPasswordValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<PasswordResetResponse>.Failure(ToValidationErrors(validationResult));
        }

        var tokenHash = HashToken(request.Token);
        var resetToken = await _passwordResetTokenRepository.GetByTokenHashAsync(tokenHash, cancellationToken);
        var now = DateTime.UtcNow;

        if (resetToken is null || !resetToken.IsValid(now))
        {
            return Result<PasswordResetResponse>.Failure(InvalidPasswordResetToken);
        }

        if (resetToken.FailedCodeAttempts >= MaxPasswordResetCodeAttempts)
        {
            resetToken.MarkUsed(now);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return Result<PasswordResetResponse>.Failure(InvalidPasswordResetToken);
        }

        if (resetToken.CodeHash != HashToken(request.VerificationCode.Trim()))
        {
            resetToken.RegisterFailedCodeAttempt();
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return Result<PasswordResetResponse>.Failure(InvalidPasswordResetToken);
        }

        var user = await _userRepository.GetByIdAsync(resetToken.UserId, cancellationToken);
        if (user is null || !user.IsActive)
        {
            return Result<PasswordResetResponse>.Failure(InvalidPasswordResetToken);
        }

        user.ChangePassword(_passwordHasher.Hash(request.NewPassword));
        resetToken.MarkUsed(now);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await TrySendPasswordChangedEmailAsync(user, now, cancellationToken);

        return Result<PasswordResetResponse>.Success(new PasswordResetResponse("Password has been reset."));
    }

    public async Task<Result<PasswordResetResponse>> ChangePasswordAsync(
        Guid userId,
        ChangePasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        var validationResult = await _changePasswordValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<PasswordResetResponse>.Failure(ToValidationErrors(validationResult));
        }

        var user = await _userRepository.GetByIdAsync(userId, cancellationToken);
        if (user is null)
        {
            return Result<PasswordResetResponse>.Failure(NotFound);
        }

        if (!user.HasPassword)
        {
            return Result<PasswordResetResponse>.Failure(PasswordNotSet);
        }

        if (!_passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return Result<PasswordResetResponse>.Failure(InvalidCurrentPassword);
        }

        user.ChangePassword(_passwordHasher.Hash(request.NewPassword));

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await TrySendPasswordChangedEmailAsync(user, DateTime.UtcNow, cancellationToken);

        return Result<PasswordResetResponse>.Success(new PasswordResetResponse("Password has been updated."));
    }

    public async Task<Result<PasswordResetResponse>> SetPasswordAsync(
        Guid userId,
        SetPasswordRequest request,
        CancellationToken cancellationToken = default)
    {
        var validationResult = await _setPasswordValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<PasswordResetResponse>.Failure(ToValidationErrors(validationResult));
        }

        var user = await _userRepository.GetByIdAsync(userId, cancellationToken);
        if (user is null)
        {
            return Result<PasswordResetResponse>.Failure(NotFound);
        }

        if (user.HasPassword)
        {
            return Result<PasswordResetResponse>.Failure(PasswordAlreadySet);
        }

        user.ChangePassword(_passwordHasher.Hash(request.NewPassword));

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await TrySendPasswordChangedEmailAsync(user, DateTime.UtcNow, cancellationToken);

        return Result<PasswordResetResponse>.Success(new PasswordResetResponse("Password has been set."));
    }

    public async Task<Result<UserDto>> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return Result<UserDto>.Failure(NotFound);
        }

        return Result<UserDto>.Success(_mapper.Map<UserDto>(user));
    }

    public async Task<Result<UserDto>> VerifyEmailAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return Result<UserDto>.Failure(NotFound);
        }

        user.VerifyEmail();

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<UserDto>.Success(_mapper.Map<UserDto>(user));
    }

    public async Task<Result<UserDto>> SubmitVerificationDocumentsAsync(
        Guid id,
        string driverLicenseDocumentUrl,
        string passportDocumentUrl,
        CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return Result<UserDto>.Failure(NotFound);
        }

        user.SubmitVerificationDocuments(driverLicenseDocumentUrl, passportDocumentUrl, DateTime.UtcNow);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<UserDto>.Success(_mapper.Map<UserDto>(user));
    }

    private static IReadOnlyList<Error> ToValidationErrors(FluentValidation.Results.ValidationResult validationResult)
    {
        return validationResult.Errors
            .Select(error => new Error($"Validation.{error.PropertyName}", error.ErrorMessage))
            .ToList();
    }

    private AuthResponse IssueTokens(User user)
    {
        var userDto = _mapper.Map<UserDto>(user);
        var refreshToken = GenerateRefreshToken();
        var refreshTokenExpiresAt = DateTime.UtcNow.AddDays(RefreshTokenExpirationDays);

        user.SetRefreshToken(HashRefreshToken(refreshToken), refreshTokenExpiresAt);

        return new AuthResponse
        {
            AccessToken = _jwtTokenGenerator.GenerateToken(userDto),
            AccessTokenExpiresAt = DateTime.UtcNow.AddMinutes(AccessTokenExpirationMinutes),
            RefreshToken = refreshToken,
            RefreshTokenExpiresAt = refreshTokenExpiresAt,
            User = userDto
        };
    }

    private static string GenerateRefreshToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
    }

    private static string GeneratePasswordResetToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(64))
            .Replace("+", "-", StringComparison.Ordinal)
            .Replace("/", "_", StringComparison.Ordinal)
            .TrimEnd('=');
    }

    private static string GeneratePasswordResetCode()
    {
        return RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
    }

    private static string NormalizeExternalProvider(string provider)
    {
        var value = provider.Trim().ToLowerInvariant();
        return value switch
        {
            "google" => "Google",
            "github" => "GitHub",
            _ => provider.Trim()
        };
    }

    private static string GenerateExternalPlaceholder(string prefix, string provider, string providerUserId)
    {
        var hash = HashToken($"{provider}:{providerUserId}")[..12];
        return $"{prefix}-{hash}";
    }

    private static string HashRefreshToken(string refreshToken)
    {
        return HashToken(refreshToken);
    }

    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes);
    }

    private static string BuildPasswordResetUrl(string resetBaseUrl, string token)
    {
        var separator = resetBaseUrl.Contains('?', StringComparison.Ordinal) ? "&" : "?";
        return $"{resetBaseUrl}{separator}token={Uri.EscapeDataString(token)}";
    }

    private async Task TrySendPasswordChangedEmailAsync(
        User user,
        DateTime changedAtUtc,
        CancellationToken cancellationToken)
    {
        try
        {
            await _accountSecurityEmailSender.SendPasswordChangedAsync(
                user.Email,
                $"{user.FirstName} {user.LastName}".Trim(),
                changedAtUtc,
                cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
        }
    }

    private static Error ToBlockedError(User user)
    {
        var unlockText = user.BlockedUntil.HasValue
            ? $" Unlocks at {user.BlockedUntil.Value.AddHours(4):dd.MM.yyyy HH:mm} Baku time."
            : " Blocked permanently.";

        return new Error("User.Blocked", $"User account is blocked. Reason: {user.BlockReason ?? "No reason provided."}.{unlockText}");
    }

    private static string NormalizeAzerbaijanPhone(string phone)
    {
        var value = phone.Trim().Replace(" ", "").Replace("-", "").Replace("(", "").Replace(")", "");
        if (value.StartsWith("+994", StringComparison.Ordinal)) return value;
        if (value.StartsWith("994", StringComparison.Ordinal)) return $"+{value}";
        if (value.StartsWith("0", StringComparison.Ordinal)) return $"+994{value[1..]}";
        return value;
    }

    private static string NormalizeDriverLicenseNumber(string driverLicenseNumber)
    {
        return driverLicenseNumber.Trim().ToUpperInvariant();
    }
}
