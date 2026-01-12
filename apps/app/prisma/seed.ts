import bcrypt from "bcryptjs"
import { getPrismaClient } from "../src/platform/db/prisma"

const prisma = getPrismaClient()

async function main() {
  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------
  const roles = [
    { key: "admin", name: "Administrator" },
    { key: "editor", name: "Editor" },
    { key: "viewer", name: "Viewer" }
  ]

  for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name },
      create: role
    })
  }

  // ---------------------------------------------------------------------------
  // Users (idempotent)
  // ---------------------------------------------------------------------------
  const passwordHashes = {
    admin: await bcrypt.hash("admin123", 10),
    editor: await bcrypt.hash("editor123", 10),
    viewer: await bcrypt.hash("viewer123", 10)
  }

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@nomos.local" },
      update: { name: "Admin User", passwordHash: passwordHashes.admin },
      create: {
        email: "admin@nomos.local",
        name: "Admin User",
        passwordHash: passwordHashes.admin
      }
    }),
    prisma.user.upsert({
      where: { email: "editor@nomos.local" },
      update: { name: "Editor User", passwordHash: passwordHashes.editor },
      create: {
        email: "editor@nomos.local",
        name: "Editor User",
        passwordHash: passwordHashes.editor
      }
    }),
    prisma.user.upsert({
      where: { email: "viewer@nomos.local" },
      update: { name: "Viewer User", passwordHash: passwordHashes.viewer },
      create: {
        email: "viewer@nomos.local",
        name: "Viewer User",
        passwordHash: passwordHashes.viewer
      }
    })
  ])

  const [admin, editor, viewer] = users

  // ---------------------------------------------------------------------------
  // Role assignments (idempotent)
  // ---------------------------------------------------------------------------
  const roleRecords = await prisma.role.findMany()
  const roleByKey = new Map(roleRecords.map((role) => [role.key, role.id]))

  const roleAssignments = [
    { user: admin, role: "admin" },
    { user: editor, role: "editor" },
    { user: viewer, role: "viewer" }
  ]

  for (const assignment of roleAssignments) {
    const roleId = roleByKey.get(assignment.role)
    if (!roleId) continue

    await prisma.userRole.upsert({
      // assumes a compound unique constraint named `userId_roleId`
      where: { userId_roleId: { userId: assignment.user.id, roleId } },
      update: {},
      create: { userId: assignment.user.id, roleId }
    })
  }

  // ---------------------------------------------------------------------------
  // Projects (idempotent)
  // ---------------------------------------------------------------------------
  const projectAlpha = await prisma.project.upsert({
    where: { id: "project-alpha" },
    update: {
      name: "Project Alpha",
      description: "Migration kickoff and planning.",
      createdByUserId: admin.id
    },
    create: {
      id: "project-alpha",
      name: "Project Alpha",
      description: "Migration kickoff and planning.",
      createdByUserId: admin.id
    }
  })

  const projectBeta = await prisma.project.upsert({
    where: { id: "project-beta" },
    update: {
      name: "Project Beta",
      description: "Design system rollout for Nomos.",
      createdByUserId: editor.id
    },
    create: {
      id: "project-beta",
      name: "Project Beta",
      description: "Design system rollout for Nomos.",
      createdByUserId: editor.id
    }
  })

  // ---------------------------------------------------------------------------
  // Tasks (idempotent)
  // NOTE: Use strings for status to avoid enum import mismatches.
  // ---------------------------------------------------------------------------
  const taskA = await prisma.task.upsert({
    where: { id: "task-alpha-1" },
    update: {
      projectId: projectAlpha.id,
      title: "Define scope",
      description: "Draft the V1 scope and sign-off.",
      // if your schema uses an enum, ensure these strings match enum values
      status: "todo",
      assignedToUserId: admin.id
    },
    create: {
      id: "task-alpha-1",
      projectId: projectAlpha.id,
      title: "Define scope",
      description: "Draft the V1 scope and sign-off.",
      status: "todo",
      assignedToUserId: admin.id
    }
  })

  const taskB = await prisma.task.upsert({
    where: { id: "task-beta-1" },
    update: {
      projectId: projectBeta.id,
      title: "Build component inventory",
      description: "List the reusable UI components.",
      status: "doing",
      assignedToUserId: editor.id
    },
    create: {
      id: "task-beta-1",
      projectId: projectBeta.id,
      title: "Build component inventory",
      description: "List the reusable UI components.",
      status: "doing",
      assignedToUserId: editor.id
    }
  })

  // ---------------------------------------------------------------------------
  // Comments (idempotent via upsert)
  // ---------------------------------------------------------------------------
  const comments = [
    {
      id: "comment-1",
      taskId: taskA.id,
      body: "Scope draft ready for review.",
      authorUserId: admin.id
    },
    {
      id: "comment-2",
      taskId: taskB.id,
      body: "Inventory started; need feedback.",
      authorUserId: viewer.id
    }
  ]

  for (const c of comments) {
    await prisma.comment.upsert({
      where: { id: c.id },
      create: c,
      update: {
        body: c.body,
        taskId: c.taskId,
        authorUserId: c.authorUserId
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Attachments (idempotent via upsert)
  // ---------------------------------------------------------------------------
  const attachments = [
    {
      id: "attachment-1",
      taskId: taskA.id,
      key: "seed/alpha/outline.txt",
      filename: "outline.txt",
      contentType: "text/plain",
      sizeBytes: 128
    },
    {
      id: "attachment-2",
      taskId: taskB.id,
      key: "seed/beta/mock.png",
      filename: "mock.png",
      contentType: "image/png",
      sizeBytes: 2048
    }
  ]

  for (const a of attachments) {
    await prisma.attachment.upsert({
      where: { id: a.id },
      create: a,
      update: {
        taskId: a.taskId,
        key: a.key,
        filename: a.filename,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes
      }
    })
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    // If you prefer, you can omit disconnecting so the singleton can be reused,
    // but for a one-shot seed process this is fine.
    await prisma.$disconnect()
  })
