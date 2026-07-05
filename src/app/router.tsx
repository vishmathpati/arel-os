import { AreaPage } from "@/app/areas/area-page";
import { DatabaseDetailPage } from "@/app/databases/database-detail-page";
import { DatabasesIndexPage } from "@/app/databases/databases-index-page";
import {
  DatabaseRowDetailPage,
  LibraryResourceDetailPage,
} from "@/app/databases/db-row-detail-page";
import { LibraryPage } from "@/app/databases/library-page";
import { GuidePage } from "@/app/guide/guide-page";
import { HabitDetailPage } from "@/app/habits/habit-detail-page";
import { HabitsPage } from "@/app/habits/habits-page";
import { IdealWeekPage } from "@/app/ideal-week/ideal-week-page";
import { InboxItemPage } from "@/app/inbox/inbox-item-page";
import { InboxPage } from "@/app/inbox/inbox-page";
import { Layout } from "@/app/layout";
import { PageDetailPage } from "@/app/pages/page-detail-page";
import { PlaceholderPage } from "@/app/placeholder-page";
import { ProjectDetailPage } from "@/app/projects/project-detail-page";
import { ProjectsPage } from "@/app/projects/projects-page";
import { QuestDetailPage } from "@/app/quests/quest-detail-page";
import { QuestsPage } from "@/app/quests/quests-page";
import { RecipeDetailPage } from "@/app/recipes/recipe-detail-page";
import { RecipesPage } from "@/app/recipes/recipes-page";
import { EveningShutdownPage } from "@/app/rituals/evening/evening-page";
import { FocusSessionPage } from "@/app/rituals/focus/focus-page";
import { MorningManifestoPage } from "@/app/rituals/morning/morning-page";
import { WeeklyReviewPage } from "@/app/rituals/weekly/weekly-page";
import { TasksPage } from "@/app/tasks/tasks-page";
import { Home, TriangleAlert } from "lucide-react";
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <PlaceholderPage
            crumbs={[{ label: "Home" }]}
            icon={Home}
            title="Home"
            description="Your daily overview — today's focus, scheduled tasks, and active quests — will live here."
          />
        ),
      },
      { path: "tasks", element: <TasksPage /> },
      { path: "habits", element: <HabitsPage /> },
      { path: "habits/:slug", element: <HabitDetailPage /> },
      { path: "quests", element: <QuestsPage /> },
      { path: "quests/:slug", element: <QuestDetailPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "projects/:slug", element: <ProjectDetailPage /> },
      { path: "inbox", element: <InboxPage /> },
      { path: "inbox/:id", element: <InboxItemPage /> },
      { path: "library", element: <LibraryPage /> },
      { path: "library/:slug", element: <LibraryResourceDetailPage /> },
      { path: "databases", element: <DatabasesIndexPage /> },
      { path: "databases/:slug", element: <DatabaseDetailPage /> },
      { path: "databases/:slug/:row", element: <DatabaseRowDetailPage /> },
      { path: "recipes", element: <RecipesPage /> },
      { path: "recipes/:name", element: <RecipeDetailPage /> },
      { path: "areas/:area", element: <AreaPage /> },
      { path: "pages/:slug", element: <PageDetailPage /> },
      { path: "morning", element: <MorningManifestoPage /> },
      { path: "evening", element: <EveningShutdownPage /> },
      { path: "focus", element: <FocusSessionPage /> },
      { path: "weekly", element: <WeeklyReviewPage /> },
      { path: "ideal-week", element: <IdealWeekPage /> },
      { path: "guide", element: <GuidePage /> },
      {
        path: "*",
        element: (
          <PlaceholderPage
            crumbs={[{ label: "Not found" }]}
            icon={TriangleAlert}
            title="Page not found"
            description="This route doesn't exist yet. Use the sidebar to navigate."
          />
        ),
      },
    ],
  },
]);
