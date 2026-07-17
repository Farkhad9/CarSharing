using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CarSharing.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class mig_13_unique_user_phone : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE Users
                SET Phone = REPLACE(REPLACE(REPLACE(REPLACE(Phone, ' ', ''), '-', ''), '(', ''), ')', '');

                UPDATE Users
                SET Phone = '+994' + SUBSTRING(Phone, 2, LEN(Phone) - 1)
                WHERE Phone LIKE '0[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]';

                UPDATE Users
                SET Phone = '+' + Phone
                WHERE Phone LIKE '994[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]';

                WITH DuplicatePhones AS
                (
                    SELECT
                        Id,
                        Phone,
                        ROW_NUMBER() OVER (PARTITION BY Phone ORDER BY CreatedAt, Id) AS RowNumber
                    FROM Users
                )
                UPDATE Users
                SET Phone = LEFT(Users.Phone, 15) + '-' + LEFT(CONVERT(nvarchar(36), Users.Id), 4)
                FROM Users
                INNER JOIN DuplicatePhones ON DuplicatePhones.Id = Users.Id
                WHERE DuplicatePhones.RowNumber > 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Phone",
                table: "Users",
                column: "Phone",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_Phone",
                table: "Users");
        }
    }
}
