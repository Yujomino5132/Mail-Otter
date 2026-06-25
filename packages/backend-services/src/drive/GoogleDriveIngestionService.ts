import { AiDailyUsageDAO, ApplicationContextDAO } from '@mail-otter/backend-data/dao';
import { ConnectedApplicationDAO } from '@mail-otter/backend-data/dao';
import type { D1Queryable } from '@mail-otter/backend-data/utils';
import { GoogleDriveProviderUtil } from '@mail-otter/provider-clients/google-drive';
import type { DriveFile } from '@mail-otter/provider-clients/google-drive';
import type { ConnectedApplication } from '@mail-otter/shared/model';
import {
  CONTEXT_AUDIT_EVENT_CONTEXT_INDEXED,
  CONTEXT_AUDIT_LOG_SEVERITY_INFO,
  CONTEXT_SOURCE_TYPE_GOOGLE_DRIVE,
} from '@mail-otter/shared/constants';
import { CryptoUtil } from '@mail-otter/shared/utils';
import { ConfigurationManager } from '@mail-otter/backend-runtime/config';
import { EmailContextUtil, AiUsageUtil } from '../email';
import type { WorkersAiEmbeddingResult } from '../email';
import { DriveDocumentUtil } from './DriveDocumentUtil';

interface DriveIngestionResult {
  indexed: number;
  skipped: number;
  failed: number;
  newCursor: string | null;
}

interface GoogleDriveIngestionEnv {
  DB: D1Queryable;
  AI: Ai;
  EMAIL_CONTEXT_INDEX?: VectorizeIndex;
  AES_ENCRYPTION_KEY_SECRET: { get(): Promise<string> };
  MAX_ATTACHMENT_SIZE_BYTES?: string;
  MAX_DRIVE_FILES_PER_SYNC?: string;
  AI_EMBEDDING_MODEL?: string;
  MAX_CONTEXT_MEMORY_CHARS?: string;
  AI_DAILY_NEURON_FALLBACK_THRESHOLD?: string;
}

class GoogleDriveIngestionService {
  constructor(private readonly env: GoogleDriveIngestionEnv) {}

  public async ingestForApplication(
    application: ConnectedApplication,
    accessToken: string,
  ): Promise<DriveIngestionResult> {
    if (!this.env.EMAIL_CONTEXT_INDEX) {
      return { indexed: 0, skipped: 0, failed: 0, newCursor: null };
    }

    const vectorNamespace = await EmailContextUtil.getUserVectorNamespace(application.userEmail);
    const contextDAO = new ApplicationContextDAO(this.env.DB);
    const masterKey = await this.env.AES_ENCRYPTION_KEY_SECRET.get();
    const applicationDAO = new ConnectedApplicationDAO(this.env.DB, masterKey);
    const maxFiles = ConfigurationManager.drive.getMaxFilesPerSync(this.env);
    const maxBytes = ConfigurationManager.attachment.getMaxSizeBytes(this.env);

    const currentPageToken = await applicationDAO.getProviderConfig(
      application.applicationId,
      'google_drive_page_token',
    );

    if (!currentPageToken) {
      const freshToken = await GoogleDriveProviderUtil.getStartPageToken(accessToken);
      await applicationDAO.setProviderConfig(
        application.applicationId,
        'google_drive_page_token',
        freshToken,
      );
      return { indexed: 0, skipped: 0, failed: 0, newCursor: null };
    }

    const changes = await GoogleDriveProviderUtil.listChanges(accessToken, currentPageToken, maxFiles);

    let indexed = 0;
    let skipped = 0;
    let failed = 0;

    for (const fileId of changes.removed) {
      try {
        const info = await contextDAO.getDocumentSourceInfo(
          application.applicationId,
          fileId,
          CONTEXT_SOURCE_TYPE_GOOGLE_DRIVE,
        );
        if (info) {
          await this.env.EMAIL_CONTEXT_INDEX.deleteByIds([info.vectorId]);
          await contextDAO.markDocumentsDeletedByVectorIds(
            application.applicationId,
            info.userEmail,
            [info.vectorId],
          );
        }
      } catch (error: unknown) {
        console.warn(`[GoogleDriveIngestionService] Failed to delete removed file ${fileId}:`, error);
      }
    }

    for (const file of changes.files) {
      try {
        const result = await this.ingestFile(
          application,
          accessToken,
          file,
          vectorNamespace,
          contextDAO,
          maxBytes,
        );
        if (result === 'indexed') indexed++;
        else if (result === 'skipped') skipped++;
      } catch (error: unknown) {
        failed++;
        console.warn(`[GoogleDriveIngestionService] Failed to ingest file ${file.id}:`, error);
        try {
          const info = await contextDAO.getDocumentSourceInfo(
            application.applicationId,
            file.id,
            CONTEXT_SOURCE_TYPE_GOOGLE_DRIVE,
          );
          if (info) {
            await contextDAO.markDocumentError(
              info.contextDocumentId,
              error instanceof Error ? error.message : String(error),
            );
          }
        } catch {
          // non-fatal
        }
      }
    }

    const newCursor = changes.newStartPageToken ?? changes.nextPageToken;
    if (newCursor) {
      await applicationDAO.setProviderConfig(
        application.applicationId,
        'google_drive_page_token',
        newCursor,
      );
    }

    return { indexed, skipped, failed, newCursor };
  }

  private async ingestFile(
    application: ConnectedApplication,
    accessToken: string,
    file: DriveFile,
    vectorNamespace: string,
    contextDAO: ApplicationContextDAO,
    maxBytes: number,
  ): Promise<'indexed' | 'skipped'> {
    if (file.size !== undefined && Number(file.size) > maxBytes) {
      return 'skipped';
    }

    let rawText: string | null = null;
    if (GoogleDriveProviderUtil.isExportableMimeType(file.mimeType)) {
      rawText = await GoogleDriveProviderUtil.exportDocument(accessToken, file.id);
    } else {
      const buffer = await GoogleDriveProviderUtil.downloadFile(accessToken, file.id, maxBytes);
      rawText = DriveDocumentUtil.extractText(buffer, file.mimeType);
    }

    if (!rawText || rawText.trim().length === 0) {
      return 'skipped';
    }

    const maxChars = ConfigurationManager.getMaxContextMemoryChars(this.env);
    const indexedText = DriveDocumentUtil.buildIndexedText(
      file.name,
      application.displayName,
      rawText,
      maxChars,
    );

    const secret = await this.env.AES_ENCRYPTION_KEY_SECRET.get();
    const sourceDocumentFingerprint = await CryptoUtil.hmacSha256Hex(
      `source-document\n${file.id}`,
      secret,
    );
    const titleFingerprint = await CryptoUtil.hmacSha256Hex(`title\n${file.name}`, secret);
    const contentFingerprint = await CryptoUtil.hmacSha256Hex(
      `indexed-text\n${indexedText}`,
      secret,
    );

    const document = await contextDAO.upsertDriveDocument({
      applicationId: application.applicationId,
      userEmail: application.userEmail,
      sourceProviderId: application.providerId,
      sourceType: CONTEXT_SOURCE_TYPE_GOOGLE_DRIVE,
      sourceDocumentId: file.id,
      vectorNamespace,
      sourceDocumentFingerprint,
      titleFingerprint,
      contentFingerprint,
      indexedTextChars: indexedText.length,
    });

    if (document.contentFingerprint === contentFingerprint && document.indexedAt !== null) {
      return 'skipped';
    }

    const embeddingModel = ConfigurationManager.getAiEmbeddingModel(this.env);
    const embedding = await this.embed(embeddingModel, indexedText);

    await this.env.EMAIL_CONTEXT_INDEX!.upsert([
      {
        id: document.vectorId,
        namespace: vectorNamespace,
        values: embedding,
        metadata: {
          applicationId: application.applicationId,
          sourceType: CONTEXT_SOURCE_TYPE_GOOGLE_DRIVE,
          sourceProviderId: application.providerId,
          sourceDocumentId: file.id,
          title: file.name.slice(0, 512),
          indexedText,
          indexedAt: Date.now(),
        },
      },
    ]);

    await contextDAO.markDocumentIndexed(document.contextDocumentId);
    await contextDAO.insertAuditLog({
      contextDocumentId: document.contextDocumentId,
      applicationId: application.applicationId,
      userEmail: application.userEmail,
      sourceDocumentId: file.id,
      eventType: CONTEXT_AUDIT_EVENT_CONTEXT_INDEXED,
      eventLabel: 'Drive File Indexed Into Context',
      eventData: { indexedTextChars: indexedText.length, sourceProviderId: application.providerId, vectorId: document.vectorId },
      severity: CONTEXT_AUDIT_LOG_SEVERITY_INFO,
    });

    await this.recordEmbeddingUsage(embeddingModel, indexedText);

    return 'indexed';
  }

  private async embed(model: string, text: string): Promise<number[]> {
    const result = (await this.env.AI.run(model, { text: [text] })) as WorkersAiEmbeddingResult;
    const embedding: unknown = Array.isArray(result.data?.[0]) ? result.data[0] : result.data;
    if (!Array.isArray(embedding) || !embedding.every((v: unknown): v is number => typeof v === 'number')) {
      throw new Error('Workers AI did not return an embedding vector.');
    }
    return embedding;
  }

  private async recordEmbeddingUsage(model: string, text: string): Promise<void> {
    try {
      const estimate = AiUsageUtil.estimateEmbeddingUsage(model, text);
      await new AiDailyUsageDAO(this.env.DB).incrementUsage({
        usageDate: AiUsageUtil.getCurrentUtcUsageDate(),
        estimatedNeurons: estimate.estimatedNeurons,
        embeddingTokens: estimate.embeddingTokens,
      });
    } catch (error: unknown) {
      console.warn('[GoogleDriveIngestionService] Failed to record embedding usage:', error);
    }
  }
}

export { GoogleDriveIngestionService };
export type { DriveIngestionResult, GoogleDriveIngestionEnv };
