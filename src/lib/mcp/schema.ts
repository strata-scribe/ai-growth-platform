import { z } from 'zod';

export const ToolDescriptorSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.object({
    type: z.literal('object'),
    properties: z.record(z.any()).optional(),
    required: z.array(z.string()).optional(),
  }).catchall(z.any()),
});

export const ServerManifestSchema = z.object({
  mcpServers: z.record(
    z.string(),
    z.union([
      z.object({
        command: z.string(),
        args: z.array(z.string()).optional(),
        env: z.record(z.string()).optional(),
      }),
      z.object({
        url: z.string().url(),
      })
    ])
  ),
});
