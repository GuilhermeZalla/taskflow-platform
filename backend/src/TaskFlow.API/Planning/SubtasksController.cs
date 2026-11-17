using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskFlow.Domain.Entities;
using TaskFlow.Infrastructure.Persistence;

namespace TaskFlow.API.Planning;

[ApiController]
[Authorize]
[Route("api/tasks/{taskId:guid}/subtasks")]
public sealed class SubtasksController(AppDbContext context) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(Guid taskId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        if (!await CanAccess(taskId, userId, false, cancellationToken)) return NotFound();
        return Ok(await context.Subtasks.Where(item => item.TaskId == taskId)
            .OrderBy(item => item.CreatedAt).ThenBy(item => item.Id)
            .Select(item => new { item.Id, item.TaskId, item.Title, item.IsCompleted, item.CreatedAt })
            .ToListAsync(cancellationToken));
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid taskId, SubtaskRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        if (!await CanAccess(taskId, userId, false, cancellationToken)) return NotFound();
        if (!await CanAccess(taskId, userId, true, cancellationToken)) return Forbid();
        var title = request.Title?.Trim();
        if (string.IsNullOrEmpty(title) || title.Length > 200)
            return BadRequest(new ProblemDetails { Title = "A subtarefa deve ter entre 1 e 200 caracteres." });
        var subtask = new Subtask
        {
            Id = Guid.NewGuid(), TaskId = taskId, Title = title,
            IsCompleted = request.IsCompleted, CreatedAt = DateTime.UtcNow
        };
        context.Subtasks.Add(subtask);
        await context.SaveChangesAsync(cancellationToken);
        return Created($"/api/tasks/{taskId}/subtasks/{subtask.Id}",
            new { subtask.Id, subtask.TaskId, subtask.Title, subtask.IsCompleted, subtask.CreatedAt });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid taskId, Guid id, SubtaskRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        if (!await CanAccess(taskId, userId, false, cancellationToken)) return NotFound();
        if (!await CanAccess(taskId, userId, true, cancellationToken)) return Forbid();
        var subtask = await context.Subtasks.FirstOrDefaultAsync(item => item.Id == id && item.TaskId == taskId, cancellationToken);
        if (subtask is null) return NotFound();
        var title = request.Title?.Trim();
        if (string.IsNullOrEmpty(title) || title.Length > 200)
            return BadRequest(new ProblemDetails { Title = "A subtarefa deve ter entre 1 e 200 caracteres." });
        subtask.Title = title;
        subtask.IsCompleted = request.IsCompleted;
        await context.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid taskId, Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Unauthorized();
        if (!await CanAccess(taskId, userId, false, cancellationToken)) return NotFound();
        if (!await CanAccess(taskId, userId, true, cancellationToken)) return Forbid();
        var subtask = await context.Subtasks.FirstOrDefaultAsync(item => item.Id == id && item.TaskId == taskId, cancellationToken);
        if (subtask is null) return NotFound();
        context.Subtasks.Remove(subtask);
        await context.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private Task<bool> CanAccess(Guid taskId, Guid userId, bool write, CancellationToken cancellationToken) =>
        context.Tasks.AnyAsync(task => task.Id == taskId &&
            (task.Project.Workspace.OwnerId == userId || task.Project.Members.Any(member =>
                member.UserId == userId && (!write || member.Role != "Observer"))), cancellationToken);

    private bool TryGetUserId(out Guid userId) =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out userId);

    public sealed record SubtaskRequest(string? Title, bool IsCompleted);
}
