import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function AddACat() {
  return (
    <div>
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
  return (
    <div>
      <Label>{labelText}</Label>
      <Input type={inputType} placeholder={inputPlaceholder}></Input>
    </div>
  );
}
