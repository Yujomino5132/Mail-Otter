import { IUserRoute } from '@/endpoints/IUserRoute';
import type { IUserEnv, IRequest, IResponse, RouteContext } from '@/endpoints/IUserRoute';
import { UserService } from '@mail-otter/backend-services/user';
import type { UserServiceEnv } from '@mail-otter/backend-services/user';

class GetCurrentUserRoute extends IUserRoute<GetCurrentUserRequest, GetCurrentUserResponse, GetCurrentUserEnv> {
  schema = {
    tags: ['User'],
    summary: 'Get current user',
    responses: {
      '200': {
        description: 'Current user metadata',
      },
    },
  };

  protected async handleRequest(
    _request: GetCurrentUserRequest,
    env: GetCurrentUserEnv,
    cxt: RouteContext<GetCurrentUserEnv>,
  ): Promise<GetCurrentUserResponse> {
    const summary = await UserService.getCurrentUserSummary(env);
    return {
      email: this.getAuthenticatedUserEmailAddress(cxt),
      ...summary,
    };
  }
}

type GetCurrentUserRequest = IRequest;

interface GetCurrentUserResponse extends IResponse {
  email: string;
  limits: {
    maxApplicationsPerUser: number;
    maxContextDocumentsPerApplication: number;
  };
  aiUsage: {
    estimatedNeurons: number;
    dailyNeuronLimit: number;
    fallbackThreshold: number;
  };
}

interface GetCurrentUserEnv extends IUserEnv, UserServiceEnv {}

export { GetCurrentUserRoute };
