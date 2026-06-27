// ── Role constants ────────────────────────────────────────────────────────────
export const ROLES = {
  ADMIN:           'Admin',
  CLASS_TEACHER:   'Class Teacher',
  SUBJECT_TEACHER: 'Subject Teacher',
  STUDENT:         'Student',
};

/** Priority order used for redirect decisions (highest priority first). */
export const ROLE_PRIORITY = [
  ROLES.ADMIN,
  ROLES.CLASS_TEACHER,
  ROLES.SUBJECT_TEACHER,
  ROLES.STUDENT,
];

/** Display order for roles in UI (e.g. Navbar, Profile). */
export const ROLE_ORDER = [
  ROLES.ADMIN,
  ROLES.SUBJECT_TEACHER,
  ROLES.CLASS_TEACHER,
  ROLES.STUDENT,
];

// ── Email ─────────────────────────────────────────────────────────────────────
export const EMAIL_DOMAIN = '@moe-dl.edu.my';

/** Append the school email domain if the user only typed the local part. */
export const toFullEmail = (input) =>
  input.includes('@') ? input : `${input}${EMAIL_DOMAIN}`;
