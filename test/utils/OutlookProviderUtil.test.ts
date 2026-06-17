import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutlookProviderUtil } from '@mail-otter/provider-clients/outlook';

describe('OutlookProviderUtil', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendSelfSummaryReply', () => {
    it('sends a threaded reply and deletes the sent copy', async () => {
      const mockCreateReplyResponse = new Response(JSON.stringify({ id: 'draft-id-123' }), { status: 201 });
      const mockPatchResponse = new Response('', { status: 200 });
      const mockSendResponse = new Response('', { status: 202 });
      const mockDeleteResponse = new Response(null, { status: 204 });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockCreateReplyResponse)
        .mockResolvedValueOnce(mockPatchResponse)
        .mockResolvedValueOnce(mockSendResponse)
        .mockResolvedValueOnce(mockDeleteResponse);

      vi.stubGlobal('fetch', fetchMock);

      const originalMessage = { id: 'original-msg-id' };

      const htmlSummary =
        '<p><strong>Gist:</strong> Summary &lt;tag&gt; &amp; text</p>\n<p><strong>Key details:</strong></p>\n<ul>\n<li>Next line</li>\n</ul>';
      await OutlookProviderUtil.sendSelfSummaryReply(
        'test-access-token',
        originalMessage,
        'sender@example.com',
        htmlSummary,
      );

      expect(fetchMock).toHaveBeenCalledTimes(4);

      // Step 1: createReply with empty body to get proper threading
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'https://graph.microsoft.com/v1.0/me/messages/original-msg-id/createReply',
        expect.objectContaining({ method: 'POST' }),
      );
      const createReplyCall = fetchMock.mock.calls[0];
      const createReplyHeaders = createReplyCall[1].headers as Headers;
      const parsedCreateReplyBody: Record<string, unknown> = JSON.parse(createReplyCall[1].body as string);
      expect(createReplyHeaders.get('Content-Type')).toBe('application/json');
      expect(parsedCreateReplyBody).toEqual({});

      // Step 2: PATCH the draft to set body, recipients, and headers
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'https://graph.microsoft.com/v1.0/me/messages/draft-id-123',
        expect.objectContaining({ method: 'PATCH' }),
      );
      const patchCall = fetchMock.mock.calls[1];
      const patchBody: Record<string, unknown> = JSON.parse(patchCall[1].body as string);
      expect(patchBody).toEqual({
        body: {
          contentType: 'html',
          content: htmlSummary,
        },
        toRecipients: [
          {
            emailAddress: {
              address: 'sender@example.com',
            },
          },
        ],
        internetMessageHeaders: [
          { name: 'X-Mail-Otter-Summary', value: 'true' },
        ],
      });

      // Step 3: Send the draft
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        'https://graph.microsoft.com/v1.0/me/messages/draft-id-123/send',
        expect.objectContaining({ method: 'POST' }),
      );

      // Step 4: Delete the sent copy
      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        'https://graph.microsoft.com/v1.0/me/messages/draft-id-123',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('throws when patch fails', async () => {
      const mockCreateReplyResponse = new Response(JSON.stringify({ id: 'draft-id-123' }), { status: 201 });
      const mockPatchResponse = new Response('Patch failed', { status: 400 });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockCreateReplyResponse)
        .mockResolvedValueOnce(mockPatchResponse);

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        OutlookProviderUtil.sendSelfSummaryReply('test-access-token', { id: 'original-msg-id' }, 'sender@example.com', 'Summary text'),
      ).rejects.toThrow('Microsoft Graph patch draft failed (400): Patch failed');
    });

    it('throws when send fails', async () => {
      const mockCreateReplyResponse = new Response(JSON.stringify({ id: 'draft-id-123' }), { status: 201 });
      const mockPatchResponse = new Response('', { status: 200 });
      const mockSendResponse = new Response('Send failed', { status: 500 });

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockCreateReplyResponse)
        .mockResolvedValueOnce(mockPatchResponse)
        .mockResolvedValueOnce(mockSendResponse);

      vi.stubGlobal('fetch', fetchMock);

      await expect(
        OutlookProviderUtil.sendSelfSummaryReply('test-access-token', { id: 'original-msg-id' }, 'sender@example.com', 'Summary text'),
      ).rejects.toThrow('Microsoft Graph send summary failed (500): Send failed');
    });

    it('throws when createReply fails', async () => {
      const mockCreateReplyResponse = new Response(JSON.stringify({ error: { message: 'createReply failed' } }), { status: 400 });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockCreateReplyResponse));

      await expect(
        OutlookProviderUtil.sendSelfSummaryReply('test-access-token', { id: 'original-msg-id' }, 'sender@example.com', 'Summary text'),
      ).rejects.toThrow('Microsoft Graph request failed (400): createReply failed');
    });

    it('throws when draft has no id', async () => {
      const mockCreateReplyResponse = new Response('{}', { status: 200 });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockCreateReplyResponse));

      await expect(
        OutlookProviderUtil.sendSelfSummaryReply('test-access-token', { id: 'original-msg-id' }, 'sender@example.com', 'Summary text'),
      ).rejects.toThrow('Microsoft Graph createReply did not return a draft id.');
    });
  });
});


