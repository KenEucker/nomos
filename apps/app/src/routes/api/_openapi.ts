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
  },
  Project: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      description: { type: "string", nullable: true },
      createdByUserId: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" }
    },
    required: ["id", "name", "createdByUserId", "createdAt", "updatedAt"]
  },
  Task: {
    type: "object",
    properties: {
      id: { type: "string" },
      projectId: { type: "string" },
      title: { type: "string" },
      description: { type: "string", nullable: true },
      status: { type: "string", enum: ["todo", "doing", "done"] },
      assignedToUserId: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" }
    },
    required: ["id", "projectId", "title", "status", "createdAt", "updatedAt"]
  },
  Comment: {
    type: "object",
    properties: {
      id: { type: "string" },
      taskId: { type: "string" },
      body: { type: "string" },
      authorUserId: { type: "string" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" }
    },
    required: ["id", "taskId", "body", "authorUserId", "createdAt", "updatedAt"]
  },
  Attachment: {
    type: "object",
    properties: {
      id: { type: "string" },
      taskId: { type: "string" },
      key: { type: "string" },
      filename: { type: "string" },
      contentType: { type: "string" },
      sizeBytes: { type: "integer" },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" }
    },
    required: ["id", "taskId", "key", "filename", "contentType", "sizeBytes", "createdAt", "updatedAt"]
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
