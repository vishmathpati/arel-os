import {
  Activity,
  CalendarCheck,
  CalendarRange,
  Compass,
  Database,
  FolderKanban,
  HelpCircle,
  Home,
  Inbox,
  Library,
  ListTodo,
  type LucideIcon,
  Moon,
  Sunrise,
  Timer,
  Workflow,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** When set, the sidebar renders a live count badge for this source (Ch9). */
  badge?: "inbox";
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/**
 * Sidebar navigation. Reconciles DESIGN.md's sidebar structure (Home/Inbox/
 * Library + Areas + Rituals) with ROADMAP's nav groups (Tasks/Quests/Projects)
 * so every wired route has a reachable entry point. The Areas group itself is
 * NOT listed here — top-level areas are fully user-defined (read from the
 * vault), so the sidebar renders them dynamically via <AreasNav> instead
 * (see app-sidebar.tsx).
 */
export const navGroups: NavGroup[] = [
  {
    items: [
      { label: "Home", to: "/", icon: Home },
      { label: "Tasks", to: "/tasks", icon: ListTodo },
      { label: "Habits", to: "/habits", icon: Activity },
      { label: "Quests", to: "/quests", icon: Compass },
      { label: "Projects", to: "/projects", icon: FolderKanban },
      { label: "Inbox", to: "/inbox", icon: Inbox, badge: "inbox" },
      { label: "Library", to: "/library", icon: Library },
      { label: "Databases", to: "/databases", icon: Database },
      { label: "Recipes", to: "/recipes", icon: Workflow },
    ],
  },
  {
    label: "Operating Rhythm",
    items: [
      { label: "Morning Manifesto", to: "/morning", icon: Sunrise },
      { label: "Evening Shutdown", to: "/evening", icon: Moon },
      { label: "Focus Session", to: "/focus", icon: Timer },
      { label: "Weekly Review", to: "/weekly", icon: CalendarCheck },
      { label: "Ideal Week", to: "/ideal-week", icon: CalendarRange },
    ],
  },
  {
    items: [{ label: "Guide", to: "/guide", icon: HelpCircle }],
  },
];
