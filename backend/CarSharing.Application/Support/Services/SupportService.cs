using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.Support.Dtos;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;

namespace CarSharing.Application.Support.Services;

public sealed class SupportService : ISupportService
{
    private static readonly Error Unauthenticated = new("Support.Unauthenticated", "User must be authenticated.");
    private static readonly Error RiderRequired = new("Support.RiderRequired", "Only riders can create support tickets.");
    private static readonly Error StaffRequired = new("Support.StaffRequired", "Only staff, admin, or super admin can manage support tickets.");
    private static readonly Error AdminRequired = new("Support.AdminRequired", "Only admin or super admin can access admin support queue.");
    private static readonly Error NotFound = new("Support.NotFound", "Support ticket was not found.");
    private static readonly Error Forbidden = new("Support.Forbidden", "User is not allowed to access this support ticket.");
    private static readonly Error StaffNotFound = new("Support.StaffNotFound", "Staff user was not found.");
    private static readonly Error StaffAssigneeRequired = new("Support.StaffAssigneeRequired", "Assignee must be an active staff user.");

    private readonly ISupportTicketRepository _supportTicketRepository;
    private readonly IStaffKpiEventRepository _staffKpiEventRepository;
    private readonly IUserRepository _userRepository;
    private readonly ICurrentUserService _currentUser;
    private readonly IUnitOfWork _unitOfWork;

    public SupportService(
        ISupportTicketRepository supportTicketRepository,
        IStaffKpiEventRepository staffKpiEventRepository,
        IUserRepository userRepository,
        ICurrentUserService currentUser,
        IUnitOfWork unitOfWork)
    {
        _supportTicketRepository = supportTicketRepository;
        _staffKpiEventRepository = staffKpiEventRepository;
        _userRepository = userRepository;
        _currentUser = currentUser;
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IReadOnlyList<SupportTicketDto>>> GetMyTicketsAsync(CancellationToken cancellationToken = default)
    {
        var accessError = RequireAuthenticated();
        if (accessError is not null) return Result<IReadOnlyList<SupportTicketDto>>.Failure(accessError);

        var tickets = await _supportTicketRepository.GetByRiderIdAsync(_currentUser.UserId!.Value, cancellationToken);
        var users = await LoadTicketUsersAsync(tickets, cancellationToken);
        return Result<IReadOnlyList<SupportTicketDto>>.Success(tickets.Select(ticket => Map(ticket, users, includeInternalNotes: false)).ToList());
    }

    public async Task<Result<IReadOnlyList<SupportTicketDto>>> GetStaffQueueAsync(CancellationToken cancellationToken = default)
    {
        var accessError = RequireStaffOrAdmin();
        if (accessError is not null) return Result<IReadOnlyList<SupportTicketDto>>.Failure(accessError);

        var tickets = _currentUser.Role is UserRole.Admin or UserRole.SuperAdmin
            ? await _supportTicketRepository.GetAdminQueueAsync(cancellationToken)
            : await _supportTicketRepository.GetStaffQueueAsync(_currentUser.UserId!.Value, cancellationToken);
        var users = await LoadTicketUsersAsync(tickets, cancellationToken);
        return Result<IReadOnlyList<SupportTicketDto>>.Success(tickets.Select(ticket => Map(ticket, users, includeInternalNotes: true)).ToList());
    }

    public async Task<Result<IReadOnlyList<SupportTicketDto>>> GetAdminQueueAsync(CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<IReadOnlyList<SupportTicketDto>>.Failure(accessError);

        var tickets = await _supportTicketRepository.GetAdminQueueAsync(cancellationToken);
        var users = await LoadTicketUsersAsync(tickets, cancellationToken);
        return Result<IReadOnlyList<SupportTicketDto>>.Success(tickets.Select(ticket => Map(ticket, users, includeInternalNotes: true)).ToList());
    }

    public async Task<Result<SupportTicketDto>> GetTicketAsync(Guid ticketId, CancellationToken cancellationToken = default)
    {
        var ticket = await _supportTicketRepository.GetByIdWithMessagesAsync(ticketId, cancellationToken);
        if (ticket is null) return Result<SupportTicketDto>.Failure(NotFound);

        if (!CanRead(ticket)) return Result<SupportTicketDto>.Failure(Forbidden);

        var users = await LoadTicketUsersAsync([ticket], cancellationToken);
        return Result<SupportTicketDto>.Success(Map(ticket, users, includeInternalNotes: CanManageSupport()));
    }

    public async Task<Result<SupportTicketDto>> CreateTicketAsync(CreateSupportTicketRequest request, CancellationToken cancellationToken = default)
    {
        var accessError = RequireRider();
        if (accessError is not null) return Result<SupportTicketDto>.Failure(accessError);

        var validationErrors = ValidateCreate(request);
        if (validationErrors.Count > 0) return Result<SupportTicketDto>.Failure(validationErrors);

        var riderId = _currentUser.UserId!.Value;
        var normalizedContextType = NormalizeContextType(request.ContextType);
        var existingTicket = await _supportTicketRepository.GetActiveByScopeAsync(
            riderId,
            request.Category,
            normalizedContextType,
            request.ContextId,
            cancellationToken);
        if (existingTicket is not null)
        {
            var now = DateTime.UtcNow;
            await _supportTicketRepository.AddMessageAsync(CreateMessage(existingTicket.Id, request.InitialMessage, false, now), cancellationToken);
            if (!await _supportTicketRepository.RecordMessageActivityAsync(existingTicket.Id, SupportTicketStatus.WaitingForStaff, now, cancellationToken))
            {
                return Result<SupportTicketDto>.Failure(NotFound);
            }
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return await MapSavedTicketAsync(existingTicket.Id, includeInternalNotes: false, cancellationToken);
        }

        var createdAt = DateTime.UtcNow;
        var ticket = SupportTicket.Create(
            riderId,
            request.Category,
            request.Priority,
            request.Subject,
            normalizedContextType,
            request.ContextId,
            request.VehicleId,
            request.ReservationId,
            request.TripId,
            createdAt);
        ticket.AddMessage(CreateMessage(ticket.Id, request.InitialMessage, false, createdAt), createdAt);

        await _supportTicketRepository.AddAsync(ticket, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await MapSavedTicketAsync(ticket.Id, includeInternalNotes: false, cancellationToken);
    }

    public async Task<Result<SupportTicketDto>> SendMessageAsync(Guid ticketId, SendSupportMessageRequest request, CancellationToken cancellationToken = default)
    {
        var ticket = await _supportTicketRepository.GetByIdAsync(ticketId, cancellationToken);
        if (ticket is null) return Result<SupportTicketDto>.Failure(NotFound);
        if (!CanWrite(ticket, request.IsInternalNote)) return Result<SupportTicketDto>.Failure(Forbidden);

        var body = request.Body?.Trim();
        if (string.IsNullOrWhiteSpace(body))
        {
            return Result<SupportTicketDto>.Failure(new Error("Validation.Body", "Message is required."));
        }

        if (body.Length > 4000)
        {
            return Result<SupportTicketDto>.Failure(new Error("Validation.Body", "Message cannot exceed 4000 characters."));
        }

        var now = DateTime.UtcNow;
        var message = CreateMessage(ticket.Id, body, request.IsInternalNote, now);
        await _supportTicketRepository.AddMessageAsync(message, cancellationToken);
        var nextStatus = GetMessageStatus(ticket, message);
        if (!await _supportTicketRepository.RecordMessageActivityAsync(ticket.Id, nextStatus, now, cancellationToken))
        {
            return Result<SupportTicketDto>.Failure(NotFound);
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await MapSavedTicketAsync(ticket.Id, includeInternalNotes: CanManageSupport(), cancellationToken);
    }

    public async Task<Result<SupportTicketDto>> AssignToMeAsync(Guid ticketId, CancellationToken cancellationToken = default)
    {
        var accessError = RequireStaffOrAdmin();
        if (accessError is not null) return Result<SupportTicketDto>.Failure(accessError);
        if (_currentUser.Role != UserRole.Staff) return Result<SupportTicketDto>.Failure(StaffRequired);

        return await AssignStaffCoreAsync(ticketId, _currentUser.UserId!.Value, cancellationToken);
    }

    public async Task<Result<SupportTicketDto>> AssignStaffAsync(Guid ticketId, AssignSupportTicketRequest request, CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<SupportTicketDto>.Failure(accessError);
        if (request.StaffId == Guid.Empty) return Result<SupportTicketDto>.Failure(new Error("Validation.StaffId", "Staff assignee is required."));

        return await AssignStaffCoreAsync(ticketId, request.StaffId, cancellationToken);
    }

    public async Task<Result<SupportTicketDto>> EscalateToAdminAsync(Guid ticketId, CancellationToken cancellationToken = default)
    {
        var accessError = RequireStaffOrAdmin();
        if (accessError is not null) return Result<SupportTicketDto>.Failure(accessError);

        var ticket = await _supportTicketRepository.GetByIdAsync(ticketId, cancellationToken);
        if (ticket is null) return Result<SupportTicketDto>.Failure(NotFound);
        if (_currentUser.Role == UserRole.Staff && ticket.AssignedStaffId != _currentUser.UserId) return Result<SupportTicketDto>.Failure(Forbidden);

        var now = DateTime.UtcNow;
        if (!await _supportTicketRepository.EscalateToAdminAsync(ticket.Id, now, cancellationToken))
        {
            return Result<SupportTicketDto>.Failure(NotFound);
        }
        await _supportTicketRepository.AddMessageAsync(SystemMessage(ticket.Id, "Ticket escalated to an administrator.", now), cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await MapSavedTicketAsync(ticket.Id, includeInternalNotes: true, cancellationToken);
    }

    public async Task<Result<SupportTicketDto>> UpdatePriorityAsync(Guid ticketId, UpdateSupportTicketPriorityRequest request, CancellationToken cancellationToken = default)
    {
        var accessError = RequireAdmin();
        if (accessError is not null) return Result<SupportTicketDto>.Failure(accessError);

        var ticket = await _supportTicketRepository.GetByIdAsync(ticketId, cancellationToken);
        if (ticket is null) return Result<SupportTicketDto>.Failure(NotFound);

        if (!await _supportTicketRepository.UpdatePriorityAsync(ticket.Id, request.Priority, DateTime.UtcNow, cancellationToken))
        {
            return Result<SupportTicketDto>.Failure(NotFound);
        }

        return await MapSavedTicketAsync(ticket.Id, includeInternalNotes: true, cancellationToken);
    }

    public async Task<Result<SupportTicketDto>> CloseAsync(Guid ticketId, CancellationToken cancellationToken = default)
    {
        var ticket = await _supportTicketRepository.GetByIdAsync(ticketId, cancellationToken);
        if (ticket is null) return Result<SupportTicketDto>.Failure(NotFound);
        if (!CanClose(ticket)) return Result<SupportTicketDto>.Failure(Forbidden);

        var now = DateTime.UtcNow;
        if (!await _supportTicketRepository.CloseAsync(ticket.Id, now, cancellationToken))
        {
            return Result<SupportTicketDto>.Failure(NotFound);
        }
        await _supportTicketRepository.AddMessageAsync(SystemMessage(ticket.Id, "Ticket closed.", now), cancellationToken);
        var closingStaffId = ticket.AssignedStaffId;
        if (_currentUser.Role == UserRole.Staff &&
            closingStaffId.HasValue &&
            closingStaffId == _currentUser.UserId &&
            !await _staffKpiEventRepository.ExistsAsync(closingStaffId.Value, ticket.Id, cancellationToken))
        {
            await _staffKpiEventRepository.AddAsync(
                StaffKpiEvent.Create(
                    closingStaffId.Value,
                    StaffKpiEventType.SupportTicketClosed,
                    StaffTaskType.Support,
                    ticket.Id,
                    ticket.Subject,
                    "Support ticket closed by staff.",
                    now,
                    ticket.CreatedAt,
                    now),
                cancellationToken);
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await MapSavedTicketAsync(ticket.Id, includeInternalNotes: CanManageSupport(), cancellationToken);
    }

    public async Task<Result<SupportTicketDto>> ReopenAsync(Guid ticketId, CancellationToken cancellationToken = default)
    {
        var ticket = await _supportTicketRepository.GetByIdAsync(ticketId, cancellationToken);
        if (ticket is null) return Result<SupportTicketDto>.Failure(NotFound);
        if (!CanRead(ticket)) return Result<SupportTicketDto>.Failure(Forbidden);

        var now = DateTime.UtcNow;
        if (!await _supportTicketRepository.ReopenAsync(ticket.Id, now, cancellationToken))
        {
            return Result<SupportTicketDto>.Failure(NotFound);
        }
        await _supportTicketRepository.AddMessageAsync(SystemMessage(ticket.Id, "Ticket reopened.", now), cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await MapSavedTicketAsync(ticket.Id, includeInternalNotes: CanManageSupport(), cancellationToken);
    }

    private async Task<Result<SupportTicketDto>> AssignStaffCoreAsync(Guid ticketId, Guid staffId, CancellationToken cancellationToken)
    {
        var ticket = await _supportTicketRepository.GetByIdAsync(ticketId, cancellationToken);
        if (ticket is null) return Result<SupportTicketDto>.Failure(NotFound);

        var staff = await _userRepository.GetByIdAsync(staffId, cancellationToken);
        if (staff is null) return Result<SupportTicketDto>.Failure(StaffNotFound);
        if (staff.Role != UserRole.Staff || !staff.IsActive || staff.IsBlocked(DateTime.UtcNow))
        {
            return Result<SupportTicketDto>.Failure(StaffAssigneeRequired);
        }

        var now = DateTime.UtcNow;
        if (!await _supportTicketRepository.AssignStaffAsync(ticket.Id, staffId, now, cancellationToken))
        {
            return Result<SupportTicketDto>.Failure(NotFound);
        }
        await _supportTicketRepository.AddMessageAsync(SystemMessage(ticket.Id, $"Ticket assigned to {GetUserName(staff)}.", now), cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return await MapSavedTicketAsync(ticket.Id, includeInternalNotes: true, cancellationToken);
    }

    private async Task<Result<SupportTicketDto>> MapSavedTicketAsync(
        Guid ticketId,
        bool includeInternalNotes,
        CancellationToken cancellationToken)
    {
        var savedTicket = await _supportTicketRepository.GetByIdWithMessagesAsync(ticketId, cancellationToken);
        if (savedTicket is null) return Result<SupportTicketDto>.Failure(NotFound);

        var users = await LoadTicketUsersAsync([savedTicket], cancellationToken);
        return Result<SupportTicketDto>.Success(Map(savedTicket, users, includeInternalNotes));
    }

    private Error? RequireAuthenticated()
    {
        return _currentUser.UserId is null ? Unauthenticated : null;
    }

    private Error? RequireRider()
    {
        if (_currentUser.UserId is null) return Unauthenticated;
        return _currentUser.Role == UserRole.Rider ? null : RiderRequired;
    }

    private Error? RequireStaffOrAdmin()
    {
        if (_currentUser.UserId is null) return Unauthenticated;
        return CanManageSupport() ? null : StaffRequired;
    }

    private Error? RequireAdmin()
    {
        if (_currentUser.UserId is null) return Unauthenticated;
        return _currentUser.Role is UserRole.Admin or UserRole.SuperAdmin ? null : AdminRequired;
    }

    private bool CanManageSupport() => _currentUser.Role is UserRole.Staff or UserRole.Admin or UserRole.SuperAdmin;

    private bool CanRead(SupportTicket ticket)
    {
        if (_currentUser.UserId is null) return false;
        if (_currentUser.Role == UserRole.Rider) return ticket.RiderId == _currentUser.UserId;
        if (_currentUser.Role == UserRole.Staff) return ticket.AssignedStaffId is null || ticket.AssignedStaffId == _currentUser.UserId;
        return _currentUser.Role is UserRole.Admin or UserRole.SuperAdmin;
    }

    private bool CanWrite(SupportTicket ticket, bool isInternalNote)
    {
        if (!CanRead(ticket)) return false;
        if (_currentUser.Role == UserRole.Rider) return !isInternalNote && ticket.RiderId == _currentUser.UserId;
        if (_currentUser.Role == UserRole.Staff) return ticket.AssignedStaffId is null || ticket.AssignedStaffId == _currentUser.UserId;
        return _currentUser.Role is UserRole.Admin or UserRole.SuperAdmin;
    }

    private bool CanClose(SupportTicket ticket)
    {
        if (_currentUser.Role == UserRole.Rider) return ticket.RiderId == _currentUser.UserId;
        if (_currentUser.Role == UserRole.Staff) return ticket.AssignedStaffId == _currentUser.UserId;
        return _currentUser.Role is UserRole.Admin or UserRole.SuperAdmin;
    }

    private SupportMessage CreateMessage(Guid ticketId, string body, bool isInternalNote, DateTime createdAt)
    {
        return SupportMessage.Create(
            ticketId,
            _currentUser.UserId,
            GetSenderType(),
            _currentUser.Email ?? "User",
            body,
            isInternalNote,
            createdAt);
    }

    private SupportMessage SystemMessage(Guid ticketId, string body, DateTime createdAt)
    {
        return SupportMessage.Create(ticketId, null, SupportMessageSenderType.System, "System", body, false, createdAt);
    }

    private static SupportTicketStatus? GetMessageStatus(SupportTicket ticket, SupportMessage message)
    {
        if (message.IsInternalNote ||
            message.SenderType == SupportMessageSenderType.System ||
            ticket.Status is SupportTicketStatus.Closed or SupportTicketStatus.Resolved)
        {
            return null;
        }

        return message.SenderType == SupportMessageSenderType.Rider
            ? SupportTicketStatus.WaitingForStaff
            : SupportTicketStatus.WaitingForRider;
    }

    private SupportMessageSenderType GetSenderType()
    {
        return _currentUser.Role switch
        {
            UserRole.Staff => SupportMessageSenderType.Staff,
            UserRole.Admin => SupportMessageSenderType.Admin,
            UserRole.SuperAdmin => SupportMessageSenderType.SuperAdmin,
            _ => SupportMessageSenderType.Rider
        };
    }

    private static string? NormalizeContextType(string? contextType)
    {
        return string.IsNullOrWhiteSpace(contextType) ? null : contextType.Trim().ToLowerInvariant();
    }

    private static List<Error> ValidateCreate(CreateSupportTicketRequest request)
    {
        var errors = new List<Error>();

        if (string.IsNullOrWhiteSpace(request.Subject))
        {
            errors.Add(new Error("Validation.Subject", "Subject is required."));
        }
        else if (request.Subject.Trim().Length > 180)
        {
            errors.Add(new Error("Validation.Subject", "Subject cannot exceed 180 characters."));
        }

        if (string.IsNullOrWhiteSpace(request.InitialMessage))
        {
            errors.Add(new Error("Validation.InitialMessage", "Message is required."));
        }
        else if (request.InitialMessage.Trim().Length > 4000)
        {
            errors.Add(new Error("Validation.InitialMessage", "Message cannot exceed 4000 characters."));
        }

        if (!Enum.IsDefined(request.Category))
        {
            errors.Add(new Error("Validation.Category", "Support category is not supported."));
        }

        if (!Enum.IsDefined(request.Priority))
        {
            errors.Add(new Error("Validation.Priority", "Support priority is not supported."));
        }

        return errors;
    }

    private async Task<Dictionary<Guid, User>> LoadTicketUsersAsync(IReadOnlyList<SupportTicket> tickets, CancellationToken cancellationToken)
    {
        var userIds = tickets
            .SelectMany(ticket => new[] { ticket.RiderId, ticket.AssignedStaffId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        var users = new Dictionary<Guid, User>();

        foreach (var userId in userIds)
        {
            var user = await _userRepository.GetByIdAsync(userId, cancellationToken);
            if (user is not null) users[user.Id] = user;
        }

        return users;
    }

    private static SupportTicketDto Map(SupportTicket ticket, IReadOnlyDictionary<Guid, User> users, bool includeInternalNotes)
    {
        users.TryGetValue(ticket.RiderId, out var rider);
        User? staff = null;
        if (ticket.AssignedStaffId.HasValue)
        {
            users.TryGetValue(ticket.AssignedStaffId.Value, out staff);
        }

        return new SupportTicketDto(
            ticket.Id,
            ticket.RiderId,
            rider is null ? "Rider" : GetUserName(rider),
            rider?.Email ?? string.Empty,
            ticket.AssignedStaffId,
            staff is null ? null : GetUserName(staff),
            ticket.Category,
            ticket.Priority,
            ticket.Status,
            ticket.Subject,
            ticket.ContextType,
            ticket.ContextId,
            ticket.VehicleId,
            ticket.ReservationId,
            ticket.TripId,
            ticket.CreatedAt,
            ticket.UpdatedAt,
            ticket.LastMessageAt,
            ticket.ClosedAt,
            ticket.Messages
                .Where(message => includeInternalNotes || !message.IsInternalNote)
                .OrderBy(message => message.CreatedAt)
                .Select(message => new SupportMessageDto(
                    message.Id,
                    message.TicketId,
                    message.SenderId,
                    message.SenderType,
                    message.SenderName,
                    message.Body,
                    message.IsInternalNote,
                    message.CreatedAt))
                .ToList());
    }

    private static string GetUserName(User user)
    {
        var name = $"{user.FirstName} {user.LastName}".Trim();
        return string.IsNullOrWhiteSpace(name) ? user.Email : name;
    }
}
