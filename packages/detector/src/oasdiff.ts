/**
 * The oasdiff binary, wrapped.
 *
 * Detection is the part oasdiff already does well, so this file stays thin on
 * purpose (plan section 12, risk 1): run the tool, parse its JSON, and hand the
 * findings on. The judgement lives in classify.ts and renames.ts.
 *
 * The version is pinned in `OASDIFF_VERSION` and checked at run time, because
 * the classifier maps oasdiff's rule identifiers by name and a silent upgrade
 * that renamed one would misclassify changes rather than fail.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export const OASDIFF_VERSION = '1.34.1';

/** One entry from `oasdiff changelog --format json`. */
export interface Finding {
  /** oasdiff's rule identifier, e.g. `response-required-property-removed`. */
  readonly id: string;
  /** oasdiff's own description. Kept verbatim so we can show our work. */
  readonly text: string;
  /** 3 = breaking, 2 = warning, 1 = informational. */
  readonly level: 1 | 2 | 3;
  readonly operation?: string;
  readonly operationId?: string;
  readonly path?: string;
  readonly section?: string;
  readonly fingerprint?: string;
}

export class OasdiffError extends Error {}

/** Runs the changelog command between two spec files and returns its findings. */
export async function changelog(basePath: string, revisionPath: string): Promise<Finding[]> {
  let stdout: string;
  try {
    ({ stdout } = await run(
      'oasdiff',
      ['changelog', basePath, revisionPath, '--format', 'json'],
      { maxBuffer: 32 * 1024 * 1024 },
    ));
  } catch (error) {
    const cause = error as NodeJS.ErrnoException & { stderr?: string };
    if (cause.code === 'ENOENT') {
      throw new OasdiffError(
        `oasdiff is not installed. Install version ${OASDIFF_VERSION}: ` +
          `go install github.com/oasdiff/oasdiff@v${OASDIFF_VERSION}`,
      );
    }
    throw new OasdiffError(`oasdiff failed: ${cause.stderr?.trim() ?? cause.message}`);
  }

  // No differences at all is an empty body, not an empty array.
  const body = stdout.trim();
  if (body === '') return [];

  try {
    return JSON.parse(body) as Finding[];
  } catch {
    throw new OasdiffError(`oasdiff returned output that is not JSON: ${body.slice(0, 200)}`);
  }
}

export async function isInstalled(): Promise<boolean> {
  try {
    await run('oasdiff', ['--version']);
    return true;
  } catch {
    return false;
  }
}
