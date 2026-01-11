export function buildSwaggerUiHtml(openApiUrl: string) {
  return `<!doctype html>
<html>
  <head>
    <title>Nomos Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({ url: "${openApiUrl}", dom_id: "#swagger-ui" });
    </script>
  </body>
</html>`;
}
