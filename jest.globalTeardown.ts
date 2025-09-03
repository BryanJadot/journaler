import { exec } from 'child_process';
import { promisify } from 'util';
import { pool } from './src/lib/db';

const execAsync = promisify(exec);

const globalTeardown = async () => {
  if (!process.env.TEST_BRANCH_NAME) {
    console.log('⚠️  No test branch to clean up');
    return;
  }

  try {
    // Close database connections BEFORE deleting the branch
    console.log('🔌 Closing database connections...');
    await pool.end();

    console.log(`🧹 Cleaning up test branch: ${process.env.TEST_BRANCH_NAME}`);
    await execAsync(
      `npx neonctl branches delete ${process.env.TEST_BRANCH_NAME} --project-id ${process.env.NEON_PROJECT_ID}`
    );
    console.log('✅ Test branch deleted successfully');
  } catch (error) {
    console.error(
      '❌ Failed to delete test branch:',
      error instanceof Error ? error.message : String(error)
    );
  }
};

export default globalTeardown;
