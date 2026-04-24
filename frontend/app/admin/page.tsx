"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/types";
import { getSystemStats, listUsers, deleteUserAdmin, type SystemStats } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ProtectedRoute from "@/components/protected-route";
import BackButton from "@/components/back-button";
import { useToast } from "@/components/toast";
import { formatDate } from "@/lib/utils";

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Basic frontend check - backend also enforces this
    if (user && !user.is_admin) {
      router.replace("/dashboard");
      return;
    }

    async function load() {
      try {
        const [statsRes, usersRes] = await Promise.all([
          getSystemStats(),
          listUsers(),
        ]);

        if (statsRes.ok && usersRes.ok) {
          setStats(statsRes.data);
          setUsers(usersRes.data);
        } else {
          setError("Failed to load admin data.");
        }
      } catch {
        setError("Something went wrong while loading data.");
      } finally {
        setLoading(false);
      }
    }
    
    if (user?.is_admin) {
        load();
    }
  }, [user, router]);

  const handleDeleteUser = useCallback(async (userId: string) => {
    if (!confirm("Are you sure you want to permanently delete this user?")) return;
    
    try {
      const res = await deleteUserAdmin(userId);
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        toast("success", "User deleted successfully");
        // refresh stats
        getSystemStats().then(s => s.ok && setStats(s.data));
      } else {
        toast("error", "Failed to delete user");
      }
    } catch {
      toast("error", "Something went wrong");
    }
  }, [toast]);

  if (loading) {
    return (
      <ProtectedRoute>
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} variant="card" className="h-32" />
            ))}
          </div>
          <Skeleton variant="card" className="h-96" />
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
        <BackButton href="/dashboard" label="Back to Dashboard" />
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-foreground-muted text-sm mt-1">
            System overview and user management.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : (
          <>
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="stat-card">
                  <div className="stat-number">{stats.total_users}</div>
                  <div className="stat-label">Total Users</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{stats.total_sessions}</div>
                  <div className="stat-label">Total Sessions</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{stats.completed_sessions}</div>
                  <div className="stat-label">Completed Sessions</div>
                </div>
              </div>
            )}

            {/* Users Table */}
            <section className="card p-0 overflow-hidden">
              <div className="p-6 border-b border-surface-border">
                <h2 className="text-xl font-semibold">User Management</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface border-b border-surface-border text-foreground-muted">
                    <tr>
                      <th className="px-6 py-3 font-medium">Username</th>
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-6 py-3 font-medium">Joined</th>
                      <th className="px-6 py-3 font-medium">Role</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-surface-card-hover/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-foreground">{u.username}</td>
                        <td className="px-6 py-4 text-foreground-muted">{u.email}</td>
                        <td className="px-6 py-4 text-foreground-muted">{formatDate(u.created_at)}</td>
                        <td className="px-6 py-4">
                          <span className={`badge ${u.is_admin ? "badge-warning" : "badge-default"}`}>
                            {u.is_admin ? "Admin" : "User"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            variant="danger" 
                            size="sm" 
                            disabled={u.id === user?.id}
                            onClick={() => handleDeleteUser(u.id)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </ProtectedRoute>
  );
}
