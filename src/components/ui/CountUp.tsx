"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { DURATION, EASE_OUT, MOTION_OFF } from "@/lib/motion";

export default function CountUp({
  value,
  format,
  speed = "slow",
  className
}: {
  value: number;
  format: (n: number) => string;
  speed?: "slow" | "badge";
  className?: string;
}) {
  const reduced = useReducedMotion();
  const skip = MOTION_OFF || reduced;
  const duration = speed === "badge" ? DURATION.badge : DURATION.slow;
  const [text, setText] = useState(() => format(skip ? value : 0));
  const fromRef = useRef(skip ? value : 0);
  const targetRef = useRef(value);
  targetRef.current = value;
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    const fmt = formatRef.current;
    if (skip) {
      setText(fmt(value));
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const controls = animate(from, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => setText(fmt(v)),
      onComplete: () => {
        const end = targetRef.current;
        setText(fmt(end));
        fromRef.current = end;
      }
    });
    return () => {
      controls.stop();
      fromRef.current = targetRef.current;
    };
  }, [value, skip, duration]);

  return (
    <span className={className} data-testid="count-up" suppressHydrationWarning>
      {text}
    </span>
  );
}
