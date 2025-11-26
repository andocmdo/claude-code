# Internal LLM Plugin

This plugin connects Claude Code to the internal LARA assistant endpoint at `https://api.lara.tdsynnex.com/v1/chat/assistant`.
It provides a reusable chat command and agent wrapper so you can route prompts through the internal API while keeping credentials in a local config file.

## Configuration

Create a local settings file with your API key (and optional overrides) so credentials stay out of version control:

```bash
mkdir -p .claude
cat > .claude/internal-llm.local.md <<'SETTINGS'
---
api_key: YOUR_API_KEY
assistant_id: 1763731165628-79d9d4d0-e36d-46e6-964f-00fcfec9f6fe
api_base: https://api.lara.tdsynnex.com
path: /v1/chat/assistant
stream: false
---
# Optional additional context or system prompt additions
SETTINGS
```

- `api_key` (**required**): Value for the `x-api-key` header.
- `assistant_id`: Defaults to the provided assistant ID; override if you need a different one.
- `api_base` and `path`: Customize if the service URL changes.
- `stream`: If `true`, the command will request a streaming response. The command surfaces streamed chunks directly to the terminal.

> The `.claude/*.local.md` pattern is git-ignored in this repo so secrets remain local.

## Usage

Invoke the chat command to send a prompt through the internal API:

```
/internal-llm:chat "What is the status of project X?"
```

The command:
1. Reads `.claude/internal-llm.local.md` for credentials and endpoint details.
2. Builds the request payload with your prompt as the user message and the configured `assistant_id`.
3. Uses `curl` to call the API with the `x-api-key` header.
4. Streams responses when `stream: true`.

You can also rely on the `internal-llm` agent to route general instructions through the internal LLM; it ensures the same config is loaded before issuing requests.

## Files
- `.claude-plugin/plugin.json`: Plugin metadata.
- `commands/internal-llm-chat.md`: Slash command for sending prompts to the internal API.
- `agents/internal-llm.md`: Agent definition that wraps the same call path.
