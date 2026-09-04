import { z } from 'zod';

export const McpToolRequestSchema = z.object({
  name: z.string(),
  input: z.record(z.string(), z.unknown()).optional().default({}),
});

export const GetCryptoPricesInputSchema = z.object({}).strict();

export const AnalyzeWalletInputSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
}).strict();

export const DiscoverAgentsInputSchema = z.object({
  protocol: z.string()
}).strict();

export const GetMarketSignalInputSchema = z.object({
  tokens: z.array(z.string())
}).strict();

export const RunInferenceInputSchema = z.object({
  prompt: z.string(),
  max_tokens: z.number().int().positive().optional()
}).strict();

export const ToolSchemas: Record<string, z.ZodTypeAny> = {
  get_crypto_prices: GetCryptoPricesInputSchema,
  analyze_wallet: AnalyzeWalletInputSchema,
  discover_agents: DiscoverAgentsInputSchema,
  get_market_signal: GetMarketSignalInputSchema,
  run_inference: RunInferenceInputSchema,
};

export const McpToolResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string()
    })
  ),
  isError: z.boolean().optional()
});

export type McpToolRequest = z.infer<typeof McpToolRequestSchema>;
export type McpToolResponse = z.infer<typeof McpToolResponseSchema>;

/**
 * Validates an MCP tool request.
 * @param request The raw request body
 * @returns The validated tool call containing name and type-safe input
 * @throws Error if validation fails
 */
export function validateMcpToolRequest(request: unknown) {
  const parsedRequest = McpToolRequestSchema.safeParse(request);

  if (!parsedRequest.success) {
    throw new Error(`Invalid MCP tool request format: ${parsedRequest.error.message}`);
  }

  const { name, input } = parsedRequest.data;

  const schema = ToolSchemas[name];

  if (!schema) {
    throw new Error(`Unknown MCP tool: ${name}`);
  }

  const parsedInput = schema.safeParse(input);

  if (!parsedInput.success) {
    throw new Error(`Invalid input for tool ${name}: ${parsedInput.error.message}`);
  }

  return {
    name,
    input: parsedInput.data
  };
}

/**
 * Validates an MCP tool response.
 * @param response The raw response body
 * @returns The validated response
 * @throws Error if validation fails
 */
export function validateMcpToolResponse(response: unknown) {
  const parsedResponse = McpToolResponseSchema.safeParse(response);

  if (!parsedResponse.success) {
    throw new Error(`Invalid MCP tool response format: ${parsedResponse.error.message}`);
  }

  return parsedResponse.data;
}

/**
 * Request validation middleware helper.
 */
export function mcpRequestMiddleware(requestBody: unknown) {
  try {
    const validated = validateMcpToolRequest(requestBody);
    return { success: true, data: validated };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Response validation middleware helper.
 */
export function mcpResponseMiddleware(responseBody: unknown) {
  try {
    const validated = validateMcpToolResponse(responseBody);
    return { success: true, data: validated };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
