"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type CompetencyOption = { id: string; name: string; domain: string; courses: Array<{ id: string; title: string }> };

const SAMPLE_PATH = "/samples/sampling-methods-note.pdf";
const MAX_BYTES = 10 * 1024 * 1024;

export function QuizUploadForm({ competencies }: { competencies: CompetencyOption[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [questionCount, setQuestionCount] = useState("8");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, CompetencyOption[]>();
    for (const competency of competencies) map.set(competency.domain, [...(map.get(competency.domain) ?? []), competency]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [competencies]);
  const courses = competencies.find((item) => item.id === competencyId)?.courses ?? [];

  function chooseFile(next: File | null) {
    setError(null);
    if (next && next.size > MAX_BYTES) {
      setError("The file is larger than 10 MB.");
      return;
    }
    setFile(next);
    if (next && !title) setTitle(next.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/^\w/, (letter) => letter.toUpperCase()));
  }

  async function loadSample() {
    setError(null);
    try {
      const response = await fetch(SAMPLE_PATH);
      if (!response.ok) throw new Error();
      chooseFile(new File([await response.blob()], "sampling-methods-note.pdf", { type: "application/pdf" }));
      setTitle("Sampling methods for official surveys");
      const sampling = competencies.find((item) => item.name === "Sampling");
      if (sampling) setCompetencyId(sampling.id);
    } catch {
      setError("The sample file could not be loaded.");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError("Choose a PDF, TXT or MD file.");
    if (!competencyId) return setError("Choose the competency this material teaches.");
    if (title.trim().length < 3) return setError("Give the quiz a title of at least 3 characters.");
    const form = new FormData();
    form.set("file", file);
    form.set("title", title.trim());
    form.set("competencyId", competencyId);
    if (courseId) form.set("courseId", courseId);
    form.set("questionCount", questionCount);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/quizzes", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to create the quiz");
      router.push(`/admin/quizzes/${body.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create the quiz");
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <section className="surface quiz-generating" aria-busy="true" aria-live="polite">
        <span className="loading-mark" aria-hidden="true" />
        <div>
          <h2>Writing questions from {file?.name}</h2>
          <p className="muted">The model reads the material, writes {questionCount} questions, and each one is checked against the text. This can take up to a minute.</p>
        </div>
        <div className="loading-progress" aria-hidden="true">
          <span />
        </div>
      </section>
    );
  }

  return (
    <form className="quiz-form" onSubmit={submit} noValidate>
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="quiz-form-grid">
        <div className="quiz-form-main">
          <label className={`quiz-drop ${file ? "has-file" : ""}`}>
            <input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
            {file ? <FileText size={22} strokeWidth={1.6} aria-hidden="true" /> : <Upload size={22} strokeWidth={1.6} aria-hidden="true" />}
            <strong>{file ? file.name : "Choose learning material"}</strong>
            <span>{file ? `${(file.size / 1024).toFixed(0)} KB · click to replace` : "PDF, TXT or MD up to 10 MB. Export slides to PDF first."}</span>
          </label>
          <button type="button" className="kaushal-button kaushal-button-link text-link quiz-sample-link" onClick={() => void loadSample()}>
            Use the sample trainer note on sampling (PDF)
          </button>
        </div>

        <div className="quiz-form-fields">
          <label className="quiz-field">
            <span>Quiz title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="e.g. Sampling methods for official surveys" />
          </label>
          <label className="quiz-field">
            <span>Competency tested</span>
            <select value={competencyId} onChange={(event) => { setCompetencyId(event.target.value); setCourseId(""); }}>
              <option value="">Choose a competency</option>
              {grouped.map(([domain, items]) => (
                <optgroup key={domain} label={domain.replaceAll("_", " ")}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="quiz-field">
            <span>Linked iGOT course (optional)</span>
            <select value={courseId} onChange={(event) => setCourseId(event.target.value)} disabled={!competencyId || courses.length === 0}>
              <option value="">{competencyId && courses.length === 0 ? "No catalog course for this competency" : "Show on every course for this competency"}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
          </label>
          <label className="quiz-field">
            <span>Questions</span>
            <select value={questionCount} onChange={(event) => setQuestionCount(event.target.value)}>
              {[5, 8, 10].map((count) => (
                <option key={count} value={count}>{count} questions</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="admin-matrix-actions">
        <Button variant="dark" type="submit">
          Generate questions <span aria-hidden="true">→</span>
        </Button>
        <span className="admin-matrix-actions__hint">You review every question before officials see it.</span>
      </div>
    </form>
  );
}
