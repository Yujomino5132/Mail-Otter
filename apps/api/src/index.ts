import { EmailEventsQueueWorker, MailOtterWorker } from '@/workers';

const mailOtterWorker: MailOtterWorker = new MailOtterWorker();
const emailEventsQueueWorker: EmailEventsQueueWorker = new EmailEventsQueueWorker();

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return mailOtterWorker.fetch(request, env, ctx);
  },
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    return mailOtterWorker.scheduled(controller, env, ctx);
  },
  queue(batch: MessageBatch<unknown>, env: Env, ctx: ExecutionContext): Promise<void> {
    return emailEventsQueueWorker.queue(batch, env, ctx);
  },
};
