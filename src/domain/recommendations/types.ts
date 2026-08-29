export interface CatalogCourse {
  id: string;
  title: string;
  provider: string | null;
  detailAvailable: boolean;
  searchTerms: string[];
  tags: string[];
  description: string;
  learningOutcomes: string[];
}

export interface PriorityGap {
  competencyId: string;
  competencyName: string;
  priority: number;
  tags: string[];
}

export interface LearningPathItem {
  courseId: string;
  competencyId: string;
  competencyName: string;
  rank: number;
  rationale: string;
  evidence: "detailed" | "title";
}

export interface LearningPath {
  items: LearningPathItem[];
  unavailable: Array<{ competencyId: string; message: string }>;
}
