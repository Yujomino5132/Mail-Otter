import { PROVIDER_GOOGLE_GMAIL } from '@mail-otter/shared/constants';
import { GmailProviderUtil } from '@mail-otter/provider-clients/gmail';
import type { ApplicationContextDocumentSource, CalendarAddEventActionPayload, ConnectedApplicationMetadata, EmailActionResult, EmailDraftReplyActionPayload } from '@mail-otter/shared/model';
import type { IEmailProvider, ProviderFolder } from './IEmailProvider';

class GmailEmailProvider implements IEmailProvider {
  public readonly providerId = PROVIDER_GOOGLE_GMAIL;

  public async listFolders(accessToken: string): Promise<ProviderFolder[]> {
    const labels = await GmailProviderUtil.listLabels(accessToken);
    return labels.map((label) => ({ id: label.id, name: label.name }));
  }

  public async stopWatch(accessToken: string): Promise<void> {
    await GmailProviderUtil.stopWatch(accessToken);
  }

  public getProviderUrl(document: ApplicationContextDocumentSource, application: ConnectedApplicationMetadata): string {
    const url = new URL('https://mail.google.com/mail/u/');
    if (application.providerEmail) url.searchParams.set('authuser', application.providerEmail);
    url.hash = `all/${document.sourceThreadId || document.sourceDocumentId}`;
    return url.toString();
  }

  public async createCalendarEvent(accessToken: string, payload: CalendarAddEventActionPayload): Promise<EmailActionResult> {
    const result = await GmailProviderUtil.createCalendarEvent(accessToken, payload);
    return { summary: 'Calendar event created.', providerOperationId: result.id, providerUrl: result.htmlLink };
  }

  public async createDraftReply(
    accessToken: string,
    messageId: string,
    fromEmail: string,
    payload: EmailDraftReplyActionPayload,
  ): Promise<EmailActionResult> {
    const message = await GmailProviderUtil.getMessage(accessToken, messageId);
    const result = await GmailProviderUtil.createDraftReply(accessToken, fromEmail, message, payload.draftBody, payload.draftSubject);
    return { summary: 'Draft reply created.', providerOperationId: result.id || result.message?.id };
  }
}

export { GmailEmailProvider };
