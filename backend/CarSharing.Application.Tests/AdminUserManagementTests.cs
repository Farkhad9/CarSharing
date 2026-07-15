using CarSharing.Application.Admin.Dtos;
using CarSharing.Application.Admin.Services;
using CarSharing.Application.Admin.Validators;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Xunit;

namespace CarSharing.Application.Tests;

public sealed class AdminUserManagementTests
{
    [Fact]
    public async Task CreateStaffAsync_ForAdmin_CreatesStaffAccount()
    {
        var fixture = CreateFixture(UserRole.Admin);

        var result = await fixture.Service.CreateStaffAsync(CreateStaffRequest());

        Assert.True(result.IsSuccess);
        Assert.Equal(UserRole.Staff, result.Value!.Role);
        Assert.True(result.Value.IsActive);
        Assert.True(result.Value.EmailVerified);
        Assert.Equal(UserVerificationStatus.Internal, result.Value.VerificationStatus);
        Assert.Single(fixture.Users.Items);
    }

    [Fact]
    public async Task CreateAdminAsync_ForAdmin_IsForbidden()
    {
        var fixture = CreateFixture(UserRole.Admin);

        var result = await fixture.Service.CreateAdminAsync(CreateAdminRequest(UserRole.Admin));

        Assert.True(result.IsFailure);
        Assert.Equal("AdminUsers.SuperAdminRequired", result.Errors.Single().Code);
        Assert.Empty(fixture.Users.Items);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.SuperAdmin)]
    public async Task CreateAdminAsync_ForSuperAdmin_CreatesRequestedAdminAccount(UserRole role)
    {
        var fixture = CreateFixture(UserRole.SuperAdmin);

        var result = await fixture.Service.CreateAdminAsync(CreateAdminRequest(role));

        Assert.True(result.IsSuccess);
        Assert.Equal(role, result.Value!.Role);
        Assert.True(result.Value.IsActive);
        Assert.Single(fixture.Users.Items);
    }

    [Fact]
    public async Task UpdateStatusAsync_CannotDisableCurrentUser()
    {
        var currentUser = User.CreateAdmin("Root", "Admin", "root@test.local", "+994501111111", "hash", "ROOT1");
        var fixture = CreateFixture(UserRole.Admin, currentUser.Id, currentUser);

        var result = await fixture.Service.UpdateStatusAsync(currentUser.Id, new UpdateUserStatusRequest(false));

        Assert.True(result.IsFailure);
        Assert.Equal("AdminUsers.CannotDisableSelf", result.Errors.Single().Code);
        Assert.True(currentUser.IsActive);
    }

    [Fact]
    public async Task UpdateRoleAsync_ForSuperAdmin_ChangesInternalUserRole()
    {
        var staff = User.CreateStaff("Staff", "User", "staff@test.local", "+994502222222", "hash", "STAFF1");
        var fixture = CreateFixture(UserRole.SuperAdmin, seedUsers: staff);

        var result = await fixture.Service.UpdateRoleAsync(staff.Id, new UpdateUserRoleRequest(UserRole.Admin));

        Assert.True(result.IsSuccess);
        Assert.Equal(UserRole.Admin, result.Value!.Role);
        Assert.Equal(UserRole.Admin, staff.Role);
    }

    [Fact]
    public async Task UpdateVerificationAsync_ForRider_ApprovesVerification()
    {
        var rider = User.CreateRider("Test", "Rider", "rider@test.local", "+994503333333", "hash", "RIDER1");
        var fixture = CreateFixture(UserRole.Admin, seedUsers: rider);

        var result = await fixture.Service.UpdateVerificationAsync(rider.Id, new UpdateUserVerificationRequest(UserVerificationStatus.Verified));

        Assert.True(result.IsSuccess);
        Assert.Equal(UserVerificationStatus.Verified, result.Value!.VerificationStatus);
        Assert.NotNull(rider.VerifiedAt);
    }

    [Fact]
    public async Task UpdateVerificationAsync_ForStaff_IsRejected()
    {
        var staff = User.CreateStaff("Staff", "User", "staff@test.local", "+994504444444", "hash", "STAFF2");
        var fixture = CreateFixture(UserRole.Admin, seedUsers: staff);

        var result = await fixture.Service.UpdateVerificationAsync(staff.Id, new UpdateUserVerificationRequest(UserVerificationStatus.Verified));

        Assert.True(result.IsFailure);
        Assert.Equal("AdminUsers.CannotVerifyInternalUser", result.Errors.Single().Code);
    }

    [Fact]
    public async Task GetUsersAsync_AppliesRepositoryFilters()
    {
        var fixture = CreateFixture(UserRole.Admin);
        var query = new AdminUsersQuery
        {
            Search = "staff",
            Role = UserRole.Staff,
            IsActive = true,
            VerificationStatus = UserVerificationStatus.Internal
        };

        await fixture.Service.GetUsersAsync(query);

        Assert.Equal(query.Search, fixture.Users.LastQuery?.Search);
        Assert.Equal(query.Role, fixture.Users.LastQuery?.Role);
        Assert.Equal(query.IsActive, fixture.Users.LastQuery?.IsActive);
        Assert.Equal(query.VerificationStatus, fixture.Users.LastQuery?.VerificationStatus);
    }

    private static Fixture CreateFixture(
        UserRole currentRole,
        Guid? currentUserId = null,
        params User[] seedUsers)
    {
        var users = new UserRepo(seedUsers);
        var service = new AdminUserService(
            users,
            new CurrentUser(currentRole, currentUserId),
            new UnitOfWork(),
            new PasswordHasher(),
            new CreateStaffUserRequestValidator(),
            new CreateAdminUserRequestValidator(),
            new UpdateUserRoleRequestValidator(),
            new UpdateUserVerificationRequestValidator());

        return new Fixture(service, users);
    }

    private static CreateStaffUserRequest CreateStaffRequest()
    {
        return new CreateStaffUserRequest(
            "Staff",
            "Member",
            "staff@test.local",
            "+994501234567",
            "Staff123!",
            "STAFF123");
    }

    private static CreateAdminUserRequest CreateAdminRequest(UserRole role)
    {
        return new CreateAdminUserRequest(
            "Admin",
            "Member",
            "admin@test.local",
            "+994501234568",
            "Admin123!",
            "ADMIN123",
            role);
    }

    private sealed record Fixture(AdminUserService Service, UserRepo Users);

    private sealed class UserRepo : IUserRepository
    {
        public UserRepo(params User[] users)
        {
            Items = users.ToList();
        }

        public List<User> Items { get; }
        public AdminUsersQuery? LastQuery { get; private set; }

        public Task<IReadOnlyList<User>> GetAllAsync(
            string? search = null,
            UserRole? role = null,
            bool? isActive = null,
            UserVerificationStatus? verificationStatus = null,
            CancellationToken cancellationToken = default)
        {
            LastQuery = new AdminUsersQuery
            {
                Search = search,
                Role = role,
                IsActive = isActive,
                VerificationStatus = verificationStatus
            };
            return Task.FromResult<IReadOnlyList<User>>(Items);
        }

        public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(Items.FirstOrDefault(user => user.Id == id));
        }

        public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(Items.FirstOrDefault(user => user.Email == email.Trim().ToLowerInvariant()));
        }

        public Task<User?> GetByRefreshTokenHashAsync(string refreshTokenHash, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(Items.FirstOrDefault(user => user.RefreshTokenHash == refreshTokenHash));
        }

        public Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(Items.Any(user => user.Email == email.Trim().ToLowerInvariant()));
        }

        public Task AddAsync(User user, CancellationToken cancellationToken = default)
        {
            Items.Add(user);
            return Task.CompletedTask;
        }
    }

    private sealed class CurrentUser(UserRole role, Guid? userId = null) : ICurrentUserService
    {
        public Guid? UserId { get; } = userId ?? Guid.NewGuid();
        public string? Email => "admin@test.local";
        public UserRole? Role => role;
        public bool IsAuthenticated => true;
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
}
