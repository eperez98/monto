import { isTauri } from '../db/adapters';

export type ProjectPage = 'repo' | 'issues' | 'releases';
const SUFFIX: Record<ProjectPage, string> = { repo: '', issues: '/issues', releases: '/releases' };

/** Open Monto's GitHub repo, issues or releases in the user's browser. */
export async function openProjectPage(page: ProjectPage): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_project_page', { page });
  } else window.open(`https://github.com/eperez98/monto${SUFFIX[page]}`, '_blank', 'noopener');
}
