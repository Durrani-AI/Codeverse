"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { InterviewSession } from "@/types";
import { listSessions, deleteSessionPermanently } from "@/lib/api";
import { InterviewCard } from "@/components/interview-card";
import { Skeleton } from "@/components/ui/skeleton";
import ProtectedRoute from "@/components/protected-route";
import BackButton from "@/components/back-button";
import { useToast } from "@/components/toast";

export default function HistoryPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await listSessions();
        if (res.ok) {
          setSessions(res.data);
        } else {
          setError("Failed to load interview history.");
        }
      } catch {
        setError("Something went wrong while loading history.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleResume = useCallback(
    (id: string) => router.push(`/interview/${id}`),
    [router],
  );

  const handleViewDetails = useCallback(
    (id: string) => router.push(`/interview/${id}/results`),
    [router],
  );

  const handleDeleteSession = useCallback(async (id: string) => {
    try {
      const res = await deleteSessionPermanently(id);
      if (res.ok) {
        setSessions((prev) => prev.filter((sess) => sess.id !== id));
        toast("success", "Session removed");
      } else {
        toast("error", "Failed to remove session");
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} variant="card" className="h-44" />
            ))}
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
        <BackButton href="/dashboard" label="Back to Dashboard" />
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interview History</h1>
          <p className="text-foreground-muted text-sm mt-1">
            Review your past sessions and track your progress.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : sessions.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 py-14 text-center">
            <p className="text-foreground-muted text-sm">
              No interviews found. Head to the dashboard to start one!
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <InterviewCard
                key={session.id}
                session={session}
                onResume={handleResume}
                onViewDetails={handleViewDetails}
                onDelete={handleDeleteSession}
              />
            ))}
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
