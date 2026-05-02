import { useEffect, useState } from "react";
import { Loader2, ImageOff } from "lucide-react";
import { getSignedPhotoUrl } from "@/lib/photos";

interface Props {
  storagePath: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Renders a photo from Supabase Storage. Resolves a signed URL on mount,
 * caches it, and shows a loader/fallback during fetch.
 */
export function PhotoImage({ storagePath, alt = "", className, onClick }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setUrl(null);

    // Booking photos from the public bucket are stored as full https:// URLs.
    // Use them directly instead of trying to sign them against the private bucket.
    if (storagePath.startsWith("https://") || storagePath.startsWith("http://")) {
      setUrl(storagePath);
      return;
    }

    getSignedPhotoUrl(storagePath).then((u) => {
      if (cancelled) return;
      if (!u) setError(true);
      else setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  if (error) {
    return (
      <div
        className={
          "flex items-center justify-center bg-muted/40 text-muted-foreground " +
          (className ?? "")
        }
      >
        <ImageOff className="h-5 w-5" />
      </div>
    );
  }

  if (!url) {
    return (
      <div
        className={
          "flex items-center justify-center bg-muted/40 " + (className ?? "")
        }
      >
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      onClick={onClick}
      loading="lazy"
      className={(onClick ? "cursor-zoom-in " : "") + (className ?? "")}
    />
  );
}
