"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useId, useState, useTransition } from "react";
import ImageGallery, { type GalleryImage } from "./ImageGallery";
import { submitForm } from "./actions";

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

function clamp(value: string, min: number, max: number) {
  if (value === "") return "";
  const n = Math.floor(Number(value));
  if (Number.isNaN(n)) return "";
  return String(Math.min(max, Math.max(min, n)));
}

export default function PageBody() {
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [ageYears, setAgeYears] = useState("0");
  const [ageMonths, setAgeMonths] = useState("0");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!gender) {
      setError("Please choose a gender.");
      return;
    }
    if (images.length === 0) {
      setError("Please add at least one image.");
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
        formData.set("locality", locality);
        formData.set("city", city);
        formData.set("gender", gender);
        // Same order as the gallery: the first image is the cover.
        for (const img of images) {
          formData.append("images", img.file);
          formData.append("captions", img.caption);
        }

        const result = await submitForm(formData);
        if (result && !result.ok) setError(result.error);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
        );
      }
    });
  }

  return (
    <div className="theme-light flex flex-1 flex-col bg-background text-foreground">
      <main className="wrap flex justify-center py-8">
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-2xl flex-col gap-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8"
        >
          {/* <FormElement/> is way to remove the pain of having to add and
        style labels and inputs individually for every single form field */}
          <FormElement
            labelText="Name"
            inputPlaceholder="Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />

          <FormElement
            labelText="Breed"
            inputPlaceholder="Start typing or pick a suggestion"
            suggestions={BREED_SUGGESTIONS}
            value={breed}
            onChange={(e) => {
              setBreed(e.target.value);
            }}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Age</legend>
            <div className="grid grid-cols-2 gap-4">
              <FormElement
                labelText="Years"
                inputPlaceholder="0"
                inputType="number"
                min={0}
                max={30}
                value={ageYears}
                onChange={(e) => {
                  setAgeYears(clamp(e.target.value, 0, 30));
                }}
              />
              <FormElement
                labelText="Months"
                inputPlaceholder="0"
                inputType="number"
                min={0}
                max={11}
                value={ageMonths}
                onChange={(e) => {
                  setAgeMonths(clamp(e.target.value, 0, 11));
                }}
              />
            </div>
          </fieldset>

          <div className="grid gap-6 sm:grid-cols-2 sm:gap-4">
            <FormElement
              labelText="Locality"
              inputPlaceholder="e.g. Mirpur"
              value={locality}
              onChange={(e) => {
                setLocality(e.target.value);
              }}
            />
            <FormElement
              labelText="City"
              inputPlaceholder="e.g. Dhaka"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
              }}
            />
          </div>

          <RadioGroup
            legend="Gender"
            name="gender"
            options={GENDER_OPTIONS}
            value={gender}
            onChange={setGender}
          />

          <ImageGallery images={images} onChange={setImages} />

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="h-12 w-full bg-[#ff7640] text-base font-bold text-mauve-950 hover:bg-[#ff7640]/85"
          >
            {isPending ? "Saving…" : "Save Cat Profile"}
          </Button>
        </form>
      </main>
    </div>
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
}) {
  /* A way to remove the pain of having to add and style
    labels and inputs individually for every single form field */
  const id = useId();
  const listId = `${id}-list`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{labelText}</Label>
      <Input
        id={id}
        type={inputType}
        placeholder={inputPlaceholder}
        value={value}
        min={min}
        max={max}
        list={suggestions ? listId : undefined}
        className="h-10 bg-background"
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
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-muted has-checked:border-secondary has-checked:bg-secondary/20 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="size-4 accent-secondary outline-none"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
