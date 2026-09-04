import { describe, it, expect } from 'vitest';
import {
  mcpRequestMiddleware,
  mcpResponseMiddleware,
} from '../validation';

describe('MCP Validation Middleware', () => {

  describe('mcpRequestMiddleware', () => {

    it('should validate get_crypto_prices correctly', () => {
      // Valid
      const req = { name: 'get_crypto_prices', input: {} };
      const res = mcpRequestMiddleware(req);
      expect(res.success).toBe(true);

      // Invalid: extra properties
      const reqInvalid = { name: 'get_crypto_prices', input: { extra: true } };
      const resInvalid = mcpRequestMiddleware(reqInvalid);
      expect(resInvalid.success).toBe(false);
      if (!resInvalid.success) {
        expect(resInvalid.error).toContain('Invalid input for tool get_crypto_prices');
      }
    });

    it('should validate analyze_wallet correctly', () => {
      // Valid
      const req = { name: 'analyze_wallet', input: { address: '0xb438d36b425b504724a1c72aa0941c80cb940995' } };
      const res = mcpRequestMiddleware(req);
      expect(res.success).toBe(true);

      // Invalid: wrong address format
      const reqInvalid = { name: 'analyze_wallet', input: { address: 'not-an-address' } };
      const resInvalid = mcpRequestMiddleware(reqInvalid);
      expect(resInvalid.success).toBe(false);

      // Invalid: missing address
      const reqInvalid2 = { name: 'analyze_wallet', input: {} };
      const resInvalid2 = mcpRequestMiddleware(reqInvalid2);
      expect(resInvalid2.success).toBe(false);
    });

    it('should validate discover_agents correctly', () => {
      // Valid
      const req = { name: 'discover_agents', input: { protocol: 'a2a' } };
      const res = mcpRequestMiddleware(req);
      expect(res.success).toBe(true);

      // Invalid: missing protocol
      const reqInvalid = { name: 'discover_agents', input: {} };
      const resInvalid = mcpRequestMiddleware(reqInvalid);
      expect(resInvalid.success).toBe(false);
    });

    it('should validate get_market_signal correctly', () => {
      // Valid
      const req = { name: 'get_market_signal', input: { tokens: ['BTC', 'ETH'] } };
      const res = mcpRequestMiddleware(req);
      expect(res.success).toBe(true);

      // Invalid: missing tokens array
      const reqInvalid = { name: 'get_market_signal', input: {} };
      const resInvalid = mcpRequestMiddleware(reqInvalid);
      expect(resInvalid.success).toBe(false);

      // Invalid: wrong type inside array
      const reqInvalid2 = { name: 'get_market_signal', input: { tokens: [1, 2] } };
      const resInvalid2 = mcpRequestMiddleware(reqInvalid2);
      expect(resInvalid2.success).toBe(false);
    });

    it('should validate run_inference correctly', () => {
      // Valid (minimal)
      const req = { name: 'run_inference', input: { prompt: 'Summarize' } };
      const res = mcpRequestMiddleware(req);
      expect(res.success).toBe(true);

      // Valid (with max_tokens)
      const req2 = { name: 'run_inference', input: { prompt: 'Summarize', max_tokens: 256 } };
      const res2 = mcpRequestMiddleware(req2);
      expect(res2.success).toBe(true);

      // Invalid: missing prompt
      const reqInvalid = { name: 'run_inference', input: { max_tokens: 256 } };
      const resInvalid = mcpRequestMiddleware(reqInvalid);
      expect(resInvalid.success).toBe(false);

      // Invalid: negative max_tokens
      const reqInvalid2 = { name: 'run_inference', input: { prompt: 'Test', max_tokens: -10 } };
      const resInvalid2 = mcpRequestMiddleware(reqInvalid2);
      expect(resInvalid2.success).toBe(false);
    });

    it('should reject unknown tool names', () => {
      const req = { name: 'unknown_tool', input: {} };
      const res = mcpRequestMiddleware(req);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Unknown MCP tool: unknown_tool');
      }
    });

    it('should reject malformed root request', () => {
      // missing name
      const req = { input: {} };
      const res = mcpRequestMiddleware(req);
      expect(res.success).toBe(false);
    });

  });

  describe('mcpResponseMiddleware', () => {

    it('should validate correctly formatted response', () => {
      const validResp = {
        content: [
          { type: 'text', text: 'Some text content' }
        ]
      };
      const res = mcpResponseMiddleware(validResp);
      expect(res.success).toBe(true);

      const validRespWithError = {
        content: [
          { type: 'text', text: 'Error happened' }
        ],
        isError: true
      };
      const res2 = mcpResponseMiddleware(validRespWithError);
      expect(res2.success).toBe(true);
    });

    it('should reject invalid response format', () => {
      // Missing content
      const resInvalid1 = mcpResponseMiddleware({});
      expect(resInvalid1.success).toBe(false);

      // Wrong type in content array
      const resInvalid2 = mcpResponseMiddleware({
        content: [
          { type: 'image', text: '...' } // Must be literal "text"
        ]
      });
      expect(resInvalid2.success).toBe(false);

      // Not an array
      const resInvalid3 = mcpResponseMiddleware({
        content: { type: 'text', text: 'Some text content' }
      });
      expect(resInvalid3.success).toBe(false);
    });

  });

});
