using AutoMapper;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Users.Dtos;
using CarSharing.Application.Users.Mapping;
using CarSharing.Application.Users.Services;
using CarSharing.Application.Users.Validators;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.Extensions.Logging.Abstractions;
using System.Security.Cryptography;
using System.Text;
using Xunit;

namespace CarSharing.Application.Tests;

public sealed class PasswordResetTests
{
    private const string SafeMessage = "If an account exists, reset instructions were sent.";

    [Fact]
    public async Task RequestPasswordResetAsync_ForMissingEmail_DoesNotRevealAccount()
    {
        var fixture = CreateFixture();

        var result = await fixture.Service.RequestPasswordResetAsync(
            new RequestPasswordResetRequest("missing@test.local"),
            "http://localhost:5173/auth?mode=reset-password");

        Assert.True(result.IsSuccess);
        Assert.Equal(SafeMessage, result.Value!.Message);
        Assert.Empty(fixture.Tokens.Items);
        Assert.Empty(fixture.EmailSender.ResetUrls);
    }

    [Fact]
    public async Task RequestPasswordResetAsync_ForExistingUser_CreatesHashedToken()
    {
        var user = CreateUser();
        var fixture = CreateFixture(user);

        var result = await fixture.Service.RequestPasswordResetAsync(
            new RequestPasswordResetRequest(user.Email),
            "http://localhost:5173/auth?mode=reset-password");

        Assert.True(result.IsSuccess);
        Assert.Equal(SafeMessage, result.Value!.Message);
        Assert.Single(fixture.Tokens.Items);
        Assert.Single(fixture.EmailSender.ResetUrls);
        Assert.Single(fixture.EmailSender.VerificationCodes);
        Assert.DoesNotContain(ExtractToken(fixture.EmailSender.ResetUrls.Single()), fixture.Tokens.Items.Single().TokenHash);
        Assert.DoesNotContain(fixture.EmailSender.VerificationCodes.Single(), fixture.Tokens.Items.Single().CodeHash);
        Assert.True(fixture.Tokens.Items.Single().ExpiresAt > DateTime.UtcNow);
    }

    [Fact]
    public async Task ResetPasswordAsync_WithValidToken_ChangesPasswordAndUsesToken()
    {
        var user = CreateUser();
        var fixture = CreateFixture(user);
        await fixture.Service.RequestPasswordResetAsync(
            new RequestPasswordResetRequest(user.Email),
            "http://localhost:5173/auth?mode=reset-password");
        var token = ExtractToken(fixture.EmailSender.ResetUrls.Single());
        var code = fixture.EmailSender.VerificationCodes.Single();

        var result = await fixture.Service.ResetPasswordAsync(
            new ResetPasswordRequest(token, code, "NewPassword123!", "NewPassword123!"));

        Assert.True(result.IsSuccess);
        Assert.True(fixture.PasswordHasher.Verify("NewPassword123!", user.PasswordHash));
        Assert.False(fixture.PasswordHasher.Verify("OldPassword123!", user.PasswordHash));
        Assert.NotNull(fixture.Tokens.Items.Single().UsedAt);
    }

    [Fact]
    public async Task ResetPasswordAsync_WithInvalidToken_Fails()
    {
        var fixture = CreateFixture(CreateUser());

        var result = await fixture.Service.ResetPasswordAsync(
            new ResetPasswordRequest("not-a-real-token", "123456", "NewPassword123!", "NewPassword123!"));

        Assert.True(result.IsFailure);
        Assert.Equal("User.InvalidPasswordResetToken", result.Errors.Single().Code);
    }

    [Fact]
    public async Task ResetPasswordAsync_WithExpiredToken_Fails()
    {
        var user = CreateUser();
        var fixture = CreateFixture(user);
        const string plainToken = "expired-token";
        fixture.Tokens.Items.Add(PasswordResetToken.Create(
            user.Id,
            HashToken(plainToken),
            HashToken("123456"),
            DateTime.UtcNow.AddMinutes(-1),
            DateTime.UtcNow.AddHours(-1)));

        var result = await fixture.Service.ResetPasswordAsync(
            new ResetPasswordRequest(plainToken, "123456", "NewPassword123!", "NewPassword123!"));

        Assert.True(result.IsFailure);
        Assert.Equal("User.InvalidPasswordResetToken", result.Errors.Single().Code);
    }

    [Fact]
    public async Task ResetPasswordAsync_WithUsedToken_Fails()
    {
        var user = CreateUser();
        var fixture = CreateFixture(user);
        const string plainToken = "used-token";
        var token = PasswordResetToken.Create(
            user.Id,
            HashToken(plainToken),
            HashToken("123456"),
            DateTime.UtcNow.AddMinutes(30),
            DateTime.UtcNow);
        token.MarkUsed(DateTime.UtcNow);
        fixture.Tokens.Items.Add(token);

        var result = await fixture.Service.ResetPasswordAsync(
            new ResetPasswordRequest(plainToken, "123456", "NewPassword123!", "NewPassword123!"));

        Assert.True(result.IsFailure);
        Assert.Equal("User.InvalidPasswordResetToken", result.Errors.Single().Code);
    }

    [Fact]
    public async Task ResetPasswordAsync_CannotReuseToken()
    {
        var user = CreateUser();
        var fixture = CreateFixture(user);
        await fixture.Service.RequestPasswordResetAsync(
            new RequestPasswordResetRequest(user.Email),
            "http://localhost:5173/auth?mode=reset-password");
        var token = ExtractToken(fixture.EmailSender.ResetUrls.Single());
        var code = fixture.EmailSender.VerificationCodes.Single();

        var first = await fixture.Service.ResetPasswordAsync(
            new ResetPasswordRequest(token, code, "NewPassword123!", "NewPassword123!"));
        var second = await fixture.Service.ResetPasswordAsync(
            new ResetPasswordRequest(token, code, "AnotherPassword123!", "AnotherPassword123!"));

        Assert.True(first.IsSuccess);
        Assert.True(second.IsFailure);
        Assert.Equal("User.InvalidPasswordResetToken", second.Errors.Single().Code);
        Assert.True(fixture.PasswordHasher.Verify("NewPassword123!", user.PasswordHash));
    }

    [Fact]
    public async Task ResetPasswordAsync_WithInvalidCode_FailsAndKeepsPassword()
    {
        var user = CreateUser();
        var fixture = CreateFixture(user);
        await fixture.Service.RequestPasswordResetAsync(
            new RequestPasswordResetRequest(user.Email),
            "http://localhost:5173/auth?mode=reset-password");
        var token = ExtractToken(fixture.EmailSender.ResetUrls.Single());

        var result = await fixture.Service.ResetPasswordAsync(
            new ResetPasswordRequest(token, "000000", "NewPassword123!", "NewPassword123!"));

        Assert.True(result.IsFailure);
        Assert.Equal("User.InvalidPasswordResetToken", result.Errors.Single().Code);
        Assert.Equal(1, fixture.Tokens.Items.Single().FailedCodeAttempts);
        Assert.True(fixture.PasswordHasher.Verify("OldPassword123!", user.PasswordHash));
    }

    [Fact]
    public async Task ExternalLoginAsync_ForNewGoogleAccount_CreatesRiderAndExternalLogin()
    {
        var fixture = CreateFixture();

        var result = await fixture.Service.ExternalLoginAsync(
            new ExternalLoginRequest("Google", "google-user-123", "rider@google.local", "Google", "Rider"));

        Assert.True(result.IsSuccess);
        Assert.Equal("rider@google.local", result.Value!.User.Email);
        Assert.Equal(UserRole.Rider, result.Value.User.Role);
        Assert.True(result.Value.User.EmailVerified);
        Assert.False(result.Value.User.HasPassword);
        Assert.Single(fixture.Users.Items);
        Assert.Single(fixture.ExternalLogins.Items);
        Assert.Equal(fixture.Users.Items.Single().Id, fixture.ExternalLogins.Items.Single().UserId);
    }

    [Fact]
    public async Task RegisterAsync_WithDuplicateFields_ReturnsAllUniquenessErrors()
    {
        var existingUser = CreateUser();
        var fixture = CreateFixture(existingUser);

        var result = await fixture.Service.RegisterAsync(new RegisterUserRequest
        {
            FirstName = "New",
            LastName = "Rider",
            Email = existingUser.Email,
            Phone = existingUser.Phone,
            Age = 25,
            Password = "Password123!",
            DriverLicenseNumber = existingUser.DriverLicenseNumber
        });

        Assert.True(result.IsFailure);
        Assert.Contains(result.Errors, error => error.Code == "User.EmailNotUnique");
        Assert.Contains(result.Errors, error => error.Code == "User.PhoneNotUnique");
        Assert.Contains(result.Errors, error => error.Code == "User.DriverLicenseNotUnique");
    }

    [Fact]
    public async Task SetPasswordAsync_ForExternalOnlyUser_SetsPassword()
    {
        var fixture = CreateFixture();
        var login = await fixture.Service.ExternalLoginAsync(
            new ExternalLoginRequest("Google", "google-user-123", "rider@google.local", "Google", "Rider"));
        var user = fixture.Users.Items.Single();

        var result = await fixture.Service.SetPasswordAsync(
            login.Value!.User.Id,
            new SetPasswordRequest("NewPassword123!", "NewPassword123!"));

        Assert.True(result.IsSuccess);
        Assert.True(user.HasPassword);
        Assert.True(fixture.PasswordHasher.Verify("NewPassword123!", user.PasswordHash));
    }

    [Fact]
    public async Task SetPasswordAsync_ForUserWithPassword_Fails()
    {
        var user = CreateUser();
        var fixture = CreateFixture(user);

        var result = await fixture.Service.SetPasswordAsync(
            user.Id,
            new SetPasswordRequest("NewPassword123!", "NewPassword123!"));

        Assert.True(result.IsFailure);
        Assert.Equal("User.PasswordAlreadySet", result.Errors.Single().Code);
        Assert.True(fixture.PasswordHasher.Verify("OldPassword123!", user.PasswordHash));
    }

    [Fact]
    public async Task ExternalLoginAsync_ForExistingRiderEmail_LinksProviderWithoutDuplicateUser()
    {
        var user = CreateUser();
        var fixture = CreateFixture(user);

        var result = await fixture.Service.ExternalLoginAsync(
            new ExternalLoginRequest("GitHub", "github-user-123", user.Email, "Test", "Rider"));

        Assert.True(result.IsSuccess);
        Assert.Equal(user.Id, result.Value!.User.Id);
        Assert.Single(fixture.Users.Items);
        Assert.Single(fixture.ExternalLogins.Items);
        Assert.Equal("GitHub", fixture.ExternalLogins.Items.Single().Provider);
    }

    private static Fixture CreateFixture(params User[] users)
    {
        var userRepository = new UserRepo(users);
        var externalLoginRepository = new UserExternalLoginRepo();
        var tokenRepository = new PasswordResetTokenRepo();
        var passwordHasher = new PasswordHasher();
        var emailSender = new PasswordResetEmailSender();
        var accountSecurityEmailSender = new AccountSecurityEmailSender();
        var mapper = new Mapper(new MapperConfiguration(
            configuration => configuration.AddProfile<UserMappingProfile>(),
            NullLoggerFactory.Instance));
        var service = new UserService(
            userRepository,
            externalLoginRepository,
            tokenRepository,
            new UnitOfWork(),
            passwordHasher,
            new JwtTokenGenerator(),
            emailSender,
            accountSecurityEmailSender,
            mapper,
            new RegisterUserRequestValidator(),
            new LoginUserRequestValidator(),
            new RequestPasswordResetRequestValidator(),
            new ResetPasswordRequestValidator(),
            new ChangePasswordRequestValidator(),
            new SetPasswordRequestValidator());

        return new Fixture(service, userRepository, externalLoginRepository, tokenRepository, emailSender, passwordHasher);
    }

    private static User CreateUser()
    {
        return User.CreateRider(
            "Test",
            "Rider",
            "rider@test.local",
            "+994501234567",
            "hashed:OldPassword123!",
            "RIDER123");
    }

    private static string ExtractToken(string resetUrl)
    {
        var uri = new Uri(resetUrl);
        var query = uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries);
        var tokenValue = query
            .Select(part => part.Split('=', 2))
            .First(part => part[0] == "token")[1];
        return Uri.UnescapeDataString(tokenValue);
    }

    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes);
    }

    private sealed record Fixture(
        UserService Service,
        UserRepo Users,
        UserExternalLoginRepo ExternalLogins,
        PasswordResetTokenRepo Tokens,
        PasswordResetEmailSender EmailSender,
        PasswordHasher PasswordHasher);

    private sealed class UserRepo : IUserRepository
    {
        public UserRepo(params User[] users)
        {
            Items = users.ToList();
        }

        public List<User> Items { get; }

        public Task<IReadOnlyList<User>> GetAllAsync(
            string? search = null,
            UserRole? role = null,
            bool? isActive = null,
            UserVerificationStatus? verificationStatus = null,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<User>>(Items);

        public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(user => user.Id == id));

        public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(user => user.Email == email.Trim().ToLowerInvariant()));

        public Task<User?> GetByRefreshTokenHashAsync(string refreshTokenHash, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(user => user.RefreshTokenHash == refreshTokenHash));

        public Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.Any(user => user.Email == email.Trim().ToLowerInvariant()));

        public Task<bool> ExistsByPhoneAsync(string phone, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.Any(user => user.Phone == phone.Trim()));

        public Task<bool> ExistsByDriverLicenseNumberAsync(string driverLicenseNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.Any(user => user.DriverLicenseNumber == driverLicenseNumber.Trim().ToUpperInvariant()));

        public Task AddAsync(User user, CancellationToken cancellationToken = default)
        {
            Items.Add(user);
            return Task.CompletedTask;
        }

        public Task DeleteAsync(User user, CancellationToken cancellationToken = default)
        {
            Items.Remove(user);
            return Task.CompletedTask;
        }
    }

    private sealed class PasswordResetTokenRepo : IPasswordResetTokenRepository
    {
        public List<PasswordResetToken> Items { get; } = [];

        public Task<PasswordResetToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(token => token.TokenHash == tokenHash));

        public Task<IReadOnlyList<PasswordResetToken>> GetUnusedByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<PasswordResetToken>>(Items.Where(token => token.UserId == userId && token.UsedAt is null).ToList());

        public Task AddAsync(PasswordResetToken token, CancellationToken cancellationToken = default)
        {
            Items.Add(token);
            return Task.CompletedTask;
        }
    }

    private sealed class UserExternalLoginRepo : IUserExternalLoginRepository
    {
        public List<UserExternalLogin> Items { get; } = [];

        public Task<UserExternalLogin?> GetByProviderAsync(
            string provider,
            string providerUserId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(login => login.Provider == provider && login.ProviderUserId == providerUserId));

        public Task<bool> ExistsAsync(
            Guid userId,
            string provider,
            string providerUserId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.Any(login => login.UserId == userId && login.Provider == provider && login.ProviderUserId == providerUserId));

        public Task AddAsync(UserExternalLogin externalLogin, CancellationToken cancellationToken = default)
        {
            Items.Add(externalLogin);
            return Task.CompletedTask;
        }
    }

    private sealed class PasswordResetEmailSender : IPasswordResetEmailSender
    {
        public List<string> ResetUrls { get; } = [];
        public List<string> VerificationCodes { get; } = [];

        public Task SendPasswordResetAsync(
            string toEmail,
            string userName,
            string resetUrl,
            string verificationCode,
            DateTime expiresAt,
            CancellationToken cancellationToken = default)
        {
            ResetUrls.Add(resetUrl);
            VerificationCodes.Add(verificationCode);
            return Task.CompletedTask;
        }
    }

    private sealed class AccountSecurityEmailSender : IAccountSecurityEmailSender
    {
        public Task SendPasswordChangedAsync(
            string toEmail,
            string userName,
            DateTime changedAtUtc,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class UnitOfWork : IUnitOfWork
    {
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);
    }

    private sealed class PasswordHasher : IPasswordHasher
    {
        public string Hash(string password) => $"hashed:{password}";
        public bool Verify(string password, string passwordHash) => passwordHash == Hash(password);
    }

    private sealed class JwtTokenGenerator : IJwtTokenGenerator
    {
        public string GenerateToken(UserDto user) => $"token:{user.Id}";
    }
}
