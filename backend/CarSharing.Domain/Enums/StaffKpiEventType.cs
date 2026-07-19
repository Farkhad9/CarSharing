namespace CarSharing.Domain.Enums;

public enum StaffKpiEventType
{
    ServiceTaskCompleted = 1,
    KycVerificationApproved = 2,
    KycVerificationRejected = 3,
    KycVerificationReset = 12,
    TripPhotoApproved = 4,
    TripPhotoRejected = 5,
    SupportTicketClosed = 6,
    ComplaintReceived = 7,
    PraiseReceived = 8,
    RatingReceived = 9,
    ShiftStarted = 10,
    ShiftEnded = 11
}
