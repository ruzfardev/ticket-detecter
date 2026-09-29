import { useEffect } from "react";
import * as m from "motion/react-m";
import { useTransform } from "motion/react";

import { useLight } from "@/hooks/useLight";
import { cn } from "@/lib/utils";

/**
 * A highlight that slides across a glass pane as the phone tilts. Put it
 * inside a `relative overflow-hidden` glass element. While mounted it asks
 * the light source to run; on "lite"/"off" tiers CSS hides it and the sensors
 * stay off.
 */
export function Specular({ range = 18, className }: { range?: number; className?: string }) {
  const { lx, ly, retain } = useLight();
  useEffect(() => retain(), [retain]);
  const x = useTransform(lx, v => v * range);
  const y = useTransform(ly, v => v * range * 0.5);
  return <m.span aria-hidden className={cn("specular", className)} style={{ x, y }} />;
}
