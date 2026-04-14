// src/pages/StatsDashboard.tsx
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  MapPin,
  Users,
  Clock,
  Activity,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import {
  useDashboardStats,
  useComplaintTrends,
  useStationPerformance,
  useOfficerWorkload,
} from "@/hooks/useApi";
import { useStations } from "@/hooks/useStations";

type TrendPoint = {
  date: string;
  total?: number;
  resolved?: number;
  open?: number;
};

type StationStat = {
  station_id: string;
  station_name: string;
  total_complaints?: number;
  open_complaints?: number;
  closed_complaints?: number;
  avg_resolution_hours?: number;
};

type OfficerWorkloadItem = {
  officer_id: string;
  officer_name: string;
  open_complaints?: number;
  closed_complaints?: number;
  total_complaints?: number;
};

const StatsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [days, setDays] = useState<number>(30);
  const [selectedStationId, setSelectedStationId] = useState<string>("all");

  const isAdmin = user?.role === "admin";
  const isPolice = user?.role === "police";

  // Core stats
  const {
    data: dashboardRaw = {},
    isLoading: statsLoading,
    error: statsError,
  } = useDashboardStats(days, selectedStationId, isPolice ? 'my' : undefined);

  const {
    data: trendsRaw = {},
    isLoading: trendsLoading,
    error: trendsError,
  } = useComplaintTrends(days, selectedStationId, isPolice ? 'my' : undefined);

  const {
    data: stationPerfRaw = {},
    isLoading: stationLoading,
    error: stationError,
  } = useStationPerformance(days, selectedStationId);



  const {
    data: stationsListRaw,
    isLoading: stationsLoading,
  } = useStations({ limit: 200, enabled: isAdmin });

  // Safe-normalised shapes
  const dashboardStats: any = dashboardRaw || {};
  const statusCounts = dashboardStats.status_counts || {
    not_assigned: 0,
    investigating: 0,
    resolved: 0,
    closed: 0,
    rejected: 0,
  };
  const trends: TrendPoint[] = (trendsRaw as any)?.daily || [];
  const stationStats: StationStat[] = (stationPerfRaw as any)?.stations || [];

  const stations = stationsListRaw?.data || [];

  // Figure out current user station (for cops)
  const userStationId: string | null =
    (user as any)?.station?.station_id || (user as any)?.station_id || null;

  const filteredStationStats: StationStat[] = useMemo(() => {
    if (!stationStats || stationStats.length === 0) return [];

    // Admin can filter by any station
    if (isAdmin) {
      if (!selectedStationId || selectedStationId === "all") {
        return stationStats;
      }
      return stationStats.filter(
        (s) => s.station_id === selectedStationId || s.station_name === selectedStationId
      );
    }

    // Police: restrict to their own station
    if (isPolice && userStationId) {
      return stationStats.filter(
        (s) =>
          s.station_id === userStationId ||
          s.station_name?.toLowerCase() ===
          (user as any)?.station?.station_name?.toLowerCase()
      );
    }

    return stationStats;
  }, [stationStats, isAdmin, isPolice, selectedStationId, userStationId, user]);

  const maxTrendValue =
    trends.length > 0
      ? Math.max(...trends.map((t) => t.total ?? t.open ?? 0))
      : 0;

  const maxStationTotal =
    filteredStationStats.length > 0
      ? Math.max(
        ...filteredStationStats.map(
          (s) => s.total_complaints ?? s.open_complaints ?? 0
        )
      )
      : 0;



  if (statsError || trendsError || stationError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundColor: "var(--background-dark)",
          color: "var(--text-on-dark)",
        }}
      >
        <div className="glass-effect rounded-2xl px-8 py-6 shadow-elevated text-center max-w-md">
          <Activity className="h-10 w-10 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-heading mb-2">
            Error loading analytics
          </h3>
          <p className="text-sm text-white/70">
            {(statsError as any)?.message ||
              (trendsError as any)?.message ||
              (stationError as any)?.message ||
              "Something went wrong while fetching stats."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "var(--background-dark)",
        color: "var(--text-on-dark)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary-500/20 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-primary-300" />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-semibold">
                {t("stats.pageTitle")}
              </h1>
              <p className="text-sm text-white/70">
                {isAdmin
                  ? t("stats.pageDescAdmin")
                  : t("stats.pageDescStation")}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: "var(--text-on-dark)" }}
              >
                {t("stats.timeRange")}
              </label>
              <select
                className="form-input"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                title={t("stats.timeRange")}
                aria-label={t("stats.timeRange")}
              >
                <option value={7}>{t("stats.last7Days")}</option>
                <option value={30}>{t("stats.last30Days")}</option>
                <option value={90}>{t("stats.last90Days")}</option>
              </select>
            </div>

            {isAdmin && (
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "var(--text-on-dark)" }}
                >
                  {t("stats.stationFilter")}
                </label>
                <select
                  className="form-input"
                  value={selectedStationId}
                  onChange={(e) => setSelectedStationId(e.target.value)}
                  disabled={stationsLoading}
                  title={t("stats.stationFilter")}
                  aria-label={t("stats.stationFilter")}
                  style={{ color: "var(--text-on-dark)", backgroundColor: "rgba(255,255,255,0.1)" }}
                >
                  <option value="all" style={{ color: "black" }}>{t("stats.allStations")}</option>
                  {stations.map((s: any) => (
                    <option key={s.station_id} value={s.station_id} style={{ color: "black" }}>
                      {s.station_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isPolice && userStationId && (
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "var(--text-on-dark)" }}
                >
                  Station
                </label>
                <div className="px-3 py-2 rounded-xl bg-white/5 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary-300" />
                    {(user as any)?.station?.station_name || "Your Station"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TOP STAT CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-effect rounded-2xl p-5 shadow-soft"
          >
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-primary-500/20">
                <Users className="w-6 h-6 text-primary-300" />
              </div>
              <div className="ml-4">
                <p className="text-xs uppercase tracking-wide text-white/60">
                  {t("stats.totalComplaints")}
                </p>
                <p className="text-2xl font-semibold">
                  {statsLoading
                    ? "…"
                    : (dashboardStats.total_complaints ??
                      dashboardStats.totalComplaints ??
                      0).toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-effect rounded-2xl p-5 shadow-soft"
          >
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-yellow-500/20">
                <Activity className="w-6 h-6 text-yellow-300" />
              </div>
              <div className="ml-4">
                <p className="text-xs uppercase tracking-wide text-white/60">
                  {t("stats.activeOpen")}
                </p>
                <p className="text-2xl font-semibold">
                  {statsLoading
                    ? "…"
                    : (dashboardStats.active_complaints ??
                      dashboardStats.openComplaints ??
                      0).toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-effect rounded-2xl p-5 shadow-soft"
          >
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-green-500/20">
                <CheckCircle className="w-6 h-6 text-green-300" />
              </div>
              <div className="ml-4">
                <p className="text-xs uppercase tracking-wide text-white/60">
                  {t("stats.closedResolved")}
                </p>
                <p className="text-2xl font-semibold">
                  {statsLoading
                    ? "…"
                    : (dashboardStats.closed_complaints ??
                      dashboardStats.closedComplaints ??
                      0).toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-effect rounded-2xl p-5 shadow-soft"
          >
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-blue-500/20">
                <Clock className="w-6 h-6 text-blue-300" />
              </div>
              <div className="ml-4">
                <p className="text-xs uppercase tracking-wide text-white/60">
                  {t("stats.avgResolutionTime")}
                </p>
                <p className="text-2xl font-semibold">
                  {statsLoading
                    ? "…"
                    : `${Math.round(
                      dashboardStats.avg_resolution_hours ??
                      dashboardStats.avgResolutionHours ??
                      0
                    )}h`}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* STATUS COMPARISONS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-effect rounded-2xl p-5 shadow-soft"
          >
            <h3 className="text-sm font-medium text-white/70 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Investigating vs Solved
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span>Investigating</span>
                <span className="font-semibold text-blue-300">
                  {statusCounts.investigating}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${
                      (statusCounts.investigating /
                        Math.max(
                          1,
                          statusCounts.investigating + statusCounts.resolved
                        )) *
                      100
                    }%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span>Solved (Resolved)</span>
                <span className="font-semibold text-green-300">
                  {statusCounts.resolved}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{
                    width: `${
                      (statusCounts.resolved /
                        Math.max(
                          1,
                          statusCounts.investigating + statusCounts.resolved
                        )) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-effect rounded-2xl p-5 shadow-soft"
          >
            <h3 className="text-sm font-medium text-white/70 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              Backlog: Investigating vs Not Assigned
            </h3>
            <div className="flex items-center justify-center h-32 relative">
              {/* Simple Donut representation or just ratio bars */}
              <div className="flex gap-4 items-end h-full px-4 w-full justify-around">
                <div className="flex flex-col items-center gap-2 w-1/3 h-full justify-end">
                  <div className="text-xs text-yellow-200/80 mb-1">
                    {statusCounts.not_assigned}
                  </div>
                  <div
                    className="w-full bg-yellow-500/30 rounded-t-lg relative group transition-all hover:bg-yellow-500/50"
                    style={{
                      height: `${Math.min(
                        100,
                        (statusCounts.not_assigned /
                          Math.max(
                            1,
                            statusCounts.investigating + statusCounts.not_assigned
                          )) *
                          100
                      )}%`,
                      minHeight: "4px",
                    }}
                  >
                    <div className="absolute inset-x-0 bottom-0 top-0 bg-yellow-500/20 animate-pulse" />
                  </div>
                  <span className="text-[10px] text-white/50 text-center">
                    Not Assigned
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2 w-1/3 h-full justify-end">
                  <div className="text-xs text-blue-200/80 mb-1">
                    {statusCounts.investigating}
                  </div>
                  <div
                    className="w-full bg-blue-500/30 rounded-t-lg relative group transition-all hover:bg-blue-500/50"
                    style={{
                      height: `${Math.min(
                        100,
                        (statusCounts.investigating /
                          Math.max(
                            1,
                            statusCounts.investigating +
                              statusCounts.not_assigned
                          )) *
                          100
                      )}%`,
                      minHeight: "4px",
                    }}
                  >
                    <div className="absolute inset-x-0 bottom-0 top-0 bg-blue-500/20 animate-pulse" />
                  </div>
                  <span className="text-[10px] text-white/50 text-center">
                    Investigating
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-effect rounded-2xl p-5 shadow-soft"
          >
            <h3 className="text-sm font-medium text-white/70 mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-purple-400" />
              Full Status Breakdown
            </h3>
            <div className="space-y-3 text-xs">
              {[
                {
                  label: "Not Assigned",
                  count: statusCounts.not_assigned,
                  color: "bg-yellow-500",
                },
                {
                  label: "Investigating",
                  count: statusCounts.investigating,
                  color: "bg-blue-500",
                },
                {
                  label: "Resolved",
                  count: statusCounts.resolved,
                  color: "bg-green-500",
                },
                {
                  label: "Closed",
                  count: statusCounts.closed,
                  color: "bg-gray-500",
                },
                {
                  label: "Rejected",
                  count: statusCounts.rejected,
                  color: "bg-red-500",
                },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-white/60">{item.label}</span>
                    <span className="font-mono text-white/90">
                      {item.count}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} opacity-70`}
                      style={{
                        width: `${
                          (item.count /
                            Math.max(
                              1,
                              (dashboardStats.total_complaints || 0)
                            )) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* MAIN GRIDS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: Complaint Trends */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-effect rounded-2xl p-6 shadow-soft col-span-1 lg:col-span-3"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-300" />
                <h2 className="text-lg font-heading font-semibold">
                  {t("stats.complaintTrends")}
                </h2>
              </div>
              <span className="text-xs text-white/50">
                {days} day window
              </span>
            </div>

            {trendsLoading ? (
              <div className="text-sm text-white/60">Loading trends…</div>
            ) : trends.length === 0 ? (
              <div className="text-sm text-white/60">
                No trend data available for this range.
              </div>
            ) : (
              <div className="space-y-3">
                {trends.map((t) => {
                  const total = t.total ?? t.open ?? 0;
                  const resolved = t.resolved ?? 0;
                  const open = t.open ?? Math.max(total - resolved, 0);
                  const width =
                    maxTrendValue > 0
                      ? `${Math.max((total / maxTrendValue) * 100, 4)}%`
                      : "0%";

                  const resolvedRatio =
                    total > 0 ? Math.min(resolved / total, 1) : 0;

                  return (
                    <div
                      key={t.date}
                      className="flex items-center gap-3 text-xs"
                    >
                      <span className="w-24 text-white/60">
                        {new Date(t.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                      <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary-500/60 relative"
                          style={{ width }}
                        >
                          <div
                            className="absolute inset-y-0 right-0 bg-green-500/70"
                            style={{
                              width: `${resolvedRatio * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="w-20 text-right text-white/70">
                        {total}{" "}
                        <span className="text-[10px] text-white/50">
                          ({resolved} ✓, {open} ·)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>



        </div>

        {/* STATION PERFORMANCE */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-effect rounded-2xl p-6 shadow-soft"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary-300" />
              <h2 className="text-lg font-heading font-semibold">
                {t("stats.stationPerformance")}
              </h2>
            </div>
            {filteredStationStats.length > 0 && (
              <span className="text-xs text-white/60">
                Showing {filteredStationStats.length} station
                {filteredStationStats.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {stationLoading ? (
            <div className="text-sm text-white/60">
              Loading station performance…
            </div>
          ) : filteredStationStats.length === 0 ? (
            <div className="text-sm text-white/60">
              No station metrics found for this filter.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStationStats.map((s) => {
                const total =
                  s.total_complaints ??
                  ((s.open_complaints || 0) + (s.closed_complaints || 0) || 0);
                const open = s.open_complaints ?? 0;
                const closed = s.closed_complaints ?? 0;
                const barWidth =
                  maxStationTotal > 0
                    ? `${Math.max((total / maxStationTotal) * 100, 10)}%`
                    : "0%";
                const closedRatio =
                  total > 0 ? Math.min(closed / total, 1) : 0;
                const avgHours = s.avg_resolution_hours ?? 0;

                return (
                  <div
                    key={s.station_id}
                    className="flex flex-col md:flex-row md:items-center gap-3"
                  >
                    <div className="md:w-56">
                      <div className="text-sm font-medium text-white/90">
                        {s.station_name}
                      </div>
                      <div className="text-xs text-white/60">
                        {total} complaints ·{" "}
                        <span className="text-yellow-300">{open} open</span> ·{" "}
                        <span className="text-green-300">{closed} closed</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary-500/70 relative"
                          style={{ width: barWidth }}
                        >
                          <div
                            className="absolute inset-y-0 right-0 bg-green-500/80"
                            style={{
                              width: `${closedRatio * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="md:w-32 text-xs text-right text-white/70">
                      <div>Avg resolve</div>
                      <div className="font-semibold">
                        {Math.round(avgHours)}h
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default StatsDashboard;

// NOTE:
// - Mount this at a route like /cop/stats (ProtectedRoute: ['police'])
//   and /admin/stats (ProtectedRoute: ['admin']).
// - It uses existing hooks from useApi.ts and the same dark theme / glass styles.
