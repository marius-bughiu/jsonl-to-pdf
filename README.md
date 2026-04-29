# jsonl-to-pdf

> **Turn your AI coding sessions into shareable PDFs.**

[![npm](https://img.shields.io/npm/v/jsonl-to-pdf.svg)](https://www.npmjs.com/package/jsonl-to-pdf)
[![downloads](https://img.shields.io/npm/dm/jsonl-to-pdf.svg)](https://www.npmjs.com/package/jsonl-to-pdf)
[![release](https://img.shields.io/github/v/release/marius-bughiu/jsonl-to-pdf)](https://github.com/marius-bughiu/jsonl-to-pdf/releases)
[![license](https://img.shields.io/npm/l/jsonl-to-pdf.svg)](./LICENSE)

Every conversation you have with Claude Code lives as a `.jsonl` file deep inside `~/.claude/projects/`. **`jsonl-to-pdf`** turns those into PDFs you can read, share, archive, attach to a PR, or hand to a teammate over Slack.

```
$ jsonl-to-pdf
◆ Project   C:\S\my-app
◆ Session   Refactor the billing module to use Stripe webhooks  · 2h ago · 412KB
◆ Include sub-agent conversations? › Yes

✓ Wrote refactor-the-billing-module-to-use-stripe-webhooks.pdf
```

That's it. Pick a session, get a PDF. Sub-agents nested inline, code blocks rendered properly, page-breaks that don't tear in the middle of a token.

---

## Try it without installing

```bash
# npx (Node)
npx jsonl-to-pdf

# bunx (Bun)
bunx jsonl-to-pdf

# pnpm
pnpm dlx jsonl-to-pdf
```

That'll drop you straight into the interactive picker — no global install, no `package.json`. Same flags work: `npx jsonl-to-pdf convert session.jsonl --dark`.

## Install

```bash
# npm
npm i -g jsonl-to-pdf

# bun
bun i -g jsonl-to-pdf

# or grab a standalone binary (no Node, no npm)
# macOS / Linux:
curl -fsSL https://github.com/marius-bughiu/jsonl-to-pdf/releases/latest/download/install.sh | sh
# Windows: download jsonl-to-pdf-win-x64.exe from the latest release
```

The binaries on GitHub Releases are built with `bun build --compile` — single-file executables, no runtime required.

---

## Usage

```bash
# interactive: pick a project, then a session, then go
jsonl-to-pdf

# or aim it at a specific file
jsonl-to-pdf convert ~/.claude/projects/C--S-my-app/abc-123.jsonl

# pipe to a PDF reader, printer, or anywhere
jsonl-to-pdf convert session.jsonl -o - | lp

# list every Claude Code session on this machine
jsonl-to-pdf list
```

### Flags

| Flag | What it does |
|---|---|
| `-o, --output <path>` | Output file (default: `<title>.pdf`). Use `-` to write to stdout. |
| `--no-subagents` | Skip the conversations of any sub-agents the main agent spawned. |
| `--subagents-mode appendix` | Render sub-agents as an appendix instead of inline. |
| `--compact` | Hide thinking blocks and trim long tool I/O to ~30 lines. |
| `--no-thinking` | Hide assistant *thinking* blocks only. |
| `--dark` | Dark theme. Looks great on a screen, less great on paper. |
| `--redact` | Strip AWS keys, GitHub tokens, OpenAI/Anthropic keys, `Bearer` headers, private keys. |
| `--agent <id>` | Force the adapter (default: auto-detect). |

Run `jsonl-to-pdf --help` for the full list.

---

## Why

- **Archive.** Conversations get rotated and forgotten. A PDF survives.
- **Share.** Drop one in a doc, attach to a PR, send a teammate the receipts.
- **Review.** Read your AI work the way you read code review — at a desk, on a flight, on paper.
- **Audit.** A signed, deterministic export of what was actually said and run.
- **Learn.** Hand juniors a real session as study material instead of a generic tutorial.

---

## What it captures

Out of the box, `jsonl-to-pdf` keeps the **full fidelity** of the session:

- Every user prompt and assistant response
- *Thinking* blocks (the model's internal reasoning)
- Every tool call with its full input
- Every tool result, including the full bash output
- Image attachments, embedded inline
- **Sub-agents** — when the main agent spawned a `Task`/`Agent`, that whole sub-conversation is rendered nested at the right place. Recursive. Sub-agents that spawn sub-agents work too.

If full fidelity is too much for the medium (say, you're sharing it externally), `--compact` shrinks it to the essentials and `--redact` strips the obvious secrets.

---

## Recipes

**Batch convert your last week.**
```bash
jsonl-to-pdf list --json |
  jq -r '.[] | select(.modifiedAt > "2026-04-22") | .filePath' |
  while read f; do jsonl-to-pdf convert "$f"; done
```

**Attach as a CI artifact.**
```yaml
- run: npx -y jsonl-to-pdf convert "$CLAUDE_SESSION_FILE" -o session.pdf
- uses: actions/upload-artifact@v4
  with: { name: claude-session, path: session.pdf }
```

**Print to your default printer.**
```bash
jsonl-to-pdf convert session.jsonl -o - | lp
```

**Share without leaking secrets.**
```bash
jsonl-to-pdf convert session.jsonl --redact --compact
```

---

## Where Claude Code keeps things

Claude Code writes one JSONL per session at `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`. Path encoding flattens separators to `-` (so `C:\S\my-app` becomes `C--S-my-app`). Sub-agent conversations live as separate JSONL files in `<session-id>/subagents/`. `jsonl-to-pdf list` walks all of that for you.

---

## Roadmap

- Adapters for **Aider**, **OpenAI Codex CLI**, **Cursor Compose**, **Gemini CLI**
- HTML output (for inline web sharing) and a static viewer
- Syntax highlighting for code blocks (Shiki tokens)
- ToC with page numbers (currently: PDF outlines / bookmarks)
- Filtering: `--turns 5..15`, `--only assistant`, `--exclude-tool Bash`

Open an issue if you have an agent that writes JSONL we should support.

---

## Contributing

```bash
git clone https://github.com/marius-bughiu/jsonl-to-pdf.git
cd jsonl-to-pdf
npm install
npm test
npm run build
node dist/cli.js list
```

PRs welcome. Adapter contributions especially welcome — see `src/adapters/claude-code.ts` for the shape.

---

## License

MIT — see [LICENSE](./LICENSE).
