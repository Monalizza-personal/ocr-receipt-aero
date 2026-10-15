import React, { useState } from "react";
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Database,
  ExternalLink,
  KeyRound,
  LogOut,
  Loader2,
  ShieldCheck,
  FileCode2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface SupabaseAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseAuthModal: React.FC<SupabaseAuthModalProps> = ({ isOpen, onClose }) => {
  const {
    user,
    isConfigured,
    projectUrl,
    keyType,
    signIn,
    signUp,
    resetPassword,
    resendConfirmationEmail,
    signOut,
    savePublishableKey,
    removePublishableKey,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<"login" | "signup" | "reset" | "settings">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [customKeyInput, setCustomKeyInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowResendConfirmation(false);

    if (!isConfigured) {
      setErrorMessage("Please set your Supabase publishable key first in the Setup tab.");
      setActiveTab("settings");
      return;
    }

    if (activeTab === "reset") {
      if (!email) {
        setErrorMessage("Please enter your email address to receive password reset instructions.");
        return;
      }
      setIsSubmitting(true);
      try {
        const res = await resetPassword(email);
        if (res.error) {
          setErrorMessage(res.error.message);
        } else {
          setSuccessMessage("Password reset email sent! Please check your inbox for instructions.");
        }
      } catch (err: any) {
        setErrorMessage(err?.message || "Failed to send reset email.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!email || !password) {
      setErrorMessage("Please provide both email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (activeTab === "login") {
        const res = await signIn(email, password);
        if (res.error) {
          setErrorMessage(res.error.message);
          if (
            res.error.message.toLowerCase().includes("confirm") ||
            res.error.message.toLowerCase().includes("not verified")
          ) {
            setShowResendConfirmation(true);
          }
        } else {
          setSuccessMessage("Signed in successfully!");
          setTimeout(() => {
            onClose();
          }, 800);
        }
      } else if (activeTab === "signup") {
        if (password.length < 6) {
          setErrorMessage("Password must be at least 6 characters.");
          setIsSubmitting(false);
          return;
        }
        const res = await signUp(email, password, displayName);
        if (res.error) {
          setErrorMessage(res.error.message);
        } else {
          setSuccessMessage(
            "Account created! Please check your email inbox to confirm your registration if email verification is enabled."
          );
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred during authentication.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customKeyInput.trim()) return;
    const res = savePublishableKey(customKeyInput.trim());
    if (res && !res.success && res.error) {
      setErrorMessage(res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transition-colors">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Supabase Cloud Authentication
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                InstaSheet Expense Tracker Persistence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Badge */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Supabase Status:</span>
          {isConfigured ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Configured ({keyType === "publishable" ? "sb_publishable_..." : "Anon Key"})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              Publishable Key Required
            </span>
          )}
        </div>

        {/* If user is already logged in */}
        {user ? (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-slate-900 dark:text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                  {user.email ? user.email[0].toUpperCase() : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate">{user.email}</div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Authenticated with Supabase Auth
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/60 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">User ID: </span>
                  <code className="font-mono text-[11px] bg-white/60 dark:bg-black/30 px-1 py-0.5 rounded">
                    {user.id}
                  </code>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Target Project: </span>
                  <span className="font-mono text-[11px]">{projectUrl}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  setSuccessMessage("Signed out.");
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("login");
                  setErrorMessage(null);
                }}
                className={`flex-1 py-3 text-center border-b-2 transition ${
                  activeTab === "login"
                    ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("signup");
                  setErrorMessage(null);
                }}
                className={`flex-1 py-3 text-center border-b-2 transition ${
                  activeTab === "signup"
                    ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("reset");
                  setErrorMessage(null);
                }}
                className={`flex-1 py-3 text-center border-b-2 transition ${
                  activeTab === "reset"
                    ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Reset Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("settings");
                  setErrorMessage(null);
                }}
                className={`flex-1 py-3 text-center border-b-2 transition ${
                  activeTab === "settings"
                    ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Setup & Keys
              </button>
            </div>

            {/* Notification messages */}
            {errorMessage && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Content for Login & Signup */}
            {activeTab !== "settings" ? (
              <form onSubmit={handleAuthSubmit} className="p-6 space-y-4">
                {activeTab === "signup" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Display Name (Optional)
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Mona"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {activeTab !== "reset" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                  {activeTab === "signup" && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Must be at least 6 characters.
                    </p>
                  )}
                  {activeTab === "login" && (
                    <div className="flex justify-end mt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("reset");
                          setErrorMessage(null);
                        }}
                        className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "reset" && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Enter your registered email address. We'll send you a password recovery link to restore access to your account.
                </div>
              )}

              {showResendConfirmation && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                  <p>Your email may not be confirmed yet. Check your inbox or request a new confirmation email below:</p>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email) return;
                      setIsSubmitting(true);
                      try {
                        const res = await resendConfirmationEmail(email);
                        if (res.error) {
                          setErrorMessage(res.error.message);
                        } else {
                          setSuccessMessage("Confirmation email resent! Please check your inbox.");
                          setShowResendConfirmation(false);
                        }
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Resend Confirmation Email
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {activeTab === "login"
                        ? "Signing In..."
                        : activeTab === "signup"
                        ? "Creating Account..."
                        : "Sending Reset Link..."}
                    </span>
                  </>
                ) : (
                  <span>
                    {activeTab === "login"
                      ? "Sign In"
                      : activeTab === "signup"
                      ? "Register Account"
                      : "Send Password Reset Link"}
                  </span>
                )}
              </button>

              {activeTab === "reset" && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("login");
                      setErrorMessage(null);
                    }}
                    className="text-xs text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              )}

              <div className="pt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
                Multi-user isolation: Each user only accesses their own receipts & images.
              </div>
            </form>
            ) : (
              /* Settings & Configuration Tab */
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Supabase Project URL
                  </div>
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl font-mono text-xs text-slate-700 dark:text-slate-300 break-all select-all border border-slate-200 dark:border-slate-700">
                    {projectUrl}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Anon / Publishable Key
                    </label>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Supports sb_publishable_... or eyJ...
                    </span>
                  </div>
                  <form onSubmit={handleSaveKey} className="space-y-2">
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        value={customKeyInput}
                        onChange={(e) => setCustomKeyInput(e.target.value)}
                        placeholder="Paste sb_publishable_... or eyJ... anon key"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={!customKeyInput.trim()}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                      >
                        Save & Activate Key
                      </button>
                      {isConfigured && (
                        <button
                          type="button"
                          onClick={removePublishableKey}
                          className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/30 rounded-xl transition"
                          title="Clear configured key"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Helpful schema guidance */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-2">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FileCode2 className="w-4 h-4 text-emerald-600" />
                    SQL Schema Ready
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    The schema file has been prepared at{" "}
                    <code className="text-emerald-600 dark:text-emerald-400 font-mono">
                      supabase/schema.sql
                    </code>{" "}
                    with strict Row Level Security (RLS) policies for user data isolation.
                  </p>
                  <a
                    href="https://supabase.com/dashboard/project/jxuiggmifepmlpiculms/sql"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline pt-1"
                  >
                    Open Supabase SQL Editor
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
