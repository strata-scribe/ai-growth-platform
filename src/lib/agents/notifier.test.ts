import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PriceChangeNotifier } from './notifier';

describe('PriceChangeNotifier', () => {
  let notifier: PriceChangeNotifier;
  let fetchMock: any;

  beforeEach(() => {
    notifier = new PriceChangeNotifier();

    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    global.fetch = fetchMock;

    // Mock Date.now to ensure predictable timestamps
    vi.spyOn(Date, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should subscribe and unsubscribe webhooks', () => {
    const url1 = 'https://example.com/webhook1';
    const url2 = 'https://example.com/webhook2';

    expect(notifier.getSubscribers()).toHaveLength(0);

    notifier.subscribe(url1);
    notifier.subscribe(url2);
    expect(notifier.getSubscribers()).toEqual([url1, url2]);

    // Should not add duplicates
    notifier.subscribe(url1);
    expect(notifier.getSubscribers()).toEqual([url1, url2]);

    notifier.unsubscribe(url1);
    expect(notifier.getSubscribers()).toEqual([url2]);
  });

  it('should notify all subscribed webhooks of a price change', async () => {
    const url1 = 'https://example.com/webhook1';
    const url2 = 'https://example.com/webhook2';

    notifier.subscribe(url1);
    notifier.subscribe(url2);

    await notifier.notifyPriceChange('test-service', 1.0, 1.5);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const expectedPayload = JSON.stringify({
      serviceSlug: 'test-service',
      oldPrice: 1.0,
      newPrice: 1.5,
      timestamp: 1000,
    });

    const expectedOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: expectedPayload,
    };

    expect(fetchMock).toHaveBeenCalledWith(url1, expectedOptions);
    expect(fetchMock).toHaveBeenCalledWith(url2, expectedOptions);
  });

  it('should handle fetch errors gracefully without throwing', async () => {
    const url1 = 'https://example.com/webhook1';
    const url2 = 'https://example.com/webhook2'; // This one will throw

    notifier.subscribe(url1);
    notifier.subscribe(url2);

    // Mock first fetch to succeed, second to fail
    fetchMock.mockImplementationOnce(() => Promise.resolve({ ok: true, status: 200 }));
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

    // Also spy on console.error to prevent test output noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Should not throw
    await notifier.notifyPriceChange('test-service', 1.0, 1.5);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalledWith(`Failed to dispatch webhook to ${url2}:`, expect.any(Error));
  });

  it('should handle non-ok responses gracefully', async () => {
    const url = 'https://example.com/webhook';

    notifier.subscribe(url);

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Should not throw
    await notifier.notifyPriceChange('test-service', 1.0, 1.5);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(`Webhook dispatch to ${url} failed with status: 500`);
  });
});
