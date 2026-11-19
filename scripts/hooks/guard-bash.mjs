#!/usr/bin/env node
// Hook commun à Claude Code et Mistral Vibe, lancé avant chaque commande shell de l'agent :
// refuse les commandes destructrices (rm récursif forcé, git push forcé). `--force-with-lease` reste permis.
//
// Déclaré deux fois :
// - Claude Code, .claude/settings.json (PreToolUse, matcher Bash) : `--format=claude` ; refus = code 2 + raison
//   sur stderr.
// - Vibe, .vibe/hooks.toml (pre_tool, match bash, strict) : `--format=vibe` ; refus = code 0 + JSON
//   {"decision": "deny", "reason": ...} sur stdout (un code non nul y est un échec du hook, pas un refus).
// Sans `--format`, le format se déduit de `hook_event_name` (`PreToolUse` : Claude Code, sinon Vibe).
//
// Vérifier ce que l'agent envoie : GUARD_BASH_LOG=/chemin/journal.jsonl ajoute chaque entrée reçue au journal.

import { appendFileSync, readFileSync } from "node:fs";

const SEPARATORS = /&&|\|\||[;|&\n]/;

/** `rm` avec à la fois récursif (-r, -R, --recursive) et forcé (-f, --force), dans n'importe quel ordre. */
function isRecursiveForceRm(tokens) {
  const start = tokens.findIndex((token) => token === "rm" || token.endsWith("/rm"));
  if (start < 0) return false;
  let recursive = false;
  let force = false;
  for (const token of tokens.slice(start + 1)) {
    if (token === "--") break;
    if (token === "--recursive") recursive = true;
    else if (token === "--force") force = true;
    else if (/^-[a-zA-Z]+$/.test(token)) {
      if (/[rR]/.test(token)) recursive = true;
      if (token.includes("f")) force = true;
    }
  }
  return recursive && force;
}

/** `git push` forcé : --force, -f (seul ou groupé : -uf), ou une référence préfixée par + ; pas --force-with-lease. */
function isForcePush(tokens) {
  const git = tokens.indexOf("git");
  const push = git < 0 ? -1 : tokens.indexOf("push", git + 1);
  if (push < 0) return false;
  return tokens
    .slice(push + 1)
    .some((token) => token === "--force" || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(token) || /^\+[^+]/.test(token));
}

const RULES = [
  { test: isRecursiveForceRm, label: "rm -rf", hint: "Supprimer des fichiers ou dossiers précis, sans -rf." },
  { test: isForcePush, label: "git push --force", hint: "Pousser sans forcer, ou avec --force-with-lease." },
];

/** Cherche la commande shell dans l'entrée reçue, quel que soit l'outil (champ `command` ou `cmd`). */
function findCommand(payload) {
  const containers = [payload?.tool_input, payload?.args, payload?.arguments, payload?.input, payload];
  for (const container of containers) {
    if (container && typeof container === "object") {
      for (const key of ["command", "cmd"]) {
        if (typeof container[key] === "string") return container[key];
      }
    }
  }
  return "";
}

const raw = readFileSync(0, "utf8");
if (process.env.GUARD_BASH_LOG) {
  try {
    appendFileSync(process.env.GUARD_BASH_LOG, raw.trim() + "\n");
  } catch {
    // le journal est une aide de mise au point : ne jamais bloquer pour lui
  }
}

let payload = {};
try {
  payload = raw.trim() ? JSON.parse(raw) : {};
} catch {
  process.exit(0); // entrée illisible : on laisse les permissions de l'outil décider
}

const formatArg = process.argv.find((arg) => arg.startsWith("--format="))?.slice("--format=".length);
const format = formatArg ?? (payload.hook_event_name === "PreToolUse" ? "claude" : "vibe");

const command = findCommand(payload);
const blocked = command
  .split(SEPARATORS)
  .map((segment) => segment.trim().split(/\s+/).filter(Boolean))
  .flatMap((tokens) => RULES.filter((rule) => rule.test(tokens)));

if (blocked.length === 0) process.exit(0);

const reason = `Commande refusée par le hook du projet (scripts/hooks/guard-bash.mjs) : elle contient « ${blocked[0].label} ». ${blocked[0].hint}`;
if (format === "claude") {
  process.stderr.write(reason + "\n");
  process.exit(2);
}
process.stdout.write(JSON.stringify({ decision: "deny", reason }) + "\n");
process.exit(0);
