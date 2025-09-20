import { exec } from 'child_process';
import { promisify } from 'util';

import { config } from 'dotenv';

config({ path: '.env.local' });

const execAsync = promisify(exec);

const globalSetup = async () => {
  console.log('🔧 Setting up test environment...');

  // Generate unique branch name for this test run
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const branchName = `test-${timestamp}-${randomId}`;

  try {
    // Create new blank branch (no parent data) with 5 minute expiration
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    console.log(
      `📋 Creating blank test branch: ${branchName} (expires at ${expiresAt})`
    );
    await execAsync(
      `npx neonctl branches create --name ${branchName} --project-id ${process.env.NEON_PROJECT_ID} --expires-at "${expiresAt}"`
    );

    // Get the connection string for the new branch
    const { stdout } = await execAsync(
      `npx neonctl connection-string ${branchName} --project-id ${process.env.NEON_PROJECT_ID} --pooled`
    );
    const testDatabaseUrl = stdout.trim();

    // Set environment variables for tests
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.TEST_BRANCH_NAME = branchName;

    // Run migrations to build schema from scratch
    console.log('⚡ Running migrations on blank test branch...');
    await execAsync('npx drizzle-kit migrate');

    console.log(`✅ Test environment ready! Branch: ${branchName}`);
  } catch (error) {
    console.error(
      '❌ Failed to set up test environment:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
};

export default globalSetup;
