import type { ListPageModule } from "../../../../admin-ui/src/lib/pages/types";
import { apiGet } from "../../../../admin-ui/src/lib/api";
import { sdkResource } from "./sdk.resource";

interface SdkStatusRow {
  id: string;
  apiRevision: string;
  apiVersion: string;
  platformVersion: string;
  generatedAt: string;
  artifacts: {
    js: string;
    ts: string;
    dts: string;
  };
}

interface VersionInfo {
  apiRevision?: string;
  apiVersion?: string;
  platformVersion?: string;
  build?: string;
}

const normalizeOkPayload = (payload: unknown) => {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data?: unknown }).data;
  }
  return payload;
};

const sdkModule: ListPageModule<SdkStatusRow> = {
  resourceId: "sdk",
  view: "List",
  title: "SDK",
  subtitle: "Validate the generated SDK and manage artifacts.",

  query: {
    list: async () => {
      let sdkStatus = "Failed";
      let healthStatus = "unknown";
      let versionInfo: VersionInfo = {};
      let errorDetail: string | undefined;

      try {
        const versionResponse = await fetch("/version", { credentials: "include" });
        if (!versionResponse.ok) {
          throw new Error(`Version request failed (${versionResponse.status})`);
        }
        const versionPayload = normalizeOkPayload(await versionResponse.json()) as VersionInfo;
        const apiRevision = versionPayload?.apiRevision;
        if (!apiRevision) {
          throw new Error("Missing apiRevision from /version response");
        }

        const sdk = await import(`/sdk/client.js?rev=${apiRevision}`);
        const client = sdk.createNomosClient({
          baseUrl: window.location.origin,
          credentials: "include",
        });

        const [healthPayload, versionPayload] = await Promise.all([
          client.GET("/health"),
          client.GET("/version"),
        ]);

        const healthData = normalizeOkPayload(healthPayload) as { status?: string } | undefined;
        const versionData = normalizeOkPayload(versionPayload) as VersionInfo | undefined;

        healthStatus = healthData?.status ?? "unknown";
        versionInfo = versionData ?? {};

        sdkStatus = healthStatus === "ok" && Boolean(versionInfo.apiRevision)
          ? "Functional"
          : "Degraded";
      } catch (error) {
        errorDetail = error instanceof Error ? error.message : "SDK validation failed";
      }

      const statusResponse = await apiGet<{ sdk: SdkStatusRow[] }>("/sdk/status");
      const sdkRows = statusResponse.data?.sdk ?? [];
      const total = statusResponse.meta?.total ?? sdkRows.length;
      const page = statusResponse.meta?.page ?? 1;
      const pageSize = statusResponse.meta?.pageSize ?? sdkRows.length || 1;

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
      ];

      const items = sdkRows.length > 0
        ? sdkRows.map((row) => ({ ...row, cards }))
        : [{ cards } as SdkStatusRow & { cards: typeof cards }];

      return {
        items,
        total,
        page,
        pageSize,
      };
    },
  },

  list: {
    columns: sdkResource.list?.columns ?? [],
    pageSize: sdkResource.list?.pageSize ?? 1,
    summaryCards: {
      dataKey: "cards",
      labelKey: "label",
      valueKey: "value",
      descriptionKey: "description",
    },
  },
};

export default sdkModule;
