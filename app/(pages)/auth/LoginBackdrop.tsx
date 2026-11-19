import CatDoodle, {
  type CatDoodleName,
} from "@/components/view/doodles/CatDoodle";
import DoodleDrift from "@/components/view/doodles/DoodleDrift";
import { cn } from "@/lib/utils";

// The pencilled cats behind the login card. Each one is placed by hand in the
// 3x3 grid so the middle column stays clear for the form.
const doodle =
  "grid place-items-center overflow-hidden text-action opacity-[.48]";
const bigDoodle =
  "h-auto w-[clamp(3.5rem,7.5vw,6.5rem)] max-[44rem]:w-[3.1rem]";
const smallDoodle =
  "h-auto w-[clamp(2.5rem,5.8vw,4.75rem)] max-[44rem]:w-[3.1rem]";

const doodles: Array<{
  name: CatDoodleName;
  className: string;
  iconClassName: string;
}> = [
  {
    name: "rest",
    className: "col-start-1 row-start-1",
    iconClassName: bigDoodle,
  },
  {
    name: "walk",
    className: "col-start-3 row-start-1 max-[44rem]:col-start-2",
    iconClassName: bigDoodle,
  },
  {
    name: "peek",
    className: "col-start-1 row-start-2 max-[44rem]:hidden",
    iconClassName: bigDoodle,
  },
  {
    name: "play",
    className: "col-start-3 row-start-2 max-[44rem]:hidden",
    iconClassName: bigDoodle,
  },
  {
    name: "yarn",
    className: "col-start-1 row-start-3 text-clay",
    iconClassName: smallDoodle,
  },
  {
    name: "fish",
    className: "col-start-3 row-start-3 max-[44rem]:col-start-2 text-clay",
    iconClassName: smallDoodle,
  },
];

export default function LoginBackdrop() {
  return (
    <DoodleDrift className="pointer-events-none absolute inset-0 -z-1 grid grid-cols-[minmax(0,1fr)_minmax(29rem,42%)_minmax(0,1fr)] grid-rows-3 px-gutter py-[clamp(.75rem,2vw,1.75rem)] max-[44rem]:grid-cols-2 max-[44rem]:grid-rows-[4.75rem_minmax(0,1fr)_4.75rem] max-[44rem]:p-0 print:hidden">
      {doodles.map(({ name, className, iconClassName }) => (
        <span key={name} data-doodle className={cn(doodle, className)}>
          <CatDoodle name={name} className={iconClassName} />
        </span>
      ))}
    </DoodleDrift>
  );
}
