import { createBrowserRouter } from "react-router";
import Root from "./Root";
import { PipelineView } from "./components/PipelineView";
import { CompanionView } from "./components/CompanionView";
import { MarketingView } from "./components/MarketingView";
import { DashboardView } from "./components/DashboardView";
import { SettingsView } from "./components/SettingsView";
import { ThumbnailView } from "./components/ThumbnailView";
import { HistoryView } from "./components/HistoryView";
import { RunDetailView } from "./components/RunDetailView";
import { IdeasView } from "./components/IdeasView";
import { AudienceView } from "./components/AudienceView";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: PipelineView },
      { path: "companion", Component: CompanionView },
      { path: "thumbnail", Component: ThumbnailView },
      { path: "marketing", Component: MarketingView },
      { path: "dashboard", Component: DashboardView },
      { path: "audience", Component: AudienceView },
      { path: "history", Component: HistoryView },
      { path: "history/:runId", Component: RunDetailView },
      { path: "ideas", Component: IdeasView },
      { path: "settings", Component: SettingsView },
    ],
  },
]);
