// src/pages/AuthVictim.tsx
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
  identifier: string; // email or phone depending on toggle
  password: string;
};

type RegisterFormData = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  address: string;
  station: string;
};

const ModelPlaceholder: React.FC<{ title?: string }> = ({ title }) => (
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
        {/* Simple placeholder shape (side visual only) */}
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
        {title || t("auth.citizenSafetyPortal")}
      </div>
    </div>
  </div>
);

export default function AuthVictim() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifierType, setIdentifierType] = useState<"email" | "phone">(
    "email"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, registerVictim } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const redirectTarget = searchParams.get("from") || "/";

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
      password: "",
      confirmPassword: "",
      address: "",
      station: "",
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
      const user = await login(data.identifier, data.password, "victim");
      toast.success(`Login successful. Welcome, ${user.name || "citizen"}.`);
      navigate(redirectTarget, { replace: true });
    } catch (err: any) {
      console.error(err);
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
      toast.error("Please select your nearest police station");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await registerVictim({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        address: data.address,
        station: data.station,
      });

      toast.success("Account created successfully. You are now logged in.");
      navigate(redirectTarget || "/file-complaint", { replace: true });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const forgotPassword = () => {
    toast("Password reset link sent (mock). Check your email/phone.", {
      icon: "🔔",
    });
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
          {showModelOnRight && (
  <div className="hidden lg:flex items-center justify-center">
    <div className="w-full max-w-xl">
      <AuthScene>
        {isLogin ? <MaleCopModel /> : <FemaleCopModel />}
      </AuthScene>
    </div>
  </div>
)}


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
                      {isLogin ? t("auth.victimLogin") : t("auth.createAccount")}
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
                  {isLogin ? (
                    <form
                      onSubmit={handleLoginSubmit(onLogin)}
                      className="space-y-4"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIdentifierType("email")}
                          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                            identifierType === "email"
                              ? "bg-white/10 text-white"
                              : "text-white/70 hover:text-white"
                          }`}
                        >
                          {t("auth.toggleEmail")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIdentifierType("phone")}
                          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                            identifierType === "phone"
                              ? "bg-white/10 text-white"
                              : "text-white/70 hover:text-white"
                          }`}
                        >
                          {t("auth.togglePhone")}
                        </button>
                      </div>

                      <div>
                        <label
                          className="block text-sm font-semibold mb-2"
                          style={{ color: "var(--text-on-dark)" }}
                        >
                          {identifierType === "email"
                            ? t("auth.email")
                            : t("auth.phone")}
                        </label>
                        <input
                          {...loginRegister("identifier", {
                            required: "Required",
                          })}
                          type={identifierType === "email" ? "email" : "tel"}
                          placeholder={
                            identifierType === "email"
                              ? t("auth.emailPlaceholder")
                              : t("auth.phonePlaceholder")
                          }
                          className="form-input"
                          aria-invalid={!!loginErrors.identifier}
                          aria-label={
                            identifierType === "email"
                              ? t("auth.email")
                              : t("auth.phone")
                          }
                          style={{ color: "var(--text-on-dark)" }}
                        />
                        {loginErrors.identifier && (
                          <p className="text-xs text-red-400 mt-1">
                            {loginErrors.identifier.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          className="block text-sm font-semibold mb-2"
                          style={{ color: "var(--text-on-dark)" }}
                        >
                          Enter Password
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            {...loginRegister("password", {
                              required: "Required",
                            })}
                            type={showPassword ? "text" : "password"}
                            placeholder={t("auth.passwordPlaceholder")}
                            className="form-input flex-1"
                            aria-label={t("auth.password")}
                            style={{ color: "var(--text-on-dark)" }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            className="text-xs text-white/70 hover:text-white px-3 py-2 border border-white/20 rounded-md"
                          >
                            {showPassword ? t("auth.hide") : t("auth.show")}
                          </button>
                        </div>
                        {loginErrors.password && (
                          <p className="text-xs text-red-400 mt-1">
                            {loginErrors.password.message}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <button
                          type="button"
                          onClick={forgotPassword}
                          className="text-white/70 hover:text-white"
                        >
                          {t("auth.forgotPassword")}
                        </button>
                        <button
                          type="button"
                          onClick={switchToRegister}
                          className="text-white/70 hover:text-white"
                        >
                          {t("auth.newUserRegister")}
                        </button>
                      </div>

                      <div>
                        <Button
                          size="lg"
                          type="submit"
                          className="w-full"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? t("auth.loggingIn") : t("auth.loginAction")}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <form
                      onSubmit={handleRegisterSubmit(onRegister)}
                      className="space-y-4"
                    >
                      <div>
                        <label
                          className="block text-sm font-semibold mb-2"
                          style={{ color: "var(--text-on-dark)" }}
                        >
                          {t("auth.name")}
                        </label>
                        <input
                          {...regRegister("name", {
                            required: "Name is required",
                          })}
                          type="text"
                          placeholder={t("auth.namePlaceholder")}
                          className="form-input"
                          aria-label={t("auth.name")}
                          style={{ color: "var(--text-on-dark)" }}
                        />
                        {regErrors.name && (
                          <p className="text-xs text-red-400 mt-1">
                            {regErrors.name.message}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label
                            className="block text-sm font-semibold mb-2"
                            style={{ color: "var(--text-on-dark)" }}
                          >
                            {t("auth.email")}
                          </label>
                          <input
                            {...regRegister("email", {
                              required: "Email is required",
                            })}
                            type="email"
                            placeholder={t("auth.emailPlaceholder")}
                            className="form-input"
                            aria-label={t("auth.email")}
                            style={{ color: "var(--text-on-dark)" }}
                          />
                          {regErrors.email && (
                            <p className="text-xs text-red-400 mt-1">
                              {regErrors.email.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <label
                            className="block text-sm font-semibold mb-2"
                            style={{ color: "var(--text-on-dark)" }}
                          >
                            {t("auth.phone")}
                          </label>
                          <input
                            {...regRegister("phone", {
                              required: "Phone is required",
                            })}
                            type="tel"
                            placeholder={t("auth.phonePlaceholder")}
                            className="form-input"
                            aria-label={t("auth.phone")}
                            style={{ color: "var(--text-on-dark)" }}
                          />
                          {regErrors.phone && (
                            <p className="text-xs text-red-400 mt-1">
                              {regErrors.phone.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label
                            className="block text-sm font-semibold mb-2"
                            style={{ color: "var(--text-on-dark)" }}
                          >
                            {t("auth.password")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              {...regRegister("password", {
                                required: "Password is required",
                                minLength: {
                                  value: 6,
                                  message:
                                    "Password should be at least 6 characters",
                                },
                              })}
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
                          {regErrors.password && (
                            <p className="text-xs text-red-400 mt-1">
                              {regErrors.password.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <label
                            className="block text-sm font-semibold mb-2"
                            style={{ color: "var(--text-on-dark)" }}
                          >
                            {t("auth.confirmPassword")}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              {...regRegister("confirmPassword", {
                                required: "Please confirm password",
                              })}
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
                          {regErrors.confirmPassword && (
                            <p className="text-xs text-red-400 mt-1">
                              {regErrors.confirmPassword.message}
                            </p>
                          )}
                          {regPassword &&
                            regPassword.length >= 6 &&
                            regPassword === regWatch("confirmPassword") && (
                              <div className="text-xs text-green-300 mt-1">
                                ✓ {t("auth.passwordsMatch")}
                              </div>
                            )}
                        </div>
                      </div>

                      <div>
                        <label
                          className="block text-sm font-semibold mb-2"
                          style={{ color: "var(--text-on-dark)" }}
                        >
                          {t("profile.address")}
                        </label>
                        <textarea
                          {...regRegister("address")}
                          placeholder={t("profile.addressPlaceholder")}
                          rows={2}
                          className="form-input min-h-[80px]"
                          aria-label={t("profile.address")}
                          style={{ color: "var(--text-on-dark)" }}
                        />
                      </div>

                      {/* DROPDOWN FIX: white background + black text so options show clearly */}
                      <div>
                        <label
                          className="block text-sm font-semibold mb-2"
                          style={{ color: "var(--text-on-dark)" }}
                        >
                          {t("auth.policeStation")}
                        </label>
                        <select
                          {...regRegister("station")}
                          className="w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          aria-label={t("auth.policeStation")}
                        >
                          <option value="">
                            {t("auth.selectStation")}
                          </option>
                          {DK_POLICE_STATIONS.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        {regErrors.station && (
                          <p className="text-xs text-red-400 mt-1">
                            {regErrors.station.message}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <button
                          type="button"
                          onClick={switchToLogin}
                          className="text-white/70 hover:text-white"
                        >
                          {t("auth.haveAccountLogin")}
                        </button>

                        <div className="text-xs text-white/60">
                          {t("auth.terms")}
                        </div>
                      </div>

                      <div>
                        <Button
                          size="lg"
                          type="submit"
                          className="w-full"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? t("auth.creatingAccount") : t("auth.register")}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>

          {!showModelOnRight && (
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
