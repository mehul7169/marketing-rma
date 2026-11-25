"use client";

import { Children, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  consumeFirstEnter,
  DURATION,
  ENTER_Y,
  MOTION_OFF,
  STAGGER_S,
  transitionBase
} from "@/lib/motion";
import { cn } from "@/components/ui/cn";

const visible = { opacity: 1, y: 0 };
const hidden = { opacity: 0, y: ENTER_Y };

/**
 * Entrance is opt-in and always ends visible. Never drive `animate` with
 * unstarted animation controls — a missed start leaves opacity 0 in the DOM.
 */
function useEnterOnMount(id: string) {
  const reduced = useReducedMotion();
  const skip = MOTION_OFF || Boolean(reduced);
  const [play] = useState(() => !skip && consumeFirstEnter(id));
  return play && !skip;
}

export function EnterStagger({
  id,
  className,
  children
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const play = useEnterOnMount(id);
  const items = Children.toArray(children);

  return (
    <div className={className}>
      {items.map((child, i) => (
        <motion.div
          key={i}
          initial={play ? hidden : false}
          animate={visible}
          transition={
            play ? { ...transitionBase, delay: i * STAGGER_S } : { duration: 0 }
          }
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

export function FadeIn({
  id,
  className,
  children
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const play = useEnterOnMount(id);
  return (
    <motion.div
      className={cn(className)}
      initial={play ? hidden : false}
      animate={visible}
      transition={play ? transitionBase : { duration: 0 }}
    >
      {children}
    </motion.div>
  );
}

export const popoverMotion = {
  initial: { opacity: 0, y: 4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.fast, ease: [0.22, 1, 0.36, 1] as const }
};
