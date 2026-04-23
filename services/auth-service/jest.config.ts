import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.test\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@scure|@otplib|otplib|@noble)/)',
  ],
  collectCoverageFrom: ['**/*.ts', '!**/node_modules/**', '!**/dist/**'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@thai-smb-crm/shared-types$': '<rootDir>/../../../packages/shared-types/src',
  },
};

export default config;
