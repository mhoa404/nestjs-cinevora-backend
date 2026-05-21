import { spawn } from 'child_process';
import * as path from 'path';
import * as readline from 'readline';

type DomainSuite = {
  key: string;
  prefix: string;
  file: string;
  description: string;
};

type TestDomain = {
  description: string;
  suites: DomainSuite[];
};

type SuiteRunResult = {
  suite: DomainSuite;
  code: number;
};

const TEST_DOMAINS: Record<string, TestDomain> = {
  auth: {
    description: 'Toàn bộ API Auth',
    suites: [
      {
        key: 'register',
        prefix: 'REG',
        file: 'test/api/auth/register.api.spec.ts',
        description: 'API Đăng ký (Auth)',
      },
      {
        key: 'login',
        prefix: 'LOG',
        file: 'test/api/auth/login.api.spec.ts',
        description: 'API Đăng nhập (Auth)',
      },
      {
        key: 'refresh',
        prefix: 'REF',
        file: 'test/api/auth/refresh.api.spec.ts',
        description: 'API Cấp lại Token (Auth)',
      },
      {
        key: 'logout',
        prefix: 'OUT',
        file: 'test/api/auth/logout.api.spec.ts',
        description: 'API Đăng xuất (Auth)',
      },
    ],
  },
  genres: {
    description: 'Toàn bộ API Genres',
    suites: [
      {
        key: 'get_genres',
        prefix: 'GGR',
        file: 'test/api/genres/get-genres.api.spec.ts',
        description: 'API Lấy danh sách thể loại phim (Genres)',
      },
      {
        key: 'get_genre_by_id',
        prefix: 'GGI',
        file: 'test/api/genres/get-genre-by-id.api.spec.ts',
        description: 'API Lấy thông tin thể loại phim theo ID (Genres)',
      },
      {
        key: 'create_genre',
        prefix: 'CGR',
        file: 'test/api/genres/create-genre.api.spec.ts',
        description: 'API Tạo thể loại phim (Genres)',
      },
      {
        key: 'update_genre',
        prefix: 'UGR',
        file: 'test/api/genres/update-genre.api.spec.ts',
        description: 'API Cập nhật thể loại phim (Genres)',
      },
      {
        key: 'delete_genre',
        prefix: 'DGR',
        file: 'test/api/genres/delete-genre.api.spec.ts',
        description: 'API Xoá thể loại phim (Genres)',
      },
    ],
  },
  movies: {
    description: 'Toàn bộ API Movies',
    suites: [
      {
        key: 'get_movies',
        prefix: 'GMV',
        file: 'test/api/movies/get-movies.api.spec.ts',
        description: 'API Lấy danh sách phim (Movies)',
      },
      {
        key: 'get_movie_detail',
        prefix: 'GMD',
        file: 'test/api/movies/get-movie-detail.api.spec.ts',
        description: 'API Lấy thông tin chi tiết phim (Movies)',
      },
      {
        key: 'create_movie',
        prefix: 'CMV',
        file: 'test/api/movies/create-movie.api.spec.ts',
        description: 'API Tạo phim (Movies)',
      },
      {
        key: 'update_movie',
        prefix: 'UMV',
        file: 'test/api/movies/update-movie.api.spec.ts',
        description: 'API Cập nhật phim (Movies)',
      },
      {
        key: 'delete_movie',
        prefix: 'DMV',
        file: 'test/api/movies/delete-movie.api.spec.ts',
        description: 'API Xoá phim (Movies)',
      },
    ],
  },
};

console.log('► CINEVORA DOMAIN API TEST RUNNER ◄');

const runJestSuite = (suite: DomainSuite): Promise<number> => {
  console.log('\n────────────────────────────────────────');
  console.log(`Test Running: ${suite.description}`);
  console.log(
    `Prefix: ${suite.prefix} (Test case ID: ${suite.prefix}01, ${suite.prefix}02...)`,
  );
  console.log(`File: ${suite.file}`);
  console.log('────────────────────────────────────────\n');

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

  return new Promise((resolve) => {
    const child = spawn('pnpm', jestArgs, {
      env,
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
      shell: true,
    });

    child.on('error', (err) => {
      console.error('\nJest Error:', err.message);
      resolve(1);
    });

    child.on('close', (code) => {
      resolve(code ?? 0);
    });
  });
};

const printDomainSummary = (
  domainKey: string,
  results: SuiteRunResult[],
): void => {
  console.log('\n────────────────────────────────────────');
  console.log(`Domain Summary: ${domainKey}`);
  console.log('────────────────────────────────────────');

  results.forEach((result, index) => {
    const status = result.code === 0 ? 'PASSED' : 'FAILED';

    console.log(
      `${index + 1}. ${result.suite.key.padEnd(12)} | ${status.padEnd(
        6,
      )} | exit code: ${result.code} | ${result.suite.description}`,
    );
  });

  const failedResults = results.filter((result) => result.code !== 0);

  if (failedResults.length === 0) {
    console.log(
      `\nDomain "${domainKey}" PASSED. All Excel reports saved to test/results/`,
    );
    return;
  }

  console.log(`\nDomain "${domainKey}" completed with failed suites:`);

  failedResults.forEach((result) => {
    console.log(`- ${result.suite.key}: ${result.suite.description}`);
  });
};

const runDomain = async (domainKey: string): Promise<void> => {
  const domain = TEST_DOMAINS[domainKey];

  if (!domain) {
    console.log(`Domain "${domainKey}" not found.`);
    process.exit(1);
  }

  console.log(`Domain Running: ${domain.description}`);
  console.log(
    `Suites: ${domain.suites.map((suite) => suite.key).join(' -> ')}\n`,
  );

  const results: SuiteRunResult[] = [];

  for (const suite of domain.suites) {
    const code = await runJestSuite(suite);

    results.push({
      suite,
      code,
    });

    if (code === 0) {
      console.log(`\nSuite "${suite.key}" PASSED.`);
    } else {
      console.log(
        `\nSuite "${suite.key}" FAILED with exit code ${code}. Continue running next suite...`,
      );
    }
  }

  printDomainSummary(domainKey, results);

  const hasFailedSuite = results.some((result) => result.code !== 0);
  process.exit(hasFailedSuite ? 1 : 0);
};

const printAvailableDomains = (): void => {
  console.log('Available test domains:');

  const domainKeys = Object.keys(TEST_DOMAINS);

  domainKeys.forEach((key, index) => {
    console.log(
      `${index + 1}. ${key.padEnd(10)} - ${TEST_DOMAINS[key].description}`,
    );
  });
};

const askDomainAndRun = (): void => {
  const domainKeys = Object.keys(TEST_DOMAINS);

  printAvailableDomains();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(
    '\nEnter a domain name or index [e.g. auth, 1] to run: ',
    (answer) => {
      rl.close();

      const input = answer.trim().toLowerCase();
      const index = parseInt(input, 10) - 1;

      if (!Number.isNaN(index) && domainKeys[index]) {
        void runDomain(domainKeys[index]);
        return;
      }

      if (TEST_DOMAINS[input]) {
        void runDomain(input);
        return;
      }

      console.log('Invalid selection. Exiting program.');
      process.exit(1);
    },
  );
};

const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

if (command) {
  if (TEST_DOMAINS[command]) {
    void runDomain(command);
  } else {
    console.log(
      `Command "${command}" not found in the domain configuration.\n`,
    );
    printAvailableDomains();
    process.exit(1);
  }
} else {
  askDomainAndRun();
}
