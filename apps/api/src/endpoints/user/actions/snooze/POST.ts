import { BadRequestError } from '@mail-otter/backend-errors';
import { IUserRoute } from '@/endpoints/IUserRoute';
import type { IUserEnv, IRequest, IResponse, RouteContext } from '@/endpoints/IUserRoute';
import { ActionService } from '@mail-otter/backend-services/action';
import type { EmailAction } from '@mail-otter/shared/model';

class SnoozeEmailActionRoute extends IUserRoute<SnoozeEmailActionRequest, SnoozeEmailActionResponse, SnoozeEmailActionEnv> {
  schema = {
    tags: ['Actions'],
    summary: 'Snooze a pending email action until a future time',
    responses: {
      '200': { description: 'Updated email action' },
    },
  };

  protected async handleRequest(
    request: SnoozeEmailActionRequest,
    env: SnoozeEmailActionEnv,
    cxt: RouteContext<SnoozeEmailActionEnv>,
  ): Promise<SnoozeEmailActionResponse> {
    const actionId: string | undefined = cxt.req.param('actionId');
    if (!actionId) throw new BadRequestError('Action snooze request is missing actionId.');
    const body = await request.raw.json<{ snoozedUntil: string | null }>();
    const snoozedUntil: Date | null = body.snoozedUntil ? new Date(body.snoozedUntil) : null;
    const action = await ActionService.snoozeAction(env, actionId, this.getAuthenticatedUserEmailAddress(cxt), snoozedUntil);
    return { action };
  }
}

type SnoozeEmailActionRequest = IRequest;

interface SnoozeEmailActionResponse extends IResponse {
  action: EmailAction;
}

interface SnoozeEmailActionEnv extends IUserEnv {
  ACTION_ENCRYPTION_KEY_SECRET: SecretsStoreSecret;
  ACTION_SIGNING_SECRET: SecretsStoreSecret;
  AES_ENCRYPTION_KEY_SECRET: SecretsStoreSecret;
  OAUTH2_TOKEN_CACHE: KVNamespace;
  OAUTH2_TOKEN_REFRESHERS: DurableObjectNamespace;
  OAUTH2_ACCESS_TOKEN_MIN_VALID_SECONDS?: string;
}

export { SnoozeEmailActionRoute };
