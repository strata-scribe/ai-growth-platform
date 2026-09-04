export interface MetricDataPoint {
  latencyMs: number;
  isError: boolean;
  timestamp: number;
}

export interface AlertThresholds {
  errorRate?: number;
  p50?: number;
  p95?: number;
  p99?: number;
}

export interface Metrics {
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  totalRequests: number;
}

export class AgentMonitor {
  private windowSizeMs: number;
  private dataPoints: Map<string, MetricDataPoint[]> = new Map();
  private thresholds: Map<string, AlertThresholds> = new Map();
  private alertCallback: (service: string, metric: string, value: number, threshold: number) => void;

  constructor(
    windowSizeMs: number = 60000,
    alertCallback?: (service: string, metric: string, value: number, threshold: number) => void
  ) {
    this.windowSizeMs = windowSizeMs;
    this.alertCallback = alertCallback || (() => {});
  }

  public setThresholds(service: string, thresholds: AlertThresholds): void {
    this.thresholds.set(service, thresholds);
  }

  public recordRequest(service: string, latencyMs: number, isError: boolean, timestamp: number = Date.now()): void {
    if (!this.dataPoints.has(service)) {
      this.dataPoints.set(service, []);
    }

    const points = this.dataPoints.get(service)!;
    points.push({ latencyMs, isError, timestamp });

    this.checkAlerts(service, timestamp);
  }

  private cleanup(service: string, currentTimestamp: number): void {
    const points = this.dataPoints.get(service);
    if (!points) return;

    const cutoff = currentTimestamp - this.windowSizeMs;
    let i = 0;
    while (i < points.length && points[i].timestamp <= cutoff) {
      i++;
    }

    if (i > 0) {
      points.splice(0, i);
    }
  }

  public getMetrics(service: string, currentTimestamp: number = Date.now()): Metrics | null {
    this.cleanup(service, currentTimestamp);

    const points = this.dataPoints.get(service);
    if (!points || points.length === 0) return null;

    const latencies = points.map(p => p.latencyMs).sort((a, b) => a - b);
    const errors = points.filter(p => p.isError).length;

    const p50 = this.getPercentile(latencies, 50);
    const p95 = this.getPercentile(latencies, 95);
    const p99 = this.getPercentile(latencies, 99);
    const errorRate = errors / points.length;

    return {
      p50,
      p95,
      p99,
      errorRate,
      totalRequests: points.length
    };
  }

  private getPercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    if (percentile <= 0) return sortedValues[0];
    if (percentile >= 100) return sortedValues[sortedValues.length - 1];

    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private checkAlerts(service: string, currentTimestamp: number): void {
    const thresholds = this.thresholds.get(service);
    if (!thresholds) return;

    const metrics = this.getMetrics(service, currentTimestamp);
    if (!metrics) return;

    if (thresholds.errorRate !== undefined && metrics.errorRate >= thresholds.errorRate) {
      this.alertCallback(service, 'errorRate', metrics.errorRate, thresholds.errorRate);
    }
    if (thresholds.p50 !== undefined && metrics.p50 >= thresholds.p50) {
      this.alertCallback(service, 'p50', metrics.p50, thresholds.p50);
    }
    if (thresholds.p95 !== undefined && metrics.p95 >= thresholds.p95) {
      this.alertCallback(service, 'p95', metrics.p95, thresholds.p95);
    }
    if (thresholds.p99 !== undefined && metrics.p99 >= thresholds.p99) {
      this.alertCallback(service, 'p99', metrics.p99, thresholds.p99);
    }
  }
}
