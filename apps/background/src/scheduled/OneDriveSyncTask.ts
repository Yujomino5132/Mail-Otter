import { ConnectedApplicationDAO } from '@mail-otter/backend-data/dao';
import { createD1SessionEnv } from '@mail-otter/backend-data/utils';
import { OneDriveIngestionService } from '@mail-otter/backend-services/drive';
import { OAuth2AccessTokenService } from '@mail-otter/backend-services/oauth2';
import {
  BACKGROUND_TASK_TYPE_ONEDRIVE_SYNC,
  CONNECTED_APPLICATION_STATUS_CONNECTED,
  PROVIDER_MICROSOFT_OUTLOOK,
} from '@mail-otter/shared/constants';
import { IScheduledTask } from './IScheduledTask';
import type { IEnv, TaskRunSummary } from './IScheduledTask';

class OneDriveSyncTask extends IScheduledTask<OneDriveSyncTaskEnv> {
  protected async handleScheduledTask(
    _event: ScheduledController,
    env: OneDriveSyncTaskEnv,
    _ctx: ExecutionContext,
  ): Promise<TaskRunSummary> {
    const sessionEnv = createD1SessionEnv(env);
    const masterKey: string = await env.AES_ENCRYPTION_KEY_SECRET.get();
    const applicationDAO = new ConnectedApplicationDAO(sessionEnv.DB, masterKey);

    const applicationIds = await applicationDAO.listApplicationIdsWithFeatureEnabled('onedrive');
    if (applicationIds.length === 0) return { itemsProcessed: 0, itemsFailed: 0 };

    let synced = 0;
    let failed = 0;

    for (const applicationId of applicationIds) {
      const run = await this.createApplicationRun(
        BACKGROUND_TASK_TYPE_ONEDRIVE_SYNC,
        applicationId,
        sessionEnv.DB,
      );
      try {
        const application = await applicationDAO.getById(applicationId);
        if (!application || application.status !== CONNECTED_APPLICATION_STATUS_CONNECTED) {
          await run.skip('Application not connected');
          continue;
        }
        if (application.providerId !== PROVIDER_MICROSOFT_OUTLOOK) {
          await run.skip('Provider does not support OneDrive');
          continue;
        }

        const accessToken = await new OAuth2AccessTokenService(env).getAccessToken(applicationId);
        const service = new OneDriveIngestionService(env);
        const result = await service.ingestForApplication(application, accessToken);

        synced++;
        await run.succeed({
          itemsProcessed: result.indexed + result.skipped,
          itemsFailed: result.failed,
          summary: `Indexed ${result.indexed}, skipped ${result.skipped}, failed ${result.failed}`,
        });
      } catch (error: unknown) {
        failed++;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[OneDriveSyncTask] Failed for application ${applicationId}:`, error);
        await run.fail(message);
      }
    }

    console.log(`[OneDriveSyncTask] Completed for ${synced}/${applicationIds.length} applications`);
    return {
      itemsProcessed: synced,
      itemsFailed: failed,
      summary: `Synced ${synced} of ${applicationIds.length} OneDrive connections`,
    };
  }
}

interface OneDriveSyncTaskEnv extends IEnv {
  DB: D1Database;
  AES_ENCRYPTION_KEY_SECRET: SecretsStoreSecret;
  OAUTH2_TOKEN_CACHE: KVNamespace;
  OAUTH2_TOKEN_REFRESHERS: DurableObjectNamespace;
  AI: Ai;
  EMAIL_CONTEXT_INDEX?: VectorizeIndex;
  OAUTH2_ACCESS_TOKEN_MIN_VALID_SECONDS?: string;
  MAX_ATTACHMENT_SIZE_BYTES?: string;
  MAX_DRIVE_FILES_PER_SYNC?: string;
  AI_EMBEDDING_MODEL?: string;
  MAX_CONTEXT_MEMORY_CHARS?: string;
  AI_DAILY_NEURON_FALLBACK_THRESHOLD?: string;
}

export { OneDriveSyncTask };
