namespace CarSharing.Domain.Enums;

public enum TripStatus
{
    Active = 1,
    Paused = 2,
    AwaitingApproval = 3,
    AwaitingPayment = 4,
    Completed = 5,
    Cancelled = 6
}
