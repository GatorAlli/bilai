import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function PageBody() {
  return (
    <div>
      {/* <FormElement/> is way to remove the pain of having to add and
      style labels and inputs individually for every single form field */}
      <FormElement labelText="Name" inputPlaceholder="Name" />
    </div>
  );
}

function FormElement({
  labelText,
  inputPlaceholder,
  inputType = "text",
}: {
  labelText: string;
  inputPlaceholder: string;
  inputType?: string;
}) {
  /* A way to remove the pain of having to add and style
    labels and inputs individually for every single form field */
  return (
    <div>
      <Label>{labelText}</Label>
      <Input type={inputType} placeholder={inputPlaceholder} />
    </div>
  );
}
