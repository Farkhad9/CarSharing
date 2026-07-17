using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSharing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class mig_14 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GalleryImageUrl1",
                table: "Vehicles",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GalleryImageUrl2",
                table: "Vehicles",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GalleryImageUrl3",
                table: "Vehicles",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MainImageUrl",
                table: "Vehicles",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GalleryImageUrl1",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "GalleryImageUrl2",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "GalleryImageUrl3",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "MainImageUrl",
                table: "Vehicles");
        }
    }
}
