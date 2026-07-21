using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Support.Dtos;
using CarSharing.Application.Support.Services;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Xunit;

namespace CarSharing.Application.Tests;

public sealed class SupportServiceTests
{
    [Fact]
    public async Task CreateTicketAsync_ReusesActiveTicketForSameCategoryAndContext()
    {
        var rider = CreateRider();
        var fixture = CreateFixture(rider, UserRole.Rider);
        var contextId = Guid.NewGuid();

        var first = await fixture.Service.CreateTicketAsync(new CreateSupportTicketRequest(
            SupportTicketCategory.VehicleAccess,
            "Car will not unlock",
            "Door is not opening.",
            ContextType: "trip",
            ContextId: contextId));
        var second = await fixture.Service.CreateTicketAsync(new CreateSupportTicketRequest(
            SupportTicketCategory.VehicleAccess,
            "Car will not unlock",
            "Still not opening.",
            ContextType: "trip",
            ContextId: contextId));

        Assert.True(first.IsSuccess);
        Assert.True(second.IsSuccess);
        Assert.Equal(first.Value!.Id, second.Value!.Id);
        Assert.Single(fixture.SupportTickets.Items);
        Assert.Equal(2, second.Value.Messages.Count);
    }

    [Fact]
    public async Task AssignToMeAsync_ForStaff_AssignsOpenTicket()
    {
        var rider = CreateRider();
        var staff = User.CreateStaff("Support", "Agent", "support-agent@test.local", "+994501220002", "hash", "SUPPORT2");
        var fixture = CreateFixture(staff, UserRole.Staff, rider, staff);
        var ticket = SupportTicket.Create(rider.Id, SupportTicketCategory.General, SupportTicketPriority.Normal, "Help", null, null, null, null, null, DateTime.UtcNow);
        fixture.SupportTickets.Items.Add(ticket);

        var result = await fixture.Service.AssignToMeAsync(ticket.Id);

        Assert.True(result.IsSuccess);
        Assert.Equal(staff.Id, result.Value!.AssignedStaffId);
        Assert.Equal(SupportTicketStatus.Open, result.Value.Status);
    }

    [Fact]
    public async Task EscalateToAdminAsync_ForAssignedStaff_MovesTicketToAdminReview()
    {
        var rider = CreateRider();
        var staff = User.CreateStaff("Support", "Agent", "support-agent-2@test.local", "+994501220003", "hash", "SUPPORT3");
        var fixture = CreateFixture(staff, UserRole.Staff, rider, staff);
        var ticket = SupportTicket.Create(rider.Id, SupportTicketCategory.Billing, SupportTicketPriority.High, "Billing issue", null, null, null, null, null, DateTime.UtcNow);
        ticket.AssignToStaff(staff.Id, DateTime.UtcNow);
        fixture.SupportTickets.Items.Add(ticket);

        var result = await fixture.Service.EscalateToAdminAsync(ticket.Id);

        Assert.True(result.IsSuccess);
        Assert.Equal(SupportTicketStatus.EscalatedToAdmin, result.Value!.Status);
        Assert.Contains(result.Value.Messages, message => message.SenderType == SupportMessageSenderType.System);
    }

    [Fact]
    public async Task CloseAsync_ForAssignedStaff_AddsSupportKpiEvent()
    {
        var rider = CreateRider();
        var staff = User.CreateStaff("Support", "Closer", "support-closer@test.local", "+994501220005", "hash", "SUPPORT5");
        var fixture = CreateFixture(staff, UserRole.Staff, rider, staff);
        var ticket = SupportTicket.Create(rider.Id, SupportTicketCategory.General, SupportTicketPriority.Normal, "Support close", null, null, null, null, null, DateTime.UtcNow.AddMinutes(-8));
        ticket.AssignToStaff(staff.Id, DateTime.UtcNow.AddMinutes(-7));
        fixture.SupportTickets.Items.Add(ticket);

        var result = await fixture.Service.CloseAsync(ticket.Id);

        Assert.True(result.IsSuccess);
        Assert.Equal(SupportTicketStatus.Closed, result.Value!.Status);
        var kpiEvent = Assert.Single(fixture.KpiEvents.Items);
        Assert.Equal(StaffKpiEventType.SupportTicketClosed, kpiEvent.Type);
        Assert.Equal(StaffTaskType.Support, kpiEvent.TaskType);
        Assert.Equal(ticket.Id, kpiEvent.SourceId);
    }

    [Fact]
    public async Task GetTicketAsync_ForAnotherRider_IsForbidden()
    {
        var owner = CreateRider();
        var otherRider = User.CreateRider("Other", "Rider", "other-rider@test.local", "+994501220004", "hash", "SUPPORT4");
        var fixture = CreateFixture(otherRider, UserRole.Rider, owner, otherRider);
        var ticket = SupportTicket.Create(owner.Id, SupportTicketCategory.General, SupportTicketPriority.Normal, "Help", null, null, null, null, null, DateTime.UtcNow);
        fixture.SupportTickets.Items.Add(ticket);

        var result = await fixture.Service.GetTicketAsync(ticket.Id);

        Assert.True(result.IsFailure);
        Assert.Equal("Support.Forbidden", result.Errors.Single().Code);
    }

    private static User CreateRider() =>
        User.CreateRider("Rider", "Customer", "support-rider@test.local", "+994501220001", "hash", "SUPPORT1");

    private static Fixture CreateFixture(User currentUser, UserRole currentRole, params User[] users)
    {
        var supportTickets = new SupportTicketRepo();
        var allUsers = users.Length == 0 ? [currentUser] : users;
        var kpiEvents = new StaffKpiEventRepo();
        var service = new SupportService(
            supportTickets,
            kpiEvents,
            new UserRepo(allUsers),
            new CurrentUser(currentUser.Id, currentUser.Email, currentRole),
            new UnitOfWork());

        return new Fixture(service, supportTickets, kpiEvents);
    }

    private sealed record Fixture(SupportService Service, SupportTicketRepo SupportTickets, StaffKpiEventRepo KpiEvents);

    private sealed class SupportTicketRepo : ISupportTicketRepository
    {
        private static readonly SupportTicketStatus[] ActiveStatuses =
        [
            SupportTicketStatus.Open,
            SupportTicketStatus.WaitingForStaff,
            SupportTicketStatus.WaitingForRider,
            SupportTicketStatus.EscalatedToAdmin
        ];

        public List<SupportTicket> Items { get; } = [];

        public Task<IReadOnlyList<SupportTicket>> GetByRiderIdAsync(Guid riderId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<SupportTicket>>(Items.Where(ticket => ticket.RiderId == riderId).ToList());

        public Task<IReadOnlyList<SupportTicket>> GetStaffQueueAsync(Guid staffId, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<SupportTicket>>(Items.Where(ticket => ticket.AssignedStaffId is null || ticket.AssignedStaffId == staffId).ToList());

        public Task<IReadOnlyList<SupportTicket>> GetAdminQueueAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<SupportTicket>>(Items);

        public Task<SupportTicket?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(ticket => ticket.Id == id));

        public Task<SupportTicket?> GetByIdWithMessagesAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(ticket => ticket.Id == id));

        public Task<SupportTicket?> GetActiveByScopeAsync(
            Guid riderId,
            SupportTicketCategory category,
            string? contextType,
            Guid? contextId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(ticket =>
                ticket.RiderId == riderId &&
                ticket.Category == category &&
                ticket.ContextType == contextType &&
                ticket.ContextId == contextId &&
                ActiveStatuses.Contains(ticket.Status)));

        public Task AddAsync(SupportTicket ticket, CancellationToken cancellationToken = default)
        {
            Items.Add(ticket);
            return Task.CompletedTask;
        }

        public Task AddMessageAsync(SupportMessage message, CancellationToken cancellationToken = default)
        {
            var ticket = Items.First(item => item.Id == message.TicketId);
            ticket.AddMessage(message, message.CreatedAt);
            return Task.CompletedTask;
        }

        public Task<bool> AssignStaffAsync(Guid ticketId, Guid staffId, DateTime updatedAt, CancellationToken cancellationToken = default)
        {
            var ticket = Items.FirstOrDefault(item => item.Id == ticketId);
            ticket?.AssignToStaff(staffId, updatedAt);
            return Task.FromResult(ticket is not null);
        }

        public Task<bool> EscalateToAdminAsync(Guid ticketId, DateTime updatedAt, CancellationToken cancellationToken = default)
        {
            var ticket = Items.FirstOrDefault(item => item.Id == ticketId);
            ticket?.EscalateToAdmin(updatedAt);
            return Task.FromResult(ticket is not null);
        }

        public Task<bool> UpdatePriorityAsync(Guid ticketId, SupportTicketPriority priority, DateTime updatedAt, CancellationToken cancellationToken = default)
        {
            var ticket = Items.FirstOrDefault(item => item.Id == ticketId);
            ticket?.ChangePriority(priority, updatedAt);
            return Task.FromResult(ticket is not null);
        }

        public Task<bool> CloseAsync(Guid ticketId, DateTime closedAt, CancellationToken cancellationToken = default)
        {
            var ticket = Items.FirstOrDefault(item => item.Id == ticketId);
            ticket?.Close(closedAt);
            return Task.FromResult(ticket is not null);
        }

        public Task<bool> ReopenAsync(Guid ticketId, DateTime updatedAt, CancellationToken cancellationToken = default)
        {
            var ticket = Items.FirstOrDefault(item => item.Id == ticketId);
            ticket?.Reopen(updatedAt);
            return Task.FromResult(ticket is not null);
        }

        public Task<bool> RecordMessageActivityAsync(
            Guid ticketId,
            SupportTicketStatus? status,
            DateTime updatedAt,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.Any(ticket => ticket.Id == ticketId));
    }

    private sealed class UserRepo(IReadOnlyList<User> users) : IUserRepository
    {
        public Task<IReadOnlyList<User>> GetAllAsync(string? search = null, UserRole? role = null, bool? isActive = null, UserVerificationStatus? verificationStatus = null, CancellationToken cancellationToken = default) =>
            Task.FromResult(users);

        public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(users.FirstOrDefault(user => user.Id == id));

        public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) =>
            Task.FromResult(users.FirstOrDefault(user => user.Email == email.Trim().ToLowerInvariant()));

        public Task<User?> GetByRefreshTokenHashAsync(string refreshTokenHash, CancellationToken cancellationToken = default) =>
            Task.FromResult<User?>(null);

        public Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task<bool> ExistsByPhoneAsync(string phone, CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task<bool> ExistsByDriverLicenseNumberAsync(string driverLicenseNumber, CancellationToken cancellationToken = default) =>
            Task.FromResult(false);

        public Task AddAsync(User user, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task DeleteAsync(User user, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
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

    private sealed class CurrentUser(Guid userId, string email, UserRole role) : ICurrentUserService
    {
        public Guid? UserId => userId;
        public string? Email => email;
        public UserRole? Role => role;
        public bool IsAuthenticated => true;
    }

    private sealed class UnitOfWork : IUnitOfWork
    {
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);
    }
}
