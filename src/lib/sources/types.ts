import type { JobRecord, SearchFilters } from "@/types/jobs";

export type SourceContext = {
  filters: SearchFilters;
};

export interface JobSourceAdapter {
  name: string;
  fetchJobs(context: SourceContext): Promise<JobRecord[]>;
}
