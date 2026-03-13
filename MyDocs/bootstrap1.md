When I installrf openclaw and one of the question it asked esds " How do you want to hatch your bot? │ Hatch in TUI (recommended)"

I use TUI. I think TUI read a directory that contains md files and oneof them is bootstrap.md. I like to know that execution flow that does that and how it package it a prompt and sends to llm. Somehow in this process the app calls createSystemPromptOverride(). I like to understand the program flow please

Cline read 6 files, 3 folders, performed 3 searches:

src/
"bootstrap\.md" in src/
"createSystemPromptOverride" in src/
src/tui/
src/agents/pi-embedded-runner/run/attempt.ts
src/wizard/
src/agents/bootstrap-files.ts
src/tui/tui.ts
src/agents/workspace.ts
"buildBootstrapContextFiles" in src/agents/
src/agents/pi-embedded-helpers/bootstrap.ts

## Full execution flow:

TUI → bootstrap.md files → `createSystemPromptOverride` → LLM

---

### 1. TUI "Hatch in TUI" — what it actually is

The TUI (`src/tui/tui.ts`) is a **terminal chat client**. It does **not** talk to the LLM directly. It connects to the running OpenClaw **gateway** over a WebSocket via `GatewayChatClient`. When you type a message, `sendMessage()` sends it to the gateway, which then dispatches it into `runEmbeddedAttempt`.

---

### 2. `runEmbeddedAttempt` — the core runner (`src/agents/pi-embedded-runner/run/attempt.ts`)

This is where everything happens. When the gateway receives a message, it eventually calls `runEmbeddedAttempt(params)`. Here is the step-by-step flow inside it:

---

#### Step A — Read the workspace `.md` files

```
runCliAgent() in src\agents\cli-runner.ts
-> resolveBootstrapContextForRun

---
resolveBootstrapContextForRun(workspaceDir, ...) - src\agents\bootstrap-files.ts
  → loadWorkspaceBootstrapFiles(workspaceDir)    // src/agents/workspace.ts
  → filterBootstrapFilesForSession(files, sessionKey)
  → applyBootstrapHookOverrides(...)             // hooks can inject/override
  → buildBootstrapContextFiles(files, maxChars)  // src/agents/pi-embedded-helpers/bootstrap.ts
```

`loadWorkspaceBootstrapFiles` scans **`~/.openclaw/workspace/`** (the workspace dir) and reads these files **in order**:

| File                      | Purpose                        |
| ------------------------- | ------------------------------ |
| `AGENTS.md`               | Agent rules/instructions       |
| `SOUL.md`                 | Persona/tone                   |
| `TOOLS.md`                | Guidance on external tools     |
| `IDENTITY.md`             | Agent identity                 |
| `USER.md`                 | Info about the user            |
| `HEARTBEAT.md`            | Heartbeat config               |
| `BOOTSTRAP.md`            | General bootstrap instructions |
| `MEMORY.md` / `memory.md` | Memory notes                   |

Each file is read from disk (or marked missing: true if absent).

buildBootstrapContextFiles then converts them into EmbeddedContextFile[] objects ({ path, content }). Content longer than bootstrapMaxChars (default 20,000 chars) is trimmed: it keeps the first 70% and last 20%, with a truncation marker in between.

---

#### Step B — Build the full system prompt text

```
buildEmbeddedSystemPrompt({
  workspaceDir,
  tools,
  runtimeInfo,
  skillsPrompt,
  contextFiles,   ← the .md files from Step A
  ...
})
  → buildAgentSystemPrompt(...)   // src/agents/system-prompt.ts
```

`buildAgentSystemPrompt` assembles a large string from many sections:

- **Tooling** — list of available tools
- **Safety** — safety rules
- **Skills** — skill scanning instructions
- **Memory** — memory recall instructions
- **Workspace** — working directory path + notes
- **# Project Context** ← **HERE the .md files are injected:**

```
# Project Context

The following project context files have been loaded:
[If SOUL.md present: embody its persona...]

## AGENTS.md
<content of AGENTS.md>

## SOUL.md
<content of SOUL.md>

## BOOTSTRAP.md
<content of BOOTSTRAP.md>

... (all non-missing, non-empty files)
```

Each file's content is literally appended under a `## <filename>` heading. The LLM sees all of it as part of the system prompt.

---

#### Step C — `createSystemPromptOverride` freezes the prompt string

```ts
const appendPrompt = buildEmbeddedSystemPrompt({ ..., contextFiles });
// appendPrompt is a ~long string containing all .md files inline

const systemPromptOverride = createSystemPromptOverride(appendPrompt);
// returns: (_defaultPrompt?) => appendPrompt.trim()

const systemPromptText = systemPromptOverride();
// systemPromptText === the trimmed assembled prompt
```

**Why the override pattern?**  
`createAgentSession` (from `@mariozechner/pi-coding-agent`) internally generates its _own_ default system prompt. `createSystemPromptOverride` creates a function that **always ignores** that default and returns the OpenClaw-assembled prompt instead. The function is then applied via:

```ts
applySystemPromptOverrideToSession(session, systemPromptText);
// → session.agent.setSystemPrompt(systemPromptText)
// → session._baseSystemPrompt = systemPromptText
// → session._rebuildSystemPrompt = () => systemPromptText   ← locks it permanently
```

The `_rebuildSystemPrompt` patch is critical: it ensures that even if the SDK tries to _re-build_ the system prompt later (e.g., when tool lists change), it keeps returning the OpenClaw-controlled string instead of reverting to the SDK's default.

---

#### Step D — Prompt the LLM

```ts
await activeSession.prompt(effectivePrompt);
// effectivePrompt = user's message (optionally prepended by before_agent_start hooks)
```

The SDK takes `effectivePrompt` as the **user turn** and the previously set system prompt as the **system turn**, then streams the response back through subscriptions wired to `onPartialReply`, `onBlockReply`, etc., which the gateway routes back to the TUI chat log.

---

### Complete flow diagram

```
TUI (user types message)
  │
  ▼
GatewayChatClient (WebSocket to gateway)
  │
  ▼
Gateway dispatches → runEmbeddedAttempt(params)
  │
  ├─① loadWorkspaceBootstrapFiles(~/.openclaw/workspace/)
  │     reads: AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md,
  │            USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md
  │     → WorkspaceBootstrapFile[] (content + missing flag)
  │
  ├─② buildBootstrapContextFiles(files, maxChars=20000)
  │     trims oversized files (head 70% + tail 20%)
  │     → EmbeddedContextFile[] ({ path, content })
  │
  ├─③ buildEmbeddedSystemPrompt({ contextFiles, tools, runtimeInfo, ... })
  │     → buildAgentSystemPrompt(...)
  │       assembles sections: Tooling, Safety, Skills, Memory,
  │       Workspace, + "# Project Context" with all .md files inlined
  │     → appendPrompt (full system prompt string)
  │
  ├─④ createSystemPromptOverride(appendPrompt)
  │     → closure: (_default?) => appendPrompt.trim()
  │     systemPromptText = closure()
  │
  ├─⑤ createAgentSession(...)  ← SDK session (pi-coding-agent)
  │
  ├─⑥ applySystemPromptOverrideToSession(session, systemPromptText)
  │     setSystemPrompt(systemPromptText)
  │     _rebuildSystemPrompt = () => systemPromptText  ← permanently locked
  │
  └─⑦ activeSession.prompt(userMessage)
        → LLM API (system=systemPromptText, user=userMessage)
        → streamed response → gateway → TUI
```
