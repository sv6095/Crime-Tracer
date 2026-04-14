// EnhancedPoliceDashboard.tsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import {
  usePoliceComplaints,
  useUpdateComplaintStatus,
  useAssignComplaint,
  useAddComment,
  usePoliceDashboardStats,
  type Complaint,
  type ComplaintUpdateData,
  type CommentData,
} from "../hooks/usePoliceApi";
import {
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle,
  Eye,
  Search,
  User,
  Calendar,
  MapPin,
  Phone,
  ExternalLink,
  Loader2,
  AlertCircle,
  Badge,
  MapPinIcon,
  UserCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import CaseDetailView from "../components/investigation/CaseDetailView";

const CopDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState<"new" | "assigned" | "completed">(
    "new"
  );
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState<ComplaintUpdateData>({
    status: "",
    note: "",
  });
  const [comment, setComment] = useState("");

  // Build query params based on active tab + filter
  const getQueryParams = () => {
    const params: any = { limit: 50 };

    if (activeTab === "new") {
      params.status = "Filed"; // explicit for new complaints
    } else if (activeTab === "assigned") {
      // no status filter; client-side filtering uses assigned_police_id
    } else if (activeTab === "completed") {
      params.status = "Closed";
    }

    if (filterStatus !== "all") {
      params.status = filterStatus;
    }

    return params;
  };

  // Compute params and log for debugging
  const queryParams = getQueryParams();
  console.log('Dashboard query params:', queryParams);

  // API hooks - use admin endpoint if user is admin
  const {
    data: complaintsResponse,
    isLoading: complaintsLoading,
    error: complaintsError,
  } = usePoliceComplaints({ ...queryParams, admin: isAdmin });

  const {
    data: statsResponse,
    isLoading: statsLoading,
  } = usePoliceDashboardStats();

  const updateStatusMutation = useUpdateComplaintStatus();
  const assignComplaintMutation = useAssignComplaint();
  const addCommentMutation = useAddComment();

  const complaints = complaintsResponse?.data || [];
  const stats =
    statsResponse?.data || ({
      newComplaints: 0,
      assignedComplaints: 0,
      completedComplaints: 0,
      urgentCases: 0,
    } as const);

  const getStatusBadgeClass = (status: string): string => {
    switch (status.toLowerCase()) {
      case "not_assigned":
        return "badge badge-pending";
      case "filed":
        return "badge badge-pending";
      case "assigned":
      case "investigating":
        return "badge badge-investigating";
      case "resolved":
        return "badge badge-resolved";
      case "closed":
        return "badge badge-closed";
      case "rejected":
        return "badge badge-closed"; // or specific rejected style
      default:
        return "badge badge-closed";
    }
  };

  const getSeverityBadgeClass = (severity?: string): string => {
    switch (severity?.toLowerCase()) {
      case "high":
        return "badge bg-red-500/20 text-red-300";
      case "medium":
        return "badge bg-yellow-500/20 text-yellow-200";
      case "low":
        return "badge bg-green-500/20 text-green-300";
      default:
        return "badge bg-white/5 text-white/60";
    }
  };

  const formatDate = (dateString: string | undefined | null): string => {
    if (!dateString) return "Not available";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Invalid Date";
      return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      } as Intl.DateTimeFormatOptions);
    } catch {
      return "Invalid Date";
    }
  };

  const handleAssignToSelf = async (complaint: Complaint) => {
    if (complaint.assigned_police_id) {
      toast.error("Complaint is already assigned");
      return;
    }

    try {
      await assignComplaintMutation.mutateAsync(complaint.complaint_id);
      toast.success("Complaint assigned to you");
    } catch (error: any) {
      toast.error(error?.message || "Failed to assign complaint");
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedComplaint || !statusUpdate.status) return;

    try {
      await updateStatusMutation.mutateAsync({
        complaintId: selectedComplaint.complaint_id,
        updateData: statusUpdate,
      });
      toast.success("Status updated");
      setShowStatusModal(false);
      setStatusUpdate({ status: "", note: "" });
      setSelectedComplaint(null);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update status");
    }
  };

  const handleCloseCase = async (complaint: Complaint) => {
    if (!confirm(`Are you sure you want to close case ${complaint.complaint_id}?`)) return;

    try {
      await updateStatusMutation.mutateAsync({
        complaintId: complaint.complaint_id,
        updateData: {
          status: "Closed",
          note: "Case closed by investigating officer",
        },
      });
      toast.success("Case closed successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to close case");
    }
  };

  const handleAddComment = async () => {
    if (!selectedComplaint || !comment.trim()) return;

    try {
      const payload: CommentData = {
        comment: comment.trim(),
        is_internal: true,
      };
      await addCommentMutation.mutateAsync({
        complaintId: selectedComplaint.complaint_id,
        commentData: payload,
      });
      toast.success("Rejection note added");
      setShowCommentModal(false);
      setComment("");
      setSelectedComplaint(null);
    } catch (error: any) {
      toast.error(error?.message || "Failed to add comment");
    }
  };

  const filteredComplaints = complaints.filter((complaint) => {
    const searchLower = searchQuery.toLowerCase();
    const statusLower = complaint.status.toLowerCase();

    // Filter by tab
    if (activeTab === "new" && statusLower !== "not_assigned") return false;
    if (activeTab === "assigned") {
      // Show only assigned cases that are not closed
      if (!complaint.assigned_police_id) return false;
      if (statusLower === "closed") return false; // Don't show closed cases in assigned tab
    }
    if (activeTab === "completed" && statusLower !== "closed") return false;

    // Filter by search query
    if (searchQuery) {
      return (
        complaint.complaint_id.toLowerCase().includes(searchLower) ||
        complaint.filer_name.toLowerCase().includes(searchLower) ||
        complaint.crime_type.toLowerCase().includes(searchLower) ||
        complaint.description.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  if (complaintsError) {
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
          <h3 className="text-xl font-heading mb-2">{t('dashboard.errorLoading')}</h3>
          <p className="text-sm text-white/70">
            {complaintsError.message || t('dashboard.errorGeneric')}
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
        <div className="mb-8 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary-500/20 flex items-center justify-center">
              <Badge className="h-6 w-6 text-primary-400" />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-semibold">
                {isAdmin ? 'All Cases Dashboard (Admin View)' : t('dashboard.title')}
              </h1>
              <p className="text-sm text-white/70">
                {isAdmin 
                  ? 'View all registered cases across all stations and see which cop has undertaken each case'
                  : t('dashboard.welcomeBack', { name: user?.name || "Officer" })}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-effect rounded-2xl p-5 shadow-soft"
          >
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-primary-500/15">
                <FileText className="w-6 h-6 text-primary-300" />
              </div>
              <div className="ml-4">
                <p className="text-xs uppercase tracking-wide text-white/60">
                  {t('dashboard.newComplaints')}
                </p>
                <p className="text-2xl font-semibold">
                  {statsLoading ? "…" : stats.newComplaints}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-effect rounded-2xl p-5 shadow-soft"
          >
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-yellow-500/15">
                <Clock className="w-6 h-6 text-yellow-300" />
              </div>
              <div className="ml-4">
                <p className="text-xs uppercase tracking-wide text-white/60">
                  {t('dashboard.acceptedAssignments')}
                </p>
                <p className="text-2xl font-semibold">
                  {statsLoading ? "…" : stats.assignedComplaints}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-effect rounded-2xl p-5 shadow-soft"
          >
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-green-500/15">
                <CheckCircle className="w-6 h-6 text-green-300" />
              </div>
              <div className="ml-4">
                <p className="text-xs uppercase tracking-wide text-white/60">
                  {t('dashboard.completed')}
                </p>
                <p className="text-2xl font-semibold">
                  {statsLoading ? "…" : stats.completedComplaints}
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-effect rounded-2xl p-5 shadow-soft"
          >
            <div className="flex items-center">
              <div className="p-3 rounded-xl bg-red-500/15">
                <AlertTriangle className="w-6 h-6 text-red-300" />
              </div>
              <div className="ml-4">
                <p className="text-xs uppercase tracking-wide text-white/60">
                  {t('dashboard.highPriority')}
                </p>
                <p className="text-2xl font-semibold">
                  {
                    complaints.filter(
                      (c) =>
                        c.predicted_severity &&
                        c.predicted_severity.toLowerCase() === "high"
                    ).length
                  }
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Tabs + filters */}
        <div className="glass-effect rounded-2xl shadow-elevated overflow-hidden">
          <div className="border-b border-white/10 px-6 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-6 text-sm">
              <button
                onClick={() => setActiveTab("new")}
                className={`pb-2 border-b-2 transition-colors ${activeTab === "new"
                  ? "border-primary-500 text-primary-300"
                  : "border-transparent text-white/60 hover:text-white"
                  }`}
              >
                {t('dashboard.newComplaints')}
              </button>
              <button
                onClick={() => setActiveTab("assigned")}
                className={`pb-2 border-b-2 transition-colors ${activeTab === "assigned"
                  ? "border-primary-500 text-primary-300"
                  : "border-transparent text-white/60 hover:text-white"
                  }`}
              >
                {t('dashboard.acceptedAssignments')}
              </button>
              <button
                onClick={() => setActiveTab("completed")}
                className={`pb-2 border-b-2 transition-colors ${activeTab === "completed"
                  ? "border-primary-500 text-primary-300"
                  : "border-transparent text-white/60 hover:text-white"
                  }`}
              >
                {t('dashboard.completed')}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('dashboard.searchPlaceholder')}
                  className="form-input pl-10"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="form-input bg-white/5 text-sm"
              >
                <option value="all">{t('dashboard.allStatus')}</option>
                <option value="Filed">{t('dashboard.filed')}</option>
                <option value="Assigned">{t('dashboard.assigned')}</option>
                <option value="Investigating">{t('dashboard.investigating')}</option>
                <option value="Resolved">{t('dashboard.resolved')}</option>
                <option value="Closed">{t('dashboard.closed')}</option>
              </select>
            </div>
          </div>

          {/* Complaints list */}
          <div className="divide-y divide-white/5">
            {complaintsLoading ? (
              <div className="flex items-center justify-center py-12">
                <span className="spinner mr-3" />
                <span className="text-white/70 text-sm">
                  Loading complaints…
                </span>
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="h-10 w-10 text-white/30 mx-auto mb-3" />
                <p className="text-sm font-medium">{t('dashboard.noComplaints')}</p>
                <p className="text-xs text-white/60 mt-1">
                  {t('dashboard.noComplaintsDesc')}
                </p>
              </div>
            ) : (
              filteredComplaints.map((complaint, index) => (
                <motion.div
                  key={complaint.complaint_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="px-6 py-5 hover:bg-white/5 transition-colors"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h3 className="text-base font-semibold">
                          {complaint.complaint_id}
                        </h3>
                        <span className={getStatusBadgeClass(complaint.status)}>
                          {complaint.status}
                        </span>
                        {complaint.predicted_severity && (
                          <span
                            className={getSeverityBadgeClass(
                              complaint.predicted_severity
                            )}
                          >
                          {complaint.predicted_severity} {t('dashboard.priority')}
                          </span>
                        )}
                        <span className="badge bg-white/5 text-white/60">
                          {complaint.crime_type}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-white/70 mb-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-white/40" />
                          <span>{complaint.filer_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-white/40" />
                          <span>{complaint.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-white/40" />
                          <span>
                            {complaint.location_text || "Location not specified"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-white/40" />
                          <span>{formatDate(complaint.created_at || complaint.timestamp)}</span>
                        </div>
                      </div>

                      <p className="text-sm text-white/80 mb-2 line-clamp-2">
                        {complaint.description}
                      </p>

                      {/* Show cop assignment prominently - especially for admin view */}
                      {complaint.accepted_officer || complaint.assigned_police_id ? (
                        <div className="flex items-center gap-2 text-xs bg-primary-500/20 text-primary-300 px-2 py-1 rounded mb-2 inline-block">
                          <UserCheck className="w-4 h-4" />
                          <span className="font-semibold">
                            {isAdmin ? 'Assigned Cop: ' : 'Assigned to: '}
                            {complaint.accepted_officer?.name || 'Unknown'} 
                            {complaint.accepted_officer?.police_id && ` (${complaint.accepted_officer.police_id})`}
                            {!complaint.accepted_officer && complaint.assigned_police_id && ` (ID: ${complaint.assigned_police_id})`}
                          </span>
                        </div>
                      ) : (
                        isAdmin && (
                          <div className="flex items-center gap-2 text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded mb-2 inline-block">
                            <AlertCircle className="w-4 h-4" />
                            <span>Not yet assigned to any cop</span>
                          </div>
                        )
                      )}

                      {complaint.station && (
                        <div className="flex items-center gap-2 text-xs text-white/60 mb-1">
                          <MapPinIcon className="w-4 h-4" />
                          <span>Station: {complaint.station.station_name}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-4 text-[11px] text-white/50 mt-1">
                        <span>
                          {t('dashboard.officersRequired')}: {complaint.officers_required}
                        </span>
                        {complaint.attachments?.length > 0 && (
                          <span>
                            📎 {complaint.attachments.length} attachment
                            {complaint.attachments.length > 1 ? "s" : ""}
                          </span>
                        )}
                        <span>Updated: {formatDate(complaint.updated_at)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col gap-2 md:ml-4">
                      <button
                        onClick={() => {
                          // Show CaseDetailView for all complaints (assigned and unassigned)
                          setSelectedComplaint(complaint)
                          setShowStatusModal(false)
                          setShowCommentModal(false)
                        }}
                        className="btn-secondary text-xs flex items-center justify-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        {t('View')}
                      </button>

                      {/* Accept button - only for non-admin users */}
                      {!isAdmin && !complaint.assigned_police_id && (
                        <button
                          onClick={() => handleAssignToSelf(complaint)}
                          disabled={assignComplaintMutation.isPending}
                          className="btn-primary text-xs flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {assignComplaintMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>{t('dashboard.accept')}</>
                          )}
                        </button>
                      )}

                      {/* Close Case button - only for non-admin users */}
                      {!isAdmin && complaint.assigned_police_id && complaint.status.toLowerCase() !== 'closed' && (
                        <button
                          onClick={() => handleCloseCase(complaint)}
                          disabled={updateStatusMutation.isPending}
                          className="btn-primary text-xs flex items-center justify-center gap-1 disabled:opacity-50 bg-green-600 hover:bg-green-700"
                        >
                          {updateStatusMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Close Case
                            </>
                          )}
                        </button>
                      )}

                      {/* Reject button only for new assignments (not assigned cases) - only for non-admin users */}
                      {!isAdmin && !complaint.assigned_police_id && complaint.status.toLowerCase() !== 'closed' && (
                        <button
                          onClick={() => {
                            setSelectedComplaint(complaint);
                            setShowCommentModal(true);
                          }}
                          className="btn-danger text-xs flex items-center justify-center gap-1"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          {t('dashboard.reject')}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Complaint Detail Modal - Enhanced with Investigation Platform */}
      <AnimatePresence>
        {selectedComplaint && 
         !showStatusModal && 
         !showCommentModal && (
          <CaseDetailView
            complaint={selectedComplaint}
            onClose={() => setSelectedComplaint(null)}
            onAccept={!isAdmin ? () => handleAssignToSelf(selectedComplaint) : undefined}
            onReject={!isAdmin && !selectedComplaint.assigned_police_id ? () => {
              setSelectedComplaint(selectedComplaint)
              setShowCommentModal(true)
            } : undefined}
          />
        )}
      </AnimatePresence>

      {/* Legacy Detail Modal (kept for status/comment modals) */}
      <AnimatePresence>
        {selectedComplaint && (showStatusModal || showCommentModal) && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="max-w-3xl w-11/12 md:w-3/4 lg:w-2/3 max-h-[80vh] overflow-y-auto glass-effect rounded-2xl p-6 shadow-elevated">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-heading font-semibold">
                  Complaint {selectedComplaint.complaint_id}
                </h3>
                <button
                  onClick={() => setSelectedComplaint(null)}
                  className="text-white/60 hover:text-white text-xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-white/60 mb-1">Crime Type</p>
                    <p className="text-sm font-medium">
                      {selectedComplaint.crime_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">Status</p>
                    <span
                      className={getStatusBadgeClass(selectedComplaint.status)}
                    >
                      {selectedComplaint.status}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-white/60 mb-1">Description</p>
                  <p className="text-sm bg-white/5 rounded-lg p-3 text-white/90">
                    {selectedComplaint.description}
                  </p>
                </div>

                {/* AI Analysis Block */}
                {(selectedComplaint.llm_summary || selectedComplaint.bns_sections || selectedComplaint.precautions) && (
                  <div className="bg-primary-500/5 rounded-xl p-4 border border-primary-500/10">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-primary-300 mb-3">
                      <div className="h-2 w-2 rounded-full bg-primary-400 animate-pulse" />
                      AI Analysis
                    </h4>

                    {(selectedComplaint.officer_summary || selectedComplaint.llm_summary) && (
                      <div className="mb-4">
                        <p className="text-xs text-white/50 mb-1 uppercase tracking-wider">
                          {selectedComplaint.officer_summary ? "Officer Case Brief" : "Generated Summary"}
                        </p>
                        <div className={`p-3 rounded-lg ${selectedComplaint.officer_summary ? "bg-blue-500/10 border border-blue-500/20" : ""}`}>
                           <p className="text-sm text-white/90 leading-relaxed">
                             {selectedComplaint.officer_summary || `"${selectedComplaint.llm_summary}"`}
                           </p>
                        </div>
                      </div>
                    )}

                    {selectedComplaint.bns_sections && selectedComplaint.bns_sections.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-white/50 mb-2 uppercase tracking-wider">Suggested BNS Sections</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedComplaint.bns_sections.map((sec: any, i: number) => (
                            <div key={i} className="bg-white/10 rounded-md px-3 py-1.5 text-xs">
                              <span className="font-bold text-primary-200 block">{sec.section_code || sec.section}</span>
                              <span className="text-white/70">{sec.title || sec.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedComplaint.precautions && selectedComplaint.precautions.length > 0 && (
                      <div>
                        <p className="text-xs text-white/50 mb-2 uppercase tracking-wider">Immediate Precautions</p>
                        <ul className="list-disc list-inside space-y-1">
                          {selectedComplaint.precautions.map((p, i) => (
                            <li key={i} className="text-xs text-white/80">{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-white/60 mb-1">Complainant</p>
                    <p className="text-sm font-medium">
                      {selectedComplaint.filer_name}
                    </p>
                    <p className="text-xs text-white/70">
                      {selectedComplaint.phone}
                    </p>
                    {selectedComplaint.email && (
                      <p className="text-xs text-white/70">
                        {selectedComplaint.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">Location</p>
                    <p className="text-sm text-white/90">
                      {selectedComplaint.location_text || "Not specified"}
                    </p>
                    {selectedComplaint.lat && selectedComplaint.lng && (
                      <p className="text-xs text-white/60 mt-1">
                        📍 {selectedComplaint.lat.toFixed(6)},
                        {" "}{selectedComplaint.lng.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>

                {selectedComplaint.attachments?.length > 0 && (
                  <div>
                    <p className="text-xs text-white/60 mb-2">
                      Evidence ({selectedComplaint.attachments.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedComplaint.attachments.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-primary-500/20 text-primary-200 hover:bg-primary-500/30"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Attachment {idx + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {selectedComplaint.status_timeline?.length > 0 && (
                  <div>
                    <p className="text-xs text-white/60 mb-2">Timeline</p>
                    <div className="bg-white/5 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {selectedComplaint.status_timeline.map((entry, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 mb-2 last:mb-0"
                        >
                          <div className="w-1 h-1 rounded-full bg-primary-400 mt-2" />
                          <div className="flex-1">
                            <p className="text-xs font-semibold">
                              {entry.status}
                            </p>
                            <p className="text-[11px] text-white/60">
                              by {entry.updated_by} •{" "}
                              {formatDate(entry.timestamp)}
                            </p>
                            {entry.note && (
                              <p className="text-[11px] text-white/70 mt-1">
                                {entry.note}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons - hidden for admins (view-only access) */}
                {!isAdmin && (
                  <div className="pt-4 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => {
                        setStatusUpdate({
                          status: selectedComplaint.status,
                          note: "",
                        });
                        setShowStatusModal(true);
                      }}
                      className="btn-primary flex-1 text-sm"
                    >
                      Update Status
                    </button>
                    <button
                      onClick={() => setShowCommentModal(true)}
                      className="btn-danger flex-1 text-sm"
                    >
                      Reject as Fake
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Update Modal */}
      <AnimatePresence>
        {showStatusModal && selectedComplaint && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="glass-effect rounded-2xl p-6 w-96 max-w-full shadow-elevated">
              <h3 className="text-lg font-heading mb-4">Update Status</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <label className="form-label">New Status</label>
                  <select
                    aria-label="New Status"
                    title="New Status"
                    value={statusUpdate.status}
                    onChange={(e) =>
                      setStatusUpdate((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    className="form-input bg-white/5"
                  >
                    <option value="">Select status</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Investigating">Investigating</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Note (optional)</label>
                  <textarea
                    rows={3}
                    value={statusUpdate.note || ""}
                    onChange={(e) =>
                      setStatusUpdate((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                    className="form-input bg-white/5"
                    placeholder="Add a short note for this update…"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleStatusUpdate}
                    disabled={
                      !statusUpdate.status || updateStatusMutation.isPending
                    }
                    className="btn-primary flex-1 text-sm disabled:opacity-50"
                  >
                    {updateStatusMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      "Save"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowStatusModal(false);
                      setStatusUpdate({ status: "", note: "" });
                    }}
                    className="btn-secondary flex-1 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Comment Modal */}
      <AnimatePresence>
        {showCommentModal && selectedComplaint && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="glass-effect rounded-2xl p-6 w-96 max-w-full shadow-elevated">
              <h3 className="text-lg font-heading mb-4">
                Reject Complaint as Fake
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <label className="form-label">
                    Reason for rejection (required)
                  </label>
                  <textarea
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="form-input bg-white/5"
                    placeholder="Explain clearly why this complaint is being marked as fake."
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleAddComment}
                    disabled={
                      !comment.trim() || addCommentMutation.isPending
                    }
                    className="btn-danger flex-1 text-sm disabled:opacity-50"
                  >
                    {addCommentMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      "Reject Complaint"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowCommentModal(false);
                      setComment("");
                    }}
                    className="btn-secondary flex-1 text-sm"
                  >
                    Cancel
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

export default CopDashboard;
