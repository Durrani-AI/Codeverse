"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { changePassword, changeUsername, deleteAccount } from "@/lib/api";
import ProtectedRoute from "@/components/protected-route";

type Tab = "profile" | "security";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
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
  const [newUsername, setNewUsername] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleUsernameChange(e: React.FormEvent) {
    e.preventDefault();
    setUsernameMsg(null);
    if (!newUsername.trim() || newUsername.trim().length < 3) {
      setUsernameMsg({ type: "error", text: "Username must be at least 3 characters" });
      return;
    }
    setUsernameLoading(true);
    try {
      const res = await changeUsername({ username: newUsername.trim() });
      if (res.ok) {
        setUsernameMsg({ type: "success", text: "Username updated. Reloading..." });
        setNewUsername("");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const data = res.data as unknown as { detail?: string };
        setUsernameMsg({ type: "error", text: data?.detail || "Failed to update username" });
      }
    } catch {
      setUsernameMsg({ type: "error", text: "Something went wrong" });
    } finally {
      setUsernameLoading(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    try {
      const res = await deleteAccount();
      if (res.ok) {
        logout();
      }
    } catch {
      // fallback
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
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

          {usernameMsg && (
            <p className={`text-sm ${usernameMsg.type === "success" ? "text-green-400" : "text-red-400"}`}>
              {usernameMsg.text}
            </p>
          )}

          <button type="submit" disabled={usernameLoading} className="btn-primary btn-sm">
            {usernameLoading ? "Saving..." : "Update Username"}
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }

    setLoading(true);
    try {
      const res = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Password updated successfully" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = res.data as unknown as { detail?: string };
        setMessage({ type: "error", text: data?.detail || "Failed to change password" });
      }
    } catch {
      setMessage({ type: "error", text: "Something went wrong" });
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
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-muted mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-muted mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              required
              minLength={8}
            />
          </div>

          {message && (
            <p className={`text-sm ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>
              {message.text}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary btn-sm">
            {loading ? "Saving..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
