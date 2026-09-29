import * as m from "motion/react-m";
import { useTransform } from "motion/react";

import { useLight } from "@/hooks/useLight";

/**
 * The light behind the glass: three soft colour washes (coral, amber, teal by
 * default; the palette decides) drifting slowly, like scenery past a train
 * window, over a canvas that warms toward the bottom. Glass needs something
 * to bend — on a flat canvas a pane is just a pale rectangle.
 *
 * Pure transform animation on a fixed, contained layer: no layout, no paint
 * after the first frame. Frozen on modest devices ("lite"/"off") and while the
 * app is hidden. Tilting the phone nudges the stage a few pixels the other way.
 */
export function Ambient() {
  const { lx, ly } = useLight();
  const x = useTransform(lx, v => v * -18);
  const y = useTransform(ly, v => v * -18);
  return (
    <div className="ambient" aria-hidden>
      <m.div className="ambient__stage" style={{ x, y }}>
        <div className="ambient__orb ambient__orb--1" />
        <div className="ambient__orb ambient__orb--2" />
        <div className="ambient__orb ambient__orb--3" />
      </m.div>
    </div>
  );
}
