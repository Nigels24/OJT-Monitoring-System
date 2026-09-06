import { Transform } from 'class-transformer';

/**
 * Treats an empty string as "field not supplied".
 *
 * HTML forms post `""` for a cleared input. `@IsOptional()` only skips `null`
 * and `undefined`, so without this an empty box reaches the service as a real
 * value — and combined with `@Type(() => Number)`, `""` becomes `0`. That turns
 * a blank "Required Hours" into a genuine 0-hour requirement and a blank
 * evaluation score into a real score of 0.
 */
export const EmptyToUndefined = () =>
  Transform(({ value }: { value: unknown }) =>
    value === '' || value === null ? undefined : value,
  );

/**
 * As above, but also coerces to a number. Use instead of `@Type(() => Number)`
 * on optional numeric fields.
 */
export const ToOptionalNumber = () =>
  Transform(({ value }: { value: unknown }) =>
    value === '' || value === null || value === undefined
      ? undefined
      : Number(value),
  );

/**
 * Treats an empty string as "clear this field" — SQL NULL.
 *
 * The counterpart to `EmptyToUndefined`, and the right choice for the
 * **nullable** columns of an update DTO. Prisma reads `undefined` as "leave
 * this column alone", so `EmptyToUndefined` makes a deliberately emptied box
 * silently keep its old value; `null` is what actually clears it.
 *
 * The distinction that matters: a field **absent** from the request body still
 * arrives as `undefined` and still means "leave unchanged". Only an explicit
 * `""` (or `null`) clears.
 *
 * Only for columns that are nullable in `schema.prisma`. On a NOT NULL column
 * (`Student.requiredHours`, `Student.status`) keep `EmptyToUndefined` /
 * `ToOptionalNumber` — a `null` there is a write error, not a clear.
 */
export const EmptyToNull = () =>
  Transform(({ value }: { value: unknown }) =>
    value === '' || value === null ? null : value,
  );

/**
 * As `EmptyToNull`, but coerces to a number. For **nullable** numeric columns
 * (`Student.age`), where `ToOptionalNumber` would make a cleared field
 * unclearable.
 */
export const ToNullableNumber = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === '' || value === null) return null;
    if (value === undefined) return undefined;
    return Number(value);
  });
