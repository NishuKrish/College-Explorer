"use client";

import { BookmarkCheck, ExternalLink, GitCompare, ListChecks, X } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getVisibleSavedSchools,
  savedSchoolStatuses,
  type SavedSchoolEntry,
  type SavedSchoolStatus,
  useSchoolActionState,
} from "@/lib/school-actions";
import { formatCurrency, formatPercent } from "@/lib/format";

const statusLabels: Record<SavedSchoolStatus, string> = {
  interested: "Interested",
  applying: "Applying",
  accepted: "Accepted",
  finalist: "Finalist",
  removed: "Removed",
};

export function SavedSchoolsDashboard() {
  const {
    addCompareSchool,
    compareIds,
    compareLimit,
    removeSavedSchool,
    savedSchools,
    updateSavedStatus,
  } = useSchoolActionState();
  const visibleSchools = getVisibleSavedSchools(savedSchools);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 pb-36 pt-8 sm:px-8">
      <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link className="text-sm font-semibold text-primary" href="/search">
            Back to search
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
            Saved schools
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Organize your shortlist, compare schools, and plan your applications.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-white p-4 shadow-soft">
          <p className="text-sm font-semibold text-foreground">{visibleSchools.length} active saved schools</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Stored in this browser until account persistence is added.
          </p>
          <Link className="mt-3 block text-sm font-semibold text-primary" href="/planner">Application checklist & calendar ↗</Link>
          <Link className="mt-2 block text-sm font-semibold text-primary" href="/campuses">Explore campuses on a map ↗</Link>
          <Button asChild className="mt-3 w-full" variant="secondary">
            <Link href="/decision">
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              Accepted workspace
            </Link>
          </Button>
        </div>
      </header>

      {visibleSchools.length === 0 ? (
        <EmptyState
          title="No saved schools yet"
          description="Save schools from search results or profile pages, then return here to organize them."
          action={<Link href="/search">Explore schools</Link>}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {savedSchoolStatuses.filter((status) => status !== "removed").map((status) => (
            <StatusGroup
              key={status}
              compareDisabled={compareIds.size >= compareLimit}
              comparedIds={compareIds}
              schools={visibleSchools.filter((school) => school.status === status)}
              status={status}
              onAddCompare={addCompareSchool}
              onRemove={removeSavedSchool}
              onStatusChange={updateSavedStatus}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function StatusGroup({
  compareDisabled,
  comparedIds,
  onAddCompare,
  onRemove,
  onStatusChange,
  schools,
  status,
}: {
  compareDisabled: boolean;
  comparedIds: Set<number>;
  onAddCompare: (school: SavedSchoolEntry) => boolean;
  onRemove: (schoolId: number) => void;
  onStatusChange: (schoolId: number, status: SavedSchoolStatus) => void;
  schools: SavedSchoolEntry[];
  status: SavedSchoolStatus;
}) {
  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-normal text-foreground">{statusLabels[status]}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{schools.length} schools</p>
        </div>
        <Badge variant="muted">{status}</Badge>
      </div>

      {schools.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
          No schools in this status yet.
        </div>
      ) : (
        <div className="space-y-3">
          {schools.map((school) => {
            const isCompared = comparedIds.has(school.school_id);
            return (
              <Card key={school.school_id} className="shadow-none">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-6">
                        <Link className="transition-colors hover:text-primary" href={`/schools/${school.school_id}`}>
                          {school.name}
                        </Link>
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {school.city}, {school.state} - {school.setting}
                      </p>
                    </div>
                    <BookmarkCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 p-4 pt-2 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric label="Net price" value={formatCurrency(school.net_price)} />
                    <Metric label="Graduation" value={formatPercent(school.graduation_rate)} />
                    <Metric label="Acceptance" value={formatPercent(school.acceptance_rate)} />
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <label className="sr-only" htmlFor={`status-${school.school_id}`}>
                      Update status for {school.name}
                    </label>
                    <select
                      id={`status-${school.school_id}`}
                      className="h-10 rounded-md border border-border bg-white px-3 text-sm font-medium outline-none transition focus:border-primary"
                      value={school.status}
                      onChange={(event) => onStatusChange(school.school_id, event.target.value as SavedSchoolStatus)}
                    >
                      {savedSchoolStatuses.filter((item) => item !== "removed").map((option) => (
                        <option key={option} value={option}>
                          {statusLabels[option]}
                        </option>
                      ))}
                    </select>
                    <Button
                      disabled={!isCompared && compareDisabled}
                      type="button"
                      variant={isCompared ? "primary" : "secondary"}
                      onClick={() => onAddCompare(school)}
                    >
                      <GitCompare className="h-4 w-4" aria-hidden="true" />
                      {isCompared ? "Compared" : "Compare"}
                    </Button>
                    <Button asChild size="icon" variant="ghost">
                      <Link aria-label={`Open ${school.name}`} href={`/schools/${school.school_id}`}>
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                    <Button
                      aria-label={`Remove ${school.name}`}
                      size="icon"
                      type="button"
                      variant="ghost"
                      onClick={() => onRemove(school.school_id)}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

