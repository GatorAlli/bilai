"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { GripVertical, ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { compressImage, ImageUploadError } from "@/lib/compress-image";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGES,
  MAX_INPUT_SIZE_BYTES,
  MAX_INPUT_SIZE_MB,
} from "@/lib/cat-limits";

export type GalleryImage = {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
};

const ACCEPTED_TYPES: string[] = [...ACCEPTED_IMAGE_TYPES];

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function ImageGallery({
  images,
  onChange,
}: {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reorder (drag) state
  const [armedId, setArmedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Preview URLs are object URLs, which must be revoked to free memory.
  // Keep the latest list in a ref so we can clean up when the form unmounts.
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  async function addFiles(fileList: FileList | File[]) {
    if (isProcessing) return;
    const incoming = Array.from(fileList);
    const nextErrors: string[] = [];
    const accepted: GalleryImage[] = [];
    let slotsLeft = MAX_IMAGES - images.length;

    setIsProcessing(true);
    try {
      for (const file of incoming) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          nextErrors.push(`${file.name}: this file isn't a photo we can use.`);
        } else if (file.size > MAX_INPUT_SIZE_BYTES) {
          nextErrors.push(
            `${file.name}: this photo is too large (over ${MAX_INPUT_SIZE_MB} MB).`,
          );
        } else if (slotsLeft <= 0) {
          nextErrors.push(
            `${file.name}: you can add up to ${MAX_IMAGES} photos.`,
          );
        } else {
          try {
            // One at a time so a big batch doesn't freeze the page.
            const compressed = await compressImage(file);
            accepted.push({
              id: crypto.randomUUID(),
              file: compressed,
              previewUrl: URL.createObjectURL(compressed),
              caption: "",
            });
            slotsLeft -= 1;
          } catch (err) {
            // compressImage only throws ImageUploadError, whose message is
            // user-friendly; anything else is unexpected.
            if (err instanceof ImageUploadError) {
              nextErrors.push(err.message);
            } else {
              console.error(err);
              nextErrors.push(`${file.name}: upload failed.`);
            }
          }
        }
      }
    } finally {
      setIsProcessing(false);
    }

    setErrors(nextErrors);
    if (accepted.length > 0) onChange([...images, ...accepted]);
  }

  function removeImage(id: string) {
    const target = images.find((img) => img.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    setErrors([]);
    onChange(images.filter((img) => img.id !== id));
  }

  function setCaption(id: string, caption: string) {
    onChange(images.map((img) => (img.id === id ? { ...img, caption } : img)));
  }

  function resetDrag() {
    setArmedId(null);
    setDraggingId(null);
    setOverId(null);
  }

  function dropOn(targetId: string) {
    if (draggingId && draggingId !== targetId) {
      const from = images.findIndex((img) => img.id === draggingId);
      const to = images.findIndex((img) => img.id === targetId);
      if (from !== -1 && to !== -1) onChange(moveItem(images, from, to));
    }
    resetDrag();
  }

  const isFull = images.length >= MAX_IMAGES;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-extrabold">Cat photos</h2>
          <span className="text-sm text-muted-foreground">
            {images.length} / {MAX_IMAGES}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Add up to {MAX_IMAGES} photos, {MAX_INPUT_SIZE_MB} MB each. The first photo is the cover.
        </p>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setIsDropTarget(true);
        }}
        onDragLeave={() => setIsDropTarget(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setIsDropTarget(false);
          if (isProcessing) return;
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-lg transition-colors",
          isDropTarget && "border-secondary bg-secondary/15",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          aria-label="Add cat photos"
          multiple
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            // Reset so choosing the same file again still fires onChange.
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11 bg-card font-bold"
          disabled={isFull || isProcessing}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus />
          Add photos
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {isProcessing
            ? "Processing…"
            : isFull
              ? "Image limit reached"
              : "or drag and drop"}
        </p>
      </div>

      {errors.length > 0 && (
        <ul
          role="alert"
          className="flex flex-col gap-1 text-sm text-destructive"
        >
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {/* Uploaded images */}
      {images.length > 0 && (
        <ul className="flex flex-col gap-3">
          {images.map((img, index) => (
            <li
              key={img.id}
              draggable={armedId === img.id}
              onDragStart={(e) => {
                setDraggingId(img.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", img.id);
              }}
              onDragOver={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                if (overId !== img.id) setOverId(img.id);
              }}
              onDrop={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                dropOn(img.id);
              }}
              onDragEnd={resetDrag}
              className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-card p-3 transition-opacity sm:flex sm:gap-3",
                draggingId === img.id && "opacity-40",
                overId === img.id &&
                  draggingId !== img.id &&
                  "border-secondary ring-2 ring-secondary/50",
              )}
            >
              <button
                type="button"
                aria-label={`Reorder image ${index + 1}. Drag, or use the up and down arrow keys.`}
                className="cursor-grab touch-none rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
                onPointerDown={() => setArmedId(img.id)}
                onPointerUp={() => setArmedId(null)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp" && index > 0) {
                    e.preventDefault();
                    onChange(moveItem(images, index, index - 1));
                  } else if (
                    e.key === "ArrowDown" &&
                    index < images.length - 1
                  ) {
                    e.preventDefault();
                    onChange(moveItem(images, index, index + 1));
                  }
                }}
              >
                <GripVertical className="size-5" />
              </button>

              <div className="relative col-span-2 h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-background sm:h-20 sm:w-32">
                <Image
                  src={img.previewUrl}
                  alt={img.caption || img.file.name}
                  fill
                  unoptimized
                  draggable={false}
                  className="object-cover"
                />
                {index === 0 && (
                  <span className="absolute top-1 left-1 rounded-md bg-secondary px-1.5 py-0.5 text-[0.65rem] font-semibold text-secondary-foreground">
                    Cover
                  </span>
                )}
              </div>

              <Input
                aria-label={`Caption for image ${index + 1}`}
                placeholder="Add a caption (optional)"
                value={img.caption}
                onChange={(e) => setCaption(img.id, e.target.value)}
                className="col-span-2 row-start-2 h-11 min-w-0 flex-1 bg-background"
              />

              <span className="hidden w-5 text-center text-sm text-muted-foreground sm:block">
                {index + 1}
              </span>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-start-3 row-start-2"
                aria-label={`Remove image ${index + 1}`}
                onClick={() => removeImage(img.id)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
