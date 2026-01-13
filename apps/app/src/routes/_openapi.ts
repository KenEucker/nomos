export const modelSchemas = {
  User: {
    type: "object",
    properties: {
      id: { type: "string" },
      email: { type: "string", format: "email" },
      name: { type: "string" },
      roles: { type: "array", items: { type: "string" } },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" }
    },
    required: ["id", "email", "name", "roles", "createdAt", "updatedAt"]
  },
  Role: {
    type: "object",
    properties: {
      id: { type: "string" },
      key: { type: "string" },
      name: { type: "string" }
    },
    required: ["id", "key", "name"]
  }
};

export function okResponse(schema: Record<string, any>, meta?: boolean) {
  const response: Record<string, any> = {
    type: "object",
    properties: {
      ok: { type: "boolean", const: true },
      data: schema
    },
    required: ["ok", "data"]
  };
  if (meta) {
    response.properties.meta = { $ref: "#/components/schemas/PaginationMeta" };
    response.required.push("meta");
  }
  return response;
}
