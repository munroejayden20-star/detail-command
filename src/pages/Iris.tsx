/**
 * /iris route — the dedicated Iris experience.
 *
 * The page itself is the panel. The rest of this file exists so the route
 * lazy-loads cleanly via the App.tsx convention.
 */
import { IrisPanel } from "@/components/iris/IrisPanel";

export function IrisPage() {
  return <IrisPanel />;
}
