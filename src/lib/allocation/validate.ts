import type { AllocWorkshop, Bundle } from "@/types/allocation";
import { slotKey } from "@/lib/allocation/session-slots";

export type UsageMap = Map<string, number>;

export function initialUsage(workshops: AllocWorkshop[]): UsageMap {
  return new Map(workshops.map((w) => [w.id, 0]));
}

export function bundleFits(
  bundle: Pick<Bundle, "workshopIds" | "sessionAssignment">,
  usage: UsageMap,
  workshopsById: Map<string, AllocWorkshop>
): boolean {
  return bundle.workshopIds.every((id) => {
    const workshop = workshopsById.get(id);
    if (!workshop) return false;
    const key = slotKey(id, workshop.session, bundle.sessionAssignment);
    return (usage.get(key) ?? 0) < workshop.capacity;
  });
}

export function commitBundle(
  bundle: Pick<Bundle, "workshopIds" | "sessionAssignment">,
  usage: UsageMap,
  workshopsById: Map<string, AllocWorkshop>
): void {
  for (const id of bundle.workshopIds) {
    const workshop = workshopsById.get(id);
    const key = slotKey(id, workshop?.session ?? null, bundle.sessionAssignment);
    usage.set(key, (usage.get(key) ?? 0) + 1);
  }
}

export function releaseBundle(
  bundle: Pick<Bundle, "workshopIds" | "sessionAssignment">,
  usage: UsageMap,
  workshopsById: Map<string, AllocWorkshop>
): void {
  for (const id of bundle.workshopIds) {
    const workshop = workshopsById.get(id);
    const key = slotKey(id, workshop?.session ?? null, bundle.sessionAssignment);
    usage.set(key, Math.max(0, (usage.get(key) ?? 0) - 1));
  }
}
