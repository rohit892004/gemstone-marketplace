"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * Number that counts up once when it scrolls into view. The server and first render show the final value,
 * so nothing reads as zero if the script never runs. Reduced motion shows the final value and does not animate.
 */
export function Counter({ to, decimals = 0, prefix = "", suffix = "", className }: { to: number; decimals?: number; prefix?: string; suffix?: string; className?: string }) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(to);
  const ref = useRef<HTMLSpanElement>(null);
  const format = (n: number) => `${prefix}${n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce || typeof IntersectionObserver === "undefined") return;
    let controls: { stop: () => void } | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        setValue(0);
        controls = animate(0, to, {
          duration: 1.6,
          ease: "easeOut",
          onUpdate: (latest) => setValue(latest),
        });
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [to, reduce]);

  return (
    <span ref={ref} className={className} aria-label={format(to)}>
      <span aria-hidden>{format(value)}</span>
    </span>
  );
}
