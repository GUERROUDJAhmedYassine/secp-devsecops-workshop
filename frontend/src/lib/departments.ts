export const DEPARTMENT_OPTIONS = [
  'Engineering',
  'Infrastructure',
  'Security Ops',
  'Finance',
] as const;

export function getPreferredDepartment(preferred?: string | null): string {
  if (preferred && DEPARTMENT_OPTIONS.includes(preferred as typeof DEPARTMENT_OPTIONS[number])) {
    return preferred;
  }
  return DEPARTMENT_OPTIONS[0];
}
