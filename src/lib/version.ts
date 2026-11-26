import pkg from '../../package.json';

/** Human label for a SemVer version: "0.4.8-beta.2" → "0.4.8 Beta 2". */
export function versionLabel(v: string): string {
  const labels: Record<string, string> = { '1.0.2': '1.0.2b', '1.0.5': '1.0.2c', '1.0.3': '1.0.2.1c', '1.1.0': '1.1a' };
  const label = labels[v.replace(/^v/, '')];
  if (label) return label;
  const m = v.replace(/^v/, '').match(/^(\d+\.\d+\.\d+)(?:-([a-z]+)\.?(\d+)?)?/i);
  if (!m) return v;
  const [, core, tag, n] = m;
  if (!tag) return core;
  const names: Record<string, string> = { alpha: 'Alpha', beta: 'Beta', rc: 'Release Candidate' };
  return `${core} ${names[tag.toLowerCase()] ?? tag}${n ? ` ${n}` : ''}`;
}

export const APP_VERSION: string = pkg.version;
export const APP_VERSION_LABEL = versionLabel(APP_VERSION);
export const IS_PRERELEASE = APP_VERSION.includes('-');
/** Release name shown next to the version (matches the CHANGELOG heading). Update it with each named release. */
export const APP_CODENAME = 'Confianza';
