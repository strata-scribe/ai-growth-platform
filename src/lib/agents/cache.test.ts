import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentRegistryCache } from './cache';

describe('AgentRegistryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should set and get values', () => {
    const cache = new AgentRegistryCache<string>();
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for non-existent keys', () => {
    const cache = new AgentRegistryCache<string>();
    expect(cache.get('key1')).toBeUndefined();
  });

  it('should return undefined if TTL has expired during get', () => {
    const cache = new AgentRegistryCache<string>(1000);
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');

    vi.advanceTimersByTime(1500);

    expect(cache.get('key1')).toBeUndefined();
  });

  it('should use custom TTL when provided', () => {
    const cache = new AgentRegistryCache<string>(5000); // Default 5s
    cache.set('key1', 'value1', 1000); // Override to 1s
    expect(cache.get('key1')).toBe('value1');

    vi.advanceTimersByTime(1500);

    expect(cache.get('key1')).toBeUndefined();
  });

  it('should delete keys', () => {
    const cache = new AgentRegistryCache<string>();
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');

    cache.delete('key1');
    expect(cache.get('key1')).toBeUndefined();
  });

  it('should clear all keys', () => {
    const cache = new AgentRegistryCache<string>();
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    cache.clear();

    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBeUndefined();
  });

  it('should invalidate expired keys', () => {
    const cache = new AgentRegistryCache<string>(1000);
    cache.set('key1', 'value1');
    cache.set('key2', 'value2', 5000); // 5 seconds

    vi.advanceTimersByTime(1500); // Advances past key1 TTL, but not key2 TTL

    // Directly access cache for testing purposes to see if it was removed by invalidateExpired
    cache.invalidateExpired();

    // Re-bind to real timers to not affect assertions
    vi.useRealTimers();

    // Use fake timers but don't move forward to check what's in cache now
    vi.useFakeTimers();
    vi.setSystemTime(vi.getMockedSystemTime() || Date.now()); // Keep same time

    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('value2');
  });
});
