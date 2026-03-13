The main entry point for the openclaw project depends on whether you are looking at the source code, the compiled application, or the CLI binary.

## CLI Entry Point (The Binary)
If you install the package or run it via the command line, the entry point is 
openclaw.mjs in the root directory. This is specified in the package.json,  the command openclaw is registered to the openclaw.mjs file:
```
"bin": {
  "openclaw": "openclaw.mjs"
}
```
## The Wrapper (openclaw.mjs)
When you run openclaw, this script is the first to execute abd it is is a small wrapper that enables the Node.js compile cache and then imports the compiled entry script:
```
// openclaw.mjs
await import("./dist/entry.js");
```
## The Bootstrapper (src/entry.ts)

If you are looking at the source code (e.g., running it directly or debugging), the entry point is src/entry.ts. it prepares the Node.js environment. it responsibilities include:
    - **Environment Normalization**: It cleans up process.argv on Windows to handle differences in how shells pass arguments. Ensuring consistent environment variables across platforms and keep the output clean.
    - **Process Respawning**: It may respawn the Node.js process with specific flags (like --disable-warning=ExperimentalWarning) if they aren't already set.
    - **Profile Loading**: It parses special flags (like --profile) to set up specific environment variables.
    - **CLI Initialization**: It eventually imports and calls the runCli function from src/cli/run-main.ts.

## The Dispatcher (src/cli/run-main.ts)

The core CLI orchestration happens in src/cli/run-main.ts. This is where the actual CLI logic begins:
    - **Routing**: It first calls tryRouteCli() to check if the command is a "routed" shortcut (optimized paths for specific commands that don't need the full CLI setup).
    - **Program Building**: It calls buildProgram() (from src/cli/program/build-program.ts) to initialize the Commander instance.
    - **Loading .env files**: It loads .env files.
    - **Node.js Version Check**: It checks the Node.js version.
    - **Error Handling**: It configures global error handlers.
    - **Program Building**: It builds the Commander.js program (defined in src/cli/program.ts).
    - **Subcommand Registration**: It registers subcommands and plugins.

4. Development Entry Point
When running locally with npm start or npm run dev, the system uses scripts/run-node.mjs. This script:
    - Checks if the TypeScript files in src/ are newer than the compiled files in dist/.
    - Automatically runs the build (via tsdown) if the build is stale.
    - Spawns the openclaw.mjs wrapper.
------------
how does this works src\cli\program\build-program.ts?

-----------------
The src/cli/program/build-program.ts file is the central factory for the Commander.js command-line interface in openclaw. It orchestrates the setup of the CLI tool by aggregating configurations, help styles, hooks, and command registrations.

Here is the breakdown of the buildProgram() function:

1. Initialization
```
const program = new Command();
const ctx = createProgramContext();
const argv = process.argv;
```
    - It creates a new Command instance (the root of the CLI).
    - It generates a ProgramContext (defined in context.ts), which contains global state like the programVersion and channelOptions (derived from environment configurations).

```
const program = new Command();
```
Program Creation: It initializes a new Commander.program instance.

1. Configuration Loading: It loads configuration from multiple sources in order of precedence:
    - .openclawrc.json (User config)
    - .openclawrc.json in the current working directory
    - .openclawrc.json in the user's home directory
    - Default Configuration: It merges these configurations with a default configuration object.

2. Help Configuration
```
configureProgramHelp(program, ctx);
registerPreActionHooks(program, ctx.programVersion);
```
    - **configureProgramHelp**: Customizes how the help message looks (likely applying branding, colors, or specific formatting for openclaw).
    - **registerPreActionHooks**: Sets up logic that runs before any command executes (e.g., checking for updates, validating the environment, or setting up logging).

3. Plugin Registration
```
const pluginFiles = await fs.readdir(pluginDir);
const pluginImports = await Promise.all(
  pluginFiles
    .filter((file) => file.endsWith(".js"))
    .map((file) => import(pathToFileURL(path.join(pluginDir, file)).href))
);

for (const plugin of pluginImports) {
  if (typeof plugin.register === "function") {
    plugin.register(program, ctx);
  }
}
```
    - Plugin Discovery: It scans the src/cli/plugins directory for plugin modules.
    - Plugin Loading: It dynamically imports each plugin.
    - Plugin Registration: It calls the register function exported by each plugin, passing the program instance and configuration. This allows plugins to add their own commands and options.

4. Command Registration
```
registerProgramCommands(program, ctx, argv);
```
This is where the actual subcommands are added. It iterates through a commandRegistry (found in 
command-registry.ts) and calls a register function for each logical group of commands:
    - **Core Commands**: It registers the main commands for the CLI:
        - Core Commands: setup, onboard, configure.
        - init: Initializes a new project.
        - build: Builds the project.
        - run: Runs the project.
        - package: Packages the project.
        - plugin: Manages plugins.
        - config: Manages configuration.
        - help: Displays help information.
    - **System Commands**: 
        -config, maintenance, status, health.
    - **Feature Commands**: message, memory, agent, browser
    - **Dynamic Commands**: subclis (which handles lazy-loading external or complex sub-CLIs).

5. Command Customization
    - Command Options: It adds common options to all commands (e.g., --profile, --help).
    - Command Descriptions: It sets descriptions for each command.

6. Return Value
    - The function returns the fully configured Commander.program instance, ready to be used by the main CLI entry point.

**Summary**
Think of build-program.ts as the assembly line for the CLI. It doesn't define the logic of what openclaw memory status does, but it defines how that command is attached to the main program, what context it has access to, and ensuring the global CLI "shell" is ready to parse the user's input.

---------------------------
What makes the global CLI "shell" ready to parse the user's input.
-------------
src\cli
program.ts#L1-3
build-program.ts#L1-19
command-registry.ts#L1-189
run-main.ts#L1-132
route.ts#L1-41
register.subclis.ts#L1-311
register.message.ts#L1-69
register.agent.ts#L1-214
argv.ts#L1-170
tui-local-shell.ts#L1-146
completion-cli.ts#L1-596
path-env.ts#L1-121
acp-cli.ts#L1-67
client.ts#L1-192
main.md#L1-122
c:\Users\karch\projects\openclaw\src\terminal
node-shell.ts#L1-10
tui-cli.ts#L1-51
tui.ts#L1-675
context.ts#L1-20

The "global CLI shell" in OpenClaw is prepared to parse user input through a sophisticated multi-layered boot process that prioritizes startup speed and lazy loading.

Here is how the system prepares itself to handle your input:

1. The Entry Point (run-main.ts)
When you run any openclaw command, the execution begins at src/cli/run-main.ts.

Environment Normalization: It first ensures the Node.js environment is consistent (e.g., setting NODE_OPTIONS to disable experimental warnings).

Version Check: It verifies that you are using a compatible Node.js version.

Global Error Handling: It sets up robust error handlers (try/catch blocks, signal handlers) to gracefully manage crashes.

Configuration Loading: It loads the global configuration from .openclawrc.json files (user home directory -> project directory).

2. Building the Command Tree (build-program.ts)
This file acts as the factory for the CLI.

Initialization: It creates a Commander.js program instance.

Help System: It configures the --help output with custom branding and formatting.

Pre-Action Hooks: It registers functions that run before any command executes (e.g., checking for updates).

Command Registration: It calls registerProgramCommands, which dynamically loads and registers all subcommands.

3. Dynamic Command Registration (command-registry.ts)
This is the core of the "shell" preparation. Instead of hard-coding every command, it uses a registry pattern.

Command Groups: Commands are grouped logically (Core, System, Feature, SubCLIs).

Lazy Loading (SubCLIs): The most complex part of the shell is handled by register.subclis.ts. It scans the src/cli/subclis directory for plugins (e.g., register.agent.ts, register.message.ts).

Plugin Registration: Each plugin registers its own specific commands with the main program.

4. The Shell Itself (route.ts & tui-local-shell.ts)
Once the program tree is built, the shell needs to decide what to do with your input.

Routing (route.ts): This function inspects the parsed arguments. It checks if the command is a known core command (like init, build) or a "sub-CLI" (like agent, message).

Local Shell (tui-local-shell.ts): If the command is identified as a sub-CLI (e.g., openclaw agent list), this function takes over. It spawns a new Node.js process to run the specific plugin logic (e.g., agent.ts).

Parsing: The Commander.js instance (built in step 2) handles the initial parsing of your input string (e.g., "openclaw agent list --verbose") into structured arguments.

In Summary:
    1. User Input: You type openclaw agent list.
    2. Parsing: Commander.js parses this into a command object.
    3. Routing: route.ts identifies "agent" as a sub-CLI.
    4. Execution: A new process is spawned to run the agent plugin, which then executes the list command.

This "shell" is "ready" because the entire command tree is built and configured before your command even starts executing, ensuring that when you type a command, the system knows exactly which plugin to load and run.
--------------------
The "global CLI shell" in OpenClaw is prepared to parse user input through a sophisticated multi-layered boot process that prioritizes startup speed and lazy loading.

Here is how the system prepares itself to handle your input:

1. PATH Integration (ensureOpenClawCliOnPath)
    Before any parsing happens, the CLI ensures it is "globally" available. The entry point calls ensureOpenClawCliOnPath (in src/infra/path-env.ts), which dynamically identifies the best binary locations (like .local/bin, pnpm, or bundled app directories) and prepends them to the environment PATH. This is what makes the openclaw command "ready" to be called from any directory.
2. Fast-Path Routing (tryRouteCli)
    To avoid the overhead of loading hundreds of command modules, OpenClaw uses a "fast-path" router in src/cli/route.ts.
        - When you run a command like openclaw status or openclaw health, the system checks a lightweight commandRegistry before initializing the full Commander.js tree.
        - If a match is found, it executes the command immediately, bypassing the expensive step of building the entire CLI grammar.
        - If no match is found, it falls back to the full Commander.js tree.
3. Lazy Subcommand Registration
    If the command isn't a "fast-route" item, the system moves to src/cli/program/register.subclis.ts. Instead of registering full command logic, it registers Lazy Placeholders:
        - **Placeholders**: Every major subcommand group (like gateway, models, or browser) is initially registered as a "dumb" placeholder that accepts any arguments.
        - **On-Demand Loading**: Only when you actually type openclaw gateway ... does the placeholder action trigger. It then dynamically import()s the real CLI module, replaces itself with the real commands, and re-parses the input.
        - **Benefit**: This keeps the primary openclaw binary feeling instant even as the project grows to hundreds of commands.
4. Argument Normalization (argv.ts)
    Windows and different package managers (npm, pnpm, bun) pass arguments differently. OpenClaw uses a normalization layer in src/cli/argv.ts and run-main.ts (stripWindowsNodeExec) to clean up process.argv:
        - **stripWindowsNodeExec**: It strips out the Node.js executable path if present.
        - **shell-specific quirks**: It handles shell-specific quirks (like control characters on Windows).
        - **Commander.js**: It ensures that Commander.js always sees a consistent array of strings.
        - **Benefit**: This ensures that the CLI always receives a clean, normalized set of arguments, regardless of the environment.   
5. External Shell Readiness (completion)
    For your terminal shell (Zsh, Bash, Fish, or PowerShell) to be "ready" to parse OpenClaw input (tab-completion, flag hints), the openclaw completion command (in src/cli/completion-cli.ts) generates native scripts:
        - It uses compdef for Zsh and complete.ts for Bash.
        - These scripts teach your shell the entire grammar of OpenClaw so the shell itself can parse your input before you even press Enter.
        - **Benefit**: This allows your shell to provide tab-completion and flag hints even before the command is executed.
6. Interactive Prompt Handling
    If you are using an interactive mode:
        - The system calls tui-local-shell.ts to spawn a new Node.js process to run the specific plugin logic (e.g., agent.ts).
        - The TUI (Text User Interface) handles the interactive prompt and input parsing.
        - *TUI*: In src/tui/tui.ts, the createEditorSubmitHandler function watches for specific prefixes. For example, if a line starts with !, it bypasses the agent and routes the input to a local shell runner (src/tui/tui-local-shell.ts) to execute commands on your machine.
        - **Benefit**: This allows your shell to provide tab-completion and flag hints even before the command is executed.

Summary of the Flow:

1. Entry: openclaw.mjs → src/entry.ts → src/cli/run-main.ts
2. Bootstrap: Ensure PATH is set.
3. Route: Check for "Fast Path" commands.
4. Build: Create Commander program with Lazy Slugs.
5. Parse: Execute program.parseAsync. If a lazy slug is hit, load the real module and parse again.