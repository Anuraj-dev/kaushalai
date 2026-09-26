"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { QuizDetail, QuizQuestionRecord } from "@/services/quiz-service";
import { Button } from "@/components/ui/button";

const OPTION_LETTERS = ["A", "B", "C", "D"];
const MIN_QUESTIONS = 3;

export function QuizReview({ quiz: initial }: { quiz: QuizDetail }) {
  const router = useRouter();
  const [quiz, setQuiz] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"publish" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = quiz.status === "draft";

  useEffect(() => {
    if (!confirm) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setConfirm(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm, busy]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/quizzes/${quiz.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Unable to update the quiz");
      setQuiz(value);
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update the quiz");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function removeDraft() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/quizzes/${quiz.id}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/admin/quizzes");
      router.refresh();
      return;
    }
    setError(((await response.json()) as { error?: string }).error ?? "Unable to delete the draft");
    setBusy(false);
    setConfirm(null);
  }

  return (
    <>
      {error && <div className="alert" role="alert">{error}</div>}
      {editable && quiz.generatedBy === "seeded-fallback" && (
        <div className="alert">
          No AI provider answered, so these are fill-in-the-blank questions built from the material&apos;s own sentences. Review them before publishing.
        </div>
      )}
      {!editable && <p className="admin-matrix-hint">Published quizzes are locked so every attempt is scored against the same questions.</p>}

      <ol className="quiz-review-list">
        {quiz.questions.map((question, index) => (
          <li key={question.id} className="quiz-review-item">
            {editing === question.id ? (
              <QuestionEditor
                question={question}
                index={index}
                busy={busy}
                onCancel={() => setEditing(null)}
                onSave={async (value) => {
                  if (await patch({ action: "update-question", questionId: question.id, ...value })) setEditing(null);
                }}
              />
            ) : (
              <>
                <div className="quiz-review-head">
                  <span className="tag tag-dark">Q{String(index + 1).padStart(2, "0")}</span>
                  {editable && (
                    <div className="quiz-review-tools">
                      <Button variant="secondary" size="sm" className="kaushal-button kaushal-button-secondary" onClick={() => setEditing(question.id)} disabled={busy || editing !== null}>
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        className="kaushal-button kaushal-button-danger"
                        onClick={() => void patch({ action: "delete-question", questionId: question.id })}
                        disabled={busy || editing !== null || quiz.questions.length <= MIN_QUESTIONS}
                        title={quiz.questions.length <= MIN_QUESTIONS ? `A quiz needs at least ${MIN_QUESTIONS} questions` : undefined}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
                <h3 className="quiz-review-prompt">{question.prompt}</h3>
                <ul className="quiz-review-options">
                  {question.options.map((option, optionIndex) => (
                    <li key={optionIndex} className={optionIndex === question.correctIndex ? "is-correct" : undefined}>
                      <span className="quiz-choice-letter" aria-hidden="true">{OPTION_LETTERS[optionIndex]}</span>
                      <span>{option}</span>
                      {optionIndex === question.correctIndex && <span className="sr-only">(correct answer)</span>}
                    </li>
                  ))}
                </ul>
                <p className="quiz-review-explanation">{question.explanation}</p>
                <blockquote className="quiz-review-quote">
                  <span>Source quote</span>“{question.sourceQuote}”
                </blockquote>
              </>
            )}
          </li>
        ))}
      </ol>

      {editable && (
        <div className="admin-matrix-actions">
          <Button variant="dark" onClick={() => setConfirm("publish")} disabled={busy || editing !== null}>
            Publish quiz <span aria-hidden="true">→</span>
          </Button>
          <Button variant="danger" className="kaushal-button kaushal-button-danger" onClick={() => setConfirm("delete")} disabled={busy}>
            Delete draft
          </Button>
          <span className="admin-matrix-actions__hint">Publishing locks the questions and shows the quiz on officials&apos; learning plans.</span>
        </div>
      )}

      {confirm && (
        <div className="kaushal-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="quiz-confirm-title" onClick={() => !busy && setConfirm(null)}>
          <div className="kaushal-modal" onClick={(event) => event.stopPropagation()}>
            <h3 id="quiz-confirm-title">{confirm === "publish" ? "Publish this quiz?" : "Delete this draft?"}</h3>
            <p>
              {confirm === "publish"
                ? `${quiz.questions.length} questions will lock and appear for officials with ${quiz.competencyName} in their role matrix.`
                : "The draft and its questions will be removed. This cannot be undone."}
            </p>
            <div className="kaushal-modal-actions">
              <Button variant="secondary" className="kaushal-button kaushal-button-secondary" onClick={() => setConfirm(null)} disabled={busy} autoFocus>
                Cancel
              </Button>
              <Button
                variant={confirm === "publish" ? "dark" : "danger"}
                className={confirm === "publish" ? undefined : "kaushal-button kaushal-button-danger"}
                disabled={busy}
                onClick={async () => {
                  if (confirm === "delete") return void removeDraft();
                  await patch({ action: "publish" });
                  setConfirm(null);
                }}
              >
                {busy ? "Saving…" : confirm === "publish" ? "Publish" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function QuestionEditor({
  question, index, busy, onCancel, onSave,
}: {
  question: QuizQuestionRecord;
  index: number;
  busy: boolean;
  onCancel: () => void;
  onSave: (value: { prompt: string; options: string[]; correctIndex: number; explanation: string }) => void;
}) {
  const [prompt, setPrompt] = useState(question.prompt);
  const [options, setOptions] = useState(question.options);
  const [correctIndex, setCorrectIndex] = useState(question.correctIndex);
  const [explanation, setExplanation] = useState(question.explanation);

  return (
    <form
      className="quiz-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ prompt, options, correctIndex, explanation });
      }}
    >
      <span className="tag tag-dark">Editing Q{String(index + 1).padStart(2, "0")}</span>
      <label className="quiz-field">
        <span>Question</span>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} maxLength={1000} />
      </label>
      <fieldset className="quiz-editor-options">
        <legend>Options · select the correct one</legend>
        {options.map((option, optionIndex) => (
          <div className="quiz-editor-option" key={optionIndex}>
            <input
              type="radio"
              name={`correct-${question.id}`}
              checked={correctIndex === optionIndex}
              onChange={() => setCorrectIndex(optionIndex)}
              aria-label={`Mark option ${OPTION_LETTERS[optionIndex]} correct`}
            />
            <span className="quiz-choice-letter" aria-hidden="true">{OPTION_LETTERS[optionIndex]}</span>
            <input
              value={option}
              maxLength={300}
              aria-label={`Option ${OPTION_LETTERS[optionIndex]}`}
              onChange={(event) => setOptions((prev) => prev.map((item, i) => (i === optionIndex ? event.target.value : item)))}
            />
          </div>
        ))}
      </fieldset>
      <label className="quiz-field">
        <span>Explanation shown after answering</span>
        <textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} rows={2} maxLength={1000} />
      </label>
      <div className="quiz-actions">
        <Button variant="primary" type="submit" className="kaushal-button kaushal-button-primary" disabled={busy}>
          {busy ? "Saving…" : "Save question"}
        </Button>
        <Button variant="secondary" type="button" className="kaushal-button kaushal-button-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
