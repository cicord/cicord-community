import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

// `vp dev --mode mock` (the `dev` script) runs without the Go runtime: src/mock answers the
// API in the browser. `vp dev` (`dev:runtime`) proxies /api and /auth to a running
// `cicord dev` (CICORD_RUNTIME_URL, default http://127.0.0.1:7420, the runtime's default URL),
// so the portal is same-origin with the runtime and uses its session cookie.
const runtime = process.env["CICORD_RUNTIME_URL"] ?? "http://127.0.0.1:7420";
const runtimeOrigin = new URL(runtime).origin;

// The runtime only answers loopback Host headers in dev and rejects unsafe requests whose
// Origin is not its own (CSRF protection). The dev server is a trusted same-machine proxy:
// keep Host as is (localhost:5174 is loopback) and present requests as same-origin.
const proxyTo = {
  target: runtime,
  changeOrigin: false,
  // `unknown`: the proxy types need @types/node, which a forked portal may not install.
  configure: (proxy: unknown) => {
    (proxy as ProxyLike).on("proxyReq", (req) => {
      if (req.getHeader("origin")) req.setHeader("origin", runtimeOrigin);
    });
  },
};

interface ProxyLike {
  on: (event: "proxyReq", fn: (req: ProxyRequest) => void) => void;
}

interface ProxyRequest {
  getHeader: (name: string) => unknown;
  setHeader: (name: string, value: string) => void;
}

export default defineConfig(({ mode }) => ({
  // Served by the runtime at "/" with an SPA fallback to index.html: absolute asset URLs
  // keep working on deep links such as /onboarding.
  base: "/",
  plugins: [react()],
  server: {
    port: 5174,
    ...(mode === "mock"
      ? {}
      : {
          proxy: {
            "/api": proxyTo,
            "/auth": proxyTo,
          },
        }),
  },
  build: {
    // cicord.yaml spec.portal.path points here (./portal/dist); the output is committed.
    outDir: "dist",
    assetsDir: "assets",
    // No source maps: the build is committed, and maps would add ~1 MB to git per build.
    sourcemap: false,
  },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "jsdom",
  },
}));
