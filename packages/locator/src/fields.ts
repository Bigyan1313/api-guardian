/**
 * Finding every read of a field that the specification changed.
 *
 * This is the part a text search cannot do. `customer_name` appears in the
 * interface that mirrors the schema, in the clients that fetch it, and in
 * `reporting.ts` two layers above the HTTP call — and it may also appear in an
 * unrelated type, a comment, or a string. The difference matters: the repair
 * stage edits what the locator points at.
 *
 * So the property is resolved to a declaration, and the TypeScript language
 * service's find-references is asked where that symbol is used. References are
 * what the compiler itself would rename, which is exactly the set a correct
 * patch has to touch.
 */

import { Node, SyntaxKind, type PropertySignature, type SourceFile } from 'ts-morph';

import { isTestFile, relativePath } from './project.ts';
import type { Location } from './types.ts';

function snippetOf(node: Node): string {
  // One line of context: the statement the reference sits in reads better in a
  // dashboard than the identifier on its own.
  const statement = node.getFirstAncestor((a) => Node.isStatement(a)) ?? node;
  return statement.getText().replace(/\s+/g, ' ').slice(0, 160);
}

function locationOf(
  node: Node,
  root: string,
  kind: Location['kind'],
  reason: string,
): Location {
  const file = node.getSourceFile();
  const { line, column } = file.getLineAndColumnAtPos(node.getStart());
  return { file: relativePath(root, file), line, column, kind, snippet: snippetOf(node), reason };
}

/** Every property declaration with this name, across the project's interfaces. */
export function findPropertyDeclarations(
  files: readonly SourceFile[],
  field: string,
): PropertySignature[] {
  const found: PropertySignature[] = [];

  for (const file of files) {
    for (const iface of file.getInterfaces()) {
      const property = iface.getProperty(field);
      if (property !== undefined) found.push(property);
    }
  }

  return found;
}

export interface FieldMatch {
  readonly locations: readonly Location[];
  /** True when no type in the project mirrors the changed schema field. */
  readonly noDeclaration: boolean;
}

export function findFieldReads(
  files: readonly SourceFile[],
  root: string,
  field: string,
): FieldMatch {
  const declarations = findPropertyDeclarations(files, field);

  if (declarations.length === 0) {
    // The spec changed a field this repository never models. That is a real
    // answer — not affected — not a failure to look.
    return { locations: [], noDeclaration: true };
  }

  const locations: Location[] = [];
  const seen = new Set<string>();

  const push = (location: Location): void => {
    const key = `${location.file}:${location.line}:${location.column}`;
    if (seen.has(key)) return;
    seen.add(key);
    locations.push(location);
  };

  for (const declaration of declarations) {
    const owner = declaration.getFirstAncestorByKind(SyntaxKind.InterfaceDeclaration);
    push(
      locationOf(
        declaration,
        root,
        'type_decl',
        `declares ${field} on ${owner?.getName() ?? 'an interface'}; mirrors the changed schema`,
      ),
    );

    // Ask the compiler where this symbol is actually used. find-references
    // searches the whole program, including the files excluded above, so the
    // same exclusion has to be applied to its results.
    for (const reference of declaration.findReferencesAsNodes()) {
      if (reference === declaration.getNameNode()) continue;
      if (isTestFile(reference.getSourceFile().getFilePath())) continue;
      push(
        locationOf(reference, root, 'field_read', `reads ${field}, which the specification changed`),
      );
    }
  }

  return { locations, noDeclaration: false };
}
