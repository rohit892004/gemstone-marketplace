import type { MediaEntry } from "@/lib/valuation/view";

/**
 * Photos and the video of a valuation. Files come from /api/valuation/media, which checks the viewer's access on
 * every request. The gallery itself holds no file paths.
 */
export function MediaGallery({ media }: { media: MediaEntry[] }) {
  if (media.length === 0) {
    return <p className="rounded border border-dashed border-stone-300 p-4 text-sm text-stone-600">No photos or video were added.</p>;
  }
  const sorted = [...media].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label="Photos and video">
      {sorted.map((item, index) => (
        <li key={item.id} className="overflow-hidden rounded border border-stone-300 bg-white">
          {item.kind === "VIDEO" ? (
            <video controls preload="metadata" className="aspect-video w-full bg-black" src={`/api/valuation/media/${item.id}/full`} aria-label={`Video of the stone`}>
              <track kind="captions" />
            </video>
          ) : (
            <a href={`/api/valuation/media/${item.id}/full`} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- served by an access-checked route handler */}
              <img src={`/api/valuation/media/${item.id}/thumb`} alt={`Photo ${index + 1} of the stone`} loading="lazy" className="aspect-square w-full object-cover" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
