---
allowed-tools: Bash(curl), Bash(python3), Bash(cat), Bash(ls), Bash(echo)
description: Send a prompt to the internal LARA assistant endpoint using the configured API key and assistant ID.
---

## Context

- Current working directory: !`pwd`
- Config file status: !`ls -la .claude/internal-llm.local.md`

## Usage

Call this command with a single argument containing the user prompt to forward to the internal LLM. Example:

```
/internal-llm:chat "Summarize today's deployment status."
```

## Steps

1. Verify that `.claude/internal-llm.local.md` exists in the project root. Abort with a clear message if it is missing.
2. Parse YAML frontmatter from `.claude/internal-llm.local.md` to read `api_key`, `assistant_id`, `api_base`, `path`, and `stream` (defaulting to `https://api.lara.tdsynnex.com`, `/v1/chat/assistant`, and `false`). Treat `assistant_id` as required if not present in the config.
3. Build a JSON payload with:
   - `assistant_id`
   - `input`: a single user message containing the provided prompt as plain text
   - `stream`: boolean toggle derived from the config
4. POST the payload to `${api_base}${path}` with headers `Content-Type: application/json` and `x-api-key: <api_key>`.
5. If `stream` is true, use `curl -N` so chunks flush as they arrive; otherwise default to a single JSON response. Surface HTTP errors directly in the terminal.
6. Echo a short summary after the call with the target URL and whether streaming was enabled.

## Reference implementation (bash)

```bash
PROMPT="$1"
CONFIG_FILE=".claude/internal-llm.local.md"
if [[ -z "$PROMPT" ]]; then
  echo "Usage: /internal-llm:chat \"<prompt text>\"" >&2
  exit 1
fi
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing $CONFIG_FILE. Create it with api_key and assistant_id before calling this command." >&2
  exit 1
fi

readarray -t FRONTMATTER < <(python3 - "$CONFIG_FILE" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
text = path.read_text().splitlines()
if not text or text[0].strip() != '---':
    sys.exit()
lines = []
for line in text[1:]:
    if line.strip() == '---':
        break
    lines.append(line)
print('\n'.join(lines))
PY
)

declare -A CFG
default_base="https://api.lara.tdsynnex.com"
default_path="/v1/chat/assistant"
default_assistant="1763731165628-79d9d4d0-e36d-46e6-964f-00fcfec9f6fe"
for line in "${FRONTMATTER[@]}"; do
  key="${line%%:*}"
  value="${line#*:}"
  key="${key// /}"
  value="${value## }"
  [[ -n "$key" ]] && CFG[$key]="$value"
done
API_KEY="${CFG[api_key]}"
ASSISTANT_ID="${CFG[assistant_id]:-$default_assistant}"
API_BASE="${CFG[api_base]:-$default_base}"
API_PATH="${CFG[path]:-$default_path}"
STREAM_RAW="${CFG[stream]:-false}"
STREAM_FLAG=$(echo "$STREAM_RAW" | tr 'A-Z' 'a-z')
[[ "$STREAM_FLAG" == "true" ]] && STREAM=true || STREAM=false
if [[ -z "$API_KEY" ]]; then
  echo "api_key is required in $CONFIG_FILE" >&2
  exit 1
fi
if [[ -z "$ASSISTANT_ID" ]]; then
  echo "assistant_id is required (set in config or use default)." >&2
  exit 1
fi

export PROMPT ASSISTANT_ID STREAM

PAYLOAD=$(python3 - <<'PY'
import json, os, sys
prompt = os.environ.get("PROMPT", "")
assistant = os.environ.get("ASSISTANT_ID", "")
stream = os.environ.get("STREAM", "false").lower() == "true"
payload = {
    "assistant_id": assistant,
    "input": [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": prompt
                }
            ]
        }
    ],
    "stream": stream
}
print(json.dumps(payload))
PY
)

set -o pipefail
URL="${API_BASE}${API_PATH}"
CURL_OPTS=("-sS" "-H" "Content-Type: application/json" "-H" "x-api-key: ${API_KEY}" "-X" "POST" "$URL" -d "$PAYLOAD")
if [[ "$STREAM" == "true" ]]; then
  curl -N "${CURL_OPTS[@]}"
else
  curl "${CURL_OPTS[@]}"
fi
STATUS=$?
if [[ $STATUS -ne 0 ]]; then
  echo "\nRequest failed (exit $STATUS)" >&2
  exit $STATUS
fi
echo "\n[internal-llm] POST $URL (stream=$STREAM)"
```
