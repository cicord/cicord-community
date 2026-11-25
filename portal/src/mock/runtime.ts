/**
 * In-browser fake of the Cicord runtime for `vp dev --mode mock` and the tests: the portal
 * endpoints (servers, server, me, analytics), auth (signed link, dev login, logout) and the
 * routes of the tickets plugin, mirroring https://cicord.dev/docs/reference/http-api/portal/.
 * State lives in sessionStorage so it survives the reload that follows a login.
 *
 * In `pnpm dev`, the URL picks the scenario: `?role=member|moderator|admin`,
 * `?analytics=members|public|off` (off: the server does not share its activity) and
 * `?mode=light|dark|system`.
 */
import type { AccessRole, FetchLike } from "@cicord/client";
import { mockAnalytics } from "./analytics.ts";
import { portalServer, roles, viewers, type MockAnalytics } from "./data.ts";
import { seedTickets, ticketsRoute, type TicketStore } from "./tickets.ts";

export interface MockOptions {
  /** The viewer's access role. Default: `?role=`, else member. */
  role?: AccessRole;
  /** How the server shares its activity. Default: `?analytics=`, else members. */
  analytics?: MockAnalytics;
  /** Milliseconds per request. Default 280 (0 in tests). */
  latency?: number;
  /** Start signed in. Default: as saved in sessionStorage, else signed out. */
  signedIn?: boolean;
}

interface MockState {
  loggedIn: boolean;
  tickets: TicketStore;
}

const STORAGE = "cicord-portal:mock";
const API = "/api/v1";
const TICKETS = `${API}/portal/cicord/plugins/cicord/tickets`;

function load(): MockState {
  try {
    const raw = sessionStorage.getItem(STORAGE);
    if (raw) return JSON.parse(raw) as MockState;
  } catch {
    // ignore: fresh state
  }
  return { loggedIn: false, tickets: seedTickets() };
}

/** A URL parameter of the page, remembered for the session (it is lost on login redirects). */
function param<T extends string>(name: string, allowed: readonly T[]): T | undefined {
  const value = new URLSearchParams(window.location.search).get(name);
  const key = `cicord-portal:mock-${name}`;
  try {
    if (value) sessionStorage.setItem(key, value);
    const saved = value ?? sessionStorage.getItem(key);
    return allowed.find((a) => a === saved);
  } catch {
    return allowed.find((a) => a === value);
  }
}

const json = (body: unknown, status = 200): Response =>
  status === 204
    ? new Response(null, { status })
    : new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });

const error = (status: number, code: string, message: string): Response =>
  json({ error: { code, message } }, status);

export function createMockRuntime(options: MockOptions = {}) {
  let state = load();
  if (options.signedIn !== undefined) state = { ...state, loggedIn: options.signedIn };
  const save = (next: Partial<MockState>) => {
    state = { ...state, ...next };
    try {
      sessionStorage.setItem(STORAGE, JSON.stringify(state));
    } catch {
      // ignore
    }
  };
  const role = (): AccessRole =>
    options.role ?? param("role", ["member", "moderator", "admin"]) ?? "member";
  const sharing = (): MockAnalytics =>
    options.analytics ?? param("analytics", ["members", "public", "off"]) ?? "members";
  const mode = () => param("mode", ["light", "dark", "system"]) ?? "system";
  const viewer = () => viewers[role()];
  const server = () => portalServer(mode());

  const me = () => ({
    user: viewer().user,
    servers: [{ key: "cicord", name: "Cicord", role: role() }],
  });

  const portalMe = () => ({
    user: viewer().user,
    member: {
      nick: "",
      joinedAt: "2026-03-14T18:20:00Z",
      roles: viewer()
        .roles.map((key) => {
          const r = roles[key];
          return r ? { key, id: r.id, name: r.name, color: r.color } : undefined;
        })
        .filter((r) => r !== undefined),
    },
    role: role(),
  });

  const analytics = (query: URLSearchParams): Response => {
    const share = sharing();
    if (share === "off") return error(404, "not_found", "not found");
    if (share === "members" && !state.loggedIn)
      return error(401, "unauthenticated", "login required");
    const period = query.get("period") ?? "30d";
    if (period !== "7d" && period !== "30d" && period !== "90d")
      return error(400, "invalid", "period must be 7d, 30d or 90d");
    return json(mockAnalytics(period));
  };

  const route = (method: string, path: string, body: unknown, query: URLSearchParams): Response => {
    const auth = (fn: () => Response) =>
      state.loggedIn ? fn() : error(401, "unauthenticated", "login required");
    if (path.startsWith(`${TICKETS}/`)) {
      return auth(() => {
        const person = { id: viewer().user.id, displayName: viewer().user.displayName };
        const reply = ticketsRoute(
          state.tickets,
          { person, staff: role() !== "member" },
          method,
          path.slice(TICKETS.length),
          query,
          body,
        );
        if (method !== "GET") save({ tickets: state.tickets });
        return json(reply.body, reply.status);
      });
    }
    switch (`${method} ${path}`) {
      case "POST /auth/link":
      case "POST /auth/dev-login":
        save({ loggedIn: true });
        return json(me());
      case "POST /auth/logout":
        save({ loggedIn: false });
        return json(null, 204);
      case `GET ${API}/me`:
        return auth(() => json(me()));
      case `GET ${API}/portal/servers`:
        return json({ items: [server()] });
      case `GET ${API}/portal/cicord`:
        return json(server());
      case `GET ${API}/portal/cicord/me`:
        return auth(() => json(portalMe()));
      case `GET ${API}/portal/cicord/analytics`:
        return analytics(query);
      default:
        return error(404, "not_found", `mock: no route ${method} ${path}`);
    }
  };

  const latency = options.latency ?? 280;
  const fetch: FetchLike = async (input, init) => {
    const url = new URL(input, window.location.origin);
    const method = (init.method ?? "GET").toUpperCase();
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
    if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));
    return route(method, url.pathname, body, url.searchParams);
  };

  return {
    fetch,
    /** What `ctx.portal.link(path, {member})` would produce: the page with a signed token. */
    signedLink(redirect: string): string {
      const url = new URL(redirect || "/", window.location.origin);
      url.searchParams.set("cicord_token", "mock-signed-token");
      return `${url.pathname}${url.search}${url.hash}`;
    },
  };
}
