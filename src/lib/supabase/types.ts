export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ApplicationRecord {
  id: string;
  user_id: string;
  name: string;
  url: string;
  description: string | null;
  github_repository_url: string | null;
  monitoring_enabled: boolean;
  health_check_path: string | null;
  health_check_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonitoringCheckRecord {
  id: string;
  application_id: string;
  status: "online" | "degraded" | "down" | "maintenance";
  status_code: number | null;
  response_time: number | null; // in ms
  error_message?: string | null;
  is_slow?: boolean;
  job_id?: string | null;
  checked_at: string;
}

export interface MonitoringIncidentRecord {
  id: string;
  application_id: string;
  user_id: string;
  status: "open" | "resolved";
  consecutive_failures: number;
  started_at: string;
  resolved_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface MonitoringJobRecord {
  id: string;
  idempotency_key: string | null;
  status: "running" | "completed" | "failed";
  total_apps: number;
  succeeded_count: number;
  failed_count: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface SecurityScanRecord {
  id: string;
  application_id: string;
  scan_status: "completed" | "in_progress" | "failed";
  scanned_at: string;
}

export interface SecurityFindingRecord {
  id: string;
  scan_id: string;
  application_id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  affected_resource: string | null;
  created_at: string;
}

export interface AlertRecord {
  id: string;
  user_id: string;
  application_id: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  is_read: boolean;
  created_at: string;
}

export interface ExpiryRecord {
  id: string;
  application_id: string;
  expiry_type: "ssl_certificate" | "domain" | "api_key" | "token";
  expiry_date: string;
  created_at: string;
}

export type ExpiryCategory =
  | "ssl_certificate"
  | "domain"
  | "api_key"
  | "oauth_token"
  | "service_account"
  | "integration"
  | "other";

export type ExpiryStatus = "healthy" | "expiring_soon" | "expired" | "unknown" | "error";

export interface ExpiryItemRecord {
  id: string;
  user_id: string;
  application_id: string | null;
  category: ExpiryCategory;
  name: string;
  description: string | null;
  target_host: string | null;
  issuer: string | null;
  expiry_date: string | null;
  status: ExpiryStatus;
  days_remaining: number | null;
  source: "tls_handshake" | "rdap" | "manual";
  error_message: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpiryReminderRecord {
  id: string;
  expiry_item_id: string;
  user_id: string;
  threshold: "30d" | "7d" | "1d" | "expired";
  expiry_date_snapshot: string;
  sent_at: string;
}

export interface NotificationPreferenceRecord {
  id: string;
  user_id: string;
  email_enabled: boolean;
  weekly_report_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface GithubInstallationRecord {
  id: string;
  user_id: string;
  installation_id: number;
  account_login: string;
  account_id: number;
  account_type: string;
  account_avatar_url: string | null;
  target_type: string | null;
  permissions: Record<string, string> | null;
  installed_at: string;
  updated_at: string;
}

export interface GithubRepositoryRecord {
  id: string;
  installation_id: number;
  user_id: string;
  repo_id: number;
  name: string;
  full_name: string;
  owner_login: string;
  default_branch: string;
  is_private: boolean;
  html_url: string;
  application_id: string | null;
  last_synchronized_at: string;
  created_at: string;
}

export interface GithubWebhookEventRecord {
  id: string;
  delivery_id: string;
  event_type: string;
  action: string | null;
  installation_id: number | null;
  payload: Record<string, unknown> | null;
  processed: boolean;
  error: string | null;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Profile>;
      };
      applications: {
        Row: ApplicationRecord;
        Insert: Omit<ApplicationRecord, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ApplicationRecord, "id" | "user_id">>;
      };
      monitoring_checks: {
        Row: MonitoringCheckRecord;
        Insert: Omit<MonitoringCheckRecord, "id" | "checked_at"> & {
          id?: string;
          checked_at?: string;
        };
        Update: Partial<MonitoringCheckRecord>;
      };
      security_scans: {
        Row: SecurityScanRecord;
        Insert: Omit<SecurityScanRecord, "id" | "scanned_at"> & {
          id?: string;
          scanned_at?: string;
        };
        Update: Partial<SecurityScanRecord>;
      };
      security_findings: {
        Row: SecurityFindingRecord;
        Insert: Omit<SecurityFindingRecord, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<SecurityFindingRecord>;
      };
      alerts: {
        Row: AlertRecord;
        Insert: Omit<AlertRecord, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AlertRecord>;
      };
      expiry_records: {
        Row: ExpiryRecord;
        Insert: Omit<ExpiryRecord, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<ExpiryRecord>;
      };
      notification_preferences: {
        Row: NotificationPreferenceRecord;
        Insert: Omit<NotificationPreferenceRecord, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<NotificationPreferenceRecord>;
      };
      github_installations: {
        Row: GithubInstallationRecord;
        Insert: Omit<GithubInstallationRecord, "id" | "installed_at" | "updated_at"> & {
          id?: string;
          installed_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<GithubInstallationRecord, "id" | "user_id">>;
      };
      github_repositories: {
        Row: GithubRepositoryRecord;
        Insert: Omit<GithubRepositoryRecord, "id" | "created_at" | "last_synchronized_at"> & {
          id?: string;
          created_at?: string;
          last_synchronized_at?: string;
        };
        Update: Partial<Omit<GithubRepositoryRecord, "id" | "user_id">>;
      };
      github_webhook_events: {
        Row: GithubWebhookEventRecord;
        Insert: Omit<GithubWebhookEventRecord, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<GithubWebhookEventRecord>;
      };
    };
  };
};
