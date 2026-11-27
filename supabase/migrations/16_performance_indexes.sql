-- Composite indexes for frequently queried dashboard and application detail paths

create index if not exists idx_applications_user_created
  on public.applications(user_id, created_at desc);

create index if not exists idx_monitoring_checks_app_checked
  on public.monitoring_checks(application_id, checked_at desc);

create index if not exists idx_security_findings_app_status
  on public.security_findings(application_id, status);

create index if not exists idx_alerts_user_created
  on public.alerts(user_id, created_at desc);

create index if not exists idx_hc_results_app_checked
  on public.health_check_results(application_id, checked_at desc);

create index if not exists idx_expiry_items_user_days
  on public.expiry_items(user_id, days_remaining asc);
