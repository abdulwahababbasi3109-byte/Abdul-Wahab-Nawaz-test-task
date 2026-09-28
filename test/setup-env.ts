process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/ai_chat_test?schema=public';
process.env.OPENAI_MOCK_MIN_DELAY_MS = '100';
process.env.OPENAI_MOCK_MAX_DELAY_MS = '150';
process.env.FREE_MESSAGES_PER_MONTH = '3';
