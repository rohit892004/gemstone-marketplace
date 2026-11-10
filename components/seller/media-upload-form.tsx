"use client";

import { useActionState } from "react";
import { uploadMediaAction, type MediaUploadState } from "@/app/seller/listings/actions";
import { MEDIA_LIMITS } from "@/lib/listings/schema";
import { ImageFileField } from "@/components/seller/catalogue-fields";

const initialState: MediaUploadState = {};

export function MediaUploadForm({ listingId, imageCount, videoCount }: { listingId: string; imageCount: number; videoCount: number }) {
  const [state, formAction, pending] = useActionState(uploadMediaAction, initialState);
  const imagesLeft = MEDIA_LIMITS.maxImages - imageCount;
  const videosLeft = MEDIA_LIMITS.maxVideos - videoCount;
  const full = imagesLeft <= 0 && videosLeft <= 0;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      <ImageFileField
        name="media"
        label="Add images or videos"
        multiple
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        hint={`${Math.max(imagesLeft, 0)} image slot(s) and ${Math.max(videosLeft, 0)} video slot(s) left. Photos: JPEG, PNG or WebP, up to 15 MB. Videos: MP4 or WebM, up to 60 MB. iPhone HEIC photos must be converted to JPEG first.`}
        error={state.error}
      />
      {state.message ? (
        <p role="status" className="text-sm text-ink-soft">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || full}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Uploading..." : "Upload"}
      </button>
    </form>
  );
}
