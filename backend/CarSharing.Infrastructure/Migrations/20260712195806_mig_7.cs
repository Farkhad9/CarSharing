using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSharing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class mig_7 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BasePricePerMinute",
                table: "Trips",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "BatteryMultiplier",
                table: "Trips",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                defaultValue: 1.00m);

            migrationBuilder.AddColumn<decimal>(
                name: "DemandMultiplier",
                table: "Trips",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                defaultValue: 1.00m);

            migrationBuilder.AddColumn<decimal>(
                name: "ZoneMultiplier",
                table: "Trips",
                type: "decimal(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                defaultValue: 1.00m);

            migrationBuilder.Sql("""
                UPDATE Trips
                SET BasePricePerMinute = PricePerMinute
                WHERE BasePricePerMinute = 0
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BasePricePerMinute",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "BatteryMultiplier",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "DemandMultiplier",
                table: "Trips");

            migrationBuilder.DropColumn(
                name: "ZoneMultiplier",
                table: "Trips");
        }
    }
}
