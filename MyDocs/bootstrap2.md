## How `createSystemPromptOverride` works

Located in `src/agents/pi-embedded-runner/system-prompt.ts`, the function is simple but serves a specific purpose in the system prompt pipeline:

```ts
export function createSystemPromptOverride(
  systemPrompt: string,
): (defaultPrompt?: string) => string {
  const override = systemPrompt.trim();
  return (_defaultPrompt?: string) => override;
}
```

### What it does

1. **Takes** a raw `systemPrompt` string as input.
2. **Trims** it immediately (whitespace normalization at creation time, not call time).
3. **Returns a closure** — a function with the signature `(defaultPrompt?: string) => string` — that, when called, **always returns the trimmed override string**, ignoring the `defaultPrompt` argument entirely (`_defaultPrompt` is intentionally unused).

### Purpose / design intent

The returned function conforms to the same interface as a "system prompt builder" — something that _could_ receive the default/generated system prompt and either pass it through or replace it. By naming the parameter `_defaultPrompt` (underscore prefix = intentionally unused), the function is a **hard override**: it completely discards the default prompt and substitutes the caller-supplied one.

This pattern lets callers decide at runtime whether they want:

- A **hard override** (via `createSystemPromptOverride`) — ignores whatever the agent would normally compute.
- A **pass-through or dynamic builder** — a function that actually uses `defaultPrompt` to augment or conditionally replace it.

### How it's consumed

The companion function `applySystemPromptOverrideToSession` in the same file accepts either a plain `string` or a `(defaultPrompt?) => string` function:

```ts
export function applySystemPromptOverrideToSession(
  session: AgentSession,
  override: string | ((defaultPrompt?: string) => string),
) {
  const prompt = typeof override === "function" ? override() : override.trim();
  session.agent.setSystemPrompt(prompt);
  // Also patches the session's internal rebuild hook so re-initialization
  // doesn't revert back to the generated prompt:
  mutableSession._baseSystemPrompt = prompt;
  mutableSession._rebuildSystemPrompt = () => prompt;
}
```

So `createSystemPromptOverride("My custom prompt")` produces a function you can pass directly to `applySystemPromptOverrideToSession`. The session's internal `_rebuildSystemPrompt` is also patched to return the same fixed string, so even if the agent tries to "rebuild" its system prompt (e.g. when tools change), it stays locked to the override rather than regenerating from `buildEmbeddedSystemPrompt`.

### Summary

| Step                                      | What happens      |
| ----------------------------------------- | ---------------------------------------------------------------------------- | `createSystemPromptOverride(str)`         | Trims `str`, returns a closure capturing it      |
| Closure is called `(defaultPrompt?)`      | Returns the trimmed override, ignoring `defaultPrompt`              |
| `applySystemPromptOverrideToSession(...)` | Calls the closure, sets it on the agent, and locks `_rebuildSystemPrompt` so it stays fixed |
