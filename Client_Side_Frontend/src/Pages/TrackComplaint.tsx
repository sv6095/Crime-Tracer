// src/pages/TrackComplaint.tsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Search,
  ArrowLeft,
  Phone,
  FileText,
  MapPin,
  Calendar,
  User,
  AlertCircle,
  CheckCircle,
  Clock,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/shadcn/button";
import { getApiBaseUrl } from "@/lib/apiConfig";
import { useAuth } from "@/contexts/AuthContext";

interface Complaint {
  complaint_id: string;
  filer_name: string;
  phone: string;
  email?: string;
  timestamp: string;
  location_text?: string;
  crime_type: string;
  description: string;
  status: string;
  station?: {
    station_name: string;
    address: string;
  };
  accepted_officer?: {
    name: string;
    police_id: string;
  };
  mapped_bns: Array<{
    section: string;
    category: string;
    confidence: number;
    description: string;
  }>;
  ai_precautions: string[];
  status_timeline: Array<{
    status: string;
    timestamp: string;
    updated_by: string;
    note?: string;
  }>;
  officers_required: number;
  predicted_severity: string;
  attachments: string[];
  victim_confirmation_deadline?: string;
  rejection_reason?: string;
  summary?: string;
}

const TrackComplaint: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const token = user?.token || null;

  const [searchType, setSearchType] = useState<"id" | "phone">("id");
  const [searchValue, setSearchValue] = useState("");
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      toast.error("Please enter a search value");
      return;
    }

    if (!token) {
      toast.error("Please log in to track your complaint");
      return;
    }

    setIsLoading(true);
    setError(null);
    setComplaint(null);
    setComplaints([]);

    // Intelligent Search Type Detection
    let effectiveSearchType = searchType;
    const cleanValue = searchValue.trim();

    // If matches 10-digit number and we are on ID mode, switch to phone
    if (effectiveSearchType === "id" && /^\d{10}$/.test(cleanValue)) {
      effectiveSearchType = "phone";
      setSearchType("phone"); // Update UI state
      toast("Auto-switched to Phone Search", { icon: "📱" });
    }
    // If matches CTM- prefix and we are on Phone mode, switch to ID
    else if (effectiveSearchType === "phone" && /^CTM-/i.test(cleanValue)) {
      effectiveSearchType = "id";
      setSearchType("id"); // Update UI state
      toast("Auto-switched to ID Search", { icon: "🆔" });
    }

    try {
      const apiBase = getApiBaseUrl();

      const headers: HeadersInit = {
        Authorization: `Bearer ${token}`,
      };

      let response: Response;
      let url = "";

      if (effectiveSearchType === "id") {
        url = `${apiBase}/api/victim/complaints/by-id/${cleanValue}`;
      } else {
        url = `${apiBase}/api/victim/complaints/by-phone/${cleanValue}`;
      }

      response = await fetch(url, { headers });
      const result = await response.json();

      if (!response.ok) {
        // If 404 and we were "guessing", maybe offer a hint?
        if (response.status === 404 && effectiveSearchType === "id" && /^\d+$/.test(cleanValue)) {
          // Fallback logic could go here, but for now just throw
        }

        const msg =
          result?.detail ||
          result?.error ||
          result?.message ||
          `HTTP ${response.status}`;
        throw new Error(msg);
      }

      // Backend returns direct Object (by-id) or List (by-phone)
      if (effectiveSearchType === "id") {
        const mapped = mapBackendToFrontend(result);
        setComplaint(mapped);
      } else {
        if (Array.isArray(result) && result.length > 0) {
          const mappedList = result.map(mapBackendToFrontend);
          setComplaints(mappedList);
        } else {
          throw new Error("No complaints found for this phone number");
        }
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const mapBackendToFrontend = (data: any): Complaint => {
    return {
      complaint_id: data.complaint_id,
      filer_name: user?.name || "You", // Backend doesn't return this in victim view
      phone: user?.phone || "N/A",
      email: user?.email,
      timestamp: data.created_at,
      location_text: data.location_text,
      crime_type: data.crime_type,
      description: data.description,
      status: data.status,
      station: data.station_name ? { station_name: data.station_name, address: "" } : undefined,
      accepted_officer: data.assigned_officer ? { name: data.assigned_officer, police_id: "Internal" } : undefined,
      // Map BNS sections
      mapped_bns: Array.isArray(data.bns_sections) ? data.bns_sections.map((b: any) => ({
        section: b.section,
        category: b.title,
        confidence: b.confidence,
        description: b.reason
      })) : [],
      // Map Precautions
      ai_precautions: Array.isArray(data.precautions) ? data.precautions : [],
      // Map Timeline - use timeline if available, otherwise fall back to history
      // Timeline entries are already sorted by backend, but ensure chronological order
      status_timeline: (() => {
        let entries: any[] = [];
        
        // Prefer timeline (new immutable system)
        if (data.timeline && Array.isArray(data.timeline) && data.timeline.length > 0) {
          entries = data.timeline.map((t: any) => ({
            status: t.to_state || t.status || "Unknown",
            timestamp: t.created_at,
            updated_by: t.updated_by || "System",
            note: t.reason || (t.from_state && t.to_state ? `${t.from_state} → ${t.to_state}` : "Status updated")
          }));
        }
        // Fall back to history (legacy system)
        else if (data.history && Array.isArray(data.history) && data.history.length > 0) {
          entries = data.history.map((h: any) => ({
            status: h.status,
            timestamp: h.created_at,
            updated_by: h.updated_by || "System",
            note: h.reason || "Status updated"
          }));
        }
        // Fallback: create initial entry from complaint creation
        else {
          entries = [{
            status: data.status || "NOT_ASSIGNED",
            timestamp: data.created_at,
            updated_by: "System",
            note: "Complaint created by victim"
          }];
        }
        
        // Sort by timestamp ascending to show chronological order
        return entries.sort((a, b) => {
          const dateA = new Date(a.timestamp).getTime();
          const dateB = new Date(b.timestamp).getTime();
          return dateA - dateB;
        });
      })(),
      officers_required: 2, // default
      predicted_severity: data.predicted_severity || "Medium",
      attachments: [], // placeholder
      victim_confirmation_deadline: undefined,
      rejection_reason: data.status === "REJECTED" ? "See timeline for details" : undefined,
      summary: data.summary,
    };
  };

  const getStatusColor = (status: string) => {
    // returns tailwind classes suitable for dark glass background
    switch (status.toLowerCase()) {
      case "filed":
        return "text-blue-300 bg-blue-600/10";
      case "assigned":
        return "text-yellow-300 bg-yellow-600/10";
      case "investigating":
        return "text-orange-300 bg-orange-600/10";
      case "resolved":
        return "text-purple-300 bg-purple-600/10";
      case "closed":
        return "text-green-300 bg-green-600/10";
      case "rejected":
        return "text-red-300 bg-red-600/10";
      default:
        return "text-white/80 bg-white/6";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "low":
        return "text-green-300 bg-green-600/10";
      case "medium":
        return "text-yellow-300 bg-yellow-600/10";
      case "high":
        return "text-orange-300 bg-orange-600/10";
      case "critical":
        return "text-red-300 bg-red-600/10";
      default:
        return "text-white/80 bg-white/6";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const handleVictimConfirmation = async (confirm: boolean) => {
    if (!complaint) return;

    if (!token) {
      toast.error("Please log in to confirm your complaint resolution");
      return;
    }

    try {
      const apiBase = getApiBaseUrl();
      const response = await fetch(
        `${apiBase}/api/victim/complaints/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            complaint_id: complaint.complaint_id,
            confirm,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        const msg =
          result?.detail ||
          result?.error ||
          result?.message ||
          `HTTP ${response.status}`;
        throw new Error(msg);
      }

      if (result.success) {
        const action = confirm ? "confirmed" : "rejected";
        toast.success(`Your complaint resolution has been ${action}`);
        // Refresh complaint data
        handleSearch();
      } else {
        throw new Error(result.error || "Failed to record confirmation");
      }
    } catch (err: any) {
      console.error("Victim confirmation error:", err);
      toast.error(err.message || "Failed to record confirmation");
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
    >
      {/* Header */}
      <div className="glass-effect border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/">
              <motion.button
                className="flex items-center space-x-2 text-white/90 hover:text-white transition-colors"
                whileHover={{ x: -5 }}
              >
                <ArrowLeft className="h-5 w-5" />
                <span>{t("common.back")}</span>
              </motion.button>
            </Link>

            <h1
              className="text-xl font-bold"
              style={{ color: "var(--text)" }}
            >
              {t("track.title")}
            </h1>

            <div />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Search Section */}
        <motion.div
          className="max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="glass-effect rounded-2xl p-8 shadow-elevated border"
            style={{ borderColor: "var(--border)" }}
          >
            <h2
              className="text-2xl font-bold mb-6"
              style={{ color: "var(--text)" }}
            >
              {t("track.searchTitle")}
            </h2>

            {/* Search Type Toggle */}
            <div className="flex bg-white/4 rounded-lg p-1 mb-6">
              <motion.button
                onClick={() => setSearchType("id")}
                className={`flex-1 py-2 px-4 rounded-md transition-colors text-sm font-medium ${searchType === "id"
                  ? "bg-white/6 text-white"
                  : "text-white/70 hover:text-white"
                  }`}
                whileTap={{ scale: 0.95 }}
              >
                <div className="flex items-center justify-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>{t("track.byId")}</span>
                </div>
              </motion.button>

              <motion.button
                onClick={() => setSearchType("phone")}
                className={`flex-1 py-2 px-4 rounded-md transition-colors text-sm font-medium ${searchType === "phone"
                  ? "bg-white/6 text-white"
                  : "text-white/70 hover:text-white"
                  }`}
                whileTap={{ scale: 0.95 }}
              >
                <div className="flex items-center justify-center space-x-2">
                  <Phone className="h-4 w-4" />
                  <span>{t("track.byPhone")}</span>
                </div>
              </motion.button>
            </div>

            {/* Search Input */}
            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "var(--text-on-dark)" }}
                >
                  {searchType === "id"
                    ? t("track.enterId")
                    : t("track.enterPhone")}
                </label>

                {/* use shared .form-input and add aria attributes for accessibility */}
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="form-input"
                  placeholder={
                    searchType === "id"
                      ? "CT-1234567890123"
                      : "+91 XXXXX XXXXX"
                  }
                  aria-label={
                    searchType === "id" ? "Complaint ID" : "Phone number"
                  }
                  style={{ color: "var(--text-on-dark)" }}
                />
              </div>

              <div className="flex items-center gap-4">
                <motion.div whileHover={{ scale: isLoading ? 1 : 1.02 }}>
                  <Button
                    size="lg"
                    variant="default"
                    onClick={handleSearch}
                    className="flex items-center gap-3"
                    aria-disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="spinner h-5 w-5" />
                    ) : (
                      <Search className="h-5 w-5" />
                    )}
                    <span>{isLoading ? t("track.searching") : t("track.search")}</span>
                  </Button>
                </motion.div>

                <Link to="/file-complaint">
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex items-center gap-3"
                  >
                    <FileText className="h-5 w-5" />
                    {t("nav.fileComplaint")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error State */}
        {error && (
          <motion.div
            className="max-w-2xl mx-auto mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <p className="text-red-300">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Multiple Complaints (Phone Search) */}
        {complaints.length > 0 && (
          <motion.div
            className="max-w-2xl mx-auto mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className="glass-effect rounded-2xl p-6 border"
              style={{ borderColor: "var(--border)" }}
            >
              <h3
                className="text-xl font-bold mb-4"
                style={{ color: "var(--text)" }}
              >
                {t("track.complaintsFound")} ({complaints.length})
              </h3>

              <div className="space-y-3">
                {complaints.map((comp) => (
                  <motion.button
                    key={comp.complaint_id}
                    onClick={() => {
                      setSearchType("id");
                      setSearchValue(comp.complaint_id);
                      handleSearch();
                    }}
                    className="w-full p-4 rounded-lg hover:bg-white/6 transition-colors text-left flex items-center justify-between"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <div>
                      <div className="font-mono font-semibold text-white/90">
                        {comp.complaint_id}
                      </div>
                      <div className="text-sm text-white/70">
                        {comp.crime_type}
                      </div>
                      <div className="text-xs text-white/50">
                        {formatDate(comp.created_at || comp.timestamp)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          comp.status
                        )}`}
                      >
                        {comp.status}
                      </span>
                      <ExternalLink className="h-4 w-4 text-white/60" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Single Complaint Details */}
        {complaint && (
          <motion.div
            className="max-w-4xl mx-auto mt-8 space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Complaint Header */}
            <div
              className="glass-effect rounded-2xl p-8 border"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3
                    className="text-2xl font-bold mb-2"
                    style={{ color: "var(--text)" }}
                  >
                    {complaint.complaint_id}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-white/70">
                    <span className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(complaint.timestamp)}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>{complaint.filer_name}</span>
                    </span>
                  </div>
                </div>

                <div className="text-right space-y-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
                      complaint.status
                    )}`}
                  >
                    {complaint.status}
                  </span>
                  {complaint.predicted_severity && (
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(
                        complaint.predicted_severity
                      )}`}
                    >
                      {complaint.predicted_severity} Severity
                    </div>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4
                    className="font-semibold mb-2"
                    style={{ color: "var(--text)" }}
                  >
                    {t("track.details")}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Crime Type:</strong>{" "}
                      <span className="text-white/90">
                        {complaint.crime_type}
                      </span>
                    </div>
                    <div>
                      <strong>Description:</strong>
                    </div>
                    <p className="text-white/70 bg-white/4 p-3 rounded-lg">
                      {complaint.description}
                    </p>
                    {complaint.location_text && (
                      <div className="flex items-start space-x-2">
                        <MapPin className="h-4 w-4 text-white/60 mt-0.5" />
                        <span className="text-white/70">
                          {complaint.location_text}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4
                    className="font-semibold mb-2"
                    style={{ color: "var(--text)" }}
                  >
                    {t("track.assignment")}
                  </h4>
                  <div className="space-y-2 text-sm">
                    {complaint.station && (
                      <div className="flex items-start space-x-2">
                        <div className="w-6 h-6 rounded-full bg-white/6 flex items-center justify-center">
                          <ShieldIconPlaceholder />
                        </div>
                        <div>
                          <div className="font-medium text-white/90">
                            {complaint.station.station_name}
                          </div>
                          <div className="text-white/70">
                            {complaint.station.address}
                          </div>
                        </div>
                      </div>
                    )}

                    {complaint.status.toLowerCase() === "rejected" &&
                      complaint.rejection_reason ? (
                      <div className="bg-red-900/15 p-3 rounded-lg border border-red-800/30">
                        <div className="font-medium text-red-300 flex items-center">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          Rejected - Fake Case
                        </div>
                        <div className="text-red-300 mt-1 text-sm">
                          Reason: {complaint.rejection_reason}
                        </div>
                      </div>
                    ) : complaint.accepted_officer ? (
                      <div className="bg-white/6 p-3 rounded-lg">
                        <div className="font-medium text-white">
                          Accepted By
                        </div>
                        <div className="text-white/70">
                          {complaint.accepted_officer.name} (
                          {complaint.accepted_officer.police_id})
                        </div>
                      </div>
                    ) : null}

                    {!complaint.rejection_reason && (
                      <div className="text-xs text-white/60">
                        {complaint.officers_required} officers required
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* BNS Sections */}
            {complaint.mapped_bns && complaint.mapped_bns.length > 0 && (
              <div
                className="glass-effect rounded-2xl p-8 border"
                style={{ borderColor: "var(--border)" }}
              >
                <h4
                  className="font-semibold mb-4"
                  style={{ color: "var(--text)" }}
                >
                  {t("track.sections")}
                </h4>
                <div className="space-y-3">
                  {complaint.mapped_bns.map((bns, index) => (
                    <div
                      key={index}
                      className="border border-white/7 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-semibold text-white/90">
                          {bns.section}
                        </span>
                      </div>
                      <div className="text-sm text-white/70">
                        {bns.description}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-yellow-900/12 border border-yellow-800/20 rounded-lg">
                  <p className="text-sm text-yellow-200">
                  
                  </p>
                </div>
              </div>
            )}

            {/* Victim Summary */}
            {complaint.summary && (
              <div
                className="glass-effect rounded-2xl p-8 border"
                style={{ borderColor: "var(--border)" }}
              >
                <h4
                  className="font-semibold mb-4 flex items-center space-x-2"
                  style={{ color: "var(--text)" }}
                >
                  <div className="w-5 h-5 rounded-full bg-blue-600/20 flex items-center justify-center">
                    <FileText className="w-3 h-3 text-blue-300" />
                  </div>
                  <span>{t("track.summary")}</span>
                </h4>
                <p className="text-white/80 leading-relaxed italic">
                  "{complaint.summary}"
                </p>
              </div>
            )}

            {/* AI Precautions */}
            {complaint.ai_precautions &&
              complaint.ai_precautions.length > 0 && (
                <div
                  className="glass-effect rounded-2xl p-8 border"
                  style={{ borderColor: "var(--border)" }}
                >
                  <h4
                    className="font-semibold mb-4 flex items-center space-x-2"
                    style={{ color: "var(--text)" }}
                  >
                    <div className="w-5 h-5 rounded-full bg-green-600/20 flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 text-green-300" />
                    </div>
                    <span>{t("track.precautions")}</span>
                  </h4>
                  <div className="space-y-2">
                    {complaint.ai_precautions.map((precaution, index) => (
                      <div
                        key={index}
                        className="flex items-start space-x-3"
                      >
                        <CheckCircle className="h-4 w-4 text-green-300 mt-0.5 flex-shrink-0" />
                        <span className="text-white/70">{precaution}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Status Timeline */}
            {complaint.status_timeline &&
              complaint.status_timeline.length > 0 && (
                <div
                  className="glass-effect rounded-2xl p-8 border"
                  style={{ borderColor: "var(--border)" }}
                >
                  <h4
                    className="font-semibold mb-6 flex items-center space-x-2"
                    style={{ color: "var(--text)" }}
                  >
                    <Clock className="h-5 w-5 text-white/70" />
                    <span>{t("track.timeline")}</span>
                  </h4>
                  <div className="space-y-4">
                    {complaint.status_timeline.map((entry, index) => (
                      <motion.div
                        key={index}
                        className="flex items-start space-x-4"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.06 }}
                      >
                        <div className="w-3 h-3 bg-white/80 rounded-full mt-2 flex-shrink-0"></div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                                entry.status
                              )}`}
                            >
                              {entry.status}
                            </span>
                            <span className="text-xs text-white/60">
                              {formatDate(entry.timestamp)}
                            </span>
                          </div>
                          <div className="text-sm text-white/70 mt-1">
                            Updated by {entry.updated_by}
                          </div>
                          {entry.note && (
                            <div className="text-sm text-white/70 mt-1 bg-white/4 p-2 rounded">
                              {entry.note}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

            {/* Victim Confirmation */}
            {complaint.status.toLowerCase() === "resolved" &&
              complaint.victim_confirmation_deadline && (
                <div
                  className="glass-effect rounded-2xl p-8 border-l-4 border-purple-500"
                  style={{ borderColor: "var(--border)" }}
                >
                  <h4
                    className="font-semibold mb-4 flex items-center space-x-2"
                    style={{ color: "var(--text)" }}
                  >
                    <MessageSquare className="h-5 w-5 text-purple-400" />
                    <span>Victim Confirmation Required</span>
                  </h4>
                  <p className="text-white/70 mb-4">
                    Please confirm if your complaint has been resolved to your
                    satisfaction.
                  </p>

                  <p className="text-sm text-white/60 mb-6">
                    Deadline:{" "}
                    {formatDate(complaint.victim_confirmation_deadline)}
                  </p>

                  <div className="flex space-x-4">
                    <motion.div whileHover={{ scale: 1.02 }}>
                      <Button
                        size="lg"
                        variant="default"
                        className="bg-green-600 text-white"
                        onClick={() => handleVictimConfirmation(true)}
                      >
                        Yes, Resolved
                      </Button>
                    </motion.div>

                    <motion.div whileHover={{ scale: 1.02 }}>
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={() => handleVictimConfirmation(false)}
                      >
                        No, Not Resolved
                      </Button>
                    </motion.div>
                  </div>
                </div>
              )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

/**
 * Small placeholder component for station icon (we removed lucide's Shield earlier)
 * You can replace this with an inline SVG logo if desired.
 */
const ShieldIconPlaceholder: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 2l7 3v6c0 5-3.5 9.7-7 11-3.5-1.3-7-6-7-11V5l7-3z"
      fill="currentColor"
      className="text-white/70"
    />
  </svg>
);

export default TrackComplaint;
