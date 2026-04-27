import { useState } from "react";
import { PhotoImage } from "./PhotoImage";
import { PhotoLightbox } from "./PhotoLightbox";
import { PHOTO_TYPES, type Photo } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  photos: Photo[];
  /** Tile size: "sm" for inline gallery, "md" for the dedicated photos page */
  size?: "sm" | "md";
  emptyText?: string;
  className?: string;
}

/**
 * Grid of photo thumbnails. Click a tile to open the lightbox.
 */
export function PhotoGallery({
  photos,
  size = "md",
  emptyText = "No photos yet.",
  className,
}: Props) {
  const [openIdx, setOpenIdx] = useState(-1);

  if (!photos.length) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {emptyText}
      </p>
    );
  }

  const tile = size === "sm" ? "h-24" : "h-40";

  return (
    <>
      <div
        className={cn(
          "grid gap-2",
          size === "sm"
            ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
          className
        )}
      >
        {photos.map((p, idx) => {
          const tone =
            PHOTO_TYPES.find((t) => t.value === p.type)?.tone ?? "";
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => setOpenIdx(idx)}
              className="group relative overflow-hidden rounded-lg border bg-muted/30 transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <PhotoImage
                storagePath={p.storagePath}
                alt={p.notes ?? p.type}
                className={cn("w-full object-cover", tile)}
              />
              <span
                className={cn(
                  "absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  tone
                )}
              >
                {PHOTO_TYPES.find((t) => t.value === p.type)?.label ?? "Photo"}
              </span>
            </button>
          );
        })}
      </div>
      <PhotoLightbox
        photos={photos}
        index={openIdx}
        onIndexChange={setOpenIdx}
        onClose={() => setOpenIdx(-1)}
      />
    </>
  );
}
