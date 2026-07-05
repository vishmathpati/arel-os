/**
 * GuidePage — teaches Vish when to use each container and helps him decide
 * where something goes.
 *
 * Three sections:
 *  1. Decision wizard — step-through Q&A arriving at a verdict + navigate button
 *  2. Container reference cards — one Card per container with real examples
 *  3. Rules to remember — short pinned list
 *
 * Pure local React state. No backend. No new design tokens.
 * Layout follows the flagship block-page shell (DESIGN.md).
 */

import { PageHeader } from "@/app/page-header";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import {
  Activity,
  ArrowLeft,
  Briefcase,
  ChevronRight,
  Database,
  FileText,
  FolderKanban,
  HelpCircle,
  ListTodo,
  RotateCcw,
  Target,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────
// Decision wizard state machine
// ─────────────────────────────────────────────

type WizardStep =
  | "q1"
  | "q2-do"
  | "q3-forever"
  | "q3-finish"
  | "verdict-page"
  | "verdict-area"
  | "verdict-database"
  | "verdict-task"
  | "verdict-project"
  | "verdict-quest";

interface Verdict {
  name: string;
  why: string;
  navigateTo: string;
  navigateLabel: string;
}

const VERDICTS: Record<string, Verdict> = {
  "verdict-page": {
    name: "Page / Library",
    why: "Saved knowledge or a resource. It lives in your Library.",
    navigateTo: "/library",
    navigateLabel: "Go to Library",
  },
  "verdict-area": {
    name: "Area (or Sub-area)",
    why: "A permanent home with no deadline. Ventures like Snapfinder or AgriT are Sub-areas nested under Business.",
    navigateTo: "/areas/business",
    navigateLabel: "Go to Business",
  },
  "verdict-database": {
    name: "Database",
    why: "Uniform records you keep and look up — the set never finishes.",
    navigateTo: "/databases",
    navigateLabel: "Go to Databases",
  },
  "verdict-task": {
    name: "Task",
    why: "One action, one sitting. If it recurs, it's a Habit.",
    navigateTo: "/tasks",
    navigateLabel: "Go to Tasks",
  },
  "verdict-project": {
    name: "Project",
    why: "Multi-step work with a checklist. Deadline optional.",
    navigateTo: "/projects",
    navigateLabel: "Go to Projects",
  },
  "verdict-quest": {
    name: "Quest",
    why: "A goal with a deadline spanning several projects.",
    navigateTo: "/quests",
    navigateLabel: "Go to Quests",
  },
};

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export function GuidePage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Guide" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          {/* Page title row */}
          <div className="flex items-center gap-3">
            <HelpCircle className="size-5 text-muted-foreground" />
            <h1 className="text-heading font-semibold">Guide</h1>
          </div>
          <p className="mt-1 text-body text-muted-foreground">
            Unsure where something goes? Use the wizard or read the reference cards below.
          </p>

          <div className="mt-8 space-y-10">
            {/* Section 1 — Decision wizard */}
            <section>
              <h2 className="text-subheading font-medium">Where does this go?</h2>
              <p className="mt-1 text-caption text-muted-foreground">
                Answer a few questions to get a verdict.
              </p>
              <div className="mt-4">
                <DecisionWizard />
              </div>
            </section>

            <Separator />

            {/* Section 2 — Container reference cards */}
            <section>
              <h2 className="text-subheading font-medium">Container reference</h2>
              <p className="mt-1 text-caption text-muted-foreground">
                What each container is for, with real examples.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <ReferenceCard
                  icon={Briefcase}
                  name="Area"
                  test="Permanent domain you operate. No deadline."
                  example="Health, Finance, Business, YouTube"
                  notWhen="You haven't started it yet — that's an idea, not an Area."
                />
                <ReferenceCard
                  icon={Briefcase}
                  name="Sub-area"
                  test="A venture nested inside Business. Max 2 levels deep."
                  example="Snapfinder, AgriT agency, TCLDB"
                  notWhen="It's a top-level life domain — those are Areas."
                />
                <ReferenceCard
                  icon={Target}
                  name="Quest"
                  test="A goal with a deadline that spans several projects."
                  example='"Launch Snapfinder v1 by Sept", "Get fit in 3 months"'
                  notWhen="There's no real deadline, or it's single-deliverable work (use a Project)."
                />
                <ReferenceCard
                  icon={FolderKanban}
                  name="Project"
                  test="Multi-step work with a checklist. Finishes."
                  example='"Build the onboarding flow", a client website'
                  notWhen="It's one action — that's a Task."
                />
                <ReferenceCard
                  icon={ListTodo}
                  name="Task"
                  test="One action, one sitting."
                  example='"Fix the home page", "Email Acme"'
                  notWhen="It has multiple steps — use a Project. Recurring? Use a Habit."
                />
                <ReferenceCard
                  icon={Activity}
                  name="Habit"
                  test="A recurring task you want to track over time."
                  example="Daily workout, meditation, water intake"
                  notWhen="It's a one-off — use a Task."
                />
                <ReferenceCard
                  icon={Database}
                  name="Database"
                  test="Many uniform records you maintain. Never finishes."
                  example="Subscriptions, food log, client roster, video catalog"
                  notWhen="The records don't all share the same fields — use Pages."
                />
                <ReferenceCard
                  icon={FileText}
                  name="Page / Library"
                  test="Saved knowledge or a clipped resource."
                  example="A saved tweet, a React article, a reference doc"
                  notWhen="You need to act on it — capture it as a Task and link the Page."
                />
              </div>
            </section>

            <Separator />

            {/* Section 3 — Rules to remember */}
            <section>
              <h2 className="text-subheading font-medium">Rules to remember</h2>
              <div className="mt-4">
                <RulesList />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Decision wizard component
// ─────────────────────────────────────────────

function DecisionWizard() {
  const [step, setStep] = useState<WizardStep>("q1");
  const navigate = useNavigate();

  const isVerdict = step.startsWith("verdict-");
  const verdict = isVerdict ? VERDICTS[step] : null;

  function reset() {
    setStep("q1");
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="p-6">
        {!isVerdict ? (
          <WizardQuestion step={step} onStep={setStep} />
        ) : verdict ? (
          <WizardVerdict
            verdict={verdict}
            onNavigate={() => navigate(verdict.navigateTo)}
            onReset={reset}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function WizardQuestion({
  step,
  onStep,
}: {
  step: WizardStep;
  onStep: (s: WizardStep) => void;
}) {
  if (step === "q1") {
    return (
      <QuestionBlock
        question="Are you capturing something to KNOW, or something to DO?"
        choices={[
          { label: "Know — save it for reference", next: "verdict-page" },
          { label: "Do — act on it", next: "q2-do" },
        ]}
        onStep={onStep}
      />
    );
  }

  if (step === "q2-do") {
    return (
      <QuestionBlock
        question="Does it ever finish?"
        back="q1"
        choices={[
          { label: "Yes — it has an end state", next: "q3-finish" },
          { label: "No — it goes on forever", next: "q3-forever" },
        ]}
        onStep={onStep}
      />
    );
  }

  if (step === "q3-forever") {
    return (
      <QuestionBlock
        question="What kind of forever thing is it?"
        back="q2-do"
        choices={[
          { label: "A domain or venture I operate", next: "verdict-area" },
          { label: "A list of records I maintain", next: "verdict-database" },
        ]}
        onStep={onStep}
      />
    );
  }

  if (step === "q3-finish") {
    return (
      <QuestionBlock
        question="How big is the finish?"
        back="q2-do"
        choices={[
          { label: "One action, one sitting", next: "verdict-task" },
          { label: "Multiple steps / a checklist", next: "verdict-project" },
          { label: "A goal with a deadline, spanning several projects", next: "verdict-quest" },
        ]}
        onStep={onStep}
      />
    );
  }

  return null;
}

function QuestionBlock({
  question,
  choices,
  back,
  onStep,
}: {
  question: string;
  choices: { label: string; next: WizardStep }[];
  back?: WizardStep;
  onStep: (s: WizardStep) => void;
}) {
  return (
    <div className="space-y-4">
      {back && (
        <button
          type="button"
          onClick={() => onStep(back)}
          className="flex items-center gap-1 text-caption text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </button>
      )}
      <p className="text-subheading font-medium">{question}</p>
      <div className="flex flex-col gap-2">
        {choices.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onStep(c.next)}
            className="flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 text-left text-body transition-colors hover:bg-hover"
          >
            <span>{c.label}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}

function WizardVerdict({
  verdict,
  onNavigate,
  onReset,
}: {
  verdict: Verdict;
  onNavigate: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/40 px-4 py-4">
        <p className="text-caption uppercase tracking-wide text-muted-foreground">Verdict</p>
        <p className="mt-1 text-heading font-semibold">{verdict.name}</p>
        <p className="mt-1 text-body text-muted-foreground">{verdict.why}</p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={onNavigate} size="sm">
          {verdict.navigateLabel}
        </Button>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="size-3.5" />
          Start over
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Reference card
// ─────────────────────────────────────────────

function ReferenceCard({
  icon: Icon,
  name,
  test,
  example,
  notWhen,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  test: string;
  example: string;
  notWhen: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-subheading">
          <Icon className="size-4 text-muted-foreground" />
          {name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-4 pt-0">
        <p className="text-body">{test}</p>
        <div>
          <p className="text-caption font-medium text-muted-foreground">Example</p>
          <p className="mt-0.5 text-caption text-foreground">{example}</p>
        </div>
        <div>
          <p className="text-caption font-medium text-muted-foreground">Not this when</p>
          <p className="mt-0.5 text-caption text-foreground">{notWhen}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Rules list
// ─────────────────────────────────────────────

const RULES = [
  {
    number: 1,
    text: "Don't force a Quest — single-deliverable work is just a Project.",
  },
  {
    number: 2,
    text: "Projects don't need a deadline; Quests always do.",
  },
  {
    number: 3,
    text: "Habits are recurring Tasks — track them on the Habits page.",
  },
  {
    number: 4,
    text: "A venture is a permanent Sub-area; Quests pass through it (launch, then next season's goal).",
  },
];

function RulesList() {
  return (
    <Card className="max-w-2xl">
      <CardContent className="p-0">
        {RULES.map((rule, i) => (
          <div
            key={rule.number}
            className={`flex items-start gap-4 px-5 py-4 ${i < RULES.length - 1 ? "border-b border-border" : ""}`}
          >
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-medium text-muted-foreground">
              {rule.number}
            </span>
            <p className="text-body">{rule.text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
