using CarSharing.Application.Common.Models;
using CarSharing.Application.Support.Dtos;

namespace CarSharing.Application.Support.Services;

public interface ISupportService
{
    Task<Result<IReadOnlyList<SupportTicketDto>>> GetMyTicketsAsync(CancellationToken cancellationToken = default);
    Task<Result<IReadOnlyList<SupportTicketDto>>> GetStaffQueueAsync(CancellationToken cancellationToken = default);
    Task<Result<IReadOnlyList<SupportTicketDto>>> GetAdminQueueAsync(CancellationToken cancellationToken = default);
    Task<Result<SupportTicketDto>> GetTicketAsync(Guid ticketId, CancellationToken cancellationToken = default);
    Task<Result<SupportTicketDto>> CreateTicketAsync(CreateSupportTicketRequest request, CancellationToken cancellationToken = default);
    Task<Result<SupportTicketDto>> SendMessageAsync(Guid ticketId, SendSupportMessageRequest request, CancellationToken cancellationToken = default);
    Task<Result<SupportTicketDto>> AssignToMeAsync(Guid ticketId, CancellationToken cancellationToken = default);
    Task<Result<SupportTicketDto>> AssignStaffAsync(Guid ticketId, AssignSupportTicketRequest request, CancellationToken cancellationToken = default);
    Task<Result<SupportTicketDto>> EscalateToAdminAsync(Guid ticketId, CancellationToken cancellationToken = default);
    Task<Result<SupportTicketDto>> UpdatePriorityAsync(Guid ticketId, UpdateSupportTicketPriorityRequest request, CancellationToken cancellationToken = default);
    Task<Result<SupportTicketDto>> CloseAsync(Guid ticketId, CancellationToken cancellationToken = default);
    Task<Result<SupportTicketDto>> ReopenAsync(Guid ticketId, CancellationToken cancellationToken = default);
}
