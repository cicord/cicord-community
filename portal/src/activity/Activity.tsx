import {
  CicordApiError,
  type AnalyticsKpi,
  type PortalAnalytics,
  type PortalAnalyticsPeriod,
} from "@cicord/client";
import { usePortalAnalytics } from "@cicord/react";
import { Button, Notice } from "@cicord/ui";
import { useMemo } from "react";
import { useFormat, type Formatters } from "../format.ts";
import { useT, type Messages } from "../i18n/index.tsx";
import { PageLoading, SignIn, useDocumentTitle, useViewer } from "../portal.tsx";
import { setSearch, useSearch } from "../router.tsx";
import { DailyChart, Heatmap, RankedList, Sparkline } from "./charts.tsx";
import {
  delta,
  findKpi,
  formatOffset,
  peak,
  shiftHeatmap,
  viewerOffsetMinutes,
  type Metric,
} from "./data.ts";

const PERIODS: readonly PortalAnalyticsPeriod[] = ["7d", "30d", "90d"];

function usePeriod(): PortalAnalyticsPeriod {
  const value = new URLSearchParams(useSearch()).get("period");
  return PERIODS.find((p) => p === value) ?? "30d";
}

/**
 * Server-wide activity (`usePortalAnalytics`, `GET /portal/{server}/analytics`), when the
 * server shares it (`spec.analytics.portal`: members or public). Aggregates only: nothing
 * about any one member, and only channels everyone can see are named.
 */
export function Activity() {
  const t = useT();
  const period = usePeriod();
  const analytics = usePortalAnalytics(period);
  useDocumentTitle(t.activity.title);

  const pick = (p: PortalAnalyticsPeriod) => {
    const params = new URLSearchParams(window.location.search);
    if (p === "30d") params.delete("period");
    else params.set("period", p);
    setSearch(params);
  };

  const error = analytics.error instanceof CicordApiError ? analytics.error : undefined;
  // Keep showing the previous period while the next one loads (no flash of a spinner).
  const data = analytics.data;

  return (
    <div className="page page--wide activity">
      <header className="page__header activity__header">
        <div>
          <h1>{t.activity.title}</h1>
          <p>{t.activity.lead}</p>
        </div>
        <fieldset className="segmented">
          <legend className="visually-hidden">{t.activity.period}</legend>
          {PERIODS.map((p) => (
            <label key={p} className="segmented__item">
              <input
                type="radio"
                name="period"
                value={p}
                checked={period === p}
                onChange={() => pick(p)}
              />
              <span>{t.activity.periods[p]}</span>
            </label>
          ))}
        </fieldset>
      </header>

      {analytics.status === "error" && !data ? (
        <ActivityError error={error} retry={() => void analytics.refetch()} />
      ) : !data ? (
        <PageLoading />
      ) : data.since === null ? (
        <div className="empty-state">
          <h2>{t.activity.nothingTitle}</h2>
          <p>{t.activity.nothingText}</p>
        </div>
      ) : (
        <Dashboard data={data} busy={analytics.isFetching} />
      )}
    </div>
  );
}

function ActivityError({ error, retry }: { error: CicordApiError | undefined; retry: () => void }) {
  const t = useT();
  const viewer = useViewer();
  if (error?.code === "not_found")
    return (
      <div className="empty-state">
        <h2>{t.activity.notSharedTitle}</h2>
        <p>{t.activity.notSharedText}</p>
        {viewer.status === "member" && viewer.staff ? (
          <p className="empty-state__hint">{t.activity.notSharedHint}</p>
        ) : null}
      </div>
    );
  if (error?.code === "unauthenticated")
    return (
      <div className="empty-state">
        <h2>{t.activity.membersOnlyTitle}</h2>
        <p>{t.activity.membersOnlyText}</p>
        <SignIn />
      </div>
    );
  if (error?.code === "forbidden")
    return (
      <div className="empty-state">
        <h2>{t.activity.membersOnlyTitle}</h2>
        <Notice tone="info">{t.gate.notMember}</Notice>
      </div>
    );
  return (
    <Notice
      tone="error"
      title={t.activity.failed}
      action={
        <Button size="sm" variant="secondary" onClick={retry}>
          {t.retry}
        </Button>
      }
    />
  );
}

interface KpiSpec {
  metric: Metric;
  label: (m: Messages) => string;
  value: (k: AnalyticsKpi, f: Formatters) => string;
  hint?: (m: Messages) => string;
}

const KPIS: readonly KpiSpec[] = [
  {
    metric: "members.total",
    label: (m) => m.activity.kpi.members,
    value: (k, f) => f.number(k.value),
  },
  {
    metric: "members.joined",
    label: (m) => m.activity.kpi.joined,
    value: (k, f) => f.number(k.value),
  },
  {
    metric: "members.active",
    label: (m) => m.activity.kpi.active,
    value: (k, f) => f.number(Math.round(k.value)),
    hint: (m) => m.activity.perDay,
  },
  {
    metric: "messages.sent",
    label: (m) => m.activity.kpi.messages,
    value: (k, f) => f.number(k.value),
  },
  {
    metric: "voice.seconds",
    label: (m) => m.activity.kpi.voice,
    value: (k, f) => f.hours(k.value),
  },
  {
    metric: "reactions.added",
    label: (m) => m.activity.kpi.reactions,
    value: (k, f) => f.number(k.value),
  },
  {
    metric: "bots.commands",
    label: (m) => m.activity.kpi.commands,
    value: (k, f) => f.number(k.value),
  },
  {
    metric: "members.active.bots",
    label: (m) => m.activity.kpi.botUsers,
    value: (k, f) => f.number(Math.round(k.value)),
    hint: (m) => m.activity.perDay,
  },
];

function Dashboard({ data, busy }: { data: PortalAnalytics; busy: boolean }) {
  const t = useT();
  const f = useFormat();
  const offset = viewerOffsetMinutes();
  const grid = useMemo(() => shiftHeatmap(data.heatmap, offset), [data.heatmap, offset]);
  const busiest = peak(grid);
  const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  const messages = findKpi(data, "messages.sent");
  const active = findKpi(data, "members.active");
  // Whole UTC days, labelled in UTC; `to` is the exclusive end (tomorrow 00:00 UTC).
  const from = f.day(Date.parse(data.from) / 1000);
  const to = f.day((Date.parse(data.to) - 1) / 1000);
  const partial = Date.parse(data.since ?? data.from) > Date.parse(data.from);

  return (
    <div className="dashboard" aria-busy={busy || undefined}>
      <p className="dashboard__range">
        {t.activity.range(from, to)}
        {partial && data.since
          ? ` ${t.activity.since(f.day(Date.parse(data.since) / 1000))}`
          : null}
      </p>

      <ul className="kpis" aria-label={t.activity.kpisLabel}>
        {KPIS.map((spec) => {
          const kpi = findKpi(data, spec.metric);
          return kpi ? (
            <KpiCard key={spec.metric} spec={spec} kpi={kpi} period={data.period} />
          ) : null;
        })}
      </ul>

      <div className="dashboard__charts">
        {messages ? (
          <DailyChart
            title={t.activity.messagesPerDay}
            points={messages.spark}
            kind="bars"
            describe={(v) => t.activity.messagesCount(f.number(v))}
          />
        ) : null}
        {active ? (
          <DailyChart
            title={t.activity.activePerDay}
            points={active.spark}
            kind="line"
            describe={(v) => t.activity.membersCount(f.number(Math.round(v)))}
            note={t.activity.activeNote}
          />
        ) : null}
      </div>

      <div className="dashboard__rankings">
        <RankedList
          title={t.activity.channels}
          items={data.topChannels.map((c) => ({ key: c.id, label: `#${c.name}`, value: c.value }))}
          describe={(v) => t.activity.messagesCount(f.number(v))}
          empty={t.activity.channelsEmpty}
        />
        <RankedList
          title={t.activity.commands}
          items={data.topBotCommands.map((c) => ({
            key: `${c.bot} ${c.command}`,
            label: <code>{c.command}</code>,
            sub: c.bot,
            value: c.value,
          }))}
          describe={(v) => t.activity.usesCount(f.number(v))}
          empty={t.activity.commandsEmpty}
        />
      </div>

      <Heatmap
        title={t.activity.heatmap}
        grid={grid}
        describe={(v) => t.activity.messagesCount(f.number(v))}
        note={
          <>
            {t.activity.heatmapZone(zone, formatOffset(offset))}
            {offset % 60 !== 0 ? ` ${t.activity.heatmapRounded}` : ""}
            {busiest
              ? ` ${t.activity.heatmapPeak(f.weekday(busiest.day), t.activity.hour(busiest.hour))}`
              : ""}
          </>
        }
      />
    </div>
  );
}

function KpiCard({
  spec,
  kpi,
  period,
}: {
  spec: KpiSpec;
  kpi: AnalyticsKpi;
  period: PortalAnalyticsPeriod;
}) {
  const t = useT();
  const f = useFormat();
  const change = delta(kpi.value, kpi.previous);
  const direction =
    change === null ? "none" : change > 0.005 ? "up" : change < -0.005 ? "down" : "flat";
  return (
    <li className="kpi">
      <span className="kpi__label">{spec.label(t)}</span>
      <span className="kpi__value">
        {spec.value(kpi, f)}
        {spec.hint ? <span className="kpi__hint"> {spec.hint(t)}</span> : null}
      </span>
      <span className={`kpi__delta kpi__delta--${direction}`}>
        {change === null ? (
          t.activity.noComparison
        ) : (
          <>
            <span aria-hidden="true">
              {direction === "up" ? "↑" : direction === "down" ? "↓" : "→"}
            </span>{" "}
            {t.activity.vsPrevious(f.percent(change), t.activity.periods[period])}
          </>
        )}
      </span>
      <Sparkline points={kpi.spark} />
    </li>
  );
}
