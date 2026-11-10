"use client";

import { useActionState } from "react";
import { toggleFollowAction, type FollowState } from "@/app/sellers/[slug]/follow-actions";

const initial: FollowState = {};

/** Follow or unfollow a seller. The server decides; this only shows the result. */
export function FollowButton({ sellerSlug, following }: { sellerSlug: string; following: boolean }) {
  const [state, formAction, pending] = useActionState(toggleFollowAction, initial);
  const isFollowing = state.following ?? following;
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="sellerSlug" value={sellerSlug} />
      <button
        type="submit"
        disabled={pending}
        className={
          isFollowing
            ? "w-full min-h-11 border border-brand bg-accent-soft px-4 py-3 text-center text-sm font-medium text-ink disabled:opacity-60"
            : "w-full min-h-11 bg-brand px-4 py-3 text-center text-sm font-medium text-ivory hover:bg-brand-strong disabled:opacity-60"
        }
      >
        {isFollowing ? "Following" : "Follow seller"}
      </button>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
