import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Trash2, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PhotoImage } from "./PhotoImage";
import { useStore } from "@/store/store";
import { removePhotoFile } from "@/lib/photos";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  PHOTO_TYPES,
  type Photo,
  type PhotoType,
} from "@/lib/types";
import { getSignedPhotoUrl } from "@/lib/photos";

interface Props {
  photos: Photo[];
  /** Index in the `photos` array that's currently open. -1 = closed. */
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/** Full-screen lightbox with prev/next, type/notes editor, delete, download. */
export function PhotoLightbox({ photos, index, onIndexChange, onClose }: Props) {
  const { dispatch, data } = useStore();
  const photo = index >= 0 && index < photos.length ? photos[index] : null;
  const [notesDraft, setNotesDraft] = useState("");

  useEffect(() => {
    setNotesDraft(photo?.notes ?? "");
  }, [photo?.id, photo?.notes]);

  // Keyboard nav
  useEffect(() => {
    if (!photo) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") onIndexChange(Math.max(0, index - 1));
      if (e.key === "ArrowRight")
        onIndexChange(Math.min(photos.length - 1, index + 1));
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photo, index, photos.length, onIndexChange, onClose]);

  if (!photo) return null;

  const customer = photo.customerId
    ? data.customers.find((c) => c.id === photo.customerId)
    : null;

  function saveNotes() {
    if (!photo) return;
    if ((photo.notes ?? "") === notesDraft) return;
    dispatch({ type: "updatePhoto", id: photo.id, patch: { notes: notesDraft } });
    toast.success("Notes saved");
  }

  function setType(t: PhotoType) {
    if (!photo) return;
    dispatch({ type: "updatePhoto", id: photo.id, patch: { type: t } });
  }

  async function download() {
    if (!photo) return;
    const url = await getSignedPhotoUrl(photo.storagePath);
    if (!url) {
      toast.error("Could not get download link");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = photo.storagePath.split("/").pop() ?? "photo.jpg";
    a.target = "_blank";
    a.rel = "noreferrer";
    a.click();
  }

  async function handleDelete() {
    if (!photo) return;
    if (!window.confirm("Delete this photo? Can't be undone.")) return;
    try {
      await removePhotoFile(photo.storagePath);
    } catch (e) {
      // continue — even if storage delete fails we still want metadata gone
      console.error("[photos] storage delete failed", e);
    }
    dispatch({ type: "deletePhoto", id: photo.id });
    toast.success("Photo deleted");
    if (photos.length === 1) onClose();
    else onIndexChange(Math.min(index, photos.length - 2));
  }

  return (
    <Dialog open={!!photo} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <DialogTitle className="sr-only">Photo viewer</DialogTitle>
        <DialogDescription className="sr-only">
          Inspect, annotate, or delete a photo from your library.
        </DialogDescription>
        <div className="relative bg-black">
          <PhotoImage
            storagePath={photo.storagePath}
            className="max-h-[60vh] w-full object-contain"
            alt={photo.notes ?? "Photo"}
          />
          {/* Prev/next */}
          {index > 0 ? (
            <button
              type="button"
              onClick={() => onIndexChange(index - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
          {index < photos.length - 1 ? (
            <button
              type="button"
              onClick={() => onIndexChange(index + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white">
            {index + 1} / {photos.length}
          </span>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                "text-[11px] " +
                (PHOTO_TYPES.find((p) => p.value === photo.type)?.tone ?? "")
              }
            >
              {PHOTO_TYPES.find((p) => p.value === photo.type)?.label ?? "Photo"}
            </Badge>
            {customer ? (
              <Badge variant="outline" className="text-[11px]">
                {customer.name}
              </Badge>
            ) : null}
            {photo.vehicle ? (
              <Badge variant="outline" className="text-[11px]">
                {photo.vehicle}
              </Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {format(parseISO(photo.createdAt), "MMM d, yyyy · p")}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <div className="space-y-1.5">
              <Label htmlFor="ph-notes">Notes</Label>
              <Textarea
                id="ph-notes"
                rows={3}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={saveNotes}
                placeholder="Anything worth remembering — stains, condition, location…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={photo.type} onValueChange={(v) => setType(v as PhotoType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHOTO_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <Button variant="ghost" size="sm" onClick={download}>
              <Download className="h-4 w-4" /> Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
