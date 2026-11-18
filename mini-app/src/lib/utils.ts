import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's stock font sizes. Unknown `text-*`
 * classes are taken for text colours, so `cn("text-display-xl", "text-ink")`
 * dropped the size as a "conflicting colour" and rendered 16px text. Teaching
 * it the custom scale from tailwind.config.ts keeps size and colour apart.
 * Keep this list in step with `theme.extend.fontSize` there.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{
        text: [
          "display-xl", "display-lg", "display-md", "display-sm",
          "title-lg", "title-md", "title-sm",
          "body-md", "body-sm",
          "caption", "caption-upper", "button",
        ],
      }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
