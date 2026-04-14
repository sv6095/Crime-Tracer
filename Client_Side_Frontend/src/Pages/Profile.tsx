// src/pages/Profile.tsx
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save, User } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/shadcn/button";
import { useAuth } from "@/contexts/AuthContext";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  address: z.string().optional().or(z.literal("")),
  emergencyContactName: z.string().optional().or(z.literal("")),
  emergencyContactPhone: z.string().optional().or(z.literal("")),
});

type ProfileForm = z.infer<typeof profileSchema>;

import { getApiBaseUrl } from "@/lib/apiConfig";
const API_BASE = getApiBaseUrl();

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, refreshUserFromApi } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
    },
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!user?.token) {
          setLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE}/api/victim/profile`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.detail || body.error || "Failed to load profile");
        }

        reset({
          name: body.name ?? user?.name ?? "",
          email: body.email ?? user?.email ?? "",
          phone: body.phone ?? user?.phone ?? "",
          address: body.address ?? "",
          emergencyContactName: body.emergency_contact_name ?? "",
          emergencyContactPhone: body.emergency_contact_phone ?? "",
        });
      } catch (error: any) {
        console.error(error);
        toast.error(error.message || "Error loading profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user?.token, user?.name, user?.email, user?.phone, reset]);

  const onSubmit = async (data: ProfileForm) => {
    if (!user?.token) {
      toast.error("You must be logged in to update your profile");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(`${API_BASE}/api/victim/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: data.name,
          email: data.email || null,
          phone: data.phone,
          address: data.address || null,
          emergency_contact_name: data.emergencyContactName || null,
          emergency_contact_phone: data.emergencyContactPhone || null,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detail || body.error || "Failed to update profile");
      }

      // Refresh user data in AuthContext to update header and other components
      await refreshUserFromApi();

      toast.success("Profile updated successfully");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-200" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-10 px-4 bg-black text-white">

      <div className="w-full max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="glass-effect border border-white/10 rounded-3xl shadow-soft-dark p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-400/70">
              <User className="h-5 w-5 text-blue-300" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-semibold tracking-tight">
                {t("profile.title")}
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                {t("profile.description")}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: "var(--text-on-dark)" }}
              >
                {t("profile.name")}
              </label>
              <input
                {...register("name")}
                className="form-input"
                placeholder={t("profile.namePlaceholder")}
                style={{ color: "var(--text-on-dark)" }}
              />
              {errors.name && (
                <p className="text-xs text-red-400">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: "var(--text-on-dark)" }}
              >
                {t("profile.phone")}
              </label>
              <input
                {...register("phone")}
                className="form-input"
                placeholder={t("profile.phonePlaceholder")}
                style={{ color: "var(--text-on-dark)" }}
              />
              {errors.phone && (
                <p className="text-xs text-red-400">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: "var(--text-on-dark)" }}
              >
                {t("profile.email")}
              </label>
              <input
                {...register("email")}
                className="form-input"
                placeholder={t("profile.emailPlaceholder")}
                style={{ color: "var(--text-on-dark)" }}
              />
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: "var(--text-on-dark)" }}
              >
                {t("profile.address")}
              </label>
              <textarea
                {...register("address")}
                className="form-input min-h-[80px]"
                placeholder={t("profile.addressPlaceholder")}
                style={{ color: "var(--text-on-dark)" }}
              />
              {errors.address && (
                <p className="text-xs text-red-400">{errors.address.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "var(--text-on-dark)" }}
                >
                  {t("profile.emergencyContactName")}
                </label>
                <input
                  {...register("emergencyContactName")}
                  className="form-input"
                  placeholder={t("profile.emergencyContactNamePlaceholder")}
                  style={{ color: "var(--text-on-dark)" }}
                />
                {errors.emergencyContactName && (
                  <p className="text-xs text-red-400">
                    {errors.emergencyContactName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "var(--text-on-dark)" }}
                >
                  {t("profile.emergencyContactPhone")}
                </label>
                <input
                  {...register("emergencyContactPhone")}
                  className="form-input"
                  placeholder={t("profile.emergencyContactPhonePlaceholder")}
                  style={{ color: "var(--text-on-dark)" }}
                />
                {errors.emergencyContactPhone && (
                  <p className="text-xs text-red-400">
                    {errors.emergencyContactPhone.message}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <Button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <Save className="h-4 w-4" />
                {saving ? t("profile.saving") : t("profile.saveChanges")}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfilePage;
