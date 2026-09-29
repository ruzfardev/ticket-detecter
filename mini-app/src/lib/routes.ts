/** Routes that own a tab in the bar, in bar order. */
export const TAB_ROUTES = ["/home", "/tickets", "/orders", "/settings"] as const;

/** Routes that show the tab bar. /premium has no tab of its own (it is
 *  reached from Home) but keeps the bar so the user is never stranded. */
export const TABBED_ROUTES = new Set<string>([...TAB_ROUTES, "/premium"]);

export const isTabRoute = (p: string) => (TAB_ROUTES as readonly string[]).includes(p);
export const isTabbedRoute = (p: string) => TABBED_ROUTES.has(p);
