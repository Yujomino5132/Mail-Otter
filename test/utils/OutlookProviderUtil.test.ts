import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutlookProviderUtil } from '@mail-otter/provider-clients/outlook';

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
        .mockResolvedValueOnce(mockReplyResponse)
        .mockResolvedValueOnce(mockFindResponse)
        .mockResolvedValueOnce(mockCopyResponse)
        .mockResolvedValueOnce(mockDeleteResponse);

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

      expect(fetchMock).toHaveBeenCalledTimes(4);

      // Step 1: reply with sink address
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'https://graph.microsoft.com/v1.0/me/messages/original-msg-id/reply',
        expect.objectContaining({ method: 'POST' }),
      );

      const replyCall = fetchMock.mock.calls[0];
      const replyHeaders = replyCall[1].headers as Record<string, string>;
      const parsedBody: Record<string, unknown> = JSON.parse(replyCall[1].body as string);

      expect(replyHeaders['Content-Type']).toBe('application/json');
      expect(replyHeaders['Authorization']).toBe('Bearer test-access-token');
      expect(parsedBody).toEqual({
        message: {
          body: {
            contentType: 'html',
            content: htmlSummary,
          },
          toRecipients: [
            {
              emailAddress: {
                address: 'sender+sink@example.com',
              },
            },
          ],
          internetMessageHeaders: [
            { name: 'X-Mail-Otter-Summary', value: 'true' },
          ],
        },
      });

      // Step 2: find sent summary message
      const findUrl = fetchMock.mock.calls[1][0] as string;
      expect(findUrl).toContain('/me/mailFolders/sentitems/messages');
      expect(findUrl).toContain('internetMessageHeaders');
      expect(findUrl).toContain('X-Mail-Otter-Summary');
      expect(findUrl).toContain(encodeURIComponent('$top') + '=1');
      expect(findUrl).toContain(encodeURIComponent('$orderby') + '=sentDateTime+desc');

      // Step 3: copy sent message to inbox
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        'https://graph.microsoft.com/v1.0/me/messages/sent-msg-id/copy',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ destinationId: 'inbox' }),
        }),
      );

      // Step 4: delete sent copy
      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        'https://graph.microsoft.com/v1.0/me/messages/sent-msg-id',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('throws when reply fails', async () => {
      const mockReplyResponse = new Response('Reply failed', { status: 500 });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockReplyResponse));

      await expect(
        OutlookProviderUtil.sendSelfSummaryReply('test-access-token', { id: 'original-msg-id' }, 'sender@example.com', 'Summary text'),
      ).rejects.toThrow('Microsoft Graph send summary reply failed (500): Reply failed');
    });

    it('throws when find returns no results', async () => {
      const mockReplyResponse = new Response(null, { status: 202 });
      const mockFindResponse = new Response(JSON.stringify({ value: [] }), { status: 200 });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockReplyResponse)
        .mockResolvedValueOnce(mockFindResponse);

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        OutlookProviderUtil.sendSelfSummaryReply('test-access-token', { id: 'original-msg-id' }, 'sender@example.com', 'Summary text'),
      ).rejects.toThrow('Microsoft Graph did not return the sent summary message.');
    });

    it('throws when find fails', async () => {
      const mockReplyResponse = new Response(null, { status: 202 });
      const mockFindResponse = new Response(JSON.stringify({ error: { message: 'Find failed' } }), { status: 500 });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockReplyResponse)
        .mockResolvedValueOnce(mockFindResponse);

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        OutlookProviderUtil.sendSelfSummaryReply('test-access-token', { id: 'original-msg-id' }, 'sender@example.com', 'Summary text'),
      ).rejects.toThrow('Microsoft Graph request failed (500): Find failed');
    });

    it('throws when copy fails', async () => {
      const mockReplyResponse = new Response(null, { status: 202 });
      const mockFindResponse = new Response(JSON.stringify({ value: [{ id: 'sent-msg-id' }] }), { status: 200 });
      const mockCopyResponse = new Response('Copy failed', { status: 500 });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockReplyResponse)
        .mockResolvedValueOnce(mockFindResponse)
        .mockResolvedValueOnce(mockCopyResponse);

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        OutlookProviderUtil.sendSelfSummaryReply('test-access-token', { id: 'original-msg-id' }, 'sender@example.com', 'Summary text'),
      ).rejects.toThrow('Microsoft Graph copy message failed (500): Copy failed');
    });
  });
});
