import type { AccessRole, PortalPlugin, PortalServer, User } from "@cicord/client";
import {
  useCicord,
  useCicordQuery,
  useLinkTokenLogin,
  useMe,
  useMember,
  usePortalServers,
} from "@cicord/react";
import { Avatar, Button, Spinner, ThemeProvider } from "@cicord/ui";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { forgetServer, requestedServer, rememberServer, type PortalConfig } from "./config.ts";
import { I18nProvider, pickLocale, useT } from "./i18n/index.tsx";
import { Link, navigate, usePathname } from "./router.tsx";

// ───────────────────────────────────────────────────────────── contexts

const ConfigContext = createContext<PortalConfig | null>(null);
const ServerContext = createContext<PortalServer | null>(null);

export const ConfigProvider = ConfigContext.Provider;

function usePortalConfig(): PortalConfig {
  const value = useContext(ConfigContext);
  if (!value) throw new Error("missing <ConfigProvider>");
  return value;
}

export function useServer(): PortalServer {
  const value = useContext(ServerContext);
  if (!value) throw new Error("missing server");
  return value;
}

/** Starts a login that comes back to the current page. */
export function useLogin(): () => void {
  const config = usePortalConfig();
  return () => config.login(`${window.location.pathname}${window.location.search}`);
}

// ───────────────────────────────────────────────────────────── plugins & pages

/**
 * The instance of a plugin exposed on this server's portal, found by plugin name in
 * `PortalServer.plugins` (never hard-code bot / instance keys: they are the repository's).
 */
export function usePlugin(plugin: string, route?: string): PortalPlugin | undefined {
  return useServer().plugins.find(
    (p) => p.plugin === plugin && (route === undefined || p.routes.includes(route)),
  );
}

const rank: Record<string, number> = { member: 1, moderator: 2, admin: 3 };

/** The viewer's role on the server (undefined when logged out or not a member). */
function useViewerRole(): AccessRole | undefined {
  return useMember().data?.role;
}

function atLeast(role: AccessRole | undefined, min: AccessRole): boolean {
  return (rank[role ?? ""] ?? 0) >= (rank[min] ?? 0);
}

export interface Pages {
  onboarding: boolean;
  profile: boolean;
  leaderboard: boolean;
  tickets: boolean;
  /** Shown in the navigation (tickets: moderators only). */
  ticketsInNav: boolean;
}

/** Pages enabled by `spec.portal.pages` and backed by a plugin when they need one. */
export function usePages(): Pages {
  const server = useServer();
  const role = useViewerRole();
  const onboarding = usePlugin("onboarding");
  const levels = usePlugin("levels", "GET /leaderboard");
  const tickets = usePlugin("tickets", "GET /tickets");
  return {
    onboarding: server.pages.onboarding && !!onboarding,
    profile: server.pages.profile,
    leaderboard: server.pages.leaderboard && !!levels,
    tickets: server.pages.tickets && !!tickets,
    ticketsInNav: server.pages.tickets && !!tickets && atLeast(role, "moderator"),
  };
}

// ───────────────────────────────────────────────────────────── server selection

/**
 * Picks the server (`?server=`, remembered choice, VITE_CICORD_SERVER or the first portal
 * server), then sets its language and themes the whole page with its colors.
 */
export function ServerGate({
  onServer,
  children,
}: {
  onServer: (key: string) => void;
  children: ReactNode;
}) {
  const servers = usePortalServers();
  const [wanted, setWanted] = useState(requestedServer);
  const list = useMemo(() => servers.data ?? [], [servers.data]);
  const server = list.find((s) => s.key === wanted) ?? list[0];

  useEffect(() => {
    const onChange = () => setWanted(requestedServer());
    window.addEventListener("cicord:server", onChange);
    return () => window.removeEventListener("cicord:server", onChange);
  }, []);
  useEffect(() => {
    if (wanted && list.length > 0 && !list.some((s) => s.key === wanted)) forgetServer();
  }, [wanted, list]);
  useEffect(() => {
    if (server) onServer(server.key);
  }, [server, onServer]);

  const locale = pickLocale(server?.locale);
  return (
    <I18nProvider locale={locale}>
      {servers.status === "error" ? (
        <ThemeProvider global>
          <GateMessage kind="down" retry={() => void servers.refetch()} />
        </ThemeProvider>
      ) : !servers.data ? (
        <ThemeProvider global>
          <GateMessage kind="loading" />
        </ThemeProvider>
      ) : !server ? (
        <ThemeProvider global>
          <GateMessage kind="none" />
        </ThemeProvider>
      ) : (
        <ServerContext.Provider value={server}>
          <ThemeProvider theme={server.theme} global>
            <DocumentTitle />
            {children}
          </ThemeProvider>
        </ServerContext.Provider>
      )}
    </I18nProvider>
  );
}

function DocumentTitle() {
  const server = useServer();
  const t = useT();
  useEffect(() => {
    document.title = server.title !== server.name ? server.title : t.portalOf(server.name);
  }, [server, t]);
  return null;
}

function GateMessage({ kind, retry }: { kind: "down" | "loading" | "none"; retry?: () => void }) {
  const t = useT();
  if (kind === "loading")
    return (
      <div className="portal-loading">
        <Spinner size="lg" label={t.loading} />
      </div>
    );
  if (kind === "down")
    return (
      <CenteredMessage title={t.apiDown}>
        <Button variant="secondary" onClick={retry}>
          {t.onboarding.retry}
        </Button>
      </CenteredMessage>
    );
  return (
    <CenteredMessage title={t.noServer.title}>
      <p>{t.noServer.text}</p>
    </CenteredMessage>
  );
}

// ───────────────────────────────────────────────────────────── chrome

export function ServerMark({ size = 40, className }: { size?: number; className?: string }) {
  const server = useServer();
  const src = server.theme.logo || server.iconUrl;
  const initials = server.name
    .split(/\s+/)
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={["server-mark", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" width={size} height={size} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  const path = usePathname().replace(/\/+$/, "") || "/";
  return (
    <Link to={to} className="portal-nav__link" aria-current={path === to ? "page" : undefined}>
      {children}
    </Link>
  );
}

function ServerSwitcher() {
  const servers = usePortalServers();
  const server = useServer();
  const t = useT();
  const list = servers.data ?? [];
  if (list.length < 2) return null;
  return (
    <label className="portal-switcher">
      <span className="visually-hidden">{t.nav.switchServer}</span>
      <select
        value={server.key}
        onChange={(e) => {
          rememberServer(e.target.value);
          navigate("/", { replace: true });
        }}
      >
        {list.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The runtime's simulator state when it runs `cicord dev --sim` (null otherwise). */
function useSimulator() {
  const { client } = useCicord();
  return useCicordQuery(["cicord", "sim", "state"], async (signal) => {
    try {
      return await client.sim.state({ signal });
    } catch {
      return null; // not a simulator runtime
    }
  });
}

export function Shell({ children }: { children: ReactNode }) {
  const server = useServer();
  const config = usePortalConfig();
  const t = useT();
  const sim = useSimulator();
  const role = useViewerRole();
  // The Developers page stays reachable by URL; the link is shown to the server team and
  // in development (mock, simulator) only.
  const showDevelopers = config.mock || !!sim.data || atLeast(role, "moderator");
  const me = useMe();
  const login = useLogin();
  const linkLogin = useLinkTokenLogin();
  const pages = usePages();
  const path = usePathname();
  const user = me.data?.user;

  return (
    <div className="portal">
      <a className="skip-link" href="#main">
        {t.skip}
      </a>
      <header className="portal-header">
        <div className="portal-header__start">
          <Link to="/" className="portal-brand" aria-current={path === "/" ? "page" : undefined}>
            <ServerMark size={34} />
            <span>{server.name}</span>
          </Link>
          <ServerSwitcher />
        </div>
        <nav className="portal-nav" aria-label={t.nav.label}>
          {pages.leaderboard ? <NavLink to="/leaderboard">{t.nav.leaderboard}</NavLink> : null}
          {pages.ticketsInNav ? <NavLink to="/tickets">{t.nav.tickets}</NavLink> : null}
          {showDevelopers ? <NavLink to="/developers">{t.nav.developers}</NavLink> : null}
        </nav>
        <div className="portal-header__end">
          {user ? (
            pages.profile ? (
              <Link
                to="/me"
                className="portal-user"
                aria-current={path === "/me" ? "page" : undefined}
              >
                <Avatar src={user.avatarUrl || undefined} name={user.displayName} size={30} />
                <span className="portal-user__name">{user.displayName}</span>
              </Link>
            ) : (
              <span className="portal-user">
                <Avatar src={user.avatarUrl || undefined} name={user.displayName} size={30} />
                <span className="portal-user__name">{user.displayName}</span>
              </span>
            )
          ) : me.status === "success" && linkLogin.status !== "pending" ? (
            <Button size="sm" variant="secondary" onClick={login}>
              {t.loginShort}
            </Button>
          ) : null}
        </div>
      </header>
      <main id="main" className="portal-main">
        {children}
      </main>
      <footer className="portal-footer">
        <span>
          {t.poweredBy(server.name)} <a href="https://github.com/cicord">Cicord</a>
        </span>
      </footer>
      {config.mock ? <p className="portal-mock-badge">{t.demoMode}</p> : null}
    </div>
  );
}

/**
 * The sign-in block: Discord OAuth, plus — when the runtime runs the Discord simulator
 * (`cicord dev --sim`, which has no OAuth) — one button per simulated user.
 */
export function SignIn({ size = "lg" }: { size?: "md" | "lg" }) {
  const t = useT();
  const login = useLogin();
  const { client, cache } = useCicord();
  const server = useServer();
  const sim = useSimulator();
  const world = sim.data?.servers.find((s) => s.key === server.key);
  const users: (User & { owner: boolean })[] = (sim.data?.users ?? [])
    .filter((u) => !world || world.members.some((m) => m.user.id === u.id))
    .map((u) => ({ ...u, owner: u.id === world?.ownerId }))
    .slice(0, 6);
  const devLogin = async (id: string) => {
    const me = await client.auth.devLogin(id);
    cache.setData(["cicord", "me"], me);
    void cache.invalidate(["cicord", "portal"]);
    void cache.invalidate(["cicord", "plugin"]);
  };
  return (
    <div className="sign-in">
      <Button size={size} onClick={login}>
        {t.login}
      </Button>
      {users.length > 0 ? (
        <div className="sign-in__sim">
          <p>
            <strong>{t.signIn.simTitle}</strong> · {t.signIn.simText}
          </p>
          <ul>
            {users.map((u) => (
              <li key={u.id}>
                <button type="button" className="sign-in__user" onClick={() => void devLogin(u.id)}>
                  <Avatar src={u.avatarUrl || undefined} name={u.displayName} size={24} />
                  <span>{u.displayName}</span>
                  {u.owner ? <small>{t.signIn.owner}</small> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function CenteredMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="centered-message">
      <h1>{title}</h1>
      {children}
    </div>
  );
}

/** Formats a number with the interface locale. */
export function useNumber(): (n: number) => string {
  const t = useT();
  return (n) => new Intl.NumberFormat(t.locale).format(n);
}
