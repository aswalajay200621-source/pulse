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
  created_at: string;
  updated_at: string;
}

export interface MonitoringCheckRecord {
  id: string;
  application_id: string;
  status: "online" | "degraded" | "down" | "maintenance";
  status_code: number | null;
  response_time: number | null; // in ms
  checked_at: string;
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

export interface NotificationPreferenceRecord {
  id: string;
  user_id: string;
  email_enabled: boolean;
  weekly_report_enabled: boolean;
  created_at: string;
  updated_at: string;
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
    };
  };
};
