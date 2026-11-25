import { useLogout } from "@cicord/react";
import { Button, MemberCard } from "@cicord/ui";
import { useFormat } from "../format.ts";
import { useT } from "../i18n/index.tsx";
import { RequireMember, useDocumentTitle } from "../portal.tsx";
import { navigate } from "../router.tsx";

export function Profile() {
  const t = useT();
  const f = useFormat();
  const logout = useLogout();
  useDocumentTitle(t.me.title);

  return (
    <RequireMember title={t.me.loginTitle}>
      {({ me, role }) => (
        <div className="profile">
          <h1 className="profile__title">{t.me.title}</h1>
          <MemberCard
            className="profile__card"
            displayName={me.member.nick || me.user.displayName}
            username={me.user.username}
            avatarUrl={me.user.avatarUrl || undefined}
            roles={me.member.roles}
            rolesLabel={t.me.roles}
            emptyRoles={t.me.noRoles}
            caption={[
              role !== "member" ? t.me.access[role] : null,
              me.member.joinedAt ? t.me.since(f.date(me.member.joinedAt)) : null,
            ]
              .filter(Boolean)
              .join(". ")}
          >
            <p className="profile__note">{t.me.rolesNote}</p>
            <div className="profile__actions">
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
        </div>
      )}
    </RequireMember>
  );
}
