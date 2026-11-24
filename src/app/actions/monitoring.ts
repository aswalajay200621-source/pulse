"use server";

import { createClient } from "@/lib/supabase/server";
import {
  calculateMonitoringStats,
  type MonitoringStats,
  type MonitoringWindow,
} from "@/lib/monitoring/stats";
import type {
  ApplicationRecord,
  MonitoringCheckRecord,
  MonitoringIncidentRecord,
} from "@/lib/supabase/types";

export interface MonitoringDashboardData {
  applications: ApplicationRecord[];
  checksByApp: Record<string, MonitoringCheckRecord[]>;
  incidents: MonitoringIncidentRecord[];
  statsByApp: Record<string, MonitoringStats>;
}

export async function getMonitoringDashboardData(
  window: MonitoringWindow = "24h"
): Promise<{ data?: MonitoringDashboardData; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  const { data: apps, error: appsError } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (appsError) {
    return { error: appsError.message };
  }

  const applications = (apps || []) as ApplicationRecord[];
  const appIds = applications.map((a) => a.id);

  if (appIds.length === 0) {
    return {
      data: {
        applications: [],
        checksByApp: {},
        incidents: [],
        statsByApp: {},
      },
    };
  }

  // Fetch last 30 days of checks for user's applications
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [checksRes, incidentsRes] = await Promise.all([
    supabase
      .from("monitoring_checks")
      .select("*")
      .in("application_id", appIds)
      .gte("checked_at", thirtyDaysAgo)
      .order("checked_at", { ascending: false })
      .limit(1000),
    supabase
      .from("monitoring_incidents")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(50),
  ]);

  const checks = (checksRes.data || []) as MonitoringCheckRecord[];
  const incidents = (incidentsRes.data || []) as MonitoringIncidentRecord[];

  const checksByApp: Record<string, MonitoringCheckRecord[]> = {};
  const statsByApp: Record<string, MonitoringStats> = {};

  for (const app of applications) {
    const appChecks = checks.filter((c) => c.application_id === app.id);
    checksByApp[app.id] = appChecks;
    statsByApp[app.id] = calculateMonitoringStats(appChecks, window);
  }

  return {
    data: {
      applications,
      checksByApp,
      incidents,
      statsByApp,
    },
  };
}
