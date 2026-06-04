import { AiDailyUsageDAO } from '@mail-otter/backend-data/dao';
import { describe, expect, it, vi } from 'vitest';

function createStatement(firstRow: unknown = null) {
  const statement = {
    bind: vi.fn(() => statement),
    run: vi.fn(async () => ({ success: true })),
    first: vi.fn(async () => firstRow),
  };
  return statement;
}

describe('AiDailyUsageDAO', () => {
  it('reads the estimated neurons for a UTC usage date', async () => {
    const statement = createStatement({ estimated_neurons: 8750 });
    const database = {
      prepare: vi.fn(() => statement),
    } as unknown as D1Database;
    const dao = new AiDailyUsageDAO(database);

    await expect(dao.getEstimatedNeuronsForDate('2026-06-04')).resolves.toBe(8750);

    expect(statement.bind).toHaveBeenCalledWith('2026-06-04');
  });

  it('upserts daily usage counters without storing prompt text', async () => {
    const statement = createStatement();
    const database = {
      prepare: vi.fn(() => statement),
    } as unknown as D1Database;
    const dao = new AiDailyUsageDAO(database);

    await dao.incrementUsage({
      usageDate: '2026-06-04',
      estimatedNeurons: 39,
      promptTokens: 1000,
      completionTokens: 100,
    });

    expect(database.prepare).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(usage_date) DO UPDATE SET'));
    expect(statement.bind).toHaveBeenCalledWith('2026-06-04', 39, 1000, 100, 0, 1, expect.any(Number), expect.any(Number));
  });
});
