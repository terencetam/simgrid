import { useRef, useEffect, useCallback, useState } from "react";
import { scaleLinear } from "@visx/scale";
import type { SampleRun } from "@/engine/montecarlo";
import { FanChart } from "./FanChart";

export type AnimationPhase =
  | "idle"
  | "spaghetti"
  | "transition"
  | "complete";

interface SimulationChartProps {
  /** Percentile data for the fan chart */
  fanData: Record<string, number[]>;
  /** Individual run traces for spaghetti animation */
  sampleRuns: SampleRun[];
  /** Variable ID to display */
  metricVarId: string;
  width: number;
  height: number;
  yLabel: string;
  threshold?: number;
  /** Animation phase */
  phase: AnimationPhase;
  /** Called when animation sequence completes */
  onAnimationComplete: () => void;
}

const MARGIN = { top: 20, right: 20, bottom: 40, left: 70 };

// Duration constants (ms)
const SPAGHETTI_DURATION = 1500;
const TRANSITION_DURATION = 600;

export function SimulationChart({
  fanData,
  sampleRuns,
  metricVarId,
  width,
  height,
  yLabel,
  threshold,
  phase,
  onAnimationComplete,
}: SimulationChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const [fanOpacity, setFanOpacity] = useState(phase === "complete" ? 1 : 0);
  const [spaghettiOpacity, setSpaghettiOpacity] = useState(
    phase === "spaghetti" ? 1 : 0
  );

  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  // Get the run data for the current metric via variable ID
  const getRunSeries = useCallback(
    (run: SampleRun): number[] => {
      return run.values[metricVarId] ?? [];
    },
    [metricVarId]
  );

  // Compute scales based on sample run data
  const T = sampleRuns.length > 0 ? getRunSeries(sampleRuns[0]).length : 0;

  const xScale = scaleLinear<number>({
    domain: [0, Math.max(T - 1, 1)],
    range: [0, innerWidth],
  });

  // Find data range across all sample runs for this metric
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (const run of sampleRuns) {
    const series = getRunSeries(run);
    for (const v of series) {
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }
  if (threshold != null) {
    minVal = Math.min(minVal, threshold);
    maxVal = Math.max(maxVal, threshold);
  }
  const padding = (maxVal - minVal) * 0.1 || 1000;
  minVal = Math.min(minVal - padding, 0);
  maxVal = maxVal + padding;

  const yScale = scaleLinear<number>({
    domain: [minVal, maxVal],
    range: [innerHeight, 0],
  });

  // Draw spaghetti lines on canvas
  const drawSpaghetti = useCallback(
    (progress: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(MARGIN.left, MARGIN.top);

      const revealT = Math.floor(progress * T);
      if (revealT < 1) {
        ctx.restore();
        return;
      }

      for (const run of sampleRuns) {
        const series = getRunSeries(run);
        ctx.beginPath();
        ctx.strokeStyle = run.won
          ? "rgba(99, 102, 241, 0.35)"
          : "rgba(239, 68, 68, 0.3)";
        ctx.lineWidth = 1;

        for (let t = 0; t < revealT && t < series.length; t++) {
          const x = xScale(t) ?? 0;
          const y = yScale(series[t]) ?? 0;
          if (t === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw threshold line if present
      if (threshold != null) {
        const ty = yScale(threshold) ?? 0;
        ctx.beginPath();
        ctx.strokeStyle = "rgba(74, 222, 128, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.moveTo(0, ty);
        ctx.lineTo(innerWidth * progress, ty);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    },
    [sampleRuns, getRunSeries, T, xScale, yScale, innerWidth, threshold]
  );

  // Resize canvas for HiDPI
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }, [width, height]);

  // Animation loop
  useEffect(() => {
    if (phase === "spaghetti" && sampleRuns.length > 0) {
      setSpaghettiOpacity(1);
      setFanOpacity(0);
      startTimeRef.current = performance.now();

      const animate = (now: number) => {
        const elapsed = now - startTimeRef.current;
        const progress = Math.min(elapsed / SPAGHETTI_DURATION, 1);

        drawSpaghetti(progress);

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Spaghetti done — start transition
          setSpaghettiOpacity(0.3);
          setFanOpacity(1);
          setTimeout(() => {
            onAnimationComplete();
          }, TRANSITION_DURATION);
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);

      return () => {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
      };
    }

    if (phase === "complete") {
      setFanOpacity(1);
      setSpaghettiOpacity(0);
      // Clear canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    if (phase === "idle") {
      setFanOpacity(0);
      setSpaghettiOpacity(0);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [phase, sampleRuns, drawSpaghetti, onAnimationComplete]);

  return (
    <div className="relative" style={{ width, height }}>
      {/* Canvas layer for spaghetti lines */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          opacity: spaghettiOpacity,
          transition: `opacity ${TRANSITION_DURATION}ms ease-in-out`,
        }}
      />

      {/* SVG layer for fan chart */}
      <div
        className="absolute inset-0"
        style={{
          opacity: fanOpacity,
          transition: `opacity ${TRANSITION_DURATION}ms ease-in-out`,
        }}
      >
        <FanChart
          data={fanData}
          width={width}
          height={height}
          yLabel={yLabel}
          threshold={threshold}
        />
      </div>
    </div>
  );
}
