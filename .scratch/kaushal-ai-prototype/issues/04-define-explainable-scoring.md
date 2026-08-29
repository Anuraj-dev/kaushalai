Type: grilling
Status: resolved

# Define explainable scoring evidence

## Question

Which parts of competency scoring belong to AI, and which parts must remain deterministic and inspectable?

## Answer

Every answer produces competency evidence with a demonstrated level, reliability, and reason. Fixed choices score deterministically. AI may evaluate bounded written responses against a stored rubric. Deterministic code aggregates evidence, calculates `gap = max(0, required level - assessed level)`, and determines assessment coverage. Learning history is low-weight prior evidence and cannot outweigh the current assessment.
