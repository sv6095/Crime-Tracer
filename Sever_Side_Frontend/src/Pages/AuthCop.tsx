// src/pages/AuthCop.tsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { AuthScene } from "@/components/3d/AuthScene";
import { MaleCopModel } from "@/components/3d/MaleCopModel";
import { FemaleCopModel } from "@/components/3d/FemaleCopModel";

import { Button } from "@/components/ui/shadcn/button";
import { useAuth } from "@/contexts/AuthContext";
import { DK_POLICE_STATIONS } from "@/constants/stations";

type LoginFormData = {
  identifier: string; // email only for cops
  password: string;
};

type RegisterFormData = {
  name: string;
  email: string;
  phone: string;
  badgeId: string;
  station: string;
  password: string;
  confirmPassword: string;
};

const ModelPlaceholder: React.FC<{ title?: string }> = ({ title }) => {
  const { t } = useTranslation();
  return (
  <div
    className="w-full h-full rounded-2xl flex items-center justify-center"
    style={{
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
      minHeight: 420,
    }}
  >
    <div className="text-center px-6">
      <div
        className="mx-auto mb-4 w-56 h-56 rounded-xl flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg,#111 0%, #0b0b0b 100%)",
          border: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <svg width="96" height="96" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 2l7 3v6c0 5-3.5 9.7-7 11-3.5-1.3-7-6-7-11V5l7-3z"
            fill="currentColor"
            opacity="0.12"
          />
          <path d="M8 10h8v4H8z" fill="currentColor" opacity="0.06" />
        </svg>
      </div>
      <div
        style={{ color: "var(--text-on-dark)" }}
        className="mb-2 font-heading text-lg"
      >
        {title || t("auth.introTitle")}
      </div>
      <div className="text-sm text-white/60 max-w-xs mx-auto">
        {t("auth.introSubtitle")}
      </div>
    </div>
  </div>
);
};

export default function AuthCop() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, registerCop } = useAuth(); // NEW: Cop registration
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const redirectTarget = searchParams.get("from") || "/cop/dashboard";

  const {
    register: loginRegister,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
    reset: resetLogin,
  } = useForm<LoginFormData>({
    defaultValues: { identifier: "", password: "" },
  });

  const {
    register: regRegister,
    handleSubmit: handleRegisterSubmit,
    watch: regWatch,
    formState: { errors: regErrors },
    reset: resetRegister,
  } = useForm<RegisterFormData>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      badgeId: "",
      station: "",
      password: "",
      confirmPassword: "",
    },
  });

  const switchToRegister = () => {
    setMode("register");
    resetLogin();
  };

  const switchToLogin = () => {
    setMode("login");
    resetRegister();
  };

  const onLogin = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const user = await login(data.identifier, data.password, "police"); // ROLE UPDATED to 'police'
      toast.success(`Logged in. Welcome, Officer ${user.name || ""}.`);
      navigate(redirectTarget, { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRegister = async (data: RegisterFormData) => {
    if (data.password !== data.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!data.station) {
      toast.error("Select your posting station");
      return;
    }

    setIsSubmitting(true);
    try {
      await registerCop({
        name: data.name,
        email: data.email,
        phone: data.phone,
        badgeId: data.badgeId,
        password: data.password,
        station: data.station,
      });

      toast.success("Registration submitted. Await admin approval.");
      navigate("/cop/login");
    } catch (err: any) {
      toast.error(err?.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLogin = mode === "login";
  const modelOnRightForLogin = true;
  const showModelOnRight = isLogin ? modelOnRightForLogin : !modelOnRightForLogin;
  const regPassword = regWatch("password");

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        backgroundColor: "var(--background-dark)",
        color: "var(--text-on-dark)",
      }}
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">

          {/* MODEL LEFT OR RIGHT */}
          {!showModelOnRight && (
            <div className="hidden lg:flex items-center justify-center">
              <div className="w-full max-w-xl">
                <AuthScene>
                  {isLogin ? <MaleCopModel /> : <FemaleCopModel />}
                </AuthScene>
              </div>
            </div>
          )}

          {/* MAIN AUTH CARD */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-xl">
              <div
                className="glass-effect rounded-2xl p-8 shadow-elevated border"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2
                      className="text-2xl font-heading font-bold"
                      style={{ color: "var(--text-on-dark)" }}
                    >
                      {isLogin ? t("auth.loginTitle") : t("auth.registerTitle")}
                    </h2>
                    <p className="text-sm text-white/70 mt-1">
                      {isLogin
                        ? t("auth.loginDesc")
                        : t("auth.registerDesc")}
                    </p>
                  </div>

                  <button
                    onClick={() => navigate(-1)}
                    className="text-white/70 hover:text-white text-sm underline-offset-4 hover:underline"
                  >
                    {t("common.back")}
                  </button>
                </div>

                <div className="space-y-4">
                  {/* LOGIN */}
                  {isLogin ? (
                    <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">
                          {t("auth.identifier")}
                        </label>
                        <input
                          {...loginRegister("identifier", { required: "Email/Username required" })}
                          type="text"
                          placeholder={t("auth.identifierPlaceholder")}
                          className="form-input"
                        />
                        {loginErrors.identifier && (
                          <p className="text-xs text-red-400 mt-1">
                            {loginErrors.identifier.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2">
                          {t("auth.password")}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            {...loginRegister("password", { required: "Required" })}
                            type={showPassword ? "text" : "password"}
                            placeholder={t("auth.passwordPlaceholder")}
                            className="form-input flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            className="text-xs text-white/70 hover:text-white px-3 py-2 border border-white/20 rounded-md"
                          >
                            {showPassword ? t("auth.hide") : t("auth.show")}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between text-sm">
                        <button
                          type="button"
                          className="text-white/70 hover:text-white"
                        >
                          {t("auth.forgotPassword")}
                        </button>
                        <button
                          type="button"
                          onClick={switchToRegister}
                          className="text-white/70 hover:text-white"
                        >
                          {t("auth.newOfficerRegister")}
                        </button>
                      </div>

                      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? t("auth.loggingIn") : t("auth.login")}
                      </Button>
                    </form>
                  ) : (
                    /* REGISTER */
                    <form onSubmit={handleRegisterSubmit(onRegister)} className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">
                          {t("auth.name")}
                        </label>
                        <input
                          {...regRegister("name", { required: "Required" })}
                          type="text"
                          placeholder={t("auth.namePlaceholder")}
                          className="form-input"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold mb-2">
                            {t("auth.email")}
                          </label>
                          <input
                            {...regRegister("email", { required: "Required" })}
                            type="email"
                            placeholder={t("auth.emailPlaceholder")}
                            className="form-input"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2">
                            {t("auth.phone")}
                          </label>
                          <input
                            {...regRegister("phone", { required: "Required" })}
                            type="tel"
                            placeholder={t("auth.phonePlaceholder")}
                            className="form-input"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2">
                          {t("auth.badgeId")}
                        </label>
                        <input
                          {...regRegister("badgeId", { required: "Required" })}
                          type="text"
                          placeholder={t("auth.badgeIdPlaceholder")}
                          className="form-input"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2">
                          {t("auth.postingStation")}
                        </label>
                        <select
                          {...regRegister("station", { required: "Required" })}
                          className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-black"
                        >
                          <option value="">{t("auth.selectStation")}</option>
                          {DK_POLICE_STATIONS.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-semibold mb-2">
                            {t("auth.password")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              {...regRegister("password", { required: "Required" })}
                              type={showRegPassword ? "text" : "password"}
                              className="form-input flex-1"
                              placeholder={t("auth.createPassword")}
                            />
                            <button
                              type="button"
                              className="text-xs text-white/70 hover:text-white px-3 py-2 border border-white/20 rounded-md"
                              onClick={() => setShowRegPassword((v) => !v)}
                            >
                              {showRegPassword ? t("auth.hide") : t("auth.show")}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2">
                            {t("auth.confirmPassword")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              {...regRegister("confirmPassword", { required: "Required" })}
                              type={showRegConfirm ? "text" : "password"}
                              className="form-input flex-1"
                              placeholder={t("auth.reEnterPassword")}
                            />
                            <button
                              type="button"
                              className="text-xs text-white/70 hover:text-white px-3 py-2 border border-white/20 rounded-md"
                              onClick={() => setShowRegConfirm((v) => !v)}
                            >
                              {showRegConfirm ? t("auth.hide") : t("auth.show")}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between text-sm">
                        <button
                          type="button"
                          onClick={switchToLogin}
                          className="text-white/70 hover:text-white"
                        >
                          {t("auth.alreadyRegistered")}
                        </button>
                      </div>

                      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? t("auth.submitting") : t("auth.register")}
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE MODEL */}
          {showModelOnRight && (
            <div className="hidden lg:flex items-center justify-center">
              <div className="w-full max-w-xl">
                <AuthScene>
                  {isLogin ? <MaleCopModel /> : <FemaleCopModel />}
                </AuthScene>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
