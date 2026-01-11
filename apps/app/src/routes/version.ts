export const config = {
  auth: "none",
  tags: ["system"],
  summary: "Version info"
};

export const get = async () => {
  return {
    name: "nomos-platform",
    version: "0.1.0",
    build: process.env.BUILD_SHA ?? "dev"
  };
};
