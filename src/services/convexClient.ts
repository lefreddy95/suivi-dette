import { ConvexReactClient } from "convex/react";

// Client Convex unique pour toute l'app
// URL : variable d'env prioritaire, fallback sur le projet de prod dédié.
const convexUrl =
  import.meta.env.VITE_CONVEX_URL ||
  "https://different-opossum-825.eu-west-1.convex.cloud";

export const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});
