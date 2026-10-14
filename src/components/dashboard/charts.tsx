// Hand-drawn SVG chart primitives for the Dashboard, built on react-native-svg
// (already a project dep — see mmi-icon.tsx). Each is presentational: give it
// data + colors + a width/height and it renders. Data derivation lives in
// data/dashboard-metrics.ts; chrome (card, legend, ranges) in chart-card.tsx.
//
// Visual encodings follow docs/dashboard-spec.md: Timeline green bars on a
// compressed scale with a lilac story-value line + band; Frequency lilac
// histogram; Tonality vertical stacked bars; scatter/bubble plots; and the
// Top-Media-Sources time swimlane.
import { Fragment } from 'react';
import { Platform } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import { chartTokens } from '@/components/dashboard/palette';

// Tap handling for react-native-svg elements, which differs by platform:
//  • Native — `onPress` is the real tap handler.
//  • Web — react-native-svg's prepare() maps `onPress` → the DOM `onClick`, but
//    only if `onPress !== null`, and when onPress is set it also injects RN
//    touch-responder props that react-dom rejects with noisy "Unknown event
//    handler" errors. Passing a bare `onClick` doesn't work either: prepare
//    overwrites it with `props.onPress` (undefined) because `undefined !== null`.
//    The clean path is `{ onPress: null, onClick }` — prepare then keeps our
//    onClick (skips the `!== null` overwrite) and adds no responder handlers.
// Typed loosely — the SVG element prop types don't surface onPress/onClick here.
function svgPress(fn?: () => void): object {
  if (!fn) return {};
  return Platform.OS === 'web' ? { onPress: null, onClick: fn } : { onPress: fn };
}

// ── small scale helpers ──
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

// ════════════════════════════════════════════════════════════════════════
// Timeline — green "Total Results" bars on a compressed axis (domain
// [0, ceil(maxR*2.6)] keeps them in the lower third), with a lilac
// "Total Story Value" line + translucent band, dashed projected-average line,
// zebra day stripes and sparse date labels. Tapping a bar selects that day.
// ════════════════════════════════════════════════════════════════════════
export type TimelinePoint = {
  date: string;
  results: number;
  storyValue: number;
  projAvg: number;
  band: [number, number];
};

export function BarLineChart({
  data,
  width,
  height = 300,
  selectedIndex,
  onSelectBar,
}: {
  data: TimelinePoint[];
  width: number;
  height?: number;
  selectedIndex?: number | null;
  onSelectBar?: (i: number) => void;
}) {
  const padL = 30;
  const padR = 12;
  const padT = 16;
  const padB = 26;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);
  const n = data.length;

  const maxR = Math.max(10, ...data.map((d) => d.results));
  const rMax = Math.ceil(maxR * 2.6); // compress bars to lower third (spec §2)
  // Story value + band share an upper band; scale to their own max.
  const svMax = Math.max(
    1,
    ...data.map((d) => Math.max(d.storyValue, d.band[1], d.projAvg)),
  );

  const step = plotW / Math.max(1, n);
  const barW = Math.min(42, step * 0.6);
  const x = (i: number) => padL + step * i + step / 2;
  const yR = (v: number) => padT + plotH - (v / rMax) * plotH;
  const ySv = (v: number) => padT + plotH - (v / svMax) * plotH;

  // Sparse x labels — about 5 across.
  const labelEvery = Math.max(1, Math.round(n / 5));

  const linePts = data.map((d, i) => `${x(i)},${ySv(d.storyValue)}`).join(' ');
  const projPts = data.map((d, i) => `${x(i)},${ySv(d.projAvg)}`).join(' ');
  const bandTop = data.map((d, i) => `${x(i)},${ySv(d.band[1])}`);
  const bandBot = data.map((d, i) => `${x(i)},${ySv(d.band[0])}`).reverse();
  const bandPath =
    n > 0 ? `M ${bandTop.join(' L ')} L ${bandBot.join(' L ')} Z` : '';

  const gridVals = [0.25, 0.5, 0.75, 1].map((f) => f * rMax);

  return (
    <Svg width={width} height={height}>
      {/* zebra day stripes */}
      {data.map((_, i) =>
        i % 2 === 0 ? (
          <Rect
            key={`z${i}`}
            x={padL + step * i}
            y={padT}
            width={step}
            height={plotH}
            fill="rgba(24,29,38,0.04)"
          />
        ) : null,
      )}
      {/* horizontal gridlines + results ticks */}
      {gridVals.map((gv, i) => (
        <Fragment key={`g${i}`}>
          <Line
            x1={padL}
            y1={yR(gv)}
            x2={width - padR}
            y2={yR(gv)}
            stroke={chartTokens.gridline}
            strokeWidth={1}
          />
          <SvgText x={padL - 4} y={yR(gv) + 3} fontSize={8} fill={chartTokens.axisText} textAnchor="end">
            {Math.round(gv)}
          </SvgText>
        </Fragment>
      ))}
      {/* story-value band */}
      {bandPath ? <Path d={bandPath} fill="#b9a4f7" fillOpacity={0.22} /> : null}
      {/* bars */}
      {data.map((d, i) => {
        const dim = selectedIndex != null && selectedIndex !== i;
        return (
          <Rect
            key={`b${i}`}
            x={x(i) - barW / 2}
            y={yR(d.results)}
            width={barW}
            height={Math.max(0, padT + plotH - yR(d.results))}
            rx={3}
            fill={chartTokens.totalResults}
            opacity={dim ? 0.3 : 1}
            {...svgPress(onSelectBar ? () => onSelectBar(i) : undefined)}
          />
        );
      })}
      {/* projected-average dashed line */}
      {n > 1 ? (
        <Polyline
          points={projPts}
          fill="none"
          stroke="#9ca3af"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      ) : null}
      {/* story-value line + dots */}
      {n > 1 ? (
        <Polyline points={linePts} fill="none" stroke="#b9a4f7" strokeWidth={1.75} />
      ) : null}
      {data.map((d, i) => (
        <Circle
          key={`d${i}`}
          cx={x(i)}
          cy={ySv(d.storyValue)}
          r={3}
          fill="#b9a4f7"
          stroke="#fff"
          strokeWidth={1}
        />
      ))}
      {/* x labels */}
      {data.map((d, i) =>
        i % labelEvery === 0 ? (
          <SvgText
            key={`x${i}`}
            x={x(i)}
            y={height - 8}
            fontSize={9}
            fill={chartTokens.axisText}
            textAnchor="middle">
            {d.date}
          </SvgText>
        ) : null,
      )}
    </Svg>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Histogram — vertical bars with a count label on top and bucket labels on x.
// Used by Frequency Distribution (focus-and-dim: selected bar lilac, rest
// faded) and the Explore frequency charts.
// ════════════════════════════════════════════════════════════════════════
export function Histogram({
  bars,
  width,
  height = 280,
  color = '#b9a4f7',
  dimColor = '#e8e1fb',
  selectedIndex,
  onSelectBar,
  xLabel,
  yLabel,
}: {
  bars: { label: string; value: number }[];
  width: number;
  height?: number;
  color?: string;
  dimColor?: string;
  selectedIndex?: number | null;
  onSelectBar?: (i: number) => void;
  xLabel?: string;
  yLabel?: string;
}) {
  const padL = 28;
  const padR = 10;
  const padT = 16;
  const padB = xLabel ? 36 : 24;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);
  const n = bars.length;
  const max = niceMax(Math.max(1, ...bars.map((b) => b.value)));
  const step = plotW / Math.max(1, n);
  const barW = Math.min(24, step * 0.6);
  const x = (i: number) => padL + step * i + step / 2;
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const labelEvery = n > 12 ? 2 : 1;

  return (
    <Svg width={width} height={height}>
      {[0, 0.5, 1].map((f, i) => (
        <Fragment key={`g${i}`}>
          <Line
            x1={padL}
            y1={padT + plotH - f * plotH}
            x2={width - padR}
            y2={padT + plotH - f * plotH}
            stroke={chartTokens.gridline}
            strokeWidth={1}
          />
          <SvgText
            x={padL - 4}
            y={padT + plotH - f * plotH + 3}
            fontSize={8}
            fill={chartTokens.axisText}
            textAnchor="end">
            {Math.round(f * max)}
          </SvgText>
        </Fragment>
      ))}
      {bars.map((b, i) => {
        const dim = selectedIndex != null && selectedIndex !== i;
        const h = Math.max(0, padT + plotH - y(b.value));
        return (
          <Fragment key={`b${i}`}>
            <Rect
              x={x(i) - barW / 2}
              y={y(b.value)}
              width={barW}
              height={h}
              rx={3}
              fill={dim ? dimColor : color}
              {...svgPress(onSelectBar ? () => onSelectBar(i) : undefined)}
            />
            {b.value > 0 ? (
              <SvgText x={x(i)} y={y(b.value) - 4} fontSize={9} fill={chartTokens.textSecondary} textAnchor="middle">
                {b.value}
              </SvgText>
            ) : null}
            {i % labelEvery === 0 ? (
              <SvgText x={x(i)} y={padT + plotH + 12} fontSize={8} fill={chartTokens.axisText} textAnchor="middle">
                {b.label}
              </SvgText>
            ) : null}
          </Fragment>
        );
      })}
      {xLabel ? (
        <SvgText x={padL + plotW / 2} y={height - 4} fontSize={9} fill={chartTokens.textSecondary} textAnchor="middle">
          {xLabel}
        </SvgText>
      ) : null}
      {yLabel ? (
        <SvgText
          x={10}
          y={padT + plotH / 2}
          fontSize={9}
          fill={chartTokens.textSecondary}
          textAnchor="middle"
          transform={`rotate(-90 10 ${padT + plotH / 2})`}>
          {yLabel}
        </SvgText>
      ) : null}
    </Svg>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Stacked vertical time-bars — Tonality Distribution over dates. Stack order
// Positive→Neutral→Negative; only the topmost non-zero segment is top-rounded.
// ════════════════════════════════════════════════════════════════════════
export type StackedDatum = { label: string; segments: { value: number; color: string }[] };

export function StackedTimeBar({
  data,
  width,
  height = 260,
  selectedIndex,
  onSelectBar,
}: {
  data: StackedDatum[];
  width: number;
  height?: number;
  selectedIndex?: number | null;
  onSelectBar?: (i: number) => void;
}) {
  const padL = 24;
  const padR = 10;
  const padT = 12;
  const padB = 24;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);
  const totals = data.map((d) => d.segments.reduce((s, x) => s + x.value, 0));
  const dataMax = Math.max(1, ...totals);
  // Even axis max with headroom so bars never touch the top, and integer-only
  // ticks (0 / max·½ / max) — avoids the duplicate "1,1" labels a fractional
  // tick + Math.round produced when the max count was 1.
  const max = Math.max(2, Math.ceil((dataMax + 1) / 2) * 2);
  const ticks = [0, max / 2, max];
  const step = plotW / Math.max(1, data.length);
  const barW = Math.min(48, step * 0.6);
  const xc = (i: number) => padL + step * i + step / 2;
  const h = (v: number) => (v / max) * plotH;

  return (
    <Svg width={width} height={height}>
      {ticks.map((tv, i) => {
        const gy = padT + plotH - (tv / max) * plotH;
        return (
          <Fragment key={`g${i}`}>
            <Line x1={padL} y1={gy} x2={width - padR} y2={gy} stroke={chartTokens.gridline} strokeWidth={1} />
            <SvgText x={padL - 4} y={gy + 3} fontSize={8} fill={chartTokens.axisText} textAnchor="end">
              {tv}
            </SvgText>
          </Fragment>
        );
      })}
      {data.map((d, i) => {
        const dim = selectedIndex != null && selectedIndex !== i;
        let yCursor = padT + plotH;
        const topMostIdx = (() => {
          for (let k = d.segments.length - 1; k >= 0; k--) if (d.segments[k].value > 0) return k;
          return -1;
        })();
        return (
          <G key={`s${i}`} {...svgPress(onSelectBar ? () => onSelectBar(i) : undefined)}>
            {d.segments.map((seg, k) => {
              if (seg.value <= 0) return null;
              const segH = h(seg.value);
              yCursor -= segH;
              const rounded = k === topMostIdx;
              return (
                <Rect
                  key={`seg${k}`}
                  x={xc(i) - barW / 2}
                  y={yCursor}
                  width={barW}
                  height={segH}
                  rx={rounded ? 3 : 0}
                  fill={seg.color}
                  opacity={dim ? 0.3 : 1}
                />
              );
            })}
            <SvgText x={xc(i)} y={padT + plotH + 12} fontSize={8} fill={chartTokens.axisText} textAnchor="middle">
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Scatter / bubble plot — x/y numeric axes, per-point radius + color.
// Media Source Distribution uses fixed r; Influencer Story Value uses
// r = 6 + score*1.4 (spec §7b/§8).
// ════════════════════════════════════════════════════════════════════════
export type ScatterPoint = { x: number; y: number; r: number; color: string; label?: string };

export function ScatterPlot({
  points,
  width,
  height = 300,
  xLabel,
  yLabel,
  xMax,
  yMax,
  onSelectPoint,
}: {
  points: ScatterPoint[];
  width: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  xMax?: number;
  yMax?: number;
  onSelectPoint?: (i: number) => void;
}) {
  const padL = 34;
  const padR = 14;
  const padT = 14;
  const padB = 30;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);
  const xm = niceMax(xMax ?? Math.max(1, ...points.map((p) => p.x)));
  const ym = niceMax(yMax ?? Math.max(1, ...points.map((p) => p.y)));
  const X = (v: number) => padL + (v / xm) * plotW;
  const Y = (v: number) => padT + plotH - (v / ym) * plotH;

  return (
    <Svg width={width} height={height}>
      {/* gridlines */}
      {[0, 0.5, 1].map((f, i) => (
        <Fragment key={`gy${i}`}>
          <Line x1={padL} y1={Y(f * ym)} x2={width - padR} y2={Y(f * ym)} stroke={chartTokens.gridline} strokeWidth={1} />
          <SvgText x={padL - 4} y={Y(f * ym) + 3} fontSize={8} fill={chartTokens.axisText} textAnchor="end">
            {f * ym >= 100 ? Math.round(f * ym) : (f * ym).toFixed(f === 0 ? 0 : 1)}
          </SvgText>
        </Fragment>
      ))}
      {[0, 0.5, 1].map((f, i) => (
        <SvgText key={`gx${i}`} x={X(f * xm)} y={padT + plotH + 12} fontSize={8} fill={chartTokens.axisText} textAnchor="middle">
          {Math.round(f * xm)}
        </SvgText>
      ))}
      {/* axis frame */}
      <Line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={chartTokens.border} strokeWidth={1} />
      <Line x1={padL} y1={padT + plotH} x2={width - padR} y2={padT + plotH} stroke={chartTokens.border} strokeWidth={1} />
      {points.map((p, i) => (
        <Circle
          key={`p${i}`}
          cx={X(p.x)}
          cy={Y(p.y)}
          r={p.r}
          fill={p.color}
          fillOpacity={0.72}
          stroke="#fff"
          strokeWidth={1}
          {...svgPress(onSelectPoint ? () => onSelectPoint(i) : undefined)}
        />
      ))}
      {xLabel ? (
        <SvgText x={padL + plotW / 2} y={height - 4} fontSize={9} fill={chartTokens.textSecondary} textAnchor="middle">
          {xLabel}
        </SvgText>
      ) : null}
      {yLabel ? (
        <SvgText
          x={10}
          y={padT + plotH / 2}
          fontSize={9}
          fill={chartTokens.textSecondary}
          textAnchor="middle"
          transform={`rotate(-90 10 ${padT + plotH / 2})`}>
          {yLabel}
        </SvgText>
      ) : null}
    </Svg>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Time swimlane — Top Media Sources. One horizontal lane per platform; each
// post is a dot placed by time (x) with a small vertical jitter (spec §7a).
// ════════════════════════════════════════════════════════════════════════
export type SwimLane = { label: string; color: string; count: number };
export type SwimDot = { lane: number; t: number; jitter: number; color: string };

export function SwimlaneScatter({
  lanes,
  dots,
  dayLabels,
  width,
  height = 300,
  onSelectLane,
}: {
  lanes: SwimLane[];
  dots: SwimDot[];
  dayLabels: string[];
  width: number;
  height?: number;
  onSelectLane?: (i: number) => void;
}) {
  const padL = 86;
  const padR = 12;
  const padT = 22;
  const padB = 14;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);
  const laneH = plotH / Math.max(1, lanes.length);
  const laneY = (i: number) => padT + laneH * i + laneH / 2;
  const X = (t: number) => padL + t * plotW; // t in [0,1]

  return (
    <Svg width={width} height={height}>
      {/* day ticks along the top */}
      {dayLabels.map((d, i) => {
        const t = dayLabels.length > 1 ? i / (dayLabels.length - 1) : 0;
        return (
          <Fragment key={`day${i}`}>
            <Line x1={X(t)} y1={padT} x2={X(t)} y2={padT + plotH} stroke={chartTokens.gridline} strokeWidth={1} />
            <SvgText x={X(t)} y={padT - 8} fontSize={8} fill={chartTokens.axisText} textAnchor="middle">
              {d}
            </SvgText>
          </Fragment>
        );
      })}
      {/* lane labels (also tappable → that lane's posts) */}
      {lanes.map((l, i) => (
        <SvgText
          key={`l${i}`}
          x={padL - 6}
          y={laneY(i) + 3}
          fontSize={9}
          fill={l.color}
          textAnchor="end"
          {...svgPress(onSelectLane ? () => onSelectLane(i) : undefined)}>
          {l.label} ({l.count})
        </SvgText>
      ))}
      {/* dots (tappable → their lane's posts) */}
      {dots.map((d, i) => (
        <Circle
          key={`sd${i}`}
          cx={X(d.t)}
          cy={laneY(d.lane) + d.jitter}
          r={5}
          fill={d.color}
          fillOpacity={0.7}
          {...svgPress(onSelectLane ? () => onSelectLane(d.lane) : undefined)}
        />
      ))}
      {/* transparent per-lane hit areas (on top) so tapping anywhere in a
          platform's row opens that platform's posts */}
      {onSelectLane
        ? lanes.map((l, i) => (
            <Rect
              key={`hit${i}`}
              x={0}
              y={padT + laneH * i}
              width={width}
              height={laneH}
              fill="transparent"
              {...svgPress(() => onSelectLane(i))}
            />
          ))
        : null}
    </Svg>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Donut — Tonality / Share-of-Voice. Arcs from the top, clockwise; optional
// center label. Tapping a slice selects it (others can be dimmed by caller
// via the `selectedIndex` prop).
// ════════════════════════════════════════════════════════════════════════
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function donutArc(cx: number, cy: number, rO: number, rI: number, startDeg: number, endDeg: number) {
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const sO = polar(cx, cy, rO, startDeg);
  const eO = polar(cx, cy, rO, endDeg);
  const sI = polar(cx, cy, rI, endDeg);
  const eI = polar(cx, cy, rI, startDeg);
  return `M ${sO.x} ${sO.y} A ${rO} ${rO} 0 ${large} 1 ${eO.x} ${eO.y} L ${sI.x} ${sI.y} A ${rI} ${rI} 0 ${large} 0 ${eI.x} ${eI.y} Z`;
}

export function Donut({
  segments,
  size = 180,
  thickness,
  centerValue,
  centerLabel,
  selectedIndex,
  onSelectSlice,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
  selectedIndex?: number | null;
  onSelectSlice?: (i: number) => void;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const rO = size / 2 - 2;
  const rI = rO - (thickness ?? rO * 0.42);
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;

  return (
    <Svg width={size} height={size}>
      {segments.map((seg, i) => {
        if (seg.value <= 0) return null;
        const start = (acc / total) * 360;
        acc += seg.value;
        const end = (acc / total) * 360;
        const dim = selectedIndex != null && selectedIndex !== i;
        // full-circle guard (single non-zero segment)
        const sweep = end - start >= 359.999 ? 359.999 : end;
        return (
          <Path
            key={`a${i}`}
            d={donutArc(cx, cy, rO, rI, start, sweep)}
            fill={seg.color}
            opacity={dim ? 0.35 : 1}
            {...svgPress(onSelectSlice ? () => onSelectSlice(i) : undefined)}
          />
        );
      })}
      {centerValue ? (
        <SvgText x={cx} y={cy - 2} fontSize={22} fontWeight="700" fill={chartTokens.text} textAnchor="middle">
          {centerValue}
        </SvgText>
      ) : null}
      {centerLabel ? (
        <SvgText x={cx} y={cy + 14} fontSize={10} fill={chartTokens.textSecondary} textAnchor="middle">
          {centerLabel}
        </SvgText>
      ) : null}
    </Svg>
  );
}
