export function formatDuration(minutes: 60 | 120): string {
  return minutes === 60 ? "1 Stunde" : "2 Stunden";
}
