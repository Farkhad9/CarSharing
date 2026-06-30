namespace CarSharing.Application.Common.Models;

public class Result<T>
{
    private Result(T? value, IReadOnlyList<Error> errors, bool isSuccess)
    {
        Value = value;
        Errors = errors;
        IsSuccess = isSuccess;
    }

    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;
    public T? Value { get; }
    public IReadOnlyList<Error> Errors { get; }

    public static Result<T> Success(T value)
    {
        return new Result<T>(value, [], true);
    }

    public static Result<T> Failure(Error error)
    {
        return new Result<T>(default, [error], false);
    }

    public static Result<T> Failure(IReadOnlyList<Error> errors)
    {
        return new Result<T>(default, errors, false);
    }
}
