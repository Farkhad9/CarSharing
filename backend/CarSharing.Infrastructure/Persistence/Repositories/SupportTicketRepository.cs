using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.Infrastructure.Persistence.Repositories;

public sealed class SupportTicketRepository : ISupportTicketRepository
{
    private static readonly SupportTicketStatus[] ActiveStatuses =
    [
        SupportTicketStatus.Open,
        SupportTicketStatus.WaitingForStaff,
        SupportTicketStatus.WaitingForRider,
        SupportTicketStatus.EscalatedToAdmin
    ];

    private readonly AppDbContext _dbContext;

    public SupportTicketRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<SupportTicket>> GetByRiderIdAsync(Guid riderId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.SupportTickets
            .AsNoTracking()
            .Include(ticket => ticket.Messages)
            .Where(ticket => ticket.RiderId == riderId)
            .OrderByDescending(ticket => ticket.LastMessageAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SupportTicket>> GetStaffQueueAsync(Guid staffId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.SupportTickets
            .AsNoTracking()
            .Include(ticket => ticket.Messages)
            .Where(ticket =>
                (ActiveStatuses.Contains(ticket.Status) &&
                    (ticket.AssignedStaffId == null || ticket.AssignedStaffId == staffId) &&
                    ticket.Status != SupportTicketStatus.EscalatedToAdmin) ||
                (ticket.AssignedStaffId == staffId &&
                    (ticket.Status == SupportTicketStatus.Closed || ticket.Status == SupportTicketStatus.Resolved)))
            .OrderByDescending(ticket => ticket.Priority)
            .ThenByDescending(ticket => ticket.LastMessageAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SupportTicket>> GetAdminQueueAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.SupportTickets
            .AsNoTracking()
            .Include(ticket => ticket.Messages)
            .OrderByDescending(ticket => ticket.Status == SupportTicketStatus.EscalatedToAdmin)
            .ThenByDescending(ticket => ticket.Priority)
            .ThenByDescending(ticket => ticket.LastMessageAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<SupportTicket?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.SupportTickets
            .FirstOrDefaultAsync(ticket => ticket.Id == id, cancellationToken);
    }

    public async Task<SupportTicket?> GetByIdWithMessagesAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _dbContext.SupportTickets
            .AsNoTracking()
            .Include(ticket => ticket.Messages)
            .FirstOrDefaultAsync(ticket => ticket.Id == id, cancellationToken);
    }

    public async Task<SupportTicket?> GetActiveByScopeAsync(
        Guid riderId,
        SupportTicketCategory category,
        string? contextType,
        Guid? contextId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.SupportTickets
            .AsNoTracking()
            .Where(ticket =>
                ticket.RiderId == riderId &&
                ticket.Category == category &&
                ticket.ContextType == contextType &&
                ticket.ContextId == contextId &&
                ActiveStatuses.Contains(ticket.Status))
            .OrderByDescending(ticket => ticket.LastMessageAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task AddAsync(SupportTicket ticket, CancellationToken cancellationToken = default)
    {
        await _dbContext.SupportTickets.AddAsync(ticket, cancellationToken);
    }

    public async Task AddMessageAsync(SupportMessage message, CancellationToken cancellationToken = default)
    {
        await _dbContext.SupportMessages.AddAsync(message, cancellationToken);
    }

    public async Task<bool> AssignStaffAsync(Guid ticketId, Guid staffId, DateTime updatedAt, CancellationToken cancellationToken = default)
    {
        var affectedRows = await _dbContext.SupportTickets
            .Where(ticket => ticket.Id == ticketId)
            .ExecuteUpdateAsync(updates => updates
                .SetProperty(ticket => ticket.AssignedStaffId, (Guid?)staffId)
                .SetProperty(ticket => ticket.Status, SupportTicketStatus.Open)
                .SetProperty(ticket => ticket.UpdatedAt, updatedAt),
                cancellationToken);

        return affectedRows > 0;
    }

    public async Task<bool> EscalateToAdminAsync(Guid ticketId, DateTime updatedAt, CancellationToken cancellationToken = default)
    {
        var affectedRows = await _dbContext.SupportTickets
            .Where(ticket => ticket.Id == ticketId)
            .ExecuteUpdateAsync(updates => updates
                .SetProperty(ticket => ticket.Status, SupportTicketStatus.EscalatedToAdmin)
                .SetProperty(ticket => ticket.UpdatedAt, updatedAt),
                cancellationToken);

        return affectedRows > 0;
    }

    public async Task<bool> UpdatePriorityAsync(Guid ticketId, SupportTicketPriority priority, DateTime updatedAt, CancellationToken cancellationToken = default)
    {
        var affectedRows = await _dbContext.SupportTickets
            .Where(ticket => ticket.Id == ticketId)
            .ExecuteUpdateAsync(updates => updates
                .SetProperty(ticket => ticket.Priority, priority)
                .SetProperty(ticket => ticket.UpdatedAt, updatedAt),
                cancellationToken);

        return affectedRows > 0;
    }

    public async Task<bool> CloseAsync(Guid ticketId, DateTime closedAt, CancellationToken cancellationToken = default)
    {
        var affectedRows = await _dbContext.SupportTickets
            .Where(ticket => ticket.Id == ticketId)
            .ExecuteUpdateAsync(updates => updates
                .SetProperty(ticket => ticket.Status, SupportTicketStatus.Closed)
                .SetProperty(ticket => ticket.ClosedAt, (DateTime?)closedAt)
                .SetProperty(ticket => ticket.UpdatedAt, closedAt),
                cancellationToken);

        return affectedRows > 0;
    }

    public async Task<bool> ReopenAsync(Guid ticketId, DateTime updatedAt, CancellationToken cancellationToken = default)
    {
        var affectedRows = await _dbContext.SupportTickets
            .Where(ticket => ticket.Id == ticketId)
            .ExecuteUpdateAsync(updates => updates
                .SetProperty(ticket => ticket.Status, SupportTicketStatus.WaitingForStaff)
                .SetProperty(ticket => ticket.ClosedAt, (DateTime?)null)
                .SetProperty(ticket => ticket.UpdatedAt, updatedAt),
                cancellationToken);

        return affectedRows > 0;
    }

    public async Task<bool> RecordMessageActivityAsync(
        Guid ticketId,
        SupportTicketStatus? status,
        DateTime updatedAt,
        CancellationToken cancellationToken = default)
    {
        var query = _dbContext.SupportTickets.Where(ticket => ticket.Id == ticketId);
        var affectedRows = status.HasValue
            ? await query.ExecuteUpdateAsync(updates => updates
                .SetProperty(ticket => ticket.Status, status.Value)
                .SetProperty(ticket => ticket.UpdatedAt, updatedAt)
                .SetProperty(ticket => ticket.LastMessageAt, updatedAt),
                cancellationToken)
            : await query.ExecuteUpdateAsync(updates => updates
                .SetProperty(ticket => ticket.UpdatedAt, updatedAt)
                .SetProperty(ticket => ticket.LastMessageAt, updatedAt),
                cancellationToken);

        return affectedRows > 0;
    }
}
