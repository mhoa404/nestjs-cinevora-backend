#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_ROOT = process.cwd();
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');
const TEST_ROOT = path.join(PROJECT_ROOT, 'test');

const IGNORE_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  'coverage',
  '.next',
  'results',
]);

const IGNORE_FILES = new Set([
  '.gitignore',
  '.prettierrc',
  'pnpm-lock.yaml',
  'eslint.config.mjs',
]);

// THÊM: Danh sách các file cấu hình cần lấy ở thư mục gốc
const EXTRA_ROOT_FILES = [
  'docker-compose.yml',
  'Dockerfile',
  'Jenkinsfile',
  'dockerfile.jenkins',
];

const OUTPUT_FILE_NAME = 'project-dump.txt';

function divider(char = '─', len = 80) {
  return char.repeat(len);
}

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return `[Không thể đọc file: ${error.message}]`;
  }
}

function appendLine(lines, text = '') {
  lines.push(text);
}

function appendHeader(lines, title) {
  appendLine(lines, '');
  appendLine(lines, divider('═'));
  appendLine(lines, `  ${title}`);
  appendLine(lines, divider('═'));
}

function shouldIgnoreFile(fileName) {
  return IGNORE_FILES.has(fileName);
}

function shouldIgnoreDir(dirName) {
  return IGNORE_DIRS.has(dirName);
}

function getProjectEntries(dirPath) {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => {
        if (entry.isDirectory()) return !shouldIgnoreDir(entry.name);
        if (entry.isFile()) return !shouldIgnoreFile(entry.name);
        return false;
      })
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });
  } catch {
    return [];
  }
}

function buildTreeLines(dirPath, prefix = '', isLast = true, rootLabel = null) {
  const name = rootLabel ?? path.basename(dirPath);
  const connector = isLast ? '└── ' : '├── ';
  const line =
    prefix === '' ? `📁 ${name}/` : `${prefix}${connector}📁 ${name}/`;
  const lines = [line];

  const entries = getProjectEntries(dirPath);
  const childPrefix = prefix === '' ? '' : prefix + (isLast ? '    ' : '│   ');

  entries.forEach((entry, index) => {
    const last = index === entries.length - 1;
    const childConnector = last ? '└── ' : '├── ';
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const subLines = buildTreeLines(fullPath, childPrefix, last);
      lines.push(...subLines);
    } else {
      lines.push(`${childPrefix}${childConnector}📄 ${entry.name}`);
    }
  });

  return lines;
}

function collectFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  const results = [];
  const entries = getProjectEntries(dirPath);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
}

function appendFileBlock(lines, label, filePath) {
  const relPath = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');

  appendLine(lines, '');
  appendLine(lines, divider());
  appendLine(lines, `  ${label}`);
  appendLine(lines, `  📄 ${relPath}`);
  appendLine(lines, divider());
  appendLine(lines, safeReadFile(filePath));
}

function appendProjectTree(lines) {
  appendHeader(lines, '1. CẤU TRÚC CÂY THƯ MỤC DỰ ÁN');

  const treeLines = buildTreeLines(
    PROJECT_ROOT,
    '',
    true,
    path.basename(PROJECT_ROOT),
  );
  appendLine(lines, treeLines.join('\n'));
}

function appendPackageJson(lines) {
  const packageJsonPath = path.join(PROJECT_ROOT, 'package.json');

  if (!fs.existsSync(packageJsonPath)) return;

  appendHeader(lines, '2. PACKAGE.JSON');
  appendFileBlock(lines, '2.1. package.json', packageJsonPath);
}

// THÊM: Function đọc và ghi các file cấu hình root
function appendRootConfigs(lines) {
  appendHeader(lines, '3. CẤU HÌNH DOCKER & CI/CD (ROOT FILES)');
  let count = 1;
  for (const fileName of EXTRA_ROOT_FILES) {
    const filePath = path.join(PROJECT_ROOT, fileName);
    if (fs.existsSync(filePath)) {
      appendFileBlock(lines, `3.${count}. ${fileName}`, filePath);
      count++;
    }
  }
}

function appendDirectoryFiles(lines, sectionTitle, sectionNumber, dirPath) {
  if (!fs.existsSync(dirPath)) return;

  appendHeader(lines, `${sectionNumber}. ${sectionTitle}`);

  const files = collectFiles(dirPath).sort((a, b) => a.localeCompare(b));
  files.forEach((filePath, index) => {
    const relPath = path.relative(dirPath, filePath).replace(/\\/g, '/');
    appendFileBlock(
      lines,
      `${sectionNumber}.${index + 1}. ${relPath}`,
      filePath,
    );
  });
}

function generateDumpContent() {
  const lines = [];

  appendLine(lines, '╔' + '═'.repeat(78) + '╗');
  appendLine(lines, '║' + '  PROJECT DOCUMENTATION DUMP'.padEnd(78) + '║');
  appendLine(
    lines,
    '║' + `  Generated: ${new Date().toLocaleString('vi-VN')}`.padEnd(78) + '║',
  );
  appendLine(lines, '╚' + '═'.repeat(78) + '╝');

  appendProjectTree(lines);
  appendPackageJson(lines);

  // Gọi hàm mới thêm vào đây
  appendRootConfigs(lines);

  // Đẩy index của các phần tiếp theo lên 4 và 5
  appendDirectoryFiles(lines, 'SOURCE CODE (src/)', 4, SRC_ROOT);
  appendDirectoryFiles(lines, 'TEST CODE (test/)', 5, TEST_ROOT);

  appendLine(lines, '');
  appendLine(lines, divider('═'));
  appendLine(lines, 'DUMP HOÀN TẤT');
  appendLine(lines, divider('═'));
  appendLine(lines, '');

  return lines.join('\n');
}

function main() {
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  const outFile = path.join(downloadsDir, OUTPUT_FILE_NAME);
  const content = generateDumpContent();

  fs.writeFileSync(outFile, content, 'utf8');
  console.log(`Dump xong: ${outFile}`);
}

main();
