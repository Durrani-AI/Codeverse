"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  changePassword,
  changeUsername,
  changeEmail,
  deleteAccount,
  uploadProfilePicture,
  removeProfilePicture,
} from "@/lib/api";
import { useToast } from "@/components/toast";
import ProtectedRoute from "@/components/protected-route";
import BackButton from "@/components/back-button";

type Tab = "profile" | "security";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ?? "http://127.0.0.1:8000";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <BackButton href="/dashboard" label="Back to Dashboard" />
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-foreground-muted text-sm mb-8">Account summary and quick actions</p>

        <div className="flex gap-8">
          {/* Sidebar */}
          <nav className="w-48 shrink-0 space-y-1">
            {([
              { key: "profile", label: "Profile" },
              { key: "security", label: "Security" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`w-full text-left rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === key
                    ? "bg-brand-500/10 text-brand-400"
                    : "text-foreground-muted hover:text-foreground hover:bg-white/[0.04]"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeTab === "profile" && <ProfileTab />}
            {activeTab === "security" && <SecurityTab />}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

/* ─── Profile Tab ──────────────────────────────────────────────────── */

function ProfileTab() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Username
  const [newUsername, setNewUsername] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Email
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Avatar
  const [avatarLoading, setAvatarLoading] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ── Avatar upload ── */
  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast("error", "File too large. Maximum size is 5 MB.");
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast("error", "Only JPEG, PNG, GIF, and WebP are allowed.");
      return;
    }

    setAvatarLoading(true);
    try {
      const res = await uploadProfilePicture(file);
      if (res.ok) {
        toast("success", "Profile picture updated");
        setTimeout(() => window.location.reload(), 800);
      } else {
        const data = res.data as unknown as { detail?: string };
        toast("error", data?.detail || "Failed to upload picture");
      }
    } catch {
      toast("error", "Something went wrong");
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setAvatarLoading(true);
    try {
      const res = await removeProfilePicture();
      if (res.ok) {
        toast("success", "Profile picture removed");
        setTimeout(() => window.location.reload(), 800);
      } else {
        toast("error", "Failed to remove picture");
      }
    } catch {
      toast("error", "Something went wrong");
    } finally {
      setAvatarLoading(false);
    }
  }

  /* ── Username change ── */
  async function handleUsernameChange(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || newUsername.trim().length < 3) {
      toast("error", "Username must be at least 3 characters");
      return;
    }
    setUsernameLoading(true);
    try {
      const res = await changeUsername({ username: newUsername.trim() });
      if (res.ok) {
        toast("success", "Username updated. Reloading...");
        setNewUsername("");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const data = res.data as unknown as { detail?: string };
        toast("error", data?.detail || "Failed to update username");
      }
    } catch {
      toast("error", "Something went wrong");
    } finally {
      setUsernameLoading(false);
    }
  }

  /* ── Email change ── */
  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast("error", "Enter a valid email address");
      return;
    }
    setEmailLoading(true);
    try {
      const res = await changeEmail({ email });
      if (res.ok) {
        toast("success", "Email updated. Reloading...");
        setNewEmail("");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const data = res.data as unknown as { detail?: string };
        toast("error", data?.detail || "Failed to update email");
      }
    } catch {
      toast("error", "Something went wrong");
    } finally {
      setEmailLoading(false);
    }
  }

  /* ── Delete account ── */
  async function handleDeleteAccount() {
    setDeleteLoading(true);
    try {
      const res = await deleteAccount();
      if (res.ok) {
        toast("success", "Account deleted");
        logout();
      } else {
        toast("error", "Failed to delete account");
      }
    } catch {
      toast("error", "Something went wrong");
    } finally {
      setDeleteLoading(false);
    }
  }

  const avatarUrl = user?.profile_picture ? `${API_BASE}${user.profile_picture}` : null;

  return (
    <div className="space-y-6">
      {/* Profile Picture */}
      <div className="card">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted mb-6">
          Profile Picture
        </h2>
        <div className="flex items-center gap-6">
          <div className="relative group">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="h-20 w-20 rounded-full object-cover border-2 border-surface-border"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/20 text-brand-400 text-2xl font-bold uppercase border-2 border-surface-border">
                {user?.username?.charAt(0) || "U"}
              </div>
            )}
            <button
              onClick={handleAvatarClick}
              disabled={avatarLoading}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={handleAvatarClick}
                disabled={avatarLoading}
                className="btn-primary btn-sm"
              >
                {avatarLoading ? "Uploading..." : "Upload Photo"}
              </button>
              {avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={avatarLoading}
                  className="btn-ghost btn-sm"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-foreground-muted">
              JPEG, PNG, GIF, or WebP. Max 5 MB.
            </p>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="card">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted mb-6">
          Account Information
        </h2>

        <div className="flex items-center justify-between py-4 border-b border-surface-border/40">
          <div>
            <p className="text-sm font-medium text-foreground-muted">Email</p>
            <p className="text-sm text-foreground mt-0.5">{user?.email}</p>
          </div>
        </div>

        <div className="flex items-center justify-between py-4 border-b border-surface-border/40">
          <div>
            <p className="text-sm font-medium text-foreground-muted">Username</p>
            <p className="text-sm text-foreground mt-0.5">{user?.username}</p>
          </div>
        </div>

        <div className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium text-foreground-muted">Member since</p>
            <p className="text-sm text-foreground mt-0.5">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Change Username */}
      <div className="card">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted mb-6">
          Change Username
        </h2>
        <form onSubmit={handleUsernameChange} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-foreground-muted mb-1.5">
              New Username
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder={user?.username}
              className="input"
              required
              minLength={3}
            />
          </div>
          <button type="submit" disabled={usernameLoading} className="btn-primary btn-sm">
            {usernameLoading ? "Saving..." : "Update Username"}
          </button>
        </form>
      </div>

      {/* Change Email */}
      <div className="card">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted mb-6">
          Change Email
        </h2>
        <form onSubmit={handleEmailChange} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-foreground-muted mb-1.5">
              New Email
            </label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={user?.email}
              className="input"
              required
            />
          </div>
          <button type="submit" disabled={emailLoading} className="btn-primary btn-sm">
            {emailLoading ? "Saving..." : "Update Email"}
          </button>
        </form>
      </div>

      {/* Delete Account */}
      <div className="card border-danger/20">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-danger mb-4">
          Danger Zone
        </h2>
        <p className="text-sm text-foreground-muted mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-danger btn-sm"
          >
            Delete Account
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeleteAccount}
              disabled={deleteLoading}
              className="btn-danger btn-sm"
            >
              {deleteLoading ? "Deleting..." : "Yes, Delete My Account"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="btn-ghost btn-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Security Tab ─────────────────────────────────────────────────── */

function SecurityTab() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const showCurrentRef = useRef<NodeJS.Timeout | null>(null);
  const showNewRef = useRef<NodeJS.Timeout | null>(null);
  const showConfirmRef = useRef<NodeJS.Timeout | null>(null);

  const handleShowCurrent = useCallback(() => {
    if (showCurrentRef.current) clearTimeout(showCurrentRef.current);
    setShowCurrent(true);
    showCurrentRef.current = setTimeout(() => setShowCurrent(false), 2000);
  }, []);

  const handleShowNew = useCallback(() => {
    if (showNewRef.current) clearTimeout(showNewRef.current);
    setShowNew(true);
    showNewRef.current = setTimeout(() => setShowNew(false), 2000);
  }, []);

  const handleShowConfirm = useCallback(() => {
    if (showConfirmRef.current) clearTimeout(showConfirmRef.current);
    setShowConfirm(true);
    showConfirmRef.current = setTimeout(() => setShowConfirm(false), 2000);
  }, []);

  function validatePassword(pw: string): string | null {
    if (pw.length < 8) return "Password must be at least 8 characters";
    if (!/[a-zA-Z]/.test(pw)) return "Password must contain at least one letter";
    if (!/[0-9]/.test(pw)) return "Password must contain at least one number";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast("error", "New passwords do not match");
      return;
    }

    const pwError = validatePassword(newPassword);
    if (pwError) {
      toast("error", pwError);
      return;
    }

    setLoading(true);
    try {
      const res = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      if (res.ok) {
        toast("success", "Password updated successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = res.data as unknown as { detail?: string };
        toast("error", data?.detail || "Failed to change password");
      }
    } catch {
      toast("error", "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted mb-6">
          Change Password
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-foreground-muted mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input pr-24"
                required
              />
              <button
                type="button"
                onClick={handleShowCurrent}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium px-2.5 py-1 rounded-md bg-surface-card border border-surface-border text-foreground-muted hover:text-foreground transition-colors"
              >
                {showCurrent ? "Visible" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-muted mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input pr-24"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={handleShowNew}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium px-2.5 py-1 rounded-md bg-surface-card border border-surface-border text-foreground-muted hover:text-foreground transition-colors"
              >
                {showNew ? "Visible" : "Show"}
              </button>
            </div>
            <ul className="text-xs text-foreground-muted/70 space-y-0.5 pl-1 mt-2">
              <li className={newPassword.length >= 8 ? "text-success" : ""}>• At least 8 characters</li>
              <li className={/[a-zA-Z]/.test(newPassword) ? "text-success" : ""}>• At least one letter</li>
              <li className={/[0-9]/.test(newPassword) ? "text-success" : ""}>• At least one number</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-muted mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input pr-24"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={handleShowConfirm}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium px-2.5 py-1 rounded-md bg-surface-card border border-surface-border text-foreground-muted hover:text-foreground transition-colors"
              >
                {showConfirm ? "Visible" : "Show"}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary btn-sm">
            {loading ? "Saving..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
