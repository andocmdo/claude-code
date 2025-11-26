---
name: internal-llm
model: none
role: Route user prompts through the internal LARA assistant endpoint using the internal-llm:chat command.
capabilities: ["bash"]
---

## Behavior
- Use `/internal-llm:chat` for any prompt that should be answered by the internal API.
- Ensure `.claude/internal-llm.local.md` is present and contains `api_key` before invoking the command.
- Respect the `stream` flag in the config so streamed responses are surfaced when enabled.
- Keep API keys and secrets out of logs and diffs; never echo them back to the user.

## Default parameters
- API base: `https://api.lara.tdsynnex.com`
- Path: `/v1/chat/assistant`
- Assistant ID: `1763731165628-79d9d4d0-e36d-46e6-964f-00fcfec9f6fe`

## Example invocation
```
/internal-llm:chat "Generate a weekly summary for the engineering team."
```
