import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetMetadataByIdForUser,
  mockUpdateContextIndexingForUser,
  mockUpdateMaxContextDocumentsForUser,
  mockListOldestActiveVectorIdsForApplication,
  mockListActiveVectorIdsForApplication,
  mockMarkDocumentsDeletedByVectorIds,
  mockGetDocumentSourcesByVectorIds,
  mockRecordDeletionRun,
  mockInsertAuditLogs,
  mockListDocumentsForUser,
  mockListDeletionRunsForUser,
  mockGetDocumentSourceForUser,
  mockListAuditLogs,
} = vi.hoisted(() => ({
  mockGetMetadataByIdForUser: vi.fn(),
  mockUpdateContextIndexingForUser: vi.fn(),
  mockUpdateMaxContextDocumentsForUser: vi.fn(),
  mockListOldestActiveVectorIdsForApplication: vi.fn(),
  mockListActiveVectorIdsForApplication: vi.fn(),
  mockMarkDocumentsDeletedByVectorIds: vi.fn(),
  mockGetDocumentSourcesByVectorIds: vi.fn(),
  mockRecordDeletionRun: vi.fn(),
  mockInsertAuditLogs: vi.fn(),
  mockListDocumentsForUser: vi.fn(),
  mockListDeletionRunsForUser: vi.fn(),
  mockGetDocumentSourceForUser: vi.fn(),
  mockListAuditLogs: vi.fn(),
}));

vi.mock('@mail-otter/backend-data/dao', () => ({
  ConnectedApplicationDAO: vi.fn(function () {
    return {
      getMetadataByIdForUser: mockGetMetadataByIdForUser,
      updateContextIndexingForUser: mockUpdateContextIndexingForUser,
      updateMaxContextDocumentsForUser: mockUpdateMaxContextDocumentsForUser,
    };
  }),
  ApplicationContextDAO: vi.fn(function () {
    return {
      listOldestActiveVectorIdsForApplication: mockListOldestActiveVectorIdsForApplication,
      listActiveVectorIdsForApplication: mockListActiveVectorIdsForApplication,
      markDocumentsDeletedByVectorIds: mockMarkDocumentsDeletedByVectorIds,
      getDocumentSourcesByVectorIds: mockGetDocumentSourcesByVectorIds,
      recordDeletionRun: mockRecordDeletionRun,
      insertAuditLogs: mockInsertAuditLogs,
      listDocumentsForUser: mockListDocumentsForUser,
      listDeletionRunsForUser: mockListDeletionRunsForUser,
      getDocumentSourceForUser: mockGetDocumentSourceForUser,
      listAuditLogs: mockListAuditLogs,
    };
  }),
}));

vi.mock('../../packages/backend-services/src/application/ApplicationResponseUtil', () => ({
  ApplicationResponseUtil: {
    decorateApplication: vi.fn((app) => ({ ...app, decorated: true })),
  },
}));

vi.mock('../../packages/backend-services/src/email/EmailContextUtil', () => ({
  EmailContextUtil: {
    getUserVectorNamespace: vi.fn(async () => 'ns-user'),
    chunk: vi.fn(<T>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    }),
  },
}));

import { ContextService } from '../../packages/backend-services/src/email/ContextService';

function makeEnv(overrides?: Record<string, unknown>) {
  return {
    DB: {} as D1Database,
    AES_ENCRYPTION_KEY_SECRET: { get: vi.fn().mockResolvedValue('key') },
    EMAIL_CONTEXT_INDEX: {
      deleteByIds: vi.fn().mockResolvedValue({ mutationId: 'mut-1' }),
    } as never,
    ...overrides,
  };
}

describe('ContextService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateContextSettings', () => {
    it('updates contextIndexingEnabled and returns decorated application', async () => {
      mockUpdateContextIndexingForUser.mockResolvedValue({ applicationId: 'app-1', userEmail: 'user@example.com' });

      const result = await ContextService.updateContextSettings(
        'user@example.com',
        { applicationId: 'app-1', contextIndexingEnabled: true },
        makeEnv(),
        new Request('https://example.com'),
      );

      expect(result).toMatchObject({ applicationId: 'app-1', decorated: true });
      expect(mockUpdateContextIndexingForUser).toHaveBeenCalledWith('app-1', 'user@example.com', true);
    });

    it('updates maxContextDocuments and returns decorated application', async () => {
      mockUpdateMaxContextDocumentsForUser.mockResolvedValue({ applicationId: 'app-1' });

      const result = await ContextService.updateContextSettings(
        'user@example.com',
        { applicationId: 'app-1', maxContextDocuments: 50 },
        makeEnv(),
        new Request('https://example.com'),
      );

      expect(result).toMatchObject({ decorated: true });
      expect(mockUpdateMaxContextDocumentsForUser).toHaveBeenCalledWith('app-1', 'user@example.com', 50);
    });

    it('sets maxContextDocuments to null when explicitly null', async () => {
      mockUpdateMaxContextDocumentsForUser.mockResolvedValue({ applicationId: 'app-1' });

      await ContextService.updateContextSettings(
        'user@example.com',
        { applicationId: 'app-1', maxContextDocuments: null },
        makeEnv(),
        new Request('https://example.com'),
      );

      expect(mockUpdateMaxContextDocumentsForUser).toHaveBeenCalledWith('app-1', 'user@example.com', null);
    });

    it('fetches application when no update fields are provided', async () => {
      mockGetMetadataByIdForUser.mockResolvedValue({ applicationId: 'app-1' });

      const result = await ContextService.updateContextSettings(
        'user@example.com',
        { applicationId: 'app-1' },
        makeEnv(),
        new Request('https://example.com'),
      );

      expect(result).toMatchObject({ decorated: true });
      expect(mockGetMetadataByIdForUser).toHaveBeenCalledWith('app-1', 'user@example.com');
    });

    it('throws when application not found during contextIndexingEnabled update', async () => {
      mockUpdateContextIndexingForUser.mockResolvedValue(undefined);

      await expect(
        ContextService.updateContextSettings(
          'user@example.com',
          { applicationId: 'app-1', contextIndexingEnabled: false },
          makeEnv(),
          new Request('https://example.com'),
        ),
      ).rejects.toThrow('Connected application was not found.');
    });

    it('throws when application not found during maxContextDocuments update', async () => {
      mockUpdateMaxContextDocumentsForUser.mockResolvedValue(undefined);

      await expect(
        ContextService.updateContextSettings(
          'user@example.com',
          { applicationId: 'app-1', maxContextDocuments: 10 },
          makeEnv(),
          new Request('https://example.com'),
        ),
      ).rejects.toThrow('Connected application was not found.');
    });

    it('throws when application not found during metadata fallback', async () => {
      mockGetMetadataByIdForUser.mockResolvedValue(undefined);

      await expect(
        ContextService.updateContextSettings(
          'user@example.com',
          { applicationId: 'missing' },
          makeEnv(),
          new Request('https://example.com'),
        ),
      ).rejects.toThrow('Connected application was not found.');
    });
  });

  describe('pruneApplicationDocuments', () => {
    it('returns early without pruning when within limit', async () => {
      await ContextService.pruneApplicationDocuments('app-1', 'user@example.com', 5, 10, makeEnv());

      expect(mockListOldestActiveVectorIdsForApplication).not.toHaveBeenCalled();
    });

    it('prunes excess documents and records deletion run', async () => {
      mockListOldestActiveVectorIdsForApplication.mockResolvedValue(['v1', 'v2']);
      mockGetDocumentSourcesByVectorIds.mockResolvedValue([]);
      mockMarkDocumentsDeletedByVectorIds.mockResolvedValue(undefined);
      mockRecordDeletionRun.mockResolvedValue({ runId: 'run-1' });

      await ContextService.pruneApplicationDocuments('app-1', 'user@example.com', 15, 10, makeEnv());

      expect(mockMarkDocumentsDeletedByVectorIds).toHaveBeenCalledWith('app-1', 'user@example.com', ['v1', 'v2']);
      expect(mockRecordDeletionRun).toHaveBeenCalledWith(expect.objectContaining({ status: 'accepted' }));
    });

    it('returns early when no vector IDs are found for pruning', async () => {
      mockListOldestActiveVectorIdsForApplication.mockResolvedValue([]);

      await ContextService.pruneApplicationDocuments('app-1', 'user@example.com', 15, 10, makeEnv());

      expect(mockMarkDocumentsDeletedByVectorIds).not.toHaveBeenCalled();
    });

    it('records error deletion run when vectorize deletion fails', async () => {
      mockListOldestActiveVectorIdsForApplication.mockResolvedValue(['v1']);
      mockGetDocumentSourcesByVectorIds.mockResolvedValue([]);
      const env = makeEnv({ EMAIL_CONTEXT_INDEX: { deleteByIds: vi.fn().mockRejectedValue(new Error('Vectorize error')) } });
      mockRecordDeletionRun.mockResolvedValue(undefined);

      await ContextService.pruneApplicationDocuments('app-1', 'user@example.com', 15, 10, env as never);

      expect(mockRecordDeletionRun).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', errorMessage: 'Vectorize error' }));
    });

    it('logs document deletions when sources are found', async () => {
      mockListOldestActiveVectorIdsForApplication.mockResolvedValue(['v1']);
      mockGetDocumentSourcesByVectorIds.mockResolvedValue([{ contextDocumentId: 'doc-1', sourceDocumentId: 'src-1' }]);
      mockInsertAuditLogs.mockResolvedValue(undefined);
      mockMarkDocumentsDeletedByVectorIds.mockResolvedValue(undefined);
      mockRecordDeletionRun.mockResolvedValue(undefined);

      await ContextService.pruneApplicationDocuments('app-1', 'user@example.com', 15, 10, makeEnv());

      expect(mockInsertAuditLogs).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ contextDocumentId: 'doc-1', eventType: 'document_deleted' })]),
      );
    });
  });

  describe('listDocuments', () => {
    it('returns document list for user', async () => {
      mockListDocumentsForUser.mockResolvedValue({ items: [], cursor: null });

      const result = await ContextService.listDocuments('user@example.com', { applicationId: 'app-1' }, makeEnv());

      expect(result).toEqual({ items: [], cursor: null });
      expect(mockListDocumentsForUser).toHaveBeenCalledWith('user@example.com', { applicationId: 'app-1' });
    });
  });

  describe('listDeletionRuns', () => {
    it('returns deletion run list for user', async () => {
      mockListDeletionRunsForUser.mockResolvedValue({ items: [{ runId: 'r1' }], cursor: null });

      const result = await ContextService.listDeletionRuns('user@example.com', {}, makeEnv());

      expect(result).toEqual({ items: [{ runId: 'r1' }], cursor: null });
    });
  });

  describe('deleteDocuments', () => {
    it('deletes all active documents and records accepted deletion run', async () => {
      mockGetMetadataByIdForUser.mockResolvedValue({ applicationId: 'app-1', userEmail: 'user@example.com' });
      mockListActiveVectorIdsForApplication.mockResolvedValue(['v1', 'v2']);
      mockMarkDocumentsDeletedByVectorIds.mockResolvedValue(undefined);
      mockGetDocumentSourcesByVectorIds.mockResolvedValue([]);
      mockRecordDeletionRun.mockResolvedValue({ runId: 'run-1' });

      const result = await ContextService.deleteDocuments('user@example.com', 'app-1', makeEnv() as never);

      expect(result).toEqual({ runId: 'run-1' });
      expect(mockMarkDocumentsDeletedByVectorIds).toHaveBeenCalledWith('app-1', 'user@example.com', ['v1', 'v2']);
    });

    it('records error deletion run when deletion fails', async () => {
      mockGetMetadataByIdForUser.mockResolvedValue({ applicationId: 'app-1', userEmail: 'user@example.com' });
      mockListActiveVectorIdsForApplication.mockResolvedValue(['v1']);
      mockGetDocumentSourcesByVectorIds.mockResolvedValue([]);
      const env = makeEnv({ EMAIL_CONTEXT_INDEX: { deleteByIds: vi.fn().mockRejectedValue(new Error('Delete failed')) } });
      mockRecordDeletionRun.mockResolvedValue({ runId: 'err-run' });

      const result = await ContextService.deleteDocuments('user@example.com', 'app-1', env as never);

      expect(result).toEqual({ runId: 'err-run' });
      expect(mockRecordDeletionRun).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', deletedVectorCount: 0 }));
    });

    it('throws when application is not found', async () => {
      mockGetMetadataByIdForUser.mockResolvedValue(undefined);

      await expect(ContextService.deleteDocuments('user@example.com', 'missing', makeEnv() as never)).rejects.toThrow(
        'Connected application was not found.',
      );
    });
  });

  describe('listAuditLogs', () => {
    it('returns audit logs for a context document', async () => {
      mockGetDocumentSourceForUser.mockResolvedValue({ contextDocumentId: 'doc-1' });
      mockListAuditLogs.mockResolvedValue({ items: [{ logId: 'l1' }], cursor: null });

      const result = await ContextService.listAuditLogs('user@example.com', 'doc-1', makeEnv(), 'cursor-abc');

      expect(result).toEqual({ items: [{ logId: 'l1' }], cursor: null });
      expect(mockListAuditLogs).toHaveBeenCalledWith('doc-1', { cursor: 'cursor-abc' });
    });

    it('throws when context document is not found', async () => {
      mockGetDocumentSourceForUser.mockResolvedValue(undefined);

      await expect(ContextService.listAuditLogs('user@example.com', 'missing-doc', makeEnv())).rejects.toThrow(
        'Context document was not found.',
      );
    });
  });

  describe('getDocumentProviderLink', () => {
    it('returns Gmail provider link with providerEmail', async () => {
      mockGetDocumentSourceForUser.mockResolvedValue({
        contextDocumentId: 'doc-1',
        applicationId: 'app-1',
        sourceProviderId: 'google-gmail',
        sourceThreadId: 'thread-abc',
        sourceDocumentId: 'msg-xyz',
      });
      mockGetMetadataByIdForUser.mockResolvedValue({ applicationId: 'app-1', providerEmail: 'user@gmail.com' });

      const url = await ContextService.getDocumentProviderLink('user@example.com', 'doc-1', makeEnv());

      expect(url).toContain('mail.google.com');
      expect(url).toContain('thread-abc');
      expect(url).toContain('user%40gmail.com');
    });

    it('returns Gmail provider link using sourceDocumentId when no thread', async () => {
      mockGetDocumentSourceForUser.mockResolvedValue({
        contextDocumentId: 'doc-1',
        applicationId: 'app-1',
        sourceProviderId: 'google-gmail',
        sourceThreadId: null,
        sourceDocumentId: 'msg-xyz',
      });
      mockGetMetadataByIdForUser.mockResolvedValue({ applicationId: 'app-1', providerEmail: null });

      const url = await ContextService.getDocumentProviderLink('user@example.com', 'doc-1', makeEnv());

      expect(url).toContain('msg-xyz');
    });

    it('returns Outlook provider link with login_hint', async () => {
      mockGetDocumentSourceForUser.mockResolvedValue({
        contextDocumentId: 'doc-1',
        applicationId: 'app-1',
        sourceProviderId: 'microsoft-outlook',
        sourceDocumentId: 'outlook-msg-1',
      });
      mockGetMetadataByIdForUser.mockResolvedValue({ applicationId: 'app-1', providerEmail: 'user@outlook.com' });

      const url = await ContextService.getDocumentProviderLink('user@example.com', 'doc-1', makeEnv());

      expect(url).toContain('outlook.office.com');
      expect(url).toContain('login_hint=user%40outlook.com');
    });

    it('throws when context document is not found', async () => {
      mockGetDocumentSourceForUser.mockResolvedValue(undefined);

      await expect(ContextService.getDocumentProviderLink('user@example.com', 'missing', makeEnv())).rejects.toThrow(
        'Context document was not found.',
      );
    });

    it('throws when application is not found', async () => {
      mockGetDocumentSourceForUser.mockResolvedValue({
        contextDocumentId: 'doc-1',
        applicationId: 'app-1',
        sourceProviderId: 'google-gmail',
      });
      mockGetMetadataByIdForUser.mockResolvedValue(undefined);

      await expect(ContextService.getDocumentProviderLink('user@example.com', 'doc-1', makeEnv())).rejects.toThrow(
        'Connected application was not found.',
      );
    });

    it('throws for unsupported provider', async () => {
      mockGetDocumentSourceForUser.mockResolvedValue({
        contextDocumentId: 'doc-1',
        applicationId: 'app-1',
        sourceProviderId: 'unknown-provider',
        sourceDocumentId: 'msg-1',
      });
      mockGetMetadataByIdForUser.mockResolvedValue({ applicationId: 'app-1', providerEmail: null });

      await expect(ContextService.getDocumentProviderLink('user@example.com', 'doc-1', makeEnv())).rejects.toThrow(
        'Unsupported provider',
      );
    });
  });
});
