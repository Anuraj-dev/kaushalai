# Kaushal AI

Kaushal AI measures an official's demonstrated competencies against the requirements of their job role and turns confirmed gaps into a learning plan.

## People and roles

**Official**:
A learner whose competency profile is assessed against the requirements of an assigned job role.
_Avoid_: User, employee

**Administrator**:
A person who defines and maintains the competency matrix for each job role.
_Avoid_: Trainer, official

**Job role**:
The official function against which competency requirements are defined and assessed.
_Avoid_: Designation, profile

**Official profile**:
The prototype record representing an official and their assigned job role. Future versions may obtain this record from government APIs.
_Avoid_: Login, account

## Competency assessment

**Competency matrix**:
The administrator-controlled set of competencies and required proficiency levels for one job role. Different job roles have different matrices.
_Avoid_: Skill list, assessment result

**Published matrix**:
The version of a job role's competency matrix used to start new assessments. An assessment keeps the version it started with even when an administrator publishes a newer version.
_Avoid_: Draft matrix, live edits

**Competency**:
A measurable ability required by a job role, such as statistics, Python, or R programming.
_Avoid_: Course, question

**Assessment round**:
One bounded group of questions used to gather evidence about an official's competency level.
_Avoid_: Quiz, course test

**Baseline round**:
The first assessment round, made from fixed questions grouped by the competencies in the official's job-role matrix.
_Avoid_: Personalized round, diagnostic round

**Personalized round**:
The second assessment round, containing seven to ten AI-generated questions chosen from evidence gathered in the baseline round.
_Avoid_: Baseline round, clarification round

**Clarification round**:
An optional final assessment round of no more than five AI-generated questions, used only when assessment coverage after the personalized round is 80% or lower.
_Avoid_: Mandatory third round, retest

**Skill gap**:
The difference between the proficiency required by the job-role competency matrix and the official's assessed proficiency.
_Avoid_: Failed question, missing course

**Assessment confidence**:
The system's confidence that it has enough evidence to assign competency levels and identify skill gaps without another round.
_Avoid_: Quiz score, proficiency

**Supported competency result**:
A competency result backed by enough consistent evidence to reach at least 70% assessment confidence.
_Avoid_: Correct answer, completed competency

**Assessment coverage**:
The percentage of the job-role competency matrix for which the assessment has enough evidence to assign a supported proficiency level.
_Avoid_: Percentage of questions answered, percentage of gaps found

**Reassessment invitation**:
A notice shown after a newer matrix version is published, asking an official to take a new assessment while preserving the completed result from the older matrix.
_Avoid_: Automatic rescore, interrupted assessment

**Learning history**:
Prior course completion or verified course assessment evidence. It has less influence than evidence from the current competency assessment.
_Avoid_: Current proficiency, automatic mastery
