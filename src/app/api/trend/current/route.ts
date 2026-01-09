/**
 * Trend Current API
 * 
 * GET endpoint for retrieving current trend alignment data.
 * Returns trend data and alignment metrics for the specified ticker.
 * 
 * Requirements: 26.2, 26.4, 26.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { TrendStore } from '@/trend/storage/trendStore';

/**
 * GET /api/trend/current?ticker=SPY
 * 
 * Returns trend data and alignment metrics for the specified ticker.
 * Defaults to SPY if no ticker provided.
 * Returns 404 if no trend data exists.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker') || 'SPY';
    
    // Get trend data from trend store
    const trendStore = TrendStore.getInstance();
    const trend = trendStore.getTrend(ticker);
    
    if (!trend) {
      // Return empty state instead of 404 for better UX
      return NextResponse.json({
        ticker,
        exchange: 'NASDAQ',
        price: 0,
        timestamp: new Date().toISOString(),
        timeframes: {
          tf3min: { direction: 'neutral', open: 0, close: 0 },
          tf5min: { direction: 'neutral', open: 0, close: 0 },
          tf15min: { direction: 'neutral', open: 0, close: 0 },
          tf30min: { direction: 'neutral', open: 0, close: 0 },
          tf60min: { direction: 'neutral', open: 0, close: 0 },
          tf240min: { direction: 'neutral', open: 0, close: 0 },
          tf1week: { direction: 'neutral', open: 0, close: 0 },
          tf1month: { direction: 'neutral', open: 0, close: 0 },
        },
        alignment: {
          score: 0,
          strength: 'CHOPPY',
          dominant_trend: 'neutral',
          counts: {
            bullish: 0,
            bearish: 0,
            neutral: 8,
          },
          bias: {
            htf_bias: 'neutral',
            ltf_bias: 'neutral',
          },
        },
        storage: {
          ttl_minutes: 60,
          active_tickers: trendStore.getActiveTickerCount(),
          last_update: trendStore.getLastUpdateTime(),
        },
        retrieved_at: Date.now(),
        no_data: true,
        message: `No active trend data for ${ticker}. Send trend webhook to populate.`,
      });
    }
    
    // Get alignment metrics
    const alignment = trendStore.getAlignment(ticker);
    
    if (!alignment) {
      return NextResponse.json(
        { 
          error: 'Unable to calculate alignment',
          ticker,
          message: 'Trend data exists but alignment calculation failed',
        },
        { status: 500 }
      );
    }
    
    // Format response with all 8 timeframe directions and alignment metrics
    const response = {
      ticker: trend.ticker,
      exchange: trend.exchange,
      price: trend.price,
      timestamp: trend.timestamp,
      timeframes: {
        tf3min: {
          direction: trend.timeframes.tf3min.direction,
          open: trend.timeframes.tf3min.open,
          close: trend.timeframes.tf3min.close,
        },
        tf5min: {
          direction: trend.timeframes.tf5min.direction,
          open: trend.timeframes.tf5min.open,
          close: trend.timeframes.tf5min.close,
        },
        tf15min: {
          direction: trend.timeframes.tf15min.direction,
          open: trend.timeframes.tf15min.open,
          close: trend.timeframes.tf15min.close,
        },
        tf30min: {
          direction: trend.timeframes.tf30min.direction,
          open: trend.timeframes.tf30min.open,
          close: trend.timeframes.tf30min.close,
        },
        tf60min: {
          direction: trend.timeframes.tf60min.direction,
          open: trend.timeframes.tf60min.open,
          close: trend.timeframes.tf60min.close,
        },
        tf240min: {
          direction: trend.timeframes.tf240min.direction,
          open: trend.timeframes.tf240min.open,
          close: trend.timeframes.tf240min.close,
        },
        tf1week: {
          direction: trend.timeframes.tf1week.direction,
          open: trend.timeframes.tf1week.open,
          close: trend.timeframes.tf1week.close,
        },
        tf1month: {
          direction: trend.timeframes.tf1month.direction,
          open: trend.timeframes.tf1month.open,
          close: trend.timeframes.tf1month.close,
        },
      },
      alignment: {
        score: alignment.alignment_score,
        strength: alignment.strength,
        dominant_trend: alignment.dominant_trend,
        counts: {
          bullish: alignment.bullish_count,
          bearish: alignment.bearish_count,
          neutral: alignment.neutral_count,
        },
        bias: {
          htf_bias: alignment.htf_bias,  // 4H timeframe
          ltf_bias: alignment.ltf_bias,  // 3M/5M average
        },
      },
      storage: {
        ttl_minutes: 60,
        active_tickers: trendStore.getActiveTickerCount(),
        last_update: trendStore.getLastUpdateTime(),
      },
      retrieved_at: Date.now(),
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in GET /api/trend/current:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Block other methods
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to retrieve trend data.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to retrieve trend data.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET to retrieve trend data.' },
    { status: 405 }
  );
}