using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class StaffTask
{
    public Guid Id { get; set; }
    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;
    public Guid AssigneeId { get; set; }
    public Guid? VehicleId { get; set; }
    public StaffTaskPriority Priority { get; set; } = StaffTaskPriority.Medium;
    public DateTime? DueAt { get; set; }
    public StaffTaskStatus Status { get; set; } = StaffTaskStatus.Waiting;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
