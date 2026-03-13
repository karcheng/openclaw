In detail, here is how the Clawdbot Memory System is implemented, along with the program flow for its major features.

c:\Users\karch\projects\openclaw\src\memory
memory-schema.ts#L1-97
anager.ts#L1-800
sync-memory-files.ts#L1-103
sync-session-files.ts#L1-132

## Memory Storage: SQLite & Extensions
The system uses a per-agent SQLite database located at ~/.openclaw/memory/<agentId>.sqlite. This allows for isolated, fast, and local memory for **every agent**.

Database Schema (src/memory/memory-schema.ts)

The schema is designed for hybrid retrieval (semantic + keyword):

- meta: Stores the index version, embedding model, provider key, and chunking settings. If you change models, the system compares this meta to the current config and triggers an automatic Full Re-index.
- files: Tracks metadata for source files (path, hash, mtime). This is the foundation of the "Sync-on-Change" logic.
- chunks: Stores the actual text snippets, their line ranges, and the embedding vector (as a string).
- embedding_cache: A critical table that stores computed embeddings indexed by the text's SHA-256 hash. This ensures that if you re-index or move files, you don't pay for the same embeddings twice.
- chunks_vec (Virtual Table): Uses the sqlite-vec extension. It enables native vector similarity (cosine distance) queries directly within SQL, which is much faster than loading all vectors into Javascript memory.
- chunks_fts (Virtual Table): Uses the fts5 (Full-Text Search) extension for high-performance keyword matching using the BM25 ranking algorithm.


## Program Flow: Data Extraction & Conversion 

The system "syncs" data from disk to the database whenever a change is detected or a search is initiated.

### Discovery & Change Detection
1. **Scanning**: The MemoryIndexManager scans the memory/ folder and MEMORY.md in your workspace.
2. **Hashing**: Every file is hashed (SHA-256).
3. **Comparison**: If the file's current hash matches the hash in the files table, the system skips it. Only new or modified files are processed.

### Parsing & Data Extraction
- Markdown Files: Large .md files are broken into "chunks" using a sliding window. It targets ~400 tokens per chunk with an 80-token overlap to ensure context isn't lost at the edges of a chunk.
- Session Transcripts ( src/memory/session-files.ts):
    - It reads .jsonl session logs.
    - It extracts only user and assistant messages, ignoring system-level metadata or tool outputs that might bloat the index.
    - Whitespace is normalized/trimmed to optimize for the embedding model's token limit.

## Program Flow: Memory Retrieval (Search)
When a search is triggered, the system performs a Hybrid Search to find the most relevant context.

### 1. Explicit Recall (`memory_search` tool)
The primary trigger is the **`memory_search`** tool. The agent is instructed via its system prompt to use this tool as a "mandatory recall step" before answering questions about prior work, decisions, or preferences.
- **On-Demand Sync**: When the tool is invoked, the system checks if the index is "dirty" (files changed). If `sync.onSearch` is enabled, it triggers a background sync immediately to ensure results are up-to-date.

### 2. "Warm Up" on Session Start
The "warm up" refers to the system preparing the memory index as soon as an agent session begins.
- **Initial Sync**: Inside `manager.ts`, the `warmSession` method is called. If `sync.onSessionStart` is true, it triggers a background sync with the reason `session-start`.
- **Purpose**: This ensures that any new notes or session transcripts from *previous* conversations are indexed and ready for retrieval before the user even asks their first question.
- **Efficiency**: It uses a `sessionWarm` cache to ensure this heavy sync only happens once per session lifecycle.

### 3. Execution Flow
1. **Vector Search**: The search query is converted into a vector (embedding). The system then queries the `chunks_vec` table using `vec_distance_cosine`.
2. **Keyword Search (FTS)**: Simultaneously, the query is passed to the `fts5` engine to find exact matches for names, IDs, or specific code symbols that vector models often miss.
3. **Merging (Hybrid Logic)**: The `mergeHybridResults` function combines both signals. It uses a weighted formula (default: 70% vector, 30% keyword) to produce a final relevance score.
4. **Citations**: The system returns the snippet text along with the file path and line number, allowing the agent to "cite" its source.


## Memory File Types & Daily Memory
The system recognizes two primary types of daily/long-term storage:

**Daily Log** (memory/YYYY-MM-DD.md):
- Purpose: Append-only storage for day-to-day notes, running context, and transient observations.
- Behavior: The system usually reads "today" and "yesterday" files at the start of a session to give the agent immediate context of recent work.

**Long-Term Memory** (MEMORY.md):
    - Purpose: Curated, durable facts, preferences, and permanent decisions.
    - Behavior: This file is treated as the "Gold Standard" of agent knowledge. It is indexed more aggressively and preferred in long-term retrieval.

**Auto-Flush**: When a session nears the context window limit (compaction), OpenClaw triggers a silent turn prompting the model to summarize important facts into these files before they are pruned from the active context.

## Summary Table
|Feature|Implementation|Key Files|
|---|---|---|
|Search Engine|SQLite + sqlite-vec + fts5|memory-schema.ts, manager-search.ts|
|Change Detection|SHA-256 Content Hashing|manager.ts, internal.ts|
|Parsing|Sliding window Markdown chunking|internal.ts|
|Session Memory|Extraction of User/Assistant turns|se   sssion-files.ts, sync-session-files.ts|
|Cost Saving|Local SQLite Embedding Cache|memory-schema.ts||


-----------
User:
In the "Program Flow: Memory Retrieval (Search)" sestion, you mentioned  that a search is triggered via memory_search or a "warm up" on session start. please elaborate on that please
-----------
manager.ts#L240-260
memory-tool.ts#L1-219
attempt.ts#L1-800
session-manager-cache.ts#L1-70
index.ts#L1-8
search-manager.ts#L1-213
memory-search.ts#L1-301
memory.md

I have elaborated on how memory retrieval is triggered in the updated 
MyDocs/memory.md document. Here is a more detailed breakdown:


## Explicit Recall via memory_search

The memory_search tool is the main entry point for retrieval. The agent's system prompt specifies it as a "mandatory recall step."

- **Sync on Search**: When the agent calls this tool, the system checks if any memory files have changed on disk since the last search. If the sync.onSearch setting is enabled (which it is by default), a background sync is triggered immediately. This ensures that the agent never searches stale data.

## Warm-Up on Session Start

Before the agent even processes the first user message, the system ensures its memory is up-to-date.

- **Trigger**: Inside `manager.ts`, the `warmSession` method is called at the start of every session.
- **Behavior**: If `sync.onSessionStart` is true (the default), it triggers a background sync with the reason `session-start`.
- **Purpose**: This ensures that any notes, logs, or memory files created during previous sessions (or manually by the user) are indexed and ready for retrieval before the agent begins its work. It prevents the "I don't remember what we did yesterday" problem.

## Execution Flow

1. **Vector Search**: The search query is converted into a vector (embedding). The system then queries the `chunks_vec` table using `vec_distance_cosine`.
2. **Keyword Search (FTS)**: Simultaneously, the query is passed to the `fts5` engine to find exact matches for names, IDs, or specific code symbols that vector models often miss.
3. **Merging (Hybrid Logic)**: The `mergeHybridResults` function combines both signals. It uses a weighted formula (default: 70% vector, 30% keyword) to produce a final relevance score.
4. **Citations**: The system returns the snippet text along with the file path and line number, allowing the agent to "cite" its source.

The "warm up" is a proactive measure to ensure the agent is ready for retrieval the moment you start talking to it.
    - **Initial Sync**: When a session attempt begins, MemoryIndexManager calls its 
warmSession method. If settings.sync.onSessionStart is true, it kicks off a sync with the internal reason session-start.
    - **Loading Previous History**: This is particularly important for conversation history. Since session transcripts are stored as .jsonl files on disk, the "warm up" ensures that the final messages from your last conversation are indexed and searchable in the current one.
    - **Cache Protection**: To save on API costs and performance, the system uses a sessionWarm cache. This ensures the heavy lifting of a "session-start" sync only happens once, even if the session is re-loaded multiple times.

## Execution Flow Summary
Once triggered by either of the above, the retrieval follows this flow:

    - **Vector Query**: The search string is embedded and compared against the chunks_vec table (powered by sqlite-vec).
    - **Keyword Query**: An exact text search is run against the chunks_fts table (powered by fts5).
    - **Score Merging**: A hybrid algorithm combines both signals (70% Vector / 30% Keyword by default) to rank the snippets.
    - **Source Attribution**: The results are returned with precise file paths and line numbers (e.g., memory/notes.md#L10-L15), enabling the agent to cite exactly where it found the information.