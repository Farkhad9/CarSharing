using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.ParkingZones.Dtos;
using CarSharing.Application.ParkingZones.Services;
using CarSharing.Application.ParkingZones.Validators;
using CarSharing.Domain.Entities;
using CarSharing.Domain.Enums;
using Xunit;

namespace CarSharing.Application.Tests;

public sealed class ParkingZoneServiceTests
{
    [Fact]
    public async Task CreateAsync_ForRestrictedZone_DisablesTripEnd()
    {
        var fixture = CreateFixture();

        var result = await fixture.Service.CreateAsync(CreateRequest(ParkingZoneType.Restricted));

        Assert.True(result.IsSuccess);
        Assert.False(result.Value!.AllowsTripEnd);
        Assert.Equal(ParkingZoneType.Restricted, fixture.Repository.Zones.Single().Type);
        Assert.False(fixture.Repository.Zones.Single().AllowsTripEnd);
    }

    [Fact]
    public async Task CreateAsync_WithLessThanThreePoints_ReturnsValidationError()
    {
        var fixture = CreateFixture();
        var request = CreateRequest(ParkingZoneType.Parking);
        request.Boundary = request.Boundary.Take(2).ToList();

        var result = await fixture.Service.CreateAsync(request);

        Assert.True(result.IsFailure);
        Assert.Contains(result.Errors, error => error.Code == "Validation.Boundary");
        Assert.Empty(fixture.Repository.Zones);
    }

    [Fact]
    public async Task DeactivateAsync_ForExistingZone_MarksInactive()
    {
        var fixture = CreateFixture();
        var created = await fixture.Service.CreateAsync(CreateRequest(ParkingZoneType.Parking));

        var result = await fixture.Service.DeactivateAsync(created.Value!.Id);

        Assert.True(result.IsSuccess);
        Assert.False(fixture.Repository.Zones.Single().IsActive);
    }

    private static Fixture CreateFixture()
    {
        var repository = new ParkingZoneRepositoryStub();
        var service = new ParkingZoneService(repository, new UnitOfWorkStub(), new UpsertParkingZoneRequestValidator());

        return new Fixture(service, repository);
    }

    private static UpsertParkingZoneRequest CreateRequest(ParkingZoneType type)
    {
        return new UpsertParkingZoneRequest
        {
            Name = type == ParkingZoneType.Restricted ? "No parking zone" : "Allowed parking zone",
            Type = type,
            AllowsTripEnd = true,
            Boundary =
            [
                new ParkingZonePointDto(40.3682, 49.8355),
                new ParkingZonePointDto(40.3722, 49.8582),
                new ParkingZonePointDto(40.3810, 49.8611),
                new ParkingZonePointDto(40.3794, 49.8340)
            ]
        };
    }

    private sealed record Fixture(ParkingZoneService Service, ParkingZoneRepositoryStub Repository);

    private sealed class ParkingZoneRepositoryStub : IParkingZoneRepository
    {
        public List<ParkingZone> Zones { get; } = [];

        public Task<IReadOnlyList<ParkingZone>> GetAllAsync(bool includeInactive = false, CancellationToken cancellationToken = default)
        {
            var zones = Zones
                .Where(zone => includeInactive || zone.IsActive)
                .ToList();

            return Task.FromResult<IReadOnlyList<ParkingZone>>(zones);
        }

        public Task<ParkingZone?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(Zones.FirstOrDefault(zone => zone.Id == id));
        }

        public Task AddAsync(ParkingZone zone, CancellationToken cancellationToken = default)
        {
            Zones.Add(zone);
            return Task.CompletedTask;
        }
    }

    private sealed class UnitOfWorkStub : IUnitOfWork
    {
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);
    }
}
