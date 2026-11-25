import {
  CicordApiError,
  type AccessRole,
  type PortalMe,
  type PortalServer,
  type User,
} from "@cicord/client";
import {
  useCicord,
  useCicordQuery,
  useLinkTokenLogin,
  useMe,
  useMember,
  usePortalServers,
} from "@cicord/react";
import { Avatar, Button, Notice, Spinner, ThemeProvider } from "@cicord/ui";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { forgetServer, requestedServer, rememberServer, type PortalConfig } from "./config.ts";
import { I18nProvider, pickLocale, useT } from "./i18n/index.tsx";
import { Link, navigate, usePathname } from "./router.tsx";
import { MEMBER_ROUTE, STAFF_ROUTE, useTicketsPlugin } from "./tickets/api.ts";

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
function useLogin(): () => void {
  const config = usePortalConfig();
  return () => config.login(`${window.location.pathname}${window.location.search}`);
}

// ───────────────────────────────────────────────────────────── the viewer

/** Moderators and admins of the server: the support team. */
function isStaff(role: AccessRole | undefined): boolean {
  return role === "moderator" || role === "admin";
}

/**
 * Who is looking at the portal, from `useMember()` (`GET /portal/{server}/me`): signed out
 * (401, `data: null`), signed in but not a member of the server (403), or a member with
 * their access role (`PortalMe.role`: member, moderator or admin, from `spec.access`).
 */
export type Viewer =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "notMember" }
  | { status: "error"; retry: () => void }
  | { status: "member"; me: PortalMe; role: AccessRole; staff: boolean };

export function useViewer(): Viewer {
  const me = useMe();
  const member = useMember();
  const linkLogin = useLinkTokenLogin();
  if (me.isLoading || linkLogin.status === "pending") return { status: "loading" };
  if (!me.data) return { status: "signedOut" };
  if (member.status === "error") {
    if (member.error instanceof CicordApiError && member.error.code === "forbidden")
      return { status: "notMember" };
    return { status: "error", retry: () => void member.refetch() };
  }
  if (!member.data) return member.data === null ? { status: "signedOut" } : { status: "loading" };
  const role = member.data.role;
  return { status: "member", me: member.data, role, staff: isStaff(role) };
}

// ───────────────────────────────────────────────────────────── pages

export interface Pages {
  profile: boolean;
  /** The member side of the tickets plugin (0.2 routes). */
  myTickets: boolean;
  /** The staff side of the tickets plugin (0.2 routes). */
  support: boolean;
}

/**
 * Pages enabled by `spec.portal.pages` and backed by a plugin that serves their routes. The
 * tickets pages are detected by route (`GET /tickets/mine`, `GET /staff`), so a server still
 * running tickets 0.1 shows neither instead of misreading its payloads.
 */
export function usePages(): Pages {
  const server = useServer();
  const mine = useTicketsPlugin(MEMBER_ROUTE);
  const staff = useTicketsPlugin(STAFF_ROUTE);
  return {
    profile: server.pages.profile,
    myTickets: server.pages.tickets && !!mine,
    support: server.pages.tickets && !!staff,
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
            {children}
          </ThemeProvider>
        </ServerContext.Provider>
      )}
    </I18nProvider>
  );
}

/** Sets the document title: "<page> · <portal title>". */
export function useDocumentTitle(page?: string): void {
  const server = useServer();
  const t = useT();
  useEffect(() => {
    const site = server.title !== server.name ? server.title : t.portalOf(server.name);
    document.title = page ? `${page} · ${site}` : site;
  }, [server, t, page]);
}

function GateMessage({ kind, retry }: { kind: "down" | "loading" | "none"; retry?: () => void }) {
  const t = useT();
  if (kind === "loading") return <PageLoading fullscreen />;
  if (kind === "down")
    return (
      <CenteredMessage title={t.apiDown}>
        <Button variant="secondary" onClick={retry}>
          {t.retry}
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
  const path = usePathname();
  // A section stays current on its sub-pages (/tickets/12 is under My tickets).
  const current = path === to ? "page" : path.startsWith(`${to}/`) ? "location" : undefined;
  return (
    <Link to={to} className="portal-nav__link" aria-current={current}>
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
  const viewer = useViewer();
  const login = useLogin();
  const pages = usePages();
  const path = usePathname();
  const me = useMe();
  const user = me.data?.user;
  const staff = viewer.status === "member" && viewer.staff;

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
          <NavLink to="/activity">{t.nav.activity}</NavLink>
          {pages.myTickets ? <NavLink to="/tickets">{t.nav.myTickets}</NavLink> : null}
          {pages.support && staff ? <NavLink to="/support">{t.nav.support}</NavLink> : null}
          {pages.profile && user ? <NavLink to="/me">{t.nav.profile}</NavLink> : null}
        </nav>
        <div className="portal-header__end">
          {user ? (
            <span className="portal-user">
              <Avatar src={user.avatarUrl || undefined} name={user.displayName} size={30} />
              <span className="portal-user__name">{user.displayName}</span>
            </span>
          ) : viewer.status === "signedOut" ? (
            <Button size="sm" variant="secondary" onClick={login}>
              {t.loginShort}
            </Button>
          ) : null}
        </div>
      </header>
      <main id="main" className="portal-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="portal-footer">
        <span>
          {t.poweredBy(server.name)} <a href="https://cicord.dev">Cicord</a>
        </span>
        <span aria-hidden="true"> · </span>
        <Link to="/developers">{t.nav.developers}</Link>
      </footer>
      {config.mock ? <p className="portal-mock-badge">{t.demoMode}</p> : null}
    </div>
  );
}

/**
 * The sign-in block: Discord OAuth, plus — when the runtime runs the Discord simulator
 * (`cicord dev --sim`, which has no OAuth) — one button per simulated member.
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

export function PageLoading({ fullscreen = false }: { fullscreen?: boolean }) {
  const t = useT();
  return (
    <div className={fullscreen ? "portal-loading" : "portal-loading portal-loading--inline"}>
      <Spinner size="lg" label={t.loading} />
    </div>
  );
}

/**
 * Shows `children` to members of the server only: a sign-in block when signed out, a notice
 * when the Discord account is not a member. With `staff`, moderators and admins only.
 * The runtime enforces the same rules on every route (401/403); this is the friendly face.
 */
export function RequireMember({
  title,
  staff = false,
  children,
}: {
  /** Heading of the sign-in block. */
  title: string;
  staff?: boolean;
  children: (viewer: Extract<Viewer, { status: "member" }>) => ReactNode;
}) {
  const t = useT();
  const viewer = useViewer();
  switch (viewer.status) {
    case "loading":
      return <PageLoading />;
    case "signedOut":
      return (
        <div className="gate">
          <h1>{title}</h1>
          <p>{t.gate.signInText}</p>
          <SignIn />
        </div>
      );
    case "notMember":
      return (
        <div className="gate">
          <h1>{title}</h1>
          <Notice tone="info">{t.gate.notMember}</Notice>
        </div>
      );
    case "error":
      return (
        <div className="gate">
          <Notice
            tone="error"
            title={t.gate.failed}
            action={
              <Button size="sm" variant="secondary" onClick={viewer.retry}>
                {t.retry}
              </Button>
            }
          />
        </div>
      );
  }
  if (staff && !viewer.staff)
    return (
      <CenteredMessage title={t.gate.staffTitle}>
        <p>{t.gate.staffText}</p>
        <Link to="/" className="cicord-button cicord-button--secondary cicord-button--md">
          <span className="cicord-button__label">{t.notFound.home}</span>
        </Link>
      </CenteredMessage>
    );
  return <>{children(viewer)}</>;
}
