using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class StaffTask : BaseEntity
{
    private StaffTask()
    {
    }

    public string Title { get; private set; } = null!;
    public string Description { get; private set; } = null!;
    public Guid AssigneeId { get; private set; }
    public Guid? VehicleId { get; private set; }
    public StaffTaskPriority Priority { get; private set; } = StaffTaskPriority.Medium;
    public DateTime? DueAt { get; private set; }
    public StaffTaskStatus Status { get; private set; } = StaffTaskStatus.Waiting;
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    public static StaffTask Create(
        string title,
        string description,
        Guid assigneeId,
        Guid? vehicleId,
        StaffTaskPriority priority,
        DateTime? dueAt,
        DateTime createdAt)
    {
        return new StaffTask
        {
            Id = Guid.NewGuid(),
            Title = title.Trim(),
            Description = description.Trim(),
            AssigneeId = assigneeId,
            VehicleId = vehicleId,
            Priority = priority,
            DueAt = dueAt,
            Status = StaffTaskStatus.Waiting,
            CreatedAt = createdAt,
            UpdatedAt = createdAt
        };
    }

    public void ChangeStatus(StaffTaskStatus status, DateTime updatedAt)
    {
        Status = status;
        UpdatedAt = updatedAt;
    }

    public void Reassign(Guid assigneeId, DateTime updatedAt)
    {
        AssigneeId = assigneeId;
        UpdatedAt = updatedAt;
    }
}
