import { BadRequestError } from '@mail-otter/backend-errors';
import { GmailEmailProvider } from './GmailEmailProvider';
import { OutlookEmailProvider } from './OutlookEmailProvider';
import type { IEmailProvider } from './IEmailProvider';

const gmailProvider = new GmailEmailProvider();
const outlookProvider = new OutlookEmailProvider();

const PROVIDERS: ReadonlyMap<string, IEmailProvider> = new Map<string, IEmailProvider>([
  [gmailProvider.providerId, gmailProvider],
  [outlookProvider.providerId, outlookProvider],
]);

class EmailProviderRegistry {
  public static get(providerId: string): IEmailProvider {
    const provider = PROVIDERS.get(providerId);
    if (!provider) throw new BadRequestError(`Unsupported provider: ${providerId}`);
    return provider;
  }
}

export { EmailProviderRegistry };
export type { IEmailProvider };
