using CarSharing.Domain.Enums;

namespace CarSharing.Application.Support.Dtos;

public sealed record SupportMessageDto(
    Guid Id,
    Guid TicketId,
    Guid? SenderId,
    SupportMessageSenderType SenderType,
    string SenderName,
    string Body,
    bool IsInternalNote,
    DateTime CreatedAt);

public sealed record SupportTicketDto(
    Guid Id,
    Guid RiderId,
    string RiderName,
    string RiderEmail,
    Guid? AssignedStaffId,
    string? AssignedStaffName,
    SupportTicketCategory Category,
    SupportTicketPriority Priority,
    SupportTicketStatus Status,
    string Subject,
    string? ContextType,
    Guid? ContextId,
    Guid? VehicleId,
    Guid? ReservationId,
    Guid? TripId,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime LastMessageAt,
    DateTime? ClosedAt,
    IReadOnlyList<SupportMessageDto> Messages);

public sealed record CreateSupportTicketRequest(
    SupportTicketCategory Category,
    string Subject,
    string InitialMessage,
    SupportTicketPriority Priority = SupportTicketPriority.Normal,
    string? ContextType = null,
    Guid? ContextId = null,
    Guid? VehicleId = null,
    Guid? ReservationId = null,
    Guid? TripId = null);

public sealed record SendSupportMessageRequest(string Body, bool IsInternalNote = false);

public sealed record AssignSupportTicketRequest(Guid StaffId);

public sealed record UpdateSupportTicketPriorityRequest(SupportTicketPriority Priority);
