export const ExitCode = {
  Ok: 0,
  Generic: 1,
  BadArgs: 2,
  FileNotFound: 3,
  ParseError: 4,
  Sigint: 130,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export function fail(code: ExitCodeValue, message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}
