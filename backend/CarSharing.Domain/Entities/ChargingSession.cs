using CarSharing.Domain.Enums;

namespace CarSharing.Domain.Entities;

public class ChargingSession : BaseEntity
{
    private ChargingSession()
    {
    }

    public Guid VehicleId { get; private set; }
    public Guid ChargingStationId { get; private set; }
    public Guid AssignedStaffId { get; private set; }
    public Guid CreatedByUserId { get; private set; }
    public Guid? CompletedByUserId { get; private set; }
    public Guid StaffTaskId { get; private set; }
    public ChargingSessionStatus Status { get; private set; } = ChargingSessionStatus.Active;
    public DateTime StartedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public int StartBatteryPercent { get; private set; }
    public int TargetBatteryPercent { get; private set; }
    public int CurrentBatteryPercent { get; private set; }
    public string? Notes { get; private set; }

    public static ChargingSession Start(
        Vehicle vehicle,
        ChargingStation station,
        Guid assignedStaffId,
        Guid createdByUserId,
        Guid staffTaskId,
        int targetBatteryPercent,
        DateTime startedAt)
    {
        return new ChargingSession
        {
            Id = Guid.NewGuid(),
            VehicleId = vehicle.Id,
            ChargingStationId = station.Id,
            AssignedStaffId = assignedStaffId,
            CreatedByUserId = createdByUserId,
            StaffTaskId = staffTaskId,
            Status = ChargingSessionStatus.Active,
            StartedAt = startedAt,
            StartBatteryPercent = vehicle.BatteryPercent,
            TargetBatteryPercent = targetBatteryPercent,
            CurrentBatteryPercent = vehicle.BatteryPercent
        };
    }

    public void Complete(Guid completedByUserId, int finalBatteryPercent, string? notes, DateTime completedAt)
    {
        if (Status != ChargingSessionStatus.Active)
        {
            throw new InvalidOperationException("Only an active charging session can be completed.");
        }

        CompletedByUserId = completedByUserId;
        CompletedAt = completedAt;
        CurrentBatteryPercent = finalBatteryPercent;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        Status = ChargingSessionStatus.Completed;
    }

    public void ReassignStaff(Guid assignedStaffId)
    {
        if (Status != ChargingSessionStatus.Active)
        {
            throw new InvalidOperationException("Only an active charging session can be reassigned.");
        }

        AssignedStaffId = assignedStaffId;
    }
}
