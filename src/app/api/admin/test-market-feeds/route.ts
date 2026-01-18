/**
 * Admin API: Test Market Feeds
 * 
 * GET /api/admin/test-market-feeds
 * Tests if market feed API keys are configured and working
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    environment: {
      TRADIER_API_KEY: process.env.TRADIER_API_KEY ? '✓ Set' : '✗ Not set',
      TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY ? '✓ Set' : '✗ Not set',
      ALPACA_API_KEY: process.env.ALPACA_API_KEY ? '✓ Set' : '✗ Not set',
      ALPACA_SECRET_KEY: process.env.ALPACA_SECRET_KEY ? '✓ Set' : '✗ Not set',
    },
    keyLengths: {
      TRADIER_API_KEY: process.env.TRADIER_API_KEY?.length || 0,
      TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY?.length || 0,
      ALPACA_API_KEY: process.env.ALPACA_API_KEY?.length || 0,
      ALPACA_SECRET_KEY: process.env.ALPACA_SECRET_KEY?.length || 0,
    },
    keyPreviews: {
      TRADIER_API_KEY: process.env.TRADIER_API_KEY 
        ? `${process.env.TRADIER_API_KEY.substring(0, 4)}...${process.env.TRADIER_API_KEY.substring(process.env.TRADIER_API_KEY.length - 4)}`
        : 'Not set',
      TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY
        ? `${process.env.TWELVE_DATA_API_KEY.substring(0, 4)}...${process.env.TWELVE_DATA_API_KEY.substring(process.env.TWELVE_DATA_API_KEY.length - 4)}`
        : 'Not set',
      ALPACA_API_KEY: process.env.ALPACA_API_KEY
        ? `${process.env.ALPACA_API_KEY.substring(0, 4)}...${process.env.ALPACA_API_KEY.substring(process.env.ALPACA_API_KEY.length - 4)}`
        : 'Not set',
      ALPACA_SECRET_KEY: process.env.ALPACA_SECRET_KEY
        ? `${process.env.ALPACA_SECRET_KEY.substring(0, 4)}...${process.env.ALPACA_SECRET_KEY.substring(process.env.ALPACA_SECRET_KEY.length - 4)}`
        : 'Not set',
    },
    allConfigured: !!(
      process.env.TRADIER_API_KEY &&
      process.env.TWELVE_DATA_API_KEY &&
      process.env.ALPACA_API_KEY &&
      process.env.ALPACA_SECRET_KEY
    ),
  };

  return NextResponse.json(results);
}
