import Image from "next/image";
import { deleteMediaAction, moveMediaAction, setCoverAction } from "@/app/seller/listings/actions";
import { MediaUploadForm } from "@/components/seller/media-upload-form";
import { mediaUrl } from "@/lib/media/urls";
import { MEDIA_LIMITS } from "@/lib/listings/schema";
import { sortMedia } from "@/lib/seller-catalogue/media-rules";

/**
 * Media list for the listing editor. Reorder, cover and delete are plain server-action forms,
 * so they work without client JavaScript and every control is a native button (keyboard accessible).
 */

export interface EditorMedia {
  id: string;
  type: "IMAGE" | "VIDEO";
  sortOrder: number;
  isCover: boolean;
  status: "PROCESSING" | "READY" | "FAILED";
}

const buttonClass =
  " border border-line bg-surface-raised px-3 py-1 text-xs font-medium text-ink disabled:opacity-40";

export function ListingMedia({ listingId, media }: { listingId: string; media: readonly EditorMedia[] }) {
  const ordered = sortMedia(media);
  const images = ordered.filter((m) => m.type === "IMAGE");
  const videos = ordered.filter((m) => m.type === "VIDEO");

  return (
    <section aria-labelledby="media-heading" className="space-y-5">
      <h2 id="media-heading" className="font-heading text-2xl text-ink">
        Photos and videos
      </h2>
      <p className="text-sm text-ink-soft">
        Up to {MEDIA_LIMITS.maxImages} images and {MEDIA_LIMITS.maxVideos} videos. Exactly one image is the cover.
      </p>

      {ordered.length === 0 ? <p className="text-sm text-ink-soft">No media yet.</p> : null}

      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((item, index) => {
          const imageIndex = images.findIndex((m) => m.id === item.id) + 1;
          const label = item.type === "IMAGE" ? `Image ${imageIndex}` : `Video ${videos.findIndex((m) => m.id === item.id) + 1}`;
          const isFirst = index === 0;
          const isLast = index === ordered.length - 1;
          return (
            <li key={item.id} className="space-y-2 border border-line bg-surface-raised p-3">
              <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-accent-soft text-sm text-ink-soft">
                {item.type === "IMAGE" && item.status === "READY" ? (
                  <Image src={mediaUrl(item.id, "thumb")} alt="" fill unoptimized sizes="240px" className="object-cover" />
                ) : (
                  <span>{item.type === "VIDEO" ? "Video" : item.status === "FAILED" ? "Failed" : "Processing"}</span>
                )}
              </div>
              <p className="flex flex-wrap items-center gap-2 text-sm text-ink">
                <span className="font-medium">{label}</span>
                {item.isCover ? <span className=" bg-brand px-2 py-0.5 text-xs text-ivory">Cover</span> : null}
              </p>
              <div className="flex flex-wrap gap-2">
                <form action={moveMediaAction}>
                  <input type="hidden" name="listingId" value={listingId} />
                  <input type="hidden" name="mediaId" value={item.id} />
                  <button type="submit" name="direction" value="up" disabled={isFirst} aria-label={`Move ${label} up`} className={buttonClass}>
                    Move up
                  </button>
                </form>
                <form action={moveMediaAction}>
                  <input type="hidden" name="listingId" value={listingId} />
                  <input type="hidden" name="mediaId" value={item.id} />
                  <button type="submit" name="direction" value="down" disabled={isLast} aria-label={`Move ${label} down`} className={buttonClass}>
                    Move down
                  </button>
                </form>
                {item.type === "IMAGE" && !item.isCover ? (
                  <form action={setCoverAction}>
                    <input type="hidden" name="listingId" value={listingId} />
                    <input type="hidden" name="mediaId" value={item.id} />
                    <button type="submit" className={buttonClass} aria-label={`Set ${label} as cover`}>
                      Set as cover
                    </button>
                  </form>
                ) : null}
                <form action={deleteMediaAction}>
                  <input type="hidden" name="listingId" value={listingId} />
                  <input type="hidden" name="mediaId" value={item.id} />
                  <button type="submit" className={buttonClass} aria-label={`Delete ${label}`}>
                    Delete
                  </button>
                </form>
              </div>
            </li>
          );
        })}
      </ol>

      <MediaUploadForm listingId={listingId} imageCount={images.length} videoCount={videos.length} />
    </section>
  );
}
