import { execSync } from 'child_process';

export default function globalSetup(): void {
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5433/ai_chat_test?schema=public';
  execSync('npx prisma migrate deploy', {
    env: process.env,
    stdio: 'ignore',
  });
}
