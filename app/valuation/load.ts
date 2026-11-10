import type { CurrentUser } from "@/lib/auth/require-role";
import { getValuationView, ValuationError, type Actor } from "@/lib/valuation/service";
import type { ValuationView } from "@/lib/valuation/view";

/**
 * Loads a valuation for the signed-in requester. Returns null when the valuation is missing, or belongs to someone
 * else: the service answers NOT_FOUND for both, so a page cannot tell them apart. Other errors are rethrown.
 */
export async function loadRequesterValuation(id: string, user: CurrentUser): Promise<ValuationView | null> {
  const actor: Actor = { id: user.id, role: user.role };
  try {
    return await getValuationView(id, actor);
  } catch (error) {
    if (error instanceof ValuationError) return null;
    throw error;
  }
}
