# MCP Configuration — SpecVault

## Current Setup

MCP (Model Context Protocol) servers extend Claude Code with tools for file access and GitHub integration. Configuration: `.mcp/config.json`.

### Active Servers

| Server | Package | Purpose |
|--------|---------|---------|
| filesystem | `@anthropic/mcp-server-filesystem` | Read/write project files |
| github | `@anthropic/mcp-server-github` | PR and issue management |

### Configuration

`.mcp/config.json`:
```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "."]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

---

## Recommended Additions

### context7 (Library Documentation)

Up-to-date docs for Next.js, React, Supabase, and other dependencies.

```json
"context7": {
  "command": "npx",
  "args": ["-y", "@context7/mcp-server"]
}
```

### Supabase MCP Server (Direct DB Access)

Query documents table, inspect vector search results, debug indexed chunks directly from Claude Code.

```json
"supabase": {
  "command": "npx",
  "args": ["-y", "@supabase/mcp-server"],
  "env": {
    "SUPABASE_URL": "${NEXT_PUBLIC_SUPABASE_URL}",
    "SUPABASE_SERVICE_ROLE_KEY": "${SUPABASE_SERVICE_ROLE_KEY}"
  }
}
```

**Note**: Requires a service role key (not the anon key). Only add for development debugging.

---

## Architecture Note

The RAG pipeline runs entirely through Next.js API routes — not through MCP servers. MCP is used for development tooling (file access, GitHub), not for the production pipeline.

The agentic pipeline architecture is documented in [AGENTS.md](AGENTS.md).

---

## Setup

1. Set `GITHUB_TOKEN` in your environment (for PR/issue tools)
2. Run `claude` in the project root — MCP servers start automatically
3. Edit `.mcp/config.json` to add/remove servers, then restart Claude Code
