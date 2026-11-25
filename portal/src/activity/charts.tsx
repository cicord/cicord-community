/**
 * Hand-written SVG and HTML charts of the Activity page (no chart library: three chart
 * forms do not need one). One series per chart, in the theme's primary color; text always
 * uses the text tokens. Every chart has a text alternative: a data table, or a list/table
 * that is the chart itself.
 */
import type { AnalyticsPoint } from "@cicord/client";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useFormat } from "../format.ts";
import { useT } from "../i18n/index.tsx";

// ───────────────────────────────────────────────────────────── sparkline

/** A decorative trend line for a KPI card (the card's text carries the numbers). */
export function Sparkline({ points }: { points: readonly AnalyticsPoint[] }) {
  const w = 120;
  const h = 32;
  if (points.length < 2) return null;
  const vals = points.map(([, v]) => v);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const span = max - min || 1;
  const step = w / (vals.length - 1);
  const coords = vals.map((v, i) => [i * step, h - 2 - ((v - min) / span) * (h - 4)] as const);
  const line = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join("");
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className="sparkline__area" d={`${line}L${w},${h}L0,${h}Z`} />
      <path className="sparkline__line" d={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────── daily chart

/** Width of an element, followed with ResizeObserver (a fixed default without it). */
function useWidth<T extends HTMLElement>(fallback: number): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** A round upper bound for the y axis: 1, 2, 2.5 or 5 times a power of ten. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * power >= max) return m * power;
  return 10 * power;
}

/** A bar whose top corners are rounded (the data end), anchored on the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export interface DailyChartProps {
  title: string;
  points: readonly AnalyticsPoint[];
  kind: "bars" | "line";
  /** "312 messages", "42 members". */
  describe: (value: number) => string;
  /** Text under the title. */
  note?: ReactNode;
}

/**
 * One value per UTC day, as bars (counts) or a line (daily averages). Hover, or focus the
 * plot and use the arrow keys, to read a day; the data table is one click away.
 */
export function DailyChart({ title, points, kind, describe, note }: DailyChartProps) {
  const t = useT();
  const f = useFormat();
  const id = useId();
  const [ref, width] = useWidth<HTMLDivElement>(640);
  const [active, setActive] = useState<number | null>(null);

  const height = 200;
  const pad = { top: 12, right: 8, bottom: 26, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const vals = points.map(([, v]) => v);
  const max = niceMax(Math.max(0, ...vals));
  const band = vals.length > 0 ? plotW / vals.length : plotW;
  const x = (i: number) => pad.left + i * band + band / 2;
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(vals.length / Math.max(2, Math.floor(plotW / 72))));

  const total = vals.reduce((a, b) => a + b, 0);
  const peakIndex = vals.length > 0 ? vals.indexOf(Math.max(...vals)) : -1;
  const shown = active ?? peakIndex;
  const shownPoint = shown >= 0 ? points[shown] : undefined;
  const activeValue = active === null ? undefined : vals[active];

  const onPointer = (event: PointerEvent<HTMLInputElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const i = Math.floor((event.clientX - box.left - pad.left) / band);
    setActive(i >= 0 && i < vals.length ? i : null);
  };
  const line = vals
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join("");

  return (
    <figure className="chart" aria-labelledby={`${id}-title`}>
      <figcaption className="chart__head">
        <h3 id={`${id}-title`} className="chart__title">
          {title}
        </h3>
        {note ? <p className="chart__note">{note}</p> : null}
        <p className="chart__readout" aria-hidden="true">
          {shownPoint ? (
            <>
              <span className="chart__readout-day">
                {active === null ? t.activity.peak : null} {f.day(shownPoint[0])}
              </span>{" "}
              <strong>{describe(shownPoint[1])}</strong>
            </>
          ) : (
            t.activity.noData
          )}
        </p>
      </figcaption>
      <div ref={ref} className="chart__plot">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
          focusable="false"
        >
          {ticks.map((tick) => (
            <g key={tick} className="chart__grid">
              <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
              <text x={pad.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
                {f.compact(tick)}
              </text>
            </g>
          ))}
          {kind === "bars" ? (
            vals.map((v, i) => {
              const w = Math.max(1, Math.min(28, band - Math.max(2, band * 0.28)));
              return v > 0 ? (
                <path
                  key={points[i]![0]}
                  className={i === active ? "chart__bar is-active" : "chart__bar"}
                  d={barPath(x(i) - w / 2, y(v), w, pad.top + plotH - y(v))}
                />
              ) : null;
            })
          ) : (
            <>
              <path
                className="chart__area"
                d={`${line}L${x(vals.length - 1)},${pad.top + plotH}L${x(0)},${pad.top + plotH}Z`}
              />
              <path className="chart__line" d={line} />
              {active !== null && activeValue !== undefined ? (
                <circle className="chart__dot" cx={x(active)} cy={y(activeValue)} r={4.5} />
              ) : null}
            </>
          )}
          {active !== null && kind === "line" ? (
            <line
              className="chart__cursor"
              x1={x(active)}
              x2={x(active)}
              y1={pad.top}
              y2={pad.top + plotH}
            />
          ) : null}
          {points.map(([time], i) =>
            i % labelEvery === 0 ? (
              <text key={time} className="chart__axis" x={x(i)} y={height - 6} textAnchor="middle">
                {f.day(time)}
              </text>
            ) : null,
          )}
        </svg>
        {/* The plot is a range input over the days: arrow keys, Home/End or the pointer pick the
            day the readout shows, and screen readers announce it. */}
        {vals.length > 0 ? (
          <input
            type="range"
            className="chart__scrub"
            min={0}
            max={vals.length - 1}
            step={1}
            value={Math.max(0, shown)}
            aria-label={t.activity.chartSummary(title, describe(total), vals.length)}
            aria-valuetext={
              shownPoint ? `${f.day(shownPoint[0])}: ${describe(shownPoint[1])}` : undefined
            }
            onChange={(e) => setActive(Number(e.target.value))}
            onPointerMove={onPointer}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
          />
        ) : null}
      </div>
      <details className="chart__table">
        <summary>{t.activity.showTable}</summary>
        <div className="table-scroll">
          <table>
            <caption className="visually-hidden">{title}</caption>
            <thead>
              <tr>
                <th scope="col">{t.activity.day}</th>
                <th scope="col">{t.activity.value}</th>
              </tr>
            </thead>
            <tbody>
              {points.map(([time, v]) => (
                <tr key={time}>
                  <th scope="row">{f.day(time)}</th>
                  <td>{f.number(Math.round(v * 10) / 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

// ───────────────────────────────────────────────────────────── ranked list

export interface RankedItem {
  key: string;
  label: ReactNode;
  /** Secondary text after the label (the bot of a command). */
  sub?: string;
  value: number;
}

/** A ranking as a list whose bars are proportional to the first entry: a chart and its text. */
export function RankedList({
  title,
  items,
  describe,
  empty,
}: {
  title: string;
  items: readonly RankedItem[];
  describe: (value: number) => string;
  empty: string;
}) {
  const id = useId();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <section className="ranked" aria-labelledby={id}>
      <h3 id={id} className="chart__title">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="ranked__empty">{empty}</p>
      ) : (
        <ol className="ranked__list">
          {items.map((item) => (
            <li key={item.key} className="ranked__item">
              <span className="ranked__label">
                {item.label}
                {item.sub ? <span className="ranked__sub">{item.sub}</span> : null}
              </span>
              <span className="ranked__value">{describe(item.value)}</span>
              <span className="ranked__bar" aria-hidden="true">
                <span style={{ width: `${(item.value / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────── heatmap

/** Five steps of one hue (the theme primary), light to strong; 0 is the empty step. */
export function heatLevel(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((value / max) * 4)));
}

/**
 * Messages per weekday and hour as a real table (screen readers read every cell), colored by
 * level. Rows start on Monday; `grid` is already in the viewer's time zone.
 */
export function Heatmap({
  title,
  grid,
  note,
  describe,
}: {
  title: string;
  grid: readonly (readonly number[])[];
  note: ReactNode;
  describe: (value: number) => string;
}) {
  const t = useT();
  const f = useFormat();
  const id = useId();
  const max = Math.max(0, ...grid.flat());
  const hour = (h: number) => t.activity.hour(h);
  return (
    <section className="heatmap" aria-labelledby={id}>
      <div className="chart__head">
        <h3 id={id} className="chart__title">
          {title}
        </h3>
        <p className="chart__note">{note}</p>
      </div>
      <div className="table-scroll">
        <table className="heatmap__table">
          <caption className="visually-hidden">
            {title}. {note}
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">{t.activity.weekday}</span>
              </th>
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} scope="col" className={h % 3 === 0 ? undefined : "heatmap__minor"}>
                  <span className={h % 3 === 0 ? undefined : "visually-hidden"}>{hour(h)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, day) => (
              <tr key={f.weekday(day)}>
                <th scope="row">{f.weekday(day)}</th>
                {row.map((value, h) => (
                  <td
                    key={hour(h)}
                    className={`heatmap__cell heatmap__cell--${heatLevel(value, max)}`}
                    title={`${f.weekday(day)} ${hour(h)}: ${describe(value)}`}
                  >
                    <span className="visually-hidden">{describe(value)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="heatmap__legend" aria-hidden="true">
        <span>{t.activity.fewer}</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className={`heatmap__swatch heatmap__cell--${level}`} />
        ))}
        <span>{t.activity.more}</span>
      </div>
    </section>
  );
}
