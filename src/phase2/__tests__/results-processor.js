/**
 * Phase 2 Decision Engine - Test Results Processor
 * 
 * Custom Jest results processor for enhanced test reporting and metrics.
 */

const fs = require('fs');
const path = require('path');

module.exports = (results) => {
  // Calculate comprehensive metrics
  const metrics = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: results.numTotalTests,
      passedTests: results.numPassedTests,
      failedTests: results.numFailedTests,
      pendingTests: results.numPendingTests,
      passRate: results.numTotalTests > 0 ? (results.numPassedTests / results.numTotalTests) * 100 : 0,
      totalTime: results.testResults.reduce((sum, result) => sum + (result.perfStats?.end - result.perfStats?.start || 0), 0)
    },
    performance: {
      averageTestTime: 0,
      slowestTests: [],
      fastestTests: [],
      memoryUsage: process.memoryUsage()
    },
    coverage: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    },
    suites: []
  };

  // Process individual test suites
  results.testResults.forEach(testResult => {
    const suite = {
      name: path.basename(testResult.testFilePath),
      path: testResult.testFilePath,
      status: testResult.numFailingTests > 0 ? 'failed' : 'passed',
      tests: {
        total: testResult.numPassingTests + testResult.numFailingTests + testResult.numPendingTests,
        passed: testResult.numPassingTests,
        failed: testResult.numFailingTests,
        pending: testResult.numPendingTests
      },
      duration: testResult.perfStats ? testResult.perfStats.end - testResult.perfStats.start : 0,
      coverage: testResult.coverage || null
    };

    metrics.suites.push(suite);

    // Track performance metrics
    if (suite.duration > 0) {
      if (metrics.performance.slowestTests.length < 5) {
        metrics.performance.slowestTests.push({
          name: suite.name,
          duration: suite.duration
        });
      }
      
      metrics.performance.slowestTests.sort((a, b) => b.duration - a.duration);
      metrics.performance.slowestTests = metrics.performance.slowestTests.slice(0, 5);
    }
  });

  // Calculate average test time
  const totalDuration = metrics.suites.reduce((sum, suite) => sum + suite.duration, 0);
  metrics.performance.averageTestTime = metrics.suites.length > 0 ? totalDuration / metrics.suites.length : 0;

  // Extract coverage information
  if (results.coverageMap) {
    const coverageData = results.coverageMap.getCoverageSummary();
    metrics.coverage = {
      statements: coverageData.statements.pct,
      branches: coverageData.branches.pct,
      functions: coverageData.functions.pct,
      lines: coverageData.lines.pct
    };
  }

  // Generate status message
  let status = '🎉 ALL TESTS PASSED';
  if (metrics.summary.failedTests > 0) {
    status = `❌ ${metrics.summary.failedTests} TESTS FAILED`;
  } else if (metrics.summary.passRate < 100) {
    status = `⚠️ ${metrics.summary.pendingTests} TESTS PENDING`;
  }

  // Create enhanced report
  const report = {
    status,
    metrics,
    recommendations: generateRecommendations(metrics),
    generatedAt: new Date().toISOString()
  };

  // Save detailed report
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, 'detailed-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Generate summary report
  const summaryPath = path.join(reportDir, 'summary.md');
  fs.writeFileSync(summaryPath, generateMarkdownSummary(report));

  // Console output
  console.log('\n' + '='.repeat(60));
  console.log('📊 PHASE 2 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`${status}`);
  console.log(`📈 Pass Rate: ${metrics.summary.passRate.toFixed(1)}% (${metrics.summary.passedTests}/${metrics.summary.totalTests})`);
  console.log(`⏱️  Total Time: ${(metrics.summary.totalTime / 1000).toFixed(2)}s`);
  console.log(`📋 Coverage: ${metrics.coverage.lines.toFixed(1)}% lines, ${metrics.coverage.branches.toFixed(1)}% branches`);
  
  if (metrics.performance.slowestTests.length > 0) {
    console.log(`🐌 Slowest Tests:`);
    metrics.performance.slowestTests.forEach(test => {
      console.log(`   ${test.name}: ${test.duration}ms`);
    });
  }

  if (report.recommendations.length > 0) {
    console.log(`💡 Recommendations:`);
    report.recommendations.forEach(rec => {
      console.log(`   ${rec}`);
    });
  }

  console.log(`📄 Detailed report: ${reportPath}`);
  console.log('='.repeat(60));

  return results;
};

function generateRecommendations(metrics) {
  const recommendations = [];

  // Performance recommendations
  if (metrics.performance.averageTestTime > 1000) {
    recommendations.push('Consider optimizing slow tests - average test time is over 1 second');
  }

  // Coverage recommendations
  if (metrics.coverage.lines < 85) {
    recommendations.push('Increase test coverage - currently below 85% line coverage');
  }

  if (metrics.coverage.branches < 80) {
    recommendations.push('Add more branch coverage tests - currently below 80%');
  }

  // Failure recommendations
  if (metrics.summary.failedTests > 0) {
    recommendations.push('Fix failing tests before proceeding to production');
  }

  // Memory recommendations
  const memoryMB = metrics.performance.memoryUsage.heapUsed / 1024 / 1024;
  if (memoryMB > 500) {
    recommendations.push('Monitor memory usage - tests are using over 500MB');
  }

  return recommendations;
}

function generateMarkdownSummary(report) {
  const { metrics } = report;
  
  return `# Phase 2 Decision Engine Test Summary

**Generated:** ${report.generatedAt}
**Status:** ${report.status}

## Overview

- **Total Tests:** ${metrics.summary.totalTests}
- **Passed:** ${metrics.summary.passedTests}
- **Failed:** ${metrics.summary.failedTests}
- **Pending:** ${metrics.summary.pendingTests}
- **Pass Rate:** ${metrics.summary.passRate.toFixed(1)}%
- **Total Duration:** ${(metrics.summary.totalTime / 1000).toFixed(2)}s

## Coverage

- **Lines:** ${metrics.coverage.lines.toFixed(1)}%
- **Branches:** ${metrics.coverage.branches.toFixed(1)}%
- **Functions:** ${metrics.coverage.functions.toFixed(1)}%
- **Statements:** ${metrics.coverage.statements.toFixed(1)}%

## Performance

- **Average Test Time:** ${metrics.performance.averageTestTime.toFixed(0)}ms
- **Memory Usage:** ${(metrics.performance.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB

### Slowest Tests

${metrics.performance.slowestTests.map(test => 
  `- ${test.name}: ${test.duration}ms`
).join('\n')}

## Test Suites

| Suite | Status | Tests | Duration |
|-------|--------|-------|----------|
${metrics.suites.map(suite => 
  `| ${suite.name} | ${suite.status === 'passed' ? '✅' : '❌'} | ${suite.tests.passed}/${suite.tests.total} | ${suite.duration}ms |`
).join('\n')}

## Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

---
*Generated by Phase 2 Decision Engine Test Suite*
`;
}