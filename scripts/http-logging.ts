import { appendFileSync, existsSync, readFileSync } from "fs";
import path from "path";

declare global {
  // Minimal process typing for Bun/TS without Node types
  var process: {
    env: Record<string, string | undefined>;
    argv: string[];
    cwd: () => string;
  };
}

const REQUEST_LOG_PATH = "/tmp/cc-http-requests.log";
const RESPONSE_LOG_PATH = "/tmp/cc-http-responses.log";
const DEFAULT_CONFIG_NAME = "claude-code.config.json";

export function resolveHttpLoggingEnabled(
  argv: string[],
  defaultConfigName: string = DEFAULT_CONFIG_NAME
): boolean {
  const args = argv.slice(2);
  let logHttp = false;
  let configPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--log-http") {
      logHttp = true;
    } else if (arg === "--config" && i + 1 < args.length) {
      configPath = args[i + 1];
      i++;
    }
  }

  if (logHttp) return true;

  const resolvedConfigPath = path.resolve(
    configPath ?? path.join(process.cwd(), defaultConfigName)
  );
  return readLogHttpFromConfig(resolvedConfigPath);
}

function readLogHttpFromConfig(configPath: string): boolean {
  if (!existsSync(configPath)) return false;

  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf-8"));
    return parsed.logHttp === true;
  } catch (error) {
    console.warn(
      `[WARN] Failed to read HTTP logging config at ${configPath}: ${error}`
    );
    return false;
  }
}

export function createFetchWithLogging(
  enabled: boolean,
  fetchImpl: typeof fetch = fetch
): typeof fetch {
  if (!enabled) return fetchImpl;

  return async function (input: RequestInfo, init?: RequestInit): Promise<Response> {
    const url = normalizeUrl(input);
    logRequest(url, init);

    const response = await fetchImpl(input as any, init as any);
    await logResponse(url, response);

    return response;
  };
}

let globalFetchPatched = false;

/**
 * Replace the global fetch with a logging wrapper so that any HTTP call made
 * by the process (including Anthropic API calls) is captured without the
 * caller needing to remember to wrap their own fetch.
 */
export function installGlobalHttpLogging(
  enabled: boolean,
  fetchImpl: typeof fetch = fetch
): typeof fetch {
  if (!enabled) return fetchImpl;
  if (globalFetchPatched) return fetch;

  const wrapped = createFetchWithLogging(true, fetchImpl);
  (globalThis as any).fetch = wrapped;
  globalFetchPatched = true;
  return wrapped;
}

function normalizeUrl(input: RequestInfo): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  try {
    const possibleRequest = input as any;
    if (possibleRequest && possibleRequest.url) {
      return String(possibleRequest.url);
    }
  } catch {}
  return String(input);
}

function headersToObject(headersInit: HeadersInit | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!headersInit) return headers;

  const headerEntries = new Headers(headersInit);
  headerEntries.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

function serializeBody(body: any): string {
  if (body === undefined || body === null) {
    return "(empty)";
  }

  if (typeof body === "string") return body;

  if (typeof body === "object") {
    try {
      return JSON.stringify(body);
    } catch {}
  }

  try {
    if (body instanceof Uint8Array) {
      return new TextDecoder().decode(body);
    }
  } catch {}

  return String(body);
}

function logRequest(url: string, init?: RequestInit) {
  const entry = [
    `timestamp=${new Date().toISOString()}`,
    `method=${init?.method ?? "GET"}`,
    `url=${url}`,
    `headers=${JSON.stringify(headersToObject(init?.headers), null, 2)}`,
    `body=${serializeBody((init as any)?.body)}`,
    "",
  ].join("\n");

  appendFileSync(REQUEST_LOG_PATH, `${entry}\n`);
}

async function logResponse(url: string, response: Response) {
  const headers = headersToObject(response.headers as any);
  let bodyText = "";

  try {
    bodyText = await response.clone().text();
  } catch (error) {
    bodyText = `[unavailable: ${error}]`;
  }

  const entry = [
    `timestamp=${new Date().toISOString()}`,
    `url=${url}`,
    `status=${response.status} ${response.statusText}`,
    `headers=${JSON.stringify(headers, null, 2)}`,
    `body=${bodyText}`,
    "",
  ].join("\n");

  appendFileSync(RESPONSE_LOG_PATH, `${entry}\n`);
}

export const requestLogPath = REQUEST_LOG_PATH;
export const responseLogPath = RESPONSE_LOG_PATH;
export const defaultConfigName = DEFAULT_CONFIG_NAME;
