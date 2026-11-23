import { isTauri } from '../db/adapters';

export type ProjectPage = 'repo' | 'issues' | 'releases' | 'winnow';
const URL: Record<ProjectPage, string> = {
  repo: 'https://github.com/eperez98/monto', issues: 'https://github.com/eperez98/monto/issues', releases: 'https://github.com/eperez98/monto/releases',
  // The author's other project, shown in About.
  winnow: 'https://github.com/eperez98/WinNow',
};

/** Open Monto's GitHub repo, issues or releases (or WinNow's repo) in the user's browser. */
export async function openProjectPage(page: ProjectPage): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_project_page', { page });
  } else window.open(URL[page], '_blank', 'noopener');
}
