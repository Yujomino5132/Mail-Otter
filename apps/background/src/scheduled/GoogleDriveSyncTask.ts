import { ConnectedApplicationDAO } from '@mail-otter/backend-data/dao';
import { createD1SessionEnv } from '@mail-otter/backend-data/utils';
import { GoogleDriveIngestionService } from '@mail-otter/backend-services/drive';
import { OAuth2AccessTokenService } from '@mail-otter/backend-services/oauth2';
import {
  BACKGROUND_TASK_TYPE_GOOGLE_DRIVE_SYNC,
  CONNECTED_APPLICATION_STATUS_CONNECTED,
  PROVIDER_GOOGLE_GMAIL,
} from '@mail-otter/shared/constants';
import { IScheduledTask } from './IScheduledTask';
import type { IEnv, TaskRunSummary } from './IScheduledTask';

class GoogleDriveSyncTask extends IScheduledTask<GoogleDriveSyncTaskEnv> {
  protected async handleScheduledTask(
    _event: ScheduledController,
    env: GoogleDriveSyncTaskEnv,
    _ctx: ExecutionContext,
  ): Promise<TaskRunSummary> {
    const sessionEnv = createD1SessionEnv(env);
    const masterKey: string = await env.AES_ENCRYPTION_KEY_SECRET.get();
    const applicationDAO = new ConnectedApplicationDAO(sessionEnv.DB, masterKey);

    const applicationIds = await applicationDAO.listApplicationIdsWithFeatureEnabled('google_drive');
    if (applicationIds.length === 0) return { itemsProcessed: 0, itemsFailed: 0 };

    let synced = 0;
    let failed = 0;

    for (const applicationId of applicationIds) {
      const run = await this.createApplicationRun(
        BACKGROUND_TASK_TYPE_GOOGLE_DRIVE_SYNC,
        applicationId,
        sessionEnv.DB,
      );
      try {
        const application = await applicationDAO.getById(applicationId);
        if (!application || application.status !== CONNECTED_APPLICATION_STATUS_CONNECTED) {
          await run.skip('Application not connected');
          continue;
        }
        if (application.providerId !== PROVIDER_GOOGLE_GMAIL) {
          await run.skip('Provider does not support Google Drive');
          continue;
        }

        const accessToken = await new OAuth2AccessTokenService(env).getAccessToken(applicationId);
        const service = new GoogleDriveIngestionService(env);
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
        console.error(`[GoogleDriveSyncTask] Failed for application ${applicationId}:`, error);
        await run.fail(message);
      }
    }

    console.log(`[GoogleDriveSyncTask] Completed for ${synced}/${applicationIds.length} applications`);
    return {
      itemsProcessed: synced,
      itemsFailed: failed,
      summary: `Synced ${synced} of ${applicationIds.length} Drive connections`,
    };
  }
}

interface GoogleDriveSyncTaskEnv extends IEnv {
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

export { GoogleDriveSyncTask };
