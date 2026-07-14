namespace CarSharing.Application.Messaging;

public sealed class NoOpEventPublisher : IEventPublisher
{
    public Task PublishAsync<TEvent>(TEvent @event, CancellationToken cancellationToken = default)
        where TEvent : CarSharingEvent => Task.CompletedTask;
}
