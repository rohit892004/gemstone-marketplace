import Image from "next/image";
import { REQUESTER_PATHS } from "@/lib/valuation/requester-paths";

/** Read-only photos and video for the review step and the result page. Served only to the requester. */
export function PhotoGrid({ media }: { media: { id: string; kind: "IMAGE" | "VIDEO" }[] }) {
  const photos = media.filter((m) => m.kind === "IMAGE");
  const videos = media.filter((m) => m.kind === "VIDEO");
  if (photos.length === 0 && videos.length === 0) {
    return <p className="text-sm text-ink-soft">No photos yet.</p>;
  }
  return (
    <div className="space-y-4">
      {photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {photos.map((photo, index) => (
            <li key={photo.id} className="relative aspect-square overflow-hidden border border-line bg-surface">
              <Image
                src={REQUESTER_PATHS.media(photo.id, "thumb")}
                alt={`Photo ${index + 1} of ${photos.length}`}
                fill
                sizes="(min-width: 1024px) 16vw, 33vw"
                unoptimized
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}
      {videos.map((video) => (
        <video key={video.id} controls preload="metadata" src={REQUESTER_PATHS.media(video.id, "full")} className="max-h-64 w-full border border-line bg-night" aria-label="Video of the stone" />
      ))}
    </div>
  );
}
