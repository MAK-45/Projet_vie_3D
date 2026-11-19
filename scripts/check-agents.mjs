// `npm run check:agents` : vérifie que le dépôt reste lisible par Claude Code et par Mistral Vibe.
// - consignes : CLAUDE.md commence par `@AGENTS.md` ; AGENTS.md n'importe rien (Vibe ne connaît pas `@fichier`) ;
// - skills : un seul dossier, .agents/skills/, et le lien .claude/skills vers lui ; chaque SKILL.md a un `name`
//   identique à son dossier et une `description` de 1 024 caractères au plus, sans `$ARGUMENTS` ni nom d'outil
//   propre à un agent ;
// - réglages en double : les mêmes commandes shell permises et interdites dans .claude/settings.json et
//   .vibe/config.toml, chaque script de scripts/hooks/ déclaré des deux côtés, les mêmes serveurs MCP.
// Code de sortie 1 s'il y a une erreur ; les avertissements ne bloquent pas.

import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(ROOT, file), "utf8");
const has = (file) => existsSync(path.join(ROOT, file));

const errors = [];
const warnings = [];

// Commandes intégrées de Vibe qui masqueraient un skill du même nom (liste partielle, d'après sa documentation).
const BUILTIN_COMMANDS = new Set(["help", "config", "init", "review", "skills", "teleport", "model", "clear", "exit"]);
// Champs d'en-tête propres à Claude Code : ignorés (ou non appliqués) par Vibe.
const CLAUDE_ONLY_FIELDS = ["model", "context", "argument-hint", "allowed-tools"];
// Formulations qui supposent un agent précis (noms d'outils).
const TOOL_WORDING = [/\bSkill tool\b/, /\bthe (Read|Edit|Write|Task|Bash) tool\b/i, /\boutil (Read|Edit|Write|Task|Bash|Artifact|Skill)\b/];

// ---------- consignes ----------
if (!has("AGENTS.md")) errors.push("AGENTS.md manque : c'est la source commune des consignes.");
else if (/^@\S/m.test(read("AGENTS.md"))) errors.push("AGENTS.md contient un import `@fichier` : Vibe ne le suit pas, écrire la règle en entier.");
if (!has("CLAUDE.md")) errors.push("CLAUDE.md manque : sans lui, Claude Code ne lit pas AGENTS.md partout.");
else if (read("CLAUDE.md").split("\n").find((line) => line.trim())?.trim() !== "@AGENTS.md")
  errors.push("CLAUDE.md doit commencer par la ligne `@AGENTS.md`.");

// ---------- skills ----------
const linkPath = path.join(ROOT, ".claude/skills");
const link = lstatSync(linkPath, { throwIfNoEntry: false });
if (!link) errors.push(".claude/skills manque : créer le lien `ln -s ../.agents/skills .claude/skills`.");
else if (!link.isSymbolicLink()) errors.push(".claude/skills n'est pas un lien symbolique (sous Windows : `git config core.symlinks true`, puis recloner).");
else if (path.normalize(readlinkSync(linkPath)) !== path.normalize("../.agents/skills"))
  errors.push(`.claude/skills pointe vers ${readlinkSync(linkPath)} au lieu de ../.agents/skills.`);
for (const dir of [".claude/commands", ".claude/rules"]) {
  if (has(dir)) warnings.push(`${dir}/ existe : Vibe ne le lit pas. En faire un skill (.agents/skills/) ou une règle d'AGENTS.md.`);
}

/** En-tête YAML simple d'un SKILL.md : `clé: valeur`, valeurs entre guillemets, et blocs `>-` ou `|`. */
function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fields = {};
  const lines = match[1].split("\n");
  for (let i = 0; i < lines.length; i++) {
    const field = lines[i].match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!field) continue;
    let [, key, value] = field;
    if (/^[>|][-+]?$/.test(value)) {
      const block = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || lines[i + 1] === "")) block.push(lines[++i].trim());
      value = value.startsWith(">") ? block.join(" ").replace(/\s+/g, " ").trim() : block.join("\n").trim();
    } else value = value.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    fields[key] = value;
  }
  return fields;
}

const skillsDir = path.join(ROOT, ".agents/skills");
const skills = existsSync(skillsDir)
  ? readdirSync(skillsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  : [];
if (skills.length === 0) errors.push(".agents/skills/ est vide ou manque.");
for (const dir of skills) {
  const file = `.agents/skills/${dir}/SKILL.md`;
  if (!has(file)) {
    errors.push(`${file} manque.`);
    continue;
  }
  const text = read(file);
  const fields = frontmatter(text);
  if (!fields) {
    errors.push(`${file} : pas d'en-tête YAML (--- name / description ---).`);
    continue;
  }
  if (fields.name !== dir) errors.push(`${file} : name « ${fields.name} » différent du dossier « ${dir} ».`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fields.name ?? "")) errors.push(`${file} : name en minuscules et tirets seulement.`);
  if (BUILTIN_COMMANDS.has(fields.name)) errors.push(`${file} : « ${fields.name} » est une commande intégrée de Vibe, qui masquerait le skill.`);
  if (!fields.description) errors.push(`${file} : description manquante.`);
  else if (fields.description.length > 1024)
    errors.push(`${file} : description de ${fields.description.length} caractères (Vibe : 1 024 au plus).`);
  for (const key of CLAUDE_ONLY_FIELDS) {
    if (key in fields) warnings.push(`${file} : « ${key} » est propre à Claude Code (Vibe l'ignore ou ne l'applique pas).`);
  }
  if (text.includes("$ARGUMENTS")) errors.push(`${file} : \`$ARGUMENTS\` est propre à Claude Code ; écrire « la demande de l'utilisateur ».`);
  for (const pattern of TOOL_WORDING) {
    const found = text.match(pattern);
    if (found) warnings.push(`${file} : « ${found[0]} » nomme un outil propre à un agent ; décrire l'action.`);
  }
}

// ---------- réglages en double ----------
/** Tableau de chaînes `clé = [...]` dans la section `[section]` d'un fichier TOML simple. */
function tomlArray(text, section, key) {
  const start = text.search(new RegExp(`^\\[${section.replace(".", "\\.")}\\]\\s*$`, "m"));
  if (start < 0) return [];
  const rest = text.slice(start).split("\n").slice(1).join("\n");
  const body = rest.slice(0, rest.search(/^\[/m) < 0 ? undefined : rest.search(/^\[/m));
  const array = body.match(new RegExp(`^${key}\\s*=\\s*\\[([\\s\\S]*?)\\]`, "m"));
  return array ? [...array[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]) : [];
}

const claude = has(".claude/settings.json") ? JSON.parse(read(".claude/settings.json")) : null;
const vibeConfig = has(".vibe/config.toml") ? read(".vibe/config.toml") : null;
const vibeHooks = has(".vibe/hooks.toml") ? read(".vibe/hooks.toml") : "";
if (!claude) errors.push(".claude/settings.json manque.");
if (vibeConfig === null) errors.push(".vibe/config.toml manque.");

if (claude && vibeConfig !== null) {
  const bashRules = (list) =>
    (list ?? [])
      .map((rule) => rule.match(/^Bash\((.*)\)$/)?.[1])
      .filter(Boolean)
      .map((rule) => rule.replace(/:\*$/, "").trim());
  const compare = (label, claudeList, vibeList) => {
    const a = new Set(claudeList);
    const b = new Set(vibeList);
    const onlyClaude = [...a].filter((x) => !b.has(x));
    const onlyVibe = [...b].filter((x) => !a.has(x));
    if (onlyClaude.length) errors.push(`${label} : seulement dans .claude/settings.json : ${onlyClaude.join(", ")}`);
    if (onlyVibe.length) errors.push(`${label} : seulement dans .vibe/config.toml : ${onlyVibe.join(", ")}`);
  };
  compare("Commandes permises", bashRules(claude.permissions?.allow), tomlArray(vibeConfig, "tools.bash", "allowlist"));
  compare("Commandes interdites", bashRules(claude.permissions?.deny), tomlArray(vibeConfig, "tools.bash", "denylist"));

  const claudeHooks = JSON.stringify(claude.hooks ?? {});
  const hookScripts = has("scripts/hooks") ? readdirSync(path.join(ROOT, "scripts/hooks")).filter((f) => !f.startsWith(".")) : [];
  for (const script of hookScripts) {
    const inClaude = claudeHooks.includes(`scripts/hooks/${script}`);
    const inVibe = vibeHooks.includes(`scripts/hooks/${script}`);
    if (inClaude !== inVibe)
      errors.push(`scripts/hooks/${script} n'est déclaré que dans ${inClaude ? ".claude/settings.json" : ".vibe/hooks.toml"}.`);
    else if (!inClaude) warnings.push(`scripts/hooks/${script} n'est déclaré nulle part.`);
  }

  const mcpClaude = has(".mcp.json") ? Object.keys(JSON.parse(read(".mcp.json")).mcpServers ?? {}) : [];
  const mcpVibe = [...vibeConfig.matchAll(/^\[\[mcp_servers\]\][\s\S]*?^name\s*=\s*"([^"]+)"/gm)].map((m) => m[1]);
  compare("Serveurs MCP", mcpClaude, mcpVibe);
}

// ---------- compte rendu ----------
for (const warning of warnings) console.log(`avertissement : ${warning}`);
for (const error of errors) console.log(`ERREUR : ${error}`);
console.log(
  errors.length
    ? `check:agents : ${errors.length} erreur(s), ${warnings.length} avertissement(s).`
    : `check:agents : OK — ${skills.length} skills, consignes et réglages alignés entre Claude Code et Mistral Vibe${warnings.length ? ` (${warnings.length} avertissement(s))` : ""}.`,
);
process.exit(errors.length ? 1 : 0);
