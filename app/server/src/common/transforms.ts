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
