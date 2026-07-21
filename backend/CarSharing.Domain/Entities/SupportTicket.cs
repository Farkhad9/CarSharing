using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class SupportTicket : BaseEntity
{
    private SupportTicket()
    {
    }

    public Guid RiderId { get; private set; }
    public Guid? AssignedStaffId { get; private set; }
    public SupportTicketCategory Category { get; private set; }
    public SupportTicketPriority Priority { get; private set; }
    public SupportTicketStatus Status { get; private set; }
    public string Subject { get; private set; } = null!;
    public string? ContextType { get; private set; }
    public Guid? ContextId { get; private set; }
    public Guid? VehicleId { get; private set; }
    public Guid? ReservationId { get; private set; }
    public Guid? TripId { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime LastMessageAt { get; private set; }
    public DateTime? ClosedAt { get; private set; }
    public ICollection<SupportMessage> Messages { get; private set; } = [];

    public static SupportTicket Create(
        Guid riderId,
        SupportTicketCategory category,
        SupportTicketPriority priority,
        string subject,
        string? contextType,
        Guid? contextId,
        Guid? vehicleId,
        Guid? reservationId,
        Guid? tripId,
        DateTime createdAt)
    {
        return new SupportTicket
        {
            Id = Guid.NewGuid(),
            RiderId = riderId,
            Category = category,
            Priority = priority,
            Subject = subject.Trim(),
            ContextType = string.IsNullOrWhiteSpace(contextType) ? null : contextType.Trim(),
            ContextId = contextId,
            VehicleId = vehicleId,
            ReservationId = reservationId,
            TripId = tripId,
            Status = SupportTicketStatus.WaitingForStaff,
            CreatedAt = createdAt,
            UpdatedAt = createdAt,
            LastMessageAt = createdAt
        };
    }

    public void AddMessage(SupportMessage message, DateTime updatedAt)
    {
        Messages.Add(message);
        UpdatedAt = updatedAt;
        LastMessageAt = updatedAt;

        if (message.IsInternalNote ||
            message.SenderType == SupportMessageSenderType.System ||
            Status is SupportTicketStatus.Closed or SupportTicketStatus.Resolved)
        {
            return;
        }

        Status = message.SenderType == SupportMessageSenderType.Rider
            ? SupportTicketStatus.WaitingForStaff
            : SupportTicketStatus.WaitingForRider;
    }

    public void AssignToStaff(Guid staffId, DateTime updatedAt)
    {
        AssignedStaffId = staffId;
        if (Status != SupportTicketStatus.Closed)
        {
            Status = SupportTicketStatus.Open;
        }
        UpdatedAt = updatedAt;
    }

    public void EscalateToAdmin(DateTime updatedAt)
    {
        Status = SupportTicketStatus.EscalatedToAdmin;
        UpdatedAt = updatedAt;
    }

    public void ChangePriority(SupportTicketPriority priority, DateTime updatedAt)
    {
        Priority = priority;
        UpdatedAt = updatedAt;
    }

    public void Close(DateTime closedAt)
    {
        Status = SupportTicketStatus.Closed;
        ClosedAt = closedAt;
        UpdatedAt = closedAt;
    }

    public void Reopen(DateTime updatedAt)
    {
        Status = SupportTicketStatus.WaitingForStaff;
        ClosedAt = null;
        UpdatedAt = updatedAt;
    }
}
