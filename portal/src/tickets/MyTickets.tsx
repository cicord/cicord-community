/**
 * The member side of the tickets plugin: my tickets (`GET /tickets/mine`), one of them
 * (`GET /tickets/mine/:id`) and opening a new one from the portal (`POST /tickets`).
 */
import { isCicordApiError, isSafeUrl } from "@cicord/client";
import { Button, LinkButton, Notice } from "@cicord/ui";
import { useId, useState, type FormEvent } from "react";
import { useFormat } from "../format.ts";
import { useT } from "../i18n/index.tsx";
import { PageLoading, RequireMember, useDocumentTitle } from "../portal.tsx";
import { Link, navigate } from "../router.tsx";
import {
  LIMITS,
  TICKET_LABELS,
  useTicketsMutation,
  useTicketsQuery,
  type MyTicket,
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

export function MyTickets() {
  const t = useT();
  useDocumentTitle(t.tickets.mineTitle);
  return <RequireMember title={t.tickets.mineTitle}>{() => <MyTicketList />}</RequireMember>;
}

function MyTicketList() {
  const t = useT();
  const list = useTicketsQuery("GET /tickets/mine");
  const items = list.data?.items ?? [];
  const open = items.filter((i) => i.status === "open");
  const closed = items.filter((i) => i.status === "closed");

  return (
    <div className="page">
      <header className="page__header page__header--actions">
        <div>
          <h1>{t.tickets.mineTitle}</h1>
          <p>{t.tickets.mineLead}</p>
        </div>
        <Link to="/tickets/new" className="cicord-button cicord-button--primary cicord-button--md">
          <span className="cicord-button__label">{t.tickets.newButton}</span>
        </Link>
      </header>
      {list.status === "error" ? (
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
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h2>{t.tickets.mineEmptyTitle}</h2>
          <p>{t.tickets.mineEmptyText}</p>
        </div>
      ) : (
        <>
          <TicketSection title={t.tickets.openSection} tickets={open} empty={t.tickets.noOpen} />
          {closed.length > 0 ? (
            <TicketSection title={t.tickets.closedSection} tickets={closed} />
          ) : null}
        </>
      )}
    </div>
  );
}

function TicketSection({
  title,
  tickets,
  empty,
}: {
  title: string;
  tickets: MyTicket[];
  empty?: string;
}) {
  const id = useId();
  return (
    <section className="ticket-section" aria-labelledby={id}>
      <h2 id={id} className="section-title">
        {title} <span className="section-title__count">{tickets.length}</span>
      </h2>
      {tickets.length === 0 && empty ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="ticket-list">
          {tickets.map((ticket) => (
            <MyTicketRow key={ticket.id} ticket={ticket} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MyTicketRow({ ticket }: { ticket: MyTicket }) {
  const t = useT();
  const f = useFormat();
  return (
    <li className="ticket-row">
      <Link to={`/tickets/${encodeURIComponent(ticket.id)}`} className="ticket-row__link">
        <span className="ticket-row__id">#{ticket.number}</span>
        <span className="ticket-row__main">
          <span className="ticket-row__subject">{ticket.subject}</span>
          <span className="ticket-row__meta">
            {ticket.status === "open"
              ? t.tickets.openedOn(f.relative(ticket.createdAt))
              : t.tickets.closedOn(f.relative(ticket.closedAt ?? ticket.createdAt))}
            <span aria-hidden="true"> · </span>
            {ticket.assignee ? t.tickets.handledBy(ticket.assignee.displayName) : t.tickets.waiting}
          </span>
        </span>
        <span className="ticket-row__tags">
          <LabelTag label={ticket.label} />
          {ticket.priority !== "normal" ? <PriorityBadge priority={ticket.priority} /> : null}
          <StatusBadge status={ticket.status} />
        </span>
      </Link>
    </li>
  );
}

// ───────────────────────────────────────────────────────────── one ticket

export function MyTicketView({ id }: { id: string }) {
  const t = useT();
  return (
    <RequireMember title={t.tickets.mineTitle}>
      {() => <MyTicketDetailView id={id} />}
    </RequireMember>
  );
}

function MyTicketDetailView({ id }: { id: string }) {
  const t = useT();
  const f = useFormat();
  const ticket = useTicketsQuery("GET /tickets/mine/:id", { params: { id } });
  const d = ticket.data;
  useDocumentTitle(d ? `#${d.number} ${d.subject}` : t.tickets.mineTitle);

  if (ticket.status === "error")
    return (
      <div className="page">
        <BackLink to="/tickets" label={t.tickets.backToMine} />
        <Notice
          tone="error"
          title={
            isCicordApiError(ticket.error, "not_found") ? t.tickets.notFound : t.tickets.loadFailed
          }
        >
          {isCicordApiError(ticket.error, "not_found") ? null : errorText(t, ticket.error)}
        </Notice>
      </div>
    );
  if (!d) return <PageLoading />;

  const channel =
    d.status === "open" && d.channelUrl && isSafeUrl(d.channelUrl) ? d.channelUrl : null;
  return (
    <div className="page ticket-page">
      <BackLink to="/tickets" label={t.tickets.backToMine} />
      <header className="ticket-page__header">
        <p className="ticket-page__id">
          #{d.number} <StatusBadge status={d.status} />
        </p>
        <h1>{d.subject}</h1>
      </header>
      {channel ? (
        <Notice
          tone="info"
          title={t.tickets.channelTitle}
          action={
            <LinkButton href={channel} target="_blank" rel="noopener noreferrer" size="sm">
              {t.tickets.openInDiscord}
            </LinkButton>
          }
        >
          {t.tickets.channelText}
        </Notice>
      ) : null}
      <div className="ticket-page__grid">
        <div className="ticket-page__main">
          <section className="panel" aria-labelledby="ticket-description">
            <h2 id="ticket-description" className="panel__title">
              {t.tickets.description}
            </h2>
            <p className="ticket-description">{d.description}</p>
          </section>
          <section className="panel" aria-labelledby="ticket-timeline">
            <h2 id="ticket-timeline" className="panel__title">
              {t.tickets.timeline}
            </h2>
            <Timeline events={d.events} />
          </section>
        </div>
        <aside className="panel ticket-page__side" aria-label={t.tickets.details}>
          <Facts
            items={[
              [t.tickets.statusLabel, <StatusBadge key="s" status={d.status} />],
              [t.tickets.priority, t.tickets.priorities[d.priority]],
              [t.tickets.label, d.label ? <LabelTag key="l" label={d.label} /> : t.tickets.noLabel],
              [t.tickets.assignee, d.assignee?.displayName ?? t.tickets.unassigned],
              [t.tickets.opened, f.dateTime(d.createdAt)],
              ...(d.closedAt
                ? ([[t.tickets.closed, f.dateTime(d.closedAt)]] as [string, string][])
                : []),
              [t.tickets.source, t.tickets.sources[d.source]],
            ]}
          />
        </aside>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────── new ticket

export function NewTicket() {
  const t = useT();
  useDocumentTitle(t.tickets.newTitle);
  return <RequireMember title={t.tickets.newTitle}>{() => <NewTicketForm />}</RequireMember>;
}

interface Problems {
  subject?: string;
  description?: string;
}

function validate(t: ReturnType<typeof useT>, subject: string, description: string): Problems {
  const problems: Problems = {};
  const s = subject.trim().length;
  const d = description.trim().length;
  if (s < LIMITS.subject.min || s > LIMITS.subject.max)
    problems.subject = t.tickets.subjectRule(LIMITS.subject.min, LIMITS.subject.max);
  if (d < LIMITS.description.min || d > LIMITS.description.max)
    problems.description = t.tickets.descriptionRule(
      LIMITS.description.min,
      LIMITS.description.max,
    );
  return problems;
}

function NewTicketForm() {
  const t = useT();
  const id = useId();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [label, setLabel] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const create = useTicketsMutation("POST /tickets", {
    onSuccess: (ticket) => navigate(`/tickets/${encodeURIComponent(ticket.id)}`),
  });
  const problems = validate(t, subject, description);
  const show = (field: keyof Problems) => (submitted ? problems[field] : undefined);
  const limit = isCicordApiError(create.error, "limit");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(problems).length > 0) {
      document.getElementById(`${id}-${problems.subject ? "subject" : "description"}`)?.focus();
      return;
    }
    create.mutate({
      body: {
        subject: subject.trim(),
        description: description.trim(),
        ...(label ? { label } : {}),
      },
    });
  };

  return (
    <div className="page page--narrow">
      <BackLink to="/tickets" label={t.tickets.backToMine} />
      <header className="page__header">
        <h1>{t.tickets.newTitle}</h1>
        <p>{t.tickets.newLead}</p>
      </header>
      {limit ? (
        <Notice
          tone="error"
          title={t.tickets.limitTitle}
          action={
            <Link
              to="/tickets"
              className="cicord-button cicord-button--secondary cicord-button--sm"
            >
              <span className="cicord-button__label">{t.tickets.limitAction}</span>
            </Link>
          }
        >
          {t.tickets.limitText}
        </Notice>
      ) : create.status === "error" ? (
        <Notice tone="error" title={t.tickets.createFailed}>
          {errorText(t, create.error)}
        </Notice>
      ) : null}
      <form className="form panel" onSubmit={submit} noValidate>
        <Field
          id={`${id}-subject`}
          label={t.tickets.subject}
          hint={t.tickets.subjectHint}
          error={show("subject")}
          count={[subject.trim().length, LIMITS.subject.max]}
        >
          {(props) => (
            <input
              {...props}
              type="text"
              value={subject}
              maxLength={LIMITS.subject.max}
              autoComplete="off"
              required
              onChange={(e) => setSubject(e.target.value)}
            />
          )}
        </Field>
        <Field
          id={`${id}-description`}
          label={t.tickets.description}
          hint={t.tickets.descriptionHint}
          error={show("description")}
          count={[description.trim().length, LIMITS.description.max]}
        >
          {(props) => (
            <textarea
              {...props}
              rows={7}
              value={description}
              maxLength={LIMITS.description.max}
              required
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        <Field id={`${id}-label`} label={t.tickets.labelOptional}>
          {(props) => (
            <select {...props} value={label} onChange={(e) => setLabel(e.target.value)}>
              <option value="">{t.tickets.noLabel}</option>
              {TICKET_LABELS.map((l) => (
                <option key={l.key} value={l.key}>
                  {labelOption(l)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <p className="form__privacy">{t.tickets.privacy}</p>
        <div className="form__actions">
          <Button type="submit" loading={create.isPending}>
            {t.tickets.submit}
          </Button>
          <Link to="/tickets" className="cicord-button cicord-button--ghost cicord-button--md">
            <span className="cicord-button__label">{t.cancel}</span>
          </Link>
        </div>
      </form>
    </div>
  );
}
