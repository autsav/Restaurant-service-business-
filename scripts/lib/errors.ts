export type ErrorCode =
  | "INVALID_ARGS"
  | "INVALID_ROW"
  | "PHOTO_NOT_FOUND"
  | "PHOTO_UNSUPPORTED"
  | "PHOTO_TOO_SMALL"
  | "AUDIO_NOT_FOUND"
  | "RENDER_FAILED";

export class TeaserError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

// Each error is exactly one JSON line on stderr.
export const printError = (
  code: ErrorCode,
  message: string,
  row: number | null,
): void => {
  process.stderr.write(
    JSON.stringify({ ok: false, code, message, row }) + "\n",
  );
};

// Each success is exactly one JSON line on stdout.
export const printOk = (fields: Record<string, unknown>): void => {
  process.stdout.write(JSON.stringify({ ok: true, ...fields }) + "\n");
};

// Turns anything thrown into a TeaserError; unknown errors become `fallback`.
export const toTeaserError = (
  err: unknown,
  fallback: ErrorCode,
): TeaserError => {
  if (err instanceof TeaserError) {
    return err;
  }
  const message = err instanceof Error ? err.message : String(err);
  return new TeaserError(fallback, firstLine(message));
};

const firstLine = (text: string): string => {
  const line = text.split("\n")[0].trim();
  return line.length > 0 ? line : "Unknown error.";
};
