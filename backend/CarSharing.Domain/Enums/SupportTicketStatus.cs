namespace CarSharing.Domain.Enums;

public enum SupportTicketStatus
{
    Open = 1,
    WaitingForStaff = 2,
    WaitingForRider = 3,
    EscalatedToAdmin = 4,
    Resolved = 5,
    Closed = 6
}
