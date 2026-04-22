import { useMemo, forwardRef } from "react";
import { scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { curveMonotoneX } from "@visx/curve";
import { formatCurrency } from "@/lib/format";

interface FanChartProps {
  /** percentile key → time series */
  data: Record<string, number[]>;
  width: number;
  height: number;
  /** Label for y axis */
  yLabel?: string;
  /** Optional target threshold line */
  threshold?: number;
}

const MARGIN = { top: 20, right: 20, bottom: 40, left: 70 };

export const FanChart = forwardRef<SVGSVGElement, FanChartProps>(function FanChart({
  data,
  width,
  height,
  yLabel = "Revenue",
  threshold,
}, ref) {
  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const p50 = data["50"] ?? [];
  const p10 = data["10"] ?? [];
  const p90 = data["90"] ?? [];
  const p25 = data["25"] ?? [];
  const p75 = data["75"] ?? [];
  const T = p50.length;

  const { xScale, yScale } = useMemo(() => {
    const allValues = [
      ...p10,
      ...p90,
      ...(threshold != null ? [threshold] : []),
    ];
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const padding = (maxVal - minVal) * 0.1 || 1000;

    return {
      xScale: scaleLinear<number>({
        domain: [0, T - 1],
        range: [0, innerWidth],
      }),
      yScale: scaleLinear<number>({
        domain: [Math.min(minVal - padding, 0), maxVal + padding],
        range: [innerHeight, 0],
        nice: true,
      }),
    };
  }, [p10, p90, T, innerWidth, innerHeight, threshold]);

  if (T === 0) return null;

  const points = (series: number[]) =>
    series.map((v, i) => ({ x: xScale(i), y: yScale(v) }));

  const areaPoints10_90 = p10.map((_, i) => ({
    x: xScale(i),
    y0: yScale(p10[i]),
    y1: yScale(p90[i]),
  }));

  const areaPoints25_75 = p25.map((_, i) => ({
    x: xScale(i),
    y0: yScale(p25[i]),
    y1: yScale(p75[i]),
  }));

  return (
    <svg ref={ref} width={width} height={height}>
      <Group left={MARGIN.left} top={MARGIN.top}>
        <GridRows
          scale={yScale}
          width={innerWidth}
          stroke="rgba(255,255,255,0.05)"
          numTicks={6}
        />

        {/* P10-P90 band */}
        <AreaClosed
          data={areaPoints10_90}
          x={(d) => d.x}
          y0={(d) => d.y0}
          y1={(d) => d.y1}
          yScale={yScale}
          fill="rgba(99, 102, 241, 0.15)"
          curve={curveMonotoneX}
        />

        {/* P25-P75 band */}
        <AreaClosed
          data={areaPoints25_75}
          x={(d) => d.x}
          y0={(d) => d.y0}
          y1={(d) => d.y1}
          yScale={yScale}
          fill="rgba(99, 102, 241, 0.25)"
          curve={curveMonotoneX}
        />

        {/* Threshold line */}
        {threshold != null && (
          <line
            x1={0}
            x2={innerWidth}
            y1={yScale(threshold)}
            y2={yScale(threshold)}
            stroke="rgba(74, 222, 128, 0.6)"
            strokeWidth={1.5}
            strokeDasharray="6,4"
          />
        )}

        {/* P50 median line */}
        <LinePath
          data={points(p50)}
          x={(d) => d.x}
          y={(d) => d.y}
          stroke="#6366f1"
          strokeWidth={2.5}
          curve={curveMonotoneX}
        />

        <AxisBottom
          top={innerHeight}
          scale={xScale}
          stroke="rgba(255,255,255,0.2)"
          tickStroke="rgba(255,255,255,0.2)"
          tickLabelProps={{
            fill: "rgba(255,255,255,0.5)",
            fontSize: 11,
            fontFamily: "ui-monospace, monospace",
            textAnchor: "middle",
          }}
          label={`Month`}
          labelProps={{
            fill: "rgba(255,255,255,0.4)",
            fontSize: 12,
            textAnchor: "middle",
          }}
          numTicks={Math.min(T, 12)}
        />

        <AxisLeft
          scale={yScale}
          stroke="rgba(255,255,255,0.2)"
          tickStroke="rgba(255,255,255,0.2)"
          tickFormat={(v) => formatCurrency(v as number)}
          tickLabelProps={{
            fill: "rgba(255,255,255,0.5)",
            fontSize: 11,
            fontFamily: "ui-monospace, monospace",
            textAnchor: "end",
            dx: -4,
          }}
          label={yLabel}
          labelProps={{
            fill: "rgba(255,255,255,0.4)",
            fontSize: 12,
            textAnchor: "middle",
          }}
          numTicks={6}
        />
      </Group>
    </svg>
  );
});
