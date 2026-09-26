import Link from "next/link";
import { QuizUploadForm } from "@/components/admin/quiz-upload-form";
import { QuizService } from "@/services/quiz-service";

export const dynamic = "force-dynamic";

export default function NewQuizPage() {
  const competencies = new QuizService().competencyOptions();
  return (
    <>
      <Link className="text-link back-link" href="/admin/quizzes">
        ← Back to quizzes
      </Link>
      <header className="page-header admin-page-header">
        <div>
          <h1>New quiz from material</h1>
          <p>Every question must quote the uploaded text. Questions the model cannot ground in the material are dropped before you see them.</p>
        </div>
      </header>
      <QuizUploadForm competencies={competencies} />
    </>
  );
}
