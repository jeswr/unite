// Opt-in bridge to the host's installed Claude Code CLI. It is off unless the
// server is launched with UNITE_AI=claude-cli. The command, flags, model and
// system prompt are fixed here; participant text only ever reaches the
// subprocess on stdin. No shell is involved, tools and MCP are disabled,
// customisations are skipped (--safe-mode keeps the existing login), and the
// session is not persisted. Raw stderr is discarded, never returned or logged.

import { spawn } from 'node:child_process';
import { accessSync, constants, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';

export const AI_MODEL = 'claude-opus-5-5';
export const MAX_STDOUT_BYTES = 256 * 1024;
export const MAX_RESULT_CHARS = 6000;
export const MAX_BUDGET_USD = '0.50';

export class AiError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function cliArgs(systemPrompt) {
  return [
    '--print',
    '--safe-mode',
    '--tools', '',
    '--strict-mcp-config',
    '--no-session-persistence',
    '--disable-slash-commands',
    '--model', AI_MODEL,
    '--max-budget-usd', MAX_BUDGET_USD,
    '--output-format', 'json',
    '--system-prompt', systemPrompt,
  ];
}

// Reads the CLI's `--output-format json` result and insists that every model
// it reports using is exactly the requested one. No fallback model.
export function parseCliResult(stdout) {
  let data;
  try {
    data = JSON.parse(stdout);
  } catch {
    throw new AiError('unreadable', 'The AI returned output this server could not read.');
  }
  if (Array.isArray(data)) data = data.findLast((item) => item && item.type === 'result');
  if (!data || typeof data !== 'object' || data.type !== 'result') {
    throw new AiError('unreadable', 'The AI returned output this server could not read.');
  }
  if (data.is_error || data.subtype !== 'success') {
    throw new AiError('failed', 'The AI request did not complete. Nothing was substituted.');
  }
  const models = data.modelUsage && typeof data.modelUsage === 'object' ? Object.keys(data.modelUsage) : [];
  if (models.length === 0) {
    throw new AiError('model-unverified', `The AI response did not report which model answered, so it was discarded (expected ${AI_MODEL}).`);
  }
  const unexpected = models.filter((model) => model !== AI_MODEL);
  if (unexpected.length) {
    throw new AiError('unexpected-model', `The AI response reported model ${unexpected.join(', ').slice(0, 80)} instead of ${AI_MODEL}, so it was discarded.`);
  }
  if (typeof data.result !== 'string' || data.result.trim() === '') {
    throw new AiError('empty', 'The AI returned an empty answer. Nothing was substituted.');
  }
  const text = data.result.trim();
  if (text.length > MAX_RESULT_CHARS) {
    throw new AiError('too-long', 'The AI answer was longer than this server accepts, so it was discarded.');
  }
  return { text, model: AI_MODEL };
}

// Runs a fixed command with an argument array (never a shell), writes `input`
// to stdin and collects bounded stdout. Resolves with what happened rather
// than throwing, so the bridge can map each outcome to a truthful message.
export function spawnRunner(command, args, { input, cwd, env, timeoutMs, maxBytes, signal }) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command, args, { cwd, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      resolve({ outcome: 'spawn-failed' });
      return;
    }
    const chunks = [];
    let bytes = 0;
    let outcome = null;
    let killTimer = null;
    const stop = (reason) => {
      if (outcome) return;
      outcome = reason;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 2000);
      killTimer.unref();
    };
    const timer = setTimeout(() => stop('timeout'), timeoutMs);
    const onAbort = () => stop('aborted');
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) stop('overflow');
      else chunks.push(chunk);
    });
    child.stderr.resume(); // drained and discarded
    child.stdin.on('error', () => {});
    child.on('error', () => {
      if (!outcome) outcome = 'spawn-failed';
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener('abort', onAbort);
      resolve({ outcome: outcome ?? (code === 0 ? 'ok' : 'exit'), code, stdout: Buffer.concat(chunks).toString('utf8') });
    });
    child.stdin.end(input);
  });
}

export function findExecutable(name, pathEnv = process.env.PATH ?? '') {
  const candidates = isAbsolute(name) ? [name] : pathEnv.split(delimiter).filter(Boolean).map((dir) => join(dir, name));
  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // keep looking
    }
  }
  return null;
}

export class ClaudeBridge {
  constructor({
    enabled = false,
    command = null,
    runner = spawnRunner,
    timeoutMs = 120_000,
    maxConcurrent = 2,
    cwd = null,
    env = null,
  } = {}) {
    this.runner = runner;
    this.timeoutMs = timeoutMs;
    this.maxConcurrent = maxConcurrent;
    this.active = 0;
    this.enabled = false;
    if (!enabled) {
      this.reason = 'AI conversation is switched off on this server. It only runs when the server is started with UNITE_AI=claude-cli.';
      return;
    }
    if (!command) {
      this.reason = 'AI conversation was requested, but the Claude Code CLI was not found on this computer.';
      return;
    }
    this.command = command;
    this.cwd = cwd ?? mkdtempSync(join(tmpdir(), 'unite-ai-'));
    this.env = env ?? childEnv(process.env);
    this.enabled = true;
    this.reason = null;
  }

  status() {
    return { enabled: this.enabled, model: AI_MODEL, reason: this.reason, busy: this.active >= this.maxConcurrent };
  }

  async complete({ system, prompt, signal }) {
    if (!this.enabled) throw new AiError('disabled', this.reason, 503);
    if (this.active >= this.maxConcurrent) {
      throw new AiError('busy', 'The AI is busy with other requests on this server. Try again in a moment.', 429);
    }
    this.active += 1;
    try {
      const run = await this.runner(this.command, cliArgs(system), {
        input: prompt,
        cwd: this.cwd,
        env: this.env,
        timeoutMs: this.timeoutMs,
        maxBytes: MAX_STDOUT_BYTES,
        signal,
      });
      switch (run.outcome) {
        case 'ok':
          return parseCliResult(run.stdout);
        case 'timeout':
          throw new AiError('timeout', `The AI did not answer within ${Math.round(this.timeoutMs / 1000)} seconds, so the request was stopped.`, 504);
        case 'aborted':
          throw new AiError('cancelled', 'The request was cancelled.', 499);
        case 'overflow':
          throw new AiError('too-long', 'The AI produced more output than this server accepts, so it was stopped.');
        case 'spawn-failed':
          throw new AiError('unavailable', 'The Claude Code CLI could not be started on this computer.', 503);
        default:
          throw new AiError('failed', 'The AI request failed. It may be signed out, out of credits or offline. Nothing was substituted.');
      }
    } finally {
      this.active -= 1;
    }
  }
}

// The child inherits the environment so the CLI can find its existing login,
// minus variables that would make it think it is nested inside another
// Claude Code session.
export function childEnv(env) {
  const copy = { ...env };
  for (const key of Object.keys(copy)) {
    if (key === 'CLAUDECODE' || key.startsWith('CLAUDE_CODE_ENTRYPOINT')) delete copy[key];
  }
  return copy;
}
