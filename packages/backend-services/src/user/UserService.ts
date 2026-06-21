import { AiDailyUsageDAO, UserDAO } from '@mail-otter/backend-data/dao';
import { ConfigurationManager } from '@mail-otter/backend-runtime/config';

interface UserServiceEnv {
  DB: D1Database;
  MAX_APPLICATIONS_PER_USER?: string | undefined;
  MAX_CONTEXT_DOCUMENTS_PER_APPLICATION?: string | undefined;
  AI_DAILY_NEURON_FREE_TIER_LIMIT?: string | undefined;
  AI_DAILY_NEURON_FALLBACK_THRESHOLD?: string | undefined;
}

interface CurrentUserSummary {
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

class UserService {
  public static async upsertUser(email: string, db: D1Database): Promise<void> {
    await new UserDAO(db).upsertByEmail(email);
  }

  public static async getCurrentUserSummary(env: UserServiceEnv): Promise<CurrentUserSummary> {
    const today = new Date().toISOString().slice(0, 10);
    const usage = await new AiDailyUsageDAO(env.DB).getByDate(today);
    return {
      limits: {
        maxApplicationsPerUser: ConfigurationManager.getMaxApplicationsPerUser(env),
        maxContextDocumentsPerApplication: ConfigurationManager.getMaxContextDocumentsPerApplication(env),
      },
      aiUsage: {
        estimatedNeurons: usage?.estimatedNeurons ?? 0,
        dailyNeuronLimit: ConfigurationManager.getAiDailyNeuronFreeTierLimit(env),
        fallbackThreshold: ConfigurationManager.getAiDailyNeuronFallbackThreshold(env),
      },
    };
  }
}

export { UserService };
export type { CurrentUserSummary, UserServiceEnv };
