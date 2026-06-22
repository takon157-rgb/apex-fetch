export interface JobAnalysis {
  score: number;
  summary: string;
  profitability: 'High' | 'Medium' | 'Low' | string;
  difficulty: 'Advanced' | 'Intermediate' | 'Easy' | string;
  proposal: string;
  isJob?: boolean;
  reason?: string;
  reasoning?: string;
  category?: string;
}

export interface JobOpportunity {
  id: string;
  title: string;
  description: string;
  budget: string;
  source: string;
  url: string;
  postedTime: string;
  
  // Flattened AI attributes from the new engine
  score: number;
  summary: string;
  profitability: string;
  difficulty: string;
  proposal: string;
  reasoning?: string;
  category?: string;
  
  // States
  status: string;
  isDeleted: boolean;
  deleted: boolean;
  isArchived: boolean;
  archived: boolean;
}