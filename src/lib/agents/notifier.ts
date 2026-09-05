export interface PriceChangeEvent {
  serviceSlug: string;
  oldPrice: number;
  newPrice: number;
  timestamp: number;
}

export class PriceChangeNotifier {
  private webhooks: Set<string>;

  constructor() {
    this.webhooks = new Set<string>();
  }

  /**
   * Subscribes a webhook URL to receive price change notifications.
   * @param url The webhook URL to subscribe.
   */
  public subscribe(url: string): void {
    this.webhooks.add(url);
  }

  /**
   * Unsubscribes a webhook URL.
   * @param url The webhook URL to unsubscribe.
   */
  public unsubscribe(url: string): void {
    this.webhooks.delete(url);
  }

  /**
   * Returns a list of all subscribed webhooks.
   */
  public getSubscribers(): string[] {
    return Array.from(this.webhooks);
  }

  /**
   * Notifies all subscribed webhooks about a price change.
   * @param serviceSlug The slug of the service whose price changed.
   * @param oldPrice The old price in USDC.
   * @param newPrice The new price in USDC.
   */
  public async notifyPriceChange(serviceSlug: string, oldPrice: number, newPrice: number): Promise<void> {
    const event: PriceChangeEvent = {
      serviceSlug,
      oldPrice,
      newPrice,
      timestamp: Date.now(),
    };

    const notifications = Array.from(this.webhooks).map(async (url) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });

        if (!response.ok) {
          console.warn(`Webhook dispatch to ${url} failed with status: ${response.status}`);
        }
      } catch (error) {
        console.error(`Failed to dispatch webhook to ${url}:`, error);
      }
    });

    await Promise.allSettled(notifications);
  }
}

// Export a singleton instance
export const notifier = new PriceChangeNotifier();
