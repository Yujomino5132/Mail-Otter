const ZERO_TRUST_AUTHENTICATION_PATH = '/user/';

interface OAuth2Feature {
  label: string;
}

const OAUTH2_FEATURES: Record<string, OAuth2Feature> = {
  calendar: { label: 'Calendar' },
  google_drive: { label: 'Google Drive' },
  onedrive: { label: 'OneDrive' },
};

const OAUTH2_FEATURE_SCOPES: Record<string, Record<string, string[]>> = {
  calendar: {
    'google-gmail': ['https://www.googleapis.com/auth/calendar.events'],
    'microsoft-outlook': ['https://graph.microsoft.com/Calendars.ReadWrite'],
    'fastmail-jmap': ['urn:ietf:params:jmap:calendars'],
  },
  google_drive: {
    'google-gmail': ['https://www.googleapis.com/auth/drive.readonly'],
  },
  onedrive: {
    'microsoft-outlook': ['https://graph.microsoft.com/Files.Read'],
  },
};

export { OAUTH2_FEATURE_SCOPES, OAUTH2_FEATURES, ZERO_TRUST_AUTHENTICATION_PATH };
export type { OAuth2Feature };
