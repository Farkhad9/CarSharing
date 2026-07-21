using CarSharing.Application.Common.Interfaces;
using CarSharing.Domain.Entities;
using CarSharing.Infrastructure.Persistence;
using CarSharing.WebApi.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CarSharing.WebApi.Controllers;

[ApiController]
[Route("api/trip-reviews")]
public sealed class TripReviewsController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly ICurrentUserService _currentUser;

    public TripReviewsController(AppDbContext dbContext, ICurrentUserService currentUser)
    {
        _dbContext = dbContext;
        _currentUser = currentUser;
    }

    [HttpGet("public")]
    public async Task<IActionResult> GetPublic([FromQuery] int take = 3, CancellationToken cancellationToken = default)
    {
        var safeTake = Math.Clamp(take, 1, 6);
        var reviews = await (
                from review in _dbContext.TripReviews
                join user in _dbContext.Users on review.UserId equals user.Id
                where review.IsPublished
                orderby review.CreatedAt descending
                select new PublicTripReviewResponse(
                    review.Id,
                    $"{user.FirstName} {user.LastName}".Trim(),
                    "ElectroStreet rider",
                    review.Rating,
                    review.Comment,
                    review.CreatedAt))
            .Take(safeTake)
            .ToListAsync(cancellationToken);

        return Ok(reviews);
    }

    [HttpGet("/api/admin/trip-reviews")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<IActionResult> GetAdminReviews(CancellationToken cancellationToken = default)
    {
        var reviews = await (
                from review in _dbContext.TripReviews
                join user in _dbContext.Users on review.UserId equals user.Id
                join trip in _dbContext.Trips on review.TripId equals trip.Id
                join vehicle in _dbContext.Vehicles on trip.VehicleId equals vehicle.Id
                orderby review.CreatedAt descending
                select new AdminTripReviewResponse(
                    review.Id,
                    review.TripId,
                    review.UserId,
                    $"{user.FirstName} {user.LastName}".Trim(),
                    user.Email,
                    $"{vehicle.Brand} {vehicle.Model}".Trim(),
                    vehicle.PlateNumber,
                    review.Rating,
                    review.Comment,
                    review.IsPublished,
                    review.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(reviews);
    }

    [HttpPut("/api/admin/trip-reviews/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<IActionResult> UpdateAdminReview(
        Guid id,
        UpdateTripReviewRequest request,
        CancellationToken cancellationToken)
    {
        var review = await _dbContext.TripReviews.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (review is null)
        {
            return NotFound(new { error = "Review was not found." });
        }

        var validationError = ValidateReview(request.Rating, request.Comment);
        if (validationError is not null)
        {
            return validationError;
        }

        review.UpdateContent(request.Rating, request.Comment.Trim());
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok(await GetAdminReviewResponseAsync(review.Id, cancellationToken));
    }

    [HttpPatch("/api/admin/trip-reviews/{id:guid}/publication")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<IActionResult> UpdatePublication(
        Guid id,
        UpdateTripReviewPublicationRequest request,
        CancellationToken cancellationToken)
    {
        var review = await _dbContext.TripReviews.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (review is null)
        {
            return NotFound(new { error = "Review was not found." });
        }

        if (request.IsPublished)
        {
            review.Publish();
        }
        else
        {
            review.Hide();
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok(await GetAdminReviewResponseAsync(review.Id, cancellationToken));
    }

    [HttpDelete("/api/admin/trip-reviews/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.AdminOnly)]
    public async Task<IActionResult> DeleteAdminReview(Guid id, CancellationToken cancellationToken)
    {
        var review = await _dbContext.TripReviews.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (review is null)
        {
            return NotFound(new { error = "Review was not found." });
        }

        _dbContext.TripReviews.Remove(review);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create(CreateTripReviewRequest request, CancellationToken cancellationToken)
    {
        if (_currentUser.UserId is not Guid userId)
        {
            return Unauthorized(new { error = "You are not logged in or your session expired. Please sign in again." });
        }

        var validationError = ValidateReview(request.Rating, request.Comment);
        if (validationError is not null)
        {
            return validationError;
        }

        var comment = request.Comment.Trim();

        var tripExists = await _dbContext.Trips
            .AnyAsync(trip => trip.Id == request.TripId && trip.UserId == userId, cancellationToken);

        if (!tripExists)
        {
            return NotFound(new { error = "Trip was not found for your account." });
        }

        var alreadyReviewed = await _dbContext.TripReviews
            .AnyAsync(review => review.TripId == request.TripId, cancellationToken);

        if (alreadyReviewed)
        {
            return Conflict(new { error = "This trip already has a review." });
        }

        var review = TripReview.Create(request.TripId, userId, request.Rating, comment, DateTime.UtcNow);
        _dbContext.TripReviews.Add(review);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetPublic), new { take = 1 }, new TripReviewResponse(
            review.Id,
            review.TripId,
            review.Rating,
            review.Comment,
            review.CreatedAt));
    }

    public sealed record CreateTripReviewRequest(Guid TripId, int Rating, string Comment);
    public sealed record UpdateTripReviewRequest(int Rating, string Comment);
    public sealed record UpdateTripReviewPublicationRequest(bool IsPublished);

    private sealed record PublicTripReviewResponse(
        Guid Id,
        string Name,
        string Role,
        int Rating,
        string Comment,
        DateTime CreatedAt);

    private sealed record TripReviewResponse(
        Guid Id,
        Guid TripId,
        int Rating,
        string Comment,
        DateTime CreatedAt);

    private sealed record AdminTripReviewResponse(
        Guid Id,
        Guid TripId,
        Guid UserId,
        string Name,
        string Email,
        string Vehicle,
        string PlateNumber,
        int Rating,
        string Comment,
        bool IsPublished,
        DateTime CreatedAt);

    private async Task<AdminTripReviewResponse> GetAdminReviewResponseAsync(Guid id, CancellationToken cancellationToken)
    {
        return await (
                from review in _dbContext.TripReviews
                join user in _dbContext.Users on review.UserId equals user.Id
                join trip in _dbContext.Trips on review.TripId equals trip.Id
                join vehicle in _dbContext.Vehicles on trip.VehicleId equals vehicle.Id
                where review.Id == id
                select new AdminTripReviewResponse(
                    review.Id,
                    review.TripId,
                    review.UserId,
                    $"{user.FirstName} {user.LastName}".Trim(),
                    user.Email,
                    $"{vehicle.Brand} {vehicle.Model}".Trim(),
                    vehicle.PlateNumber,
                    review.Rating,
                    review.Comment,
                    review.IsPublished,
                    review.CreatedAt))
            .SingleAsync(cancellationToken);
    }

    private BadRequestObjectResult? ValidateReview(int rating, string comment)
    {
        if (rating is < 1 or > 5)
        {
            return BadRequest(new { error = "Rating must be between 1 and 5." });
        }

        if (string.IsNullOrWhiteSpace(comment))
        {
            return BadRequest(new { error = "Comment is required." });
        }

        if (comment.Trim().Length > 600)
        {
            return BadRequest(new { error = "Comment must be 600 characters or shorter." });
        }

        return null;
    }
}
