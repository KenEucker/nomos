import { Layouts } from "../lib/layouts"
import { apiGet } from "../lib/api"
import { panelApiFetch } from "../lib/panel-api"
import type { PanelModule } from "../lib/types"
import { sdkResource } from "../pages/sdk/sdk.resource"

type SdkStatusRow = {
  id: string
  apiRevision: string
  apiVersion: string
  platformVersion: string
  generatedAt: string
  artifacts: {
    js: string
    ts: string
    dts: string
  }
}

type VersionInfo = {
  apiRevision?: string
  apiVersion?: string
  platformVersion?: string
  build?: string
}

const normalizeOkPayload = (payload: unknown) => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data?: unknown }).data
  }
  return payload
}

const panel: PanelModule = {
  id: "sdk",
  title: "SDK",
  subtitle: "Validate the generated SDK and manage artifacts.",
  query: async (ctx) => {
    let sdkStatus = "Unavailable"
    let healthStatus = "unknown"
    let versionInfo: VersionInfo = {}
    let errorDetail: string | undefined

    if (typeof window !== "undefined") {
      try {
        const versionResponse = await apiGet<VersionInfo>("/version")
        const version = normalizeOkPayload(versionResponse) as VersionInfo
        const apiRevision = version?.apiRevision
        if (!apiRevision) {
          throw new Error("Missing apiRevision from /version response")
        }

        const sdk = await import(`/sdk/client.js?rev=${apiRevision}`)
        const client = sdk.createNomosClient({
          baseUrl: window.location.origin,
          credentials: "include",
        })

        const [healthPayload, versionPayload] = await Promise.all([
          client.GET("/health"),
          client.GET("/version"),
        ])

        const healthData = normalizeOkPayload(healthPayload) as { status?: string } | undefined
        const versionData = normalizeOkPayload(versionPayload) as VersionInfo | undefined

        healthStatus = healthData?.status ?? "unknown"
        versionInfo = versionData ?? {}

        sdkStatus = healthStatus === "ok" && Boolean(versionInfo.apiRevision) ? "Functional" : "Degraded"
      } catch (error) {
        errorDetail = error instanceof Error ? error.message : "SDK validation failed"
      }
    }

    const statusResponse = await panelApiFetch(ctx, "/sdk/status")
    const sdkRows = ((statusResponse?.data ?? statusResponse) as { sdk?: SdkStatusRow[] }).sdk ?? []

    const cards = [
      {
        label: "SDK Status",
        value: sdkStatus,
        description: errorDetail ?? "Generated client connectivity",
      },
      {
        label: "Health",
        value: healthStatus,
        description: "SDK call to /health",
      },
      {
        label: "API Revision",
        value: versionInfo.apiRevision ?? "unknown",
        description: "SDK call to /version",
      },
      {
        label: "API Version",
        value: versionInfo.apiVersion ?? "unknown",
        description: "Platform API version",
      },
    ]

    return {
      cards,
      sdk: sdkRows.length > 0 ? sdkRows : ([] as SdkStatusRow[]),
    }
  },
  layout: (data) => {
    const cards = Array.isArray(data.cards) ? data.cards : []
    const cardColumns = cards.map((_, index) => ({
      span: 3,
      nodes: [
        Layouts.card({
          title: data.cards?.[index]?.label,
          description: data.cards?.[index]?.description,
          nodes: [
            Layouts.text({
              valueKey: `cards.${index}.value`,
            }),
          ],
        }),
      ],
    }))

    return [
      Layouts.rows([
        Layouts.header({
          title: "SDK",
          subtitle: "Validate the generated SDK and manage artifacts.",
          requiredIntent: "admin.access",
        }),
        Layouts.columns(cardColumns),
        Layouts.table({
          key: sdkResource.name,
          title: "SDK Artifacts",
          description: "Latest SDK build output.",
          rowsKey: "sdk",
          columns: sdkResource.list?.columns ?? [],
          searchable: false,
          requiredIntent: "admin.access",
        }),
      ]),
    ]
  },
  commandBar: () => [
    {
      type: "method",
      label: "Invalidate Cache",
      endpoint: "/sdk/invalidate",
      method: "POST",
      intent: "admin.access",
      confirm: {
        title: "Invalidate SDK cache?",
        body: "Clients will need to refetch the SDK.",
      },
      toast: { success: "SDK cache invalidated" },
    },
    {
      type: "method",
      label: "Regenerate SDK",
      endpoint: "/sdk/regenerate",
      method: "POST",
      intent: "admin.access",
      confirm: {
        title: "Regenerate SDK artifacts?",
      },
      toast: { success: "SDK regeneration started" },
    },
  ],
}

export default panel
