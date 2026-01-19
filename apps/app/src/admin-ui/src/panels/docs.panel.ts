import { Layouts } from "../lib/layouts"
import type { PanelModule } from "../lib/types"

const panel: PanelModule = {
  id: "docs",
  title: "API Documentation",
  subtitle: "Browse the OpenAPI reference for Nomos.",
  query: async (ctx) => {
    try {
      const response = await fetch(new URL("/docs", ctx.url), {
        method: "HEAD",
        credentials: "include",
      })
      const docsAccessible = response.ok
      const error =
        !docsAccessible && response.status === 403
          ? "API documentation is not accessible. It may be restricted in production."
          : null
      return { docsAccessible, error }
    } catch {
      return { docsAccessible: false, error: "Failed to check documentation access." }
    }
  },
  layout: (data) => {
    const docsAccessible = Boolean(data.docsAccessible)
    const error = data.error as string | null | undefined

    const nodes = [
      Layouts.header({
        title: "API Documentation",
        subtitle: "Browse the OpenAPI reference for Nomos.",
        requiredIntent: "admin.access",
      }),
    ]

    if (error) {
      nodes.push(
        Layouts.card({
          title: "Documentation access",
          description: error,
          nodes: [
            Layouts.text({
              value:
                "In production, set SWAGGER_PUBLIC=true to enable public access or use an admin session.",
            }),
          ],
        })
      )
    }

    if (docsAccessible) {
      nodes.push(
        Layouts.card({
          title: "Embedded Documentation",
          description: "Swagger UI embedded for quick reference.",
          nodes: [
            Layouts.iframe({
              src: "/docs",
              title: "API Documentation",
              height: "600px",
            }),
          ],
        })
      )
    }

    return [Layouts.rows(nodes)]
  },
  commandBar: () => [
    {
      type: "link",
      label: "Open Swagger UI",
      href: "/docs",
      intent: "admin.access",
    },
    {
      type: "link",
      label: "View OpenAPI JSON",
      href: "/openapi.json",
      intent: "admin.access",
    },
  ],
}

export default panel
