using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class StaffKpiEvent : BaseEntity
{
    private StaffKpiEvent()
    {
    }

    public Guid StaffUserId { get; private set; }
    public StaffKpiEventType Type { get; private set; }
    public StaffTaskType TaskType { get; private set; }
    public Guid? SourceId { get; private set; }
    public string Title { get; private set; } = null!;
    public string Result { get; private set; } = null!;
    public DateTime OccurredAt { get; private set; }
    public DateTime? StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public int DurationMinutes { get; private set; }
    public decimal? Rating { get; private set; }

    public static StaffKpiEvent Create(
        Guid staffUserId,
        StaffKpiEventType type,
        StaffTaskType taskType,
        Guid? sourceId,
        string title,
        string result,
        DateTime occurredAt,
        DateTime? startedAt = null,
        DateTime? completedAt = null,
        decimal? rating = null)
    {
        var durationMinutes = startedAt.HasValue && completedAt.HasValue
            ? Math.Max(0, (int)Math.Round((completedAt.Value - startedAt.Value).TotalMinutes, MidpointRounding.AwayFromZero))
            : 0;

        return new StaffKpiEvent
        {
            Id = Guid.NewGuid(),
            StaffUserId = staffUserId,
            Type = type,
            TaskType = taskType,
            SourceId = sourceId,
            Title = title.Trim(),
            Result = result.Trim(),
            OccurredAt = occurredAt,
            StartedAt = startedAt,
            CompletedAt = completedAt,
            DurationMinutes = durationMinutes,
            Rating = rating
        };
    }
}
