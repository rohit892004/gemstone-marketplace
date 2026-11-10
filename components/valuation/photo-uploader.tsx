"use client";

import Image from "next/image";
import { useActionState, useEffect, useId, useRef, useState, useTransition, type ChangeEvent } from "react";
import { addMediaAction, removeMediaAction } from "@/app/valuation/actions";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";
import {
  PHOTO_ACCEPT,
  PHOTO_LIMIT,
  VIDEO_ACCEPT,
  VIDEO_LIMIT,
  photosRemaining,
} from "@/lib/valuation/requester-form";
import { ErrorSummary, inputClass, primaryButtonClass } from "./ui";

export interface UploaderMedia {
  id: string;
  kind: "IMAGE" | "VIDEO";
  mimeType: string;
}

export interface PhotoUploaderProps {
  valuationId: string;
  media: UploaderMedia[];
  /** False when the request can no longer take photos (for example, after submission). */
  canAdd: boolean;
  /** False when the request can no longer lose photos. */
  canRemove: boolean;
  /** Heading for the section, so the same component reads correctly on step 1 and on the "needs more information" page. */
  heading?: string;
}

/**
 * Photos and the optional video. Each file goes to the server, which runs the media pipeline (type check, EXIF
 * removal, size). The photo limit is shown here and enforced on the server.
 */
export function PhotoUploader({ valuationId, media, canAdd, canRemove, heading = "Photos and video" }: PhotoUploaderProps) {
  const ids = useId();
  const [state, formAction, pending] = useActionState(addMediaAction, null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [, startRemove] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const photos = media.filter((m) => m.kind === "IMAGE");
  const videos = media.filter((m) => m.kind === "VIDEO");
  const remaining = photosRemaining(photos.length);
  const videoFull = videos.length >= VIDEO_LIMIT;

  // Clear the file inputs once a batch has been added.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const errorFor = (field: "photos" | "video"): string | null => (state && !state.ok && state.field === field ? state.error : null);
  const photoError = clientError ?? errorFor("photos");
  const videoError = errorFor("video");

  // Checked when files are chosen, so a batch over the limit is cleared before it reaches the server.
  function onPhotosChange(e: ChangeEvent<HTMLInputElement>) {
    const count = e.currentTarget.files?.length ?? 0;
    if (count > remaining) {
      setClientError(
        remaining === 0
          ? `You have reached the limit of ${PHOTO_LIMIT} photos for this valuation.`
          : `You can add ${remaining} more photo${remaining === 1 ? "" : "s"}. Choose ${remaining} or fewer files.`,
      );
      e.currentTarget.value = "";
      return;
    }
    setClientError(null);
  }

  function remove(mediaId: string) {
    setRemoveError(null);
    startRemove(async () => {
      const result = await removeMediaAction(valuationId, mediaId);
      if (!result.ok) setRemoveError(result.error);
    });
  }

  const summary = [photoError, videoError, removeError].filter((m): m is string => !!m);

  return (
    <section aria-labelledby={`${ids}-photos`} className="space-y-4">
      <div>
        <h2 id={`${ids}-photos`} className="font-heading text-2xl text-ink">
          {heading}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          At least one clear photo of the stone is needed. Use JPEG, PNG or WebP photos, up to {PHOTO_LIMIT}. iPhone HEIC photos must be converted to JPEG first. You can add one MP4 or WebM video.
          Photos are for the expert valuer. The automatic estimate does not look at them.
        </p>
      </div>

      <ErrorSummary messages={summary} title="The files were not added" />
      {state && state.ok && state.message ? (
        <p role="status" className="text-sm text-ink-soft">
          {state.message}
        </p>
      ) : null}

      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label="Photos added">
          {photos.map((photo, index) => (
            <li key={photo.id} className="space-y-2">
              <div className="relative aspect-square overflow-hidden border border-line bg-surface">
                <Image
                  src={REQUESTER_PATHS.media(photo.id, "thumb")}
                  alt={`Photo ${index + 1} of ${photos.length}`}
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                  unoptimized
                  className="object-cover"
                />
              </div>
              {canRemove ? (
                <button type="button" onClick={() => remove(photo.id)} className="text-sm text-brand-strong underline underline-offset-4">
                  Remove photo {index + 1}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="border border-dashed border-line bg-surface-raised px-4 py-6 text-center text-sm text-ink-soft">No photos yet.</p>
      )}

      {videos.length > 0 ? (
        <div className="space-y-2">
          {videos.map((video) => (
            <div key={video.id} className="space-y-2">
              <video controls preload="metadata" src={REQUESTER_PATHS.media(video.id, "full")} className="max-h-64 w-full border border-line bg-night" aria-label="Video of the stone" />
              {canRemove ? (
                <button type="button" onClick={() => remove(video.id)} className="text-sm text-brand-strong underline underline-offset-4">
                  Remove video
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {canAdd ? (
        <form ref={formRef} action={formAction} className="space-y-4 border border-line bg-surface-raised p-4">
          <input type="hidden" name="valuationId" value={valuationId} />
          <div className="space-y-1">
            <label htmlFor={`${ids}-files`} className="block text-sm font-medium text-ink">
              Add photos
            </label>
            <input
              id={`${ids}-files`}
              name="files"
              type="file"
              multiple
              accept={PHOTO_ACCEPT}
              onChange={onPhotosChange}
              disabled={remaining === 0}
              aria-describedby={`${ids}-files-hint`}
              className="block w-full text-sm text-ink file:mr-3 file:border file:border-brand file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-strong"
            />
            <p id={`${ids}-files-hint`} className="text-xs text-ink-soft">
              {remaining > 0 ? `You can add ${remaining} more, up to ${PHOTO_LIMIT} in total.` : `You have reached the limit of ${PHOTO_LIMIT} photos.`}
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor={`${ids}-video`} className="block text-sm font-medium text-ink">
              Video (optional)
            </label>
            <input
              id={`${ids}-video`}
              name="video"
              type="file"
              accept={VIDEO_ACCEPT}
              disabled={videoFull}
              aria-describedby={`${ids}-video-hint`}
              className={`${inputClass} mt-0 file:mr-3 file:border file:border-brand file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-strong`}
            />
            <p id={`${ids}-video-hint`} className="text-xs text-ink-soft">
              {videoFull ? "You have added a video. Remove it to add another." : "One video, MP4 or WebM."}
            </p>
          </div>

          <button type="submit" disabled={pending || (remaining === 0 && videoFull)} className={primaryButtonClass}>
            {pending ? "Adding..." : "Add to valuation"}
          </button>
        </form>
      ) : null}

    </section>
  );
}
