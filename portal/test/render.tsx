/** Renders the whole portal against the in-browser mock runtime (src/mock), with no latency. */
import { createCicordClient, type FetchLike } from "@cicord/client";
import { render } from "@testing-library/react";
import { App } from "../src/App.tsx";
import { createMockRuntime, type MockOptions } from "../src/mock/runtime.ts";

export interface RenderOptions extends MockOptions {
  /** Wraps the mock's fetch (to fake a failure or another plugin version). */
  wrap?: (fetch: FetchLike) => FetchLike;
}

export function renderPortal(path: string, options: RenderOptions = {}) {
  window.history.replaceState(null, "", path);
  const { wrap, ...mock } = options;
  const runtime = createMockRuntime({ latency: 0, signedIn: true, ...mock });
  const fetch = wrap ? wrap(runtime.fetch) : runtime.fetch;
  const calls: { method: string; path: string; body: unknown }[] = [];
  const spy: FetchLike = (input, init) => {
    const url = new URL(input, window.location.origin);
    calls.push({
      method: (init.method ?? "GET").toUpperCase(),
      path: `${url.pathname}${url.search}`,
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    });
    return fetch(input, init);
  };
  const result = render(
    <App
      config={{
        client: createCicordClient({ fetch: spy }),
        login: (redirect) => window.history.replaceState(null, "", runtime.signedLink(redirect)),
        mock: true,
      }}
    />,
  );
  return { ...result, calls };
}

/** A JSON error response, as the runtime and the plugins send them. */
export function apiError(status: number, code: string): Response {
  return new Response(JSON.stringify({ error: { code, message: code } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
