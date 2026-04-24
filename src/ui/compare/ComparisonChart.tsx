import { useMemo } from "react";
import { scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { formatCurrency } from "@/lib/format";

interface SeriesData {
  label: string;
  color: string;
  data: Record<string, number[]>;
  survivalRate: number;
}

interface ComparisonChartProps {
  series: SeriesData[];
  width: number;
  height: number;
  yLabel?: string;
}

const MARGIN = { top: 30, right: 120, bottom: 40, left: 70 };

export function ComparisonChart({
  series,
  width,
  height,
  yLabel = "Value",
}: ComparisonChartProps) {
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const { xScale, yScale, periods } = useMemo(() => {
    let maxPeriods = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (const s of series) {
      const p50 = s.data["50"];
      const p10 = s.data["10"];
      const p90 = s.data["90"];
      if (!p50) continue;

      maxPeriods = Math.max(maxPeriods, p50.length);
      for (let i = 0; i < p50.length; i++) {
        if (p10) minVal = Math.min(minVal, p10[i]);
        if (p90) maxVal = Math.max(maxVal, p90[i]);
        minVal = Math.min(minVal, p50[i]);
        maxVal = Math.max(maxVal, p50[i]);
      }
    }

    const periods = maxPeriods;
    const padding = (maxVal - minVal) * 0.1 || 1;

    return {
      xScale: scaleLinear({
        domain: [0, periods - 1],
        range: [0, innerWidth],
      }),
      yScale: scaleLinear({
        domain: [minVal - padding, maxVal + padding],
        range: [innerHeight, 0],
        nice: true,
      }),
      periods,
    };
  }, [series, innerWidth, innerHeight]);

  if (innerWidth <= 0 || innerHeight <= 0) return null;

  return (
    <svg width={width} height={height}>
      <Group left={MARGIN.left} top={MARGIN.top}>
        <GridRows
          scale={yScale}
          width={innerWidth}
          stroke="#27272a"
          strokeDasharray="2,3"
        />

        {/* P10-P90 bands */}
        {series.map((s, idx) => {
          const p10 = s.data["10"];
          const p90 = s.data["90"];
          if (!p10 || !p90) return null;

          const bandData = p10.map((_, i) => ({
            x: i,
            y0: p10[i],
            y1: p90[i],
          }));

          return (
            <AreaClosed
              key={`band-${idx}`}
              data={bandData}
              x={(d) => xScale(d.x)}
              y0={(d) => yScale(d.y0)}
              y1={(d) => yScale(d.y1)}
              yScale={yScale}
              fill={s.color}
              fillOpacity={0.1}
            />
          );
        })}

        {/* P50 lines */}
        {series.map((s, idx) => {
          const p50 = s.data["50"];
          if (!p50) return null;

          const lineData = p50.map((v, i) => ({ x: i, y: v }));

          return (
            <LinePath
              key={`line-${idx}`}
              data={lineData}
              x={(d) => xScale(d.x)}
              y={(d) => yScale(d.y)}
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          );
        })}

        <AxisLeft
          scale={yScale}
          tickFormat={(v) => formatCurrency(v as number)}
          stroke="#3f3f46"
          tickStroke="#3f3f46"
          tickLabelProps={{ fill: "#71717a", fontSize: 10, dx: -4 }}
          label={yLabel}
          labelProps={{
            fill: "#71717a",
            fontSize: 11,
            textAnchor: "middle",
          }}
        />

        <AxisBottom
          scale={xScale}
          top={innerHeight}
          tickFormat={(v) => `M${(v as number) + 1}`}
          stroke="#3f3f46"
          tickStroke="#3f3f46"
          tickLabelProps={{ fill: "#71717a", fontSize: 10, dy: 4 }}
          numTicks={Math.min(periods, 12)}
        />
      </Group>

      {/* Legend */}
      <Group left={width - MARGIN.right + 16} top={MARGIN.top}>
        {series.map((s, idx) => (
          <Group key={idx} top={idx * 40}>
            <line x1={0} y1={0} x2={20} y2={0} stroke={s.color} strokeWidth={2.5} />
            <text x={26} y={4} fill="#a1a1aa" fontSize={11}>
              {s.label}
            </text>
            <text x={26} y={18} fill="#71717a" fontSize={10}>
              Survival: {Math.round(s.survivalRate * 100)}%
            </text>
          </Group>
        ))}
      </Group>
    </svg>
  );
}
