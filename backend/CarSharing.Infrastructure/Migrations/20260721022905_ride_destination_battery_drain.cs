using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSharing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ride_destination_battery_drain : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DestinationLabel",
                table: "Trips",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<double>(
                name: "DestinationLatitude",
                table: "Trips",
                type: "float",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "DestinationLongitude",
                table: "Trips",
                type: "float",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<int>(
                name: "StartBatteryPercent",
                table: "Trips",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "DestinationLabel",
                table: "Reservations",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<double>(
                name: "DestinationLatitude",
                table: "Reservations",
                type: "float",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "DestinationLongitude",
                table: "Reservations",
                type: "float",
                nullable: false,
                defaultValue: 0.0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DestinationLabel",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "DestinationLatitude",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "DestinationLongitude",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "StartBatteryPercent",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "DestinationLabel",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "DestinationLatitude",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "DestinationLongitude",
                table: "Reservations");
        }
    }
}
