import { randomInt } from 'crypto';

/**
 * System-generated login credentials for students and supervisors.
 *
 * Plain functions with no Nest or Prisma dependency: the database work is
 * passed in as callbacks, so the rules here can be tested on their own.
 *
 * The plaintext password produced here must only ever travel in the one HTTP
 * response that issues it — never into a log line, an error message or a
 * column. The caller hashes it immediately.
 */

/**
 * `first initial + last name`, lowercase, accents stripped, letters only:
 * "Juan Dela Cruz" -> "jdelacruz", "José Ñuñez" -> "jnunez". Falls back to
 * "user" when neither name has a letter in it.
 *
 * There is deliberately no length rule (unlike the old typed-username pattern):
 * "Li Ng" -> "lng" is a fine username. Letters only also guarantees no "@",
 * which is what keeps a username from ever shadowing an email at login.
 */
export function usernameBase(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const initial = lettersOnly(firstName).charAt(0);
  const base = initial + lettersOnly(lastName);
  return base || 'user';
}

function lettersOnly(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD') // "é" -> "e" + combining accent, "ñ" -> "n" + tilde
    .replace(/\p{M}/gu, '') // drop the combining marks
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/**
 * `base` if free, else the first of `base2`, `base3`, … not in `taken`.
 * `taken` is compared case-insensitively, so a legacy hand-typed "JDelaCruz"
 * still counts as a clash for "jdelacruz".
 */
export function nextFreeUsername(
  base: string,
  taken: Iterable<string>,
): string {
  const used = new Set([...taken].map((name) => name.toLowerCase()));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** How many times a create is retried when it loses a username race. */
export const USERNAME_RACE_ATTEMPTS = 3;

/**
 * Picks a free username and runs `create` with it, retrying when two
 * creations raced to the same name.
 *
 * `findTaken(base)` lists existing usernames starting with `base` (one query).
 * Between that read and the insert another request can claim the same name;
 * the unique index on `User.username` then rejects the insert, `isUsernameClash`
 * recognises that error, and the whole pick-and-create runs again against a
 * fresh read. Any other error propagates untouched.
 */
export async function createWithGeneratedUsername<T>(
  base: string,
  findTaken: (base: string) => Promise<string[]>,
  create: (username: string) => Promise<T>,
  isUsernameClash: (err: unknown) => boolean,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const username = nextFreeUsername(base, await findTaken(base));
    try {
      return await create(username);
    } catch (err) {
      if (attempt >= USERNAME_RACE_ATTEMPTS || !isUsernameClash(err)) {
        throw err;
      }
    }
  }
}

// Look-alikes removed: 0/O, 1/l/I. A temporary password is read off a screen
// and typed by someone else, so a character that can be misread is a support
// call.
const LETTERS = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALPHABET = LETTERS + DIGITS;
export const GENERATED_PASSWORD_LENGTH = 8;

/**
 * 8 characters from `crypto.randomInt` (a CSPRNG — `Math.random` is not), at
 * least one letter and one digit. The two guaranteed characters are placed
 * first and then the whole thing is shuffled, so their positions carry no
 * information.
 */
export function generatePassword(): string {
  const chars = [pick(LETTERS), pick(DIGITS)];
  while (chars.length < GENERATED_PASSWORD_LENGTH) chars.push(pick(ALPHABET));
  // Fisher–Yates, with the same CSPRNG.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function pick(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)];
}
