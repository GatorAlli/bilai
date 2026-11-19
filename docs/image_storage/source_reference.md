# Listing photo storage source reference

[Guide home](README.md) · [Tutorial](tutorial.md) · [Quiz](quiz.md)

The full files below preserve the implementation, including imports, comments, JSX, and blank lines. Shared schema, auth, command, and page files have excerpts at the points where they connect to photo storage. The line numbers refer to the source files. Treat each code block as a reading reference for its chapter.

- [Pick and compress](#pick-and-compress)
  - [Shared photo limits](#shared-photo-limits)
  - [Upload page](#upload-page)
  - [Photo picker and previews](#photo-picker-and-previews)
  - [WebP encoder](#webp-encoder)
  - [Listing form](#listing-form)
- [Validate and save](#validate-and-save)
  - [Request body limit](#request-body-limit)
  - [Listing Server Action](#listing-server-action)
  - [Session lookup](#session-lookup)
  - [Database connection](#database-connection)
  - [Listing and photo schema](#listing-and-photo-schema)
  - [Photo data migration](#photo-data-migration)
  - [Migration configuration](#migration-configuration)
- [Read and serve](#read-and-serve)
  - [Listing and photo queries](#listing-and-photo-queries)
  - [Cover card](#cover-card)
  - [Featured cats](#featured-cats)
  - [Home page call site](#home-page-call-site)
  - [Find a Cat call sites](#find-a-cat-call-sites)
  - [Profile call sites](#profile-call-sites)
  - [Listing detail page](#listing-detail-page)
  - [Photo GET handler](#photo-get-handler)
- [Clean up and recover](#clean-up-and-recover)
  - [Upload helpers](#upload-helpers)
  - [Owner deletion controls](#owner-deletion-controls)
  - [Owner deletion action](#owner-deletion-action)
  - [Listing expiry](#listing-expiry)
  - [Legacy photo sync](#legacy-photo-sync)
  - [Package commands](#package-commands)
  - [Deletion tests](#deletion-tests)

## Pick and compress

### Shared photo limits

[`lib/cat-limits.ts`](../../lib/cat-limits.ts) · lines 1–26

<!-- prettier-ignore -->
```ts
// Shared between the client form and the server actions.
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
export const MAX_IMAGES = 5;

// What the user may pick (phone photos are big); we shrink them afterwards.
export const MAX_INPUT_SIZE_MB = 25;
export const MAX_INPUT_SIZE_BYTES = MAX_INPUT_SIZE_MB * 1024 * 1024;

// What we store: always WebP, long edge <= 1600px, <= 1 MB.
export const MAX_DIMENSION = 1600;
export const TARGET_SIZE_BYTES = 1 * 1024 * 1024;
// Server accepts a little slack over the target.
export const MAX_STORED_SIZE_BYTES = Math.round(1.25 * 1024 * 1024);

export const CAT_STATUSES = ["available", "pending", "adopted"] as const;
export const YES_NO_UNKNOWN = ["yes", "no", "unknown"] as const;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_TEMPERAMENT_LENGTH = 200;
export const MAX_REHOMING_REASON_LENGTH = 500;
export const CONTACT_METHODS = ["whatsapp", "call"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];
```

### Upload page

[`app/(pages)/add_a_cat/page.tsx`](../../app/%28pages%29/add_a_cat/page.tsx) · lines 1–26

<!-- prettier-ignore -->
```tsx
import type { Metadata } from "next";
import BilaiPage from "@/components/view/BilaiPage";
import { headingText, headingTitle } from "@/components/view/styles";
import ListACat from "./ListACat";

export const metadata: Metadata = { title: "List a cat" };

export default function ListACatPage() {
  return (
    <BilaiPage
      currentPage="list"
      mainClassName="frame grid grid-cols-[minmax(14rem,1fr)_minmax(0,2.35fr)] items-start gap-x-[clamp(2rem,5vw,5rem)] gap-y-6 py-section max-nav:grid-cols-1"
    >
      <header>
        <h1 id="list-title" className={headingTitle}>
          List a cat
        </h1>
        <p className={headingText}>
          Share a recent photo and tell adopters what they should know about
          your cat.
        </p>
      </header>
      <ListACat />
    </BilaiPage>
  );
}
```

### Photo picker and previews

[`app/(pages)/add_a_cat/ImageGallery.tsx`](../../app/%28pages%29/add_a_cat/ImageGallery.tsx) · lines 1–319

<!-- prettier-ignore -->
```tsx
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
          Add up to {MAX_IMAGES} photos, {MAX_INPUT_SIZE_MB} MB each. The first
          photo is the cover.
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
```

### WebP encoder

[`lib/compress-image.ts`](../../lib/compress-image.ts) · lines 1–91

<!-- prettier-ignore -->
```ts
import { MAX_DIMENSION, TARGET_SIZE_BYTES } from "@/lib/cat-limits";

/** Thrown with a message that is safe to show to the user. */
export class ImageUploadError extends Error {}

/**
 * Picks the first-pass WebP quality from how far over the target the original
 * file is. Small files keep more detail; huge ones start lower so the first
 * pass usually lands under the limit on its own.
 */
function firstPassQuality(fileSize: number) {
  const ratio = fileSize / TARGET_SIZE_BYTES;
  if (ratio <= 2) return 0.82;
  if (ratio <= 5) return 0.72;
  if (ratio <= 10) return 0.62;
  return 0.52;
}

function encodeWebp(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context is unavailable.");
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
}

/**
 * Resizes to MAX_DIMENSION and re-encodes as WebP under TARGET_SIZE_BYTES,
 * in at most two encodes. Errors thrown are ImageUploadError with a plain
 * message; the technical cause goes to the console.
 */

export async function compressImage(file: File): Promise<File> {
  let bitmap: ImageBitmap | undefined;
  try {
    // "from-image" applies the photo's rotation before EXIF is stripped.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    let width = Math.round(bitmap.width * scale);
    let height = Math.round(bitmap.height * scale);
    const quality = firstPassQuality(file.size);

    let blob = await encodeWebp(bitmap, width, height, quality);
    if (!blob) throw new Error("canvas.toBlob returned null.");
    // Browsers that can't encode WebP silently return PNG instead.
    if (blob.type !== "image/webp") {
      throw new Error(`Browser can't encode WebP (got ${blob.type}).`);
    }

    if (blob.size > TARGET_SIZE_BYTES) {
      // Second (last) pass: file size scales roughly with pixel count, so
      // shrink the area by the overshoot, with 10% headroom.
      const shrink = Math.sqrt((TARGET_SIZE_BYTES * 0.9) / blob.size);
      width = Math.max(1, Math.round(width * shrink));
      height = Math.max(1, Math.round(height * shrink));
      blob = await encodeWebp(bitmap, width, height, quality);
      if (!blob) throw new Error("canvas.toBlob returned null.");
    }

    if (blob.size > TARGET_SIZE_BYTES) {
      console.error(
        `${file.name}: still ${blob.size} bytes after two passes (target ${TARGET_SIZE_BYTES}).`,
      );
      throw new ImageUploadError(
        `${file.name}: this photo is too large. Please try a different one.`,
      );
    }

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch (err) {
    if (err instanceof ImageUploadError) throw err;
    console.error(`Compressing ${file.name} failed:`, err);
    throw new ImageUploadError(`${file.name}: upload failed.`);
  } finally {
    bitmap?.close();
  }
}
```

### Listing form

[`app/(pages)/add_a_cat/ListACat.tsx`](../../app/%28pages%29/add_a_cat/ListACat.tsx) · lines 1–576

<!-- prettier-ignore -->
```tsx
"use client";

import Link from "next/link";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchSelect } from "@/components/ui/search-select";
import { useId, useMemo, useState, useTransition } from "react";
import { DISTRICT_NAMES, getAreaGroups } from "@/lib/locations";
import ImageGallery, { type GalleryImage } from "./ImageGallery";
import { submitForm } from "./actions";
import { authClient } from "@/lib/auth-client";
import { outlineButton } from "@/components/view/styles";
import { normalizeBdPhone, PHONE_ERROR } from "@/lib/phone";
import {
  type ContactMethod,
  MAX_DESCRIPTION_LENGTH,
  MAX_REHOMING_REASON_LENGTH,
  MAX_TEMPERAMENT_LENGTH,
} from "@/lib/cat-limits";

const BREED_SUGGESTIONS = [
  "Local / Street / Deshi Cat",
  "Persian",
  "Siamese",
  "Himalayan",
  "Ragdoll",
  "Maine Coon",
  "British Shorthair",
  "Bengal",
  "Scottish Fold",
  "Mixed / Unknown",
];

type Gender = "male" | "female" | "unknown";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unknown", label: "Unknown" },
];

type YesNoUnknown = "yes" | "no" | "unknown";

const YES_NO_UNKNOWN_OPTIONS: { value: YesNoUnknown; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Unknown" },
];

const CONTACT_OPTIONS: { value: ContactMethod; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "call", label: "Phone call" },
];

// Two fields side by side, stacking on a narrow screen.
const formPair = "grid grid-cols-1 items-start gap-4 sm:grid-cols-2";

// Form fields sit a little taller than the ui/ defaults and on the card colour.
const formField = "h-11 bg-card";

function clamp(value: string, min: number, max: number) {
  if (value === "") return "";
  const n = Math.floor(Number(value));
  if (Number.isNaN(n)) return "";
  return String(Math.min(max, Math.max(min, n)));
}

export default function ListACat() {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [ageYears, setAgeYears] = useState("0");
  const [ageMonths, setAgeMonths] = useState("0");
  const [district, setDistrict] = useState("");
  const [area, setArea] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [vaccinated, setVaccinated] = useState<YesNoUnknown | "">("");
  const [neutered, setNeutered] = useState<YesNoUnknown | "">("");
  const [temperament, setTemperament] = useState("");
  const [description, setDescription] = useState("");
  const [rehomingReason, setRehomingReason] = useState("");
  const [contactMethods, setContactMethods] = useState<ContactMethod[]>([]);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Signed up with Google (or before phones existed)? Ask for a number once.
  const { data: session } = authClient.useSession();
  const needsPhone = Boolean(session?.user) && !session?.user.phone;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (needsPhone && !normalizeBdPhone(phone)) {
      setError(PHONE_ERROR);
      return;
    }

    if (!district) {
      setError("Please choose a district.");
      return;
    }
    if (!area) {
      setError("Please choose an area.");
      return;
    }
    if (!gender) {
      setError("Please choose a gender.");
      return;
    }
    if (!vaccinated) {
      setError("Please say whether the cat is vaccinated.");
      return;
    }
    if (!neutered) {
      setError("Please say whether the cat is spayed/neutered.");
      return;
    }
    if (contactMethods.length === 0) {
      setError("Please choose how adopters can contact you.");
      return;
    }
    if (images.length === 0) {
      setError("Please add at least one photo.");
      return;
    }

    startTransition(async () => {
      try {
        // On success the action redirects, so we only get a result back
        // when something went wrong.
        const formData = new FormData();
        formData.set("name", name);
        formData.set("breed", breed);
        formData.set("ageYears", ageYears || "0");
        formData.set("ageMonths", ageMonths || "0");
        formData.set("district", district);
        formData.set("area", area);
        formData.set("gender", gender);
        formData.set("vaccinated", vaccinated);
        formData.set("neutered", neutered);
        formData.set("temperament", temperament);
        formData.set("description", description);
        formData.set("rehomingReason", rehomingReason);
        if (needsPhone) formData.set("phone", phone);
        for (const method of contactMethods) {
          formData.append("contactMethods", method);
        }
        // Same order as the gallery: the first image is the cover.
        for (const img of images) {
          formData.append("images", img.file);
          formData.append("captions", img.caption);
        }

        const result = await submitForm(formData);
        if (result && !result.ok) setError(result.error);
      } catch (err) {
        // Network/server errors carry technical messages; keep them out of the UI.
        console.error(err);
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form
      className="grid min-w-0 gap-7"
      onSubmit={handleSubmit}
      aria-labelledby="list-title"
    >
      <ImageGallery images={images} onChange={setImages} />

      <section className="grid gap-4" aria-labelledby="cat-details-title">
        <h2 id="cat-details-title" className="text-lg font-extrabold">
          Cat details
        </h2>
        <div className={formPair}>
          <FormElement
            labelText="Name"
            inputPlaceholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <FormElement
            labelText="Breed"
            inputPlaceholder="Start typing or pick a suggestion"
            suggestions={BREED_SUGGESTIONS}
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
          />
        </div>

        <LocationFields
          district={district}
          area={area}
          onDistrictChange={(next) => {
            setDistrict(next);
            if (next !== district) setArea("");
          }}
          onAreaChange={setArea}
        />

        <div className={formPair}>
          <fieldset className="min-w-0">
            <legend className="mb-2 text-sm font-bold">Age</legend>
            <div className="grid max-w-xs grid-cols-2 gap-2">
              <div className="grid min-w-0 gap-1">
                <Label htmlFor="age-years">Years</Label>
                <Input
                  id="age-years"
                  className={formField}
                  type="number"
                  min={0}
                  max={30}
                  value={ageYears}
                  onChange={(e) => setAgeYears(clamp(e.target.value, 0, 30))}
                />
              </div>
              <div className="grid min-w-0 gap-1">
                <Label htmlFor="age-months">Months</Label>
                <Input
                  id="age-months"
                  className={formField}
                  type="number"
                  min={0}
                  max={11}
                  value={ageMonths}
                  onChange={(e) => setAgeMonths(clamp(e.target.value, 0, 11))}
                />
              </div>
            </div>
          </fieldset>
          <RadioGroup
            legend="Gender"
            name="gender"
            options={GENDER_OPTIONS}
            value={gender}
            onChange={setGender}
          />
        </div>

        <div className={formPair}>
          <RadioGroup
            legend="Vaccinated"
            name="vaccinated"
            options={YES_NO_UNKNOWN_OPTIONS}
            value={vaccinated}
            onChange={setVaccinated}
          />
          <RadioGroup
            legend="Spayed / neutered"
            name="neutered"
            options={YES_NO_UNKNOWN_OPTIONS}
            value={neutered}
            onChange={setNeutered}
          />
        </div>
      </section>

      <section className="grid gap-4" aria-labelledby="cat-story-title">
        <h2 id="cat-story-title" className="text-lg font-extrabold">
          Their story
        </h2>
        <FormElement
          labelText="Temperament"
          inputPlaceholder="e.g. Playful, shy, calm"
          maxLength={MAX_TEMPERAMENT_LENGTH}
          value={temperament}
          onChange={(e) => setTemperament(e.target.value)}
        />
        <TextAreaElement
          labelText="Description"
          placeholder="Tell people about this cat"
          maxLength={MAX_DESCRIPTION_LENGTH}
          value={description}
          onChange={setDescription}
        />
        <TextAreaElement
          labelText="Reason for rehoming"
          placeholder="Why does this cat need a new home?"
          maxLength={MAX_REHOMING_REASON_LENGTH}
          value={rehomingReason}
          onChange={setRehomingReason}
        />
      </section>

      <CheckboxGroup
        legend="How can adopters contact you?"
        hint="Pick one or both. We use the phone number on your profile."
        name="contactMethods"
        options={CONTACT_OPTIONS}
        value={contactMethods}
        onChange={setContactMethods}
      />

      {needsPhone && (
        <FormElement
          labelText="Your phone number"
          inputPlaceholder="01712345678"
          inputType="tel"
          maxLength={20}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      )}

      <div className="grid justify-items-start gap-2">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            disabled={isPending}
            className="h-11 font-bold"
          >
            {isPending ? "Saving…" : "Save cat profile"}
          </Button>
          <Link href="/find_a_cat" className={outlineButton}>
            Back to Find a Cat
          </Link>
        </div>
      </div>
    </form>
  );
}

function FormElement({
  labelText,
  inputPlaceholder,
  inputType = "text",
  value,
  onChange,
  suggestions,
  min,
  max,
  maxLength,
}: {
  labelText: string;
  inputPlaceholder: string;
  inputType?: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Optional autocomplete suggestions, rendered as a <datalist> */
  suggestions?: string[];
  min?: number;
  max?: number;
  maxLength?: number;
}) {
  /* A way to remove the pain of having to add and style
    labels and inputs individually for every single form field */
  const id = useId();
  const listId = `${id}-list`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-bold">
        {labelText}
      </Label>
      <Input
        id={id}
        type={inputType}
        placeholder={inputPlaceholder}
        value={value}
        min={min}
        max={max}
        maxLength={maxLength}
        list={suggestions ? listId : undefined}
        className={formField}
        onChange={(e) => onChange(e)}
      />
      {suggestions && (
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </div>
  );
}

/* District -> Area, the way Bangladeshi listing sites do it. Not every place
   is a city: an area is a city neighbourhood or an upazila. */
function LocationFields({
  district,
  area,
  onDistrictChange,
  onAreaChange,
}: {
  district: string;
  area: string;
  onDistrictChange: (value: string) => void;
  onAreaChange: (value: string) => void;
}) {
  const districtId = useId();
  const areaId = useId();
  const areaGroups = useMemo(() => getAreaGroups(district), [district]);

  return (
    <div className={formPair}>
      <div className="flex flex-col gap-2">
        <Label htmlFor={districtId} className="font-bold">
          District
        </Label>
        <SearchSelect
          id={districtId}
          items={DISTRICT_NAMES}
          value={district}
          onChange={onDistrictChange}
          placeholder="e.g. Dhaka"
          emptyText="No district found."
          popupClassName="bilai-theme"
          fieldClassName={formField}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={areaId} className="font-bold">
          Area
        </Label>
        <SearchSelect
          // Remount per district so the typed filter and highlight reset too.
          key={district}
          id={areaId}
          items={areaGroups}
          value={area}
          onChange={onAreaChange}
          placeholder={
            district ? "Neighbourhood or upazila" : "Choose a district first"
          }
          emptyText="No area found."
          popupClassName="bilai-theme"
          fieldClassName={formField}
          disabled={!district}
        />
      </div>
    </div>
  );
}

function TextAreaElement({
  labelText,
  placeholder,
  value,
  onChange,
  maxLength,
}: {
  labelText: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-bold">
        {labelText}
      </Label>
      <textarea
        id={id}
        rows={4}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-lg border border-input bg-card px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
      />
      <span className="self-end text-xs text-muted-foreground">
        {value.length} / {maxLength}
      </span>
    </div>
  );
}

function RadioGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-bold">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-muted has-checked:border-secondary has-checked:bg-secondary/20 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="size-4 accent-action outline-none"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CheckboxGroup<T extends string>({
  legend,
  hint,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  hint?: string;
  name: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
}) {
  const hintId = useId();
  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={hint ? hintId : undefined}
    >
      <legend className="mb-1 text-sm font-bold">{legend}</legend>
      {hint && (
        <p id={hintId} className="mb-1 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-muted has-checked:border-secondary has-checked:bg-secondary/20 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={value.includes(option.value)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? // Keep the options' order so the payload is predictable.
                      options
                        .map((o) => o.value)
                        .filter((v) => v === option.value || value.includes(v))
                    : value.filter((v) => v !== option.value),
                )
              }
              className="size-4 accent-action outline-none"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
```

## Validate and save

### Request body limit

[`next.config.ts`](../../next.config.ts) · lines 1–22

<!-- prettier-ignore -->
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    agentUpgrade: "security",
    serverActions: { bodySizeLimit: "20mb" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

### Listing Server Action

[`app/(pages)/add_a_cat/actions.ts`](../../app/%28pages%29/add_a_cat/actions.ts) · lines 1–197

<!-- prettier-ignore -->
```ts
"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { db } from "@/db";
import { catImages, cats } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  CONTACT_METHODS,
  MAX_DESCRIPTION_LENGTH,
  MAX_IMAGES,
  MAX_REHOMING_REASON_LENGTH,
  MAX_STORED_SIZE_BYTES,
  MAX_TEMPERAMENT_LENGTH,
  YES_NO_UNKNOWN,
} from "@/lib/cat-limits";
import { getUserPhone, saveUserPhone } from "@/lib/contact";
import { purgeExpiredListings } from "@/lib/listing-expiry";
import { isValidLocation } from "@/lib/locations";
import { normalizeBdPhone, PHONE_ERROR } from "@/lib/phone";
import { isWebp } from "@/lib/uploads";

const GENDERS = ["male", "female", "unknown"] as const;

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function submitForm(
  formData: FormData,
): Promise<ActionResult | never> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Please log in first." };
  const userId = session.user.id;

  const name = String(formData.get("name") ?? "").trim();
  const breed = String(formData.get("breed") ?? "").trim();
  const district = String(formData.get("district") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const gender = String(formData.get("gender") ?? "");
  const vaccinated = String(formData.get("vaccinated") ?? "");
  const neutered = String(formData.get("neutered") ?? "");
  // Optional text fields: empty becomes null.
  const optional = (key: string, max: number) =>
    String(formData.get(key) ?? "")
      .trim()
      .slice(0, max) || null;
  const temperament = optional("temperament", MAX_TEMPERAMENT_LENGTH);
  const description = optional("description", MAX_DESCRIPTION_LENGTH);
  const rehomingReason = optional("rehomingReason", MAX_REHOMING_REASON_LENGTH);
  const contactMethods = formData.getAll("contactMethods").map(String);
  const years = Number(formData.get("ageYears"));
  const months = Number(formData.get("ageMonths"));

  if (!name) return { ok: false, error: "Name is required." };
  if (!breed) return { ok: false, error: "Breed is required." };
  if (!district) return { ok: false, error: "Please choose a district." };
  if (!area) return { ok: false, error: "Please choose an area." };
  if (!isValidLocation(district, area)) {
    return {
      ok: false,
      error: "Please pick a district and area from the lists.",
    };
  }
  if (!(GENDERS as readonly string[]).includes(gender)) {
    return { ok: false, error: "Please choose a gender." };
  }
  if (!(YES_NO_UNKNOWN as readonly string[]).includes(vaccinated)) {
    return { ok: false, error: "Please say whether the cat is vaccinated." };
  }
  if (!(YES_NO_UNKNOWN as readonly string[]).includes(neutered)) {
    return {
      ok: false,
      error: "Please say whether the cat is spayed/neutered.",
    };
  }
  if (!Number.isInteger(years) || years < 0 || years > 30) {
    return { ok: false, error: "Years must be between 0 and 30." };
  }
  if (!Number.isInteger(months) || months < 0 || months > 11) {
    return { ok: false, error: "Months must be between 0 and 11." };
  }
  if (years === 0 && months === 0) {
    return { ok: false, error: "Please enter the cat's age." };
  }
  if (
    contactMethods.length === 0 ||
    contactMethods.some(
      (m) => !(CONTACT_METHODS as readonly string[]).includes(m),
    )
  ) {
    return {
      ok: false,
      error: "Please choose how adopters can contact you.",
    };
  }

  const files = formData
    .getAll("images")
    .filter((v): v is File => v instanceof File);
  const captions = formData.getAll("captions").map(String);
  if (files.length === 0) {
    return { ok: false, error: "Please add at least one photo." };
  }
  if (files.length > MAX_IMAGES) {
    return { ok: false, error: `You can add up to ${MAX_IMAGES} photos.` };
  }
  if (captions.length !== files.length) {
    console.error(
      `submitForm: ${files.length} images but ${captions.length} captions.`,
    );
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  // Read and validate everything BEFORE writing anything to disk.
  const buffers: Buffer[] = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_STORED_SIZE_BYTES) {
      console.error(
        `submitForm: image is ${buf.length} bytes, over the limit.`,
      );
      return { ok: false, error: "One of the photos is too large." };
    }
    if (!isWebp(buf)) {
      console.error("submitForm: uploaded image is not WebP.");
      return { ok: false, error: "Upload failed. Please try again." };
    }
    buffers.push(buf);
  }

  // Adopters reach the lister on the number from their profile. Google
  // sign-ups (and older accounts) have none yet, so take it from this form.
  if (!(await getUserPhone(userId))) {
    const phone = normalizeBdPhone(String(formData.get("phone") ?? ""));
    if (!phone) return { ok: false, error: PHONE_ERROR };
    const saved = await saveUserPhone(userId, phone);
    if (!saved.ok) return saved;
  }

  let catId: number | null = null;
  try {
    const rows: {
      key: string;
      data: string;
      url: string;
      caption: string | null;
      position: number;
    }[] = [];
    for (const [position, buf] of buffers.entries()) {
      const key = `${userId}/${randomUUID()}.webp`;
      rows.push({
        key,
        data: buf.toString("base64"),
        url: `/uploads/${key}`,
        caption: captions[position].trim().slice(0, 200) || null,
        position,
      });
    }

    const [cat] = await db
      .insert(cats)
      .values({
        name,
        breed,
        ageMonths: years * 12 + months,
        area,
        district,
        gender,
        vaccinated,
        neutered,
        temperament,
        description,
        rehomingReason,
        contactWhatsapp: contactMethods.includes("whatsapp"),
        contactCall: contactMethods.includes("call"),
        // status defaults to 'available' in the database
        userId,
      })
      .returning({ id: cats.id });
    catId = cat.id;

    await db
      .insert(catImages)
      .values(rows.map((row) => ({ ...row, catId: cat.id })));
  } catch (err) {
    // Remove a partially created listing if saving its images failed.
    if (catId !== null) await db.delete(cats).where(eq(cats.id, catId));
    console.error(err);
    return { ok: false, error: "Couldn't save the cat. Please try again." };
  }

  after(purgeExpiredListings);
  // Must stay outside the try/catch: redirect() works by throwing.
  redirect("/");
}
```

### Session lookup

[`lib/auth.ts`](../../lib/auth.ts#L67-L70) · lines 67–70

<!-- prettier-ignore -->
```ts
export const getSession = async () =>
  auth.api.getSession({
    headers: await headers(),
  });
```

### Database connection

[`db/index.ts`](../../db/index.ts) · lines 1–3

<!-- prettier-ignore -->
```ts
import { drizzle } from "drizzle-orm/neon-http";

export const db = drizzle(process.env.DATABASE_URL!);
```

### Listing and photo schema

[`db/schema.ts`](../../db/schema.ts#L1-L14) · lines 1–14

<!-- prettier-ignore -->
```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  varchar,
  integer,
  uuid,
} from "drizzle-orm/pg-core";
```

[`db/schema.ts`](../../db/schema.ts#L109-L171) · lines 109–171

<!-- prettier-ignore -->
```ts
export const cats = pgTable(
  "cats",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    name: text().notNull(),
    breed: text().notNull(),
    ageMonths: integer().notNull(), // Age is to be inserted in months here
    // Values come from lib/locations.ts. An area is a city neighbourhood or
    // an upazila inside the district.
    area: text().notNull(),
    district: text().notNull(),
    gender: text().notNull(),
    description: text(),
    // 'available' | 'pending' | 'adopted'
    status: text().notNull().default("available"),
    // 'yes' | 'no' | 'unknown'
    vaccinated: text().notNull().default("unknown"),
    neutered: text().notNull().default("unknown"), // spayed or neutered
    temperament: text(),
    rehomingReason: text("rehoming_reason"),
    // How adopters may reach the lister. The number comes from their profile.
    contactWhatsapp: boolean("contact_whatsapp").notNull().default(false),
    contactCall: boolean("contact_call").notNull().default(false),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("cats_status_idx").on(table.status),
    index("cats_district_idx").on(table.district),
    index("cats_breed_idx").on(table.breed),
    check(
      "cats_contact_method_check",
      sql`${table.contactWhatsapp} or ${table.contactCall}`,
    ),
  ],
);

export const catImages = pgTable(
  "cat_images",
  {
    id: uuid().primaryKey().defaultRandom(),
    catId: integer("cat_id")
      .notNull()
      .references(() => cats.id, { onDelete: "cascade" }),
    // Storage key/path of the uploaded file
    key: text().notNull(),
    url: text().notNull(),
    caption: text(),
    // Shared image bytes; base64 keeps the Neon HTTP transport simple.
    data: text(),
    // 0 = cover photo
    position: integer().notNull(),
  },
  (table) => [index("cat_images_catId_idx").on(table.catId)],
);
```

### Photo data migration

[`drizzle/20261111020000_shared_photo_storage/migration.sql`](../../drizzle/20261111020000_shared_photo_storage/migration.sql) · line 1

<!-- prettier-ignore -->
```sql
ALTER TABLE "cat_images" ADD COLUMN IF NOT EXISTS "data" text;
```

### Migration configuration

[`drizzle.config.ts`](../../drizzle.config.ts) · lines 1–11

<!-- prettier-ignore -->
```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Read and serve

### Listing and photo queries

[`lib/cats.ts`](../../lib/cats.ts) · lines 1–207

<!-- prettier-ignore -->
```ts
import "server-only";

import { cache } from "react";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  ilike,
  or,
  lte,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { catImages, cats, user } from "@/db/schema";
import { MAX_FILTER_AGE, type CatFilters } from "@/lib/cat-filters";
import { isLiveListing, listingSecondsLeft } from "@/lib/listing-expiry";

export const CATS_PER_PAGE = 20;

export async function getFeaturedCats() {
  return db
    .select({
      id: cats.id,
      name: cats.name,
      breed: cats.breed,
      ageMonths: cats.ageMonths,
      gender: cats.gender,
      area: cats.area,
      district: cats.district,
      coverImageUrl: sql<string | null>`(
        select ${catImages.url} from ${catImages}
        where ${catImages.catId} = ${cats.id}
        order by ${catImages.position} asc, ${catImages.id} asc limit 1
      )`,
    })
    .from(cats)
    .where(and(eq(cats.status, "available"), isLiveListing))
    .orderBy(sql`random()`)
    .limit(3);
}

// Deliberately uncached: render these reads under Suspense with cacheComponents.
// Each navigation queries just its requested page, so new listings stay fresh.
export async function getCats({
  page = 1,
  filters,
}: {
  page?: number;
  filters?: CatFilters;
} = {}) {
  const requestedPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const filter = and(
    isLiveListing,
    filters
      ? and(
          ...filters.q
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => {
              const pattern = `%${word.replace(/[\\%_]/g, "\\$&")}%`;
              return or(
                ...[cats.name, cats.breed, cats.area, cats.district].map(
                  (column) => ilike(column, pattern),
                ),
              );
            }),
          filters.minAge > 0 ? gte(cats.ageMonths, filters.minAge) : undefined,
          filters.maxAge < MAX_FILTER_AGE
            ? lte(cats.ageMonths, filters.maxAge)
            : undefined,
          filters.breeds.length
            ? inArray(cats.breed, filters.breeds)
            : undefined,
          filters.genders.length
            ? inArray(cats.gender, filters.genders)
            : undefined,
          filters.district ? eq(cats.district, filters.district) : undefined,
          filters.district && filters.area
            ? eq(cats.area, filters.area)
            : undefined,
          filters.vaccinated.length
            ? inArray(cats.vaccinated, filters.vaccinated)
            : undefined,
          filters.neutered.length
            ? inArray(cats.neutered, filters.neutered)
            : undefined,
        )
      : undefined,
  );
  const offset = (requestedPage - 1) * CATS_PER_PAGE;
  const [items, totals] = await Promise.all([
    db
      .select({
        id: cats.id,
        name: cats.name,
        breed: cats.breed,
        ageMonths: cats.ageMonths,
        gender: cats.gender,
        area: cats.area,
        district: cats.district,
        status: cats.status,
        owner: { id: user.id, name: user.name },
        coverImageUrl: sql<string | null>`(
        select ${catImages.url} from ${catImages}
        where ${catImages.catId} = ${cats.id}
        order by ${catImages.position} asc, ${catImages.id} asc limit 1
      )`,
      })
      .from(cats)
      .innerJoin(user, eq(cats.userId, user.id))
      .where(filter)
      .orderBy(desc(cats.createdAt), desc(cats.id))
      .limit(CATS_PER_PAGE)
      .offset(offset),
    db.select({ total: count() }).from(cats).where(filter),
  ]);
  const total = totals[0].total;
  return {
    items,
    total,
    page: requestedPage,
    totalPages: Math.ceil(total / CATS_PER_PAGE),
  };
}

export async function getCatBreeds() {
  const rows = await db
    .selectDistinct({ breed: cats.breed })
    .from(cats)
    .where(isLiveListing)
    .orderBy(asc(cats.breed));
  return rows.map(({ breed }) => breed);
}

// Wrapped in React `cache()` so `generateMetadata` and the page body share one
// DB read per request (request-scoped memoization, not cross-request caching).
export const getCat = cache(async (id: number) => {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const [cat] = await db
    .select({
      ...getTableColumns(cats),
      // Only whether a number exists: the number itself is sent by the
      // contact action on tap, never rendered into the page.
      owner: {
        id: user.id,
        name: user.name,
        hasPhone: sql<boolean>`${user.phone} is not null`,
      },
    })
    .from(cats)
    .innerJoin(user, eq(cats.userId, user.id))
    .where(and(eq(cats.id, id), isLiveListing))
    .limit(1);
  if (!cat) return null;
  const images = await db
    .select({
      id: catImages.id,
      url: catImages.url,
      caption: catImages.caption,
      position: catImages.position,
    })
    .from(catImages)
    .where(eq(catImages.catId, id))
    .orderBy(asc(catImages.position), asc(catImages.id));
  return { ...cat, images, coverImageUrl: images[0]?.url ?? null };
});

// Everything someone has listed that hasn't expired yet, newest first.
export async function getUserCats(userId: string) {
  return db
    .select({
      id: cats.id,
      name: cats.name,
      breed: cats.breed,
      ageMonths: cats.ageMonths,
      gender: cats.gender,
      area: cats.area,
      district: cats.district,
      status: cats.status,
      secondsLeft: listingSecondsLeft,
      coverImageUrl: sql<string | null>`(
        select ${catImages.url} from ${catImages}
        where ${catImages.catId} = ${cats.id}
        order by ${catImages.position} asc, ${catImages.id} asc limit 1
      )`,
    })
    .from(cats)
    .where(and(eq(cats.userId, userId), isLiveListing))
    .orderBy(desc(cats.createdAt), desc(cats.id));
}

export function formatCatAge(months: number) {
  if (months === 0) return "Under 1 month";
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return [
    years ? `${years} year${years === 1 ? "" : "s"}` : "",
    remainder ? `${remainder} month${remainder === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
```

### Cover card

[`components/view/cat/CatCard.tsx`](../../components/view/cat/CatCard.tsx) · lines 1–130

<!-- prettier-ignore -->
```tsx
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Cat } from "lucide-react";
import { formatCatAge } from "@/lib/cats";
import { outlineButton } from "@/components/view/styles";
import { cn } from "@/lib/utils";

type CatSummary = {
  id: number;
  name: string;
  area: string | null;
  district: string;
  breed: string;
  ageMonths: number;
  gender: string;
  coverImageUrl: string | null;
};

const catImage =
  "aspect-[1.68] h-auto w-full bg-line object-cover object-[50%_38%]";

// Narrow cards stack identity / facts / profile; past 19rem the facts move
// into a column of their own on the right, spanning both rows.
const catInfo =
  "grid flex-1 grid-cols-1 grid-rows-[auto_auto_1fr] gap-x-4 gap-y-3 p-[clamp(1rem,1.4vw,1.25rem)] wrap-anywhere @min-[19rem]/cat:grid-cols-[minmax(8rem,1.05fr)_minmax(0,1fr)] @min-[19rem]/cat:grid-rows-[auto_1fr]";

export default function CatCard({
  cat,
  sizes,
  nameAs: Name = "h3",
  note,
  imageClassName,
  wholeCardLink = false,
}: {
  cat: CatSummary;
  sizes: string;
  nameAs?: "h2" | "h3";
  // Extra line under the location, e.g. when a listing expires.
  note?: string;
  imageClassName?: string;
  // In a grid of cards, stretch the profile link over the whole card so the
  // card itself is clickable.
  wholeCardLink?: boolean;
}) {
  const age = formatCatAge(cat.ageMonths)
    .replace(/ (\d+) (?=months?\b)/, ", $1 ")
    .replace(/(\d) (?=years?\b|months?\b)/g, "$1\u00a0");
  const facts = [
    ["Breed", cat.breed],
    ["Age", age],
    ["Sex", cat.gender],
  ];

  return (
    <article
      className={cn(
        "@container/cat relative flex min-w-0 flex-col overflow-hidden rounded-[.875rem] border border-line bg-card",
        wholeCardLink &&
          "focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-focus",
      )}
    >
      {cat.coverImageUrl ? (
        <Image
          className={cn(catImage, imageClassName)}
          src={cat.coverImageUrl}
          alt={cat.name}
          width={672}
          height={400}
          sizes={sizes}
          unoptimized
        />
      ) : (
        <div
          className={cn(
            catImage,
            "grid flex-none place-items-center text-muted-foreground",
            imageClassName,
          )}
          role="img"
          aria-label="No photo yet"
        >
          <Cat size={42} aria-hidden="true" />
        </div>
      )}
      <div className={catInfo}>
        <div className="col-start-1 row-start-1">
          <Name className="font-display text-[clamp(1.25rem,6cqi,1.6rem)] leading-[1.12] font-[660] tracking-[-.025em]">
            {cat.name}
          </Name>
          <p className="mt-1 text-sm text-ink">
            {[cat.area, cat.district].filter(Boolean).join(", ")}
          </p>
          {note ? (
            <p className="mt-1 text-sm font-[650] text-action">{note}</p>
          ) : null}
        </div>
        <dl className="col-start-1 row-start-2 grid gap-[.4rem] self-start text-sm leading-[1.35] @min-[19rem]/cat:col-start-2 @min-[19rem]/cat:row-span-2 @min-[19rem]/cat:row-start-1 @min-[19rem]/cat:w-[min(100%,13.5rem)] @min-[19rem]/cat:justify-self-end">
          {facts.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[2.3rem_minmax(0,1fr)] items-baseline gap-2"
            >
              <dt className="text-[.8125rem] font-bold text-action">{label}</dt>
              <dd
                className={
                  label === "Sex" ? "font-[550] capitalize" : "font-[550]"
                }
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <Link
          href={`/find_a_cat/${cat.id}`}
          prefetch={false}
          className={cn(
            outlineButton,
            "col-start-1 row-start-3 gap-[.4rem] self-end justify-self-start px-[.65rem] text-sm @min-[19rem]/cat:row-start-2 print:hidden",
            wholeCardLink && "after:absolute after:inset-0 after:content-['']",
          )}
          aria-label={`View profile for ${cat.name}`}
        >
          View profile
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
```

### Featured cats

[`components/view/home/FeaturedCats.tsx`](../../components/view/home/FeaturedCats.tsx) · lines 1–48

<!-- prettier-ignore -->
```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import CatCard from "@/components/view/cat/CatCard";
import { homeHeading, outlineButton, waveEdge } from "@/components/view/styles";
import { getFeaturedCats } from "@/lib/cats";

export default async function FeaturedCats() {
  const featuredCats = await getFeaturedCats();
  if (featuredCats.length < 3) return null;

  return (
    <section
      id="meet-the-cats"
      // The scalloped edge belongs to the section above this one, so it is cut
      // from this section's own background colour rather than the default ink.
      className={`${waveEdge} bg-on-dark py-section [--bilai-wave-color:var(--bilai-on-dark)]`}
      aria-labelledby="featured-title"
    >
      <div className="frame">
        <div className="mb-4 flex items-end justify-between gap-x-6 gap-y-3 max-sm:flex-col max-sm:items-start">
          <div>
            <h2 id="featured-title" className={homeHeading}>
              Meet the cats
            </h2>
            <p className="mt-2 text-[.9375rem] leading-[1.55] text-ink">
              Get to know a few cats looking for a home.
            </p>
          </div>
          <Link href="/find_a_cat" className={`${outlineButton} print:hidden`}>
            Explore All
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-[.85rem] max-sm:grid-cols-1">
          {featuredCats.map((cat) => (
            <CatCard
              key={cat.id}
              cat={cat}
              sizes="(max-width: 640px) 100vw, 33vw"
              imageClassName="max-h-56"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
```

### Home page call site

[`app/page.tsx`](../../app/page.tsx#L6) · line 6

<!-- prettier-ignore -->
```tsx
import FeaturedCats from "@/components/view/home/FeaturedCats";
```

[`app/page.tsx`](../../app/page.tsx#L50-L52) · lines 50–52

<!-- prettier-ignore -->
```tsx
      <Suspense fallback={null}>
        <FeaturedCats />
      </Suspense>
```

### Find a Cat call sites

[`app/(pages)/find_a_cat/page.tsx`](../../app/%28pages%29/find_a_cat/page.tsx#L7-L10) · lines 7–10

<!-- prettier-ignore -->
```tsx
import CatCard from "@/components/view/cat/CatCard";
import { getCats, getCatBreeds } from "@/lib/cats";
import { headingText, headingTitle } from "@/components/view/styles";
import { purgeExpiredListings } from "@/lib/listing-expiry";
```

[`app/(pages)/find_a_cat/page.tsx`](../../app/%28pages%29/find_a_cat/page.tsx#L65-L73) · lines 65–73

<!-- prettier-ignore -->
```tsx
async function CatResults({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  after(purgeExpiredListings);
  const filters = parseCatFilters(params);
  const [results, breeds] = await Promise.all([
    getCats({ page: Number(params.page ?? 1), filters }),
    getCatBreeds(),
  ]);
  const { items, total, page, totalPages } = results;
```

[`app/(pages)/find_a_cat/page.tsx`](../../app/%28pages%29/find_a_cat/page.tsx#L111-L122) · lines 111–122

<!-- prettier-ignore -->
```tsx
        {items.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 min-[24rem]:grid-cols-2 sm:grid-cols-3 min-[66rem]:grid-cols-4">
            {items.map((cat) => (
              <CatCard
                key={cat.id}
                cat={cat}
                nameAs="h2"
                wholeCardLink
                sizes="(max-width: 384px) 100vw, (max-width: 640px) 50vw, (max-width: 1056px) 33vw, 25vw"
              />
            ))}
          </div>
```

### Profile call sites

[`app/(pages)/profile/page.tsx`](../../app/%28pages%29/profile/page.tsx#L5-L16) · lines 5–16

<!-- prettier-ignore -->
```tsx
import { after } from "next/server";
import { Mail, Pencil, Phone, Plus } from "lucide-react";
import BilaiPage from "@/components/view/BilaiPage";
import CatCard from "@/components/view/cat/CatCard";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { getUserCats } from "@/lib/cats";
import {
  formatTimeLeft,
  LISTING_LIFETIME_MONTHS,
  purgeExpiredListings,
} from "@/lib/listing-expiry";
```

[`app/(pages)/profile/page.tsx`](../../app/%28pages%29/profile/page.tsx#L59-L66) · lines 59–66

<!-- prettier-ignore -->
```tsx
// Reads the session, so it has to sit behind the Suspense above.
async function YourProfile() {
  const session = await getSession();
  if (!session?.user) redirect("/auth");

  const { id, name, email, phone, createdAt } = session.user;
  const listings = await getUserCats(id);
  after(purgeExpiredListings);
```

[`app/(pages)/profile/page.tsx`](../../app/%28pages%29/profile/page.tsx#L136-L155) · lines 136–155

<!-- prettier-ignore -->
```tsx
      <section aria-labelledby="your-cats-title" className="mt-12">
        <h2 id="your-cats-title" className="font-heading text-2xl font-bold">
          Your cats
        </h2>
        <p className="mt-1 text-muted-foreground">
          Listings and their photos are removed automatically{" "}
          {LISTING_LIFETIME_MONTHS} months after you post them.
        </p>
        {listings.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-4 min-[36rem]:grid-cols-2">
            {listings.map((cat) => (
              <CatCard
                key={cat.id}
                cat={cat}
                wholeCardLink
                sizes="(max-width: 36rem) 100vw, 21rem"
                note={`${cat.status[0].toUpperCase()}${cat.status.slice(1)} · removed ${formatTimeLeft(cat.secondsLeft)}`}
              />
            ))}
          </div>
```

### Listing detail page

[`app/(pages)/find_a_cat/[id]/page.tsx`](../../app/%28pages%29/find_a_cat/%5Bid%5D/page.tsx) · lines 1–148

<!-- prettier-ignore -->
```tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import BilaiPage from "@/components/view/BilaiPage";
import DeleteListingButton from "@/components/view/cat/DeleteListingButton";
import ContactButtons from "@/components/view/cat/ContactButtons";
import { getSession } from "@/lib/auth";
import { formatCatAge, getCat } from "@/lib/cats";
import { headingTitle, outlineButton } from "@/components/view/styles";

// getCat is memoized per request, so this shares one DB read with the page.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const cat = await getCat(Number(id));
  return { title: cat ? cat.name : "Cat not found" };
}

export default function CatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <BilaiPage currentPage="profile" mainClassName="frame py-section">
      <Link href="/find_a_cat" className={outlineButton}>
        <ArrowLeft size={17} aria-hidden="true" />
        Find a cat
      </Link>
      <Suspense
        fallback={
          <p role="status" className="py-8">
            Loading cat…
          </p>
        }
      >
        <CatDetails params={params} />
      </Suspense>
    </BilaiPage>
  );
}

async function CatDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [cat, session] = await Promise.all([getCat(Number(id)), getSession()]);
  if (!cat) notFound();
  const isOwner = session?.user.id === cat.owner.id;

  return (
    <article className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={headingTitle}>{cat.name}</h1>
        <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold capitalize">
          {cat.status}
        </span>
      </div>
      <p className="mt-2 text-muted-foreground">Parent: {cat.owner.name}</p>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {cat.images.length > 0 ? (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {cat.images.map((image, index) => (
              <figure
                key={image.id}
                className={index === 0 ? "sm:col-span-2" : ""}
              >
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
                  <Image
                    src={image.url}
                    alt={image.caption || cat.name}
                    fill
                    unoptimized
                    sizes={
                      index === 0
                        ? "(min-width: 1024px) 55vw, 100vw"
                        : "(min-width: 1024px) 27vw, (min-width: 640px) 50vw, 100vw"
                    }
                    className="object-contain"
                  />
                </div>
                {image.caption ? (
                  <figcaption className="mt-2 text-sm text-muted-foreground">
                    {image.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No photos yet.</p>
        )}
        <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              ["Breed", cat.breed],
              ["Age", formatCatAge(cat.ageMonths)],
              ["Gender", cat.gender],
              ["Location", [cat.area, cat.district].filter(Boolean).join(", ")],
              ["Vaccinated", cat.vaccinated],
              ["Spayed / neutered", cat.neutered],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm font-bold text-action">{label}</dt>
                <dd className="mt-1 [overflow-wrap:anywhere] capitalize">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {cat.status !== "adopted" ? (
            <div className="mt-5">
              <ContactButtons
                catId={cat.id}
                catName={cat.name}
                canChat={Boolean(session?.user) && !isOwner}
                whatsapp={cat.contactWhatsapp}
                call={cat.contactCall}
                hasPhone={cat.owner.hasPhone}
                isLoggedIn={Boolean(session?.user)}
                isOwner={isOwner}
              />
            </div>
          ) : null}
          {isOwner ? <DeleteListingButton catId={cat.id} /> : null}
        </div>
      </div>
      {[
        ["Temperament", cat.temperament],
        ["About this cat", cat.description],
        ["Reason for rehoming", cat.rehomingReason],
      ].map(([label, value]) =>
        value ? (
          <section key={label} className="mt-6 max-w-3xl">
            <h2 className="font-bold">{label}</h2>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
              {value}
            </p>
          </section>
        ) : null,
      )}
    </article>
  );
}
```

### Photo GET handler

[`app/uploads/[...path]/route.ts`](../../app/uploads/%5B...path%5D/route.ts) · lines 1–50

<!-- prettier-ignore -->
```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { catImages, cats } from "@/db/schema";
import { isLiveListing } from "@/lib/listing-expiry";
import { UPLOAD_ROOT } from "@/lib/uploads";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;

  const root = path.resolve(UPLOAD_ROOT);
  const file = path.resolve(root, ...segments);

  // Block ../ tricks: the resolved path must stay inside uploads/.
  if (!file.startsWith(root + path.sep) || !file.endsWith(".webp")) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const key = segments.join("/");
    const [photo] = await db
      .select({ data: catImages.data })
      .from(catImages)
      .innerJoin(cats, eq(catImages.catId, cats.id))
      .where(and(eq(catImages.key, key), isLiveListing))
      .limit(1);
    // Only serve images belonging to a current, unexpired listing.
    if (!photo) return new Response("Not found", { status: 404 });
    const data = photo.data
      ? Buffer.from(photo.data, "base64")
      : await readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        // Listings expire after a week, so browsers needn't keep photos longer.
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("Not found", { status: 404 });
    }
    console.error("Could not load listing photo", error);
    return new Response("Photo temporarily unavailable", { status: 503 });
  }
}
```

## Clean up and recover

### Upload helpers

[`lib/uploads.ts`](../../lib/uploads.ts) · lines 1–32

<!-- prettier-ignore -->
```ts
import { unlink } from "node:fs/promises";
import path from "node:path";

// Legacy local uploads and GitHub photo exports. New uploads live in PostgreSQL.
export const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export function isWebp(buf: Buffer) {
  return (
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}

// Best-effort removal of local copies of deleted photos.
export async function removeLocalPhotos(keys: string[]) {
  const root = path.resolve(UPLOAD_ROOT);
  await Promise.all(
    keys.map(async (key) => {
      const file = path.resolve(root, key);
      // Only files inside uploads/; never directories or other paths.
      if (!file.startsWith(root + path.sep) || !file.endsWith(".webp")) return;
      try {
        await unlink(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error("Couldn't remove local listing photo", error);
        }
      }
    }),
  );
}
```

### Owner deletion controls

[`components/view/cat/DeleteListingButton.tsx`](../../components/view/cat/DeleteListingButton.tsx) · lines 1–71

<!-- prettier-ignore -->
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCatListing } from "@/app/(pages)/find_a_cat/[id]/delete-actions";

// "Mark adopted" is wired to the same removal flow as "Remove listing" for
// now; it gets its own server action (that updates status instead of
// deleting) in a later change.
export default function DeleteListingButton({ catId }: { catId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function removeListing() {
    if (pending) return;
    if (
      !window.confirm(
        "Delete this listing and its photos? This cannot be undone.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteCatListing(catId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.replace("/find_a_cat");
        router.refresh();
      } catch {
        setError("Couldn't delete the listing. Please try again.");
      }
    });
  }

  return (
    <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={removeListing}
        className="min-h-11 gap-2 px-4 font-bold"
      >
        <Check size={16} aria-hidden="true" />
        Mark adopted
      </Button>
      <Button
        type="button"
        variant="destructive"
        disabled={pending}
        onClick={removeListing}
        className="min-h-11 gap-2 px-4 font-bold"
      >
        <Trash2 size={16} aria-hidden="true" />
        {pending ? "Removing…" : "Remove listing"}
      </Button>
      {error && (
        <p role="alert" className="mt-2 w-full text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

### Owner deletion action

[`app/(pages)/find_a_cat/[id]/delete-actions.ts`](../../app/%28pages%29/find_a_cat/%5Bid%5D/delete-actions.ts) · lines 1–70

<!-- prettier-ignore -->
```ts
"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { catImages, cats } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { UPLOAD_ROOT } from "@/lib/uploads";

type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteCatListing(catId: number): Promise<DeleteResult> {
  const session = await getSession();
  if (!session?.user) return { ok: false, error: "Please log in first." };
  if (!Number.isSafeInteger(catId) || catId < 1) {
    return { ok: false, error: "Invalid listing." };
  }

  const ownedListing = and(
    eq(cats.id, catId),
    eq(cats.userId, session.user.id),
  );
  let images: { key: string }[];
  try {
    images = await db
      .select({ key: catImages.key })
      .from(catImages)
      .innerJoin(cats, eq(catImages.catId, cats.id))
      .where(ownedListing);
    // Check ownership in the mutation itself, including concurrent requests.
    // Related image records are removed by the database's cascading foreign key.
    const deleted = await db
      .delete(cats)
      .where(ownedListing)
      .returning({ id: cats.id });
    if (deleted.length === 0) {
      return { ok: false, error: "Listing not found or you don't own it." };
    }
  } catch (error) {
    console.error("Couldn't delete listing", error);
    return {
      ok: false,
      error: "Couldn't delete the listing. Please try again.",
    };
  }

  const ownerRoot = path.resolve(UPLOAD_ROOT, session.user.id);
  await Promise.all(
    images.map(async ({ key }) => {
      const file = path.resolve(UPLOAD_ROOT, key);
      // Only remove this owner's uploaded files; never directories or other paths.
      if (!file.startsWith(ownerRoot + path.sep) || !file.endsWith(".webp"))
        return;
      try {
        await unlink(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error("Couldn't remove deleted listing photo", error);
        }
      }
    }),
  );

  revalidatePath("/");
  revalidatePath("/find_a_cat");
  revalidatePath(`/find_a_cat/${catId}`);
  return { ok: true };
}
```

### Listing expiry

[`lib/listing-expiry.ts`](../../lib/listing-expiry.ts) · lines 1–54

<!-- prettier-ignore -->
```ts
import "server-only";

import { eq, gt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { catImages, cats } from "@/db/schema";
import { removeLocalPhotos } from "@/lib/uploads";

// Every listing, with its photos, is deleted this long after it was posted.
export const LISTING_LIFETIME_MONTHS = 3;

// Worked out in the database so every server agrees on "now".
const lifetime = sql`make_interval(months => ${LISTING_LIFETIME_MONTHS})`;
const cutoff = sql`now() - ${lifetime}`;
export const isLiveListing = gt(cats.createdAt, cutoff);
const isExpiredListing = lte(cats.createdAt, cutoff);
export const listingSecondsLeft = sql<number>`floor(extract(epoch from (${cats.createdAt} + ${lifetime} - now())))::int`;

// "in 3 days", "in 5 hours", "within the hour"
export function formatTimeLeft(secondsLeft: number) {
  const hours = Math.floor(secondsLeft / 3600);
  if (hours < 1) return "within the hour";
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

// Reads already hide expired listings via isLiveListing; this removes their
// rows and photos. Called with after() on busy pages, so it is throttled per
// server instance rather than run on every request.
const PURGE_EVERY_MS = 10 * 60 * 1000;
let lastPurgeAt = 0;

export async function purgeExpiredListings() {
  if (Date.now() - lastPurgeAt < PURGE_EVERY_MS) return;
  lastPurgeAt = Date.now();
  try {
    const images = await db
      .select({ key: catImages.key })
      .from(catImages)
      .innerJoin(cats, eq(catImages.catId, cats.id))
      .where(isExpiredListing);
    // Photo rows go with their listing through the cascading foreign key.
    const deleted = await db
      .delete(cats)
      .where(isExpiredListing)
      .returning({ id: cats.id });
    if (deleted.length === 0) return;
    await removeLocalPhotos(images.map(({ key }) => key));
    console.log(`Removed ${deleted.length} expired cat listing(s).`);
  } catch (error) {
    lastPurgeAt = 0; // try again on the next request
    console.error("Couldn't remove expired listings", error);
  }
}
```

### Legacy photo sync

[`scripts/sync-photos.ts`](../../scripts/sync-photos.ts) · lines 1–54

<!-- prettier-ignore -->
```ts
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_ROOT, isWebp } from "../lib/uploads";

// Run on any checkout with old local uploads to recover them into shared storage.
// Also export shared photos into uploads/ so they can be committed to GitHub.
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const photos = await sql`SELECT id, key, data FROM cat_images`;
  let imported = 0;
  let exported = 0;
  let missing = 0;
  for (const photo of photos) {
    const file = path.resolve(UPLOAD_ROOT, photo.key);
    if (
      !file.startsWith(path.resolve(UPLOAD_ROOT) + path.sep) ||
      !file.endsWith(".webp")
    ) {
      throw new Error("Invalid stored photo path");
    }
    if (photo.data) {
      const data = Buffer.from(photo.data, "base64");
      if (!isWebp(data)) throw new Error("Invalid shared WebP photo");
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, data);
      exported++;
    } else {
      let data: Buffer;
      try {
        data = await readFile(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        missing++;
        continue;
      }
      if (!isWebp(data)) throw new Error("Invalid local WebP photo");
      await sql`UPDATE cat_images SET data = ${data.toString("base64")} WHERE id = ${photo.id} AND data IS NULL`;
      imported++;
    }
  }
  console.log({ imported, exported, missing });
  if (missing) {
    console.warn(
      "Some photos are missing here. Run photos:sync on the computer that uploaded them.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Package commands

[`package.json`](../../package.json#L5-L14) · lines 5–14

<!-- prettier-ignore -->
```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run --exclude 'tests/**' && node --test tests/*.test.mjs",
    "photos:sync": "tsx scripts/sync-photos.ts"
  },
```

### Deletion tests

[`tests/delete-listing.test.mjs`](../../tests/delete-listing.test.mjs) · lines 1–191

<!-- prettier-ignore -->
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { PgDialect } from "drizzle-orm/pg-core";

const runtimeRequire = createRequire(import.meta.url);

function load(file, mocks = {}, globals = {}) {
  const testModule = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(code, {
    module: testModule,
    exports: testModule.exports,
    console: { error() {} },
    ...globals,
    require: (name) => (name in mocks ? mocks[name] : runtimeRequire(name)),
  });
  return testModule.exports;
}

const schema = load("db/schema.ts");
function setup({
  loggedIn = true,
  deleted = [{ id: 1 }],
  fail = false,
  images = [],
} = {}) {
  const conditions = [];
  const removed = [];
  const refreshed = [];
  const dialect = new PgDialect();
  const db = {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async (condition) => {
            conditions.push(dialect.sqlToQuery(condition));
            return images;
          },
        }),
      }),
    }),
    delete: () => ({
      where: (condition) => {
        conditions.push(dialect.sqlToQuery(condition));
        return {
          returning: async () => {
            if (fail) throw new Error("Database unavailable");
            return deleted;
          },
        };
      },
    }),
  };
  const { deleteCatListing } = load(
    "app/(pages)/find_a_cat/[id]/delete-actions.ts",
    {
      "@/db": { db },
      "@/db/schema": schema,
      "@/lib/auth": {
        getSession: async () => (loggedIn ? { user: { id: "owner" } } : null),
      },
      "@/lib/uploads": { UPLOAD_ROOT: path.resolve("/tmp/bilai-delete-test") },
      "node:fs/promises": { unlink: async (file) => removed.push(file) },
      "next/cache": { revalidatePath: (url) => refreshed.push(url) },
    },
  );
  return { deleteCatListing, conditions, removed, refreshed };
}

test("anonymous callers cannot query or delete listings", async () => {
  const state = setup({ loggedIn: false });
  assert.equal((await state.deleteCatListing(1)).ok, false);
  assert.equal(state.conditions.length, 0);
});

test("invalid listing IDs cannot reach the database", async () => {
  const state = setup();
  for (const id of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    "1",
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.equal((await state.deleteCatListing(id)).ok, false);
  }
  assert.equal(state.conditions.length, 0);
});

test("both photo lookup and delete are constrained by ID AND authenticated owner", async () => {
  const state = setup();
  assert.equal((await state.deleteCatListing(1)).ok, true);
  assert.equal(state.conditions.length, 2);
  for (const condition of state.conditions) {
    assert.match(
      condition.sql.replace(/[()]/g, ""),
      /"cats"\."id" = \$1 and "cats"\."user_id" = \$2/,
    );
    assert.deepEqual(condition.params, [1, "owner"]);
  }
});

test("missing, non-owned, or concurrently deleted listings do not delete files", async () => {
  const state = setup({ deleted: [], images: [{ key: "owner/photo.webp" }] });
  assert.equal((await state.deleteCatListing(1)).ok, false);
  assert.equal(state.removed.length, 0);
  assert.equal(state.refreshed.length, 0);
});

test("failed database mutation preserves uploaded files", async () => {
  const state = setup({ fail: true, images: [{ key: "owner/photo.webp" }] });
  assert.equal((await state.deleteCatListing(1)).ok, false);
  assert.equal(state.removed.length, 0);
});

test("successful deletion cleans only owner WebP files and refreshes affected pages", async () => {
  const state = setup({
    images: [
      { key: "owner/photo.webp" },
      { key: "../secret.webp" },
      { key: "other/photo.webp" },
      { key: "owner/../../secret.webp" },
      { key: "owner/document.txt" },
    ],
  });
  assert.equal((await state.deleteCatListing(1)).ok, true);
  assert.deepEqual(state.removed, [
    path.resolve("/tmp/bilai-delete-test/owner/photo.webp"),
  ]);
  assert.deepEqual(state.refreshed, ["/", "/find_a_cat", "/find_a_cat/1"]);
});

// Index 0 is "Mark adopted", index 1 is "Remove listing" — both are wired to
// the same removal flow for now, so both are exercised identically here.
for (const confirmed of [false, true]) {
  for (const [buttonIndex, buttonLabel] of [
    [0, "Mark adopted"],
    [1, "Remove listing"],
  ]) {
    test(`${buttonLabel} button: confirmation ${confirmed ? "accepts deletion and returns to directory" : "cancels without deleting"}`, async () => {
      let calls = 0;
      const navigations = [];
      const pending = [];
      const Component = load(
        "components/view/cat/DeleteListingButton.tsx",
        {
          react: {
            useState: () => [null, () => {}],
            useTransition: () => [
              false,
              (callback) => pending.push(callback()),
            ],
          },
          "next/navigation": {
            useRouter: () => ({
              replace: (url) => navigations.push(url),
              refresh() {},
            }),
          },
          "@/components/ui/button": { Button: () => null },
          "@/app/(pages)/find_a_cat/[id]/delete-actions": {
            deleteCatListing: async (id) => {
              assert.equal(id, 1);
              calls++;
              return { ok: true };
            },
          },
        },
        { window: { confirm: () => confirmed } },
      ).default;
      const tree = Component({ catId: 1 });
      tree.props.children[buttonIndex].props.onClick();
      await Promise.all(pending);
      assert.equal(calls, confirmed ? 1 : 0);
      assert.deepEqual(navigations, confirmed ? ["/find_a_cat"] : []);
    });
  }
}
```
