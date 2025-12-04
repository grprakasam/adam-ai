import type { ViewMode } from '../types/viewMode';

// Routes that should activate the workspace layout and sync the workspace tab
export const WORKSPACE_ROUTES: string[] = [
  '/workspace',
  '/pair-programming',
  '/code-review',
  '/consolidated-code',
  '/generation-history',
  '/traceability',
  '/test-with-data',
  '/adam-generator',
  '/adam-dataset-comparer',
  '/submission-dashboard',
  '/submission-package',
  '/code-validator',
  '/validation-reports',
  '/r-frontend',
  '/adam-data-analytics',
  '/study-chatbot',
  '/code-comparer',
  '/tlf-generator',
  '/adam-tutor',
  '/agentic-ai',
];

export type RouteResolution = {
  viewMode: ViewMode;
  workspacePath: string | null;
};

/**
 * Resolve a pathname to the corresponding high-level view mode and, when
 * applicable, the workspace route that should be forwarded to the RightPanel.
 */
export function resolveRoute(pathname: string): RouteResolution {
  const path = pathname || '/';
  const workspaceMatch = WORKSPACE_ROUTES.find((route) => path.startsWith(route)) || null;

  if (path.startsWith('/admin')) {
    return { viewMode: 'admin', workspacePath: null };
  }
  if (path.startsWith('/enter-study-details')) {
    return { viewMode: 'enter-study-details', workspacePath: null };
  }
  if (path.startsWith('/migration')) {
    return { viewMode: 'migration', workspacePath: null };
  }
  if (path.startsWith('/projects')) {
    return { viewMode: 'projects', workspacePath: null };
  }
  if (workspaceMatch) {
    return { viewMode: 'workspace', workspacePath: workspaceMatch };
  }
  if (path.startsWith('/project-selection')) {
    return { viewMode: 'project-selection', workspacePath: null };
  }
  if (path.startsWith('/login')) {
    return { viewMode: 'login', workspacePath: null };
  }

  return { viewMode: 'landing', workspacePath: null };
}
