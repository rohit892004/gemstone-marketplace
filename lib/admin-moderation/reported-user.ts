/**
 * Which user a report is about, for an optional messaging restriction. Pure.
 *
 * A report about a specific message names that message's sender. A report about a whole
 * conversation names the other participant, but only when there is exactly one, so a restriction
 * never lands on the wrong person. Otherwise there is no single target and the admin cannot restrict.
 */
export function pickReportedUserId(input: {
  reporterId: string;
  participantIds: readonly string[];
  messageSenderId: string | null;
}): string | null {
  if (input.messageSenderId && input.messageSenderId !== input.reporterId) return input.messageSenderId;
  const others = [...new Set(input.participantIds)].filter((id) => id !== input.reporterId);
  return others.length === 1 ? others[0] : null;
}
