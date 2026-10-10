import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { credentialsEmail, escapeHtml } from './templates';

/**
 * Outgoing email. One method per kind of message; each **never throws** —
 * a failure comes back as `{ sent: false, error }` with a short, safe reason,
 * because no email may ever fail (or roll back) the request that sent it.
 *
 * Modes (env, read once at startup — see CLAUDE.md §7 "Email"):
 * - `log`  (the default): nodemailer's jsonTransport builds the whole message
 *   and it is written to the server log — including the temporary password,
 *   deliberately, so a developer can sign in. Nothing is sent.
 * - `smtp`: Gmail over SMTPS (smtp.gmail.com:465) with an App Password. The
 *   password is never logged, on success or failure.
 * Asking for `smtp` without SMTP_USER/SMTP_PASS falls back to `log` with a
 * warning; startup never fails over mail.
 *
 * `MAIL_REDIRECT_TO`, when set, sends every message to that one inbox instead
 * (subject prefixed) so testing can't reach a real student.
 *
 * The transport is the only thing that knows SMTP. A host that blocks
 * outbound SMTP can swap it for the Gmail API over HTTPS behind this same
 * `sendCredentials` signature without touching a caller.
 */

export type MailResult =
  | { sent: true; deliveredTo: string }
  | { sent: false; error: string; logOnly?: boolean };

export interface CredentialsMail {
  to: string;
  name: string;
  role: 'STUDENT' | 'SUPERVISOR';
  username: string | null;
  tempPassword: string;
}

export interface MailConfig {
  mode: 'smtp' | 'log';
  user?: string;
  pass?: string;
  from: string;
  loginUrl: string;
  redirectTo?: string;
  /** Why `log` was chosen when `smtp` was asked for. */
  fallbackReason?: string;
}

/** Every SMTP wait is bounded; a request can never hang on the mail server. */
const SMTP_TIMEOUT_MS = 10_000;
/** A last-resort cap on a whole send (DNS, TLS, three SMTP waits …). */
const SEND_DEADLINE_MS = 25_000;
const MAX_ERROR_LENGTH = 200;

export function readMailConfig(
  env: NodeJS.ProcessEnv = process.env,
): MailConfig {
  const requested = (env.MAIL_TRANSPORT ?? '').trim().toLowerCase();
  const user = env.SMTP_USER?.trim() || undefined;
  const pass = env.SMTP_PASS?.trim() || undefined;
  const base = {
    user,
    pass,
    from:
      env.SMTP_FROM?.trim() || user || 'OJT Monitoring <no-reply@localhost>',
    loginUrl: env.APP_LOGIN_URL?.trim() || 'http://localhost:3001/login',
    redirectTo: env.MAIL_REDIRECT_TO?.trim() || undefined,
  };

  if (requested === 'smtp') {
    if (user && pass) return { ...base, mode: 'smtp' };
    return {
      ...base,
      mode: 'log',
      fallbackReason:
        'MAIL_TRANSPORT=smtp but SMTP_USER or SMTP_PASS is not set',
    };
  }
  if (requested && requested !== 'log') {
    return {
      ...base,
      mode: 'log',
      fallbackReason: `MAIL_TRANSPORT="${requested}" is not smtp or log`,
    };
  }
  // Unset or "log": emails are opt-in. A dev machine that happens to have
  // SMTP_* set still sends nothing unless MAIL_TRANSPORT=smtp says so.
  return { ...base, mode: 'log' };
}

/**
 * A short reason safe to show a coordinator and to store in
 * `User.credentialsEmailError`: built from the error's code only — never its
 * message or the server's reply, so nothing from the message body (the
 * temporary password) can end up in it.
 */
export function safeMailError(err: unknown): string {
  const code = field(err, 'code') ?? '';
  switch (code) {
    case 'EAUTH':
      return 'The mail server rejected the sign-in (check SMTP_USER and the Gmail App Password)';
    case 'ETIMEDOUT':
    case 'ECONNECTION':
    case 'ESOCKET':
    case 'EDNS':
    case 'ECONNREFUSED':
      return 'Could not reach the mail server';
    case 'EENVELOPE':
      return 'The mail server refused the recipient address';
    case 'EMESSAGE':
      return 'The mail server refused the message';
    case 'DEADLINE':
      return 'The mail server did not respond in time';
    default:
      return code
        ? `Email could not be sent (${code})`
        : 'Email could not be sent';
  }
}

/** Code and SMTP status only — what a log line about a failure may carry. */
function errorTag(err: unknown): string {
  if (!err || typeof err !== 'object') return 'unknown';
  return (
    (['code', 'responseCode', 'command'] as const)
      .map((key) => {
        const value = field(err, key);
        return value === undefined ? null : `${key}=${value}`;
      })
      .filter(Boolean)
      .join(' ') || 'unknown'
  );
}

/** A string or number property of an unknown error, as text; else undefined. */
function field(err: unknown, key: string): string | undefined {
  if (!err || typeof err !== 'object' || !(key in err)) return undefined;
  const value = (err as Record<string, unknown>)[key];
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : undefined;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  readonly config: MailConfig;
  private transporter: Transporter;

  constructor() {
    this.config = readMailConfig();
    this.transporter =
      this.config.mode === 'smtp'
        ? createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user: this.config.user, pass: this.config.pass },
            connectionTimeout: SMTP_TIMEOUT_MS,
            greetingTimeout: SMTP_TIMEOUT_MS,
            socketTimeout: SMTP_TIMEOUT_MS,
          })
        : createTransport({ jsonTransport: true });
  }

  /**
   * Says which mode is live, and in smtp mode checks the login in the
   * background — a warning if it fails, never a crash, and never awaited, so
   * a slow mail server can't delay startup.
   */
  onModuleInit(): void {
    if (this.config.fallbackReason) {
      this.logger.warn(
        `${this.config.fallbackReason} — falling back to log mode: credential emails are written to this log, not sent.`,
      );
    }
    if (this.config.redirectTo) {
      this.logger.warn(
        `MAIL_REDIRECT_TO is set: every email goes to ${this.config.redirectTo} instead of its recipient.`,
      );
    }
    if (this.config.mode !== 'smtp') {
      this.logger.log('Mail transport: log (nothing is sent).');
      return;
    }
    this.transporter
      .verify()
      .then(() =>
        this.logger.log(
          `Mail transport: smtp as ${this.config.user} — login OK.`,
        ),
      )
      .catch((err: unknown) =>
        this.logger.warn(
          `Mail transport: smtp login check failed (${errorTag(err)}). Emails will fail until SMTP_USER/SMTP_PASS are fixed.`,
        ),
      );
  }

  /** The login details for a new or reset account. Never throws. */
  async sendCredentials(input: CredentialsMail): Promise<MailResult> {
    try {
      const email = credentialsEmail({
        name: input.name,
        role: input.role,
        username: input.username,
        email: input.to,
        tempPassword: input.tempPassword,
        loginUrl: this.config.loginUrl,
      });
      const redirect = this.config.redirectTo;
      const to = redirect ?? input.to;
      const note = redirect
        ? `[Redirected test email — addressed to ${input.to}]`
        : null;
      const message = {
        from: this.config.from,
        to,
        subject: redirect
          ? `[TEST → ${input.to}] ${email.subject}`
          : email.subject,
        text: note ? `${note}\n\n${email.text}` : email.text,
        // A function replacer: an address may contain "$", which a
        // replacement string would read as a pattern.
        html: note
          ? email.html.replace(
              /(<body[^>]*>)/,
              (body) =>
                `${body}<p style="color: #b45309;"><strong>${escapeHtml(note)}</strong></p>`,
            )
          : email.html,
      };

      if (this.config.mode === 'log') {
        const info = (await this.transporter.sendMail(message)) as {
          message: string;
        };
        // Log mode only: the full message, temporary password included, so a
        // developer can sign in. Never reached in smtp mode.
        this.logger.log(
          `[log mode] Credentials email NOT sent (to ${to}). Full message:\n${info.message}`,
        );
        return {
          sent: false,
          logOnly: true,
          error:
            'mail is in log mode, so the message was written to the server log instead of sent',
        };
      }

      await this.withDeadline(this.transporter.sendMail(message));
      this.logger.log(`Credentials email sent to ${to}.`);
      return { sent: true, deliveredTo: to };
    } catch (err: unknown) {
      // Code and SMTP status only — never the message, never the reply text.
      this.logger.warn(
        `Credentials email to ${input.to} failed (${errorTag(err)}).`,
      );
      return {
        sent: false,
        error: safeMailError(err).slice(0, MAX_ERROR_LENGTH),
      };
    }
  }

  private withDeadline<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(Object.assign(new Error('deadline'), { code: 'DEADLINE' })),
        SEND_DEADLINE_MS,
      );
    });
    return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
  }
}
