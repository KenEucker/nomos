import type { Attachment, Comment, Project, Task, User, UserRole } from "@prisma/client";

type UserWithRoles = User & { roles: Array<UserRole & { role: { key: string; name: string } }> };

type TaskStatus = Task["status"];

export function serializeUser(user: UserWithRoles) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles.map((role) => role.role.key),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

export function serializeProject(project: Project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdByUserId: project.createdByUserId,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

export function serializeTask(task: Task) {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status as TaskStatus,
    assignedToUserId: task.assignedToUserId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

export function serializeComment(comment: Comment) {
  return {
    id: comment.id,
    taskId: comment.taskId,
    body: comment.body,
    authorUserId: comment.authorUserId,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString()
  };
}

export function serializeAttachment(attachment: Attachment) {
  return {
    id: attachment.id,
    taskId: attachment.taskId,
    key: attachment.key,
    filename: attachment.filename,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt.toISOString(),
    updatedAt: attachment.updatedAt.toISOString()
  };
}
