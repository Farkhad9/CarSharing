using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class SupportMessage : BaseEntity
{
    private SupportMessage()
    {
    }

    public Guid TicketId { get; private set; }
    public Guid? SenderId { get; private set; }
    public SupportMessageSenderType SenderType { get; private set; }
    public string SenderName { get; private set; } = null!;
    public string Body { get; private set; } = null!;
    public bool IsInternalNote { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public static SupportMessage Create(
        Guid ticketId,
        Guid? senderId,
        SupportMessageSenderType senderType,
        string senderName,
        string body,
        bool isInternalNote,
        DateTime createdAt)
    {
        return new SupportMessage
        {
            Id = Guid.NewGuid(),
            TicketId = ticketId,
            SenderId = senderId,
            SenderType = senderType,
            SenderName = senderName.Trim(),
            Body = body.Trim(),
            IsInternalNote = isInternalNote,
            CreatedAt = createdAt
        };
    }
}
