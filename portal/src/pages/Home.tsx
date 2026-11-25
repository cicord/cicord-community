import { isSafeUrl } from "@cicord/client";
import { LinkIcon, Markdown, Notice, Spinner } from "@cicord/ui";
import type { ReactNode } from "react";
import { useT } from "../i18n/index.tsx";
import {
  ServerMark,
  SignIn,
  useDocumentTitle,
  usePages,
  useServer,
  useViewer,
  type Viewer,
} from "../portal.tsx";
import { Link } from "../router.tsx";

export function Home() {
  const server = useServer();
  const t = useT();
  const viewer = useViewer();
  const links = server.links.filter((l) => isSafeUrl(l.url));
  useDocumentTitle();

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
          <HomePanel viewer={viewer} />
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

function HomePanel({ viewer }: { viewer: Viewer }) {
  const t = useT();
  const pages = usePages();
  switch (viewer.status) {
    case "loading":
      return (
        <div className="home-panel__loading">
          <Spinner label={t.loading} />
        </div>
      );
    case "signedOut":
      return (
        <div className="home-login">
          <h2>{t.home.loggedOutTitle}</h2>
          <p>{t.home.loggedOut}</p>
          <SignIn />
          <ul className="home-actions home-actions--public">
            <Action
              to="/activity"
              icon={<ChartIcon />}
              title={t.home.activityTitle}
              desc={t.home.activityText}
            />
          </ul>
        </div>
      );
    case "notMember":
    case "error":
      return (
        <div className="home-member">
          <Notice tone="info">{t.gate.notMember}</Notice>
          <ul className="home-actions">
            <Action
              to="/activity"
              icon={<ChartIcon />}
              title={t.home.activityTitle}
              desc={t.home.activityText}
            />
          </ul>
        </div>
      );
  }
  const name = viewer.me.member.nick || viewer.me.user.displayName;
  return (
    <div className="home-member">
      <h2>{t.home.hello(name)}</h2>
      <ul className="home-actions">
        <Action
          to="/activity"
          icon={<ChartIcon />}
          title={t.home.activityTitle}
          desc={t.home.activityText}
        />
        {pages.myTickets ? (
          <Action
            to="/tickets"
            icon={<TicketIcon />}
            title={t.home.ticketsTitle}
            desc={t.home.ticketsText}
          />
        ) : null}
        {pages.support && viewer.staff ? (
          <Action
            to="/support"
            icon={<QueueIcon />}
            title={t.home.supportTitle}
            desc={t.home.supportText}
          />
        ) : null}
        {pages.profile ? (
          <Action
            to="/me"
            icon={<ProfileIcon />}
            title={t.home.profileTitle}
            desc={t.home.profileText}
          />
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
        <Icon className="home-action__chevron" size={16} d="M6 3.5L10.5 8 6 12.5" />
      </Link>
    </li>
  );
}

/** A 16-unit stroked icon (inherits the text color). */
function Icon({ d, size = 20, className }: { d: string; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ChartIcon = () => <Icon d="M2.5 13.5h11M4.5 11V8M8 11V4.5M11.5 11V6.5" />;
const TicketIcon = () => (
  <Icon d="M2.5 5a1.5 1.5 0 0 0 0 3v3.5h11V8a1.5 1.5 0 0 1 0-3V4.5h-11zM6.5 4.5v7" />
);
const QueueIcon = () => <Icon d="M2.5 4h11M2.5 8h11M2.5 12h7" />;
const ProfileIcon = () => (
  <Icon d="M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 13.5c.6-2.3 2.6-3.5 5-3.5s4.4 1.2 5 3.5" />
);
