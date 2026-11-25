import { createCicordClient, type AuthMode, type CicordClient } from "@cicord/client";

export interface PortalConfig {
  client: CicordClient;
  /** Starts a login that comes back to `redirect`. */
  login: (redirect: string) => void;
  mock: boolean;
}

const SERVER_KEY = "cicord-portal:server";

/**
 * Auth mode: `VITE_CICORD_AUTH` ("cookie" | "token"); by default "token" when the runtime is
 * on another origin (`VITE_CICORD_API_URL`, the portal is embedded in a third-party site),
 * else "cookie".
 */
export function authModeFor(apiUrl: string | undefined, explicit: string | undefined): AuthMode {
  if (explicit === "token" || explicit === "cookie") return explicit;
  if (!apiUrl) return "cookie";
  try {
    return new URL(apiUrl, window.location.href).origin === window.location.origin
      ? "cookie"
      : "token";
  } catch {
    return "cookie";
  }
}

/**
 * Builds the API client. In mock mode (`vp dev --mode mock`) the client talks to an in-browser
 * fake runtime (src/mock); that module is only imported in that mode, so production builds
 * never contain it.
 */
export async function createPortalConfig(): Promise<PortalConfig> {
  if (import.meta.env.MODE === "mock") {
    const { createMockRuntime } = await import("./mock/runtime.ts");
    const runtime = createMockRuntime();
    return {
      client: createCicordClient({ fetch: runtime.fetch }),
      // No Discord in mock mode: simulate the signed link a bot would send.
      login: (redirect) => window.location.assign(runtime.signedLink(redirect)),
      mock: true,
    };
  }
  const baseUrl = import.meta.env.VITE_CICORD_API_URL ?? "";
  const client = createCicordClient({
    baseUrl,
    auth: authModeFor(baseUrl, import.meta.env.VITE_CICORD_AUTH),
  });
  return {
    client,
    login: (redirect) => client.auth.login(redirect),
    mock: false,
  };
}

/** Server key from `?server=` (remembered), else the last one used, else the env default. */
export function requestedServer(): string | undefined {
  const fromUrl = new URL(window.location.href).searchParams.get("server");
  try {
    if (fromUrl) localStorage.setItem(SERVER_KEY, fromUrl);
    return (
      fromUrl ?? localStorage.getItem(SERVER_KEY) ?? import.meta.env.VITE_CICORD_SERVER ?? undefined
    );
  } catch {
    return fromUrl ?? import.meta.env.VITE_CICORD_SERVER ?? undefined;
  }
}

/** Switches to another server (server picker). */
export function rememberServer(key: string): void {
  try {
    localStorage.setItem(SERVER_KEY, key);
  } catch {
    // storage unavailable: the URL carries it
  }
  const url = new URL(window.location.href);
  url.searchParams.set("server", key);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new Event("cicord:server"));
}

export function forgetServer(): void {
  try {
    localStorage.removeItem(SERVER_KEY);
  } catch {
    // storage unavailable: nothing to forget
  }
}
