// EnhancedAdminPortal.tsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import {
  usePendingPolice,
  useProcessPoliceApproval,
  useSystemAnalytics,
  useAdminDashboardStats,
  usePoliceUsers,
  type PendingPoliceUser,
  type ApprovalAction,
} from "../hooks/useAdminApi";
import {
  Users,
  FileText,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Search,
  AlertCircle,
  Loader2,
  Shield,
  UserCheck,
  Calendar,
  Building2,
  LayoutDashboard,
} from "lucide-react";
import toast from "react-hot-toast";

const AdminPortal: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "approvals" | "users" | "cases"
  >("approvals");
  const [selectedApproval, setSelectedApproval] =
    useState<PendingPoliceUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDays, setSelectedDays] = useState(30);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<ApprovalAction>({
    action: "approve",
    reason: "",
  });

  // API hooks
  const {
    data: pendingResponse,
    isLoading: pendingLoading,
    error: pendingError,
  } = usePendingPolice({ limit: 100 });

  const {
    data: statsResponse,
    isLoading: statsLoading,
  } = useAdminDashboardStats();

  const {
    data: analyticsResponse,
    isLoading: analyticsLoading,
  } = useSystemAnalytics(selectedDays);

  const {
    data: usersResponse,
    isLoading: usersLoading,
  } = usePoliceUsers({
    approved: true,
    limit: 100,
    enabled: activeTab === "users",
  });

  // Fetch all cases for admin cop dashboard
  const {
    data: casesResponse,
    isLoading: casesLoading,
  } = usePoliceComplaints({
    admin: true,
    limit: 100,
  });

  const processApprovalMutation = useProcessPoliceApproval();

  const pendingApprovals = pendingResponse?.data || [];
  const dashboardStats =
    statsResponse?.data || ({
      totalUsers: 0,
      totalComplaints: 0,
      totalStations: 0,
      pendingApprovals: 0,
      responseTime: "0 hours",
      resolutionRate: 0,
      systemHealth: "good",
      recentActivity: [],
    } as const);

  const analytics = analyticsResponse?.data;
  const policeUsers = usersResponse?.data || [];
  const allCases = casesResponse?.data || [];

  const getSystemHealthClass = (health: string): string => {
    switch (health) {
      case "excellent":
        return "badge bg-green-500/20 text-green-300";
      case "good":
        return "badge bg-primary-500/20 text-primary-300";
      case "warning":
        return "badge bg-yellow-500/20 text-yellow-200";
      case "critical":
        return "badge bg-red-500/20 text-red-300";
      default:
        return "badge bg-white/5 text-white/60";
    }
  };

  const getApprovalBadgeClass = (needsApproval: boolean): string =>
    needsApproval
      ? "badge bg-red-500/20 text-red-300"
      : "badge bg-green-500/20 text-green-300";

  const formatDate = (dateString: string): string =>
    new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleApprovalAction = async (
    policeUser: PendingPoliceUser,
    action: "approve" | "reject",
    reason?: string
  ) => {
    try {
      await processApprovalMutation.mutateAsync({
        policeId: policeUser.id.toString(),
        approvalData: { action: action === "approve" ? "approve" : "reject", reason },
      });
      toast.success(t("admin.successAction", { action }));
      setShowApprovalModal(false);
      setSelectedApproval(null);
      setApprovalAction({ action: "approve", reason: "" });
    } catch (error: any) {
      toast.error(error?.message || t("admin.failedAction", { action }));
    }
  };

  // Search filters
  const filteredApprovals = pendingApprovals.filter(
    (approval) =>
      approval.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      approval.police_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      approval.station?.station_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  const filteredUsers = policeUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.police_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.station?.station_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase())
  );


  if (pendingError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundColor: "var(--background-dark)",
          color: "var(--text-on-dark)",
        }}
      >
        <div className="glass-effect rounded-2xl px-8 py-6 shadow-elevated text-center max-w-md">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-4" />
          <h3 className="text-xl font-heading mb-2">
            {t("admin.errorLoading")}
          </h3>
          <p className="text-sm text-white/70">
            {pendingError.message || t("admin.somethingWrong")}
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary-500/20 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary-300" />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-semibold">
                {t("admin.title")}
              </h1>
              <p className="text-sm text-white/70">
                {t("admin.headerDesc", { name: user?.name || "Admin" })}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/10 mb-6">
          <nav className="-mb-px flex flex-wrap gap-6 text-sm">
            <button
              onClick={() => setActiveTab("approvals")}
              className={`pb-2 flex items-center gap-2 border-b-2 transition-colors ${activeTab === "approvals"
                ? "border-primary-500 text-primary-300"
                : "border-transparent text-white/60 hover:text-white"
                } `}
            >
              <Clock className="w-4 h-4" />
              <span>{t("admin.pendingApprovals")}</span>
              {pendingApprovals.length > 0 && (
                <span className="badge bg-red-500/20 text-red-300">
                  {pendingApprovals.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={`pb-2 flex items-center gap-2 border-b-2 transition-colors ${activeTab === "users"
                ? "border-primary-500 text-primary-300"
                : "border-transparent text-white/60 hover:text-white"
                } `}
            >
              <Users className="w-4 h-4" />
              <span>{t("admin.userManagement")}</span>
            </button>

            <button
              onClick={() => setActiveTab("cases")}
              className={`pb-2 flex items-center gap-2 border-b-2 transition-colors ${activeTab === "cases"
                ? "border-primary-500 text-primary-300"
                : "border-transparent text-white/60 hover:text-white"
                } `}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Cop Dashboard</span>
            </button>
          </nav>
        </div>

        {/* APPROVALS TAB */}
        {activeTab === "approvals" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("admin.searchApprovals")}
                  className="form-input pl-10"
                />
              </div>
              <div className="text-xs text-white/60">
                {filteredApprovals.length} {t("admin.pendingApprovals").toLowerCase()}
              </div>
            </div>

            <div className="glass-effect rounded-2xl shadow-soft">
              {pendingLoading ? (
                <div className="flex items-center justify-center py-12">
                  <span className="spinner mr-3" />
                  <span className="text-sm text-white/70">
                    {t("admin.loadingApprovals")}
                  </span>
                </div>
              ) : filteredApprovals.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
                  <p className="text-sm font-medium">{t("admin.noPending")}</p>
                  <p className="text-xs text-white/60 mt-1">
                    {t("admin.noPendingDesc")}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredApprovals.map((approval, idx) => (
                    <motion.div
                      key={approval.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="px-6 py-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-base font-semibold">
                              {approval.name}
                            </h3>
                            <span className="badge bg-white/5 text-white/70">
                              {approval.police_id}
                            </span>
                            <span
                              className={getApprovalBadgeClass(
                                approval.needs_admin_approval
                              )}
                            >
                              {approval.needs_admin_approval
                                ? t("admin.profileChange")
                                : t("admin.newRegistration")}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-white/70 mb-2">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-white/40" />
                              <span>{approval.batch || t("admin.noBatch")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-white/40" />
                              <span>
                                {approval.station?.station_name ||
                                  t("admin.noStation")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-white/40" />
                              <span>{formatDate(approval.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-white/40" />
                              <span>
                                {approval.is_admin ? t("admin.adminUser") : t("admin.officer")}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-4 text-xs text-white/60">
                            {approval.email && <span>📧 {approval.email}</span>}
                            {approval.phone && <span>📱 {approval.phone}</span>}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row md:flex-col gap-2 md:ml-4">
                          <button
                            onClick={() => {
                              setSelectedApproval(approval);
                              setShowApprovalModal(true);
                              setApprovalAction({ action: "approve", reason: "" });
                            }}
                            className="btn-secondary text-xs flex items-center justify-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            {t("common.view")}
                          </button>
                          <button
                            onClick={() =>
                              handleApprovalAction(approval, "approve")
                            }
                            disabled={processApprovalMutation.isPending}
                            className="btn-success text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {t("admin.approve")}
                          </button>
                          <button
                            onClick={() =>
                              handleApprovalAction(approval, "reject")
                            }
                            disabled={processApprovalMutation.isPending}
                            className="btn-danger text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            {t("admin.reject")}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CASES TAB - Cop Dashboard */}
        {activeTab === "cases" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cases by ID, victim name, or crime type..."
                  className="form-input pl-10"
                />
              </div>
              <div className="text-xs text-white/60">
                {allCases.length} total cases
              </div>
            </div>

            <div className="glass-effect rounded-2xl shadow-soft overflow-hidden">
              {casesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <span className="spinner mr-3" />
                  <span className="text-sm text-white/70">Loading cases...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium text-white/60 uppercase tracking-wide">
                          Case ID
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-white/60 uppercase tracking-wide">
                          Victim
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-white/60 uppercase tracking-wide">
                          Crime Type
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-white/60 uppercase tracking-wide">
                          Station
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-white/60 uppercase tracking-wide">
                          Investigating Officer
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-white/60 uppercase tracking-wide">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-white/60 uppercase tracking-wide">
                          Filed Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {allCases
                        .filter((c: any) => {
                          if (!searchQuery) return true;
                          const query = searchQuery.toLowerCase();
                          return (
                            c.complaint_id?.toLowerCase().includes(query) ||
                            c.victim_name?.toLowerCase().includes(query) ||
                            c.crime_type?.toLowerCase().includes(query) ||
                            c.description?.toLowerCase().includes(query)
                          );
                        })
                        .map((c: any) => (
                          <tr key={c.id || c.complaint_id} className="hover:bg-white/5">
                            <td className="px-6 py-4">
                              <div className="text-sm text-white font-mono">
                                {c.complaint_id}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-white">
                                {c.victim_name || "Unknown"}
                              </div>
                              {c.victim_phone && (
                                <div className="text-xs text-white/60">
                                  {c.victim_phone}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-white">
                                {c.crime_type}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-white">
                                {c.station_name || "N/A"}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {c.assigned_cop_name ? (
                                <div>
                                  <div className="text-sm text-white font-medium">
                                    {c.assigned_cop_name}
                                  </div>
                                  {c.assigned_cop_station && (
                                    <div className="text-xs text-white/60">
                                      {c.assigned_cop_station}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-white/40 italic">
                                  Not assigned
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`badge ${
                                  c.status === "INVESTIGATING"
                                    ? "bg-blue-500/20 text-blue-300"
                                    : c.status === "CLOSED"
                                    ? "bg-green-500/20 text-green-300"
                                    : c.status === "NOT_ASSIGNED"
                                    ? "bg-yellow-500/20 text-yellow-200"
                                    : "bg-white/5 text-white/70"
                                }`}
                              >
                                {c.status || "Unknown"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-white/60">
                              {c.created_at
                                ? formatDate(c.created_at)
                                : "N/A"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {allCases.filter((c: any) => {
                    if (!searchQuery) return true;
                    const query = searchQuery.toLowerCase();
                    return (
                      c.complaint_id?.toLowerCase().includes(query) ||
                      c.victim_name?.toLowerCase().includes(query) ||
                      c.crime_type?.toLowerCase().includes(query) ||
                      c.description?.toLowerCase().includes(query)
                    );
                  }).length === 0 && (
                    <div className="py-10 text-center">
                      <FileText className="h-10 w-10 text-white/40 mx-auto mb-3" />
                      <p className="text-sm font-medium text-white/70">
                        No cases found
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("admin.searchUsers")}
                  className="form-input pl-10"
                />
              </div>
              <div className="text-xs text-white/60">
                {filteredUsers.length} users
              </div>
            </div>

            <div className="glass-effect rounded-2xl shadow-soft overflow-hidden">
              {usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <span className="spinner mr-3" />
                  <span className="text-sm text-white/70">{t("admin.loadingUsers")}</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium text-white/60 uppercase tracking-wide">
                          {t("admin.user")}
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-white/60 uppercase tracking-wide">
                          {t("admin.station")}
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-white/60 uppercase tracking-wide">
                          {t("admin.role")}
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-white/60 uppercase tracking-wide">
                          {t("admin.status")}
                        </th>
                        <th className="px-6 py-3 text-left font-medium text-white/60 uppercase tracking-wide">
                          {t("admin.joined")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredUsers.map((u: any) => (
                        <tr key={u.id} className="hover:bg-white/5">
                          <td className="px-6 py-4">
                            <div className="text-sm text-white">
                              {u.name}
                            </div>
                            <div className="text-xs text-white/60">
                              {u.police_id}
                            </div>
                            {u.email && (
                              <div className="text-xs text-white/60">
                                {u.email}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-white">
                              {u.station?.station_name || t("admin.notAssigned")}
                            </div>
                            <div className="text-xs text-white/60">
                              {u.station?.station_code}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`badge ${u.is_admin
                                ? "bg-purple-500/20 text-purple-300"
                                : "bg-primary-500/20 text-primary-300"
                                } `}
                            >
                              {u.is_admin ? t("admin.adminRole") : t("admin.officer")}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`badge ${!u.needs_admin_approval
                                ? "bg-green-500/20 text-green-300"
                                : "bg-yellow-500/20 text-yellow-200"
                                } `}
                            >
                              {!u.needs_admin_approval ? t("admin.active") : t("admin.pending")}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-white/60">
                            {formatDate(u.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* APPROVAL DETAIL MODAL */}
      <AnimatePresence>
        {showApprovalModal && selectedApproval && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="glass-effect rounded-2xl p-6 w-96 max-w-full shadow-elevated">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-heading">{t("admin.reviewApproval")}</h3>
                <button
                  className="text-white/60 hover:text-white text-xl"
                  onClick={() => {
                    setShowApprovalModal(false);
                    setSelectedApproval(null);
                    setApprovalAction({ action: "approve", reason: "" });
                  }}
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <p className="text-xs text-white/60 mb-1">{t("admin.name")}</p>
                    <p className="text-sm text-white">
                      {selectedApproval.name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">{t("admin.policeId")}</p>
                    <p className="text-sm text-white">
                      {selectedApproval.police_id}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">{t("admin.batch")}</p>
                    <p className="text-sm text-white">
                      {selectedApproval.batch || t("admin.notSpecified")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">{t("admin.station")}</p>
                    <p className="text-sm text-white">
                      {selectedApproval.station?.station_name ||
                        t("admin.notAssigned")}
                      {selectedApproval.station && (
                        <span className="text-white/60">
                          {" "}
                          ({selectedApproval.station.station_code})
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">{t("admin.email")}</p>
                    <p className="text-sm text-white">
                      {selectedApproval.email || t("admin.notProvided")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">{t("admin.phone")}</p>
                    <p className="text-sm text-white">
                      {selectedApproval.phone || t("admin.notProvided")}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="form-label">
                    {t("admin.approvalReason")}
                  </label>
                  <textarea
                    rows={3}
                    value={approvalAction.reason || ""}
                    onChange={(e) =>
                      setApprovalAction((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                    className="form-input bg-white/5"
                    placeholder={t("admin.reasonPlaceholder")}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() =>
                      handleApprovalAction(
                        selectedApproval!,
                        "approve",
                        approvalAction.reason
                      )
                    }
                    disabled={processApprovalMutation.isPending}
                    className="btn-success flex-1 text-sm disabled:opacity-50"
                  >
                    {processApprovalMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      t("admin.approve")
                    )}
                  </button>
                  <button
                    onClick={() =>
                      handleApprovalAction(
                        selectedApproval!,
                        "reject",
                        approvalAction.reason
                      )
                    }
                    disabled={processApprovalMutation.isPending}
                    className="btn-danger flex-1 text-sm disabled:opacity-50"
                  >
                    {processApprovalMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      t("admin.reject")
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPortal;
