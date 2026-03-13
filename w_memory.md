# Clawdbot Memory Execution Flow

This document explains how memory is handled in **Clawdbot**, including storage locations, data structures, and the logic for determining what gets indexed.

## 1. Where Memory is Stored

Clawdbot utilizes a local **SQLite** database for lightning-fast search and persistent memory.

- **Main Database**: By default, it is stored at a path defined in the agent's configuration (usually within the agent's state directory).
- **Extensions**:
  - **`sqlite-vec`**: Used for storing and searching vector embeddings.
  - **`fts5`**: Used for high-performance full-text (keyword) search.
- **Temporary Files**: During a full re-index, a temporary `.tmp` database is created to ensure atomic swaps and no data loss on failure.

### Database Tables
| Table | Purpose |
| :--- | :--- |
| `meta` | Stores versioning, model info, and chunking settings. |
| `files` | Tracks metadata (hash, size, mtime) of source files. |
| `chunks` | Stores the actual text snippets with line numbers. |
| `chunks_vec` | A virtual table (`vec0`) for vector similarity search. |
| `chunks_fts` | A virtual table (`fts5`) for keyword search. |
| `embedding_cache` | Caches computed embeddings to save API costs. |

---

## 2. What is Stored

Clawdbot stores a layered representation of two primary sources:

### A. Memory Files (`memory/` source)
- Files specifically designated for long-term memory.
- Locations: `MEMORY.md` at the root or any `.md` files inside a `memory/` folder in the workspace.
- **Format**: Raw markdown content.

### B. Session Transcripts (`sessions/` source)
- Historical context from your conversations.
- **Processing**: It extracts only `user` and `assistant` messages, labeling them accordingly.
- **Normalization**: Bloated whitespace is trimmed to optimize token usage in embeddings.

---

## 3. How Storage is Determined (Indexing Logic)

The storage logic follows a "Sync-on-Change" philosophy driven by the `MemoryIndexManager`.

### Change Detection
Clawdbot uses **Content Hashing (SHA-256)**:
- Before indexing, it hashes the file content.
- If the hash in the DB matches the current file, indexing is skipped.
- If a model or provider changes (e.g., switching from OpenAI to Gemini), a **Full Re-index** is automatically triggered.

### The Sync Cycle
1. **Discovery**: Scans the workspace for memory files and session transcript files (`.jsonl`).
2. **Chunking**: Large files are broken down into smaller pieces using a sliding window:
   - **Token Limit**: Guided by `chunking.tokens` config.
   - **Overlap**: Retains context between segments using `chunking.overlap`.
3. **Embedding**: Each chunk is converted into a vector via an embedding provider (OpenAI, Gemini, or Local).
4. **Persistence**: The text, vector, and metadata are written to the SQLite database.

### Trigger Mechanisms
- **Watchers**: A file watcher monitors `MEMORY.md` and the `memory/` folder for real-time updates.
- **Session Listeners**: Triggers an index update when session transcripts grow beyond a configurable "dirty" threshold (e.g., after X new messages or Y bytes).
- **Proactive Sync**: Syncs can also be triggered automatically before a search if the manager detects "dirty" (changed) state.

---

## 4. Search Flow (Retrieval)

When you ask a question, Clawdbot performs a **Hybrid Search**:

1. **Vector Search**: Finds semantically similar chunks based on "meaning" even if words don't match exactly.
2. **Keyword Search (FTS)**: Finds exact matches for specific terms or names.
3. **Hybrid Merging**: Combines results from both methods, weighting them (default: vector-heavy) to produce the most relevant snippets for the AI's context.
