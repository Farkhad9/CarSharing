using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSharing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class mig_17 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Users_DriverLicenseNumber",
                table: "Users",
                column: "DriverLicenseNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_DriverLicenseNumber",
                table: "Users");
        }
    }
}
