"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "cn";

export type SearchSelectGroup = { value: string; items: string[] };

type SearchSelectProps = {
  id?: string;
  /** Flat list, or groups rendered with a heading each. */
  items: readonly string[] | SearchSelectGroup[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  required?: boolean;
  /** Added to the popup. It is portalled to <body>, so page theme classes
   *  (e.g. `theme-light`) have to be passed again here. */
  popupClassName?: string;
};

/**
 * A dropdown you can type into to filter, but which only accepts values from
 * the list (Base UI Combobox). Use it instead of a plain <select> when the list
 * is long enough that scrolling through it would be a chore.
 */
export function SearchSelect({
  id,
  items,
  value,
  onChange,
  placeholder,
  emptyText = "No matches.",
  disabled,
  required,
  popupClassName,
}: SearchSelectProps) {
  const grouped = items.length > 0 && typeof items[0] !== "string";

  return (
    <Combobox.Root
      items={items as string[] | SearchSelectGroup[]}
      value={value || null}
      onValueChange={(next) => onChange((next as string | null) ?? "")}
      disabled={disabled}
      required={required}
      autoHighlight
    >
      <Combobox.InputGroup
        className={cn(
          "relative flex h-10 w-full items-center rounded-lg border border-input bg-background transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        )}
      >
        <Combobox.Input
          id={id}
          placeholder={placeholder}
          className="h-full w-full min-w-0 rounded-lg bg-transparent pr-16 pl-2.5 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
        />
        <div className="absolute right-1 flex h-full items-center text-muted-foreground">
          <Combobox.Clear
            aria-label="Clear selection"
            className="flex size-7 items-center justify-center rounded-md hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </Combobox.Clear>
          <Combobox.Trigger
            aria-label="Show options"
            className="flex size-7 items-center justify-center rounded-md hover:text-foreground data-popup-open:rotate-180"
          >
            <ChevronDown className="size-4 transition-transform" aria-hidden />
          </Combobox.Trigger>
        </div>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner className="z-50 outline-none" sideOffset={4}>
          <Combobox.Popup
            className={cn(
              "w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
              "transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
              popupClassName,
            )}
          >
            <Combobox.Empty className="px-3 py-3 text-sm text-muted-foreground empty:hidden">
              {emptyText}
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(20rem,var(--available-height))] scroll-py-1 overflow-y-auto overscroll-contain p-1 outline-none data-empty:p-0">
              {grouped
                ? (group: SearchSelectGroup) => (
                    <Combobox.Group
                      key={group.value}
                      items={group.items}
                      className="pb-1 last:pb-0"
                    >
                      <Combobox.GroupLabel className="sticky top-0 z-10 bg-popover px-2 pt-2 pb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase select-none">
                        {group.value}
                      </Combobox.GroupLabel>
                      <Combobox.Collection>
                        {(item: string) => <Option key={item} value={item} />}
                      </Combobox.Collection>
                    </Combobox.Group>
                  )
                : (item: string) => <Option key={item} value={item} />}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function Option({ value }: { value: string }) {
  return (
    <Combobox.Item
      value={value}
      className="grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
    >
      <Combobox.ItemIndicator className="col-start-1">
        <Check className="size-4" aria-hidden />
      </Combobox.ItemIndicator>
      <span className="col-start-2">{value}</span>
    </Combobox.Item>
  );
}
