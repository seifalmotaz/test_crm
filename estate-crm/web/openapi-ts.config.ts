import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "../swagger.json",
  output: "./src/api",
  plugins: ["@hey-api/sdk"],
});