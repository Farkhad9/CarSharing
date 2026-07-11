namespace CarSharing.Domain.Enums;

public enum TripStatus
{
    Active = 1,
    PendingCompletionReview = 2,
    AwaitingPayment = 3,
    Completed = 4,
    Cancelled = 5
}
