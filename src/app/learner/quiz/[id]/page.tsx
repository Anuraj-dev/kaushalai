import { LearnerQuiz } from "@/components/learner/learner-quiz";

export const dynamic = "force-dynamic";

export default async function LearnerQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main id="main-content" className="page-shell quiz-shell">
      <LearnerQuiz quizId={id} />
    </main>
  );
}
