import { CicordApiError, type TicketList, type TicketStatus } from "@cicord/client";
import { useMe, usePluginQuery } from "@cicord/react";
import { Avatar, Button, Notice, Spinner } from "@cicord/ui";
import { useState } from "react";
import { useT } from "../i18n/index.tsx";
import { SignIn, usePlugin } from "../portal.tsx";

type Filter = TicketStatus | "all";

/**
 * Moderator view of the `tickets` plugin (`GET /tickets`, access: moderator). The runtime
 * enforces the access level: a member gets 403, shown as a notice.
 */
export function Tickets() {
  const t = useT();
  const me = useMe();
  const plugin = usePlugin("tickets", "GET /tickets");
  const [filter, setFilter] = useState<Filter>("open");
  const list = usePluginQuery<TicketList>(
    plugin && me.data ? { bot: plugin.bot, instance: plugin.instance } : undefined,
    "/tickets",
    filter === "all" ? {} : { query: { status: filter } },
  );

  if (me.isLoading) {
    return (
      <div className="portal-loading portal-loading--inline">
        <Spinner size="lg" label={t.loading} />
      </div>
    );
  }
  if (!me.data) {
    return (
      <div className="onboarding-gate">
        <h1>{t.tickets.loginTitle}</h1>
        <SignIn />
      </div>
    );
  }
  const forbidden = list.error instanceof CicordApiError && list.error.code === "forbidden";
  const date = new Intl.DateTimeFormat(t.locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="page tickets">
      <header className="page__header">
        <h1>{t.tickets.title}</h1>
        <p>{t.tickets.lead}</p>
      </header>
      {forbidden ? (
        <Notice tone="info" title={t.tickets.forbidden} />
      ) : (
        <>
          <div className="segmented" role="radiogroup" aria-label={t.tickets.filter}>
            {(["open", "closed", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                className="segmented__item"
                onClick={() => setFilter(f)}
              >
                {t.tickets[f]}
              </button>
            ))}
          </div>
          {list.status === "error" ? (
            <Notice
              tone="error"
              title={t.tickets.failed}
              action={
                <Button size="sm" variant="secondary" onClick={() => void list.refetch()}>
                  {t.onboarding.retry}
                </Button>
              }
            />
          ) : !list.data ? (
            <div className="portal-loading portal-loading--inline">
              <Spinner size="lg" label={t.loading} />
            </div>
          ) : list.data.items.length === 0 ? (
            <Notice>{t.tickets.empty}</Notice>
          ) : (
            <ul className="ticket-list">
              {list.data.items.map((ticket) => (
                <li key={ticket.id} className="ticket">
                  <span className="ticket__id">#{ticket.id}</span>
                  <span className="ticket__main">
                    <span className="ticket__subject">{ticket.subject}</span>
                    <span className="ticket__meta">
                      <Avatar name={ticket.author.displayName} size={20} />
                      {ticket.author.displayName}
                      <span aria-hidden="true">·</span>
                      <time dateTime={ticket.createdAt}>
                        {Number.isNaN(Date.parse(ticket.createdAt))
                          ? ticket.createdAt
                          : date.format(new Date(ticket.createdAt))}
                      </time>
                    </span>
                  </span>
                  <span className={`ticket__status ticket__status--${ticket.status}`}>
                    {t.tickets.status[ticket.status] ?? ticket.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
