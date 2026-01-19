/**
 * Direct Paper Execution Test
 * 
 * Bypasses webhooks and directly tests the paper execution flow
 * by calling the paper executor with mock decision data.
 * 
 * Run with: node test-paper-direct.js
 */

async function testDirectPaperExecution() {
  const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
  };
  
  function print(msg, color = 'reset') {
    console.log(`${colors[color]}${msg}${colors.reset}`);
  }
  
  print('\n' + '='.repeat(80), 'cyan');
  print('Direct Paper Execution Test', 'bright');
  print('='.repeat(80), 'cyan');
  
  try {
    // Import required modules
    print('\n📦 Loading modules...', 'cyan');
    const { buildPaperTradeInputs } = await import('./src/phase25/utils/paper-execution-adapter.ts');
    const { executePaperTrade } = await import('./src/paper/index.ts');
    const { simulatePaperExit } = await import('./src/phase25/utils/paper-exit-simulator.ts');
    const { getGlobalLedger } = await import('./src/ledger/globalLedger.ts');
    const { convertDecisionToLedgerEntryWithExecution } = await import('./src/phase25/utils/ledger-adapter.ts');
    
    print('✅ Modules loaded', 'green');
    
    // Create mock decision packet (EXECUTE with high confidence)
    print('\n🎯 Creating mock EXECUTE decision...', 'cyan');
    const mockDecision = {
      action: 'EXECUTE',
      direction: 'LONG',
      finalSizeMultiplier: 1.5,
      confidenceScore: 85.5,
      reasons: ['High confidence execution (85.5)'],
      engineVersion: '2.5.0',
      gateResults: {
        regime: { passed: true, score: 95, reason: 'Phase 2 allows LONG' },
        structural: { passed: true, score: 90, reason: 'Valid setup with A quality' },
        market: { passed: true, score: 80, reason: 'All market conditions OK' }
      },
      inputContext: {
        meta: { engineVersion: '2.5.0', receivedAt: Date.now(), completeness: 1.0 },
        instrument: { symbol: 'SPY', exchange: 'NASDAQ', price: 450.25 },
        regime: { phase: 2, phaseName: 'MARKUP', volatility: 'NORMAL', confidence: 95, bias: 'LONG' },
        alignment: { tfStates: {}, bullishPct: 75, bearishPct: 25 },
        expert: { direction: 'LONG', aiScore: 9.5, quality: 'EXTREME', components: ['momentum', 'volume'], rr1: 4.5, rr2: 7.0 },
        structure: { validSetup: true, liquidityOk: true, executionQuality: 'A' }
      },
      marketSnapshot: {
        options: { putCallRatio: 0.85, ivPercentile: 45, gammaBias: 'POSITIVE', optionVolume: 125000, maxPain: 448 },
        stats: { atr14: 3.2, rv20: 18.5, trendSlope: 0.65, rsi: 58, volume: 85000000, volumeRatio: 1.15 },
        liquidity: { spreadBps: 2.5, depthScore: 85, tradeVelocity: 'NORMAL', bidSize: 5000, askSize: 4800 },
        fetchTime: 245,
        completeness: 1.0,
        errors: []
      },
      timestamp: Date.now()
    };
    
    print('✅ Mock decision created', 'green');
    print(`   Action: ${mockDecision.action}`, 'cyan');
    print(`   Confidence: ${mockDecision.confidenceScore}%`, 'cyan');
    print(`   Size: ${mockDecision.finalSizeMultiplier}x`, 'cyan');
    
    // Step 1: Build paper trade inputs
    print('\n📝 Step 1: Building paper trade inputs...', 'cyan');
    const { signal, decision: paperDecision, recommendedContracts } = buildPaperTradeInputs(mockDecision);
    
    print('✅ Paper trade inputs built', 'green');
    print(`   Recommended Contracts: ${recommendedContracts}`, 'cyan');
    print(`   Signal Type: ${signal.signal.type}`, 'cyan');
    print(`   Symbol: ${signal.instrument.symbol}`, 'cyan');
    
    // Step 2: Execute paper trade
    print('\n🎲 Step 2: Executing paper trade...', 'cyan');
    const execution = executePaperTrade(signal, paperDecision);
    
    print('✅ Paper execution completed', 'green');
    print(`\n📈 Execution Details:`, 'bright');
    print(`   Option Type: ${execution.option_type}`, 'cyan');
    print(`   Strike: $${execution.strike}`, 'cyan');
    print(`   Expiry: ${execution.expiry}`, 'cyan');
    print(`   DTE: ${execution.dte}`, 'cyan');
    print(`   Contracts: ${execution.filled_contracts}`, 'cyan');
    print(`   Entry Price: $${execution.entry_price.toFixed(2)}`, 'cyan');
    print(`   Entry Delta: ${execution.entry_delta.toFixed(3)}`, 'cyan');
    print(`   Entry IV: ${(execution.entry_iv * 100).toFixed(1)}%`, 'cyan');
    print(`   Risk Amount: $${execution.risk_amount.toFixed(2)}`, 'cyan');
    print(`   Fill Quality: ${execution.fill_quality}`, 'cyan');
    print(`   Spread Cost: $${execution.spread_cost.toFixed(2)}`, 'yellow');
    print(`   Slippage: $${execution.slippage.toFixed(2)}`, 'yellow');
    print(`   Commission: $${execution.commission.toFixed(2)}`, 'yellow');
    
    // Step 3: Simulate exit
    print('\n🎯 Step 3: Simulating exit...', 'cyan');
    const exitData = simulatePaperExit(mockDecision, execution, signal);
    
    print('✅ Exit simulated', 'green');
    print(`\n💰 Exit Details:`, 'bright');
    print(`   Exit Price: $${exitData.exit_price.toFixed(2)}`, 'cyan');
    print(`   Exit Reason: ${exitData.exit_reason}`, exitData.exit_reason.includes('TARGET') ? 'green' : 'red');
    print(`   P&L Gross: $${exitData.pnl_gross.toFixed(2)}`, exitData.pnl_gross > 0 ? 'green' : 'red');
    print(`   P&L Net: $${exitData.pnl_net.toFixed(2)}`, exitData.pnl_net > 0 ? 'green' : 'red');
    print(`   Hold Time: ${Math.floor(exitData.hold_time_seconds / 60)}m ${exitData.hold_time_seconds % 60}s`, 'cyan');
    print(`\n   P&L Attribution:`, 'bright');
    print(`   Delta: $${exitData.pnl_from_delta.toFixed(2)}`, 'magenta');
    print(`   IV: $${exitData.pnl_from_iv.toFixed(2)}`, 'magenta');
    print(`   Theta: $${exitData.pnl_from_theta.toFixed(2)}`, 'magenta');
    print(`   Gamma: $${exitData.pnl_from_gamma.toFixed(2)}`, 'magenta');
    print(`\n   Costs:`, 'bright');
    print(`   Commission: $${exitData.total_commission.toFixed(2)}`, 'yellow');
    print(`   Spread: $${exitData.total_spread_cost.toFixed(2)}`, 'yellow');
    print(`   Slippage: $${exitData.total_slippage.toFixed(2)}`, 'yellow');
    
    // Step 4: Store in ledger
    print('\n💾 Step 4: Storing in ledger...', 'cyan');
    const ledger = await getGlobalLedger();
    const ledgerEntry = convertDecisionToLedgerEntryWithExecution(mockDecision, execution, recommendedContracts);
    
    const created = await ledger.append(ledgerEntry);
    print('✅ Ledger entry created', 'green');
    print(`   ID: ${created.id}`, 'cyan');
    
    // Update with exit
    await ledger.updateExit(created.id, exitData);
    print('✅ Exit data updated', 'green');
    
    // Verify
    const retrieved = await ledger.getById(created.id);
    print('\n🔍 Verification:', 'cyan');
    print(`   Has execution: ${retrieved?.execution ? '✅' : '❌'}`, retrieved?.execution ? 'green' : 'red');
    print(`   Has exit: ${retrieved?.exit ? '✅' : '❌'}`, retrieved?.exit ? 'green' : 'red');
    
    // Summary
    print('\n' + '='.repeat(80), 'cyan');
    print('Test Summary', 'bright');
    print('='.repeat(80), 'cyan');
    
    const checks = [
      { name: 'Paper trade inputs built', passed: !!signal },
      { name: 'Paper execution completed', passed: !!execution },
      { name: 'Exit simulated', passed: !!exitData },
      { name: 'Stored in ledger', passed: !!created },
      { name: 'Exit data updated', passed: !!retrieved?.exit }
    ];
    
    print('\n✓ Checks:', 'bright');
    checks.forEach(check => {
      print(`  ${check.passed ? '✅' : '❌'} ${check.name}`, check.passed ? 'green' : 'red');
    });
    
    const allPassed = checks.every(c => c.passed);
    
    if (allPassed) {
      print('\n🎉 SUCCESS! All paper execution components working!', 'green');
      print('   ✅ Decision → Execution → Exit → Ledger flow complete', 'green');
      return 0;
    } else {
      print('\n⚠️  PARTIAL SUCCESS: Some components failed', 'yellow');
      return 1;
    }
    
  } catch (error) {
    print(`\n❌ Test failed: ${error.message}`, 'red');
    console.error(error);
    return 1;
  }
}

testDirectPaperExecution()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
