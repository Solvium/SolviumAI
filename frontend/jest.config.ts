import nextJest from "next/jest";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/test/setupTests.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testMatch: [
    "<rootDir>/src/**/*.test.(ts|tsx)",
    "<rootDir>/src/**/*.spec.(ts|tsx)",
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/types.ts",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "html"],
};

export default createJestConfig(customJestConfig);
