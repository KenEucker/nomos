import { PrismaClient, TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const roles = [
    { key: "admin", name: "Administrator" },
    { key: "editor", name: "Editor" },
    { key: "viewer", name: "Viewer" }
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name },
      create: role
    });
  }

  const passwordHashes = {
    admin: await bcrypt.hash("admin123", 10),
    editor: await bcrypt.hash("editor123", 10),
    viewer: await bcrypt.hash("viewer123", 10)
  };

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@nomos.local" },
      update: { name: "Admin User", passwordHash: passwordHashes.admin },
      create: { email: "admin@nomos.local", name: "Admin User", passwordHash: passwordHashes.admin }
    }),
    prisma.user.upsert({
      where: { email: "editor@nomos.local" },
      update: { name: "Editor User", passwordHash: passwordHashes.editor },
      create: { email: "editor@nomos.local", name: "Editor User", passwordHash: passwordHashes.editor }
    }),
    prisma.user.upsert({
      where: { email: "viewer@nomos.local" },
      update: { name: "Viewer User", passwordHash: passwordHashes.viewer },
      create: { email: "viewer@nomos.local", name: "Viewer User", passwordHash: passwordHashes.viewer }
    })
  ]);

  const roleRecords = await prisma.role.findMany();
  const roleByKey = new Map(roleRecords.map((role) => [role.key, role.id]));

  const roleAssignments = [
    { user: users[0], role: "admin" },
    { user: users[1], role: "editor" },
    { user: users[2], role: "viewer" }
  ];

  for (const assignment of roleAssignments) {
    const roleId = roleByKey.get(assignment.role);
    if (!roleId) continue;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: assignment.user.id, roleId } },
      update: {},
      create: { userId: assignment.user.id, roleId }
    });
  }

  const [admin, editor, viewer] = users;

  const projectAlpha = await prisma.project.upsert({
    where: { id: "project-alpha" },
    update: {},
    create: {
      id: "project-alpha",
      name: "Project Alpha",
      description: "Migration kickoff and planning.",
      createdByUserId: admin.id
    }
  });

  const projectBeta = await prisma.project.upsert({
    where: { id: "project-beta" },
    update: {},
    create: {
      id: "project-beta",
      name: "Project Beta",
      description: "Design system rollout for Nomos.",
      createdByUserId: editor.id
    }
  });

  const taskA = await prisma.task.upsert({
    where: { id: "task-alpha-1" },
    update: {},
    create: {
      id: "task-alpha-1",
      projectId: projectAlpha.id,
      title: "Define scope",
      description: "Draft the V1 scope and sign-off.",
      status: TaskStatus.todo,
      assignedToUserId: admin.id
    }
  });

  const taskB = await prisma.task.upsert({
    where: { id: "task-beta-1" },
    update: {},
    create: {
      id: "task-beta-1",
      projectId: projectBeta.id,
      title: "Build component inventory",
      description: "List the reusable UI components.",
      status: TaskStatus.doing,
      assignedToUserId: editor.id
    }
  });

  await prisma.comment.createMany({
    data: [
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
    ],
    skipDuplicates: true
  });

  await prisma.attachment.createMany({
    data: [
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
    ],
    skipDuplicates: true
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
