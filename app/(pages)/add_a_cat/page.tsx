"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function PageBody() {
  const [name, setName] = useState("");

  return (
    <div>
      {/* <FormElement/> is way to remove the pain of having to add and
      style labels and inputs individually for every single form field */}
      <FormElement
        labelText="Name"
        inputPlaceholder="Name"
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
    </div>
  );
}

function FormElement({
  labelText,
  inputPlaceholder,
  inputType = "text",
  onChange,
}: {
  labelText: string;
  inputPlaceholder: string;
  inputType?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  /* A way to remove the pain of having to add and style
    labels and inputs individually for every single form field */
  return (
    <div>
      <Label>{labelText}</Label>
      <Input
        type={inputType}
        placeholder={inputPlaceholder}
        onChange={(e) => onChange(e)}
      />
    </div>
  );
}
