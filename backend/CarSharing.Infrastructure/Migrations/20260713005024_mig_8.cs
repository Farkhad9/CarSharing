using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSharing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class mig_8 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ChargingStations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    LocationLabel = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Zone = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Latitude = table.Column<double>(type: "float", nullable: false),
                    Longitude = table.Column<double>(type: "float", nullable: false),
                    PowerKw = table.Column<int>(type: "int", nullable: false),
                    TotalPorts = table.Column<int>(type: "int", nullable: false),
                    AvailablePorts = table.Column<int>(type: "int", nullable: false),
                    ConnectorTypes = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChargingStations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StaffTasks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(800)", maxLength: 800, nullable: false),
                    AssigneeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VehicleId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Priority = table.Column<int>(type: "int", nullable: false),
                    DueAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StaffTasks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ChargingSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VehicleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChargingStationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignedStaffId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CompletedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    StaffTaskId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    StartBatteryPercent = table.Column<int>(type: "int", nullable: false),
                    TargetBatteryPercent = table.Column<int>(type: "int", nullable: false),
                    CurrentBatteryPercent = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChargingSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChargingSessions_ChargingStations_ChargingStationId",
                        column: x => x.ChargingStationId,
                        principalTable: "ChargingStations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChargingSessions_StaffTasks_StaffTaskId",
                        column: x => x.StaffTaskId,
                        principalTable: "StaffTasks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChargingSessions_Vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "Vehicles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChargingSessions_AssignedStaffId",
                table: "ChargingSessions",
                column: "AssignedStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_ChargingSessions_ChargingStationId_Status",
                table: "ChargingSessions",
                columns: new[] { "ChargingStationId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ChargingSessions_StaffTaskId",
                table: "ChargingSessions",
                column: "StaffTaskId");

            migrationBuilder.CreateIndex(
                name: "IX_ChargingSessions_VehicleId_Status",
                table: "ChargingSessions",
                columns: new[] { "VehicleId", "Status" },
                filter: "[Status] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_ChargingStations_Status",
                table: "ChargingStations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ChargingStations_Zone",
                table: "ChargingStations",
                column: "Zone");

            migrationBuilder.CreateIndex(
                name: "IX_StaffTasks_AssigneeId",
                table: "StaffTasks",
                column: "AssigneeId");

            migrationBuilder.CreateIndex(
                name: "IX_StaffTasks_VehicleId_Status",
                table: "StaffTasks",
                columns: new[] { "VehicleId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChargingSessions");

            migrationBuilder.DropTable(
                name: "ChargingStations");

            migrationBuilder.DropTable(
                name: "StaffTasks");
        }
    }
}
