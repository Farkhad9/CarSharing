namespace CarSharing.Application.Messaging;

public abstract record CarSharingEvent(Guid EventId, string EventType, DateTime OccurredAtUtc);
