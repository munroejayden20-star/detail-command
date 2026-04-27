import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/store";
import { useAuth } from "@/auth/AuthProvider";
import { uploadPhoto } from "@/lib/photos";
import type { PhotoType } from "@/lib/types";

interface Props {
  defaultType?: PhotoType;
  customerId?: string;
  appointmentId?: string;
  vehicle?: string;
  /** Compact button vs full dropzone */
  variant?: "button" | "dropzone";
  onUploaded?: () => void;
  className?: string;
  label?: string;
}

/**
 * Upload one or more photos. Resizes client-side, uploads to Storage,
 * dispatches `addPhoto` to insert metadata.
 */
export function PhotoUploader({
  defaultType = "general",
  customerId,
  appointmentId,
  vehicle,
  variant = "button",
  onUploaded,
  className,
  label,
}: Props) {
  const { user } = useAuth();
  const { dispatch } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length || !user) return;
    setBusy(true);
    let okCount = 0;
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} isn't an image — skipped`);
          continue;
        }
        try {
          const photo = await uploadPhoto(file, user.id, {
            type: defaultType,
            customerId,
            appointmentId,
            vehicle,
          });
          dispatch({ type: "addPhoto", photo });
          okCount += 1;
        } catch (err: any) {
          console.error("[photos] upload failed", err);
          toast.error(`Upload failed: ${err?.message ?? "unknown error"}`);
        }
      }
      if (okCount > 0) {
        toast.success(`${okCount} photo${okCount === 1 ? "" : "s"} uploaded`);
        onUploaded?.();
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (variant === "dropzone") {
    return (
      <label
        className={
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent " +
          (className ?? "")
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        {busy ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Uploading…</span>
          </>
        ) : (
          <>
            <ImagePlus className="h-6 w-6" />
            <span className="font-medium">{label ?? "Upload photos"}</span>
            <span className="text-[11px]">
              Tap to choose, or drag and drop
            </span>
          </>
        )}
      </label>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={className}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}
        {label ?? "Add photo"}
      </Button>
    </>
  );
}
