/**
 * Structured JSON logger -- no PII, no tokens, no secrets.
 */
export interface LogEntry {
  level: "info" | "warn" | "error";
  msg: string;
  route?: string;
  gateId?: string;
  ip?: string;
  status?: number;
  reason?: string;
  error?: string;
  currentUserUrn?: string;
  currentUserPermalink?: string;
  artistUrn?: string;
  timestamp: string;
}

export interface LogInput {
  level: "info" | "warn" | "error";
  msg: string;
  route?: string;
  gateId?: string;
  ip?: string;
  status?: number;
  reason?: string;
  error?: string;
  currentUserUrn?: string;
  currentUserPermalink?: string;
  artistUrn?: string;
}

export function log(entry: LogInput): void {
  const full: LogEntry = { ...entry, timestamp: new Date().toISOString() };
  console.log(JSON.stringify(full));
}
