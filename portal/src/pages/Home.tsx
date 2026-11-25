import { isSafeUrl, type OnboardingSteps } from "@cicord/client";
import { useLinkTokenLogin, useMe, useMember, usePluginQuery } from "@cicord/react";
import { LinkIcon, Markdown, Notice, Spinner } from "@cicord/ui";
import type { ReactNode } from "react";
import { useT } from "../i18n/index.tsx";
import { ServerMark, SignIn, usePages, usePlugin, useServer } from "../portal.tsx";
import { Link } from "../router.tsx";

export function Home() {
  const server = useServer();
  const t = useT();
  const me = useMe();
  const linkLogin = useLinkTokenLogin();
  const user = me.data?.user;
  const links = server.links.filter((l) => isSafeUrl(l.url));

  return (
    <div className={server.banner ? "home home--banner" : "home"}>
      <section className="home-hero" aria-labelledby="home-title">
        {server.banner ? (
          <div className="home-hero__banner">
            <img src={server.banner} alt="" />
          </div>
        ) : null}
        <ServerMark size={112} className="home-hero__mark" />
        <h1 id="home-title" className="home-hero__title">
          {server.title}
        </h1>
        <p className="home-hero__lead">{server.tagline || t.portalOf(server.name)}</p>
        {links.length > 0 ? (
          <ul className="home-links" aria-label={t.home.links}>
            {links.map((l) => (
              <li key={`${l.label}-${l.url}`}>
                <a className="home-link" href={l.url} target="_blank" rel="noopener noreferrer">
                  <LinkIcon name={l.icon} size={18} />
                  <span>{l.label}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className={server.description ? "home-body home-body--split" : "home-body"}>
        <section className="home-panel" aria-live="polite">
          {me.isLoading || linkLogin.status === "pending" ? (
            <div className="home-panel__loading">
              <Spinner label={t.loading} />
            </div>
          ) : user ? (
            <MemberHome name={user.displayName} />
          ) : (
            <div className="home-login">
              <h2>{t.home.loggedOutTitle}</h2>
              <p>{t.home.loggedOut}</p>
              <SignIn />
            </div>
          )}
        </section>
        {server.description ? (
          <section className="home-about" aria-labelledby="home-about">
            <h2 id="home-about" className="home-about__title">
              {t.home.about}
            </h2>
            <Markdown source={server.description} baseLevel={3} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

function MemberHome({ name }: { name: string }) {
  const t = useT();
  const member = useMember();
  const pages = usePages();
  const onboarding = usePlugin("onboarding");
  const steps = usePluginQuery<OnboardingSteps>(
    pages.onboarding && onboarding && member.data
      ? { bot: onboarding.bot, instance: onboarding.instance }
      : undefined,
    "/steps",
  );

  if (member.status === "error") {
    return (
      <Notice tone="info" title={t.home.hello(name)}>
        {t.home.notMember}
      </Notice>
    );
  }

  return (
    <div className="home-member">
      <h2>{t.home.hello(name)}</h2>
      <ul className="home-actions">
        {pages.onboarding ? (
          <Action
            to="/onboarding"
            icon="✨"
            title={t.home.onboardingTitle}
            desc={steps.data?.completed ? t.home.onboardingDone : t.home.onboardingTodo}
          />
        ) : null}
        {pages.profile ? (
          <Action to="/me" icon="🪪" title={t.home.profileTitle} desc={t.home.profileText} />
        ) : null}
        {pages.leaderboard ? (
          <Action
            to="/leaderboard"
            icon="🏆"
            title={t.home.leaderboardTitle}
            desc={t.home.leaderboardText}
          />
        ) : null}
        {pages.ticketsInNav ? (
          <Action to="/tickets" icon="🎫" title={t.home.ticketsTitle} desc={t.home.ticketsText} />
        ) : null}
      </ul>
    </div>
  );
}

function Action({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <li>
      <Link to={to} className="home-action">
        <span className="home-action__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="home-action__text">
          <span className="home-action__title">{title}</span>
          <span className="home-action__desc">{desc}</span>
        </span>
        <Chevron />
      </Link>
    </li>
  );
}

function Chevron() {
  return (
    <svg
      className="home-action__chevron"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        d="M6 3.5L10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
