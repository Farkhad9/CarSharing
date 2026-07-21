using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;

namespace CarSharing.Application.Common.Interfaces;

public interface ISupportTicketRepository
{
    Task<IReadOnlyList<SupportTicket>> GetByRiderIdAsync(Guid riderId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SupportTicket>> GetStaffQueueAsync(Guid staffId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SupportTicket>> GetAdminQueueAsync(CancellationToken cancellationToken = default);
    Task<SupportTicket?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<SupportTicket?> GetByIdWithMessagesAsync(Guid id, CancellationToken cancellationToken = default);
    Task<SupportTicket?> GetActiveByScopeAsync(
        Guid riderId,
        SupportTicketCategory category,
        string? contextType,
        Guid? contextId,
        CancellationToken cancellationToken = default);
    Task AddAsync(SupportTicket ticket, CancellationToken cancellationToken = default);
    Task AddMessageAsync(SupportMessage message, CancellationToken cancellationToken = default);
    Task<bool> AssignStaffAsync(Guid ticketId, Guid staffId, DateTime updatedAt, CancellationToken cancellationToken = default);
    Task<bool> EscalateToAdminAsync(Guid ticketId, DateTime updatedAt, CancellationToken cancellationToken = default);
    Task<bool> UpdatePriorityAsync(Guid ticketId, SupportTicketPriority priority, DateTime updatedAt, CancellationToken cancellationToken = default);
    Task<bool> CloseAsync(Guid ticketId, DateTime closedAt, CancellationToken cancellationToken = default);
    Task<bool> ReopenAsync(Guid ticketId, DateTime updatedAt, CancellationToken cancellationToken = default);
    Task<bool> RecordMessageActivityAsync(
        Guid ticketId,
        SupportTicketStatus? status,
        DateTime updatedAt,
        CancellationToken cancellationToken = default);
}
