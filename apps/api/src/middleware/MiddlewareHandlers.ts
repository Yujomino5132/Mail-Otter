import { ServiceError } from '@mail-otter/backend-errors';
import { EmailValidationUtil } from '@mail-otter/backend-services/auth';
import { UserService } from '@mail-otter/backend-services/user';
import { Context, Next } from 'hono';

type UserContext = Context<{ Bindings: Env; Variables: { AuthenticatedUserEmailAddress: string } }>;

class MiddlewareHandlers {
  public static userAuthentication() {
    return async (c: UserContext, next: Next): Promise<Response | void> => {
      try {
        const userEmail: string = await EmailValidationUtil.getAuthenticatedUserEmail(c.req.raw, c.env);
        await UserService.upsertUser(userEmail, c.env.DB);
        c.set('AuthenticatedUserEmailAddress', userEmail);
        await next();
      } catch (error: unknown) {
        if (error instanceof ServiceError && error.getErrorCode() < 500) {
          return c.json({ Exception: { Type: error.getErrorType(), Message: error.getErrorMessage() } }, error.getErrorCode());
        }
        throw error;
      }
    };
  }
}

export { MiddlewareHandlers };
