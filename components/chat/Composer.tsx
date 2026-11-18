"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import type { Message, SendMessageParams } from "@ably/chat";
import { useTyping } from "@ably/chat/react";
import { Button } from "@/components/ui/button";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_SEND_COOLDOWN_MS,
} from "@/lib/chat-limits";

// Our own message box instead of the UI kit's MessageInput, which can't be
// prefilled (the Chat button on a cat page fills in "Hi! I'm interested in…").
// Must be rendered inside a <ChatRoomProvider>.
export default function Composer({
  initialText = "",
  otherName,
  sendMessage,
  onSent,
}: {
  initialText?: string;
  otherName: string;
  // From the conversation's useMessages(), so the room has one subscription.
  sendMessage: (params: SendMessageParams) => Promise<Message>;
  onSent: (message: Message) => void;
}) {
  const [text, setText] = useState(initialText);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSentAt = useRef(0);
  const field = useRef<HTMLTextAreaElement>(null);
  const { keystroke, stop } = useTyping();

  // A prefilled message gets focus with the cursor at the end, ready to edit.
  useEffect(() => {
    const el = field.current;
    if (!initialText || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [initialText]);

  async function send() {
    const value = text.trim();
    if (!value || sending) return;
    if (value.length > CHAT_MESSAGE_MAX_LENGTH) {
      setError(
        `Messages can be up to ${CHAT_MESSAGE_MAX_LENGTH.toLocaleString()} characters.`,
      );
      return;
    }
    if (Date.now() - lastSentAt.current < CHAT_SEND_COOLDOWN_MS) {
      setError("You're sending messages too quickly. Wait a moment.");
      return;
    }

    lastSentAt.current = Date.now();
    setSending(true);
    setError(null);
    try {
      const message = await sendMessage({ text: value });
      setText("");
      onSent(message);
      stop().catch(() => {});
    } catch (err) {
      console.error(err);
      setError("Couldn't send your message. Please try again.");
    } finally {
      setSending(false);
      field.current?.focus();
    }
  }

  const nearLimit = text.length > CHAT_MESSAGE_MAX_LENGTH - 200;

  return (
    <form
      className="flex w-full flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <div className="flex items-end gap-2">
        <label htmlFor="chat-composer" className="sr-only">
          Message {otherName}
        </label>
        <textarea
          id="chat-composer"
          ref={field}
          rows={1}
          value={text}
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          placeholder={`Message ${otherName}`}
          onChange={(event) => {
            const value = event.target.value;
            setText(value);
            (value.trim() ? keystroke() : stop()).catch(() => {});
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          className="field-sizing-content max-h-36 min-h-11 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-base leading-snug outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button
          type="submit"
          size="icon-lg"
          disabled={sending || !text.trim()}
          aria-label="Send message"
          className="size-11 rounded-lg"
        >
          <SendHorizontal />
        </Button>
      </div>
      {(error || nearLimit) && (
        <p
          role={error ? "alert" : undefined}
          className={
            error ? "text-sm text-destructive" : "text-sm text-muted-foreground"
          }
        >
          {error ??
            `${text.length.toLocaleString()} / ${CHAT_MESSAGE_MAX_LENGTH.toLocaleString()}`}
        </p>
      )}
    </form>
  );
}
