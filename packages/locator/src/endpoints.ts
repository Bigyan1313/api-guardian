/**
 * Finding the code that calls a given OpenAPI operation.
 *
 * Three call patterns are supported, and each is matched from the syntax tree
 * rather than by searching text:
 *
 *   fetch              `fetch(\`${this.baseUrl}/v1/contacts/${id}\`)`
 *   axios              `this.http.get('/v1/contacts')` on an axios instance
 *   generated client   a function whose name is the operationId
 *
 * A template literal is the interesting case. `/v1/contacts/${id}` has to match
 * the OpenAPI path `/v1/contacts/{id}`, so the interpolations are reduced to
 * placeholders and the literal halves compared. Matching on the literal text
 * alone would miss every parameterised call, which is most of them.
 */

import { Node, SyntaxKind, type SourceFile } from 'ts-morph';

import { relativePath } from './project.ts';
import type { Location } from './types.ts';

/** Turns an OpenAPI path into a regular expression: `/a/{id}` -> `^/a/[^/]+$`. */
export function pathPattern(openApiPath: string): RegExp {
  const escaped = openApiPath
    .replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === '{' || c === '}' ? c : `\\${c}`))
    .replace(/\{[^}]+\}/g, '[^/]+');
  return new RegExp(`${escaped}$`);
}

/**
 * The URL a call expression's first string-ish argument describes, with
 * interpolations replaced by a single path segment. Returns null when the
 * argument is not a literal the locator can read — a dynamically built URL is
 * reported as a coverage limit rather than guessed at.
 */
export function urlOf(node: Node): string | null {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralValue();
  }

  if (Node.isTemplateExpression(node)) {
    let url = node.getHead().getLiteralText();
    for (const span of node.getTemplateSpans()) {
      // Every interpolation stands for exactly one path segment.
      url += `\u0000${span.getLiteral().getLiteralText()}`;
    }
    return url.replace(/\u0000/g, 'x');
  }

  return null;
}

function snippetOf(node: Node): string {
  return node.getText().replace(/\s+/g, ' ').slice(0, 160);
}

function locationOf(node: Node, root: string, kind: Location['kind'], reason: string): Location {
  const file = node.getSourceFile();
  const { line, column } = file.getLineAndColumnAtPos(node.getStart());
  return { file: relativePath(root, file), line, column, kind, snippet: snippetOf(node), reason };
}

export interface EndpointMatch {
  readonly locations: readonly Location[];
  /** Calls whose URL could not be read, so coverage is incomplete. */
  readonly unreadable: readonly Location[];
}

/**
 * Finds calls to one operation. `operationId` lets the generated-client pattern
 * match by function name, which is how those clients are written.
 */
export function findEndpointCalls(
  files: readonly SourceFile[],
  root: string,
  openApiPath: string,
  method: string | null,
  operationId?: string,
): EndpointMatch {
  const pattern = pathPattern(openApiPath);
  const locations: Location[] = [];
  const unreadable: Location[] = [];

  for (const file of files) {
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression();
      const calleeText = callee.getText();

      // fetch(...) and axios instance methods: .get / .post / ...
      const isFetch = calleeText === 'fetch' || calleeText.endsWith('.fetch');
      const httpMethod = /\.(get|post|put|patch|delete|head|options)$/.exec(calleeText)?.[1];
      const isHttpCall = isFetch || httpMethod !== undefined;

      if (isHttpCall) {
        const [first] = call.getArguments();
        if (first === undefined) continue;

        const url = urlOf(first);
        if (url === null) {
          unreadable.push(
            locationOf(
              call,
              root,
              'call_site',
              'the URL is built at run time, so the locator cannot tell which endpoint this calls',
            ),
          );
          continue;
        }

        // When the call names its own HTTP method, respect it.
        if (
          method !== null &&
          httpMethod !== undefined &&
          httpMethod.toLowerCase() !== method.toLowerCase()
        ) {
          continue;
        }

        if (pattern.test(url)) {
          locations.push(
            locationOf(
              call,
              root,
              'call_site',
              `calls ${method?.toUpperCase() ?? ''} ${openApiPath}`.trim(),
            ),
          );
        }
        continue;
      }

      // Generated clients expose one function per operation, named by operationId.
      if (operationId !== undefined && calleeText === operationId) {
        locations.push(
          locationOf(call, root, 'call_site', `calls the generated client's ${operationId}()`),
        );
      }
    }

    // The generated client's own definition is a call site of the operation too:
    // its URL has to change when the endpoint does.
    if (operationId !== undefined) {
      for (const fn of file.getFunctions()) {
        if (fn.getName() === operationId) {
          locations.push(
            locationOf(fn, root, 'call_site', `generated client function for ${operationId}`),
          );
        }
      }
    }
  }

  return { locations, unreadable };
}
