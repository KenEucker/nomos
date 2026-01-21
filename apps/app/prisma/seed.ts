import bcrypt from "bcryptjs"
import { getPrismaClient } from "../src/platform/db/prisma"

const prisma = getPrismaClient()

async function main() {
  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------
  const roles = [
    { key: "admin", name: "Administrator", description: "Full administrative access" },
    { key: "platform_admin", name: "Platform Admin", description: "Platform administration access" },
    { key: "editor", name: "Editor", description: "Content editing access" },
    { key: "viewer", name: "Viewer", description: "Read-only access" }
  ]

  for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description },
      create: { key: role.key, name: role.name, description: role.description }
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

    // UserRole assignment (legacy)
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: assignment.user.id, roleId } },
      update: {},
      create: { userId: assignment.user.id, roleId }
    })

    // SubjectRole assignment (new authz system)
    await prisma.subjectRole.upsert({
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

  console.log("Seeded admin login: admin@nomos.local / admin123 (roles: admin, platform_admin)")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
