import { CicordApiError, type PortalPlugin } from "@cicord/client";
import { useCicord, useLogout, useMe, useMember, useSession } from "@cicord/react";
import { Button, Card, RoleChip } from "@cicord/ui";
import { useState } from "react";
import { useT } from "../i18n/index.tsx";
import { SignIn, useDocumentTitle, useServer } from "../portal.tsx";

/**
 * A map of everything the SDK gives a portal: the session (cookie or bearer token), every
 * portal endpoint, and every plugin route of the server (GET routes can be called live).
 * Kept as a showcase for the developers of the Cicord community: this portal is a fork of
 * the reference portal, and this page shows what it is built on.
 */
export function Developers() {
  const t = useT();
  const server = useServer();
  const { client } = useCicord();
  const me = useMe();
  const member = useMember();
  const session = useSession();
  const logout = useLogout();
  const key = server.key;
  useDocumentTitle(t.developers.title);

  const endpoints: [string, string, string][] = [
    ["GET", "/api/v1/portal/servers", "client.portal.servers()"],
    ["GET", `/api/v1/portal/${key}`, `client.portal.server("${key}")`],
    ["GET", `/api/v1/portal/${key}/logo`, "server.theme.logo"],
    ["GET", `/api/v1/portal/${key}/banner`, "server.banner"],
    ["GET", `/api/v1/portal/${key}/me`, `client.portal.me("${key}") · useMember()`],
    [
      "GET",
      `/api/v1/portal/${key}/analytics?period=30d`,
      `client.portal.analytics("${key}", "30d") · usePortalAnalytics("30d")`,
    ],
    ["GET", "/api/v1/me", "client.me() · useMe()"],
    ["GET", "/auth/login", "client.auth.login(redirect)"],
    ["POST", "/auth/link", "client.auth.exchangeLinkToken() · useLinkTokenLogin()"],
    ...(client.authMode === "token"
      ? ([["POST", "/auth/token", "client.auth.redeem(code)"]] as [string, string, string][])
      : []),
    ["POST", "/auth/logout", "client.auth.logout() · useLogout()"],
    [
      "ANY",
      `/api/v1/portal/${key}/plugins/{bot}/{instance}/…`,
      "client.plugin(server, bot, instance)",
    ],
  ];

  return (
    <div className="page developers">
      <header className="page__header">
        <h1>{t.developers.title}</h1>
        <p>{t.developers.lead}</p>
      </header>

      <section className="dev-section" aria-labelledby="dev-session">
        <h2 id="dev-session">{t.developers.session}</h2>
        <Card className="dev-session">
          <dl className="dev-facts">
            <dt>{t.developers.mode}</dt>
            <dd>
              <code>{client.authMode}</code> ·{" "}
              {client.authMode === "token" ? t.developers.token : t.developers.cookie}
            </dd>
            <dt>{t.developers.api}</dt>
            <dd>
              <code>{client.baseUrl || window.location.origin}</code>
            </dd>
            {me.data ? (
              <>
                <dt>{t.developers.user}</dt>
                <dd>
                  {me.data.user.displayName} <code>{me.data.user.id}</code>
                </dd>
                {member.data ? (
                  <>
                    <dt>{t.developers.role}</dt>
                    <dd>
                      <code>{member.data.role}</code>
                    </dd>
                    <dt>{t.me.roles}</dt>
                    <dd className="dev-roles">
                      {member.data.member.roles.length === 0 ? (
                        <span className="dev-muted">{t.me.noRoles}</span>
                      ) : (
                        member.data.member.roles.map((r) => (
                          <RoleChip key={r.id} name={r.name} color={r.color} size="sm" />
                        ))
                      )}
                    </dd>
                  </>
                ) : null}
                {session ? (
                  <>
                    <dt>{t.developers.expires}</dt>
                    <dd>
                      {new Intl.DateTimeFormat(t.locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(session.expiresAt))}
                    </dd>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <dt>{t.developers.user}</dt>
                <dd>{t.developers.signedOut}</dd>
              </>
            )}
          </dl>
          {me.data ? (
            <Button variant="secondary" size="sm" onClick={() => void logout()}>
              {t.logout}
            </Button>
          ) : (
            <SignIn size="md" />
          )}
        </Card>
      </section>

      <section className="dev-section" aria-labelledby="dev-endpoints">
        <h2 id="dev-endpoints">{t.developers.endpoints}</h2>
        <table className="dev-table">
          <tbody>
            {endpoints.map(([method, path, code]) => (
              <tr key={method + path}>
                <td>
                  <span className={`dev-method dev-method--${method.toLowerCase()}`}>{method}</span>
                </td>
                <td>
                  <code>{path}</code>
                </td>
                <td>
                  <code className="dev-code">{code}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="dev-section" aria-labelledby="dev-plugins">
        <h2 id="dev-plugins">{t.developers.plugins}</h2>
        {server.plugins.length === 0 ? (
          <p className="dev-muted">{t.developers.noPlugins}</p>
        ) : (
          <div className="dev-plugins">
            {server.plugins.map((p) => (
              <PluginRoutes key={`${p.bot}/${p.instance}`} plugin={p} />
            ))}
          </div>
        )}
      </section>

      <section className="dev-section" aria-labelledby="dev-server">
        <h2 id="dev-server">{t.developers.server}</h2>
        <pre className="dev-json">{JSON.stringify(server, null, 2)}</pre>
      </section>
    </div>
  );
}

function PluginRoutes({ plugin }: { plugin: PortalPlugin }) {
  const t = useT();
  const server = useServer();
  const { client } = useCicord();
  const [result, setResult] = useState<{ route: string; body: string; ok: boolean } | null>(null);
  const call = async (route: string, path: string) => {
    try {
      const body = await client.plugin(server.key, plugin.bot, plugin.instance).get(path);
      setResult({ route, body: JSON.stringify(body ?? null, null, 2), ok: true });
    } catch (error) {
      const e = error instanceof CicordApiError ? e2s(error) : String(error);
      setResult({ route, body: e, ok: false });
    }
  };
  return (
    <Card className="dev-plugin">
      <h3>
        {plugin.plugin}{" "}
        <code>
          {plugin.bot}/{plugin.instance}
        </code>
      </h3>
      <ul className="dev-routes">
        {plugin.routes.map((route) => {
          const [method = "", path = ""] = route.split(" ");
          const callable = method === "GET" && !path.includes(":") && !path.includes("*");
          return (
            <li key={route}>
              <span className={`dev-method dev-method--${method.toLowerCase()}`}>{method}</span>
              <code>{path}</code>
              {callable ? (
                <Button size="sm" variant="ghost" onClick={() => void call(route, path)}>
                  {t.developers.run}
                </Button>
              ) : (
                <span className="dev-muted" title={t.developers.params}>
                  —
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {result ? (
        <div className="dev-result">
          <p>
            {t.developers.response} · <code>{result.route}</code>
          </p>
          <pre className={result.ok ? "dev-json" : "dev-json dev-json--error"}>{result.body}</pre>
        </div>
      ) : null}
    </Card>
  );
}

function e2s(error: CicordApiError): string {
  return `${error.status} ${error.code}: ${error.message}`;
}
