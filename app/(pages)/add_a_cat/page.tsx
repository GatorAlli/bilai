"use client";

import Navbar from "@/components/view/navbar/Navbar";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useId, useState, useTransition } from "react";
import ImageGallery, { type GalleryImage } from "./ImageGallery";
import { submitForm } from "./actions";
import {
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
  const [vaccinated, setVaccinated] = useState<YesNoUnknown | "">("");
  const [neutered, setNeutered] = useState<YesNoUnknown | "">("");
  const [temperament, setTemperament] = useState("");
  const [description, setDescription] = useState("");
  const [rehomingReason, setRehomingReason] = useState("");
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
    if (!vaccinated) {
      setError("Please say whether the cat is vaccinated.");
      return;
    }
    if (!neutered) {
      setError("Please say whether the cat is spayed/neutered.");
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
        formData.set("locality", locality);
        formData.set("city", city);
        formData.set("gender", gender);
        formData.set("vaccinated", vaccinated);
        formData.set("neutered", neutered);
        formData.set("temperament", temperament);
        formData.set("description", description);
        formData.set("rehomingReason", rehomingReason);
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
    <div className="theme-light flex flex-1 flex-col bg-background text-foreground">
      <Navbar />
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

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold">Age</legend>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Input
                id="age-years"
                type="number"
                min={0}
                max={30}
                placeholder="0"
                value={ageYears}
                onChange={(e) => setAgeYears(clamp(e.target.value, 0, 30))}
                className="h-10 w-20 bg-background"
              />
              <Label htmlFor="age-years">Years</Label>
              <Input
                id="age-months"
                type="number"
                min={0}
                max={11}
                placeholder="0"
                value={ageMonths}
                onChange={(e) => setAgeMonths(clamp(e.target.value, 0, 11))}
                className="ml-2 h-10 w-20 bg-background"
              />
              <Label htmlFor="age-months">Months</Label>
            </div>
          </fieldset>

          <RadioGroup
            legend="Gender"
            name="gender"
            options={GENDER_OPTIONS}
            value={gender}
            onChange={setGender}
          />

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

          <FormElement
            labelText="Temperament"
            inputPlaceholder="Playful, Shy, Calm, Friendly..."
            maxLength={MAX_TEMPERAMENT_LENGTH}
            value={temperament}
            onChange={(e) => {
              setTemperament(e.target.value);
            }}
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
        className="w-full resize-y rounded-lg border border-input bg-background px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
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
