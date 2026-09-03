export class SofaScoreError extends Error {
  constructor(
    message: string,
    readonly code: "timeout" | "http" | "parse" | "network" | "unknown",
    readonly statusCode?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = "SofaScoreError";
  }
}

export class SyncLockError extends Error {
  constructor(message = "Sync already in progress") {
    super(message);
    this.name = "SyncLockError";
  }
}
