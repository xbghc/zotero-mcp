import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000, // 30秒超时，因为是真实 API 请求
    hookTimeout: 30000, // beforeAll/afterAll 超时
  },
});
