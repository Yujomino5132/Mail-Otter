import type { EmailActionExecutionList, EmailActionList } from '@mail-otter/shared/model';
import type { EmailActionStatus } from '@mail-otter/shared/constants';
import { createActionDAO } from './ActionServiceUtils';
import { createActionsForSummary } from './ActionCreationService';
import { renderActionItems, renderEmailActionSection } from './ActionRenderService';
import { getConfirmationResponse, executeActionWithToken, executeActionForUser, autoExecuteCreatedActions } from './ActionExecutionService';
import { expirePendingActions, deleteOldActions } from './ActionMaintenanceService';
import { snoozeAction, scheduleAction, executeScheduledActions } from './ActionSchedulingService';

export type {
  ActionCallbackEnv,
  ActionExecutionEnv,
  ActionHtmlResponse,
  UserActionEnv,
} from './ActionExecutionService';

export type {
  ActionCreationEnv,
  CreatedEmailAction,
  CreateActionsForSummaryInput,
} from './ActionCreationService';

export type { ActionMaintenanceEnv } from './ActionMaintenanceService';
export type { ActionSchedulingEnv, ScheduledExecutionResult } from './ActionSchedulingService';

interface ListActionsInput {
  applicationId?: string;
  status?: EmailActionStatus;
  cursor?: string;
  showSnoozed?: boolean;
}

type UserActionListEnv = import('./ActionServiceUtils').ActionDAOEnv;

class ActionService {
  public static createActionsForSummary = createActionsForSummary;
  public static autoExecuteCreatedActions = autoExecuteCreatedActions;
  public static renderActionItems = renderActionItems;
  public static renderEmailActionSection = renderEmailActionSection;
  public static getConfirmationResponse = getConfirmationResponse;
  public static executeActionWithToken = executeActionWithToken;
  public static executeActionForUser = executeActionForUser;
  public static expirePendingActions = expirePendingActions;
  public static deleteOldActions = deleteOldActions;
  public static snoozeAction = snoozeAction;
  public static scheduleAction = scheduleAction;
  public static executeScheduledActions = executeScheduledActions;

  public static async listActionsForUser(userEmail: string, input: ListActionsInput, env: UserActionListEnv): Promise<EmailActionList> {
    const dao = await createActionDAO(env);
    return dao.listActionsForUser(userEmail, input);
  }

  public static async listExecutionsForUser(actionId: string, userEmail: string, env: UserActionListEnv): Promise<EmailActionExecutionList> {
    const dao = await createActionDAO(env);
    return dao.listExecutionsForUser(actionId, userEmail);
  }
}

export type { ListActionsInput, UserActionListEnv };
export { ActionService };
