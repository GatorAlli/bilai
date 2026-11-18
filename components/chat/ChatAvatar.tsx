import type { ChatUser } from "@/lib/chat";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")
  ).toUpperCase();
}

export default function ChatAvatar({
  user,
  className,
}: {
  user: ChatUser;
  className?: string;
}) {
  return user.image ? (
    // Profile images come from Google or our own uploads; a plain <img> keeps
    // this light inside the lazily loaded chat panel.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={user.image}
      alt=""
      referrerPolicy="no-referrer"
      className={cn("size-9 shrink-0 rounded-full object-cover", className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground",
        className,
      )}
    >
      {initials(user.name) || "?"}
    </span>
  );
}
