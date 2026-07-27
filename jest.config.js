/**
 * Two projects, because the two kinds of test have different needs:
 *
 *  - `domain` runs the pure business logic (money math, models, factories) in
 *    plain Node. No React Native transform, no mocks, milliseconds to run.
 *    These are the highest-value tests in the project (guide §14).
 *  - `native` runs anything that touches React Native or an Expo module
 *    through the jest-expo preset.
 */

module.exports = {
  projects: [
    {
      displayName: 'domain',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
      testPathIgnorePatterns: ['/node_modules/', '\\.native\\.test\\.ts$'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          { tsconfig: { strict: true, esModuleInterop: true, types: ['jest', 'node'] } },
        ],
      },
    },
    {
      displayName: 'native',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.native.test.{ts,tsx}'],
    },
  ],
};
