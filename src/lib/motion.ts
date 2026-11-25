/** Shared motion presets. Seconds for Motion, ms aliases for CSS. */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const DURATION = {
  /** Hovers and presses */
  fast: 0.12,
  /** Popovers, tabs, drawers */
  base: 0.2,
  /** Number count-ups and chart entry */
  slow: 0.75,
  /** Tab / nav count badges */
  badge: 0.3,
  /** Reduced-motion opacity only */
  reduced: 0.15
} as const;

export const DURATION_MS = {
  fast: 120,
  base: 200,
  slow: 750,
  badge: 300,
  reduced: 150
} as const;

export const transitionFast = { duration: DURATION.fast, ease: EASE_OUT };
export const transitionBase = { duration: DURATION.base, ease: EASE_OUT };
export const transitionSlow = { duration: DURATION.slow, ease: EASE_OUT };
export const transitionBadge = { duration: DURATION.badge, ease: EASE_OUT };
export const transitionReduced = { duration: DURATION.reduced, ease: "linear" as const };

export const STAGGER_S = 0.04;
export const ENTER_Y = 8;

export const MOTION_OFF =
  typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);

export function chartAnimation(reduced: boolean | null) {
  const skip = MOTION_OFF || Boolean(reduced);
  return {
    isAnimationActive: !skip,
    animationDuration: skip ? 0 : DURATION_MS.slow
  };
}

const entered = new Set<string>();

export function consumeFirstEnter(key: string): boolean {
  if (entered.has(key)) return false;
  entered.add(key);
  return true;
}

/** Test-only. */
export function resetFirstEnter() {
  entered.clear();
}
