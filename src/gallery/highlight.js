// Coloration syntaxique minimale pour JavaScript (commentaires, chaînes, nombres, mots-clés).

const KEYWORDS = new Set(
  ("import export from const let var function return if else for while of in new class extends default " +
    "async await break continue switch case throw try catch typeof instanceof null undefined true false this")
    .split(" "),
);

const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b|\b0x[\da-f]+\b)|([A-Za-z_$][\w$]*)/gi;

const escapeHtml = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** @returns {string} HTML à placer dans un <code> */
export function highlight(code) {
  let html = "";
  let last = 0;
  for (const match of code.matchAll(TOKEN)) {
    html += escapeHtml(code.slice(last, match.index));
    const [text, comment, string, number, word] = match;
    if (comment) html += `<span class="tok-comment">${escapeHtml(text)}</span>`;
    else if (string) html += `<span class="tok-string">${escapeHtml(text)}</span>`;
    else if (number) html += `<span class="tok-number">${text}</span>`;
    else if (KEYWORDS.has(word)) html += `<span class="tok-keyword">${text}</span>`;
    else html += escapeHtml(text);
    last = match.index + text.length;
  }
  return html + escapeHtml(code.slice(last));
}
