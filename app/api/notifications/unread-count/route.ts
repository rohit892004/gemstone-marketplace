import { requireApiRole } from "@/lib/auth/require-role";
import { unreadNotificationCount } from "@/lib/notifications/service";

/** Unread notification count for the signed-in buyer or seller. Polled by the header bell. */
export async function GET() {
  const access = await requireApiRole(["BUYER", "SELLER"]);
  if (!access.ok) return access.response;
  const count = await unreadNotificationCount(access.user.id);
  return Response.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
