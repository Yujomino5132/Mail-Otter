import { NonRetryableError } from './NonRetryableError';
import { RetryableError } from './RetryableError';

class AiSummaryRetryableError extends RetryableError {}

class ProviderApiRetryableError extends RetryableError {}

class ProviderApiNonRetryableError extends NonRetryableError {}

class OAuth2TokenRetryableError extends RetryableError {}

class OAuth2TokenNonRetryableError extends NonRetryableError {}

export {
  AiSummaryRetryableError,
  OAuth2TokenNonRetryableError,
  OAuth2TokenRetryableError,
  ProviderApiNonRetryableError,
  ProviderApiRetryableError,
};
