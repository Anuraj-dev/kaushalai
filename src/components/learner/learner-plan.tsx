"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LearnerPlanLayout } from "@/components/learner/learner-plan-view";
import {
  LOGIN_PATH,
  ROUNDS_PATH,
  clearSession,
  isAssessmentComplete,
  persistSession,
  request,
  storageKey,
  type Recommendation,
  type Session,
} from "@/components/learner/learner-session";
import { PlanCraftLoader } from "@/components/learner/plan-craft-loader";
import { Button } from "@/components/ui/button";

export function LearnerPlan() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (!saved) {
          if (mounted) {
            router.replace(LOGIN_PATH);
            setLoading(false);
          }
          return;
        }
        const restored = await request(`/api/learner/session?assessmentId=${encodeURIComponent(saved)}`);
        if (!mounted) return;
        if (!isAssessmentComplete(restored)) {
          router.replace(ROUNDS_PATH);
          setLoading(false);
          return;
        }
        persistSession(restored);
        setSession(restored);
      } catch {
        clearSession();
        if (mounted) router.replace(LOGIN_PATH);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function completeCourse(item: Recommendation) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const value = await request("/api/learner/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete-course",
          assessmentId: session.assessment.id,
          officialId: session.official.id,
          courseId: item.courseId,
          competencyId: item.competencyId,
        }),
      });
      setSession(value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record course completion");
    } finally {
      setBusy(false);
    }
  }

  async function reassess() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const value = await request("/api/learner/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reassess", officialId: session.official.id }),
      });
      persistSession(value);
      if (isAssessmentComplete(value)) {
        setSession(value);
        return;
      }
      router.push(ROUNDS_PATH);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start reassessment");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PlanCraftLoader title="Opening your learning plan" detail="Loading scored gaps and catalog courses for this official." />;
  if (error && !session) {
    return (
      <div className="surface error-state">
        <div className="alert" role="alert">{error}</div>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Try again <span aria-hidden="true">→</span>
        </Button>
      </div>
    );
  }
  if (!session) return <PlanCraftLoader />;

  return (
    <>
      {error && <div className="alert" role="alert">{error}</div>}
      <LearnerPlanLayout session={session} onComplete={completeCourse} onReassess={() => void reassess()} busy={busy} />
    </>
  );
}
