/**
 * Jest Configuration for Phase 2 Decision Engine Tests
 * 
 * Optimized configuration for comprehensive testing of all Phase 2 components
 * with proper coverage, performance monitoring, and integration testing.
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Root directory for tests
  rootDir: './src/phase2',
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.js'
  ],
  
  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    'test-runner.ts'
  ],
  
  // TypeScript support
  preset: 'ts-jest',
  
  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/__tests__/setup.ts'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**'
  ],
  
  coverageDirectory: '<rootDir>/__tests__/coverage',
  
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'json',
    'lcov'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Specific thresholds for critical components
    './engine/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './gates/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './services/normalizer.ts': {
      branches: 95,
      functions: 100,
      lines: 95,
      statements: 95
    }
  },
  
  // Test timeout (30 seconds for integration tests)
  testTimeout: 30000,
  
  // Verbose output for detailed test results
  verbose: true,
  
  // Detect open handles (memory leaks)
  detectOpenHandles: true,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Reset modules between tests
  resetModules: true,
  
  // Transform configuration
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // Global test configuration
  globals: {
    'ts-jest': {
      tsconfig: {
        compilerOptions: {
          module: 'commonjs',
          target: 'es2020',
          lib: ['es2020'],
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true
        }
      }
    }
  },
  
  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './src/phase2/__tests__/reports',
        filename: 'test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: 'Phase 2 Decision Engine Test Report'
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './src/phase2/__tests__/reports',
        outputName: 'junit.xml',
        suiteName: 'Phase 2 Decision Engine Tests'
      }
    ]
  ],
  
  // Performance monitoring
  maxWorkers: '50%', // Use half of available CPU cores
  
  // Error handling
  bail: false, // Continue running tests even if some fail
  
  // Test result processor for custom reporting
  testResultsProcessor: '<rootDir>/__tests__/results-processor.js'
};