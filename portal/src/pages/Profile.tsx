import { useLogout, useMe, useMember, useRouteQuery } from "@cicord/react";
import { Button, MemberCard, Notice, ProgressBar, Spinner } from "@cicord/ui";
import { useT } from "../i18n/index.tsx";
import { SignIn, useNumber, usePages } from "../portal.tsx";
import { Link, navigate } from "../router.tsx";

export function Profile() {
  const t = useT();
  const me = useMe();
  const member = useMember();
  const logout = useLogout();
  const pages = usePages();

  if (me.isLoading || (me.data && member.isLoading)) {
    return (
      <div className="portal-loading portal-loading--inline">
        <Spinner size="lg" label={t.loading} />
      </div>
    );
  }
  const user = me.data?.user;
  if (!user) {
    return (
      <div className="onboarding-gate">
        <h1>{t.me.loginTitle}</h1>
        <SignIn />
      </div>
    );
  }
  const data = member.data;
  const joined = data?.member.joinedAt ? new Date(data.member.joinedAt) : undefined;
  const since =
    joined && !Number.isNaN(joined.getTime())
      ? t.me.since(new Intl.DateTimeFormat(t.locale, { dateStyle: "long" }).format(joined))
      : undefined;

  return (
    <div className="profile">
      <h1 className="profile__title">{t.me.title}</h1>
      {member.status === "error" || !data ? (
        <Notice>{t.home.notMember}</Notice>
      ) : (
        <MemberCard
          className="profile__card"
          displayName={data.member.nick || user.displayName}
          username={user.username}
          avatarUrl={user.avatarUrl || undefined}
          roles={data.member.roles}
          rolesLabel={t.me.roles}
          emptyRoles={t.onboarding.noRoles}
          caption={[data.role !== "member" ? t.me.access[data.role] : null, since]
            .filter(Boolean)
            .join(". ")}
        >
          <LevelCard />
          <div className="profile__actions">
            {pages.onboarding ? (
              <Link
                to="/onboarding"
                className="cicord-button cicord-button--primary cicord-button--md"
              >
                <span className="cicord-button__label">{t.me.editRoles}</span>
              </Link>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => {
                void logout().then(() => navigate("/"));
              }}
            >
              {t.logout}
            </Button>
          </div>
        </MemberCard>
      )}
    </div>
  );
}

/**
 * The viewer's standing in the `levels` plugin (`GET /me`, member), when installed. Typed by
 * the plugin's route contract (src/cicord-routes.d.ts).
 */
function LevelCard() {
  const t = useT();
  const fmt = useNumber();
  const mine = useRouteQuery("levels", "GET /me");
  const d = mine.data;
  if (!d) return null;
  return (
    <div className="profile__level">
      <div className="profile__level-head">
        <strong>{t.me.level(d.level)}</strong>
        <span>
          {t.me.xp(fmt(d.xp))}
          {d.rank !== null ? ` · ${t.me.rank(d.rank)}` : ""}
        </span>
      </div>
      {d.needed > 0 ? (
        <ProgressBar value={Math.min(1, d.current / d.needed)} label={t.me.level(d.level + 1)} />
      ) : null}
    </div>
  );
}
