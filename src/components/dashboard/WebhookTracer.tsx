'use client';

import { useCallback, useEffect, useState } from 'react';

interface WebhookTrace {
  id: string;
  received_at: number;
  kind: 'signals' | 'trend' | 'saty-phase';
  ticker?: string;
  symbol?: string;
  
  // Stage 1: Receipt
  receipt: {
    status: 'success' | 'failed';
    http_status: number;
    ip?: string;
    message?: string;
  };
  
  // Stage 2: Validation
  validation?: {
    status: 'passed' | 'failed';
    errors?: string[];
    payload_valid: boolean;
  };
  
  // Stage 3: Routing
  routing?: {
    status: 'success' | 'failed';
    source_detected?: string;
    endpoint_correct: boolean;
    error?: string;
  };
  
  // Stage 4: Context Update
  context_update?: {
    status: 'success' | 'failed';
    context_complete: boolean;
    waiting_for?: string[];
    error?: string;
  };
  
  // Stage 5: Decision
  decision?: {
    status: '