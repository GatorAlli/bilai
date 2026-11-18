// PostToolUse hook: runs Prettier on any file Claude just wrote or edited.
// Reads the hook payload from stdin, formats the file in place, never blocks.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { extname } from "node:path";

const FORMATTABLE = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".md",
  ".mdx",
  ".html",
  ".yml",
  ".yaml",
]);

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

try {
  const payload = JSON.parse(raw);
  const file = payload?.tool_input?.file_path;
  if (file && existsSync(file) && FORMATTABLE.has(extname(file))) {
    execFileSync("npx", ["--no-install", "prettier", "--write", file], {
      cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
      stdio: "ignore",
    });
  }
} catch {
  // Ignored files, parse errors, etc. must never break the agent's edit.
}
