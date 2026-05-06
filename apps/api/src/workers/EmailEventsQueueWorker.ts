import { AbstractQueueWorker } from '@/base';
import { EmailProcessingUtil } from '@/utils';
import type { EmailQueueMessage } from '@mail-otter/shared/model';

class EmailEventsQueueWorker extends AbstractQueueWorker {
  protected async onQueue(batch: MessageBatch<unknown>, env: Env, _ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      try {
        await EmailProcessingUtil.processQueueMessage(message.body as EmailQueueMessage, env);
        message.ack();
      } catch (error: unknown) {
        console.error('Failed to process email event queue message:', error);
        message.retry();
      }
    }
  }
}

export { EmailEventsQueueWorker };
