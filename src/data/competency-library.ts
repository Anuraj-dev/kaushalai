import { z } from "zod";

const competencyNames = [
  "Basic Statistics", "Survey Design", "Sampling", "Data Quality", "R Programming", "Python", "Data Visualization", "Ethics",
  "Project Management", "Leadership", "Communication", "Open Data", "Industrial Statistics", "Data Privacy", "Cybersecurity", "Change Management",
  "APIs", "Digital Signatures", "GIS", "SQL", "Cloud Computing", "Government Cloud", "AI", "Machine Learning",
] as const;
export type CompetencyName = typeof competencyNames[number];
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const domain: Record<CompetencyName, string> = {
  "Basic Statistics": "statistical", "Survey Design": "statistical", Sampling: "statistical", "Data Quality": "statistical", "Industrial Statistics": "statistical",
  "R Programming": "technical", Python: "technical", "Data Visualization": "technical", GIS: "technical", SQL: "technical", AI: "technical", "Machine Learning": "technical", "Cloud Computing": "technical",
  "Open Data": "digital_governance", "Data Privacy": "digital_governance", Cybersecurity: "digital_governance", APIs: "digital_governance", "Digital Signatures": "digital_governance", "Government Cloud": "digital_governance",
  Ethics: "behavioural_managerial", "Project Management": "behavioural_managerial", Leadership: "behavioural_managerial", Communication: "behavioural_managerial", "Change Management": "behavioural_managerial",
};
const tags: Record<CompetencyName, string[]> = Object.fromEntries(competencyNames.map((name) => [name, [name === "Basic Statistics" ? "statistics" : name.toLowerCase()]])) as Record<CompetencyName, string[]>;
tags.AI.push("machine learning");
tags["Cloud Computing"].push("government cloud");

export interface CompetencySeed {
  id: string; name: CompetencyName; slug: string; domain: string; courseTags: string[];
  rubric: Array<{ level: number; descriptor: string }>;
  baseline: { prompt: string; choices: Array<{ label: string; demonstratedLevel: number }> };
  fallbackQuestions: string[];
}

export const COMPETENCY_LIBRARY: CompetencySeed[] = competencyNames.map((name) => ({
  id: `competency-${slug(name)}`, name, slug: slug(name), domain: domain[name], courseTags: tags[name],
  rubric: [1, 2, 3, 4, 5].map((level) => ({ level, descriptor: [
    `Recognizes basic ${name.toLowerCase()} terms with guidance.`,
    `Applies routine ${name.toLowerCase()} procedures with occasional support.`,
    `Independently applies ${name.toLowerCase()} to standard official work.`,
    `Handles complex ${name.toLowerCase()} work and reviews others' decisions.`,
    `Defines standards and leads expert ${name.toLowerCase()} practice.`,
  ][level - 1] })),
  baseline: {
    prompt: `An official must use ${name.toLowerCase()} in a new assignment. Which statement best describes how you would proceed?`,
    choices: [1, 2, 3, 4, 5].map((level) => ({ demonstratedLevel: level, label: [
      "I would first identify the basic terms and ask for step-by-step guidance.",
      "I would follow an established procedure and ask for review where needed.",
      "I would select and apply the appropriate standard method independently.",
      "I would adapt the method for complex constraints and validate the team's work.",
      "I would define the approach, governance checks, and reusable standard for the organization.",
    ][level - 1] })),
  },
  fallbackQuestions: [
    `Describe a recent decision where you applied ${name.toLowerCase()} and how you checked the result.`,
    `How would you identify and correct a subtle error in ${name.toLowerCase()} work?`,
    `Explain how you would adapt ${name.toLowerCase()} practice for a high-impact, unfamiliar assignment.`,
  ],
}));

type MatrixItem = { competency: CompetencyName; requiredLevel: number; importance: number };
export interface RoleMatrixSeed { role: string; competencies: MatrixItem[] }
const item = (competency: CompetencyName, requiredLevel: number, importance: number): MatrixItem => ({ competency, requiredLevel, importance });
export const ROLE_MATRICES: RoleMatrixSeed[] = [
  { role: "Statistical Investigator / Junior Statistical Officer", competencies: [item("Basic Statistics",4,3),item("Survey Design",4,3),item("Sampling",4,3),item("Data Quality",4,3),item("R Programming",3,2),item("Python",3,2),item("Data Visualization",3,2),item("Ethics",4,3)] },
  { role: "Senior Statistical Officer", competencies: [item("Basic Statistics",5,3),item("Survey Design",5,3),item("Sampling",5,3),item("Data Quality",5,3),item("Data Visualization",4,2),item("Project Management",4,3),item("Leadership",4,3),item("Communication",4,2)] },
  { role: "Survey Design and Field Operations Officer", competencies: [item("Survey Design",5,3),item("Sampling",5,3),item("Basic Statistics",4,3),item("Data Quality",4,3),item("R Programming",3,2),item("Project Management",4,2),item("Communication",4,2)] },
  { role: "Household Survey Data Analyst", competencies: [item("Basic Statistics",4,3),item("Survey Design",4,3),item("R Programming",4,3),item("Python",3,2),item("Data Visualization",4,2),item("Data Quality",4,3),item("Open Data",3,2)] },
  { role: "Industrial Statistics Analyst", competencies: [item("Industrial Statistics",5,3),item("Basic Statistics",4,3),item("Survey Design",3,2),item("R Programming",4,2),item("Data Visualization",4,2),item("Data Quality",4,3),item("Project Management",3,2)] },
  { role: "Statistical Data Quality Officer", competencies: [item("Data Quality",5,3),item("Basic Statistics",4,3),item("Data Privacy",4,3),item("Open Data",3,2),item("Ethics",4,3),item("Cybersecurity",3,2),item("Project Management",3,2),item("Change Management",3,2)] },
  { role: "Statistical Data Dissemination and Open Data Officer", competencies: [item("Open Data",5,3),item("Data Visualization",4,3),item("APIs",4,2),item("Data Quality",4,3),item("Data Privacy",4,3),item("Digital Signatures",3,2),item("Communication",4,2)] },
  { role: "Geospatial Statistics Analyst", competencies: [item("GIS",5,3),item("Data Visualization",4,3),item("Open Data",4,2),item("APIs",3,2),item("Data Quality",4,3),item("SQL",4,2),item("Basic Statistics",4,3)] },
  { role: "Statistical Data Systems Officer", competencies: [item("SQL",5,3),item("APIs",4,3),item("Cloud Computing",4,2),item("Government Cloud",4,3),item("Cybersecurity",4,3),item("Data Privacy",4,3),item("Data Quality",4,2),item("Digital Signatures",3,2)] },
  { role: "AI and Data Science Officer", competencies: [item("AI",5,3),item("Machine Learning",5,3),item("Python",5,3),item("R Programming",4,2),item("SQL",4,2),item("Data Visualization",4,2),item("Ethics",4,3),item("Data Privacy",4,3)] },
];

const competencySchema = z.object({ id: z.string(), name: z.string(), slug: z.string(), domain: z.string(), courseTags: z.array(z.string().trim().toLowerCase()).min(1), rubric: z.array(z.object({ level: z.number().int().min(1).max(5), descriptor: z.string().min(1) })).length(5), baseline: z.object({ prompt: z.string().min(1), choices: z.array(z.object({ label: z.string().min(1), demonstratedLevel: z.number().int().min(1).max(5) })).min(2) }), fallbackQuestions: z.array(z.string().min(1)).min(3) });
const matrixSchema = z.object({ role: z.string(), competencies: z.array(z.object({ competency: z.string(), requiredLevel: z.number().int().min(1).max(5), importance: z.number().int().min(1).max(3) })).min(6).max(8) });
export function validateCompetencySeeds(library = COMPETENCY_LIBRARY, matrices = ROLE_MATRICES): void {
  library.forEach((definition) => competencySchema.parse(definition)); matrices.forEach((matrix) => matrixSchema.parse(matrix));
  const names = library.map(({ name }) => name); if (new Set(names).size !== names.length) throw new Error("Duplicate competency definitions are not allowed");
  for (const definition of library) { if (new Set(definition.rubric.map(({ level }) => level)).size !== 5) throw new Error(`Incomplete rubric for ${definition.name}`); }
  const known = new Set(names); for (const matrix of matrices) for (const entry of matrix.competencies) if (!known.has(entry.competency as CompetencyName)) throw new Error(`Unknown competency ${entry.competency}`);
}
