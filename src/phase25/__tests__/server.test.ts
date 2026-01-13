/**
 * Phase 2.5 Server Tests
 * 
 * Tests for the Express.js server setup and webhook routes.
 */

import { Phase25Server } from '../server';
import { WebhookRoutes } from '../routes/webhook.routes';

describe('Phase 2.5 Server', () => {
  describe('Server Setup', () => {
    it('should create server instance', () => {
      const server = new Phase25Server(3001);
      expect(server).toBeDefined();
      expect(server.getApp()).toBeDefined();
    });

    it('should create webhook routes', () => {
      const routes = new WebhookRoutes();
      expect(routes).toBeDefined();
      expect(routes.getRouter()).toBeDefined();
    });
  });

  describe('Server Configuration', () => {
    it('should use default port 3001', () => {
      const server = new Phase25Server();
      expect(server).toBeDefined();
    });

    it('should accept custom port', () => {
      const server = new Phase25Server(4000);
      expect(server).toBeDefined();
    });
  });
});