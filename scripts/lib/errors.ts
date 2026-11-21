export const ERROR_CODES = [
  "INVALID_ARGS",
  "INVALID_ROW",
  "PHOTO_NOT_FOUND",
  "PHOTO_UNSUPPORTED",
  "PHOTO_TOO_SMALL",
  "AUDIO_NOT_FOUND",
  "CLIP_NOT_FOUND",
  "RENDER_FAILED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class TeaserError extends Error {
  readonly code: ErrorCode;
  readonly row: number | null;

  constructor(code: ErrorCode, message: string, row: number | null = null) {
    super(message);
    this.name = "TeaserError";
    this.code = code;
    this.row = row;
  }
}

export const toTeaserError = (err: unknown, fallback: ErrorCode, row: number | null = null): TeaserError =>
  err instanceof TeaserError ? err : new TeaserError(fallback, err instanceof Error ? err.message : String(err), row);

/** One JSON line on stderr. This is the only error output of both CLIs. */
export const printError = (err: TeaserError): void => {
  process.stderr.write(`${JSON.stringify({ ok: false, code: err.code, message: err.message, row: err.row })}\n`);
};

/** One JSON line on stdout for a successful single render. */
export const printSuccess = (output: string, durationMs: number): void => {
  process.stdout.write(`${JSON.stringify({ ok: true, output, durationMs })}\n`);
};
