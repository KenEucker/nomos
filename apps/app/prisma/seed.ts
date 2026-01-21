import bcrypt from "bcryptjs"
import { getPrismaClient } from "../src/platform/db/prisma"

const prisma = getPrismaClient()

async function main() {
  // ---------------------------------------------------------------------------
  // Roles (schema-agnostic: works with both old and new schema)
  // ---------------------------------------------------------------------------
  const roles = [
    { key: "admin", name: "Administrator" },
    { key: "platform_admin", name: "Platform Admin" },
    { key: "editor", name: "Editor" },
    { key: "viewer", name: "Viewer" }
  ]

  for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name },
      create: { key: role.key, name: role.name }
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
    { user: admin, role: "platform_admin" },
    { user: editor, role: "editor" },
    { user: viewer, role: "viewer" }
  ]

  for (const assignment of roleAssignments) {
    const roleId = roleByKey.get(assignment.role)
    if (!roleId) continue

    // UserRole assignment
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: assignment.user.id, roleId } },
      update: {},
      create: { userId: assignment.user.id, roleId }
    })

    // SubjectRole for authz system (if table exists after migration)
    try {
      if ((prisma as any).subjectRole) {
        await (prisma as any).subjectRole.upsert({
          where: {
            subjectType_subjectId_roleId: {
              subjectType: "user",
              subjectId: assignment.user.id,
              roleId
            }
          },
          update: {},
          create: {
            subjectType: "user",
            subjectId: assignment.user.id,
            roleId
          }
        })
      }
    } catch {
      // SubjectRole table may not exist yet if migration hasn't run
    }
  }

  console.log("Seeded admin login: admin@nomos.local / admin123 (roles: admin, platform_admin)")
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
