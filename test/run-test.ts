import { spawn } from 'child_process';
import * as readline from 'readline';
import * as path from 'path';

const TEST_SUITES: Record<
  string,
  { prefix: string; file: string; description: string }
> = {
  register: {
    prefix: 'REG',
    file: 'test/api/auth/register.api.spec.ts',
    description: 'API Đăng ký (Auth)',
  },
  login: {
    prefix: 'LOG',
    file: 'test/api/auth/login.api.spec.ts',
    description: 'API Đăng nhập (Auth)',
  },
  refresh: {
    prefix: 'REF',
    file: 'test/api/auth/refresh.api.spec.ts',
    description: 'API Cấp lại Token (Auth)',
  },
  logout: {
    prefix: 'OUT',
    file: 'test/api/auth/logout.api.spec.ts',
    description: 'API Đăng xuất (Auth)',
  },
};

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║         🎬  CINEVORA  API  TEST  RUNNER          ║');
console.log('╚══════════════════════════════════════════════════╝\n');

const runTest = (suiteKey: string) => {
  const suite = TEST_SUITES[suiteKey];

  console.log(`Test Running: ${suite.description}`);
  console.log(
    `Prefix: ${suite.prefix} (Test case ID: ${suite.prefix}01, ${suite.prefix}02...)`,
  );
  console.log(`File: ${suite.file}\n`);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TEST_PREFIX: suite.prefix,
    ENABLE_RECAPTCHA: 'false',
  };

  const jestArgs = [
    'exec',
    'jest',
    suite.file,
    '--config',
    'test/jest-e2e.json',
    '--runInBand',
    '--forceExit',
    '--verbose',
  ];

  const child = spawn('pnpm', jestArgs, {
    env,
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    shell: true,
  });

  child.on('error', (err) => {
    console.error('\nJest Error:', err.message);
    process.exit(1);
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log('All tests PASSED! Excel report saved to test/results/');
    } else {
      console.log(`Some tests FAILED (exit code: ${code})`);
    }
    process.exit(code ?? 0);
  });
};

const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

if (command && TEST_SUITES[command]) {
  runTest(command);
} else {
  if (command) {
    console.log(`Command "${command}" not found in the configuration.\n`);
  }

  console.log('Available test modules:');
  const keys = Object.keys(TEST_SUITES);
  keys.forEach((key, index) => {
    console.log(
      `  [${index + 1}] ${key.padEnd(10)} - ${TEST_SUITES[key].description}`,
    );
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(
    '\nEnter a command name (e.g., login) or index [1, 2...] to run: ',
    (answer) => {
      rl.close();
      const input = answer.trim().toLowerCase();

      const index = parseInt(input, 10) - 1;
      if (!isNaN(index) && keys[index]) {
        runTest(keys[index]);
      } else if (TEST_SUITES[input]) {
        runTest(input);
      } else {
        console.log('Invalid selection. Exiting program.');
        process.exit(1);
      }
    },
  );
}
