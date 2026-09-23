import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "../../apps/opik-frontend");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
const strings = new Map();
const templates = new Map();
const extractTemplates = process.argv.includes("--templates");

function normalize(value) {
  return value.replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”")
    .replace(/\s+/g, " ").trim();
}

function looksLikeUi(value) {
  if (!/[A-Za-z]/.test(value) || value.length > 450 || value.length < 2) return false;
  if (/^(?:https?:|@|\/|\.\/|\.\.\/)/.test(value)) return false;
  if (/[{}<>\\]|\b(?:const|return|function|import|export)\b/.test(value)) return false;
  if (/^[A-Z0-9_:-]+$/.test(value)) return false;
  if (/^[a-z][a-z0-9_:\-]*$/.test(value)) return false;
  if (/^[a-z\d_./:[\]%-]+(?:\s+[a-z\d_./:[\]%-]+)*$/.test(value)) return false;
  if (/^[a-z]+[A-Z][A-Za-z0-9]*$/.test(value)) return false;
  if (/^[\w.]+(?:\.[\w.]+)+$/.test(value)) return false;
  if (/\b(?:noopener|noreferrer|comet-body|justify-|items-|flex |gap-|size-|text-|bg-|hover:|focus:)/.test(value)) return false;
  if (/\.(?:ts|tsx|js|jsx|svg|png|jpg|json|css|scss|py|md)$/.test(value)) return false;
  return /^[\p{L}\p{N}("'\[“]/u.test(value);
}

function include(value, source, visible = false) {
  const key = normalize(value);
  if (visible) {
    if (!/[A-Za-z]/.test(key) || key.length > 450 ||
        /^(?:\/|@opik\.|\[)/.test(key)) return;
  } else if (!looksLikeUi(key)) return;
  const row = strings.get(key) ?? { count: 0, sources: new Set() };
  row.count += 1;
  if (row.sources.size < 3) row.sources.add(source);
  strings.set(key, row);
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(?:test|spec)\.tsx?$/.test(entry.name)) {
      const source = ts.createSourceFile(
        full, fs.readFileSync(full, "utf8"), ts.ScriptTarget.Latest, true,
        full.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      function visit(node) {
        if (extractTemplates && ts.isTemplateExpression(node)) {
          const parts = [node.head.text];
          for (const span of node.templateSpans) parts.push(span.literal.text);
          const value = parts.map((part, index) =>
            index === 0 ? part : `ZXQ${index - 1}ZXQ${part}`,
          ).join("");
          if (looksLikeUi(normalize(value)) && value.length <= 250 &&
              /^[\s"'[(]?[A-Z]/.test(value) &&
              !/[-_/.]ZXQ|ZXQ\d+ZXQ[-_/.]|\b(?:calc|var|px)\(/.test(value) &&
              !/\b(?:MCP|CLI|prompt template)\b/.test(value) &&
              /[A-Za-z]{2,}/.test(parts.join(""))) {
            const key = normalize(value);
            const row = templates.get(key) ?? { count: 0, sources: new Set() };
            row.count += 1;
            if (row.sources.size < 3) row.sources.add(path.relative(root, full));
            templates.set(key, row);
          }
        } else if (ts.isJsxText(node)) {
          include(node.getText(source), path.relative(root, full), true);
        } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
          if (!ts.isImportDeclaration(node.parent) && !ts.isExportDeclaration(node.parent)) {
            include(node.text, path.relative(root, full));
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
}

walk(path.join(root, "src"));
const result = [...(extractTemplates ? templates : strings)].sort(([a], [b]) => a.localeCompare(b)).map(([en, meta]) => ({
  en, count: meta.count, sources: [...meta.sources],
}));
process.stdout.write(JSON.stringify(result));
