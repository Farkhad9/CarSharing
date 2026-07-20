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
    public async Task UpdateRoleAsync_ForCurrentSuperAdmin_IsRejected()
    {
        var currentUser = User.CreateSuperAdmin("Root", "Admin", "root-super@test.local", "+994502222223", "hash", "ROOTSUPER");
        var fixture = CreateFixture(UserRole.SuperAdmin, currentUser.Id, currentUser);

        var result = await fixture.Service.UpdateRoleAsync(currentUser.Id, new UpdateUserRoleRequest(UserRole.Admin));

        Assert.True(result.IsFailure);
        Assert.Equal("AdminUsers.CannotChangeOwnRole", result.Errors.Single().Code);
        Assert.Equal(UserRole.SuperAdmin, currentUser.Role);
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
    public async Task UpdateVerificationAsync_ForVerifiedRider_CanResetToPending()
    {
        var rider = User.CreateRider("Test", "Rider", "rider-pending@test.local", "+994503333334", "hash", "RIDER2");
        rider.ApproveVerification();
        var fixture = CreateFixture(UserRole.Admin, seedUsers: rider);

        var result = await fixture.Service.UpdateVerificationAsync(rider.Id, new UpdateUserVerificationRequest(UserVerificationStatus.Pending));

        Assert.True(result.IsSuccess);
        Assert.Equal(UserVerificationStatus.Pending, result.Value!.VerificationStatus);
        Assert.Null(rider.VerifiedAt);
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

    [Fact]
    public async Task CreateStaffAsync_WithDuplicatePhone_IsRejected()
    {
        var existing = User.CreateRider("Test", "Rider", "phone@test.local", "+994501234567", "hash", "RIDER3");
        var fixture = CreateFixture(UserRole.Admin, seedUsers: existing);

        var result = await fixture.Service.CreateStaffAsync(CreateStaffRequest() with
        {
            Email = "new-staff@test.local",
            Phone = "0501234567"
        });

        Assert.True(result.IsFailure);
        Assert.Equal("AdminUsers.PhoneNotUnique", result.Errors.Single().Code);
    }

    [Fact]
    public async Task CreateStaffAsync_WithDuplicateDriverLicenseNumber_IsRejected()
    {
        var existing = User.CreateRider("Test", "Rider", "license@test.local", "+994501234569", "hash", "STAFF123");
        var fixture = CreateFixture(UserRole.Admin, seedUsers: existing);

        var result = await fixture.Service.CreateStaffAsync(CreateStaffRequest() with
        {
            Email = "new-license-staff@test.local",
            Phone = "+994501234570",
            DriverLicenseNumber = "staff123"
        });

        Assert.True(result.IsFailure);
        Assert.Equal("AdminUsers.DriverLicenseNotUnique", result.Errors.Single().Code);
    }

    [Fact]
    public async Task CreateAdminAsync_WithDuplicateDriverLicenseNumber_IsRejected()
    {
        var existing = User.CreateStaff("Test", "Staff", "admin-license@test.local", "+994501234571", "hash", "ADMIN123");
        var fixture = CreateFixture(UserRole.SuperAdmin, seedUsers: existing);

        var result = await fixture.Service.CreateAdminAsync(CreateAdminRequest(UserRole.Admin) with
        {
            Email = "new-admin-license@test.local",
            Phone = "+994501234572",
            DriverLicenseNumber = "admin123"
        });

        Assert.True(result.IsFailure);
        Assert.Equal("AdminUsers.DriverLicenseNotUnique", result.Errors.Single().Code);
    }

    private static Fixture CreateFixture(
        UserRole currentRole,
        Guid? currentUserId = null,
        params User[] seedUsers)
    {
        var users = new UserRepo(seedUsers);
        var service = new AdminUserService(
            users,
            new StaffKpiEventRepo(),
            new CurrentUser(currentRole, currentUserId),
            new UnitOfWork(),
            new PasswordHasher(),
            new CreateStaffUserRequestValidator(),
            new CreateAdminUserRequestValidator(),
            new UpdateUserRoleRequestValidator(),
            new UpdateUserVerificationRequestValidator(),
            new BlockUserRequestValidator());

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

    private sealed class StaffKpiEventRepo : IStaffKpiEventRepository
    {
        public List<StaffKpiEvent> Items { get; } = [];

        public Task<IReadOnlyList<StaffKpiEvent>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<StaffKpiEvent>>(Items);

        public Task<IReadOnlyList<StaffKpiEvent>> GetByStaffIdsAsync(
            IReadOnlyCollection<Guid> staffUserIds,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<StaffKpiEvent>>(
                Items.Where(kpiEvent => staffUserIds.Contains(kpiEvent.StaffUserId)).ToList());

        public Task<bool> ExistsAsync(Guid staffUserId, Guid sourceId, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.Any(kpiEvent => kpiEvent.StaffUserId == staffUserId && kpiEvent.SourceId == sourceId));

        public Task AddAsync(StaffKpiEvent kpiEvent, CancellationToken cancellationToken = default)
        {
            Items.Add(kpiEvent);
            return Task.CompletedTask;
        }
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

    [Fact]
    public async Task BlockUserAsync_WithDuration_StoresReasonAndUntil()
    {
        var rider = User.CreateRider("Test", "Rider", "rider-block@test.local", "+994505555555", "hash", "RIDER2");
        var adminId = Guid.NewGuid();
        var fixture = CreateFixture(UserRole.Admin, adminId, rider);

        var result = await fixture.Service.BlockUserAsync(
            rider.Id,
            new BlockUserRequest("Repeated late returns", UserBlockDuration.FifteenMinutes));

        Assert.True(result.IsSuccess);
        Assert.False(result.Value!.IsActive);
        Assert.Equal("Repeated late returns", result.Value.BlockReason);
        Assert.NotNull(result.Value.BlockedUntil);
        Assert.Equal(adminId, result.Value.BlockedByUserId);
    }

    [Fact]
    public async Task BlockUserAsync_ForCurrentUser_IsRejected()
    {
        var admin = User.CreateAdmin("Root", "Admin", "admin-self@test.local", "+994506666666", "hash", "ADMIN2");
        var fixture = CreateFixture(UserRole.Admin, admin.Id, admin);

        var result = await fixture.Service.BlockUserAsync(
            admin.Id,
            new BlockUserRequest("Self block", UserBlockDuration.OneDay));

        Assert.True(result.IsFailure);
        Assert.Equal("AdminUsers.CannotDisableSelf", result.Errors.Single().Code);
        Assert.True(admin.IsActive);
    }

    [Fact]
    public async Task BlockUserAsync_ForSuperAdminByAdmin_IsRejected()
    {
        var superAdmin = User.CreateSuperAdmin("Super", "Admin", "super@test.local", "+994507777777", "hash", "SUPER1");
        var fixture = CreateFixture(UserRole.Admin, seedUsers: superAdmin);

        var result = await fixture.Service.BlockUserAsync(
            superAdmin.Id,
            new BlockUserRequest("Nope", UserBlockDuration.Forever));

        Assert.True(result.IsFailure);
        Assert.Equal("AdminUsers.CannotManageSuperAdmin", result.Errors.Single().Code);
        Assert.True(superAdmin.IsActive);
    }

    [Fact]
    public async Task BlockUserAsync_ForAdminByAdmin_IsRejected()
    {
        var targetAdmin = User.CreateAdmin("Target", "Admin", "target-admin@test.local", "+994509999999", "hash", "ADMIN3");
        var fixture = CreateFixture(UserRole.Admin, seedUsers: targetAdmin);

        var result = await fixture.Service.BlockUserAsync(
            targetAdmin.Id,
            new BlockUserRequest("Nope", UserBlockDuration.Forever));

        Assert.True(result.IsFailure);
        Assert.Equal("AdminUsers.CannotManageAdminAccount", result.Errors.Single().Code);
        Assert.True(targetAdmin.IsActive);
    }

    [Fact]
    public async Task UnblockUserAsync_ClearsBlockFields()
    {
        var staff = User.CreateStaff("Staff", "User", "staff-block@test.local", "+994508888888", "hash", "STAFF3");
        staff.Block("Temporary", DateTime.UtcNow.AddDays(1), Guid.NewGuid(), DateTime.UtcNow);
        var fixture = CreateFixture(UserRole.SuperAdmin, seedUsers: staff);

        var result = await fixture.Service.UnblockUserAsync(staff.Id);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value!.IsActive);
        Assert.Null(result.Value.BlockReason);
        Assert.Null(result.Value.BlockedUntil);
    }

    [Fact]
    public async Task CreateStaffValidator_RejectsLicenseWithoutDigits()
    {
        var validator = new CreateStaffUserRequestValidator();

        var result = await validator.ValidateAsync(CreateStaffRequest() with
        {
            DriverLicenseNumber = "ONLYLETTERS"
        });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(CreateStaffUserRequest.DriverLicenseNumber));
    }

    [Fact]
    public async Task CreateStaffValidator_AcceptsLicenseWithLettersAndDigits()
    {
        var validator = new CreateStaffUserRequestValidator();

        var result = await validator.ValidateAsync(CreateStaffRequest() with
        {
            DriverLicenseNumber = "AZE1234567"
        });

        Assert.True(result.IsValid);
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

        public Task<bool> ExistsByPhoneAsync(string phone, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(Items.Any(user => user.Phone == phone.Trim()));
        }

        public Task<bool> ExistsByDriverLicenseNumberAsync(string driverLicenseNumber, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(Items.Any(user => user.DriverLicenseNumber == driverLicenseNumber.Trim().ToUpperInvariant()));
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
