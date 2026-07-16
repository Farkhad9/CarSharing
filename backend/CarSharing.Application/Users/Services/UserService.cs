using AutoMapper;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.Users.Dtos;
using CarSharing.Domain.Entities;
using FluentValidation;
using System.Security.Cryptography;
using System.Text;

namespace CarSharing.Application.Users.Services;

public class UserService : IUserService
{
    private const int AccessTokenExpirationMinutes = 60;
    private const int RefreshTokenExpirationDays = 14;

    private static readonly Error EmailNotUnique = new("User.EmailNotUnique", "User with this email already exists.");
    private static readonly Error InvalidCredentials = new("User.InvalidCredentials", "Invalid email or password.");
    private static readonly Error NotFound = new("User.NotFound", "User was not found.");
    private static readonly Error InvalidRefreshToken = new("User.InvalidRefreshToken", "Refresh token is invalid or expired.");
    private static readonly Error Disabled = new("User.Disabled", "User account is disabled.");

    private readonly IUserRepository _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IMapper _mapper;
    private readonly IValidator<RegisterUserRequest> _registerUserValidator;
    private readonly IValidator<LoginUserRequest> _loginUserValidator;

    public UserService(
        IUserRepository userRepository,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        IJwtTokenGenerator jwtTokenGenerator,
        IMapper mapper,
        IValidator<RegisterUserRequest> registerUserValidator,
        IValidator<LoginUserRequest> loginUserValidator)
    {
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _jwtTokenGenerator = jwtTokenGenerator;
        _mapper = mapper;
        _registerUserValidator = registerUserValidator;
        _loginUserValidator = loginUserValidator;
    }

    public async Task<Result<UserDto>> RegisterAsync(RegisterUserRequest request, CancellationToken cancellationToken = default)
    {
        var validationResult = await _registerUserValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<UserDto>.Failure(ToValidationErrors(validationResult));
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await _userRepository.ExistsByEmailAsync(normalizedEmail, cancellationToken))
        {
            return Result<UserDto>.Failure(EmailNotUnique);
        }

        var user = User.CreateRider(
            request.FirstName,
            request.LastName,
            normalizedEmail,
            request.Phone,
            _passwordHasher.Hash(request.Password),
            request.DriverLicenseNumber);

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

    private static string HashRefreshToken(string refreshToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken));
        return Convert.ToHexString(bytes);
    }

    private static Error ToBlockedError(User user)
    {
        var unlockText = user.BlockedUntil.HasValue
            ? $" Unlocks at {user.BlockedUntil.Value.AddHours(4):dd.MM.yyyy HH:mm} Baku time."
            : " Blocked permanently.";

        return new Error("User.Blocked", $"User account is blocked. Reason: {user.BlockReason ?? "No reason provided."}.{unlockText}");
    }
}
