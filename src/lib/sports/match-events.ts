/**
 * Match event helpers — map sports events to chat system messages.
 */
export function formatEventForChat(event: {
  eventType: string;
  minute?: number | null;
  teamName?: string | null;
  description?: string | null;
  homeScore?: number;
  awayScore?: number;
}): string {
  const minute = event.minute != null ? `${event.minute}'` : "";
  switch (event.eventType) {
    case "goal":
      return `⚽ GOAL ${event.teamName ?? ""} ${event.homeScore ?? ""}-${event.awayScore ?? ""} ${minute}`.trim();
    case "yellow_card":
      return `🟨 Yellow card ${event.teamName ?? ""} ${minute}`.trim();
    case "red_card":
      return `🟥 Red card ${event.teamName ?? ""} ${minute}`.trim();
    case "substitution":
      return `🔄 Substitution ${event.teamName ?? ""} ${minute}`.trim();
    case "period_end":
      return event.description?.toLowerCase().includes("half")
        ? `⏱️ Half time`
        : `🏁 Full time`;
    default:
      return event.description || "Match event";
  }
}
