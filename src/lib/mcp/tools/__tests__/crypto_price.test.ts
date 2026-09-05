import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCryptoPrices, cryptoPriceFeedTool, CryptoPriceFeedInputSchema } from '../crypto_price';

describe('crypto-price-feed tool', () => {
  const mockApiResponse = {
    bitcoin: {
      usd: 50000,
      usd_market_cap: 1000000000000,
      usd_24h_vol: 50000000000
    },
    ethereum: {
      usd: 3000,
      usd_market_cap: 350000000000,
      usd_24h_vol: 20000000000
    }
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should export the correct tool definition', () => {
    expect(cryptoPriceFeedTool.name).toBe('crypto-price-feed');
    expect(cryptoPriceFeedTool.description).toBeDefined();
    expect(cryptoPriceFeedTool.inputSchema).toBe(CryptoPriceFeedInputSchema);
  });

  it('should successfully fetch and return crypto prices for specified tokens', async () => {
    // Mock successful fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockApiResponse)
    });

    const response = await getCryptoPrices({ tokens: ['bitcoin', 'ethereum'] });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true'
    );
    expect(response.isError).toBeUndefined();
    expect(response.content).toHaveLength(1);
    expect(response.content[0].type).toBe('text');

    const parsedData = JSON.parse(response.content[0].text);
    expect(parsedData).toEqual(mockApiResponse);
  });

  it('should handle rate limits (429) gracefully', async () => {
    // Mock 429 fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429
    });

    const response = await getCryptoPrices({ tokens: ['bitcoin'] });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Rate limit exceeded');
  });

  it('should handle fetch errors gracefully', async () => {
    // Mock failed fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    const response = await getCryptoPrices({ tokens: ['bitcoin'] });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('Failed to fetch crypto prices: Internal Server Error');
  });

  it('should return validation error when tokens are missing or invalid', async () => {
    // Empty tokens array
    const responseEmpty = await getCryptoPrices({ tokens: [] });
    expect(responseEmpty.isError).toBe(true);
    expect(responseEmpty.content[0].text).toContain('Validation Error');

    // Missing tokens
    const responseMissing = await getCryptoPrices({});
    expect(responseMissing.isError).toBe(true);
    expect(responseMissing.content[0].text).toContain('Validation Error');

    // Invalid type
    const responseInvalidType = await getCryptoPrices({ tokens: "bitcoin" });
    expect(responseInvalidType.isError).toBe(true);
    expect(responseInvalidType.content[0].text).toContain('Validation Error');
  });
});
