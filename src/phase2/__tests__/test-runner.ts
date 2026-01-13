/**
 * Phase 2 Decision Engine - Test Runner
 * 
 * Comprehensive test execution and reporting for all Phase 2 components.
 * Provides detailed test results, performance metrics, and coverage analysis.
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: number;
}

interface TestReport {
  timestamp: string;
  engineVersion: string;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalDuration: number;
  overallCoverage: number;
  suites: TestResult[];
  summary: string;
}

export class Phase2TestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  /**
   * Run all Phase 2 tests with comprehensive reporting
   */
  async runAllTests(): Promise<TestReport> {
    console.log('🚀 Starting Phase 2 Decision Engine Test Suite');
    console.log('================================================');
    
    this.startTime = Date.now();

    // Define test suites in execution order
    const testSuites = [
      { name: 'Types and Configuration', pattern: 'types|config' },
      { name: 'Normalizer', pattern: 'normalizer' },
      { name: 'Providers', pattern: 'providers' },
      { name: 'Market Context Builder', pattern: 'market-context-builder' },
      { name: 'Risk Gates', pattern: 'gates' },
      { name: 'Decision Engine', pattern: 'decision-engine' },
      { name: 'Output Formatter', pattern: 'decision-output-formatter' },
      { name: 'Immutability', pattern: 'immutability' },
      { name: 'Error Handling', pattern: 'error-handling' },
      { name: 'Performance', pattern: 'performance' },
      { name: 'Health Monitoring', pattern: 'health-monitoring' },
      { name: 'Rate Limiting', pattern: 'rate-limiting' },
      { name: 'Security Middleware', pattern: 'security-middleware' },
      { name: 'Webhook Service', pattern: 'webhook-service' },
      { name: 'Integration Tests', pattern: 'integration' },
      { name: 'End-to-End Tests', pattern: 'end-to-end' }
    ];

    // Run each test suite
    for (const suite of testSuites) {
      await this.runTestSuite(suite.name, suite.pattern);
    }

    // Generate final report
    const report = this.generateReport();
    
    // Save report to file
    this.saveReport(report);
    
    // Print summary
    this.printSummary(report);
    
    return report;
  }

  /**
   * Run a specific test suite
   */
  private async runTestSuite(suiteName: string, pattern: string): Promise<void> {
    console.log(`\n📋 Running ${suiteName} Tests...`);
    
    const suiteStartTime = Date.now();
    
    try {
      // Run Jest with specific pattern
      const command = `npm test -- --testPathPattern="${pattern}" --verbose --json --coverage`;
      const output = execSync(command, { 
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'pipe'
      });

      // Parse Jest output
      const result = this.parseJestOutput(output, suiteName);
      result.duration = Date.now() - suiteStartTime;
      
      this.results.push(result);
      
      console.log(`✅ ${suiteName}: ${result.passed} passed, ${result.failed} failed (${result.duration}ms)`);
      
    } catch (error: unknown) {
      // Handle test failures
      const result: TestResult = {
        suite: suiteName,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: Date.now() - suiteStartTime
      };
      
      // Try to parse error output for more details
      if (error.stdout) {
        const parsedResult = this.parseJestOutput(error.stdout, suiteName);
        result.passed = parsedResult.passed;
        result.failed = parsedResult.failed;
        result.skipped = parsedResult.skipped;
      }
      
      this.results.push(result);
      
      console.log(`❌ ${suiteName}: ${result.passed} passed, ${result.failed} failed (${result.duration}ms)`);
    }
  }

  /**
   * Parse Jest JSON output
   */
  private parseJestOutput(output: string, suiteName: string): TestResult {
    try {
      // Extract JSON from output (Jest outputs other text too)
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in output');
      }
      
      const jestResult = JSON.parse(jsonMatch[0]);
      
      return {
        suite: suiteName,
        passed: jestResult.numPassedTests || 0,
        failed: jestResult.numFailedTests || 0,
        skipped: jestResult.numPendingTests || 0,
        duration: 0, // Will be set by caller
        coverage: this.extractCoverage(jestResult)
      };
      
    } catch (_error) {
      // Fallback parsing for non-JSON output
      const lines = output.split('\n');
      let passed = 0;
      let failed = 0;
      let skipped = 0;
      
      for (const line of lines) {
        if (line.includes('✓') || line.includes('passed')) {
          const match = line.match(/(\d+)/);
          if (match) passed += parseInt(match[1]);
        }
        if (line.includes('✗') || line.includes('failed')) {
          const match = line.match(/(\d+)/);
          if (match) failed += parseInt(match[1]);
        }
        if (line.includes('skipped') || line.includes('pending')) {
          const match = line.match(/(\d+)/);
          if (match) skipped += parseInt(match[1]);
        }
      }
      
      return {
        suite: suiteName,
        passed,
        failed,
        skipped,
        duration: 0
      };
    }
  }

  /**
   * Extract coverage information from Jest result
   */
  private extractCoverage(jestResult: unknown): number {
    try {
      if (jestResult.coverageMap) {
        const coverage = jestResult.coverageMap;
        const totalLines = 0;
        const coveredLines = 0;
        
        for (const file in coverage) {
          const fileCoverage = coverage[file];
          if (fileCoverage.s) { // Statement coverage
            for (const statement in fileCoverage.s) {
              totalLines++;
              if (fileCoverage.s[statement] > 0) {
                coveredLines++;
              }
            }
          }
        }
        
        return totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;
      }
      
      return 0;
    } catch (_error) {
      return 0;
    }
  }

  /**
   * Generate comprehensive test report
   */
  private generateReport(): TestReport {
    const totalDuration = Date.now() - this.startTime;
    const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);
    
    // Calculate overall coverage
    const coverageResults = this.results.filter(r => r.coverage !== undefined);
    const overallCoverage = coverageResults.length > 0
      ? coverageResults.reduce((sum, r) => sum + (r.coverage || 0), 0) / coverageResults.length
      : 0;

    // Generate summary
    const passRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;
    const summary = this.generateSummary(passRate, totalTests, totalPassed, totalFailed, overallCoverage);

    return {
      timestamp: new Date().toISOString(),
      engineVersion: '2.0.0',
      totalTests,
      totalPassed,
      totalFailed,
      totalSkipped,
      totalDuration,
      overallCoverage,
      suites: this.results,
      summary
    };
  }

  /**
   * Generate test summary message
   */
  private generateSummary(passRate: number, totalTests: number, totalPassed: number, totalFailed: number, coverage: number): string {
    if (passRate === 100 && totalFailed === 0) {
      return `🎉 ALL TESTS PASSED! Perfect score: ${totalTests}/${totalTests} tests passing with ${coverage.toFixed(1)}% coverage.`;
    } else if (passRate >= 95) {
      return `🟢 EXCELLENT: ${passRate.toFixed(1)}% pass rate (${totalPassed}/${totalTests}) with ${coverage.toFixed(1)}% coverage.`;
    } else if (passRate >= 90) {
      return `🟡 GOOD: ${passRate.toFixed(1)}% pass rate (${totalPassed}/${totalTests}) with ${coverage.toFixed(1)}% coverage. ${totalFailed} tests need attention.`;
    } else if (passRate >= 80) {
      return `🟠 NEEDS WORK: ${passRate.toFixed(1)}% pass rate (${totalPassed}/${totalTests}) with ${coverage.toFixed(1)}% coverage. ${totalFailed} tests failing.`;
    } else {
      return `🔴 CRITICAL: Only ${passRate.toFixed(1)}% pass rate (${totalPassed}/${totalTests}) with ${coverage.toFixed(1)}% coverage. ${totalFailed} tests failing - immediate attention required.`;
    }
  }

  /**
   * Save report to file
   */
  private saveReport(report: TestReport): void {
    const reportPath = join(process.cwd(), 'src/phase2/__tests__/test-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Also save a human-readable version
    const readableReport = this.generateReadableReport(report);
    const readablePath = join(process.cwd(), 'src/phase2/__tests__/test-report.md');
    writeFileSync(readablePath, readableReport);
    
    console.log(`\n📄 Reports saved:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   Markdown: ${readablePath}`);
  }

  /**
   * Generate human-readable markdown report
   */
  private generateReadableReport(report: TestReport): string {
    const lines = [
      '# Phase 2 Decision Engine - Test Report',
      '',
      `**Generated:** ${report.timestamp}`,
      `**Engine Version:** ${report.engineVersion}`,
      `**Total Duration:** ${(report.totalDuration / 1000).toFixed(2)}s`,
      '',
      '## Summary',
      '',
      report.summary,
      '',
      '## Test Results',
      '',
      '| Test Suite | Passed | Failed | Skipped | Duration | Coverage |',
      '|------------|--------|--------|---------|----------|----------|'
    ];

    for (const suite of report.suites) {
      const coverage = suite.coverage ? `${suite.coverage.toFixed(1)}%` : 'N/A';
      const duration = `${suite.duration}ms`;
      const status = suite.failed === 0 ? '✅' : '❌';
      
      lines.push(`| ${status} ${suite.suite} | ${suite.passed} | ${suite.failed} | ${suite.skipped} | ${duration} | ${coverage} |`);
    }

    lines.push('');
    lines.push('## Overall Statistics');
    lines.push('');
    lines.push(`- **Total Tests:** ${report.totalTests}`);
    lines.push(`- **Passed:** ${report.totalPassed} (${((report.totalPassed / report.totalTests) * 100).toFixed(1)}%)`);
    lines.push(`- **Failed:** ${report.totalFailed} (${((report.totalFailed / report.totalTests) * 100).toFixed(1)}%)`);
    lines.push(`- **Skipped:** ${report.totalSkipped} (${((report.totalSkipped / report.totalTests) * 100).toFixed(1)}%)`);
    lines.push(`- **Overall Coverage:** ${report.overallCoverage.toFixed(1)}%`);
    lines.push(`- **Average Suite Duration:** ${(report.totalDuration / report.suites.length / 1000).toFixed(2)}s`);

    return lines.join('\n');
  }

  /**
   * Print summary to console
   */
  private printSummary(report: TestReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('🏁 PHASE 2 DECISION ENGINE TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(report.summary);
    console.log('');
    console.log(`📊 Statistics:`);
    console.log(`   Total Tests: ${report.totalTests}`);
    console.log(`   Passed: ${report.totalPassed}`);
    console.log(`   Failed: ${report.totalFailed}`);
    console.log(`   Coverage: ${report.overallCoverage.toFixed(1)}%`);
    console.log(`   Duration: ${(report.totalDuration / 1000).toFixed(2)}s`);
    console.log('');
    
    if (report.totalFailed > 0) {
      console.log('❌ Failed Test Suites:');
      report.suites
        .filter(s => s.failed > 0)
        .forEach(s => console.log(`   - ${s.suite}: ${s.failed} failures`));
      console.log('');
    }
    
    console.log('✅ Completed Phase 2 Test Suite');
    console.log('='.repeat(60));
  }

  /**
   * Run specific test pattern
   */
  async runPattern(pattern: string): Promise<void> {
    console.log(`🔍 Running tests matching pattern: ${pattern}`);
    await this.runTestSuite(`Pattern: ${pattern}`, pattern);
    
    if (this.results.length > 0) {
      const result = this.results[0];
      console.log(`\n📋 Results: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`);
    }
  }
}

// CLI interface
if (require.main === module) {
  const runner = new Phase2TestRunner();
  
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] === '--pattern') {
    // Run specific pattern
    const pattern = args[1] || '';
    runner.runPattern(pattern).catch(console._error);
  } else {
    // Run all tests
    runner.runAllTests().catch(console._error);
  }
}

export default Phase2TestRunner;