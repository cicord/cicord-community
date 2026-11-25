/** Pieces shared by the member and staff ticket pages. */
import { CicordApiError } from "@cicord/client";
import type { ReactNode } from "react";
import { Link } from "../router.tsx";
import { useFormat } from "../format.ts";
import { useT, type Messages } from "../i18n/index.tsx";
import {
  TICKET_LABELS,
  type Label,
  type MyTicketEvent,
  type Priority,
  type TicketStatus,
} from "./api.ts";

export function StatusBadge({ status }: { status: TicketStatus }) {
  const t = useT();
  return <span className={`badge badge--${status}`}>{t.tickets.status[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const t = useT();
  // "normal" is the default: only the others are worth a badge in lists.
  return (
    <span className={`badge badge--priority badge--${priority}`}>
      <span className="visually-hidden">{t.tickets.priority}: </span>
      {t.tickets.priorities[priority]}
    </span>
  );
}

/** The name of a label key (events and pickers carry keys); unknown keys are shown as is. */
function labelName(t: Messages, key: string): string {
  if (key === "none") return t.tickets.noLabel;
  return TICKET_LABELS.find((l) => l.key === key)?.name ?? key;
}

/** "❓ Question": a label for a picker option. */
export function labelOption(label: Label): string {
  return label.emoji ? `${label.emoji} ${label.name}` : label.name;
}

export function LabelTag({ label }: { label: Label | null }) {
  const t = useT();
  if (!label) return null;
  return (
    <span className="label-tag">
      <span className="visually-hidden">{t.tickets.label}: </span>
      {label.emoji ? <span aria-hidden="true">{label.emoji}</span> : null}
      {label.name}
    </span>
  );
}

/** The ticket's history, oldest first. */
export function Timeline({ events }: { events: readonly MyTicketEvent[] }) {
  const t = useT();
  const f = useFormat();
  if (events.length === 0) return <p className="muted">{t.tickets.noEvents}</p>;
  return (
    <ol className="timeline">
      {events.map((event) => (
        <li
          key={`${event.at}-${event.type}-${event.by.displayName}-${event.detail ?? ""}`}
          className={`timeline__item timeline__item--${event.type}`}
        >
          <span className="timeline__dot" aria-hidden="true" />
          <span className="timeline__text">
            {t.tickets.event(event.type, event.by.displayName, eventDetail(t, event))}
          </span>
          <time className="timeline__time" dateTime={event.at} title={f.dateTime(event.at)}>
            {f.relative(event.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}

/** Priorities and labels are keys in events: show their names. */
function eventDetail(t: Messages, event: MyTicketEvent): string | undefined {
  if (!event.detail) return undefined;
  if (event.type === "priority" && event.detail in t.tickets.priorities)
    return t.tickets.priorities[event.detail as Priority];
  if (event.type === "label") return labelName(t, event.detail);
  return event.detail;
}

/** A definition list of a ticket's facts. */
export function Facts({ items }: { items: readonly [string, ReactNode][] }) {
  return (
    <dl className="facts">
      {items.map(([term, value]) => (
        <div key={term} className="facts__row">
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A readable message for a failed call (the runtime's or the plugin's message). */
export function errorText(t: Messages, error: unknown): string {
  if (error instanceof CicordApiError) {
    if (error.code === "network") return t.errors.network;
    if (error.code === "unauthenticated") return t.errors.signedOut;
    if (error.code === "forbidden") return t.errors.forbidden;
    if (error.code === "not_found") return t.errors.notFound;
    if (error.code === "closed") return t.errors.closed;
    if (error.code === "open") return t.errors.alreadyOpen;
    return error.message || t.errors.generic;
  }
  return t.errors.generic;
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="back-link">
      <span aria-hidden="true">←</span> {label}
    </Link>
  );
}

interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

/** A labelled form control with its hint, live character count and error. */
export function Field({
  id,
  label,
  hint,
  error,
  count,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | undefined;
  count?: [number, number];
  children: (props: FieldControlProps) => ReactNode;
}) {
  const t = useT();
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={error ? "field field--error" : "field"}>
      <div className="field__head">
        <label htmlFor={id} className="field__label">
          {label}
        </label>
        {count ? (
          <span className={count[0] > count[1] ? "field__count is-over" : "field__count"}>
            {t.charCount(count[0], count[1])}
          </span>
        ) : null}
      </div>
      {children({
        id,
        ...(described ? { "aria-describedby": described } : {}),
        ...(error ? { "aria-invalid": true as const } : {}),
      })}
      {hint ? (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
