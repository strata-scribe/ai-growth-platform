import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const CapabilitiesSchema = z.array(z.string()).min(1);

const AgentRegisterParamsSchema = z.object({
  agent_id: z.string(),
  name: z.string(),
  endpoint: z.string().url(),
  protocol: z.string(),
  capabilities: CapabilitiesSchema,
});

const AgentRegisterRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.literal('agent/register'),
  params: AgentRegisterParamsSchema,
});

const AgentQueryParamsSchema = z.object({
  query: z.string(),
  capabilities: z.array(z.string()).optional(),
}).passthrough(); // allows other fields as well for querying

const AgentQueryRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.literal('agent/query'),
  params: AgentQueryParamsSchema,
});

describe('Google A2A Protocol JSON-RPC 2.0 Schemas', () => {
  describe('agent/register schema', () => {
    it('should validate a correct agent/register payload', () => {
      const payload = {
        jsonrpc: '2.0',
        id: 'test-123',
        method: 'agent/register',
        params: {
          agent_id: 'your-unique-agent-id',
          name: 'Your Agent Name',
          endpoint: 'https://your-agent.example.com/a2a',
          protocol: 'a2a',
          capabilities: ['inference', 'data', 'oracle'],
        },
      };

      const result = AgentRegisterRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should invalidate if jsonrpc is missing or wrong', () => {
      const payload = {
        id: 'test-123',
        method: 'agent/register',
        params: {
          agent_id: 'your-unique-agent-id',
          name: 'Your Agent Name',
          endpoint: 'https://your-agent.example.com/a2a',
          protocol: 'a2a',
          capabilities: ['inference'],
        },
      };

      const result = AgentRegisterRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);

      const payloadWrong = { ...payload, jsonrpc: '1.0' };
      expect(AgentRegisterRequestSchema.safeParse(payloadWrong).success).toBe(false);
    });

    it('should invalidate if capabilities array is empty', () => {
      const payload = {
        jsonrpc: '2.0',
        method: 'agent/register',
        params: {
          agent_id: 'your-unique-agent-id',
          name: 'Your Agent Name',
          endpoint: 'https://your-agent.example.com/a2a',
          protocol: 'a2a',
          capabilities: [], // empty capabilities
        },
      };

      const result = AgentRegisterRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['params', 'capabilities']);
      }
    });

    it('should invalidate if endpoint is not a valid URL', () => {
      const payload = {
        jsonrpc: '2.0',
        method: 'agent/register',
        params: {
          agent_id: 'your-unique-agent-id',
          name: 'Your Agent Name',
          endpoint: 'invalid-url',
          protocol: 'a2a',
          capabilities: ['inference'],
        },
      };
      const result = AgentRegisterRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('agent/query schema', () => {
    it('should validate a correct agent/query payload', () => {
      const payload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'agent/query',
        params: {
          query: 'Find agents that do data analysis',
          capabilities: ['data'],
        },
      };

      const result = AgentQueryRequestSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should invalidate if query param is missing', () => {
      const payload = {
        jsonrpc: '2.0',
        method: 'agent/query',
        params: {
          capabilities: ['data'],
        },
      };

      const result = AgentQueryRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
