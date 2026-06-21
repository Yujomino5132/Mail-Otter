import { PROVIDER_MICROSOFT_OUTLOOK } from '@mail-otter/shared/constants';
import { OutlookProviderUtil } from '@mail-otter/provider-clients/outlook';
import type { ApplicationContextDocumentSource, CalendarAddEventActionPayload, ConnectedApplicationMetadata, EmailActionResult, EmailDraftReplyActionPayload } from '@mail-otter/shared/model';
import type { IEmailProvider, ProviderFolder } from './IEmailProvider';

class OutlookEmailProvider implements IEmailProvider {
  public readonly providerId = PROVIDER_MICROSOFT_OUTLOOK;

  public async listFolders(accessToken: string): Promise<ProviderFolder[]> {
    const folders = await OutlookProviderUtil.listMailFolders(accessToken);
    return folders.map((folder) => ({ id: folder.id, name: folder.displayName }));
  }

  public async stopWatch(accessToken: string, externalSubscriptionId?: string | undefined): Promise<void> {
    if (externalSubscriptionId) {
      await OutlookProviderUtil.deleteSubscription(accessToken, externalSubscriptionId);
    }
  }

  public getProviderUrl(document: ApplicationContextDocumentSource, application: ConnectedApplicationMetadata): string {
    const url = new URL(`https://outlook.office.com/mail/deeplink/read/${encodeURIComponent(document.sourceDocumentId)}`);
    if (application.providerEmail) url.searchParams.set('login_hint', application.providerEmail);
    return url.toString();
  }

  public async createCalendarEvent(accessToken: string, payload: CalendarAddEventActionPayload): Promise<EmailActionResult> {
    const result = await OutlookProviderUtil.createCalendarEvent(accessToken, payload);
    return { summary: 'Calendar event created.', providerOperationId: result.id, providerUrl: result.webLink };
  }

  public async createDraftReply(
    accessToken: string,
    messageId: string,
    _fromEmail: string,
    payload: EmailDraftReplyActionPayload,
  ): Promise<EmailActionResult> {
    const result = await OutlookProviderUtil.createDraftReply(accessToken, messageId, payload.draftBody);
    return { summary: 'Draft reply created.', providerOperationId: result.id, providerUrl: result.webLink };
  }
}

export { OutlookEmailProvider };
