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
