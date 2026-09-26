import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { generatorLabel } from "@/components/admin/quiz-labels";
import { QuizService } from "@/services/quiz-service";

export const dynamic = "force-dynamic";

export default function QuizzesPage() {
  const quizzes = new QuizService().list();
  const published = quizzes.filter((quiz) => quiz.status === "published");
  const attempts = quizzes.reduce((sum, quiz) => sum + quiz.attemptCount, 0);
  const scored = quizzes.filter((quiz) => quiz.averageScore !== null);
  const averageScore = scored.length
    ? Math.round((scored.reduce((sum, quiz) => sum + quiz.averageScore! * quiz.attemptCount, 0) / scored.reduce((sum, quiz) => sum + quiz.attemptCount, 0)) * 100)
    : null;

  return (
    <>
      <header className="page-header admin-page-header admin-page-header--governance">
        <div>
          <h1>Quizzes</h1>
          <p>Upload training material. AI writes multiple-choice questions, you review them, and officials&apos; scores feed their competency results.</p>
        </div>
        <div className="admin-header-actions">
          <Button asChild variant="dark" size="sm" className="kaushal-button kaushal-button-dark">
            <Link href="/admin/quizzes/new">
              New quiz <span aria-hidden="true">→</span>
            </Link>
          </Button>
        </div>
      </header>

      <section className="admin-governance-strip" aria-label="Quiz overview">
        <div className="admin-governance-metric">
          <span>Quizzes</span>
          <strong>{quizzes.length}</strong>
          <small>{quizzes.length - published.length} in review</small>
        </div>
        <div className="admin-governance-metric">
          <span>Published</span>
          <strong>{published.length}</strong>
          <small>Visible on learning plans</small>
        </div>
        <div className="admin-governance-metric">
          <span>Attempts</span>
          <strong>{attempts}</strong>
          <small>Completed by officials</small>
        </div>
        <div className="admin-governance-metric">
          <span>Average score</span>
          <strong>{averageScore === null ? "–" : `${averageScore}%`}</strong>
          <small>Across completed attempts</small>
        </div>
      </section>

      {quizzes.length === 0 ? (
        <section className="surface quiz-empty">
          <Image className="art quiz-empty-art" src="/illustrations/quiz-upload.webp" alt="" aria-hidden="true" width={748} height={448} sizes="240px" />
          <h2>No quizzes yet</h2>
          <p className="muted">Start with a PDF of trainer notes or a methodology chapter. You can try the sample trainer note on sampling.</p>
          <Button asChild variant="primary">
            <Link href="/admin/quizzes/new">
              Create the first quiz <span aria-hidden="true">→</span>
            </Link>
          </Button>
        </section>
      ) : (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quiz</th>
                <th>Status</th>
                <th>Competency</th>
                <th>Questions</th>
                <th>Attempts</th>
                <th>Average</th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((quiz) => (
                <tr key={quiz.id}>
                  <th scope="row" data-label="Quiz">
                    <Link href={`/admin/quizzes/${quiz.id}`}>{quiz.title}</Link>
                    <div className="result-meta">
                      {quiz.sourceName} · {generatorLabel(quiz.generatedBy)}
                    </div>
                  </th>
                  <td data-label="Status">
                    <span className={`tag ${quiz.status === "published" ? "tag-lime" : ""}`}>{quiz.status === "published" ? "Published" : "Draft"}</span>
                  </td>
                  <td data-label="Competency">
                    {quiz.competencyName}
                    {quiz.courseTitle && <div className="result-meta">{quiz.courseTitle}</div>}
                  </td>
                  <td data-label="Questions">{quiz.questionCount}</td>
                  <td data-label="Attempts">{quiz.attemptCount}</td>
                  <td data-label="Average">{quiz.averageScore === null ? "–" : `${Math.round(quiz.averageScore * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
