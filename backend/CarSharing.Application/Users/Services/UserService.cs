using AutoMapper;
using CarSharing.Application.Common.Interfaces;
using CarSharing.Application.Common.Models;
using CarSharing.Application.Users.Dtos;
using CarSharing.Domain.Entities;
using FluentValidation;

namespace CarSharing.Application.Users.Services;

public class UserService : IUserService
{
    private static readonly Error EmailNotUnique = new("User.EmailNotUnique", "User with this email already exists.");
    private static readonly Error InvalidCredentials = new("User.InvalidCredentials", "Invalid email or password.");
    private static readonly Error NotFound = new("User.NotFound", "User was not found.");

    private readonly IUserRepository _userRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IMapper _mapper;
    private readonly IValidator<RegisterUserRequest> _registerUserValidator;
    private readonly IValidator<LoginUserRequest> _loginUserValidator;

    public UserService(
        IUserRepository userRepository,
        IPasswordHasher passwordHasher,
        IMapper mapper,
        IValidator<RegisterUserRequest> registerUserValidator,
        IValidator<LoginUserRequest> loginUserValidator)
    {
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
        _mapper = mapper;
        _registerUserValidator = registerUserValidator;
        _loginUserValidator = loginUserValidator;
    }

    public async Task<Result<UserDto>> RegisterAsync(RegisterUserRequest request, CancellationToken cancellationToken = default)
    {
        var validationResult = await _registerUserValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<UserDto>.Failure(ToValidationErrors(validationResult));
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        if (await _userRepository.ExistsByEmailAsync(normalizedEmail, cancellationToken))
        {
            return Result<UserDto>.Failure(EmailNotUnique);
        }

        var user = User.CreateRider(
            request.FirstName,
            request.LastName,
            normalizedEmail,
            request.Phone,
            _passwordHasher.Hash(request.Password),
            request.DriverLicenseNumber);

        await _userRepository.AddAsync(user, cancellationToken);

        return Result<UserDto>.Success(_mapper.Map<UserDto>(user));
    }

    public async Task<Result<UserDto>> LoginAsync(LoginUserRequest request, CancellationToken cancellationToken = default)
    {
        var validationResult = await _loginUserValidator.ValidateAsync(request, cancellationToken);
        if (!validationResult.IsValid)
        {
            return Result<UserDto>.Failure(ToValidationErrors(validationResult));
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _userRepository.GetByEmailAsync(normalizedEmail, cancellationToken);

        if (user is null || !_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            return Result<UserDto>.Failure(InvalidCredentials);
        }

        return Result<UserDto>.Success(_mapper.Map<UserDto>(user));
    }

    public async Task<Result<UserDto>> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return Result<UserDto>.Failure(NotFound);
        }

        return Result<UserDto>.Success(_mapper.Map<UserDto>(user));
    }

    public async Task<Result<UserDto>> VerifyEmailAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(id, cancellationToken);
        if (user is null)
        {
            return Result<UserDto>.Failure(NotFound);
        }

        user.EmailVerified = true;
        user.VerifiedAt = DateTime.UtcNow;

        await _userRepository.UpdateAsync(user, cancellationToken);

        return Result<UserDto>.Success(_mapper.Map<UserDto>(user));
    }

    private static IReadOnlyList<Error> ToValidationErrors(FluentValidation.Results.ValidationResult validationResult)
    {
        return validationResult.Errors
            .Select(error => new Error($"Validation.{error.PropertyName}", error.ErrorMessage))
            .ToList();
    }
}
