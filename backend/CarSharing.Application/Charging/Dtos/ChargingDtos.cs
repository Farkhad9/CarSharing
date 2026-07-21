using CarSharing.Domain.Enums;

namespace CarSharing.Application.Charging.Dtos;

public sealed record ChargingStationDto(
    Guid Id,
    string Name,
    ChargingStationStatus Status,
    string LocationLabel,
    string Zone,
    double Latitude,
    double Longitude,
    int PowerKw,
    int TotalPorts,
    int AvailablePorts,
    IReadOnlyList<string> ConnectorTypes);

public sealed record ChargingSessionDto(
    Guid Id,
    Guid VehicleId,
    Guid ChargingStationId,
    Guid AssignedStaffId,
    Guid CreatedByUserId,
    Guid? CompletedByUserId,
    Guid StaffTaskId,
    ChargingSessionStatus Status,
    DateTime StartedAt,
    DateTime? CompletedAt,
    int StartBatteryPercent,
    int TargetBatteryPercent,
    int CurrentBatteryPercent,
    int CurrentRangeKm,
    int MinutesRemaining,
    string? Notes);

public sealed record StaffTaskDto(
    Guid Id,
    string Title,
    string Description,
    Guid AssigneeId,
    Guid? VehicleId,
    StaffTaskType Type,
    StaffTaskPriority Priority,
    DateTime? DueAt,
    StaffTaskStatus Status,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record ChargingSessionDetailsDto(
    ChargingSessionDto Session,
    StaffTaskDto StaffTask,
    ChargingStationDto Station);

public sealed record CreateChargingStationRequest(
    string Name,
    ChargingStationStatus Status,
    string LocationLabel,
    string Zone,
    double Latitude,
    double Longitude,
    int PowerKw,
    int TotalPorts,
    int AvailablePorts,
    IReadOnlyList<string> ConnectorTypes);

public sealed record UpdateChargingStationStatusRequest(ChargingStationStatus Status);

public sealed record StartChargingSessionRequest(
    Guid VehicleId,
    Guid ChargingStationId,
    Guid AssignedStaffId,
    int TargetBatteryPercent = 100);

public sealed record CompleteChargingSessionRequest(
    int FinalBatteryPercent = 100,
    string? Notes = null);
