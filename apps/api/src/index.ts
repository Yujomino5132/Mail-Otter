import { EmailEventsDispatcherWorker, MailOtterWorker } from '@/workers';
export { CronTasksWorker } from './workers/CronTasksWorker';
export { EmailProcessingWorkflow } from './workers/EmailProcessingWorkflow';
export { OAuth2TokenRefreshWorker } from './workers/OAuth2TokenRefreshWorker';

const mailOtterWorker: MailOtterWorker = new MailOtterWorker();
const emailEventsDispatcherWorker: EmailEventsDispatcherWorker = new EmailEventsDispatcherWorker();

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return mailOtterWorker.fetch(request, env, ctx);
  },
  scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    return mailOtterWorker.scheduled(controller, env, ctx);
  },
  queue(batch: MessageBatch<unknown>, env: Env, ctx: ExecutionContext): Promise<void> {
    return emailEventsDispatcherWorker.queue(batch, env, ctx);
  },
};
