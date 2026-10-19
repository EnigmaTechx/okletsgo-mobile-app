/**
 * Short, human countdown to a pickup time, for the driver's "Next pickup"
 * strip: "in 48 min", "in 2 h 10 min", "in 3 days". Past times read "now"
 * for the first few minutes (the driver is running to it), then "overdue".
 */
export const timeUntil = (iso: string, now = new Date()): string => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffMin = Math.round((t - now.getTime()) / 60000);

  if (diffMin <= -15) return "overdue";
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `in ${diffMin} min`;

  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (hours < 24) return mins ? `in ${hours} h ${mins} min` : `in ${hours} h`;

  const days = Math.round(diffMin / 1440);
  return days === 1 ? "tomorrow" : `in ${days} days`;
};
