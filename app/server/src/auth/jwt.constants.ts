/**
 * Reads JWT_SECRET and refuses to start without it.
 *
 * This used to fall back to the literal 'dev-secret-change-this' in both
 * AuthModule and JwtStrategy. A deploy that forgot the env var would boot
 * happily and sign every token with a value that is public in this repo, so
 * anyone could mint a COORDINATOR token. Crashing at startup is the safer
 * failure.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Add it to app/server/.env before starting the server.',
    );
  }
  return secret;
}
