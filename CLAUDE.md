# CLAUDE.md

@AGENTS.md

`AGENTS.md` (imported above) is the single source of truth for this repo: project overview, commands, **the project file structure**, architecture, and working agreements. Do not duplicate its content here. If you change the file structure, update the "Project file structure" section in `AGENTS.md`.

## Claude Code-only notes

- **Prettier on save is automatic.** `.claude/settings.json` registers a `PostToolUse` hook (`Edit|Write|MultiEdit`) that runs `.claude/hooks/format.mjs`, which executes `prettier --write` on the file you just touched. You still run `npm run format:check` before finishing if you edited many files or used Bash to write files (the hook does not see those).
- **Skills** live in `.claude/skills/` as symlinks into `.agents/skills/`. Use the `conventional-commit` skill for commit messages.
- **Sync rule:** `CLAUDE.md` must stay a thin wrapper. Anything that applies to all agents belongs in `AGENTS.md`; only Claude Code-specific behaviour (hooks, settings, slash commands) is documented here.
