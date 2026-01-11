import path from "node:path";

export function filePathToRoute(filePath: string, baseDir: string): string {
  const relative = path.relative(baseDir, filePath);
  const parts = relative.split(path.sep).map((part) => part.replace(/\.ts$/, ""));
  const filtered = parts
    .filter((part) => part !== "index")
    .map((part) => {
      if (part.startsWith("[") && part.endsWith("]")) {
        return `:${part.slice(1, -1)}`;
      }
      if (part.startsWith("(") && part.endsWith(")")) {
        return "";
      }
      return part;
    })
    .filter(Boolean);
  return "/" + filtered.join("/");
}
