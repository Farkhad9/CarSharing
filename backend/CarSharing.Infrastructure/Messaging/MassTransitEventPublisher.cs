using CarSharing.Application.Messaging;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace CarSharing.Infrastructure.Messaging;

public sealed class MassTransitEventPublisher : IEventPublisher
{
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<MassTransitEventPublisher> _logger;

    public MassTransitEventPublisher(IPublishEndpoint publishEndpoint, ILogger<MassTransitEventPublisher> logger)
    {
        _publishEndpoint = publishEndpoint;
        _logger = logger;
    }

    public async Task PublishAsync<TEvent>(TEvent @event, CancellationToken cancellationToken = default)
        where TEvent : CarSharingEvent
    {
        try
        {
            await _publishEndpoint.Publish(@event, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _logger.LogWarning(exception, "RabbitMQ publish failed for event {EventType}.", @event.EventType);
        }
    }
}
