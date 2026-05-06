import { EmailEventsQueueWorker } from '@/workers';
import { EmailProcessingUtil } from '@/utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { EmailQueueMessage } from '@mail-otter/shared/model';

describe('EmailEventsQueueWorker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('acks processed messages', async () => {
    const worker = new EmailEventsQueueWorker();
    const ack = vi.fn();
    const retry = vi.fn();
    const processQueueMessage = vi.spyOn(EmailProcessingUtil, 'processQueueMessage').mockResolvedValue(undefined);

    await worker.queue(
      {
        messages: [
          {
            id: 'message-1',
            timestamp: new Date(),
            body: { applicationId: 1, provider: 'google-gmail' } as EmailQueueMessage,
            attempts: 1,
            ack,
            retry,
          },
        ],
        queue: 'mail-otter-email-events',
        retryAll: vi.fn(),
        ackAll: vi.fn(),
      } as unknown as MessageBatch<unknown>,
      {} as Env,
      {} as ExecutionContext,
    );

    expect(processQueueMessage).toHaveBeenCalledOnce();
    expect(ack).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
  });
});
