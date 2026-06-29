#!/usr/bin/env node
import { appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

// delegate.mjs - offload tasks to a secondary model pool to save main model quota.
//
// OPENCODE MODE (Antigravity, recommended):
//   DELEGATE_RUNNER=opencode
//   GCLI_MODELS_CODE=google/antigravity-claude-opus-4-6-thinking:max,google/antigravity-gemini-3.5-flash:high
//   GCLI_MODELS_LOOKUP=google/antigravity-gemini-3.5-flash:high
//
//   node scripts/delegate.mjs --type=code  "implement parseConfig in src/config.ts"
//   node scripts/delegate.mjs --type=lookup "list every export in src/foo.ts"
//   node scripts/delegate.mjs              "..." (defaults to --type=code)
//   big-cmd | node scripts/delegate.mjs --type=lookup --stdin "summarize the errors"
//
//   Model spec format: "model:variant" or plain "model" (falls back to GCLI_VARIANT).
//   --type=code:   tries GCLI_MODELS_CODE left-to-right; falls back on quota exhaustion.
//   --type=lookup: uses GCLI_MODELS_LOOKUP directly (no Opus, straight to Flash).
//
// HTTP MODE (OpenAI-compatible proxy, legacy — when DELEGATE_RUNNER is unset):
//   GCLI_API_KEY=key_aaa:3,key_bbb:1
//   GCLI_BASE_URL=https://your-proxy/v1
//   GCLI_MODEL=gemini-3.1-pro
//
// Logging: all levels (INFO/WARN/DEBUG) written to logs/delegate-{agent}.log inside CWD.
//   DELEGATE_AGENT=claude|codex|opencode  override auto-detect (set in shell profile)
//   DELEGATE_DEBUG=1                      enable verbose DEBUG lines on stderr + log
//   DELEGATE_LOG_FILE=/custom/path.log    override default log path
//
// Self-test (no network): node scripts/delegate.mjs --selftest

// ── Agent detection + logging ──────────────────────────────────────────────────

function detectAgent() {
  if (process.env.DELEGATE_AGENT) return process.env.DELEGATE_AGENT;
  if (process.env.CLAUDE_CODE) return 'claude';
  if (process.env.CODEX || process.env.CODEX_SANDBOX) return 'codex';
  if (process.env.OPENCODE_VERSION || process.env.OPENCODE_RUNNER) return 'opencode';
  return 'default';
}

const AGENT = detectAgent();
const DEBUG = process.env.DELEGATE_DEBUG === '1';
const LOG_FILE = process.env.DELEGATE_LOG_FILE
  || join(process.cwd(), 'logs', `delegate-${AGENT}.log`);

// Ensure logs/ directory exists
try { mkdirSync(dirname(LOG_FILE), { recursive: true }); } catch { /* ignore */ }

function log(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [delegate:${level}] [${AGENT}] ${msg}`;
  if (level !== 'DEBUG' || DEBUG) process.stderr.write(line + '\n');
  try { appendFileSync(LOG_FILE, line + '\n'); } catch { /* ignore log errors */ }
}

function dbg(msg) { log('DEBUG', msg); }
function info(msg) { log('INFO', msg); }
function warn(msg) { log('WARN', msg); }

const SYSTEM_PROMPT =
  'You are a precise coding assistant. When asked to extract facts, return ONLY the requested ' +
  'facts: file paths, identifiers, signatures, line numbers, grep-style hits, or a tight summary — ' +
  'never invent a name or path you did not see. When asked to write code, produce complete, correct ' +
  'code for the exact scope requested — no placeholders, no partial stubs. Be terse and faithful.';

function fail(msg, code = 1) { process.stderr.write(`[delegate] ${msg}\n`); process.exit(code); }

// ── HTTP mode helpers ──────────────────────────────────────────────────────────

function parsePool(raw) {
  return raw.split(',').map((s) => s.trim()).filter(Boolean).map((entry) => {
    const i = entry.lastIndexOf(':');
    if (i > 0 && /^\d+(\.\d+)?$/.test(entry.slice(i + 1))) {
      return { key: entry.slice(0, i), weight: Number(entry.slice(i + 1)) };
    }
    return { key: entry, weight: 1 };
  });
}

function pickWeighted(pool, exclude = new Set()) {
  const avail = pool.filter((p) => !exclude.has(p.key));
  const list = avail.length ? avail : pool;
  const total = list.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of list) { r -= p.weight; if (r <= 0) return p.key; }
  return list[list.length - 1].key;
}

// ── OpenCode subprocess mode helpers ──────────────────────────────────────────

/**
 * Parse a comma-separated model priority list.
 * Each entry is "model:variant" or plain "model".
 * If no variant in spec, falls back to GCLI_VARIANT env var.
 * Returns [{model, variant}]
 */
function parseModelSpecs(raw) {
  const globalVariant = process.env.GCLI_VARIANT || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean).map((spec) => {
    const lastColon = spec.lastIndexOf(':');
    // Only treat the suffix as a variant if it comes after the last slash
    // (prevents splitting on model IDs like "antigravity-claude-opus-4-6-thinking")
    if (lastColon > spec.lastIndexOf('/')) {
      return { model: spec.slice(0, lastColon), variant: spec.slice(lastColon + 1) };
    }
    return { model: spec, variant: globalVariant };
  });
}

function parseTaskType(args) {
  const typeArg = args.find((a) => a === '--type') || args.find((a) => a.startsWith('--type='));
  if (!typeArg) return 'code';
  if (typeArg === '--type') {
    const idx = args.indexOf('--type');
    return args[idx + 1] || 'code';
  }
  return typeArg.slice(7) || 'code';
}

function resolveModelSpecs(taskType) {
  if (taskType === 'lookup') {
    const raw = process.env.GCLI_MODELS_LOOKUP || process.env.GCLI_MODELS_CODE || process.env.GCLI_MODELS_PRIORITY;
    if (!raw) fail('GCLI_MODELS_LOOKUP (or GCLI_MODELS_CODE) not set. Required when DELEGATE_RUNNER=opencode.');
    return parseModelSpecs(raw);
  }
  // code (default)
  const raw = process.env.GCLI_MODELS_CODE || process.env.GCLI_MODELS_PRIORITY;
  if (!raw) fail('GCLI_MODELS_CODE (or GCLI_MODELS_PRIORITY) not set. Required when DELEGATE_RUNNER=opencode.');
  return parseModelSpecs(raw);
}

function isQuotaError(stderr, stdout) {
  const combined = (stderr + stdout).toLowerCase();
  return (
    combined.includes('quota') ||
    combined.includes('rate limit') ||
    combined.includes('exhausted') ||
    combined.includes('429') ||
    combined.includes('too many requests') ||
    combined.includes('resource exhausted') ||
    combined.includes('overloaded')
  );
}

async function spawnOpenCode(prompt, model, variant) {
  const { spawn } = await import('node:child_process');
  const args = ['run', prompt, `--model=${model}`];
  if (variant) args.push(`--variant=${variant}`);

  return new Promise((resolve) => {
    const proc = spawn('opencode', args, { shell: false });
    const stdoutChunks = [];
    const stderrChunks = [];
    proc.stdout.on('data', (d) => stdoutChunks.push(d));
    proc.stderr.on('data', (d) => stderrChunks.push(d));
    proc.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      resolve({ success: code === 0 && stdout.trim().length > 0, stdout, stderr, exitCode: code });
    });
    proc.on('error', (e) => {
      resolve({ success: false, stdout: '', stderr: String(e.message), exitCode: -1 });
    });
  });
}

async function runWithOpenCode(fullPrompt, modelSpecs) {
  dbg(`prompt length: ${fullPrompt.length} chars`);
  dbg(`prompt preview: ${fullPrompt.slice(0, 120).replace(/\n/g, '↵')}${fullPrompt.length > 120 ? '…' : ''}`);

  for (let i = 0; i < modelSpecs.length; i++) {
    const { model, variant } = modelSpecs[i];
    const isLast = i === modelSpecs.length - 1;
    const t0 = Date.now();
    info(`trying model: ${model}${variant ? ` variant=${variant}` : ''}`);

    const result = await spawnOpenCode(fullPrompt, model, variant);
    const elapsed = Date.now() - t0;

    if (result.success) {
      info(`ok model=${model} elapsed=${elapsed}ms output=${result.stdout.length}chars`);
      dbg(`stdout preview: ${result.stdout.slice(0, 200).replace(/\n/g, '↵')}…`);
      return result.stdout;
    }

    const quotaHit = isQuotaError(result.stderr, result.stdout);
    if (result.stderr) dbg(`subprocess stderr: ${result.stderr.slice(0, 500)}`);
    if (result.stdout && !result.success) dbg(`subprocess stdout (on fail): ${result.stdout.slice(0, 500)}`);

    if (!quotaHit) {
      warn(`non-quota failure for model ${model} (exit ${result.exitCode})`);
      fail(`opencode failed for model ${model} (exit ${result.exitCode}):\n${(result.stderr || result.stdout).trimEnd()}`);
    }

    warn(`quota hit for ${model}${isLast ? ' — no more models' : ' — falling back'}`);
    if (isLast) fail('all models in pool exhausted quota', 2);
  }
}

// ── stdin reader ───────────────────────────────────────────────────────────────

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--selftest')) {
    // HTTP pool helpers
    const p = parsePool('a:3,b,c:2');
    console.assert(p.length === 3 && p[0].weight === 3 && p[1].weight === 1, 'parsePool');
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 6000; i++) counts[pickWeighted(p)]++;
    console.assert(counts.a > counts.c && counts.c > counts.b, 'pickWeighted weighting');
    console.assert(pickWeighted(p, new Set(['a', 'b', 'c'])), 'all-excluded fallback');

    // OpenCode model spec parsing
    const specs = parseModelSpecs('google/antigravity-claude-opus-4-6-thinking:max,google/antigravity-gemini-3.5-flash:high,google/plain-model');
    console.assert(specs.length === 3, 'parseModelSpecs length');
    console.assert(specs[0].model === 'google/antigravity-claude-opus-4-6-thinking', 'spec[0] model');
    console.assert(specs[0].variant === 'max', 'spec[0] variant');
    console.assert(specs[1].model === 'google/antigravity-gemini-3.5-flash', 'spec[1] model');
    console.assert(specs[1].variant === 'high', 'spec[1] variant');
    console.assert(specs[2].model === 'google/plain-model', 'spec[2] model no variant');

    // Task type parsing
    console.assert(parseTaskType([]) === 'code', 'default task type');
    console.assert(parseTaskType(['--type=lookup']) === 'lookup', '--type=lookup');
    console.assert(parseTaskType(['--type', 'code']) === 'code', '--type code');

    // Quota error detection
    console.assert(isQuotaError('quota exhausted', ''), 'isQuotaError quota');
    console.assert(isQuotaError('', 'HTTP 429 Too Many Requests'), 'isQuotaError 429');
    console.assert(!isQuotaError('connection refused', ''), 'isQuotaError non-quota');

    process.stderr.write('[delegate] selftest ok\n');
    process.exit(0);
  }

  const filteredArgs = args.filter((a) => a !== '--stdin' && a !== '--type' && !a.startsWith('--type='));
  const typeVal = args.find((a) => a === '--type');
  const filteredArgs2 = typeVal
    ? filteredArgs.filter((a) => a !== args[args.indexOf('--type') + 1])
    : filteredArgs;
  const useStdin = args.includes('--stdin');
  const taskType = parseTaskType(args);
  const task = filteredArgs2.join(' ').trim();
  if (!task) fail('no task given. Pass the task as arguments.');

  let userContent = task;
  if (useStdin) {
    const piped = await readStdin();
    userContent = `${task}\n\n--- INPUT ---\n${piped}`;
  }

  const runner = process.env.DELEGATE_RUNNER;
  dbg(`runner=${runner || 'http'} type=${taskType} stdin=${useStdin}`);

  // ── OpenCode subprocess mode ──
  if (runner === 'opencode') {
    const modelSpecs = resolveModelSpecs(taskType);
    dbg(`pool: ${modelSpecs.map(s => `${s.model}${s.variant ? ':' + s.variant : ''}`).join(' → ')}`);
    const output = await runWithOpenCode(userContent, modelSpecs);
    process.stdout.write(output.endsWith('\n') ? output : output + '\n');
    return;
  }

  // ── HTTP mode (legacy / OpenAI-compatible proxy) ──
  const rawKey = process.env.GCLI_API_KEY;
  const baseUrl = process.env.GCLI_BASE_URL;
  if (!rawKey) fail('GCLI_API_KEY not set. For Antigravity, set DELEGATE_RUNNER=opencode (see .env.example).');
  if (!baseUrl) fail('GCLI_BASE_URL not set. For Antigravity, set DELEGATE_RUNNER=opencode (see .env.example).');
  dbg(`http mode: baseUrl=${baseUrl} model=${process.env.GCLI_MODEL || 'gemini-3.1-pro'}`);
  const model = process.env.GCLI_MODEL || 'gemini-3.1-pro';
  const maxRetries = Number(process.env.GCLI_MAX_RETRIES || 4);

  const pool = parsePool(rawKey);
  if (!pool.length) fail('GCLI_API_KEY parsed to empty pool.');

  const url = baseUrl.replace(/\/$/, '') + '/chat/completions';
  const timeoutMs = Number(process.env.GCLI_TIMEOUT_MS || 30000);
  const tried = new Set();
  let lastErr = '';
  const backoff = (attempt) => new Promise((r) => setTimeout(r, 400 * (attempt + 1)));

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const key = pickWeighted(pool, tried);
    const isLast = attempt === maxRetries;
    dbg(`http attempt ${attempt + 1}/${maxRetries + 1} key=...${key.slice(-4)}`);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
        }),
        signal: ac.signal,
      });
      if (res.status === 429 || res.status === 503) {
        tried.add(key);
        lastErr = `HTTP ${res.status}`;
        warn(`rate limited (${res.status}), retrying...`);
        if (!isLast) await backoff(attempt);
        continue;
      }
      if (!res.ok) fail(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? '';
      if (!content.trim()) fail('empty response from pool (no choices/message content).', 2);
      if (data?.usage) {
        info(`usage: ${JSON.stringify(data.usage)} model=${model}`);
      }
      process.stdout.write(content.endsWith('\n') ? content : content + '\n');
      return;
    } catch (e) {
      tried.add(key);
      lastErr = e?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : String(e?.message || e);
      if (!isLast) await backoff(attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  fail(`all ${maxRetries + 1} attempts failed. last error: ${lastErr}`, 2);
}

main();
