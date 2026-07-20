using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSharing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class mig_16 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ParkingZones",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Type = table.Column<int>(type: "int", nullable: false),
                    CenterLatitude = table.Column<double>(type: "float", nullable: false),
                    CenterLongitude = table.Column<double>(type: "float", nullable: false),
                    RadiusInMeters = table.Column<double>(type: "float", nullable: false),
                    BoundaryJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AllowsTripEnd = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParkingZones", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ParkingZones_IsActive",
                table: "ParkingZones",
                column: "IsActive");

            migrationBuilder.CreateIndex(
                name: "IX_ParkingZones_Type",
                table: "ParkingZones",
                column: "Type");

            migrationBuilder.InsertData(
                table: "ParkingZones",
                columns: new[] { "Id", "Name", "Type", "CenterLatitude", "CenterLongitude", "RadiusInMeters", "BoundaryJson", "AllowsTripEnd", "IsActive" },
                values: new object[,]
                {
                    {
                        new Guid("7d8a22e9-4e27-47f3-ae49-9d68d1a983f1"),
                        "Seaside Parking Zone",
                        1,
                        40.3752,
                        49.8472,
                        0d,
                        "[{\"Latitude\":40.3682,\"Longitude\":49.8355},{\"Latitude\":40.3722,\"Longitude\":49.8582},{\"Latitude\":40.381,\"Longitude\":49.8611},{\"Latitude\":40.3794,\"Longitude\":49.834}]",
                        true,
                        true
                    },
                    {
                        new Guid("55f36c49-0649-43a9-8aa2-a570f62c4f56"),
                        "Central Drop-off Zone",
                        1,
                        40.374175,
                        49.83375,
                        0d,
                        "[{\"Latitude\":40.3696,\"Longitude\":49.8248},{\"Latitude\":40.3773,\"Longitude\":49.8243},{\"Latitude\":40.3785,\"Longitude\":49.8418},{\"Latitude\":40.3713,\"Longitude\":49.8441}]",
                        true,
                        true
                    },
                    {
                        new Guid("913e3a56-7d3f-45d6-9a29-6692376d55b4"),
                        "No Parking: Old City",
                        4,
                        40.365375,
                        49.834425,
                        0d,
                        "[{\"Latitude\":40.3638,\"Longitude\":49.8297},{\"Latitude\":40.3679,\"Longitude\":49.8319},{\"Latitude\":40.3671,\"Longitude\":49.8388},{\"Latitude\":40.3627,\"Longitude\":49.8373}]",
                        false,
                        true
                    },
                    {
                        new Guid("41e07eb3-bc23-44db-9b84-702b72c616b1"),
                        "No Parking: Khyrdalan West",
                        4,
                        40.407525,
                        49.7763,
                        0d,
                        "[{\"Latitude\":40.4208,\"Longitude\":49.7359},{\"Latitude\":40.4241,\"Longitude\":49.7884},{\"Latitude\":40.3988,\"Longitude\":49.8176},{\"Latitude\":40.3864,\"Longitude\":49.7633}]",
                        false,
                        true
                    },
                    {
                        new Guid("58e96c5a-a92c-44f9-90ff-b5bc8a9ac5bd"),
                        "No Parking: Khyrdalan East",
                        4,
                        40.44585,
                        49.883125,
                        0d,
                        "[{\"Latitude\":40.4712,\"Longitude\":49.8553},{\"Latitude\":40.4655,\"Longitude\":49.9188},{\"Latitude\":40.4302,\"Longitude\":49.9093},{\"Latitude\":40.4165,\"Longitude\":49.8491}]",
                        false,
                        true
                    }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ParkingZones");
        }
    }
}
