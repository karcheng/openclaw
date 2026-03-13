This is how I start the app:
pnpm exec tsx src/index.ts gateway --port 18789 --verbose
-----

When you start the app with pnpm exec tsx src/index.ts gateway --port 18789 --verbose, you are bypassing the normal production bootstrapper(entry.ts) and the dispatcher(run-main.ts).

In this development-specific flow, the startup sequence is much more direct:

## Direct Execution via tsx

Since you are calling src/index.ts directly, Node.js (via tsx) executes that file. The isMain check at the bottom of the file evaluates to true.

## Environment Initialization
Before doing anything else, src/index.ts runs its top-level side effects (lines 36-44):

- .env Loading: loadDotEnv({ quiet: true }) loads your environment variables.
- Env Normalization: normalizeEnv() ensures path variables and other settings are consistent.
- Logger Setup: enableConsoleCapture() starts capturing console output for structured logs.
- Runtime Guard: assertSupportedRuntime() ensures you aren't running on an unsupported Node.js version.

## Program Building
It then calls buildProgram() (line 48). Because this is index.ts, it uses the buildProgram imported from ./cli/program.js. Inside buildProgram it does the following:

- It creates the Commander Command object.
- It registers core commands via registerProgramCommands.

## The isMain Block
The logic inside the if (isMain) block (line 79) initiates:

- Error Handling: It installs handlers for unhandled rejections and uncaught exceptions to provide the [openclaw] branded error messages you see.
- Parsing: It calls program.parseAsync(process.argv).

## Key Differences in your tsx flow:
Compared to the standard openclaw command, your tsx src/index.ts approach:

- Skips Respawning: It does not automatically add --disable-warning=ExperimentalWarning.
- Skips Windows Normalization: If you are on Windows, the argument cleaning logic in entry.ts is skipped (though tsx usually handles this well enough for development).
- Skips "Routing": The optimized tryRouteCli logic (which allows lightning-fast startup for simple commands) is not used.
- Skips Lazy-Loading: The dispatcher in run-main.ts has logic to only load the specific subcommand you asked for (e.g., gateway). By running index.ts directly, the app might end up loading more command definitions than strictly necessary for that one execution.

In summary: In your case, src/index.ts acts as both the library entry point and a "lite" development CLI runner.