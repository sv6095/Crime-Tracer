// src/pages/FileComplaint.tsx
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Camera,
  MapPin,
  Upload,
  CheckCircle,
  Copy,
  Home,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

import CameraCapture from "@/components/CameraCapture";
import StationSelector from "@/components/StationSelector";
import { Station } from "@/hooks/useStations";
import { Button } from "@/components/ui/shadcn/button";
import { DK_POLICE_STATIONS } from "@/constants/stations";
import { useUploadFile } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { fileComplaint } from "@/hooks/usePublicApi";
import { getApiBaseUrl } from "@/lib/apiConfig";

const API_BASE = getApiBaseUrl();

const complaintSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  // 🔒 Email now compulsory
  email: z.string().email("Invalid email"),
  crime_type: z.string().min(1, "Please select a crime type"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters"),
  location_text: z.string().optional(),
});

type ComplaintForm = z.infer<typeof complaintSchema>;

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
}

const OPENCAGE_KEY = import.meta.env.VITE_OPENCAGE_API_KEY;

const FileComplaint: React.FC = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const selectedStation = (location.state as any)?.selectedStation as
    | Station
    | undefined;

  const [currentStep, setCurrentStep] = useState(1);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [selectedStationData, setSelectedStationData] = useState<Station | null>(
    selectedStation || null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [complaintId, setComplaintId] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<ComplaintForm>({
    resolver: zodResolver(complaintSchema),
    defaultValues: {
      name: user?.name || "",
      phone: user?.phone || "",
      email: user?.email || "",
      crime_type: "",
      description: "",
      location_text: "",
    },
  });

  const locationText = watch("location_text");
  const phoneValue = watch("phone");
  const emailValue = watch("email");

  // 🔐 OTP state – phone
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpVerified, setPhoneOtpVerified] = useState(false);
  const [phoneOtpInput, setPhoneOtpInput] = useState("");
  const [phoneOtpLoading, setPhoneOtpLoading] = useState(false);
  const [phoneGeneratedOtp, setPhoneGeneratedOtp] = useState<string | null>(
    null
  );

  // 🔐 OTP state – email
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpVerified, setEmailOtpVerified] = useState(false);
  const [emailOtpInput, setEmailOtpInput] = useState("");
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);
  const [emailGeneratedOtp, setEmailGeneratedOtp] = useState<string | null>(
    null
  );

  // If phone is edited after verification, reset OTP state
  // Update form values when user data changes (e.g., after profile update)
  useEffect(() => {
    if (user) {
      setValue("name", user.name || "");
      setValue("phone", user.phone || "");
      setValue("email", user.email || "");
    }
  }, [user?.name, user?.phone, user?.email, setValue]);

  useEffect(() => {
    setPhoneOtpSent(false);
    setPhoneOtpVerified(false);
    setPhoneOtpInput("");
    setPhoneGeneratedOtp(null);
  }, [phoneValue]);

  // If email is edited after verification, reset OTP state
  useEffect(() => {
    setEmailOtpSent(false);
    setEmailOtpVerified(false);
    setEmailOtpInput("");
    setEmailGeneratedOtp(null);
  }, [emailValue]);

  const crimeTypes = [
    "Theft",
    "Burglary",
    "Assault",
    "Fraud",
    "Vandalism",
    "Domestic Violence",
    "Traffic Violation",
    "Cybercrime",
    "Drug Offense",
    "Harassment",
    "Missing Person",
    "Other",
  ];

  const getCurrentLocation = () => {
    setGpsLoading(true);
    if (!navigator.geolocation) {
      toast.error("Location not supported by your device");
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocationData({ lat: latitude, lng: longitude });

        try {
          if (OPENCAGE_KEY) {
            const url = `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${OPENCAGE_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            const formatted =
              data?.results?.[0]?.formatted || "Location captured";
            setValue("location_text", formatted);
          } else {
            setValue(
              "location_text",
              `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`
            );
          }
          toast.success("Location captured successfully");
        } catch (err) {
          console.error(err);
          toast.error("Location captured, but address lookup failed");
        } finally {
          setGpsLoading(false);
        }
      },
      (error) => {
        console.error(error);
        toast.error("Failed to capture location");
        setGpsLoading(false);
      }
    );
  };

  // Upload local files → /uploads/photo|attachment
  const handleFileInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    try {
      const uploadedIds: string[] = [];

      for (const file of fileArray) {
        const type: "photo" | "attachment" = file.type.startsWith("image/")
          ? "photo"
          : "attachment";

        const result = await uploadFile({ file, type });
        if (result?.file_id) {
          uploadedIds.push(result.file_id);
        }
      }

      if (uploadedIds.length > 0) {
        setAttachments((prev) => [...prev, ...uploadedIds]);
        toast.success(`${uploadedIds.length} file(s) uploaded`);
      } else {
        toast.error("Upload failed for all files");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to upload file(s)");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Upload camera capture → /uploads/photo
  const handleCameraCapture = async (blob: Blob) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedPhoto(reader.result as string);
      };
      reader.readAsDataURL(blob);

      const file = new File([blob], "camera-evidence.jpg", {
        type: "image/jpeg",
      });
      const result = await uploadFile({ file, type: "photo" });

      if (result?.file_id) {
        setAttachments((prev) => [...prev, result.file_id]);
        toast.success("Photo captured & uploaded");
      } else {
        toast.error("Failed to store captured photo");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Camera upload failed");
    } finally {
      setShowCamera(false);
    }
  };

  // 🔐 Simulated send OTP for phone – frontend generates, backend used only on verify
  const handleSendPhoneOtp = async () => {
    if (!phoneValue || phoneValue.trim().length < 10) {
      toast.error("Please enter a valid phone number before verifying");
      return;
    }

    try {
      setPhoneOtpLoading(true);
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      setPhoneGeneratedOtp(otp);
      setPhoneOtpSent(true);
      setPhoneOtpVerified(false);
      setPhoneOtpInput("");
      // Dev only – in real world you'd send SMS from backend
      console.log("Phone OTP (dev only):", otp);
      toast.success("OTP sent to your phone number");
    } catch (err) {
      console.error(err);
      toast.error("Failed to send phone OTP");
    } finally {
      setPhoneOtpLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phoneGeneratedOtp) {
      toast.error("Click Verify to receive OTP first");
      return;
    }
    if (phoneOtpInput.trim() !== phoneGeneratedOtp) {
      toast.error("Incorrect phone OTP");
      return;
    }

    if (!user?.token) {
      toast.error("Please log in again");
      return;
    }

    try {
      // send phone and entered OTP as JSON body — backend often expects these fields
      const body = {
        phone: phoneValue,
        otp: phoneOtpInput,
      };

      const res = await fetch(`${API_BASE}/api/victim/verify-phone`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(body),
      });

      // Helpful debug log
      console.log("[verify-phone] status:", res.status);

      if (!res.ok) {
        let msg = `Failed to verify phone (HTTP ${res.status})`;
        try {
          const data = await res.json();
          msg = data?.detail || data?.error || JSON.stringify(data) || msg;
          console.error("[verify-phone] response:", data);
        } catch (parseErr) {
          console.error("[verify-phone] failed to parse JSON", parseErr);
        }
        throw new Error(msg);
      }

      setPhoneOtpVerified(true);
      toast.success("Phone number verified");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to confirm phone OTP");
    }
  };

  // 🔐 Simulated send OTP for email – frontend generates, backend used only on verify
  const handleSendEmailOtp = async () => {
    if (!emailValue || !emailValue.trim()) {
      toast.error("Please enter a valid email before verifying");
      return;
    }

    try {
      setEmailOtpLoading(true);
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      setEmailGeneratedOtp(otp);
      setEmailOtpSent(true);
      setEmailOtpVerified(false);
      setEmailOtpInput("");
      // Dev only – in real world you'd send an email from backend
      console.log("Email OTP (dev only):", otp);
      toast.success("OTP sent to your email");
    } catch (err) {
      console.error(err);
      toast.error("Failed to send email OTP");
    } finally {
      setEmailOtpLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!emailGeneratedOtp) {
      toast.error("Click Verify to receive OTP first");
      return;
    }
    if (emailOtpInput.trim() !== emailGeneratedOtp) {
      toast.error("Incorrect email OTP");
      return;
    }

    if (!user?.token) {
      toast.error("Please log in again");
      return;
    }

    try {
      // send email and entered OTP as JSON body — backend often expects these fields
      const body = {
        email: emailValue,
        otp: emailOtpInput,
      };

      const res = await fetch(`${API_BASE}/api/victim/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(body),
      });

      console.log("[verify-email] status:", res.status);

      if (!res.ok) {
        let msg = `Failed to verify email (HTTP ${res.status})`;
        try {
          const data = await res.json();
          msg = data?.detail || data?.error || JSON.stringify(data) || msg;
          console.error("[verify-email] response:", data);
        } catch (parseErr) {
          console.error("[verify-email] failed to parse JSON", parseErr);
        }
        throw new Error(msg);
      }

      setEmailOtpVerified(true);
      toast.success("Email verified");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to confirm email OTP");
    }
  };

  const onSubmit = async (data: ComplaintForm) => {
    // 0️⃣ Hard auth guard: must be logged in & have JWT
    if (!isAuthenticated || !user?.token) {
      toast.error("Please log in before submitting a complaint");
      navigate("/auth?from=/file-complaint");
      return;
    }

    // 1️⃣ Extra guard: OTP must be verified before submit
    if (!phoneOtpVerified || !emailOtpVerified) {
      toast.error("Please verify both phone and email before submitting");
      setCurrentStep(1);
      return;
    }

    // 2️⃣ Station required
    if (!selectedStationData) {
      toast.error("Please select a police station");
      setCurrentStep(3);
      return;
    }

    // 3️⃣ At least one evidence
    if (attachments.length === 0 && !capturedPhoto) {
      toast.error("Please attach at least one evidence file or photo");
      setCurrentStep(2);
      return;
    }

    // 4️⃣ Location must be present (either GPS or text)
    if (!locationData && !locationText) {
      toast.error("Please provide location via GPS or address text");
      setCurrentStep(3);
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        filer_name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        crime_type: data.crime_type,
        description: data.description,
        station_id: String(selectedStationData.id),
        location: locationData
          ? { lat: locationData.lat, lng: locationData.lng }
          : null,
        attachments: attachments.length > 0 ? attachments : undefined,
      };

      console.log(
        "[FileComplaint] Submitting with token (first 20 chars):",
        user.token.slice(0, 20)
      );

      const result = await fileComplaint(payload, user.token);

      const newId =
        (result as any).complaint_id ||
        (result as any).id ||
        (result as any).reference_id ||
        (result as any).complaint_reference;

      if (newId) {
        setComplaintId(newId);
        toast.success("Complaint submitted successfully");
        setCurrentStep(4);
      } else {
        toast.success("Complaint submitted, but no ID returned");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to submit complaint");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStationChange = (station: Station | null) => {
    setSelectedStationData(station);
  };

  const steps = [
    { id: 1, title: t("complaint.step1") },
    { id: 2, title: t("complaint.step2") },
    { id: 3, title: t("complaint.step3") },
    { id: 4, title: t("complaint.step4") },
  ];

  // 🔒 Custom Next handler so step 1 is hard-blocked until OTPs done
  const handleNext = async () => {
    if (currentStep === 1) {
      const valid = await trigger([
        "name",
        "phone",
        "email",
        "crime_type",
        "description",
      ]);
      if (!valid) {
        toast.error("Please fill all required details before proceeding");
        return;
      }
      if (!phoneOtpVerified || !emailOtpVerified) {
        toast.error("Please verify both phone and email using OTP");
        return;
      }
    }
    setCurrentStep((s) => Math.min(3, s + 1));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-10 px-4 bg-black text-white">
      <div className="w-full max-w-5xl">
        {/* Back/Home Actions */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("common.backToHome")}
          </Link>
          <Link
            to="/"
            className="inline-flex items-center text-sm text-slate-300 hover:text-white"
          >
            <Home className="h-4 w-4 mr-1" />
            Crime Tracer
          </Link>
        </div>

        {/* Card */}
        <div
          className="glass-effect border border-white/10 rounded-3xl shadow-soft-dark p-6 md:p-8"
        >
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-semibold tracking-tight">
                {t("complaint.title")}
              </h1>
              <p className="text-sm text-slate-300 mt-1 max-w-xl">
                This is a secure digital pre-FIR complaint. Your details are
                shared only with the respective police station in Dakshina
                Kannada.
              </p>
            </div>
            <div className="text-xs text-right text-slate-400">
              <div className="font-mono">{t("common.modeVictim")}</div>
              {selectedStationData ? (
                <div>
                  <div className="font-semibold">{selectedStationData.name}</div>
                  <div className="text-[11px] text-slate-400">
                    {selectedStationData.address}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-amber-300">
                  {t("complaint.stationNotSelected")}
                </div>
              )}
            </div>
          </div>

          {/* Steps indicator */}
          <div className="flex items-center gap-3 mb-6">
            {steps.map((step) => (
              <div key={step.id} className="flex-1 flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                    currentStep >= step.id
                      ? "bg-blue-500 text-white"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {step.id}
                </div>
                <span className="text-xs text-slate-300 hidden sm:inline">
                  {step.title}
                </span>
                {step.id < steps.length && (
                  <div className="flex-1 h-px bg-slate-800" />
                )}
              </div>
            ))}
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6"
            autoComplete="off"
            noValidate
          >
            {/* STEP 1: Details */}
            {currentStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.25 }}
                className="grid gap-5 md:grid-cols-2"
              >
                <div className="space-y-2">
                  <label
                    className="block text-sm font-semibold mb-2"
                    style={{ color: "var(--text-on-dark)" }}
                  >
                    {t("auth.name")}
                  </label>
                  <input
                    {...register("name")}
                    className="form-input"
                    placeholder="Your full name"
                    style={{ color: "var(--text-on-dark)" }}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-400">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Phone + OTP */}
                <div className="space-y-2">
                  <label
                    className="block text-sm font-semibold mb-2"
                    style={{ color: "var(--text-on-dark)" }}
                  >
                    {t("auth.phone")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      {...register("phone")}
                      className="form-input flex-1"
                      placeholder="10-digit mobile number"
                      style={{ color: "var(--text-on-dark)" }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendPhoneOtp}
                      disabled={phoneOtpLoading || phoneOtpVerified}
                      className="whitespace-nowrap text-xs md:text-sm"
                    >
                      {phoneOtpVerified ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {t("auth.verified")}
                        </span>
                      ) : phoneOtpLoading ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t("auth.sending")}
                        </span>
                      ) : (
                        t("auth.verify")
                      )}
                    </Button>
                  </div>
                  {errors.phone && (
                    <p className="text-xs text-red-400">
                      {errors.phone.message}
                    </p>
                  )}

                  {phoneOtpSent && !phoneOtpVerified && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={phoneOtpInput}
                        onChange={(e) => setPhoneOtpInput(e.target.value)}
                        className="form-input flex-1"
                        placeholder="Enter OTP sent to your phone"
                        style={{ color: "var(--text-on-dark)" }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleVerifyPhoneOtp}
                        className="whitespace-nowrap text-xs md:text-sm"
                      >
                        {t("auth.confirmOtp")}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Email + OTP */}
                <div className="space-y-2">
                  <label
                    className="block text-sm font-semibold mb-2"
                    style={{ color: "var(--text-on-dark)" }}
                  >
                    {t("auth.email")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      {...register("email")}
                      className="form-input flex-1"
                      placeholder="you@example.com"
                      style={{ color: "var(--text-on-dark)" }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendEmailOtp}
                      disabled={emailOtpLoading || emailOtpVerified}
                      className="whitespace-nowrap text-xs md:text-sm"
                    >
                      {emailOtpVerified ? (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {t("auth.verified")}
                        </span>
                      ) : emailOtpLoading ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {t("auth.sending")}
                        </span>
                      ) : (
                        t("auth.verify")
                      )}
                    </Button>
                  </div>
                  {errors.email && (
                    <p className="text-xs text-red-400">
                      {errors.email.message}
                    </p>
                  )}

                  {emailOtpSent && !emailOtpVerified && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={emailOtpInput}
                        onChange={(e) => setEmailOtpInput(e.target.value)}
                        className="form-input flex-1"
                        placeholder="Enter OTP sent to your email"
                        style={{ color: "var(--text-on-dark)" }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleVerifyEmailOtp}
                        className="whitespace-nowrap text-xs md:text-sm"
                      >
                        {t("auth.confirmOtp")}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    className="block text-sm font-semibold mb-2"
                    style={{ color: "var(--text-on-dark)" }}
                  >
                    {t("complaint.crimeType")}
                  </label>
                  <select
                    {...register("crime_type")}
                    className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t("complaint.crimeTypePlaceholder")}</option>
                    {crimeTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {errors.crime_type && (
                    <p className="text-xs text-red-400">
                      {errors.crime_type.message}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label
                    className="block text-sm font-semibold mb-2"
                    style={{ color: "var(--text-on-dark)" }}
                  >
                    Incident Description
                  </label>
                  <textarea
                    {...register("description")}
                    className="form-input min-h-[120px]"
                    placeholder="Describe what happened, when, and who was involved."
                    style={{ color: "var(--text-on-dark)" }}
                  />
                  {errors.description && (
                    <p className="text-xs text-red-400">
                      {errors.description.message}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1">
                    Do not share passwords, OTPs, or sensitive financial
                    details. Police will never ask for these here.
                  </p>
                </div>
              </motion.div>
            )}

            {/* STEP 2: Evidence */}
            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold mb-1">
                      Attach Files (images, PDFs, docs)
                    </label>
                    <div className="flex flex-col gap-3">
                      <label className="flex flex-col items-center justify-center border border-dashed border-slate-700 rounded-2xl py-6 px-4 cursor-pointer hover:border-slate-500 hover:bg-slate-900/40 transition-colors">
                        <Upload className="h-6 w-6 text-slate-300 mb-2" />
                        <span className="text-xs text-slate-300">
                          Click to upload or drag & drop
                        </span>
                        <span className="text-[11px] text-slate-500 mt-1">
                          JPG, PNG, PDF, DOC, CSV up to 10MB
                        </span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleFileInputChange}
                        />
                      </label>

                      {attachments.length > 0 && (
                        <div className="bg-black/30 border border-slate-800 rounded-xl p-3 max-h-40 overflow-y-auto">
                          <p className="text-[11px] text-slate-400 mb-2">
                            Attached evidence IDs (stored securely on server):
                          </p>
                          <ul className="space-y-1 text-[11px] font-mono text-slate-300">
                            {attachments.map((id) => (
                              <li key={id} className="truncate">
                                {id}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-semibold mb-1">
                      Capture Photo (live evidence)
                    </label>
                    <div className="space-y-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowCamera(true)}
                        className="inline-flex items-center gap-2"
                      >
                        <Camera className="h-4 w-4" />
                        Open Camera
                      </Button>
                      {capturedPhoto && (
                        <div className="space-y-2">
                          <p className="text-[11px] text-slate-400">
                            Last captured photo:
                          </p>
                          <img
                            src={capturedPhoto}
                            alt="Captured evidence"
                            className="w-full max-h-48 object-cover rounded-xl border border-slate-800"
                          />
                        </div>
                      )}
                      <p className="text-[11px] text-slate-400">
                        Camera photos are auto-uploaded as evidence and linked
                        to this complaint.
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400">
                  Upload only relevant evidence. Sharing false or misleading
                  information is punishable under law.
                </p>
              </motion.div>
            )}

            {/* STEP 3: Location & Station */}
            {currentStep === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      className="block text-sm font-semibold mb-2"
                      style={{ color: "var(--text-on-dark)" }}
                    >
                      Incident Location (address or landmark)
                    </label>
                    <textarea
                      {...register("location_text")}
                      className="form-input min-h-[80px]"
                      placeholder="Nearby landmarks, street name, area, etc."
                      style={{ color: "var(--text-on-dark)" }}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      You can either type the address or use GPS to auto-fill
                      your location.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-semibold mb-1">
                      Use GPS Location
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={getCurrentLocation}
                      disabled={gpsLoading}
                      className="inline-flex items-center gap-2"
                    >
                      {gpsLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                      {gpsLoading ? "Capturing location..." : "Use current GPS"}
                    </Button>
                    {locationData && (
                      <p className="text-[11px] text-emerald-300">
                        Location captured: ({locationData.lat.toFixed(4)},{" "}
                        {locationData.lng.toFixed(4)})
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold mb-2">
                    Police Station
                  </label>
                  <div className="space-y-2">
                    <StationSelector
                      selectedStation={selectedStationData}
                      onChange={handleStationChange}
                      allStations={DK_POLICE_STATIONS as any}
                      showAutoDetect={true}
                    />
                    {!selectedStationData && (
                      <p className="text-xs text-amber-300 mt-1">
                        Station is required to submit complaint.
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">
                    We route your complaint to the station you choose here. If
                    this is incorrect, it may delay the response but will still
                    be visible to Dakshina Kannada police.
                  </p>
                </div>
              </motion.div>
            )}

            {/* STEP 4: Summary */}
            {currentStep === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                  <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    Complaint Submitted
                  </h2>
                  <p className="text-xs text-slate-300 mb-3">
                    Your complaint has been sent securely to Dakshina Kannada
                    Police.
                  </p>

                  {complaintId && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1">
                        <p className="text-xs text-slate-300">
                          Your complaint reference ID:
                        </p>
                        <p className="text-sm font-mono text-white mt-1 break-all">
                          {complaintId}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="inline-flex items-center gap-2"
                        onClick={() => {
                          if (!complaintId) return;
                          navigator.clipboard
                            .writeText(complaintId)
                            .then(() => toast.success("Copied to clipboard"))
                            .catch(() => toast.error("Failed to copy ID"));
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full">
                    <Button
                      className="flex-1"
                      variant="outline"
                      type="button"
                      onClick={() => {
                        setCurrentStep(1);
                        setComplaintId(null);
                        setAttachments([]);
                        setCapturedPhoto(null);
                        setLocationData(null);
                        setSelectedStationData(selectedStation || null);
                        setValue("crime_type", "");
                        setValue("description", "");
                        setValue("location_text", "");
                        setValue("name", user?.name || "");
                        setValue("phone", user?.phone || "");
                        setValue("email", user?.email || "");

                        // reset OTP states
                        setPhoneOtpSent(false);
                        setPhoneOtpVerified(false);
                        setPhoneOtpInput("");
                        setPhoneGeneratedOtp(null);

                        setEmailOtpSent(false);
                        setEmailOtpVerified(false);
                        setEmailOtpInput("");
                        setEmailGeneratedOtp(null);
                      }}
                    >
                      File another complaint
                    </Button>
                    <Link to="/track" className="flex-1">
                      <Button
                        className="w-full"
                        variant="destructive"
                        type="button"
                      >
                        Go to Track Complaint
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Footer actions (Next/Back/Submit) */}
            {currentStep < 4 && (
              <div className="flex justify-between items-center pt-4 border-t border-slate-800 mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={currentStep === 1}
                  onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <div className="flex items-center gap-3">
                  <p className="text-[11px] text-slate-400 hidden sm:block">
                    Step {currentStep} of 4
                  </p>
                  {currentStep < 3 && (
                    <Button type="button" onClick={handleNext}>
                      Next
                    </Button>
                  )}
                  {currentStep === 3 && (
                    <Button
                      type="submit"
                      disabled={
                        isSubmitting || isUploading || !selectedStationData
                      }
                      className="inline-flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      {isSubmitting ? "Submitting…" : "Submit complaint"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {showCamera && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="max-w-3xl w-full mx-4 glass-effect rounded-2xl p-4 border border-white/20">
            <CameraCapture
              onCapture={handleCameraCapture}
              onClose={() => setShowCamera(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FileComplaint;
