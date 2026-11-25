/**
 * In-browser fake of the Cicord runtime for `vp dev --mode mock`: portal endpoints, auth
 * (link token, dev login, logout), the onboarding plugin routes and the showcase plugins
 * (levels, tickets), mirroring https://cicord.dev/docs/reference/http-api/, examples/basic/plugins/onboarding and
 * examples/showcase. State lives in sessionStorage so it
 * survives the reload that follows a login.
 */
import type { FetchLike } from "@cicord/client";
import { leaderboard, onboardingConfig, portalServer, roles, tickets, user } from "./data.ts";

interface MockState {
  loggedIn: boolean;
  memberRoles: string[];
  completedAt: string | null;
}

const STORAGE = "cicord-portal:mock";
const LATENCY = 320;
const API = "/api/v1";

function load(): MockState {
  try {
    const raw = sessionStorage.getItem(STORAGE);
    if (raw) return JSON.parse(raw) as MockState;
  } catch {
    // ignore: fresh state
  }
  return { loggedIn: false, memberRoles: ["member"], completedAt: null };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const error = (status: number, code: string, message: string, diagnostics?: unknown[]): Response =>
  json({ error: diagnostics ? { code, message, diagnostics } : { code, message } }, status);

const roleOut = (key: string) => {
  const r = roles[key];
  return r ? { key, id: r.id, name: r.name, color: r.color } : undefined;
};

/** `?role=moderator|admin` previews the moderator pages in mock mode. */
function viewerRole(): "member" | "moderator" | "admin" {
  const role = new URLSearchParams(window.location.search).get("role");
  try {
    if (role) sessionStorage.setItem("cicord-portal:mock-role", role);
    const saved = role ?? sessionStorage.getItem("cicord-portal:mock-role");
    return saved === "moderator" || saved === "admin" ? saved : "member";
  } catch {
    return role === "moderator" || role === "admin" ? role : "member";
  }
}

export function createMockRuntime() {
  let state = load();
  const save = (next: Partial<MockState>) => {
    state = { ...state, ...next };
    try {
      sessionStorage.setItem(STORAGE, JSON.stringify(state));
    } catch {
      // ignore
    }
  };

  const me = () => ({
    user,
    servers: [{ key: portalServer.key, name: portalServer.name, role: "member" }],
  });

  const portalMe = () => ({
    user,
    member: {
      nick: "",
      joinedAt: "2025-03-14T18:20:00Z",
      roles: state.memberRoles
        .map((k) => roleOut(k))
        .filter((r) => r !== undefined)
        .map(({ key, id, name, color }) => ({ key, id, name, color })),
    },
    role: viewerRole(),
  });

  const steps = () => ({
    title: onboardingConfig.title,
    intro: onboardingConfig.intro,
    completed: state.completedAt !== null,
    completedAt: state.completedAt,
    completedRole: onboardingConfig.completedRole
      ? (roleOut(onboardingConfig.completedRole) ?? null)
      : null,
    steps: onboardingConfig.steps.map((step) => {
      const options = step.options.map((o) => {
        const r = roles[o.role]!;
        return {
          role: o.role,
          label: o.label ?? r.name,
          emoji: o.emoji ?? "",
          description: o.description ?? "",
          name: r.name,
          color: r.color,
        };
      });
      return {
        id: step.id,
        title: step.title,
        description: step.description ?? "",
        multiple: step.multiple ?? false,
        required: step.required ?? false,
        options,
        selected: options.filter((o) => state.memberRoles.includes(o.role)).map((o) => o.role),
      };
    }),
  });

  const complete = (body: unknown): Response => {
    const answers = (body as { answers?: unknown } | undefined)?.answers;
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return error(400, "invalid", 'expected a JSON body {"answers": {…}}');
    }
    const raw = answers as Record<string, unknown>;
    const problems: { severity: "error"; path: string; message: string }[] = [];
    const wanted = new Set<string>();
    for (const id of Object.keys(raw)) {
      if (!onboardingConfig.steps.some((s) => s.id === id)) {
        problems.push({
          severity: "error",
          path: `/answers/${id}`,
          message: `unknown step "${id}"`,
        });
      }
    }
    for (const step of onboardingConfig.steps) {
      const picked = Array.isArray(raw[step.id]) ? [...new Set(raw[step.id] as string[])] : [];
      const path = `/answers/${step.id}`;
      for (const role of picked) {
        if (!step.options.some((o) => o.role === role)) {
          problems.push({ severity: "error", path, message: `"${role}" n'est pas une option` });
        }
      }
      if (!step.multiple && picked.length > 1)
        problems.push({ severity: "error", path, message: "Un seul choix possible" });
      if (step.required && picked.length === 0)
        problems.push({ severity: "error", path, message: "Cette question est obligatoire" });
      for (const role of picked) wanted.add(role);
    }
    if (problems.length > 0)
      return error(422, "invalid", problems.map((p) => p.message).join("; "), problems);

    const offered = new Set(onboardingConfig.steps.flatMap((s) => s.options.map((o) => o.role)));
    if (onboardingConfig.completedRole) {
      offered.add(onboardingConfig.completedRole);
      wanted.add(onboardingConfig.completedRole);
    }
    const current = new Set(state.memberRoles);
    const added = [...offered].filter((r) => wanted.has(r) && !current.has(r));
    const removed = [...offered].filter((r) => !wanted.has(r) && current.has(r));
    const next = [...state.memberRoles.filter((r) => !removed.includes(r)), ...added];
    const completedAt = new Date().toISOString();
    save({ memberRoles: next, completedAt });
    return json({
      completed: true,
      completedAt,
      roles: next.map((k) => roleOut(k)).filter((r) => r !== undefined),
      added,
      removed,
      message: onboardingConfig.successMessage,
    });
  };

  const route = (method: string, path: string, body: unknown, query: URLSearchParams): Response => {
    const auth = (fn: () => Response) =>
      state.loggedIn ? fn() : error(401, "unauthenticated", "login required");
    const key = portalServer.key;
    switch (`${method} ${path}`) {
      case "POST /auth/link":
      case "POST /auth/dev-login":
        save({ loggedIn: true });
        return json(me());
      case "POST /auth/logout":
        save({ loggedIn: false });
        return new Response(null, { status: 204 });
      case `GET ${API}/me`:
        return auth(() => json(me()));
      case `GET ${API}/portal/servers`:
        return json({ items: [portalServer] });
      case `GET ${API}/portal/${key}`:
        return json(portalServer);
      case `GET ${API}/portal/${key}/me`:
        return auth(() => json(portalMe()));
      case `GET ${API}/portal/${key}/plugins/moderator/onboarding/steps`:
        return auth(() => json(steps()));
      case `POST ${API}/portal/${key}/plugins/moderator/onboarding/complete`:
        return auth(() => complete(body));
      case `GET ${API}/portal/${key}/plugins/moderator/levels/leaderboard`:
        return json({ items: leaderboard });
      case `GET ${API}/portal/${key}/plugins/moderator/levels/me`:
        // The shape of the levels contract (`Standing`, examples/showcase/plugins/levels/src/routes.ts).
        return auth(() => {
          const top = leaderboard[0]!;
          return json({
            userId: top.userId,
            rank: top.rank,
            xp: top.xp,
            level: top.level,
            current: 1260,
            needed: 2080,
          });
        });
      case `GET ${API}/portal/${key}/plugins/moderator/tickets/tickets`:
        // A moderator route: `?role=moderator` makes the mock viewer a moderator.
        return auth(() =>
          viewerRole() === "member"
            ? error(403, "forbidden", "this route requires the moderator role")
            : json({
                items: tickets.filter(
                  (t) => !query.get("status") || t.status === query.get("status"),
                ),
              }),
        );
      default:
        return error(404, "not_found", `mock: no route ${method} ${path}`);
    }
  };

  const fetch: FetchLike = async (input, init) => {
    const url = new URL(input, window.location.origin);
    const method = (init.method ?? "GET").toUpperCase();
    const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
    await new Promise((resolve) => setTimeout(resolve, LATENCY));
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
    reset(): void {
      sessionStorage.removeItem(STORAGE);
      state = load();
    },
  };
}
