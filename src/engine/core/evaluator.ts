/**
 * Expression evaluator for formula-based business models.
 *
 * Supports:
 * - Arithmetic: + - * / ^ (power)
 * - Comparison: > < >= <= == != (return 1 or 0)
 * - Functions: min, max, abs, round, floor, ceil, clamp, if
 * - Variable refs: `price` (current period), `prev.customers` (previous period)
 */

// ─── Types ───────────────────────────────────────────────────────

type ASTNode =
  | { type: "number"; value: number }
  | { type: "var"; name: string }
  | { type: "prev"; name: string }
  | { type: "binop"; op: string; left: ASTNode; right: ASTNode }
  | { type: "unary"; op: string; operand: ASTNode }
  | { type: "call"; name: string; args: ASTNode[] };

export interface CompiledFormula {
  evaluate: (
    current: Map<string, number>,
    prev: Map<string, number>
  ) => number;
  currentDeps: string[];
  prevDeps: string[];
}

// ─── Tokenizer ───────────────────────────────────────────────────

type Token =
  | { type: "number"; value: number }
  | { type: "ident"; value: string }
  | { type: "op"; value: string }
  | { type: "paren"; value: "(" | ")" }
  | { type: "comma" }
  | { type: "dot" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t" || ch === "\n") {
      i++;
      continue;
    }
    // Numbers (including decimals)
    if (ch >= "0" && ch <= "9") {
      let num = "";
      while (i < input.length && ((input[i] >= "0" && input[i] <= "9") || input[i] === ".")) {
        num += input[i++];
      }
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }
    // Identifiers (variable names, function names, prev)
    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      let ident = "";
      while (
        i < input.length &&
        ((input[i] >= "a" && input[i] <= "z") ||
          (input[i] >= "A" && input[i] <= "Z") ||
          (input[i] >= "0" && input[i] <= "9") ||
          input[i] === "_")
      ) {
        ident += input[i++];
      }
      tokens.push({ type: "ident", value: ident });
      continue;
    }
    // Two-character operators
    if (i + 1 < input.length) {
      const two = ch + input[i + 1];
      if (two === ">=" || two === "<=" || two === "==" || two === "!=") {
        tokens.push({ type: "op", value: two });
        i += 2;
        continue;
      }
    }
    // Single-character operators
    if ("+-*/^><%".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma" });
      i++;
      continue;
    }
    if (ch === ".") {
      tokens.push({ type: "dot" });
      i++;
      continue;
    }
    throw new Error(`Unexpected character '${ch}' at position ${i}`);
  }
  return tokens;
}

// ─── Parser (recursive descent) ─────────────────────────────────

class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: string, value?: string): Token {
    const tok = this.advance();
    if (!tok || tok.type !== type || (value !== undefined && (tok as { value?: string }).value !== value)) {
      throw new Error(
        `Expected ${type}${value ? ` '${value}'` : ""} but got ${tok ? `${tok.type} '${(tok as { value?: unknown }).value}'` : "end of input"}`
      );
    }
    return tok;
  }

  parse(): ASTNode {
    const node = this.parseComparison();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token at position ${this.pos}`);
    }
    return node;
  }

  // comparison: additive (( '>' | '<' | '>=' | '<=' | '==' | '!=' ) additive)?
  private parseComparison(): ASTNode {
    let left = this.parseAdditive();
    const tok = this.peek();
    if (tok?.type === "op" && [">", "<", ">=", "<=", "==", "!="].includes(tok.value)) {
      this.advance();
      const right = this.parseAdditive();
      left = { type: "binop", op: tok.value, left, right };
    }
    return left;
  }

  // additive: multiplicative (('+' | '-') multiplicative)*
  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();
    while (true) {
      const tok = this.peek();
      if (tok?.type === "op" && (tok.value === "+" || tok.value === "-")) {
        this.advance();
        const right = this.parseMultiplicative();
        left = { type: "binop", op: tok.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  // multiplicative: power (('*' | '/' | '%') power)*
  private parseMultiplicative(): ASTNode {
    let left = this.parsePower();
    while (true) {
      const tok = this.peek();
      if (tok?.type === "op" && (tok.value === "*" || tok.value === "/" || tok.value === "%")) {
        this.advance();
        const right = this.parsePower();
        left = { type: "binop", op: tok.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  // power: unary ('^' unary)?
  private parsePower(): ASTNode {
    let left = this.parseUnary();
    const tok = this.peek();
    if (tok?.type === "op" && tok.value === "^") {
      this.advance();
      const right = this.parseUnary();
      left = { type: "binop", op: "^", left, right };
    }
    return left;
  }

  // unary: '-' unary | primary
  private parseUnary(): ASTNode {
    const tok = this.peek();
    if (tok?.type === "op" && tok.value === "-") {
      this.advance();
      const operand = this.parseUnary();
      return { type: "unary", op: "-", operand };
    }
    return this.parsePrimary();
  }

  // primary: number | ident | prev.ident | ident(args) | '(' expr ')'
  private parsePrimary(): ASTNode {
    const tok = this.peek();

    if (!tok) throw new Error("Unexpected end of expression");

    // Number literal
    if (tok.type === "number") {
      this.advance();
      return { type: "number", value: tok.value };
    }

    // Parenthesized expression
    if (tok.type === "paren" && tok.value === "(") {
      this.advance();
      const node = this.parseComparison();
      this.expect("paren", ")");
      return node;
    }

    // Identifier: prev.X, function call, or variable reference
    if (tok.type === "ident") {
      this.advance();
      const name = tok.value;

      // prev.varName
      if (name === "prev") {
        this.expect("dot");
        const varTok = this.expect("ident");
        return { type: "prev", name: (varTok as { value: string }).value };
      }

      // Function call: name(args)
      const next = this.peek();
      if (next?.type === "paren" && next.value === "(") {
        this.advance(); // consume '('
        const args: ASTNode[] = [];
        if (!(this.peek()?.type === "paren" && (this.peek() as { value: string }).value === ")")) {
          args.push(this.parseComparison());
          while (this.peek()?.type === "comma") {
            this.advance(); // consume ','
            args.push(this.parseComparison());
          }
        }
        this.expect("paren", ")");
        return { type: "call", name, args };
      }

      // Simple variable reference
      return { type: "var", name };
    }

    throw new Error(`Unexpected token: ${tok.type} '${(tok as { value?: unknown }).value}'`);
  }
}

// ─── Dependency extraction ───────────────────────────────────────

function extractDeps(node: ASTNode): { currentDeps: Set<string>; prevDeps: Set<string> } {
  const currentDeps = new Set<string>();
  const prevDeps = new Set<string>();

  function walk(n: ASTNode): void {
    switch (n.type) {
      case "number":
        break;
      case "var":
        currentDeps.add(n.name);
        break;
      case "prev":
        prevDeps.add(n.name);
        break;
      case "binop":
        walk(n.left);
        walk(n.right);
        break;
      case "unary":
        walk(n.operand);
        break;
      case "call":
        for (const arg of n.args) walk(arg);
        break;
    }
  }

  walk(node);
  return { currentDeps, prevDeps };
}

// ─── AST → evaluate function ─────────────────────────────────────

function buildEvaluator(
  node: ASTNode
): (current: Map<string, number>, prev: Map<string, number>) => number {
  switch (node.type) {
    case "number": {
      const val = node.value;
      return () => val;
    }
    case "var": {
      const name = node.name;
      return (current) => current.get(name) ?? 0;
    }
    case "prev": {
      const name = node.name;
      return (_, prev) => prev.get(name) ?? 0;
    }
    case "unary": {
      const operand = buildEvaluator(node.operand);
      return (c, p) => -operand(c, p);
    }
    case "binop": {
      const left = buildEvaluator(node.left);
      const right = buildEvaluator(node.right);
      switch (node.op) {
        case "+": return (c, p) => left(c, p) + right(c, p);
        case "-": return (c, p) => left(c, p) - right(c, p);
        case "*": return (c, p) => left(c, p) * right(c, p);
        case "/": return (c, p) => { const r = right(c, p); return r === 0 ? 0 : left(c, p) / r; };
        case "^": return (c, p) => Math.pow(left(c, p), right(c, p));
        case "%": return (c, p) => { const r = right(c, p); return r === 0 ? 0 : left(c, p) % r; };
        case ">": return (c, p) => left(c, p) > right(c, p) ? 1 : 0;
        case "<": return (c, p) => left(c, p) < right(c, p) ? 1 : 0;
        case ">=": return (c, p) => left(c, p) >= right(c, p) ? 1 : 0;
        case "<=": return (c, p) => left(c, p) <= right(c, p) ? 1 : 0;
        case "==": return (c, p) => left(c, p) === right(c, p) ? 1 : 0;
        case "!=": return (c, p) => left(c, p) !== right(c, p) ? 1 : 0;
        default: throw new Error(`Unknown operator: ${node.op}`);
      }
    }
    case "call": {
      const args = node.args.map(buildEvaluator);
      switch (node.name) {
        case "min":
          if (args.length !== 2) throw new Error("min() requires 2 arguments");
          return (c, p) => Math.min(args[0](c, p), args[1](c, p));
        case "max":
          if (args.length !== 2) throw new Error("max() requires 2 arguments");
          return (c, p) => Math.max(args[0](c, p), args[1](c, p));
        case "abs":
          if (args.length !== 1) throw new Error("abs() requires 1 argument");
          return (c, p) => Math.abs(args[0](c, p));
        case "round":
          if (args.length !== 1) throw new Error("round() requires 1 argument");
          return (c, p) => Math.round(args[0](c, p));
        case "floor":
          if (args.length !== 1) throw new Error("floor() requires 1 argument");
          return (c, p) => Math.floor(args[0](c, p));
        case "ceil":
          if (args.length !== 1) throw new Error("ceil() requires 1 argument");
          return (c, p) => Math.ceil(args[0](c, p));
        case "clamp":
          if (args.length !== 3) throw new Error("clamp() requires 3 arguments");
          return (c, p) => Math.min(Math.max(args[0](c, p), args[1](c, p)), args[2](c, p));
        case "if":
          if (args.length !== 3) throw new Error("if() requires 3 arguments (condition, then, else)");
          return (c, p) => args[0](c, p) > 0 ? args[1](c, p) : args[2](c, p);
        default:
          throw new Error(`Unknown function: ${node.name}`);
      }
    }
  }
}

// ─── Public API ──────────────────────────────────────────────────

export function compile(expression: string): CompiledFormula {
  const tokens = tokenize(expression);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const deps = extractDeps(ast);
  const evaluate = buildEvaluator(ast);

  return {
    evaluate,
    currentDeps: [...deps.currentDeps],
    prevDeps: [...deps.prevDeps],
  };
}

/**
 * Topological sort of formula variables by their current-period dependencies.
 * prev.X references are excluded (they reference last period, not current).
 * Throws on circular dependencies.
 */
export function topologicalSort(
  formulas: { id: string; currentDeps: string[] }[],
  _inputIds: Set<string>
): string[] {
  // Build adjacency: for each formula, edges from its deps to itself
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  const formulaIds = new Set(formulas.map((f) => f.id));

  for (const f of formulas) {
    inDegree.set(f.id, 0);
    dependents.set(f.id, []);
  }

  for (const f of formulas) {
    for (const dep of f.currentDeps) {
      // Only count deps that are other formulas (not inputs)
      if (formulaIds.has(dep)) {
        inDegree.set(f.id, (inDegree.get(f.id) ?? 0) + 1);
        const list = dependents.get(dep);
        if (list) list.push(f.id);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    for (const dep of dependents.get(id) ?? []) {
      const newDeg = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, newDeg);
      if (newDeg === 0) queue.push(dep);
    }
  }

  if (sorted.length !== formulas.length) {
    const remaining = formulas
      .filter((f) => !sorted.includes(f.id))
      .map((f) => f.id);
    throw new Error(
      `Circular dependency detected among variables: ${remaining.join(", ")}`
    );
  }

  return sorted;
}
