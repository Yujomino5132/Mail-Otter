import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutlookProviderUtil } from '@mail-otter/provider-clients/outlook';

function mockEmptyResponse(): Response {
  return new Response(JSON.stringify({ value: [] }), { status: 200 });
}

describe('OutlookProviderUtil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendSelfSummaryReply', () => {
    it('sends summary as a reply, finds sent message, copies to inbox, and deletes sent copy', async () => {
      const mockReplyResponse = new Response(null, { status: 202 });
      const mockFindResponse = new Response(JSON.stringify({ value: [{ id: 'sent-msg-id' }] }), { status: 200 });
      const mockCopyResponse = new Response(JSON.stringify({ id: 'copy-id-456' }), { status: 201 });
      const mockDeleteResponse = new Response(null, { status: 204 });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockEmptyResponse())   // inbox check
        .mockResolvedValueOnce(mockEmptyResponse())   // sentitems check
        .mockResolvedValueOnce(mockReplyResponse)     // reply
        .mockResolvedValueOnce(mockFindResponse)      // find after reply
        .mockResolvedValueOnce(mockCopyResponse)      // copy
        .mockResolvedValueOnce(mockDeleteResponse);   // delete

      vi.stubGlobal('fetch', fetchMock);

      const originalMessage = { id: 'original-msg-id' };

      const htmlSummary =
        '<p><strong>Gist:</strong> Summary &lt;tag&gt; &amp; text</p>\n<p><strong>Details:</strong></p>\n<ul>\n<li>Next line</li>\n</ul>';
      await OutlookProviderUtil.sendSelfSummaryReply(
        'test-access-token',
        originalMessage,
        'sender@example.com',
        htmlSummary,
      );

      expect(fetchMock).toHaveBeenCalledTimes(6);

      // Step 1: inbox idempotency check
      const inboxUrl = fetchMock.mock.calls[0][0] as string;
      expect(inboxUrl).toContain('/me/mailFolders/inbox/messages');
      expect(inboxUrl).toContain(encodeURIComponent('[OtterSum-'));

      // Step 2: sent items idempotency check
      const sentItemsCheckUrl = fetchMock.mock.calls[1][0] as string;
      expect(sentItemsCheckUrl).toContain('/me/mailFolders/sentitems/messages');
      expect(sentItemsCheckUrl).toContain(encodeURIComponent('[OtterSum-'));

      // Step 3: reply with sink address
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        'https://graph.microsoft.com/v1.0/me/messages/original-msg-id/reply',
        expect.objectContaining({ method: 'POST' }),
      );

      const replyCall = fetchMock.mock.calls[2];
      const replyHeaders = replyCall[1].headers as Record<string, string>;
      const parsedBody: Record<string, unknown> = JSON.parse(replyCall[1].body as string);

      expect(replyHeaders['Content-Type']).toBe('application/json');
      expect(replyHeaders['Authorization']).toBe('Bearer test-access-token');
      expect(parsedBody.message.subject).toMatch(/^\[OtterSum-/);
      expect(parsedBody.message.body).toEqual({
        contentType: 'html',
        content: htmlSummary,
      });
      expect(parsedBody.message.toRecipients).toEqual([
        { emailAddress: { address: 'sender+sink@example.com' } },
      ]);
      expect(parsedBody.message.internetMessageHeaders).toEqual([
        { name: 'X-Mail-Otter-Summary', value: 'true' },
      ]);

      // Step 4: find sent summary message (also in sentitems folder)
      const findUrl = fetchMock.mock.calls[3][0] as string;
      expect(findUrl).toContain('/me/mailFolders/sentitems/messages');
      expect(findUrl).toContain('OtterSum-');
      expect(findUrl).toContain(encodeURIComponent('$top') + '=1');
      expect(findUrl).toContain(encodeURIComponent('$orderby') + '=sentDateTime+desc');

      // Step 5: copy sent message to inbox
      expect(fetchMock).toHaveBeenNthCalledWith(
        5,
        'https://graph.microsoft.com/v1.0/me/messages/sent-msg-id/copy',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ destinationId: 'inbox' }),
        }),
      );

      // Step 6: delete sent copy
      expect(fetchMock).toHaveBeenNthCalledWith(
        6,
        'https://graph.microsoft.com/v1.0/me/messages/sent-msg-id',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('skips when summary already exists in inbox', async () => {
      const mockInboxResponse = new Response(JSON.stringify({ value: [{ id: 'inbox-msg-id' }] }), { status: 200 });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockInboxResponse);

      vi.stubGlobal('fetch', fetchMock);

      await OutlookProviderUtil.sendSelfSummaryReply(
        'test-access-token',
        { id: 'original-msg-id' },
        'sender@example.com',
        'Summary text',
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const inboxUrl = fetchMock.mock.calls[0][0] as string;
      expect(inboxUrl).toContain('/me/mailFolders/inbox/messages');
    });

    it('skips reply and only copies and deletes when summary already in sent items', async () => {
      const mockSentItemsResponse = new Response(JSON.stringify({ value: [{ id: 'sent-msg-id' }] }), { status: 200 });
      const mockCopyResponse = new Response(JSON.stringify({ id: 'copy-id-456' }), { status: 201 });
      const mockDeleteResponse = new Response(null, { status: 204 });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockEmptyResponse())    // inbox check (empty)
        .mockResolvedValueOnce(mockSentItemsResponse)  // sentitems check (found)
        .mockResolvedValueOnce(mockCopyResponse)       // copy
        .mockResolvedValueOnce(mockDeleteResponse);    // delete

      vi.stubGlobal('fetch', fetchMock);

      await OutlookProviderUtil.sendSelfSummaryReply(
        'test-access-token',
        { id: 'original-msg-id' },
        'sender@example.com',
        'Summary text',
      );

      expect(fetchMock).toHaveBeenCalledTimes(4);

      // No reply call
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        'https://graph.microsoft.com/v1.0/me/messages/sent-msg-id/copy',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        'https://graph.microsoft.com/v1.0/me/messages/sent-msg-id',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('throws when reply fails', async () => {
      const mockReplyResponse = new Response('Reply failed', { status: 500 });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockEmptyResponse())    // inbox check
        .mockResolvedValueOnce(mockEmptyResponse())    // sentitems check
        .mockResolvedValue(mockReplyResponse);          // reply fails

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        OutlookProviderUtil.sendSelfSummaryReply('test-access-token', { id: 'original-msg-id' }, 'sender@example.com', 'Summary text'),
      ).rejects.toThrow('Microsoft Graph send summary reply failed (500): Reply failed');
    });

    it('throws when find returns no results after reply', async () => {
      const mockReplyResponse = new Response(null, { status: 202 });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockEmptyResponse())    // inbox check
        .mockResolvedValueOnce(mockEmptyResponse())    // sentitems check
        .mockResolvedValueOnce(mockReplyResponse)      // reply
        .mockResolvedValueOnce(mockEmptyResponse());   // find after reply (empty)

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        OutlookProviderUtil.sendSelfSummaryReply('test-access-token', { id: 'original-msg-id' }, 'sender@example.com', 'Summary text'),
      ).rejects.toThrow('Microsoft Graph did not return the sent summary message.');
    });

    it('throws when find fails after reply', async () => {
      const mockReplyResponse = new Response(null, { status: 202 });
      const mockFindFailResponse = new Response(JSON.stringify({ error: { message: 'Find failed' } }), { status: 500 });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockEmptyResponse())      // inbox check
        .mockResolvedValueOnce(mockEmptyResponse())      // sentitems check
        .mockResolvedValueOnce(mockReplyResponse)        // reply
        .mockResolvedValueOnce(mockFindFailResponse);    // find fails

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        OutlookProviderUtil.sendSelfSummaryReply('test-access-token', { id: 'original-msg-id' }, 'sender@example.com', 'Summary text'),
      ).rejects.toThrow('Microsoft Graph request failed (500): Find failed');
    });

    it('throws when copy fails', async () => {
      const mockReplyResponse = new Response(null, { status: 202 });
      const mockFindResponse = new Response(JSON.stringify({ value: [{ id: 'sent-msg-id' }] }), { status: 200 });
      const mockCopyFailResponse = new Response('Copy failed', { status: 500 });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockEmptyResponse())     // inbox check
        .mockResolvedValueOnce(mockEmptyResponse())     // sentitems check
        .mockResolvedValueOnce(mockReplyResponse)       // reply
        .mockResolvedValueOnce(mockFindResponse)        // find after reply
        .mockResolvedValueOnce(mockCopyFailResponse);   // copy fails

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        OutlookProviderUtil.sendSelfSummaryReply('test-access-token', { id: 'original-msg-id' }, 'sender@example.com', 'Summary text'),
      ).rejects.toThrow('Microsoft Graph copy message failed (500): Copy failed');
    });

    it('throws when delete fails', async () => {
      const mockReplyResponse = new Response(null, { status: 202 });
      const mockFindResponse = new Response(JSON.stringify({ value: [{ id: 'sent-msg-id' }] }), { status: 200 });
      const mockCopyResponse = new Response(JSON.stringify({ id: 'copy-id-456' }), { status: 201 });
      const mockDeleteFailResponse = new Response('Delete failed', { status: 500 });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockEmptyResponse())       // inbox check
        .mockResolvedValueOnce(mockEmptyResponse())       // sentitems check
        .mockResolvedValueOnce(mockReplyResponse)         // reply
        .mockResolvedValueOnce(mockFindResponse)          // find after reply
        .mockResolvedValueOnce(mockCopyResponse)          // copy
        .mockResolvedValueOnce(mockDeleteFailResponse);   // delete fails

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        OutlookProviderUtil.sendSelfSummaryReply('test-access-token', { id: 'original-msg-id' }, 'sender@example.com', 'Summary text'),
      ).rejects.toThrow('Microsoft Graph delete message failed (500): Delete failed');
    });
  });
});
