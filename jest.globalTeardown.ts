// Register TypeScript paths before any imports
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('tsconfig-paths').register({
  baseUrl: './',
  paths: {
    '@/*': ['./src/*'],
  },
});

import { pool } from '@/lib/db';

const globalTeardown = async () => {
  try {
    // Close database connections
    console.log('🔌 Closing database connections...');
    await pool.end();
    console.log('✅ Database connections closed');

    // Branch will auto-expire in 3 minutes, no need to manually delete
    if (process.env.TEST_BRANCH_NAME) {
      console.log(
        `ℹ️  Test branch ${process.env.TEST_BRANCH_NAME} will auto-expire in 3 minutes`
      );
    }
  } catch (error) {
    console.error(
      '❌ Failed to close database connections:',
      error instanceof Error ? error.message : String(error)
    );
  }
};

export default globalTeardown;
