import { describe, expect, it } from 'vitest';
import type { ViewMode } from '../types/viewMode';
import { resolveRoute } from './workspaceRouting';

describe('resolveRoute', () => {
  const workspaceCases: Array<[string, string]> = [
    ['/pair-programming', '/pair-programming'],
    ['/pair-programming/details', '/pair-programming'],
    ['/code-review', '/code-review'],
    ['/consolidated-code', '/consolidated-code'],
    ['/traceability', '/traceability'],
    ['/test-with-data', '/test-with-data'],
    ['/adam-generator', '/adam-generator'],
    ['/adam-dataset-comparer/compare', '/adam-dataset-comparer'],
    ['/submission-dashboard/status', '/submission-dashboard'],
  ];

  workspaceCases.forEach(([path, expectedWorkspace]) => {
    it(`maps workspace route ${path} to workspace view and tab ${expectedWorkspace}`, () => {
      const result = resolveRoute(path);
      expect(result.viewMode).toBe('workspace');
      expect(result.workspacePath).toBe(expectedWorkspace);
    });
  });

  const nonWorkspaceCases: Array<[string, ViewMode]> = [
    ['/admin', 'admin'],
    ['/enter-study-details', 'enter-study-details'],
    ['/migration', 'migration'],
    ['/projects', 'projects'],
    ['/project-selection', 'project-selection'],
    ['/login', 'login'],
  ];

  nonWorkspaceCases.forEach(([path, expectedView]) => {
    it(`returns ${expectedView} for ${path} and clears workspace path`, () => {
      const result = resolveRoute(path);
      expect(result.viewMode).toBe(expectedView);
      expect(result.workspacePath).toBeNull();
    });
  });

  it('defaults to landing when no routes match', () => {
    const result = resolveRoute('/some/random/path');
    expect(result.viewMode).toBe('landing');
    expect(result.workspacePath).toBeNull();
  });
});
