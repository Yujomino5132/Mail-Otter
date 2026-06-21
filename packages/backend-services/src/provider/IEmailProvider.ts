import type { ApplicationContextDocumentSource, CalendarAddEventActionPayload, ConnectedApplicationMetadata, EmailActionResult, EmailDraftReplyActionPayload } from '@mail-otter/shared/model';

interface ProviderFolder {
  id: string;
  name: string;
}

interface IEmailProvider {
  readonly providerId: string;
  listFolders(accessToken: string): Promise<ProviderFolder[]>;
  stopWatch(accessToken: string, externalSubscriptionId?: string | undefined): Promise<void>;
  getProviderUrl(document: ApplicationContextDocumentSource, application: ConnectedApplicationMetadata): string;
  createCalendarEvent(accessToken: string, payload: CalendarAddEventActionPayload): Promise<EmailActionResult>;
  createDraftReply(accessToken: string, messageId: string, fromEmail: string, payload: EmailDraftReplyActionPayload): Promise<EmailActionResult>;
}

export type { IEmailProvider, ProviderFolder };
