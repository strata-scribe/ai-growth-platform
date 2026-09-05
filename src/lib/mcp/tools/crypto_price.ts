import { z } from 'zod';
import { McpToolResponse } from '../validation';

export const CryptoPriceFeedInputSchema = z.object({
  tokens: z.array(z.string()).min(1, "At least one token is required").describe("List of token IDs to fetch prices for (e.g., ['bitcoin', 'ethereum'])")
}).strict();

export const cryptoPriceFeedTool = {
  name: 'crypto-price-feed',
  description: 'Provides real-time token prices, 24h volume, and market cap.',
  inputSchema: CryptoPriceFeedInputSchema
};

export async function getCryptoPrices(input: unknown): Promise<McpToolResponse> {
  let parsedInput;
  try {
    parsedInput = CryptoPriceFeedInputSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        content: [{ type: "text", text: `Validation Error: ${error.message}` }],
        isError: true
      };
    }
    throw error;
  }

  try {
    const tokensParam = parsedInput.tokens.join(',');
    const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${tokensParam}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true`;

    const response = await fetch(apiUrl);

    if (response.status === 429) {
       return {
        content: [{ type: "text", text: "Rate limit exceeded. Please try again later." }],
        isError: true
      };
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch crypto prices: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : "Unknown error occurred while fetching crypto prices"
        }
      ],
      isError: true
    };
  }
}
