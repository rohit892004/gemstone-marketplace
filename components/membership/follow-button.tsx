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
            ? "w-full rounded-md border border-brand bg-accent-soft px-4 py-2.5 text-center text-sm font-medium text-brand-strong disabled:opacity-60"
            : "w-full rounded-md bg-brand px-4 py-2.5 text-center text-sm font-medium text-white disabled:opacity-60"
        }
      >
        {isFollowing ? "Following" : "Follow seller"}
      </button>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
