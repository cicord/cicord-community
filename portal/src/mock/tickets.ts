/**
 * A fake of the tickets plugin's portal routes (tickets 0.2, plugins/tickets/src/routes.ts of
 * cicord/cicord-plugins): the same shapes, validation and error codes, over an in-memory
 * store. `maxOpenPerMember` is 1, as in bots/cicord/bot.yaml.
 */
import {
  LIMITS,
  PRIORITIES,
  TICKET_LABELS,
  type MyTicket,
  type MyTicketDetail,
  type Person,
  type Priority,
  type StaffTicket,
  type StaffTicketDetail,
  type TicketEvent,
  type TicketMessage,
} from "../tickets/api.ts";
import { bot, members, staff, viewers } from "./data.ts";

const MAX_OPEN_PER_MEMBER = 1;
const SERVER_ID = "1574757803220803697";

/** Everything the plugin stores about a ticket, plus its channel's messages. */
interface TicketRecord extends Omit<StaffTicketDetail, "messages" | "messageCount"> {
  conversation: TicketMessage[];
}

export interface TicketStore {
  tickets: TicketRecord[];
  nextNumber: number;
  nextId: number;
}

export interface Reply {
  status: number;
  body?: unknown;
}

const ago = (now: number, hours: number) => new Date(now - hours * 3_600_000).toISOString();
const ok = (body: unknown, status = 200): Reply => ({ status, body });
const fail = (status: number, code: string, message: string): Reply => ({
  status,
  body: { error: { code, message } },
});
const label = (key: string | null) => TICKET_LABELS.find((l) => l.key === key) ?? null;
const channelUrl = (id: string) => `https://discord.com/channels/${SERVER_ID}/${id}`;

/** A few tickets of the community, some for the member viewer, most for the queue. */
export function seedTickets(now: number = Date.now()): TicketStore {
  const alex = { id: viewers.member.user.id, displayName: viewers.member.user.displayName };
  const [morgan, sam, priya] = staff as [Person, Person, Person];
  const [robin, kai, noor, elif, tomas] = members as [Person, Person, Person, Person, Person];
  let message = 1;
  const msg = (
    author: Person,
    hoursAgo: number,
    content: string,
    isBot = false,
  ): TicketMessage => ({
    id: `m${message++}`,
    author: { ...author, bot: isBot },
    content,
    createdAt: ago(now, hoursAgo),
  });
  const welcome = (who: Person, hoursAgo: number) =>
    msg(
      bot,
      hoursAgo,
      `Hi <@${who.id}>, thanks for reaching out! <@&110001> <@&110002> will be with you shortly.`,
      true,
    );
  const base = (
    n: number,
    author: Person,
    subject: string,
    description: string,
    openedHoursAgo: number,
    extra: Partial<TicketRecord>,
  ): TicketRecord => {
    const channel = `ch${n}`;
    return {
      id: String(n),
      number: n,
      subject,
      description,
      status: "open",
      author,
      createdAt: ago(now, openedHoursAgo),
      closedAt: null,
      channelId: channel,
      channelUrl: channelUrl(channel),
      lastActivityAt: ago(now, openedHoursAgo),
      priority: "normal",
      label: null,
      assignee: null,
      source: "discord",
      closedBy: null,
      closeReason: null,
      summary: null,
      events: [{ type: "opened", at: ago(now, openedHoursAgo), by: author, detail: "discord" }],
      conversation: [welcome(author, openedHoursAgo)],
      ...extra,
    };
  };

  const tickets: TicketRecord[] = [
    base(
      48,
      robin,
      "The bot reverts my channel topic every few minutes",
      "I changed the topic of #my-project from Discord and it keeps going back to the old one. Is that selfHeal?",
      5,
      {
        priority: "normal",
        label: label("question"),
        source: "portal",
        events: [{ type: "opened", at: ago(now, 5), by: robin, detail: "portal" }],
        conversation: [welcome(robin, 5)],
      },
    ),
    base(
      47,
      kai,
      "Spam account DMing invite links",
      "A new account (joined an hour ago) is sending invite links to several members in DMs. Screenshots in the channel.",
      2,
      {
        priority: "urgent",
        label: label("other"),
        assignee: sam,
        lastActivityAt: ago(now, 1.2),
        events: [
          { type: "opened", at: ago(now, 2), by: kai, detail: "discord" },
          { type: "priority", at: ago(now, 1.8), by: sam, detail: "urgent" },
          { type: "assigned", at: ago(now, 1.8), by: sam, detail: sam.displayName },
        ],
        conversation: [
          welcome(kai, 2),
          msg(kai, 1.9, "Three people told me about it already, it's the same message every time."),
          msg(sam, 1.2, "Thanks Kai, I'm on it. Can you send the user ID?"),
        ],
      },
    ),
    base(
      45,
      noor,
      "Docker image fails to start with a Postgres URL",
      "Running ghcr.io/cicord/cicord with CICORD_DATABASE_URL set, the container exits with 'connection refused'. Postgres runs in the same compose file.",
      30,
      {
        priority: "high",
        label: label("self-hosting"),
        assignee: priya,
        lastActivityAt: ago(now, 20),
        events: [
          { type: "opened", at: ago(now, 30), by: noor, detail: "discord" },
          { type: "label", at: ago(now, 29), by: priya, detail: "self-hosting" },
          { type: "assigned", at: ago(now, 29), by: priya, detail: priya.displayName },
          { type: "priority", at: ago(now, 26), by: priya, detail: "high" },
        ],
        conversation: [
          welcome(noor, 30),
          msg(
            priya,
            28,
            "Is the runtime waiting for Postgres to be healthy? A depends_on with condition: service_healthy usually fixes it.",
          ),
          msg(noor, 20, "I added it and it still fails sometimes. Logs attached."),
        ],
      },
    ),
    base(
      44,
      elif,
      "Plugin review for the registry",
      "I published a plugin that posts Steam sales. Could someone review it before I open the registry PR?",
      70,
      {
        priority: "low",
        label: label("plugin"),
        lastActivityAt: ago(now, 66),
        conversation: [
          welcome(elif, 70),
          msg(elif, 66, "Repository: github.com/example/steam-sales"),
        ],
      },
    ),
    base(
      41,
      alex,
      "Changelog ping role does not stick",
      "I picked the Changelog ping role in #welcome but it disappears after a day.",
      24 * 9,
      {
        status: "closed",
        priority: "normal",
        label: label("bug"),
        assignee: morgan,
        closedAt: ago(now, 24 * 8),
        channelUrl: null,
        closedBy: morgan,
        closeReason: "Fixed by the reaction-roles 0.1.1 update.",
        summary: { messages: 4, participants: [alex, morgan] },
        lastActivityAt: ago(now, 24 * 8),
        events: [
          { type: "opened", at: ago(now, 24 * 9), by: alex, detail: "discord" },
          { type: "assigned", at: ago(now, 24 * 9 - 1), by: morgan, detail: morgan.displayName },
          { type: "label", at: ago(now, 24 * 9 - 1), by: morgan, detail: "bug" },
          {
            type: "closed",
            at: ago(now, 24 * 8),
            by: morgan,
            detail: "Fixed by the reaction-roles 0.1.1 update.",
          },
        ],
        conversation: [],
      },
    ),
    base(
      39,
      tomas,
      "Question about the moderation escalation",
      "Do warnings expire after warningDays, or only stop counting for escalation?",
      24 * 15,
      {
        status: "closed",
        label: label("question"),
        assignee: sam,
        closedAt: ago(now, 24 * 14),
        channelUrl: null,
        closedBy: sam,
        closeReason: "Answered.",
        summary: { messages: 3, participants: [tomas, sam] },
        lastActivityAt: ago(now, 24 * 14),
        conversation: [],
      },
    ),
  ];
  return { tickets, nextNumber: 49, nextId: 49 };
}

function mine(t: TicketRecord): MyTicket {
  return {
    id: t.id,
    number: t.number,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    label: t.label,
    assignee: t.assignee ? { displayName: t.assignee.displayName } : null,
    source: t.source,
    createdAt: t.createdAt,
    closedAt: t.closedAt,
    lastActivityAt: t.lastActivityAt,
    channelUrl: t.status === "open" ? t.channelUrl : null,
  };
}

function myDetail(t: TicketRecord): MyTicketDetail {
  return {
    ...mine(t),
    description: t.description,
    // Members see names only, and never the close reason (staff-only).
    events: t.events.map((e) => ({
      type: e.type,
      at: e.at,
      by: { displayName: e.by.displayName },
      ...(e.detail !== undefined && e.type !== "closed" ? { detail: e.detail } : {}),
    })),
  };
}

const counted = (t: TicketRecord) => t.conversation.filter((m) => !m.author.bot).length;

function staffItem(t: TicketRecord): StaffTicket {
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    author: t.author,
    createdAt: t.createdAt,
    closedAt: t.closedAt,
    channelId: t.status === "open" ? t.channelId : null,
    messages: t.summary?.messages ?? counted(t),
    lastActivityAt: t.lastActivityAt,
    number: t.number,
    priority: t.priority,
    label: t.label,
    assignee: t.assignee,
    source: t.source,
  };
}

function staffDetail(t: TicketRecord): StaffTicketDetail {
  const { conversation, ...rest } = t;
  return {
    ...rest,
    channelUrl: t.status === "open" ? t.channelUrl : null,
    messageCount: t.summary?.messages ?? counted(t),
    // The channel of a closed ticket is gone in this fake (as with deleteOnClose).
    messages: t.status === "open" ? conversation.slice(-50) : null,
  };
}

const newestFirst = (a: TicketRecord, b: TicketRecord) => b.number - a.number;

/** Text of `body[field]` within limits, or an `invalid` reply. */
function text(
  body: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): string | Reply {
  const value = body[field];
  if (typeof value !== "string") return fail(400, "invalid", `${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max)
    return fail(400, "invalid", `${field} must be ${min} to ${max} characters`);
  return trimmed;
}

const isReply = (v: unknown): v is Reply => typeof v === "object" && v !== null && "status" in v;

/**
 * Answers one tickets route. `path` is relative to the instance ("/tickets/48"); `viewer` is
 * the signed-in person and whether they are on the support team.
 */
export function ticketsRoute(
  store: TicketStore,
  viewer: { person: Person; staff: boolean },
  method: string,
  path: string,
  query: URLSearchParams,
  body: unknown,
  now: number = Date.now(),
): Reply {
  const at = new Date(now).toISOString();
  const input = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const find = (id: string) => store.tickets.find((t) => t.id === id);
  const event = (t: TicketRecord, e: Omit<TicketEvent, "at" | "by">) => {
    t.events = [...t.events, { ...e, at, by: viewer.person }].slice(-100);
    t.lastActivityAt = at;
  };

  // ── members
  if (method === "GET" && path === "/tickets/mine") {
    const items = store.tickets
      .filter((t) => t.author.id === viewer.person.id)
      .toSorted((a, b) =>
        a.status === b.status ? newestFirst(a, b) : a.status === "open" ? -1 : 1,
      );
    return ok({ items: items.map(mine) });
  }
  let match = /^\/tickets\/mine\/([^/]+)$/.exec(path);
  if (method === "GET" && match) {
    const t = find(decodeURIComponent(match[1]!));
    return t && t.author.id === viewer.person.id
      ? ok(myDetail(t))
      : fail(404, "not_found", "no such ticket");
  }
  if (method === "POST" && path === "/tickets") {
    const subject = text(input, "subject", LIMITS.subject.min, LIMITS.subject.max);
    if (isReply(subject)) return subject;
    const description = text(input, "description", LIMITS.description.min, LIMITS.description.max);
    if (isReply(description)) return description;
    const key = input["label"];
    if (key !== undefined && key !== null && !label(key as string))
      return fail(400, "invalid", `unknown label ${JSON.stringify(key)}`);
    const open = store.tickets.filter(
      (t) => t.author.id === viewer.person.id && t.status === "open",
    );
    if (open.length >= MAX_OPEN_PER_MEMBER)
      return fail(409, "limit", `you already have ${open.length} open ticket(s)`);
    const n = store.nextNumber++;
    const channel = `ch${n}`;
    const ticket: TicketRecord = {
      id: String(store.nextId++),
      number: n,
      subject,
      description,
      status: "open",
      author: viewer.person,
      createdAt: at,
      closedAt: null,
      channelId: channel,
      channelUrl: channelUrl(channel),
      lastActivityAt: at,
      priority: "normal",
      label: label((key as string | null | undefined) ?? null),
      assignee: null,
      source: "portal",
      closedBy: null,
      closeReason: null,
      summary: null,
      events: [{ type: "opened", at, by: viewer.person, detail: "portal" }],
      conversation: [
        {
          id: `m-${n}`,
          author: bot,
          content: `Hi <@${viewer.person.id}>, thanks for reaching out! <@&110001> <@&110002> will be with you shortly.`,
          createdAt: at,
        },
      ],
    };
    store.tickets.push(ticket);
    return ok(mine(ticket), 201);
  }

  // ── staff
  const staffRoute =
    path === "/staff" ||
    path === "/tickets" ||
    /^\/tickets\/[^/]+(\/(assign|close|reopen|messages))?$/.test(path);
  if (!staffRoute) return fail(404, "not_found", `no route ${method} ${path}`);
  if (!viewer.staff) return fail(403, "forbidden", "staff only");

  if (method === "GET" && path === "/staff") return ok({ items: staff });
  if (method === "GET" && path === "/tickets") {
    const status = query.get("status");
    const assignee = query.get("assignee");
    const priority = query.get("priority");
    const labelKey = query.get("label");
    const items = store.tickets
      .filter((t) => !status || t.status === status)
      .filter((t) =>
        !assignee
          ? true
          : assignee === "none"
            ? !t.assignee
            : t.assignee?.id === (assignee === "me" ? viewer.person.id : assignee),
      )
      .filter((t) => !priority || t.priority === priority)
      .filter((t) => !labelKey || (labelKey === "none" ? !t.label : t.label?.key === labelKey))
      .toSorted(newestFirst);
    return ok({ items: items.map(staffItem) });
  }

  match = /^\/tickets\/([^/]+)(?:\/(assign|close|reopen|messages))?$/.exec(path);
  const t = match ? find(decodeURIComponent(match[1]!)) : undefined;
  if (!match || !t) return fail(404, "not_found", "no such ticket");
  const action = match[2];

  if (method === "GET" && !action) return ok(staffDetail(t));
  if (method === "PATCH" && !action) {
    if (input["priority"] !== undefined) {
      if (!PRIORITIES.includes(input["priority"] as Priority))
        return fail(400, "invalid", "priority must be low, normal, high or urgent");
      if (input["priority"] !== t.priority) {
        t.priority = input["priority"] as Priority;
        event(t, { type: "priority", detail: t.priority });
      }
    }
    if (input["label"] !== undefined) {
      const key = input["label"] as string | null;
      if (key !== null && !label(key))
        return fail(400, "invalid", `unknown label ${JSON.stringify(key)}`);
      if (key !== (t.label?.key ?? null)) {
        t.label = label(key);
        event(t, { type: "label", detail: key ?? "none" });
      }
    }
    return ok(staffItem(t));
  }
  if (method === "POST" && action === "assign") {
    const userId = input["userId"];
    if (userId === null) {
      if (t.assignee) {
        t.assignee = null;
        event(t, { type: "unassigned" });
      }
      return ok(staffItem(t));
    }
    const id = userId === "me" ? viewer.person.id : userId;
    const person = staff.find((p) => p.id === id);
    if (!person) return fail(400, "invalid", "userId must be a staff member, me or null");
    if (t.assignee?.id !== person.id) {
      t.assignee = person;
      event(t, { type: "assigned", detail: person.displayName });
    }
    return ok(staffItem(t));
  }
  if (method === "POST" && action === "close") {
    if (t.status === "closed") return fail(409, "closed", "the ticket is already closed");
    const reason = input["reason"] === undefined ? "" : text(input, "reason", 0, LIMITS.reason.max);
    if (isReply(reason)) return reason;
    const participants = [
      ...new Map(
        t.conversation
          .filter((m) => !m.author.bot)
          .map((m) => [m.author.id, { id: m.author.id, displayName: m.author.displayName }]),
      ).values(),
    ];
    t.status = "closed";
    t.closedAt = at;
    t.closedBy = viewer.person;
    t.closeReason = reason || null;
    t.summary = { messages: counted(t), participants };
    event(t, { type: "closed", ...(reason ? { detail: reason } : {}) });
    return ok(staffItem(t));
  }
  if (method === "POST" && action === "reopen") {
    if (t.status === "open") return fail(409, "open", "the ticket is already open");
    t.status = "open";
    t.closedAt = null;
    t.closedBy = null;
    t.closeReason = null;
    t.summary = null;
    t.channelUrl = channelUrl(t.channelId);
    event(t, { type: "reopened" });
    return ok(staffItem(t));
  }
  if (method === "POST" && action === "messages") {
    if (t.status === "closed") return fail(409, "closed", "the ticket is closed");
    const content = text(input, "content", LIMITS.reply.min, LIMITS.reply.max);
    if (isReply(content)) return content;
    const id = `m-${t.number}-${t.conversation.length + 1}`;
    t.conversation = [
      ...t.conversation,
      {
        id,
        author: bot,
        // Posted as an embed (the text and "— name (via portal)" in it), as tickets 0.2 does:
        // the message has no text content.
        content: "",
        createdAt: at,
      },
    ];
    event(t, { type: "replied", detail: id });
    return ok({ id }, 201);
  }
  return fail(404, "not_found", `no route ${method} ${path}`);
}
