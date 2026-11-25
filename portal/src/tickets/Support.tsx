/**
 * The staff side of the tickets plugin (access: moderator, so moderators and admins): the
 * support queue (`GET /tickets` with filters) and a ticket with its conversation, reply box,
 * assignment, priority, label, close and reopen.
 */
import { isCicordApiError, isSafeUrl } from "@cicord/client";
import { Avatar, Button, LinkButton, Notice, renderInline } from "@cicord/ui";
import { useId, useMemo, useState, type FormEvent } from "react";
import { useFormat } from "../format.ts";
import { useT } from "../i18n/index.tsx";
import { PageLoading, RequireMember, useDocumentTitle, type Viewer } from "../portal.tsx";
import { Link, setSearch, useSearch } from "../router.tsx";
import {
  LIMITS,
  PRIORITIES,
  TICKET_LABELS,
  useOptimisticTicket,
  useTicketsMutation,
  useTicketsQuery,
  type Person,
  type Priority,
  type StaffTicket,
  type StaffTicketDetail,
  type StaffTicketQuery,
  type TicketMessage,
} from "./api.ts";
import {
  BackLink,
  Facts,
  Field,
  LabelTag,
  PriorityBadge,
  StatusBadge,
  Timeline,
  errorText,
  labelOption,
} from "./ui.tsx";

type Member = Extract<Viewer, { status: "member" }>;

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/**
 * Open tickets first, the most urgent first, then the one waiting the longest (oldest last
 * activity); closed tickets by most recently closed.
 */
export function sortQueue(items: readonly StaffTicket[]): StaffTicket[] {
  const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);
  return items.toSorted((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    if (a.status === "closed") return time(b.closedAt) - time(a.closedAt);
    return (
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      time(a.lastActivityAt ?? a.createdAt) - time(b.lastActivityAt ?? b.createdAt)
    );
  });
}

// ───────────────────────────────────────────────────────────── queue

export function SupportQueue() {
  const t = useT();
  useDocumentTitle(t.support.title);
  return (
    <RequireMember title={t.support.title} staff>
      {(viewer) => <Queue viewer={viewer} />}
    </RequireMember>
  );
}

interface Filters {
  status: "open" | "closed" | "all";
  assignee: string;
  priority: Priority | "";
  label: string;
}

function useFilters(): [Filters, (patch: Partial<Filters>) => void] {
  const search = useSearch();
  const filters = useMemo<Filters>(() => {
    const p = new URLSearchParams(search);
    const status = p.get("status");
    const priority = p.get("priority");
    return {
      status: status === "closed" || status === "all" ? status : "open",
      assignee: p.get("assignee") ?? "",
      priority: PRIORITIES.find((x) => x === priority) ?? "",
      label: p.get("label") ?? "",
    };
  }, [search]);
  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    const p = new URLSearchParams();
    if (next.status !== "open") p.set("status", next.status);
    if (next.assignee) p.set("assignee", next.assignee);
    if (next.priority) p.set("priority", next.priority);
    if (next.label) p.set("label", next.label);
    setSearch(p);
  };
  return [filters, update];
}

function Queue({ viewer }: { viewer: Member }) {
  const t = useT();
  const id = useId();
  const [filters, update] = useFilters();
  const staff = useTicketsQuery("GET /staff");
  const query: StaffTicketQuery = {
    ...(filters.status === "all" ? {} : { status: filters.status }),
    ...(filters.assignee ? { assignee: filters.assignee } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.label ? { label: filters.label } : {}),
  };
  const list = useTicketsQuery("GET /tickets", { query });
  const items = useMemo(() => sortQueue(list.data?.items ?? []), [list.data]);
  const unassigned = items.filter((i) => i.status === "open" && !i.assignee).length;
  const filtered = !!(
    filters.assignee ||
    filters.priority ||
    filters.label ||
    filters.status !== "open"
  );
  const others = (staff.data?.items ?? []).filter((p) => p.id !== viewer.me.user.id);

  return (
    <div className="page page--wide">
      <header className="page__header">
        <h1>{t.support.title}</h1>
        <p>{t.support.lead}</p>
      </header>

      <form className="filters" aria-label={t.support.filters} onSubmit={(e) => e.preventDefault()}>
        <FilterSelect
          id={`${id}-status`}
          label={t.support.status}
          value={filters.status}
          onChange={(v) => update({ status: v as Filters["status"] })}
          options={[
            ["open", t.tickets.status.open],
            ["closed", t.tickets.status.closed],
            ["all", t.support.all],
          ]}
        />
        <FilterSelect
          id={`${id}-assignee`}
          label={t.support.assignee}
          value={filters.assignee}
          onChange={(v) => update({ assignee: v })}
          options={[
            ["", t.support.anyone],
            ["me", t.support.me],
            ["none", t.tickets.unassigned],
            ...others.map((p): [string, string] => [p.id, p.displayName]),
          ]}
        />
        <FilterSelect
          id={`${id}-priority`}
          label={t.tickets.priority}
          value={filters.priority}
          onChange={(v) => update({ priority: v as Filters["priority"] })}
          options={[
            ["", t.support.any],
            ...PRIORITIES.map((p): [string, string] => [p, t.tickets.priorities[p]]),
          ]}
        />
        <FilterSelect
          id={`${id}-label`}
          label={t.tickets.label}
          value={filters.label}
          onChange={(v) => update({ label: v })}
          options={[
            ["", t.support.any],
            ["none", t.tickets.noLabel],
            ...TICKET_LABELS.map((l): [string, string] => [l.key, labelOption(l)]),
          ]}
        />
        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => update({ status: "open", assignee: "", priority: "", label: "" })}
          >
            {t.support.reset}
          </Button>
        ) : null}
      </form>

      {isCicordApiError(list.error, "forbidden") ? (
        <NotOnTeam />
      ) : list.status === "error" ? (
        <Notice
          tone="error"
          title={t.tickets.loadFailed}
          action={
            <Button size="sm" variant="secondary" onClick={() => void list.refetch()}>
              {t.retry}
            </Button>
          }
        >
          {errorText(t, list.error)}
        </Notice>
      ) : !list.data ? (
        <PageLoading />
      ) : (
        <>
          <p className="queue-summary" aria-live="polite">
            {t.support.summary(items.length, filters.status === "closed" ? 0 : unassigned)}
          </p>
          {items.length === 0 ? (
            <div className="empty-state">
              <h2>{filtered ? t.support.noMatchTitle : t.support.emptyTitle}</h2>
              <p>{filtered ? t.support.noMatchText : t.support.emptyText}</p>
            </div>
          ) : (
            <ul className="ticket-list" aria-busy={list.isFetching || undefined}>
              {items.map((ticket) => (
                <QueueRow key={ticket.id} ticket={ticket} me={viewer.me.user.id} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="filters__field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function QueueRow({ ticket, me }: { ticket: StaffTicket; me: string }) {
  const t = useT();
  const f = useFormat();
  const last = ticket.lastActivityAt ?? ticket.createdAt;
  return (
    <li className={`ticket-row ticket-row--${ticket.priority}`}>
      <Link to={`/support/${encodeURIComponent(ticket.id)}`} className="ticket-row__link">
        <span className="ticket-row__id">#{ticket.number}</span>
        <span className="ticket-row__main">
          <span className="ticket-row__subject">{ticket.subject}</span>
          <span className="ticket-row__meta">
            <Avatar name={ticket.author.displayName} size={18} />
            {ticket.author.displayName}
            <span aria-hidden="true"> · </span>
            {ticket.status === "open"
              ? t.support.lastActivity(f.relative(last))
              : t.tickets.closedOn(f.relative(ticket.closedAt ?? last))}
            <span aria-hidden="true"> · </span>
            {t.support.messages(ticket.messages)}
          </span>
        </span>
        <span className="ticket-row__tags">
          <LabelTag label={ticket.label} />
          {ticket.priority !== "normal" ? <PriorityBadge priority={ticket.priority} /> : null}
          {ticket.status === "closed" ? (
            <StatusBadge status="closed" />
          ) : ticket.assignee ? (
            <span className="assignee">
              {ticket.assignee.id === me ? t.support.mine : ticket.assignee.displayName}
            </span>
          ) : (
            <span className="assignee assignee--none">{t.tickets.unassigned}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

/** 403 on a staff route: a moderator without a staff role of the tickets plugin. */
function NotOnTeam() {
  const t = useT();
  return (
    <Notice tone="info" title={t.support.notTeamTitle}>
      {t.support.notTeamText}
    </Notice>
  );
}

// ───────────────────────────────────────────────────────────── one ticket

export function SupportTicket({ id }: { id: string }) {
  const t = useT();
  return (
    <RequireMember title={t.support.title} staff>
      {(viewer) => <StaffTicketView id={id} viewer={viewer} />}
    </RequireMember>
  );
}

function StaffTicketView({ id, viewer }: { id: string; viewer: Member }) {
  const t = useT();
  const f = useFormat();
  const ticket = useTicketsQuery("GET /tickets/:id", { params: { id } });
  const d = ticket.data;
  useDocumentTitle(d ? `#${d.number} ${d.subject}` : t.support.title);

  if (ticket.status === "error" && !d)
    return (
      <div className="page">
        <BackLink to="/support" label={t.support.back} />
        {isCicordApiError(ticket.error, "forbidden") ? (
          <NotOnTeam />
        ) : (
          <Notice
            tone="error"
            title={
              isCicordApiError(ticket.error, "not_found")
                ? t.tickets.notFound
                : t.tickets.loadFailed
            }
          >
            {isCicordApiError(ticket.error, "not_found") ? null : errorText(t, ticket.error)}
          </Notice>
        )}
      </div>
    );
  if (!d) return <PageLoading />;

  const channel = d.channelUrl && isSafeUrl(d.channelUrl) ? d.channelUrl : null;
  return (
    <div className="page page--wide ticket-page">
      <BackLink to="/support" label={t.support.back} />
      <header className="ticket-page__header">
        <p className="ticket-page__id">
          #{d.number} <StatusBadge status={d.status} />
          {d.priority !== "normal" ? <PriorityBadge priority={d.priority} /> : null}
          <LabelTag label={d.label} />
        </p>
        <h1>{d.subject}</h1>
        <p className="ticket-page__by">
          {t.support.openedBy(d.author.displayName, f.relative(d.createdAt))}
          {d.source === "portal" ? ` ${t.support.fromPortal}` : ""}
        </p>
      </header>
      <div className="ticket-page__grid">
        <div className="ticket-page__main">
          <section className="panel" aria-labelledby="ticket-description">
            <h2 id="ticket-description" className="panel__title">
              {t.tickets.description}
            </h2>
            <p className="ticket-description">{d.description}</p>
          </section>
          <Conversation ticket={d} />
          <section className="panel" aria-labelledby="ticket-timeline">
            <h2 id="ticket-timeline" className="panel__title">
              {t.tickets.timeline}
            </h2>
            <Timeline events={d.events} />
          </section>
        </div>
        <aside className="ticket-page__side" aria-label={t.tickets.details}>
          <Manage ticket={d} viewer={viewer} />
          <section className="panel">
            <Facts
              items={[
                [t.tickets.opened, f.dateTime(d.createdAt)],
                [
                  t.support.lastActivityLabel,
                  d.lastActivityAt ? f.relative(d.lastActivityAt) : "—",
                ],
                [t.support.messagesLabel, f.number(d.messageCount)],
                [t.tickets.source, t.tickets.sources[d.source]],
                ...(d.closedAt
                  ? ([
                      [
                        t.tickets.closed,
                        `${f.dateTime(d.closedAt)}${d.closedBy ? ` · ${d.closedBy.displayName}` : ""}`,
                      ],
                    ] as [string, string][])
                  : []),
                ...(d.closeReason
                  ? ([[t.support.reason, d.closeReason]] as [string, string][])
                  : []),
                ...(d.summary
                  ? ([
                      [
                        t.support.participants,
                        d.summary.participants.map((p) => p.displayName).join(", ") || "—",
                      ],
                    ] as [string, string][])
                  : []),
              ]}
            />
            {channel ? (
              <LinkButton
                href={channel}
                target="_blank"
                rel="noopener noreferrer"
                variant="secondary"
                size="sm"
                block
              >
                {t.tickets.openInDiscord}
              </LinkButton>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

/**
 * Discord mention markup as text (the bold, italic, code and links of Discord's Markdown are
 * rendered by `renderInline`, as React elements): `<@id>` becomes "@name" when the person is known (the
 * author, the assignee, a participant), `<@&id>` "@role" and `<#id>` "#channel".
 */
export function readableMentions(content: string, names: ReadonlyMap<string, string>): string {
  return content
    .replace(/<@!?(\d+)>/g, (_, id: string) => `@${names.get(id) ?? "user"}`)
    .replace(/<@&\d+>/g, "@role")
    .replace(/<#\d+>/g, "#channel");
}

/**
 * One message of the ticket channel. A reply sent from the portal is posted by the bot as an
 * embed: it is shown under the staff member who wrote it (`repliedBy`), marked "via portal".
 * Other bot messages (welcome, assignment, reopen) show their text and embeds as the bot's;
 * members' and staff's own messages their text.
 */
function MessageItem({
  message: m,
  names,
}: {
  message: TicketMessage;
  names: ReadonlyMap<string, string>;
}) {
  const t = useT();
  const f = useFormat();
  const author = m.repliedBy ?? m.author;
  const bot = m.author.bot && !m.repliedBy;
  const inline = (text: string, key: string) => renderInline(readableMentions(text, names), key);
  const embeds = m.embeds.filter((e) => e.title || e.description);
  return (
    <li className={bot ? "message message--bot" : "message"}>
      <Avatar name={author.displayName} size={32} />
      <div className="message__body">
        <p className="message__head">
          <strong>{author.displayName}</strong>
          {bot ? <span className="message__bot">{t.support.bot}</span> : null}
          {m.repliedBy ? <span className="message__via">{t.support.viaPortal}</span> : null}
          <time dateTime={m.createdAt} title={f.dateTime(m.createdAt)}>
            {f.relative(m.createdAt)}
          </time>
        </p>
        {m.content ? <p className="message__content">{inline(m.content, `${m.id}-c`)}</p> : null}
        {m.repliedBy
          ? embeds.map((e) => (
              <p key={`${e.title ?? ""}|${e.description ?? ""}`} className="message__content">
                {inline(e.description ?? e.title ?? "", `${m.id}-e`)}
              </p>
            ))
          : embeds.map((e) => (
              <div key={`${e.title ?? ""}|${e.description ?? ""}`} className="message__embed">
                {e.title ? (
                  <p className="message__embed-title">{inline(e.title, `${m.id}-t`)}</p>
                ) : null}
                {e.description ? (
                  <p className="message__content">{inline(e.description, `${m.id}-d`)}</p>
                ) : null}
              </div>
            ))}
        {!m.content && embeds.length === 0 ? (
          <p className="message__content message__content--none">{t.support.noText}</p>
        ) : null}
      </div>
    </li>
  );
}

function Conversation({ ticket }: { ticket: StaffTicketDetail }) {
  const t = useT();
  const names = useMemo(
    () =>
      new Map(
        [
          ticket.author,
          ticket.assignee,
          ...(ticket.messages ?? []).flatMap((m) => [m.author, m.repliedBy]),
        ]
          .filter((p) => p !== null)
          .map((p) => [p.id, p.displayName]),
      ),
    [ticket],
  );
  const id = useId();
  const [content, setContent] = useState("");
  const [touched, setTouched] = useState(false);
  const reply = useTicketsMutation("POST /tickets/:id/messages", {
    onSuccess: () => {
      setContent("");
      setTouched(false);
    },
  });
  const length = content.trim().length;
  const invalid = length < LIMITS.reply.min || length > LIMITS.reply.max;
  const closedConflict = reply.status === "error" && isCicordApiError(reply.error, "closed");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (invalid) return;
    reply.mutate({ params: { id: ticket.id }, body: { content: content.trim() } });
  };

  return (
    <section className="panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="panel__title">
        {t.support.conversation}
      </h2>
      <p className="panel__note">{t.support.conversationNote}</p>
      {ticket.messages === null ? (
        <p className="muted">{t.support.channelGone}</p>
      ) : ticket.messages.length === 0 ? (
        <p className="muted">{t.support.noMessages}</p>
      ) : (
        <ol className="conversation">
          {ticket.messages.map((m) => (
            <MessageItem key={m.id} message={m} names={names} />
          ))}
        </ol>
      )}
      {ticket.status === "open" ? (
        <form className="reply" onSubmit={submit} noValidate>
          {reply.status === "error" ? (
            <Notice
              tone="error"
              title={closedConflict ? t.support.replyClosed : t.support.replyFailed}
            >
              {closedConflict ? null : errorText(t, reply.error)}
            </Notice>
          ) : null}
          <Field
            id={`${id}-reply`}
            label={t.support.reply}
            hint={t.support.replyHint}
            error={touched && invalid ? t.support.replyRule(LIMITS.reply.max) : undefined}
            count={[length, LIMITS.reply.max]}
          >
            {(props) => (
              <textarea
                {...props}
                rows={4}
                value={content}
                maxLength={LIMITS.reply.max}
                onChange={(e) => setContent(e.target.value)}
              />
            )}
          </Field>
          <div className="form__actions">
            <Button type="submit" loading={reply.isPending}>
              {t.support.send}
            </Button>
          </div>
        </form>
      ) : (
        <p className="muted reply-closed">{t.support.closedNoReply}</p>
      )}
    </section>
  );
}

/** Assignment, priority, label, close and reopen. */
function Manage({ ticket, viewer }: { ticket: StaffTicketDetail; viewer: Member }) {
  const t = useT();
  const id = useId();
  const staff = useTicketsQuery("GET /staff");
  const edit = useOptimisticTicket(ticket.id);
  const [error, setError] = useState<unknown>(undefined);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState("");
  const close = useTicketsMutation("POST /tickets/:id/close", {
    onSuccess: () => {
      setClosing(false);
      setReason("");
    },
  });
  const reopen = useTicketsMutation("POST /tickets/:id/reopen");
  const me: Person = {
    id: viewer.me.user.id,
    displayName: viewer.me.member.nick || viewer.me.user.displayName,
  };
  const people = staff.data?.items ?? [];
  // The current assignee stays selectable even if they left the staff list.
  const options =
    ticket.assignee && !people.some((p) => p.id === ticket.assignee?.id)
      ? [...people, ticket.assignee]
      : people;

  const run = (promise: Promise<unknown>) => {
    setError(undefined);
    promise.catch((e: unknown) => setError(e));
  };
  const assign = (userId: string | null) => {
    const person =
      userId === null
        ? null
        : userId === me.id
          ? me
          : (options.find((p) => p.id === userId) ?? null);
    run(
      edit("POST /tickets/:id/assign", { userId: userId === me.id ? "me" : userId }, (d) => ({
        ...d,
        assignee: person,
      })),
    );
  };

  return (
    <section className="panel manage" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="panel__title">
        {t.support.manage}
      </h2>
      {error !== undefined ? (
        <Notice tone="error" title={t.support.updateFailed}>
          {errorText(t, error)}
        </Notice>
      ) : null}
      <div className="field">
        <label htmlFor={`${id}-assignee`} className="field__label">
          {t.tickets.assignee}
        </label>
        <div className="manage__row">
          <select
            id={`${id}-assignee`}
            value={ticket.assignee?.id ?? ""}
            onChange={(e) => assign(e.target.value || null)}
          >
            <option value="">{t.tickets.unassigned}</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === me.id ? t.support.meNamed(p.displayName) : p.displayName}
              </option>
            ))}
          </select>
          {ticket.assignee?.id !== me.id ? (
            <Button variant="secondary" onClick={() => assign(me.id)}>
              {t.support.take}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${id}-priority`} className="field__label">
          {t.tickets.priority}
        </label>
        <select
          id={`${id}-priority`}
          value={ticket.priority}
          onChange={(e) => {
            const priority = e.target.value as Priority;
            run(edit("PATCH /tickets/:id", { priority }, (d) => ({ ...d, priority })));
          }}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {t.tickets.priorities[p]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-label`} className="field__label">
          {t.tickets.label}
        </label>
        <select
          id={`${id}-label`}
          value={ticket.label?.key ?? ""}
          onChange={(e) => {
            const key = e.target.value || null;
            const label = key ? (TICKET_LABELS.find((l) => l.key === key) ?? ticket.label) : null;
            run(edit("PATCH /tickets/:id", { label: key }, (d) => ({ ...d, label })));
          }}
        >
          <option value="">{t.tickets.noLabel}</option>
          {TICKET_LABELS.map((l) => (
            <option key={l.key} value={l.key}>
              {labelOption(l)}
            </option>
          ))}
          {ticket.label && !TICKET_LABELS.some((l) => l.key === ticket.label?.key) ? (
            <option value={ticket.label.key}>{labelOption(ticket.label)}</option>
          ) : null}
        </select>
      </div>

      <div className="manage__state">
        {ticket.status === "closed" ? (
          <>
            {reopen.status === "error" ? (
              <Notice tone="error" title={t.support.reopenFailed}>
                {errorText(t, reopen.error)}
              </Notice>
            ) : null}
            <Button
              variant="secondary"
              block
              loading={reopen.isPending}
              onClick={() => reopen.mutate({ params: { id: ticket.id } })}
            >
              {t.support.reopen}
            </Button>
          </>
        ) : closing ? (
          <form
            className="close-form"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = reason.trim();
              close.mutate({ params: { id: ticket.id }, body: trimmed ? { reason: trimmed } : {} });
            }}
          >
            {close.status === "error" ? (
              <Notice tone="error" title={t.support.closeFailed}>
                {errorText(t, close.error)}
              </Notice>
            ) : null}
            <Field id={`${id}-reason`} label={t.support.reason} hint={t.support.reasonHint}>
              {(props) => (
                <textarea
                  {...props}
                  rows={3}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              )}
            </Field>
            <div className="form__actions">
              <Button type="submit" variant="danger" loading={close.isPending}>
                {t.support.confirmClose}
              </Button>
              <Button variant="ghost" onClick={() => setClosing(false)}>
                {t.cancel}
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="secondary" block onClick={() => setClosing(true)}>
            {t.support.close}
          </Button>
        )}
      </div>
    </section>
  );
}
