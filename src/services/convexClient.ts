import { ConvexReactClient } from "convex/react";

// Client Convex unique pour toute l'app
// URL : variable d'env prioritaire, fallback sur le projet de prod partagé
// (même déploiement Convex que lobry-sms-brocante pour partager les données pizza).
const convexUrl =
  import.meta.env.VITE_CONVEX_URL ||
  "https://affable-cod-552.eu-west-1.convex.cloud";

export const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});
