import Link from "next/link";
import { notFound } from "next/navigation";
import { generatorLabel } from "@/components/admin/quiz-labels";
import { QuizReview } from "@/components/admin/quiz-review";
import { QuizService } from "@/services/quiz-service";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quiz = new QuizService().get(id);
  if (!quiz) notFound();

  return (
    <>
      <Link className="text-link back-link" href="/admin/quizzes">
        ← Back to quizzes
      </Link>
      <header className="page-header admin-page-header">
        <div>
          <h1>{quiz.title}</h1>
          <p>
            {quiz.competencyName}
            {quiz.courseTitle ? ` · ${quiz.courseTitle}` : ""} · from {quiz.sourceName}
          </p>
        </div>
      </header>

      <section className="admin-matrix-strip" aria-label="Quiz overview">
        <div className={`admin-governance-metric ${quiz.status === "published" ? "admin-governance-metric--ready" : ""}`}>
          <span>Status</span>
          <strong>{quiz.status === "published" ? "Published" : "In review"}</strong>
          <small>{quiz.status === "published" ? "Questions locked" : "Edit, then publish"}</small>
        </div>
        <div className="admin-governance-metric">
          <span>Questions</span>
          <strong>{quiz.questions.length}</strong>
          <small>{generatorLabel(quiz.generatedBy)}</small>
        </div>
        <div className="admin-governance-metric">
          <span>Attempts</span>
          <strong>{quiz.attemptCount}</strong>
          <small>{quiz.averageScore === null ? "No attempts yet" : `Average ${Math.round(quiz.averageScore * 100)}%`}</small>
        </div>
      </section>

      <QuizReview quiz={quiz} />
    </>
  );
}
