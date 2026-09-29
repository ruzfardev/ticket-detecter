/**
 * Motion vocabulary. One place, so every screen moves like the same app.
 *
 * Apple's motion is spring physics, not curves: things have mass, overshoot a
 * little, and settle. Stiffness/damping below are tuned by feel against iOS:
 *   snappy — taps, toggles, presses            (fast, barely any overshoot)
 *   smooth — pages, sheets, reveals            (the default)
 *   gentle — large surfaces, ambient movement
 *   bouncy — releases, the tab lens, "gel" feedback (visible overshoot)
 */
import type { Transition, Variants } from "motion/react";

export const spring = {
  snappy: { type: "spring", stiffness: 560, damping: 36, mass: 0.8 },
  smooth: { type: "spring", stiffness: 330, damping: 33, mass: 0.9 },
  gentle: { type: "spring", stiffness: 190, damping: 27, mass: 1 },
  bouncy: { type: "spring", stiffness: 430, damping: 22, mass: 0.9 },
  lens:   { type: "spring", stiffness: 380, damping: 28, mass: 0.8 },
} satisfies Record<string, Transition>;

/** iOS's own sheet/nav curve, for the few tweens that are not springs. */
export const easeIOS = [0.32, 0.72, 0, 1] as const;
export const easeOut = [0.16, 1, 0.3, 1] as const;

/** Staggered entrance for the blocks of a screen. `custom` is the block index. */
export const reveal: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  show: (i: number = 0) => {
    const delay = Math.min(i, 8) * 0.045;
    return {
      opacity: 1,
      y: 0,
      scale: 1,
      // The fade is quick on purpose: while a block is below full opacity any
      // glass inside it cannot blur its backdrop, so keep that window short.
      transition: { opacity: { duration: 0.2, delay }, default: { ...spring.smooth, delay } },
    };
  },
};

/** A press: shrink fast, release with overshoot — the "gel" of Liquid Glass. */
export const press = {
  whileTap: { scale: 0.96 },
  transition: spring.bouncy,
} as const;
