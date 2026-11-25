/**
 * The portal routes of the `tickets` plugin (0.2), in ONE place.
 *
 * `TicketsRoutes` is written in the plugin route-contract format (plugin.yaml
 * `spec.routes.types`). Until tickets 0.2 is installed in this repository, the generated
 * `src/cicord-routes.d.ts` still describes the 0.1 routes, so this module types the calls
 * itself on top of `client.plugin(server, bot, instance)`. `useTicketsQuery` and
 * `useTicketsMutation` take the same arguments as `useRouteQuery("tickets", …)` and
 * `useRouteMutation("tickets", …)` from @cicord/react: once `cicord portal typegen` knows
 * the 0.2 contract, delete the types below, import them from the generated file, and replace
 * the two hooks by the SDK ones.
 *
 * The instance is always found by plugin name in `PortalServer.plugins` (never a hard-coded
 * bot or instance key: they belong to the repository).
 */
import {
  resolveRoute,
  type OptionalArg,
  type PortalPlugin,
  type Query,
  type RouteInput,
  type RouteMethod,
  type RouteResponseOf,
} from "@cicord/client";
import {
  cicordKeys,
  useCicord,
  useCicordQuery,
  usePortalPlugin,
  useServerKey,
  type MutationResult,
  type QueryResult,
} from "@cicord/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

// ───────────────────────────────────────────────────────────── contract
// Mirrors plugins/tickets/src/routes.ts of tickets 0.2.0 (cicord/cicord-plugins, 05cdd81), the
// plugin's route contract, with its `Routes` interface named `TicketsRoutes` here.
//
// Errors are `{error: {code, message}}` bodies: 400 `invalid`, 403 `forbidden` (not on the
// support team), 404 `not_found` (no such ticket, or not the viewer's), 409 `limit` (too many
// open tickets), `closed` (the ticket is closed) or `open` (reopening an open ticket).

export type TicketStatus = "open" | "closed";
export type Priority = "low" | "normal" | "high" | "urgent";
/** Where the ticket was opened: the Discord panel or a portal. */
export type TicketSource = "discord" | "portal";

/** A Discord user as the server shows them. */
export interface Person {
  id: string;
  displayName: string;
}

/** A configured label (config `labels`). */
export interface Label {
  key: string;
  name: string;
  emoji: string | null;
}

export type TicketEventType =
  | "opened"
  | "assigned"
  | "unassigned"
  | "priority"
  | "label"
  | "closed"
  | "reopened"
  | "replied";

/**
 * One entry of a ticket's timeline (the last 100 are kept). `detail`: the source for
 * `opened`, the assignee's name for `assigned`, the new priority for `priority`, the new label
 * key (or `none`) for `label`, the reason for `closed`, the message id for `replied`.
 */
export interface TicketEvent {
  type: TicketEventType;
  at: string;
  by: Person;
  detail?: string;
}

/** A timeline entry as the member sees it: names only, no close reason (staff-only). */
export interface MyTicketEvent {
  type: TicketEventType;
  at: string;
  by: { displayName: string };
  detail?: string;
}

/** One of the viewer's own tickets. */
export interface MyTicket {
  id: string;
  number: number;
  subject: string;
  status: TicketStatus;
  priority: Priority;
  label: Label | null;
  /** Name only. */
  assignee: { displayName: string } | null;
  source: TicketSource;
  createdAt: string;
  closedAt: string | null;
  lastActivityAt: string | null;
  /** https://discord.com/channels/<server>/<channel> while the ticket is open. */
  channelUrl: string | null;
}

export interface MyTicketDetail extends MyTicket {
  description: string;
  events: MyTicketEvent[];
}

/** One item of `GET /tickets` (the 0.1 fields, then the 0.2 ones). */
export interface StaffTicket {
  id: string;
  subject: string;
  status: TicketStatus;
  author: Person;
  createdAt: string;
  closedAt: string | null;
  /** The ticket channel while the ticket is open. */
  channelId: string | null;
  /** Messages written in the ticket (members and staff, not bots). */
  messages: number;
  lastActivityAt: string | null;
  number: number;
  priority: Priority;
  label: Label | null;
  assignee: Person | null;
  source: TicketSource;
}

/** A message of the ticket channel, read from Discord at request time (never stored). */
export interface TicketMessage {
  id: string;
  author: Person & { bot: boolean };
  content: string;
  createdAt: string;
}

export interface StaffTicketDetail extends Omit<StaffTicket, "messages" | "channelId"> {
  description: string;
  /** Last channel of the ticket, also once closed (0.1 field). */
  channelId: string;
  /** https://discord.com/channels/<server>/<channel> while the ticket is open. */
  channelUrl: string | null;
  closedBy: Person | null;
  closeReason: string | null;
  /** Filled when the ticket is closed. */
  summary: { messages: number; participants: Person[] } | null;
  /** What `StaffTicket.messages` counts. */
  messageCount: number;
  events: TicketEvent[];
  /**
   * The last 50 messages of the ticket channel, oldest first; null when the channel is gone
   * (closed ticket) or cannot be read.
   */
  messages: TicketMessage[] | null;
}

export interface TicketsRoutes {
  // ── members (their own tickets only)

  /** The viewer's tickets: open ones first, newest first. */
  "GET /tickets/mine": { response: { items: MyTicket[] } };
  /** One of the viewer's tickets; 404 for anyone else's. */
  "GET /tickets/mine/:id": { response: MyTicketDetail };
  /**
   * Opens a ticket like the Discord panel does (private channel, welcome message). Answers
   * 201. 409 `limit` when the member already has `maxOpenPerMember` open tickets.
   */
  "POST /tickets": {
    body: { subject: string; description: string; label?: string | null };
    response: MyTicket;
  };

  // ── staff (a staff role, the server owner or a Cicord admin)

  /** Tickets, newest first. `assignee`: a user id, `me` or `none`; `label`: a key or `none`. */
  "GET /tickets": {
    query: { status?: TicketStatus; assignee?: string; priority?: Priority; label?: string };
    response: { items: StaffTicket[] };
  };
  "GET /tickets/:id": { response: StaffTicketDetail };
  /**
   * Who can be assigned, by display name: the holders of the staff roles (bots excluded),
   * the server owner and the viewer.
   */
  "GET /staff": { response: { items: Person[] } };
  /** `userId`: a staff member's id, `me`, or null to unassign. */
  "POST /tickets/:id/assign": { body: { userId: string | null }; response: StaffTicket };
  "PATCH /tickets/:id": {
    body: { priority?: Priority; label?: string | null };
    response: StaffTicket;
  };
  /** Same as the Close button; the reason goes to the staff log. 409 `closed`. */
  "POST /tickets/:id/close": { body: { reason?: string }; response: StaffTicket };
  /** Recreates the channel when it was removed on close. 409 `open`. */
  "POST /tickets/:id/reopen": { response: StaffTicket };
  /** Posts in the ticket channel, signed with the viewer's name. Answers 201. 409 `closed`. */
  "POST /tickets/:id/messages": { body: { content: string }; response: { id: string } };
}

/** The queue filters of `GET /tickets`. */
export type StaffTicketQuery = TicketsRoutes["GET /tickets"]["query"];

/** Limits enforced by the plugin, checked here too for immediate feedback. */
export const LIMITS = {
  subject: { min: 3, max: 100 },
  description: { min: 10, max: 1000 },
  reply: { min: 1, max: 2000 },
  reason: { max: 500 },
} as const;

export const PRIORITIES: readonly Priority[] = ["low", "normal", "high", "urgent"];

/**
 * The labels members and staff pick from (tickets config `labels`; these are the plugin's
 * defaults, which bots/cicord/bot.yaml keeps). The plugin returns a ticket's label as an
 * object, so only the pickers need this list; it goes once the plugin serves its labels.
 */
export const TICKET_LABELS: readonly Label[] = [
  { key: "question", name: "Question", emoji: "❓" },
  { key: "bug", name: "Bug", emoji: "🐛" },
  { key: "self-hosting", name: "Self-hosting", emoji: "🖥️" },
  { key: "plugin", name: "Plugin", emoji: "🧩" },
  { key: "other", name: "Other", emoji: null },
];

/** The first route that tells a tickets instance speaks the 0.2 member contract. */
export const MEMBER_ROUTE = "GET /tickets/mine";
/** Only 0.2 serves the staff list: the queue is not offered against 0.1. */
export const STAFF_ROUTE = "GET /staff";

// ───────────────────────────────────────────────────────────── typed calls

type RouteKey = keyof TicketsRoutes;
type KeyOf<M extends RouteMethod> = Extract<RouteKey, `${M} /${string}`>;
type Input<K extends RouteKey> = RouteInput<K, TicketsRoutes[K]>;
export type TicketsResponse<K extends RouteKey> = RouteResponseOf<TicketsRoutes[K]>;

interface LooseInput {
  params?: Record<string, string>;
  query?: object;
  body?: unknown;
  enabled?: boolean;
}

/** The tickets instance of the server (by plugin name), when it serves `route`. */
export function useTicketsPlugin(route: string): PortalPlugin | undefined {
  const { instance } = usePortalPlugin("tickets");
  return instance?.routes.includes(route) ? instance : undefined;
}

/** Cache key of a tickets route: the SDK's plugin key, so its prefix invalidation applies. */
function ticketsKey(
  server: string,
  plugin: PortalPlugin,
  path: string,
  query?: Query,
): ReturnType<typeof cicordKeys.plugin> {
  return cicordKeys.plugin(server, plugin.bot, plugin.instance, path, query);
}

/** Drops unset filters, so `{status: undefined}` and `{}` share a cache entry. */
function compact(query: object | undefined): Query | undefined {
  if (!query) return undefined;
  const entries = Object.entries(query).filter(([, v]) => v !== undefined && v !== "");
  return entries.length > 0 ? Object.fromEntries<Query[string]>(entries) : undefined;
}

/**
 * `GET` on a tickets route, cached (same signature as `useRouteQuery("tickets", route, …)`).
 * Idle while the server loads or when the plugin does not serve the route.
 */
export function useTicketsQuery<K extends KeyOf<"GET">>(
  route: K,
  ...options: OptionalArg<Input<K> & { enabled?: boolean }>
): QueryResult<TicketsResponse<K>> {
  const opts = (options[0] ?? {}) as LooseInput;
  const { client } = useCicord();
  const plugin = useTicketsPlugin(route);
  const server = useServerKey();
  // A parameter taken from the page URL ("..") is an error state, never a request.
  let path: string | undefined;
  let invalid: unknown;
  try {
    [, path] = resolveRoute(route, opts.params);
  } catch (error) {
    invalid = error;
  }
  const query = compact(opts.query);
  const key =
    plugin && server
      ? ticketsKey(server, plugin, path ?? `${route} ${JSON.stringify(opts.params ?? {})}`, query)
      : null;
  return useCicordQuery<TicketsResponse<K>>(
    key,
    (signal) =>
      invalid !== undefined || path === undefined || !plugin || !server
        ? Promise.reject(invalid ?? new Error("tickets: route unavailable"))
        : client
            .plugin(server, plugin.bot, plugin.instance)
            .get<TicketsResponse<K>>(path, query, { signal }),
    opts.enabled === undefined ? {} : { enabled: opts.enabled },
  );
}

/**
 * `POST`/`PATCH` on a tickets route (same signature as `useRouteMutation("tickets", …)`).
 * On success, every cached query of the instance is refetched.
 */
export function useTicketsMutation<K extends KeyOf<Exclude<RouteMethod, "GET">>>(
  route: K,
  options: { onSuccess?: (result: TicketsResponse<K>) => void } = {},
): MutationResult<Input<K>, TicketsResponse<K>> {
  type T = TicketsResponse<K>;
  const { client, cache } = useCicord();
  const plugin = useTicketsPlugin(route);
  const server = useServerKey();
  const [state, setState] = useState<{
    status: MutationResult<Input<K>, T>["status"];
    data: T | undefined;
    error: unknown;
  }>({
    status: "idle",
    data: undefined,
    error: undefined,
  });
  const onSuccess = useRef(options.onSuccess);
  useLayoutEffect(() => {
    onSuccess.current = options.onSuccess;
  });

  const mutateAsync = useCallback(
    async (input: Input<K>): Promise<T> => {
      if (!plugin || !server) throw new Error(`tickets: ${route} is not available on this server`);
      const { params, body } = input as LooseInput;
      setState({ status: "pending", data: undefined, error: undefined });
      try {
        const [method, path] = resolveRoute(route, params);
        const result = await client
          .plugin(server, plugin.bot, plugin.instance)
          .request<T>(method, path, body === undefined ? {} : { body });
        setState({ status: "success", data: result, error: undefined });
        void cache.invalidate(["cicord", "plugin", server, plugin.bot, plugin.instance]);
        onSuccess.current?.(result);
        return result;
      } catch (error) {
        setState({ status: "error", data: undefined, error });
        throw error;
      }
    },
    [client, cache, server, plugin, route],
  );

  return {
    ...state,
    isPending: state.status === "pending",
    mutateAsync,
    mutate: useCallback(
      (input: Input<K>) => void mutateAsync(input).catch(() => undefined),
      [mutateAsync],
    ),
    reset: useCallback(() => setState({ status: "idle", data: undefined, error: undefined }), []),
  };
}

/**
 * Optimistic edits of a staff ticket (assign, priority, label): the cached detail is patched
 * at once, the request is sent, then the detail is merged with the ticket the plugin returns
 * (keeping the conversation and the timeline, which it does not send) and every query of the
 * instance is refetched. On error the previous detail is restored and the error rethrown.
 */
export function useOptimisticTicket(id: string) {
  const { client, cache } = useCicord();
  const plugin = useTicketsPlugin("GET /tickets/:id");
  const server = useServerKey();
  return useCallback(
    async <K extends "POST /tickets/:id/assign" | "PATCH /tickets/:id">(
      route: K,
      body: TicketsRoutes[K]["body"],
      patch: (ticket: StaffTicketDetail) => StaffTicketDetail,
    ): Promise<StaffTicket> => {
      if (!plugin || !server) throw new Error(`tickets: ${route} is not available on this server`);
      const [, detailPath] = resolveRoute("GET /tickets/:id", { id });
      const key = ticketsKey(server, plugin, detailPath);
      const before = cache.getState<StaffTicketDetail>(key).data;
      if (before) cache.setData(key, patch(before));
      try {
        const [method, path] = resolveRoute(route, { id });
        const ticket = await client
          .plugin(server, plugin.bot, plugin.instance)
          .request<StaffTicket>(method, path, { body });
        // `messages` (a count here, the conversation in the detail) and `channelId` (null once
        // closed here, the last channel in the detail) do not mean the same in both shapes.
        const { messages, channelId: _channel, ...fields } = ticket;
        cache.setData<StaffTicketDetail | undefined>(key, (current) =>
          current ? { ...current, ...fields, messageCount: messages } : current,
        );
        return ticket;
      } catch (error) {
        if (before) cache.setData(key, before);
        throw error;
      } finally {
        void cache.invalidate(["cicord", "plugin", server, plugin.bot, plugin.instance]);
      }
    },
    [client, cache, plugin, server, id],
  );
}
