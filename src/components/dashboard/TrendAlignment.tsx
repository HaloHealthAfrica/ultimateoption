'use client';

import React, { useState, useEffect } from 'react';

interface TimeframeData {
  timeframe: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  open: number;
  close: number;
}

interface TrendData {
  ticker: string;
  exchange: string;
  price: number;
  timeframes: TimeframeData[];
  alignment_score: number;
  strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'CHOPPY';
  htf_bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  ltf_bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  dominant_direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  dominant_count: number;
  last_updated: string;
}

export default function TrendAlignment() {
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticker, setTicker] = useState('SPY');

  const fetchTrendData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/trend/current?ticker=${ticker}`);
      
      if (response.status === 404) {
        setTrendData(null);
        setError(`No trend data available for ${ticker}`);
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch trend data: ${response.statusText}`);
      }
      
      const data = await response.json();
      setTrendData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTrendData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendData();
    const interval = setInterval(fetchTrendData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [ticker]);

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case 'BULLISH': return 'text-green-600 bg-green-50';
      case 'BEARISH': return 'text-red-600 bg-red-50';
      case 'NEUTRAL': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'STRONG': return 'text-green-700 bg-green-100';
      case 'MODERATE': return 'text-blue-700 bg-blue-100';
      case 'WEAK': return 'text-yellow-700 bg-yellow-100';
      case 'CHOPPY': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getAlignmentColor = (score: number) => {
    if (score >= 75) return 'text-green-600';
    if (score >= 62.5) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'BULLISH': return '↗';
      case 'BEARISH': return '↘';
      case 'NEUTRAL': return '→';
      default: return '?';
    }
  };

  const calculatePercentChange = (open: number, close: number) => {
    if (open === 0) return 0;
    return ((close - open) / open) * 100;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Trend Alignment</h2>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Trend Alignment</h2>
        <div className="text-red-600 bg-red-50 p-4 rounded">
          {error}
        </div>
        <button 
          onClick={fetchTrendData}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Trend Alignment</h2>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            className="px-3 py-1 border rounded text-sm w-20"
            placeholder="Ticker"
          />
          <button 
            onClick={fetchTrendData}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>
      </div>

      {trendData ? (
        <div>
          {/* Overall Alignment Status */}
          <div className="mb-6 p-4 bg-gray-50 rounded">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center space-x-3">
                <span className="font-medium">Overall Alignment:</span>
                <span className={`text-2xl font-bold ${getAlignmentColor(trendData.alignment_score)}`}>
                  {trendData.alignment_score.toFixed(1)}%
                </span>
                <span className={`px-2 py-1 rounded text-sm font-medium ${getStrengthColor(trendData.strength)}`}>
                  {trendData.strength}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {trendData.dominant_count}/8 timeframes {trendData.dominant_direction.toLowerCase()}
              </div>
            </div>
            
            <div className="flex justify-between text-sm">
              <div>
                <span className="text-gray-600">HTF Bias:</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs ${getDirectionColor(trendData.htf_bias)}`}>
                  {getDirectionIcon(trendData.htf_bias)} {trendData.htf_bias}
                </span>
              </div>
              <div>
                <span className="text-gray-600">LTF Bias:</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs ${getDirectionColor(trendData.ltf_bias)}`}>
                  {getDirectionIcon(trendData.ltf_bias)} {trendData.ltf_bias}
                </span>
              </div>
              <div className="text-gray-600">
                Price: ${trendData.price.toFixed(2)}
              </div>
            </div>
          </div>

          {/* 8-Timeframe Grid */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">8-Timeframe Breakdown</h3>
            <div className="grid grid-cols-4 gap-2">
              {trendData.timeframes.map((tf) => {
                const percentChange = calculatePercentChange(tf.open, tf.close);
                return (
                  <div key={tf.timeframe} className="border rounded p-2 text-center">
                    <div className="text-xs font-mono text-gray-600 mb-1">
                      {tf.timeframe}
                    </div>
                    <div className={`text-lg font-bold ${getDirectionColor(tf.direction).split(' ')[0]}`}>
                      {getDirectionIcon(tf.direction)}
                    </div>
                    <div className={`text-xs ${percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bias Comparison */}
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <h3 className="text-sm font-medium text-gray-700 mb-2">HTF vs LTF Comparison</h3>
            <div className="flex justify-between items-center">
              <div className="text-center">
                <div className="text-xs text-gray-600">Higher Timeframe (4H)</div>
                <div className={`text-lg font-semibold ${getDirectionColor(trendData.htf_bias).split(' ')[0]}`}>
                  {getDirectionIcon(trendData.htf_bias)} {trendData.htf_bias}
                </div>
              </div>
              
              <div className="text-center">
                <div className={`px-3 py-1 rounded text-sm font-medium ${
                  trendData.htf_bias === trendData.ltf_bias 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {trendData.htf_bias === trendData.ltf_bias ? 'ALIGNED' : 'DIVERGENT'}
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-xs text-gray-600">Lower Timeframe (3M/5M)</div>
                <div className={`text-lg font-semibold ${getDirectionColor(trendData.ltf_bias).split(' ')[0]}`}>
                  {getDirectionIcon(trendData.ltf_bias)} {trendData.ltf_bias}
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Last updated: {new Date(trendData.last_updated).toLocaleTimeString()}
          </div>
        </div>
      ) : (
        <div className="text-gray-500 text-center py-8">
          No trend data available for {ticker}
        </div>
      )}
    </div>
  );
}