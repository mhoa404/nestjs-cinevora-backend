#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, '.ai', 'chunks');

const INCLUDE_DIRS = ['src', 'test'];

const INCLUDE_ROOT_FILES = [
  'package.json',
  'docker-compose.yml',
  'Dockerfile',
  'Dockerfile.jenkins',
  'Jenkinsfile',
  'nest-cli.json',
  'tsconfig.json',
  'tsconfig.build.json',
  'README.md',
  'LICENSE',
  '.env',
  '.env.production',
  'dump-project.js',
];

const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  '.next',
  '.turbo',
  '.idea',
  '.vscode',
  '.ai',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.ts',
  '.js',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.sql',
  '.env',
  '.txt',
]);

const ALLOWED_BASENAMES = new Set([
  'Dockerfile',
  'Dockerfile.jenkins',
  'Jenkinsfile',
  '.env',
  '.env.production',
]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function isTextFile(filePath) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath);

  if (ALLOWED_BASENAMES.has(base)) return true;
  if (ALLOWED_EXTENSIONS.has(ext)) return true;

  return false;
}

function walk(dirPath, result = []) {
  if (!exists(dirPath)) return result;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(fullPath, result);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!isTextFile(fullPath)) continue;

    result.push(fullPath);
  }

  return result;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function sanitizeChunkName(relativePath) {
  return toPosix(relativePath).replace(/\//g, '__') + '.md';
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function detectLanguage(relativePath) {
  const base = path.basename(relativePath);
  const ext = path.extname(relativePath);

  if (base === 'Dockerfile' || base === 'Dockerfile.jenkins') return 'dockerfile';
  if (base === 'Jenkinsfile') return 'groovy';
  if (base === '.env' || base === '.env.production') return 'bash';
  if (ext === '.ts') return 'ts';
  if (ext === '.js') return 'js';
  if (ext === '.json') return 'json';
  if (ext === '.md') return 'md';
  if (ext === '.yml' || ext === '.yaml') return 'yaml';
  if (ext === '.sql') return 'sql';
  if (ext === '.txt') return 'txt';

  return '';
}

function detectModule(relativePath) {
  const normalized = toPosix(relativePath);

  const moduleMatch = normalized.match(/^src\/modules\/([^/]+)\//);
  if (moduleMatch) return moduleMatch[1];

  if (normalized.startsWith('src/common/')) return 'common';
  if (normalized.startsWith('src/config/')) return 'config';
  if (normalized.startsWith('src/database/')) return 'database';
  if (normalized.startsWith('test/')) return 'test';

  return 'root';
}

function detectKind(relativePath) {
  const fileName = path.basename(relativePath);

  if (fileName.endsWith('.controller.ts')) return 'controller';
  if (fileName.endsWith('.service.ts')) return 'service';
  if (fileName.endsWith('.module.ts')) return 'module';
  if (fileName.endsWith('.entity.ts')) return 'entity';
  if (fileName.endsWith('.dto.ts')) return 'dto';
  if (fileName.endsWith('.spec.ts')) return 'spec';
  if (fileName.includes('.api.spec.')) return 'api-spec';
  if (fileName.endsWith('.strategy.ts')) return 'strategy';
  if (fileName.endsWith('.guard.ts')) return 'guard';
  if (fileName.endsWith('.decorator.ts')) return 'decorator';
  if (fileName.endsWith('.filter.ts')) return 'filter';
  if (fileName.endsWith('.interface.ts')) return 'interface';
  if (fileName.endsWith('.type.ts')) return 'type';
  if (fileName.includes('migration') || relativePath.includes('/migrations/')) return 'migration';
  if (fileName.includes('helper')) return 'helper';
  if (fileName.includes('config')) return 'config';

  return 'file';
}

function extractTopLevelSymbols(content, language) {
  if (!['ts', 'js'].includes(language)) return [];

  const patterns = [
    /\bexport\s+class\s+([A-Za-z0-9_]+)/g,
    /\bexport\s+function\s+([A-Za-z0-9_]+)/g,
    /\bexport\s+const\s+([A-Za-z0-9_]+)/g,
    /\bclass\s+([A-Za-z0-9_]+)/g,
    /\bfunction\s+([A-Za-z0-9_]+)/g,
  ];

  const symbols = new Set();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      symbols.add(match[1]);
    }
  }

  return Array.from(symbols).slice(0, 30);
}

function buildChunkContent({
  relativePath,
  content,
  moduleName,
  kind,
  language,
  lineCount,
  fileSize,
  hash,
  symbols,
  updatedAt,
}) {
  const symbolLines =
    symbols.length > 0
      ? symbols.map((s) => `- ${s}`).join('\n')
      : '- (none detected)';

  return `# FILE: ${relativePath}

path: ${relativePath}
module: ${moduleName}
kind: ${kind}
language: ${language || 'plain'}
line_count: ${lineCount}
size_bytes: ${fileSize}
sha256: ${hash}
updated_at: ${updatedAt}

## SYMBOLS
${symbolLines}

## CODE

\`\`\`\`${language}
${content}
\`\`\`\`
`;
}

function collectFiles() {
  const files = [];

  for (const dir of INCLUDE_DIRS) {
    files.push(...walk(path.join(ROOT, dir)));
  }

  for (const file of INCLUDE_ROOT_FILES) {
    const fullPath = path.join(ROOT, file);
    if (exists(fullPath) && fs.statSync(fullPath).isFile() && isTextFile(fullPath)) {
      files.push(fullPath);
    }
  }

  const deduped = Array.from(new Set(files));
  deduped.sort((a, b) => toPosix(path.relative(ROOT, a)).localeCompare(toPosix(path.relative(ROOT, b))));
  return deduped;
}

function main() {
  ensureDir(OUTPUT_DIR);

  const files = collectFiles();
  const manifest = [];

  let generatedCount = 0;

  for (const fullPath of files) {
    const relativePath = toPosix(path.relative(ROOT, fullPath));
    const raw = fs.readFileSync(fullPath, 'utf8');
    const stat = fs.statSync(fullPath);

    const moduleName = detectModule(relativePath);
    const kind = detectKind(relativePath);
    const language = detectLanguage(relativePath);
    const lineCount = raw === '' ? 0 : raw.split(/\r?\n/).length;
    const hash = sha256(raw);
    const symbols = extractTopLevelSymbols(raw, language);
    const updatedAt = stat.mtime.toISOString();

    const chunkName = sanitizeChunkName(relativePath);
    const outputPath = path.join(OUTPUT_DIR, chunkName);

    const chunkContent = buildChunkContent({
      relativePath,
      content: raw,
      moduleName,
      kind,
      language,
      lineCount,
      fileSize: stat.size,
      hash,
      symbols,
      updatedAt,
    });

    fs.writeFileSync(outputPath, chunkContent, 'utf8');

    manifest.push({
      path: relativePath,
      chunk: `.ai/chunks/${chunkName}`,
      module: moduleName,
      kind,
      language: language || 'plain',
      lineCount,
      sizeBytes: stat.size,
      sha256: hash,
      updatedAt,
      symbols,
    });

    generatedCount += 1;
  }

  const manifestPath = path.join(OUTPUT_DIR, '_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), total: manifest.length, files: manifest }, null, 2), 'utf8');

  console.log(`Generated ${generatedCount} chunk files.`);
  console.log(`Manifest: ${toPosix(path.relative(ROOT, manifestPath))}`);
}

try {
  main();
} catch (error) {
  console.error('Failed to generate AI chunks.');
  console.error(error);
  process.exit(1);
}