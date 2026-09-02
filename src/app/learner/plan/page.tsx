import { LearnerPlan } from "@/components/learner/learner-plan";

export const dynamic = "force-dynamic";

export default function LearnerPlanPage() {
  return (
    <main id="main-content" className="page-shell plan-shell">
      <LearnerPlan />
    </main>
  );
}
