"use client";

import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

/**
 * Shared time-series chart for the analytics pages. uPlot: a small, dependency-free canvas chart that stays fast
 * with 90 daily points and two or three series. Used by seller analytics and platform analytics.
 */

export interface LineSeries {
  label: string;
  /** Null is a gap (no data for that day), not a zero. */
  values: (number | null)[];
  color: string;
}

export interface LineChartProps {
  /** Unix seconds (UTC midnight) for each point. */
  times: number[];
  series: LineSeries[];
  height?: number;
  ariaLabel: string;
}

export function LineChart({ times, series, height = 220, ariaLabel }: LineChartProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const width = Math.max(280, element.clientWidth);
    const options: uPlot.Options = {
      width,
      height,
      legend: { show: false },
      cursor: { drag: { x: false, y: false } },
      scales: { x: { time: true } },
      axes: [
        { stroke: "#6b6b6b", grid: { stroke: "#e7e5e0" } },
        { stroke: "#6b6b6b", grid: { stroke: "#e7e5e0" }, size: 48 },
      ],
      series: [{}, ...series.map((s) => ({ label: s.label, stroke: s.color, width: 2, points: { show: false } }))],
    };
    const data: uPlot.AlignedData = [times, ...series.map((s) => s.values)] as uPlot.AlignedData;
    const plot = new uPlot(options, data, element);

    const onResize = () => plot.setSize({ width: Math.max(280, element.clientWidth), height });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      plot.destroy();
    };
  }, [times, series, height]);

  return (
    <div role="img" aria-label={ariaLabel} className="w-full">
      <div ref={container} className="w-full" />
      <ul className="mt-2 flex flex-wrap gap-4 text-xs text-ink-soft">
        {series.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-4 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
