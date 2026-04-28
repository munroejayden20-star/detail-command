import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
// Stamp the build with a timestamp so the running app can detect when a new
// deploy is live by comparing against the deployed /version.json.
var BUILD_ID = new Date().toISOString();
/** Emit a /version.json on every build so the running app can poll it. */
function emitVersionJson() {
    return {
        name: "emit-version-json",
        apply: "build",
        generateBundle: function () {
            this.emitFile({
                type: "asset",
                fileName: "version.json",
                source: JSON.stringify({ buildId: BUILD_ID }),
            });
        },
    };
}
export default defineConfig({
    plugins: [react(), emitVersionJson()],
    define: {
        __BUILD_ID__: JSON.stringify(BUILD_ID),
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
        open: true,
    },
});
