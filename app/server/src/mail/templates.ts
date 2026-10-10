/**
 * Email bodies, as pure functions: plain data in, `{ subject, text, html }`
 * out — no Nest, no transport, so they test in isolation. Every value that
 * reaches the HTML goes through `escapeHtml` (a name like `<b>Ana</b>` or
 * `Tom & Jerry` must print as typed, never as markup).
 */
import { SCHOOL_NAME } from '../common/school';

export interface CredentialsEmailInput {
  name: string;
  role: 'STUDENT' | 'SUPERVISOR';
  /** `null` for an account from before usernames: it signs in with its email. */
  username: string | null;
  email: string;
  tempPassword: string;
  loginUrl: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ROLE_LABEL: Record<CredentialsEmailInput['role'], string> = {
  STUDENT: 'Student',
  SUPERVISOR: 'Supervisor',
};

/** The login details a new or reset account receives. */
export function credentialsEmail(input: CredentialsEmailInput): RenderedEmail {
  const role = ROLE_LABEL[input.role];
  const signInAs = input.username ?? input.email;
  const signInLabel = input.username ? 'Username' : 'Email';

  // A fixed subject: nothing user-typed goes into a header.
  const subject = 'Your OJT Monitoring System login details';

  const text = [
    `Hello ${input.name},`,
    '',
    `An OJT Monitoring System account has been set up for you as a ${role} at ${SCHOOL_NAME}.`,
    '',
    `${signInLabel}: ${signInAs}`,
    `Temporary password: ${input.tempPassword}`,
    '',
    `Sign in at: ${input.loginUrl}`,
    '',
    'You will be asked to change this password the first time you sign in.',
    'If you did not expect this email, please contact your OJT coordinator.',
  ].join('\n');

  const e = escapeHtml;
  const html = `<!doctype html>
<html><body style="font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.5;">
  <p>Hello ${e(input.name)},</p>
  <p>An OJT Monitoring System account has been set up for you as a <strong>${e(role)}</strong> at ${e(SCHOOL_NAME)}.</p>
  <table cellpadding="6" style="border-collapse: collapse; border: 1px solid #e5e7eb;">
    <tr><td style="color: #6b7280;">${e(signInLabel)}</td><td><strong>${e(signInAs)}</strong></td></tr>
    <tr><td style="color: #6b7280;">Temporary password</td><td><strong style="font-family: monospace;">${e(input.tempPassword)}</strong></td></tr>
  </table>
  <p>Sign in at <a href="${e(input.loginUrl)}">${e(input.loginUrl)}</a></p>
  <p>You will be asked to change this password the first time you sign in.</p>
  <p style="color: #6b7280; font-size: 12px;">If you did not expect this email, please contact your OJT coordinator.</p>
</body></html>`;

  return { subject, text, html };
}
