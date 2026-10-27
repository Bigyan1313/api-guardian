/**
 * Loading the repository under analysis into ts-morph.
 *
 * The analysis reads the TypeScript syntax tree, not the text. A text search
 * cannot tell a call from a comment, a string, or an unrelated identifier that
 * happens to share a name, and the difference matters: a wrong location sends
 * the model to edit code that was never broken.
 */

import { relative } from 'node:path';

import { Project, type SourceFile } from 'ts-morph';

/** Directories that are never the repository's own source. */
const EXCLUDED = [/\bnode_modules\b/, /\bdist\b/, /\.git\b/, /\bcoverage\b/];

/**
 * Test files, which the locator finds but must never hand to the repair agent.
 *
 * They genuinely read the changed fields, so find-references reports them. But
 * the validator's cheat guards reject any patch that touches a test file, and
 * the fixture in `test/support/` is the thing that serves the old contract --
 * editing it to match v2 would erase the breakage the whole evaluation
 * measures. Pointing the agent at either is asking it to fail. They are
 * recorded as skipped, with the reason, rather than quietly dropped.
 */
const TEST_FILE = /(\btests?\b|\.test\.|\.spec\.|__tests__)/;

export function isTestFile(path: string): boolean {
  return TEST_FILE.test(path);
}

export interface LoadedProject {
  readonly project: Project;
  readonly root: string;
  readonly sourceFiles: readonly SourceFile[];
  readonly skipped: readonly { file: string; reason: string }[];
}

export function loadProject(tsConfigFilePath: string, root: string): LoadedProject {
  const project = new Project({ tsConfigFilePath });

  const sourceFiles: SourceFile[] = [];
  const skipped: { file: string; reason: string }[] = [];

  for (const file of project.getSourceFiles()) {
    const path = file.getFilePath();
    const rel = relative(root, path);

    const excluded = EXCLUDED.find((pattern) => pattern.test(path));
    if (excluded !== undefined) {
      skipped.push({ file: rel, reason: 'not repository source (dependency or build output)' });
      continue;
    }
    if (file.isDeclarationFile()) {
      skipped.push({ file: rel, reason: 'declaration file; contains no call sites' });
      continue;
    }
    if (isTestFile(path)) {
      skipped.push({
        file: rel,
        reason: 'test file; the validator rejects any patch that edits one, so it is never offered for repair',
      });
      continue;
    }
    sourceFiles.push(file);
  }

  return { project, root, sourceFiles, skipped };
}

export function relativePath(root: string, file: SourceFile): string {
  return relative(root, file.getFilePath());
}
