"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AssessmentResults } from "@/components/learner/learner-plan-view";
import { LOGIN_PATH, clearSession, request, storageKey, type Session } from "@/components/learner/learner-session";
import { PlanCraftLoader } from "@/components/learner/plan-craft-loader";

export function LearnerProfile() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <PlanCraftLoader title="Opening your profile" detail="Loading your assessment result." />;
  if (!session) return <PlanCraftLoader />;

  return (
    <>
      <header className="page-header profile-header">
        <div>
          <h1>{session.official.name}</h1>
          <p>{session.official.jobRoleName}</p>
        </div>
      </header>
      <AssessmentResults session={session} />
    </>
  );
}
