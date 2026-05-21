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
  get_genres: {
    prefix: 'GGR',
    file: 'test/api/genres/get-genres.api.spec.ts',
    description: 'API Lấy danh sách thể loại phim (Genres)',
  },
  get_genre_by_id: {
    prefix: 'GGI',
    file: 'test/api/genres/get-genre-by-id.api.spec.ts',
    description: 'API Lấy thể loại phim theo ID (Genres)',
  },
  create_genre: {
    prefix: 'CGR',
    file: 'test/api/genres/create-genre.api.spec.ts',
    description: 'API Tạo thể loại phim (Genres)',
  },
  update_genre: {
    prefix: 'UGR',
    file: 'test/api/genres/update-genre.api.spec.ts',
    description: 'API Cập nhật thể loại phim (Genres)',
  },
  delete_genre: {
    prefix: 'DGR',
    file: 'test/api/genres/delete-genre.api.spec.ts',
    description: 'API xoá thể loại phim (Genres)',
  },
  create_movie: {
    prefix: 'CMV',
    file: 'test/api/movies/create-movie.api.spec.ts',
    description: 'API Tạo phim (Movies)',
  },
  update_movie: {
    prefix: 'UMV',
    file: 'test/api/movies/update-movie.api.spec.ts',
    description: 'API Cập nhật phim (Movies)',
  },
  delete_movie: {
    prefix: 'DMV',
    file: 'test/api/movies/delete-movie.api.spec.ts',
    description: 'API xoá phim (Movies)',
  },
  create_room: {
    prefix: 'CRM',
    file: 'test/api/rooms/create-room.api.spec.ts',
    description: 'API Tạo phòng chiếu (Rooms)',
  },
  get_rooms: {
    prefix: 'GRM',
    file: 'test/api/rooms/get-rooms.api.spec.ts',
    description: 'API Lấy danh sách phòng chiếu (Rooms)',
  },
  get_room_by_id: {
    prefix: 'GRI',
    file: 'test/api/rooms/get-room-by-id.api.spec.ts',
    description: 'API Lấy phòng chiếu theo ID (Rooms)',
  },
  update_room: {
    prefix: 'URM',
    file: 'test/api/rooms/update-room.api.spec.ts',
    description: 'API Cập nhật phòng chiếu (Rooms)',
  },
  delete_room: {
    prefix: 'DRM',
    file: 'test/api/rooms/delete-room.api.spec.ts',
    description: 'API Xoá phòng chiếu (Rooms)',
  },
  create_showtime: {
    prefix: 'CST',
    file: 'test/api/showtimes/create-showtime.api.spec.ts',
    description: 'API Tạo suất chiếu (Showtimes)',
  },
  update_showtime: {
    prefix: 'UST',
    file: 'test/api/showtimes/update-showtime.api.spec.ts',
    description: 'API Cập nhật suất chiếu (Showtimes)',
  },
  delete_showtime: {
    prefix: 'DST',
    file: 'test/api/showtimes/delete-showtime.api.spec.ts',
    description: 'API Xoá suất chiếu (Showtimes)',
  },
  get_showtimes: {
    prefix: 'GST',
    file: 'test/api/showtimes/get-showtimes.api.spec.ts',
    description: 'API Lấy danh sách suất chiếu (Showtimes)',
  },
  get_showtime_by_id: {
    prefix: 'GSD',
    file: 'test/api/showtimes/get-showtime-by-id.api.spec.ts',
    description: 'API Lấy suất chiếu theo ID (Showtimes)',
  },
};

console.log('\n╔════════════════════════════════════════════════╗');
console.log('║           CINEVORA  API  TEST  RUNNER          ║');
console.log('╚════════════════════════════════════════════════╝\n');

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
