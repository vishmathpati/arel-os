import {
  Activity,
  Briefcase,
  CalendarCheck,
  CalendarRange,
  Compass,
  Database,
  FolderKanban,
  GraduationCap,
  HeartPulse,
  HelpCircle,
  Home,
  Inbox,
  Library,
  ListTodo,
  type LucideIcon,
  Moon,
  Sparkles,
  Sunrise,
  Timer,
  Video,
  Wallet,
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
 * so every wired route has a reachable entry point.
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
    label: "Areas",
    items: [
      { label: "Health", to: "/areas/health", icon: HeartPulse },
      { label: "Finance", to: "/areas/finance", icon: Wallet },
      { label: "Learning", to: "/areas/learning", icon: GraduationCap },
      { label: "Spirituality", to: "/areas/spirituality", icon: Sparkles },
      { label: "YouTube", to: "/areas/youtube", icon: Video },
      { label: "Business", to: "/areas/business", icon: Briefcase },
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
