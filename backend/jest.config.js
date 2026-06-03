module.exports = {
  testEnvironment: 'node',
  globalSetup: './tests/globalSetup.js',
  setupFilesAfterEnv: ['./tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testTimeout: 30000,
};
