import type { MatchStatus } from "./types";

export type ApplicationMatchStatus = MatchStatus;

type StatusInput = {
  code?: number | null;
  type?: string | null;
  description?: string | null;
};

/**
 * Explicit SofaScore → application status mapping.
 * Never infer LIVE from "not finished".
 */
export function mapSofaScoreStatus(input: StatusInput): ApplicationMatchStatus {
  const code = input.code ?? null;
  const type = (input.type || "").toLowerCase();
  const desc = (input.description || "").toLowerCase();

  if (code === 0 || type === "notstarted" || desc.includes("not started")) {
    return "upcoming";
  }

  if (
    code === 100 ||
    type === "finished" ||
    desc.includes("ended") ||
    desc.includes("finished") ||
    desc.includes("after penalties") ||
    desc.includes("after extra time")
  ) {
    return "finished";
  }

  if (code === 60 || type === "postponed" || desc.includes("postponed")) {
    return "postponed";
  }

  if (
    code === 70 ||
    type === "canceled" ||
    type === "cancelled" ||
    desc.includes("cancelled") ||
    desc.includes("canceled")
  ) {
    return "canceled";
  }

  if (
    code === 80 ||
    type === "suspended" ||
    type === "interrupted" ||
    desc.includes("suspended") ||
    desc.includes("interrupted")
  ) {
    return "suspended";
  }

  if (
    code === 31 ||
    desc.includes("halftime") ||
    desc.includes("half time") ||
    desc === "ht"
  ) {
    return "halftime";
  }

  if (
    type === "inprogress" ||
    type === "live" ||
    (code != null && code > 0 && code < 100 && code !== 60 && code !== 70 && code !== 80)
  ) {
    if (desc.includes("half") && !desc.includes("halftime")) {
      // e.g. "2nd half" — still live
      return "live";
    }
    if (desc.includes("halftime") || desc.includes("half time")) {
      return "halftime";
    }
    return "live";
  }

  if (desc.includes("live") || desc.includes("progress")) {
    return "live";
  }

  if (type && !["notstarted", "finished"].includes(type)) {
    console.warn("[status-mapper] unknown SofaScore status", input);
    return "unknown";
  }

  if (code == null && !type && !desc) {
    return "upcoming";
  }

  console.warn("[status-mapper] unmapped SofaScore status — defaulting to unknown", input);
  return "unknown";
}

export function statusFlags(status: ApplicationMatchStatus): {
  isLive: boolean;
  isFinished: boolean;
  isPostponed: boolean;
  isCanceled: boolean;
  isUpcoming: boolean;
} {
  return {
    isLive: status === "live" || status === "halftime",
    isFinished: status === "finished",
    isPostponed: status === "postponed",
    isCanceled: status === "canceled",
    isUpcoming: status === "upcoming",
  };
}

export function statusLabel(status: ApplicationMatchStatus): string {
  const labels: Record<ApplicationMatchStatus, string> = {
    upcoming: "Επερχόμενος",
    live: "LIVE",
    halftime: "Ημίχρονο",
    finished: "Τελικό",
    postponed: "Αναβλήθηκε",
    canceled: "Ακυρώθηκε",
    suspended: "Διακόπηκε",
    unknown: "Άγνωστο",
  };
  return labels[status] ?? status;
}

export function isDisplayLive(status: ApplicationMatchStatus): boolean {
  return status === "live";
}
