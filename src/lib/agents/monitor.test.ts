import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentMonitor, MetricDataPoint, AlertThresholds } from './monitor';

describe('AgentMonitor', () => {
  let monitor: AgentMonitor;
  let alertCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    alertCallback = vi.fn();
    // Default window is 60 seconds (60000 ms)
    monitor = new AgentMonitor(60000, alertCallback);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rolling window metrics tracking', () => {
    it('calculates p50, p95, p99 and error rates accurately', () => {
      // 100 requests to make percentile calculation straightforward
      for (let i = 1; i <= 100; i++) {
        // Record latency equal to 'i', error true if i <= 10 (10% error rate)
        monitor.recordRequest('serviceA', i, i <= 10, Date.now());
      }

      const metrics = monitor.getMetrics('serviceA', Date.now());

      expect(metrics).not.toBeNull();
      expect(metrics?.totalRequests).toBe(100);
      expect(metrics?.p50).toBe(50);
      expect(metrics?.p95).toBe(95);
      expect(metrics?.p99).toBe(99);
      expect(metrics?.errorRate).toBe(0.1);
    });

    it('cleans up old data outside the rolling window', () => {
      // Add a request now
      monitor.recordRequest('serviceB', 100, false, Date.now());

      let metrics = monitor.getMetrics('serviceB', Date.now());
      expect(metrics?.totalRequests).toBe(1);

      // Advance time by 30 seconds
      vi.advanceTimersByTime(30000);
      monitor.recordRequest('serviceB', 200, true, Date.now());

      metrics = monitor.getMetrics('serviceB', Date.now());
      expect(metrics?.totalRequests).toBe(2);

      // Advance time by another 35 seconds (total 65s, first request should fall off)
      vi.advanceTimersByTime(35000);

      metrics = monitor.getMetrics('serviceB', Date.now());
      expect(metrics?.totalRequests).toBe(1);
      expect(metrics?.errorRate).toBe(1.0); // Only the error request remains
      expect(metrics?.p50).toBe(200);
    });

    it('returns null if there is no data or all data is expired', () => {
      monitor.recordRequest('serviceC', 100, false, Date.now());
      vi.advanceTimersByTime(65000); // Wait longer than 60s window

      const metrics = monitor.getMetrics('serviceC', Date.now());
      expect(metrics).toBeNull();
    });
  });

  describe('Alerting logic', () => {
    it('triggers an alert when error rate threshold is exceeded', () => {
      monitor.setThresholds('serviceD', { errorRate: 0.5 });

      monitor.recordRequest('serviceD', 100, false, Date.now()); // error rate 0
      expect(alertCallback).not.toHaveBeenCalled();

      monitor.recordRequest('serviceD', 100, true, Date.now()); // error rate 0.5
      expect(alertCallback).toHaveBeenCalledWith('serviceD', 'errorRate', 0.5, 0.5);

      alertCallback.mockClear();
      monitor.recordRequest('serviceD', 100, true, Date.now()); // error rate 0.66
      expect(alertCallback).toHaveBeenCalledWith('serviceD', 'errorRate', 2/3, 0.5);
    });

    it('triggers an alert when p95 latency threshold is exceeded', () => {
      monitor.setThresholds('serviceE', { p95: 500 });

      for (let i = 1; i <= 94; i++) {
        monitor.recordRequest('serviceE', 100, false, Date.now());
      }
      expect(alertCallback).not.toHaveBeenCalled();

      // This makes p95 = 600 which is > 500
      for (let i = 1; i <= 6; i++) {
        monitor.recordRequest('serviceE', 600, false, Date.now());
      }
      expect(alertCallback).toHaveBeenCalledWith('serviceE', 'p95', 600, 500);
    });

    it('does not trigger alerts for other metrics if they are below threshold', () => {
      monitor.setThresholds('serviceF', { p99: 1000, errorRate: 0.1 });

      for (let i = 1; i <= 98; i++) {
        monitor.recordRequest('serviceF', 50, false, Date.now());
      }
      monitor.recordRequest('serviceF', 800, false, Date.now()); // 99th is 800
      monitor.recordRequest('serviceF', 800, false, Date.now()); // 100th is 800

      expect(alertCallback).not.toHaveBeenCalled();
    });
  });
});
