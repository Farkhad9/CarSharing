using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSharing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class mig_11_user_blocking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BlockReason",
                table: "Users",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "BlockedAt",
                table: "Users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BlockedByUserId",
                table: "Users",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "BlockedUntil",
                table: "Users",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BlockReason",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "BlockedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "BlockedByUserId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "BlockedUntil",
                table: "Users");
        }
    }
}
