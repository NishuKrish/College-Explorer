"use client";

import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  buildPreferenceProfile,
  calculatePreferenceCompletion,
  defaultPreferenceDraft,
  loadPreferenceProfile,
  savePreferenceProfile,
  toApiPreferenceProfile,
  totalPreferenceSteps,
  type PreferenceDraft,
  type PreferenceWeights,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";

const steps = [
  "Academics",
  "Cost",
  "Career",
  "Location",
  "Campus",
  "Admissions",
  "Weights",
] as const;

const academicOptions = ["Computer Science", "Business", "Biology", "Engineering", "Psychology", "Education"];
const careerOptions = ["High earnings", "Graduate school", "Internships", "Research", "Public service", "Local jobs"];
const regionOptions = ["Northeast", "South", "Midwest", "West"];
const settingOptions = ["Urban", "Suburban", "Rural"];
const typeOptions = ["Public", "Private"];
const campusOptions = ["Residential", "Commuter-friendly", "Athletics", "Greek life", "Diverse community", "Small classes"];
const weightLabels: Record<keyof PreferenceWeights, string> = {
  academic: "Academic fit",
  cost: "Cost",
  career: "Career",
  campus: "Campus",
  location: "Location",
  admissions_realism: "Admissions realism",
};

export function PreferenceQuiz() {
  const router = useRouter();
  const [draft, setDraft] = useState<PreferenceDraft>(defaultPreferenceDraft);
  const [stepIndex, setStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = loadPreferenceProfile();
    if (existing) {
      setDraft({
        intended_major: existing.intended_major,
        academic_interests: existing.academic_interests,
        home_state: existing.home_state,
        preferred_regions: existing.preferred_regions,
        preferred_states: existing.preferred_states,
        preferred_settings: existing.preferred_settings,
        preferred_school_types: existing.preferred_school_types,
        max_annual_cost: existing.max_annual_cost,
        aid_importance: existing.aid_importance,
        career_priorities: existing.career_priorities,
        campus_preferences: existing.campus_preferences,
        admissions_strategy: existing.admissions_strategy,
        target_acceptance_rate_min: existing.target_acceptance_rate_min,
        weights: existing.weights,
      });
    }
    setIsLoading(false);
  }, []);

  const completion = useMemo(() => calculatePreferenceCompletion(draft), [draft]);
  const currentStepIsValid = validateStep(draft, stepIndex);
  const isLastStep = stepIndex === steps.length - 1;

  function updateDraft<TField extends keyof PreferenceDraft>(field: TField, value: PreferenceDraft[TField]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function nextStep() {
    if (!currentStepIsValid) {
      setError("Add at least one answer on this step before continuing.");
      return;
    }
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
    setError(null);
  }

  function finish() {
    if (!currentStepIsValid) {
      setError("Set your category weights before finishing.");
      return;
    }

    try {
      const profile = buildPreferenceProfile(draft);
      savePreferenceProfile(profile);
      trackAnalyticsEvent({
        event_name: "onboarding_completed",
        entity_type: "preference_profile",
        metadata: {
          completed_steps: completion.completed_steps,
          total_steps: completion.total_steps,
          completion_percent: completion.percent,
          category_weights: toApiPreferenceProfile(profile).weights,
        },
      });
      // Ranked mode is the default sort, and the saved profile is what drives it.
      router.push("/search");
    } catch {
      setError("The profile could not be saved locally. Check browser storage settings and try again.");
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-5 py-10">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-white px-5 py-4 shadow-soft">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold">Loading preference profile</span>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link className="text-sm font-semibold text-primary" href="/">
            Dream Campus
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
            Build my shortlist
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tell us what matters and we will rank schools by it. Your answers stay in this browser.
            For now, the profile pre-fills supported search filters and stays in
            this browser.
          </p>
        </div>
        <ProgressSummary percent={completion.percent} stepIndex={stepIndex} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-lg border border-border bg-white p-4 lg:sticky lg:top-6">
          <div className="mb-4">
            <p className="text-sm font-semibold text-foreground">
              {completion.completed_steps} of {completion.total_steps} complete
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${completion.percent}%` }} />
            </div>
          </div>
          <nav className="space-y-1" aria-label="Onboarding steps">
            {steps.map((step, index) => (
              <button
                key={step}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-semibold transition",
                  index === stepIndex ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
                )}
                type="button"
                onClick={() => setStepIndex(index)}
              >
                {step}
                {validateStep(draft, index) ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : null}
              </button>
            ))}
          </nav>
        </aside>

        <section>
          {error ? (
            <div className="mb-4 flex gap-3 rounded-lg border border-border bg-white p-4 text-sm text-foreground">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <Badge className="w-fit" variant="outline">
                Step {stepIndex + 1} of {totalPreferenceSteps}
              </Badge>
              <CardTitle className="mt-3">{steps[stepIndex]}</CardTitle>
            </CardHeader>
            <CardContent>
              <StepBody draft={draft} stepIndex={stepIndex} updateDraft={updateDraft} />

              <div className="mt-8 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  disabled={stepIndex === 0}
                  type="button"
                  variant="secondary"
                  onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </Button>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild variant="ghost">
                    <Link href="/search">Skip for now</Link>
                  </Button>
                  {isLastStep ? (
                    <Button type="button" onClick={finish}>
                      <Save className="h-4 w-4" aria-hidden="true" />
                      Save and search
                    </Button>
                  ) : (
                    <Button type="button" onClick={nextStep}>
                      Continue
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <ProfilePreview draft={draft} />
        </section>
      </div>
    </main>
  );
}

function StepBody({
  draft,
  stepIndex,
  updateDraft,
}: {
  draft: PreferenceDraft;
  stepIndex: number;
  updateDraft: <TField extends keyof PreferenceDraft>(field: TField, value: PreferenceDraft[TField]) => void;
}) {
  if (stepIndex === 0) {
    return (
      <div className="space-y-6">
        <label className="block text-sm font-medium text-foreground">
          Intended major
          <input
            className="mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
            placeholder="Computer Science"
            value={draft.intended_major}
            onChange={(event) => updateDraft("intended_major", event.target.value)}
          />
        </label>
        <OptionGrid
          label="Academic interests"
          options={academicOptions}
          selected={draft.academic_interests}
          onToggle={(value) => updateDraft("academic_interests", toggleString(draft.academic_interests, value))}
        />
      </div>
    );
  }

  if (stepIndex === 1) {
    return (
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block text-sm font-medium text-foreground">
          Max annual net price
          <input
            className="mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
            min={0}
            placeholder="32000"
            type="number"
            value={draft.max_annual_cost ?? ""}
            onChange={(event) => updateDraft("max_annual_cost", event.target.value ? Number(event.target.value) : null)}
          />
        </label>
        <label className="block text-sm font-medium text-foreground">
          Aid importance
          <select
            className="mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
            value={draft.aid_importance}
            onChange={(event) => updateDraft("aid_importance", event.target.value as PreferenceDraft["aid_importance"])}
          >
            <option value="">Choose importance</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
    );
  }

  if (stepIndex === 2) {
    return (
      <div className="space-y-3">
        <OptionGrid
          label="Career priorities"
          options={careerOptions}
          selected={draft.career_priorities}
          onToggle={(value) => updateDraft("career_priorities", toggleString(draft.career_priorities, value))}
        />
        {/* Mirrors CAREER_PRIORITY_TAGS in apps/api/services/ranking_service.py. */}
        <p className="text-xs leading-5 text-muted-foreground">
          Research is matched using each school&apos;s research classification. Public data does not
          cover the others yet, so they are saved but do not change scores. Earnings and loan
          repayment always count toward career fit.
        </p>
      </div>
    );
  }

  if (stepIndex === 3) {
    return (
      <div className="space-y-6">
        <label className="block text-sm font-medium text-foreground">
          Home state
          <input
            className="mt-2 h-11 w-full max-w-40 rounded-md border border-border bg-white px-3 text-sm uppercase outline-none transition focus:border-primary"
            maxLength={2}
            placeholder="CA"
            value={draft.home_state}
            onChange={(event) => updateDraft("home_state", event.target.value.toUpperCase())}
          />
        </label>
        <OptionGrid
          label="Preferred regions"
          options={regionOptions}
          selected={draft.preferred_regions}
          onToggle={(value) => updateDraft("preferred_regions", toggleString(draft.preferred_regions, value))}
        />
      </div>
    );
  }

  if (stepIndex === 4) {
    return (
      <div className="space-y-6">
        <OptionGrid
          label="Campus setting"
          options={settingOptions}
          selected={draft.preferred_settings}
          onToggle={(value) => updateDraft("preferred_settings", toggleString(draft.preferred_settings, value))}
        />
        <OptionGrid
          label="School type"
          options={typeOptions}
          selected={draft.preferred_school_types}
          onToggle={(value) => updateDraft("preferred_school_types", toggleString(draft.preferred_school_types, value))}
        />
        <OptionGrid
          label="Campus preferences"
          options={campusOptions}
          selected={draft.campus_preferences}
          onToggle={(value) => updateDraft("campus_preferences", toggleString(draft.campus_preferences, value))}
        />
        {/* Mirrors campus_preference_match in apps/api/services/ranking_service.py. */}
        <p className="text-xs leading-5 text-muted-foreground">
          Residential, Athletics (NCAA Division I or II), and Small classes (12 students per faculty
          member or fewer) are matched with federal data. No public source covers the others, so
          they are saved but do not change scores.
        </p>
      </div>
    );
  }

  if (stepIndex === 5) {
    return (
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block text-sm font-medium text-foreground">
          Admissions strategy
          <select
            className="mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-primary"
            value={draft.admissions_strategy}
            onChange={(event) => updateDraft("admissions_strategy", event.target.value as PreferenceDraft["admissions_strategy"])}
          >
            <option value="">Choose a strategy</option>
            <option value="likely">Likely-heavy</option>
            <option value="balanced">Balanced</option>
            <option value="reach">Reach-friendly</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-foreground">
          Minimum acceptance rate comfort
          <div className="mt-2 flex h-11 items-center gap-3">
            <input
              className="h-2 flex-1 accent-primary"
              max={100}
              min={0}
              type="range"
              value={draft.target_acceptance_rate_min ?? 30}
              onChange={(event) => updateDraft("target_acceptance_rate_min", Number(event.target.value))}
            />
            <span className="w-12 text-right text-sm font-semibold">
              {draft.target_acceptance_rate_min ?? 30}%
            </span>
          </div>
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {Object.entries(draft.weights).map(([key, value]) => (
        <label key={key} className="block text-sm font-medium text-foreground">
          <span className="flex items-center justify-between gap-4">
            {weightLabels[key as keyof PreferenceWeights]}
            <span>{Math.round(value * 100)}%</span>
          </span>
          <input
            className="mt-3 h-2 w-full accent-primary"
            max={40}
            min={5}
            type="range"
            value={Math.round(value * 100)}
            onChange={(event) =>
              updateDraft("weights", {
                ...draft.weights,
                [key]: Number(event.target.value) / 100,
              })
            }
          />
        </label>
      ))}
    </div>
  );
}

function OptionGrid({
  label,
  onToggle,
  options,
  selected,
}: {
  label: string;
  onToggle: (value: string) => void;
  options: string[];
  selected: string[];
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              key={option}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm font-semibold transition",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-white text-foreground hover:bg-muted",
              )}
              type="button"
              onClick={() => onToggle(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ProgressSummary({ percent, stepIndex }: { percent: number; stepIndex: number }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Profile completeness
      </p>
      <p className="mt-1 text-3xl font-bold tracking-normal text-foreground">{percent}%</p>
      <p className="mt-1 text-xs text-muted-foreground">Currently on {steps[stepIndex]}</p>
    </div>
  );
}

function ProfilePreview({ draft }: { draft: PreferenceDraft }) {
  const profile = buildPreferenceProfile(draft);
  const hasAnyPreference =
    Boolean(profile.intended_major.trim()) ||
    profile.academic_interests.length > 0 ||
    profile.max_annual_cost !== null ||
    profile.career_priorities.length > 0 ||
    Boolean(profile.home_state.trim()) ||
    profile.preferred_regions.length > 0 ||
    profile.preferred_settings.length > 0 ||
    profile.preferred_school_types.length > 0 ||
    profile.campus_preferences.length > 0 ||
    Boolean(profile.admissions_strategy);

  if (!hasAnyPreference) {
    return (
      <EmptyState
        className="mt-5"
        title="No preferences captured yet"
        description="Start with an academic interest or cost boundary to create a usable profile."
      />
    );
  }

  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle>Profile preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <PreviewRow label="Major" value={profile.intended_major || "Unknown"} />
          <PreviewRow label="Max cost" value={profile.max_annual_cost ? `$${profile.max_annual_cost.toLocaleString()}` : "Unknown"} />
          <PreviewRow label="Location" value={profile.preferred_regions[0] ?? (profile.home_state || "Unknown")} />
          <PreviewRow label="Admissions" value={profile.admissions_strategy || "Unknown"} />
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function validateStep(draft: PreferenceDraft, stepIndex: number) {
  if (stepIndex === 0) return Boolean(draft.intended_major.trim() || draft.academic_interests.length > 0);
  if (stepIndex === 1) return draft.max_annual_cost !== null || Boolean(draft.aid_importance);
  if (stepIndex === 2) return draft.career_priorities.length > 0;
  if (stepIndex === 3) return Boolean(draft.home_state.trim() || draft.preferred_regions.length > 0);
  if (stepIndex === 4) {
    return draft.preferred_settings.length > 0 || draft.preferred_school_types.length > 0 || draft.campus_preferences.length > 0;
  }
  if (stepIndex === 5) return Boolean(draft.admissions_strategy || draft.target_acceptance_rate_min !== null);
  return Object.values(draft.weights).every((weight) => weight >= 0.05 && weight <= 0.4);
}

function toggleString(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
