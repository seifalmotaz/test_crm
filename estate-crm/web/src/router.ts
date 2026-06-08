import { createRouter, createRoute, createRootRoute, Outlet } from "@tanstack/react-router";
import { lazy } from "react";

const rootRoute = createRootRoute({
  component: Outlet,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: lazy(() => import("./routes/login")),
});

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authenticated",
  component: lazy(() => import("./routes/_authenticated")),
});

const dashboardRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/",
  component: lazy(() => import("./routes/_authenticated/dashboard")),
});

const propertiesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/properties",
  component: lazy(() => import("./routes/_authenticated/properties")),
});

const leadsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/leads",
  component: lazy(() => import("./routes/_authenticated/leads")),
});

const dealsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/deals",
  component: lazy(() => import("./routes/_authenticated/deals")),
});

const agentsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/agents",
  component: lazy(() => import("./routes/_authenticated/agents")),
});

const clientsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/clients",
  component: lazy(() => import("./routes/_authenticated/clients")),
});

const tasksRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/tasks",
  component: lazy(() => import("./routes/_authenticated/tasks")),
});

const analyticsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/analytics",
  component: lazy(() => import("./routes/_authenticated/analytics")),
});

const settingsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings",
  component: lazy(() => import("./routes/_authenticated/settings")),
});

const helpRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/help",
  component: lazy(() => import("./routes/_authenticated/help")),
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  authenticatedRoute.addChildren([
    dashboardRoute,
    propertiesRoute,
    leadsRoute,
    dealsRoute,
    agentsRoute,
    clientsRoute,
    tasksRoute,
    analyticsRoute,
    settingsRoute,
    helpRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}