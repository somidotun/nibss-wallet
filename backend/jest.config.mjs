/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transformIgnorePatterns: [
    "[/\\\\]node_modules[/\\\\](?!@apidevtools[/\\\\]json-schema-ref-parser)",
  ],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
      },
    ],
    "[/\\\\]@apidevtools[/\\\\]json-schema-ref-parser[/\\\\].+\\.js$": [
      "ts-jest",
      {
        useESM: false,
        tsconfig: { allowJs: true, module: "commonjs" },
      },
    ],
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  forceExit: true,
  clearMocks: true,
  testTimeout: 30000,
  maxWorkers: "50%",
};

export default config;
