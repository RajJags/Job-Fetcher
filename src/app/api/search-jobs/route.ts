import { NextResponse } from "next/server";
import { aggregateJobs } from "@/lib/search/aggregate";
import type { CandidateProfile, CustomSite, SearchFilters } from "@/types/jobs";

type SearchRequestBody = {
  filters: SearchFilters;
  profile?: CandidateProfile;
  customSites?: CustomSite[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SearchRequestBody;
    const response = await aggregateJobs({
      filters: body.filters,
      profile: body.profile,
      customSites: body.customSites ?? []
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to fetch jobs."
      },
      { status: 500 }
    );
  }
}
