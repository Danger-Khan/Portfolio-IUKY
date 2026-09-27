/**
 * Engine.js
 * ---------------------------------------------------------------------------
 * A real, small compiler front-end running entirely in the browser: a
 * hand-written lexer, a recursive-descent parser building an AST, a
 * multi-pass type-inference step, and four backend code generators
 * (JavaScript, C, Java, Go) -- translating a genuine, clearly bounded
 * SUBSET of Python into working source in whichever target language you
 * pick. No library, no LLM call, no server round-trip. This is a direct
 * port of compiler_cli.py (same algorithm, same grammar, same codegen
 * rules) -- that Python file is the one that's actually unit-testable from
 * a terminal; keep both in sync if you change one.
 *
 * This is a teaching-subset transpiler, not a full Python implementation.
 * Supported: comments, int/float/string/bool/None literals, arithmetic
 * (+ - * / // % **), comparisons, `and`/`or`/`not`, if/elif/else, while,
 * `for x in range(...)`, top-level function defs with return, print(...),
 * pass/break/continue. NOT supported (by design, kept out to stay small
 * and correct): lists/dicts/tuples, classes, exceptions, string methods,
 * f-strings/.format(), multiple assignment/unpacking, comprehensions,
 * imports, default/keyword arguments, closures, generators. Variable and
 * parameter types are inferred from how they're first used -- reassigning
 * a variable to a different type is reported as an error rather than
 * silently miscompiled, since the target languages are statically typed
 * and Python isn't.
 */
import { MAGIC_TERMS, MAGIC_LINES } from './templates/magic.js';

// =============================================================================
// Lexer
// =============================================================================

const KEYWORDS = new Set([
  'def', 'return', 'if', 'elif', 'else', 'while', 'for', 'in',
  'and', 'or', 'not', 'True', 'False', 'None', 'pass', 'break', 'continue'
]);

const SYMBOLS = [
  '**', '//', '==', '!=', '<=', '>=',
  '=', '+', '-', '*', '/', '%', '<', '>', '(', ')', ':', ','
];

export class LexError extends Error {}
export class ParseError extends Error {}
export class TypeCheckError extends Error {}
export class CodegenError extends Error {}

function isDigit(ch) { return ch >= '0' && ch <= '9'; }
function isAlpha(ch) { return /[A-Za-z_]/.test(ch); }
function isAlnum(ch) { return /[A-Za-z0-9_]/.test(ch); }

function stripComment(line) {
  let inString = null;
  let out = '';
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < line.length) {
        out += line[i + 1];
        i += 2;
        continue;
      }
      if (ch === inString) inString = null;
    } else if (ch === "'" || ch === '"') {
      inString = ch;
      out += ch;
    } else if (ch === '#') {
      break;
    } else {
      out += ch;
    }
    i += 1;
  }
  return out;
}

const ESCAPES = { n: '\n', t: '\t', '\\': '\\', "'": "'", '"': '"' };

function tokenizeLineBody(text, lineNo, tokens) {
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === ' ' || ch === '\t') { i += 1; continue; }
    if (isDigit(ch)) {
      let j = i;
      let seenDot = false;
      while (j < n && (isDigit(text[j]) || (text[j] === '.' && !seenDot))) {
        if (text[j] === '.') seenDot = true;
        j += 1;
      }
      tokens.push({ kind: seenDot ? 'FLOAT' : 'INT', value: text.slice(i, j), line: lineNo });
      i = j;
      continue;
    }
    if (isAlpha(ch)) {
      let j = i;
      while (j < n && isAlnum(text[j])) j += 1;
      const word = text.slice(i, j);
      tokens.push({ kind: KEYWORDS.has(word) ? word : 'NAME', value: word, line: lineNo });
      i = j;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let j = i + 1;
      let buf = '';
      while (j < n && text[j] !== quote) {
        if (text[j] === '\\' && j + 1 < n) {
          const esc = text[j + 1];
          buf += (esc in ESCAPES) ? ESCAPES[esc] : esc;
          j += 2;
        } else {
          buf += text[j];
          j += 1;
        }
      }
      if (j >= n) throw new LexError(`line ${lineNo}: unterminated string literal`);
      tokens.push({ kind: 'STRING', value: buf, line: lineNo });
      i = j + 1;
      continue;
    }
    let matched = null;
    for (const sym of SYMBOLS) {
      if (text.startsWith(sym, i)) { matched = sym; break; }
    }
    if (matched) {
      tokens.push({ kind: matched, value: matched, line: lineNo });
      i += matched.length;
      continue;
    }
    throw new LexError(`line ${lineNo}: unexpected character ${JSON.stringify(ch)}`);
  }
  tokens.push({ kind: 'NEWLINE', value: '\n', line: lineNo });
}

export function tokenize(source) {
  const tokens = [];
  const indentStack = [0];
  const lines = source.split('\n');

  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const leading = rawLine.slice(0, rawLine.length - rawLine.replace(/^[ \t]+/, '').length);
    if (leading.includes('\t')) {
      throw new LexError(`line ${lineNo}: tabs are not supported for indentation, use spaces`);
    }

    const code = stripComment(rawLine);
    if (code.trim() === '') return; // blank or comment-only line

    const indent = code.length - code.replace(/^ +/, '').length;
    const body = code.slice(indent);

    if (indent > indentStack[indentStack.length - 1]) {
      indentStack.push(indent);
      tokens.push({ kind: 'INDENT', value: indent, line: lineNo });
    }
    while (indent < indentStack[indentStack.length - 1]) {
      indentStack.pop();
      tokens.push({ kind: 'DEDENT', value: indent, line: lineNo });
    }
    if (indent !== indentStack[indentStack.length - 1]) {
      throw new LexError(`line ${lineNo}: inconsistent indentation`);
    }

    tokenizeLineBody(body, lineNo, tokens);
  });

  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push({ kind: 'DEDENT', value: 0, line: lines.length });
  }
  tokens.push({ kind: 'EOF', value: null, line: lines.length });
  return tokens;
}

// =============================================================================
// Parser -- recursive descent, builds a plain-object AST
// =============================================================================

const COMPARE_OPS = new Set(['==', '!=', '<', '>', '<=', '>=']);

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek(offset = 0) {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  at(kind) { return this.peek().kind === kind; }

  advance() {
    const tok = this.tokens[this.pos];
    if (this.pos < this.tokens.length - 1) this.pos += 1;
    return tok;
  }

  expect(kind) {
    const tok = this.peek();
    if (tok.kind !== kind) {
      throw new ParseError(`line ${tok.line}: expected ${kind}, found ${tok.kind} (${JSON.stringify(tok.value)})`);
    }
    return this.advance();
  }

  parseProgram() {
    const body = [];
    while (!this.at('EOF')) body.push(this.parseStatement());
    return { type: 'Program', body };
  }

  parseBlock() {
    this.expect(':');
    this.expect('NEWLINE');
    this.expect('INDENT');
    const stmts = [];
    while (!this.at('DEDENT') && !this.at('EOF')) stmts.push(this.parseStatement());
    this.expect('DEDENT');
    return stmts;
  }

  parseStatement() {
    const tok = this.peek();
    if (tok.kind === 'def') return this.parseFunctionDef();
    if (tok.kind === 'if') return this.parseIf();
    if (tok.kind === 'while') return this.parseWhile();
    if (tok.kind === 'for') return this.parseFor();
    if (tok.kind === 'return') {
      this.advance();
      let value = null;
      if (!this.at('NEWLINE')) value = this.parseExpr();
      this.expect('NEWLINE');
      return { type: 'Return', value, line: tok.line };
    }
    if (tok.kind === 'pass') { this.advance(); this.expect('NEWLINE'); return { type: 'Pass', line: tok.line }; }
    if (tok.kind === 'break') { this.advance(); this.expect('NEWLINE'); return { type: 'Break', line: tok.line }; }
    if (tok.kind === 'continue') { this.advance(); this.expect('NEWLINE'); return { type: 'Continue', line: tok.line }; }

    if (tok.kind === 'NAME' && tok.value === 'print' && this.peek(1).kind === '(') {
      this.advance();
      this.expect('(');
      const args = [];
      if (!this.at(')')) {
        args.push(this.parseExpr());
        while (this.at(',')) { this.advance(); args.push(this.parseExpr()); }
      }
      this.expect(')');
      this.expect('NEWLINE');
      return { type: 'Print', args, line: tok.line };
    }

    if (tok.kind === 'NAME' && this.peek(1).kind === '=') {
      const name = this.advance().value;
      this.advance(); // '='
      const value = this.parseExpr();
      this.expect('NEWLINE');
      return { type: 'Assign', name, value, line: tok.line };
    }

    const expr = this.parseExpr();
    this.expect('NEWLINE');
    return { type: 'ExprStmt', expr, line: tok.line };
  }

  parseFunctionDef() {
    const tok = this.advance(); // 'def'
    const name = this.expect('NAME').value;
    this.expect('(');
    const params = [];
    if (!this.at(')')) {
      params.push(this.expect('NAME').value);
      while (this.at(',')) { this.advance(); params.push(this.expect('NAME').value); }
    }
    this.expect(')');
    const body = this.parseBlock();
    return { type: 'FunctionDef', name, params, body, line: tok.line };
  }

  parseIf() {
    const tok = this.advance(); // 'if'
    const test = this.parseExpr();
    const body = this.parseBlock();
    let orelse = [];
    if (this.at('elif')) orelse = [this.parseIfAsElif()];
    else if (this.at('else')) { this.advance(); orelse = this.parseBlock(); }
    return { type: 'If', test, body, orelse, line: tok.line };
  }

  parseIfAsElif() {
    const tok = this.advance(); // 'elif'
    const test = this.parseExpr();
    const body = this.parseBlock();
    let orelse = [];
    if (this.at('elif')) orelse = [this.parseIfAsElif()];
    else if (this.at('else')) { this.advance(); orelse = this.parseBlock(); }
    return { type: 'If', test, body, orelse, line: tok.line };
  }

  parseWhile() {
    const tok = this.advance(); // 'while'
    const test = this.parseExpr();
    const body = this.parseBlock();
    return { type: 'While', test, body, line: tok.line };
  }

  parseFor() {
    const tok = this.advance(); // 'for'
    const varName = this.expect('NAME').value;
    this.expect('in');
    const rangeTok = this.expect('NAME');
    if (rangeTok.value !== 'range') {
      throw new ParseError(`line ${rangeTok.line}: only 'for x in range(...)' loops are supported`);
    }
    this.expect('(');
    const args = [this.parseExpr()];
    while (this.at(',')) { this.advance(); args.push(this.parseExpr()); }
    this.expect(')');
    let start, stop, step;
    if (args.length === 1) { start = { type: 'Num', value: 0, isFloat: false }; stop = args[0]; step = null; }
    else if (args.length === 2) { [start, stop] = args; step = null; }
    else if (args.length === 3) { [start, stop, step] = args; }
    else throw new ParseError(`line ${tok.line}: range() takes 1 to 3 arguments`);
    const body = this.parseBlock();
    return { type: 'For', var: varName, start, stop, step, body, line: tok.line };
  }

  parseExpr() { return this.parseOr(); }

  parseOr() {
    const left = this.parseAnd();
    const values = [left];
    while (this.at('or')) { this.advance(); values.push(this.parseAnd()); }
    return values.length === 1 ? left : { type: 'BoolOp', op: 'or', values };
  }

  parseAnd() {
    const left = this.parseNot();
    const values = [left];
    while (this.at('and')) { this.advance(); values.push(this.parseNot()); }
    return values.length === 1 ? left : { type: 'BoolOp', op: 'and', values };
  }

  parseNot() {
    if (this.at('not')) { this.advance(); return { type: 'UnaryOp', op: 'not', operand: this.parseNot() }; }
    return this.parseComparison();
  }

  parseComparison() {
    const left = this.parseAdditive();
    if (COMPARE_OPS.has(this.peek().kind)) {
      const op = this.advance().kind;
      const right = this.parseAdditive();
      return { type: 'Compare', op, left, right };
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseTerm();
    while (this.peek().kind === '+' || this.peek().kind === '-') {
      const op = this.advance().kind;
      const right = this.parseTerm();
      left = { type: 'BinOp', op, left, right };
    }
    return left;
  }

  parseTerm() {
    let left = this.parseUnary();
    while (['*', '/', '//', '%'].includes(this.peek().kind)) {
      const op = this.advance().kind;
      const right = this.parseUnary();
      left = { type: 'BinOp', op, left, right };
    }
    return left;
  }

  parseUnary() {
    if (this.peek().kind === '-') { this.advance(); return { type: 'UnaryOp', op: '-', operand: this.parseUnary() }; }
    return this.parsePower();
  }

  parsePower() {
    const left = this.parseAtom();
    if (this.at('**')) {
      this.advance();
      const right = this.parseUnary(); // right-associative
      return { type: 'BinOp', op: '**', left, right };
    }
    return left;
  }

  parseAtom() {
    const tok = this.peek();
    if (tok.kind === 'INT') { this.advance(); return { type: 'Num', value: parseInt(tok.value, 10), isFloat: false }; }
    if (tok.kind === 'FLOAT') { this.advance(); return { type: 'Num', value: parseFloat(tok.value), isFloat: true }; }
    if (tok.kind === 'STRING') { this.advance(); return { type: 'Str', value: tok.value }; }
    if (tok.kind === 'True') { this.advance(); return { type: 'Bool', value: true }; }
    if (tok.kind === 'False') { this.advance(); return { type: 'Bool', value: false }; }
    if (tok.kind === 'None') { this.advance(); return { type: 'NoneLit' }; }
    if (tok.kind === '(') {
      this.advance();
      const expr = this.parseExpr();
      this.expect(')');
      return expr;
    }
    if (tok.kind === 'NAME') {
      const name = this.advance().value;
      if (this.at('(')) {
        this.advance();
        const args = [];
        if (!this.at(')')) {
          args.push(this.parseExpr());
          while (this.at(',')) { this.advance(); args.push(this.parseExpr()); }
        }
        this.expect(')');
        return { type: 'Call', name, args, line: tok.line };
      }
      return { type: 'Name', id: name };
    }
    throw new ParseError(`line ${tok.line}: unexpected token ${tok.kind} (${JSON.stringify(tok.value)})`);
  }
}

export function parse(source) {
  const tokens = tokenize(source);
  return new Parser(tokens).parseProgram();
}

// =============================================================================
// Type inference
// =============================================================================

function mergeType(current, newType, line, what) {
  if (newType === null) return current;
  if (current === null) return newType;
  if (current === newType) return current;
  if ((current === 'int' || current === 'float') && (newType === 'int' || newType === 'float')) return 'float';
  throw new TypeCheckError(`line ${line}: ${what} used as both ${JSON.stringify(current)} and ${JSON.stringify(newType)} -- `
    + `this compiler requires one static type per variable/parameter`);
}

class TypeChecker {
  constructor(program) {
    this.functions = {};
    this.program = program;
    this.strictCalls = false;
  }

  run() {
    const funcDefs = this.program.body.filter((s) => s.type === 'FunctionDef');
    for (const f of funcDefs) {
      this.functions[f.name] = {
        params: f.params,
        paramTypes: f.params.map(() => null),
        returnType: null,
        node: f
      };
    }

    this.scanCallsForParamTypes(this.program.body);
    for (const f of funcDefs) {
      const info = this.functions[f.name];
      info.paramTypes = info.paramTypes.map((t) => t || 'int');
    }

    const mainBody = this.program.body.filter((s) => s.type !== 'FunctionDef');
    let globalScope = {};

    for (let pass = 0; pass < 2; pass += 1) {
      this.strictCalls = false;
      for (const f of funcDefs) {
        const info = this.functions[f.name];
        const scope = {};
        info.params.forEach((name, i) => { scope[name] = info.paramTypes[i]; });
        info.returnType = this.checkBlock(f.body, scope);
        info.scope = scope;
      }
    }

    this.strictCalls = true;
    for (const f of funcDefs) {
      const info = this.functions[f.name];
      const scope = {};
      info.params.forEach((name, i) => { scope[name] = info.paramTypes[i]; });
      info.returnType = this.checkBlock(f.body, scope);
      info.scope = scope;
    }
    globalScope = {};
    this.checkBlock(mainBody, globalScope);

    return { functions: this.functions, globalScope, mainBody, funcDefs };
  }

  scanCallsForParamTypes(stmts) {
    for (const s of stmts) this.scanCallsInStmt(s);
  }

  scanCallsInStmt(s) {
    const t = s.type;
    if (t === 'FunctionDef') this.scanCallsForParamTypes(s.body);
    else if (t === 'If') {
      this.scanExprCalls(s.test);
      this.scanCallsForParamTypes(s.body);
      this.scanCallsForParamTypes(s.orelse);
    } else if (t === 'While') {
      this.scanExprCalls(s.test);
      this.scanCallsForParamTypes(s.body);
    } else if (t === 'For') {
      for (const e of [s.start, s.stop, s.step]) if (e) this.scanExprCalls(e);
      this.scanCallsForParamTypes(s.body);
    } else if (t === 'Assign') this.scanExprCalls(s.value);
    else if (t === 'Return') { if (s.value) this.scanExprCalls(s.value); }
    else if (t === 'Print') { for (const a of s.args) this.scanExprCalls(a); }
    else if (t === 'ExprStmt') this.scanExprCalls(s.expr);
  }

  scanExprCalls(e) {
    const t = e.type;
    if (t === 'Call' && this.functions[e.name]) {
      const info = this.functions[e.name];
      if (e.args.length !== info.params.length) {
        throw new TypeCheckError(`line ${e.line || '?'}: ${e.name}() called with ${e.args.length} `
          + `arguments, expected ${info.params.length}`);
      }
      e.args.forEach((arg, i) => {
        const argType = this.literalTypeGuess(arg);
        if (argType) {
          info.paramTypes[i] = mergeType(info.paramTypes[i], argType, e.line || '?',
            `parameter ${JSON.stringify(info.params[i])} of ${e.name}()`);
        }
      });
      for (const a of e.args) this.scanExprCalls(a);
    } else if (t === 'Call') {
      for (const a of e.args) this.scanExprCalls(a);
    } else if (t === 'BinOp') { this.scanExprCalls(e.left); this.scanExprCalls(e.right); }
    else if (t === 'UnaryOp') this.scanExprCalls(e.operand);
    else if (t === 'Compare') { this.scanExprCalls(e.left); this.scanExprCalls(e.right); }
    else if (t === 'BoolOp') { for (const v of e.values) this.scanExprCalls(v); }
  }

  literalTypeGuess(e) {
    if (e.type === 'Num') return e.isFloat ? 'float' : 'int';
    if (e.type === 'Str') return 'string';
    if (e.type === 'Bool') return 'bool';
    return null;
  }

  checkBlock(stmts, scope) {
    let returnType = null;
    for (const s of stmts) {
      const t = s.type;
      if (t === 'Assign') {
        const valueType = this.inferExpr(s.value, scope);
        const existing = Object.prototype.hasOwnProperty.call(scope, s.name) ? scope[s.name] : null;
        scope[s.name] = mergeType(existing, valueType, s.line, `variable ${JSON.stringify(s.name)}`);
      } else if (t === 'If') {
        this.inferExpr(s.test, scope);
        const r1 = this.checkBlock(s.body, scope);
        const r2 = this.checkBlock(s.orelse, scope);
        if (r1) returnType = mergeType(returnType, r1, s.line, 'return type');
        if (r2) returnType = mergeType(returnType, r2, s.line, 'return type');
      } else if (t === 'While') {
        this.inferExpr(s.test, scope);
        const r = this.checkBlock(s.body, scope);
        if (r) returnType = mergeType(returnType, r, s.line, 'return type');
      } else if (t === 'For') {
        for (const e of [s.start, s.stop, s.step]) if (e) this.inferExpr(e, scope);
        const existing = Object.prototype.hasOwnProperty.call(scope, s.var) ? scope[s.var] : null;
        scope[s.var] = mergeType(existing, 'int', s.line, `loop variable ${JSON.stringify(s.var)}`);
        const r = this.checkBlock(s.body, scope);
        if (r) returnType = mergeType(returnType, r, s.line, 'return type');
      } else if (t === 'Return') {
        if (s.value !== null) {
          const rt = this.inferExpr(s.value, scope);
          returnType = mergeType(returnType, rt, s.line, 'return type');
        }
      } else if (t === 'Print') {
        for (const a of s.args) this.inferExpr(a, scope);
      } else if (t === 'ExprStmt') {
        this.inferExpr(s.expr, scope);
      } else if (t === 'Pass' || t === 'Break' || t === 'Continue') {
        // no-op
      } else if (t === 'FunctionDef') {
        throw new TypeCheckError(`line ${s.line}: nested function definitions are not supported`);
      } else {
        throw new TypeCheckError(`unsupported statement type ${JSON.stringify(t)}`);
      }
    }
    return returnType;
  }

  inferExpr(e, scope) {
    const t = e.type;
    if (t === 'Num') return e.isFloat ? 'float' : 'int';
    if (t === 'Str') return 'string';
    if (t === 'Bool') return 'bool';
    if (t === 'NoneLit') {
      throw new TypeCheckError("'None' is not supported by this compiler -- every value needs a "
        + "concrete int/float/string/bool type, since the target languages don't have Python's dynamic None");
    }
    if (t === 'Name') {
      if (!Object.prototype.hasOwnProperty.call(scope, e.id)) {
        throw new TypeCheckError(`name ${JSON.stringify(e.id)} used before assignment`);
      }
      return scope[e.id];
    }
    if (t === 'UnaryOp') {
      const operandType = this.inferExpr(e.operand, scope);
      return e.op === 'not' ? 'bool' : operandType;
    }
    if (t === 'BinOp') {
      const left = this.inferExpr(e.left, scope);
      const right = this.inferExpr(e.right, scope);
      if (e.op === '+' && (left === 'string' || right === 'string')) {
        if (left !== 'string' || right !== 'string') {
          throw new TypeCheckError("cannot mix a string with a number in '+' -- this compiler has no implicit str()");
        }
        return 'string';
      }
      if (left === 'string' || right === 'string') {
        throw new TypeCheckError(`operator ${e.op} is not supported on strings`);
      }
      if (e.op === '/') return 'float';
      if (e.op === '**') return 'float';
      if (left === 'float' || right === 'float') return 'float';
      return 'int';
    }
    if (t === 'Compare') { this.inferExpr(e.left, scope); this.inferExpr(e.right, scope); return 'bool'; }
    if (t === 'BoolOp') { for (const v of e.values) this.inferExpr(v, scope); return 'bool'; }
    if (t === 'Call') {
      if (!this.functions[e.name]) {
        throw new TypeCheckError(`line ${e.line || '?'}: call to unknown function ${JSON.stringify(e.name)} `
          + `(only calls to functions defined in this file are supported)`);
      }
      const info = this.functions[e.name];
      for (const a of e.args) this.inferExpr(a, scope);
      if (this.strictCalls) return info.returnType || 'void';
      return info.returnType; // may be null mid-warm-up; mergeType treats that as "no info yet"
    }
    throw new TypeCheckError(`unsupported expression type ${JSON.stringify(t)}`);
  }
}

export function checkTypes(program) {
  return new TypeChecker(program).run();
}

// =============================================================================
// Code generation -- four independent backends sharing one expression emitter
// =============================================================================

const TYPE_NAMES = {
  c: { int: 'int', float: 'double', string: 'const char *', bool: 'bool', void: 'void' },
  java: { int: 'int', float: 'double', string: 'String', bool: 'boolean', void: 'void' },
  go: { int: 'int', float: 'float64', string: 'string', bool: 'bool', void: '' }
};
const ZERO_VALUES = { int: '0', float: '0.0', string: '""', bool: 'false' };

function exprType(e, scope, functions) {
  const t = e.type;
  if (t === 'Num') return e.isFloat ? 'float' : 'int';
  if (t === 'Str') return 'string';
  if (t === 'Bool') return 'bool';
  if (t === 'NoneLit') return 'none';
  if (t === 'Name') return scope[e.id];
  if (t === 'UnaryOp') return e.op === 'not' ? 'bool' : exprType(e.operand, scope, functions);
  if (t === 'BinOp') {
    const left = exprType(e.left, scope, functions);
    const right = exprType(e.right, scope, functions);
    if (e.op === '+' && left === 'string') return 'string';
    if (e.op === '/' || e.op === '**') return 'float';
    if (left === 'float' || right === 'float') return 'float';
    return 'int';
  }
  if (t === 'Compare' || t === 'BoolOp') return 'bool';
  if (t === 'Call') return functions[e.name].returnType || 'void';
  throw new CodegenError(`unsupported expression type ${JSON.stringify(t)}`);
}

function pyStringToLiteral(value) {
  const out = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
  return `"${out}"`;
}

function formatFloat(value) {
  if (value === Math.trunc(value)) return value.toFixed(1);
  return String(value);
}

function magicTerm(pythonTerm, lang) {
  const row = MAGIC_TERMS[pythonTerm];
  if (!row) throw new CodegenError(`no magic_terms entry for ${JSON.stringify(pythonTerm)}`);
  return row[lang];
}

function emitExpr(e, lang, scope, functions) {
  const t = e.type;
  if (t === 'Num') return e.isFloat ? formatFloat(e.value) : String(e.value);
  if (t === 'Str') return pyStringToLiteral(e.value);
  if (t === 'Bool') return e.value ? 'true' : 'false';
  if (t === 'NoneLit') return magicTerm('None', lang);
  if (t === 'Name') return e.id;
  if (t === 'UnaryOp') {
    const operand = emitExpr(e.operand, lang, scope, functions);
    return e.op === 'not' ? `${magicTerm('not', lang)}(${operand})` : `(-${operand})`;
  }
  if (t === 'BinOp') return emitBinop(e, lang, scope, functions);
  if (t === 'Compare') return emitCompare(e, lang, scope, functions);
  if (t === 'BoolOp') {
    const joiner = ` ${magicTerm(e.op, lang)} `;
    const parts = e.values.map((v) => emitExpr(v, lang, scope, functions));
    return '(' + parts.join(joiner) + ')';
  }
  if (t === 'Call') {
    const args = e.args.map((a) => emitExpr(a, lang, scope, functions)).join(', ');
    return `${e.name}(${args})`;
  }
  throw new CodegenError(`unsupported expression type ${JSON.stringify(t)}`);
}

function emitBinop(e, lang, scope, functions) {
  const leftType = exprType(e.left, scope, functions);
  const rightType = exprType(e.right, scope, functions);
  const l = emitExpr(e.left, lang, scope, functions);
  const r = emitExpr(e.right, lang, scope, functions);
  const op = e.op;

  if (op === '+') {
    if (leftType === 'string' && lang === 'c') {
      throw new CodegenError('the C target does not support string concatenation (C strings are manual, '
        + 'fixed char*/const char* -- try another target for this line)');
    }
    return `(${l} + ${r})`;
  }
  if (op === '-') return `(${l} - ${r})`;
  if (op === '*') return `(${l} * ${r})`;
  if (op === '/') {
    if (lang === 'js') return `(${l} / ${r})`;
    if (lang === 'go') return `(float64(${l}) / float64(${r}))`;
    return `((double)${l} / (double)${r})`;
  }
  if (op === '//') {
    if (leftType === 'float' || rightType === 'float') {
      if (lang === 'js') return `Math.floor(${l} / ${r})`;
      if (lang === 'go') return `math.Floor(${l} / ${r})`;
      if (lang === 'java') return `Math.floor(${l} / ${r})`;
      return `floor((double)${l} / (double)${r})`;
    }
    // Integer floor division: C/Java/Go's `/` truncates toward zero, Python floors toward
    // negative infinity -- these only disagree when the result is negative and inexact, a
    // documented, deliberate simplification (see the page's "known limits" panel).
    if (lang === 'js') return `Math.floor(${l} / ${r})`;
    return `(${l} / ${r})`;
  }
  if (op === '%') {
    // Python's % takes the sign of the divisor; C/Java/Go/JS take the sign of the dividend.
    // Corrected with the standard "((a % b) + b) % b" pattern so behavior genuinely matches
    // Python instead of merely looking similar.
    if (leftType === 'float' || rightType === 'float') {
      if (lang === 'c') return `fmod(fmod((double)${l}, (double)${r}) + (double)${r}, (double)${r})`;
      if (lang === 'go') return `math.Mod(math.Mod(${l}, ${r}) + ${r}, ${r})`;
      return `(((${l} % ${r}) + ${r}) % ${r})`; // Java/JS % already works on floats
    }
    return `(((${l} % ${r}) + ${r}) % ${r})`;
  }
  if (op === '**') {
    if (lang === 'js' || lang === 'java') return `Math.pow(${l}, ${r})`;
    if (lang === 'go') return `math.Pow(float64(${l}), float64(${r}))`;
    return `pow((double)${l}, (double)${r})`;
  }
  throw new CodegenError(`unsupported operator ${JSON.stringify(op)}`);
}

function emitCompare(e, lang, scope, functions) {
  const leftType = exprType(e.left, scope, functions);
  const rightType = exprType(e.right, scope, functions);
  const l = emitExpr(e.left, lang, scope, functions);
  const r = emitExpr(e.right, lang, scope, functions);
  const op = e.op;
  const isStringCompare = leftType === 'string' && rightType === 'string';

  if (isStringCompare && lang === 'java' && (op === '==' || op === '!=')) {
    const eq = `${l}.equals(${r})`;
    return op === '==' ? eq : `!(${eq})`;
  }
  if (isStringCompare && lang === 'c') {
    if (op !== '==' && op !== '!=') throw new CodegenError('the C target only supports == and != between strings');
    const cmp = `strcmp(${l}, ${r}) == 0`;
    return op === '==' ? cmp : `!(${cmp})`;
  }
  return `(${l} ${op} ${r})`;
}

function emitPrint(args, lang, scope, functions, indent) {
  if (lang === 'js') {
    const parts = args.map((a) => emitExpr(a, 'js', scope, functions));
    return `${indent}console.log(${parts.join(', ')});`;
  }
  if (lang === 'go') {
    const parts = args.map((a) => emitExpr(a, 'go', scope, functions));
    return `${indent}fmt.Println(${parts.join(', ')})`;
  }
  if (lang === 'java') {
    if (args.length === 0) return `${indent}System.out.println();`;
    const parts = args.map((a) => emitExpr(a, 'java', scope, functions));
    return `${indent}System.out.println("" + ${parts.join(' + " " + ')});`;
  }
  if (lang === 'c') {
    const fmtParts = [];
    const cArgs = [];
    for (const a of args) {
      const t = exprType(a, scope, functions);
      let val = emitExpr(a, 'c', scope, functions);
      if (t === 'int') fmtParts.push('%d');
      else if (t === 'float') fmtParts.push('%f');
      else if (t === 'bool') { fmtParts.push('%s'); val = `(${val} ? "true" : "false")`; }
      else fmtParts.push('%s');
      cArgs.push(val);
    }
    const fmt = fmtParts.join(' ') + '\\n';
    if (cArgs.length) return `${indent}printf("${fmt}", ${cArgs.join(', ')});`;
    return `${indent}printf("\\n");`;
  }
  throw new CodegenError(`unsupported language ${JSON.stringify(lang)}`);
}

function emitDeclarations(scope, exclude, lang, indent) {
  const lines = [];
  for (const name of Object.keys(scope)) {
    if (exclude.has(name)) continue;
    const vtype = scope[name];
    const zero = ZERO_VALUES[vtype];
    if (lang === 'js') lines.push(`${indent}let ${name} = ${zero};`);
    else if (lang === 'go') lines.push(`${indent}var ${name} ${TYPE_NAMES.go[vtype]} = ${zero}`);
    else lines.push(`${indent}${TYPE_NAMES[lang][vtype]} ${name} = ${zero};`);
  }
  return lines;
}

function emitAssign(s, lang, scope, functions, indent) {
  if (lang === 'c' && scope[s.name] === 'string' && s.value.type !== 'Str') {
    throw new CodegenError(`line ${s.line}: the C target only supports assigning string LITERALS `
      + `to a variable (no string expressions/concatenation)`);
  }
  const val = emitExpr(s.value, lang, scope, functions);
  if (lang === 'go') return `${indent}${s.name} = ${val}`;
  return `${indent}${s.name} = ${val};`;
}

function emitBlock(stmts, lang, scope, functions, indentLevel) {
  const indent = '    '.repeat(indentLevel);
  const lines = [];
  for (const s of stmts) {
    const t = s.type;
    if (t === 'Assign') {
      lines.push(emitAssign(s, lang, scope, functions, indent));
    } else if (t === 'If') {
      lines.push(...emitIfChain(s, lang, scope, functions, indentLevel));
    } else if (t === 'While') {
      const cond = emitExpr(s.test, lang, scope, functions);
      const header = lang === 'go' ? `for ${cond} {` : `while (${cond}) {`;
      lines.push(`${indent}${header}`);
      lines.push(...emitBlock(s.body, lang, scope, functions, indentLevel + 1));
      lines.push(`${indent}}`);
    } else if (t === 'For') {
      lines.push(...emitFor(s, lang, scope, functions, indentLevel));
    } else if (t === 'Return') {
      if (s.value === null) {
        lines.push(lang === 'go' ? `${indent}return` : `${indent}return;`);
      } else {
        const val = emitExpr(s.value, lang, scope, functions);
        lines.push(lang === 'go' ? `${indent}return ${val}` : `${indent}return ${val};`);
      }
    } else if (t === 'Print') {
      lines.push(emitPrint(s.args, lang, scope, functions, indent));
    } else if (t === 'ExprStmt') {
      const val = emitExpr(s.expr, lang, scope, functions);
      lines.push(lang === 'go' ? `${indent}${val}` : `${indent}${val};`);
    } else if (t === 'Pass') {
      // no-op
    } else if (t === 'Break') {
      lines.push(lang === 'go' ? `${indent}break` : `${indent}break;`);
    } else if (t === 'Continue') {
      lines.push(lang === 'go' ? `${indent}continue` : `${indent}continue;`);
    } else {
      throw new CodegenError(`unsupported statement type ${JSON.stringify(t)}`);
    }
  }
  return lines;
}

function emitIfChain(node, lang, scope, functions, indentLevel) {
  const indent = '    '.repeat(indentLevel);
  const lines = [`${indent}if (${emitExpr(node.test, lang, scope, functions)}) {`];
  lines.push(...emitBlock(node.body, lang, scope, functions, indentLevel + 1));
  let orelse = node.orelse;
  while (orelse.length === 1 && orelse[0].type === 'If') {
    const elifNode = orelse[0];
    lines.push(`${indent}} else if (${emitExpr(elifNode.test, lang, scope, functions)}) {`);
    lines.push(...emitBlock(elifNode.body, lang, scope, functions, indentLevel + 1));
    orelse = elifNode.orelse;
  }
  if (orelse.length) {
    lines.push(`${indent}} else {`);
    lines.push(...emitBlock(orelse, lang, scope, functions, indentLevel + 1));
  }
  lines.push(`${indent}}`);
  return lines;
}

function emitFor(s, lang, scope, functions, indentLevel) {
  const indent = '    '.repeat(indentLevel);
  const varName = s.var;
  const start = emitExpr(s.start, lang, scope, functions);
  const stop = emitExpr(s.stop, lang, scope, functions);
  const step = s.step ? emitExpr(s.step, lang, scope, functions) : '1';
  const negativeStep = s.step !== null && s.step.type === 'Num' && s.step.value < 0;
  const cmpOp = negativeStep ? '>' : '<';

  const header = lang === 'go'
    ? `for ${varName} = ${start}; ${varName} ${cmpOp} ${stop}; ${varName} += ${step} {`
    : `for (${varName} = ${start}; ${varName} ${cmpOp} ${stop}; ${varName} += ${step}) {`;
  const lines = [`${indent}${header}`];
  lines.push(...emitBlock(s.body, lang, scope, functions, indentLevel + 1));
  lines.push(`${indent}}`);
  return lines;
}

function programUsesMath(typed, lang) {
  if (lang !== 'c' && lang !== 'go') return false;
  let found = false;

  function walkExpr(e, scope) {
    const t = e.type;
    if (t === 'BinOp') {
      walkExpr(e.left, scope);
      walkExpr(e.right, scope);
      if (e.op === '**') found = true;
      else if (e.op === '//' || e.op === '%') {
        const lt = exprType(e.left, scope, typed.functions);
        const rt = exprType(e.right, scope, typed.functions);
        if (lt === 'float' || rt === 'float') found = true;
      }
    } else if (t === 'UnaryOp') walkExpr(e.operand, scope);
    else if (t === 'Compare') { walkExpr(e.left, scope); walkExpr(e.right, scope); }
    else if (t === 'BoolOp') { for (const v of e.values) walkExpr(v, scope); }
    else if (t === 'Call') { for (const a of e.args) walkExpr(a, scope); }
  }

  function walkStmts(stmts, scope) {
    for (const s of stmts) {
      const t = s.type;
      if (t === 'Assign') walkExpr(s.value, scope);
      else if (t === 'If') { walkExpr(s.test, scope); walkStmts(s.body, scope); walkStmts(s.orelse, scope); }
      else if (t === 'While') { walkExpr(s.test, scope); walkStmts(s.body, scope); }
      else if (t === 'For') { for (const e of [s.start, s.stop, s.step]) if (e) walkExpr(e, scope); walkStmts(s.body, scope); }
      else if (t === 'Return') { if (s.value !== null) walkExpr(s.value, scope); }
      else if (t === 'Print') { for (const a of s.args) walkExpr(a, scope); }
      else if (t === 'ExprStmt') walkExpr(s.expr, scope);
    }
  }

  for (const f of typed.funcDefs) walkStmts(f.body, typed.functions[f.name].scope);
  walkStmts(typed.mainBody, typed.globalScope);
  return found;
}

function programUsesPrint(typed) {
  function anyPrint(stmts) {
    for (const s of stmts) {
      const t = s.type;
      if (t === 'Print') return true;
      if (t === 'If' && (anyPrint(s.body) || anyPrint(s.orelse))) return true;
      if ((t === 'While' || t === 'For') && anyPrint(s.body)) return true;
    }
    return false;
  }
  for (const f of typed.funcDefs) if (anyPrint(f.body)) return true;
  return anyPrint(typed.mainBody);
}

function emitFunction(f, info, lang, functions) {
  const name = f.name;
  const params = info.params;
  const paramTypes = info.paramTypes;
  const returnType = info.returnType || 'void';
  const scope = info.scope;
  let header;
  const baseLevel = 0; // emitProgram adds the one class-level indent for Java

  if (lang === 'js') {
    header = `function ${name}(${params.join(', ')}) {`;
  } else if (lang === 'go') {
    const paramsStr = params.map((p, i) => `${p} ${TYPE_NAMES.go[paramTypes[i]]}`).join(', ');
    const ret = returnType === 'void' ? '' : ` ${TYPE_NAMES.go[returnType]}`;
    header = `func ${name}(${paramsStr})${ret} {`;
  } else if (lang === 'java') {
    const paramsStr = params.map((p, i) => `${TYPE_NAMES.java[paramTypes[i]]} ${p}`).join(', ');
    header = `static ${TYPE_NAMES.java[returnType]} ${name}(${paramsStr}) {`;
  } else if (lang === 'c') {
    const paramsStr = params.map((p, i) => `${TYPE_NAMES.c[paramTypes[i]]} ${p}`).join(', ') || 'void';
    header = `${TYPE_NAMES.c[returnType]} ${name}(${paramsStr}) {`;
  } else {
    throw new CodegenError(`unsupported language ${JSON.stringify(lang)}`);
  }

  const indent = '    '.repeat(baseLevel);
  const lines = [`${indent}${header}`];
  const declLines = emitDeclarations(scope, new Set(params), lang, '    '.repeat(baseLevel + 1));
  lines.push(...declLines);
  if (declLines.length) lines.push('');
  lines.push(...emitBlock(f.body, lang, scope, functions, baseLevel + 1));
  lines.push(`${indent}}`);
  return lines;
}

function emitCPrototype(f, info) {
  const paramsStr = info.paramTypes.map((t) => TYPE_NAMES.c[t]).join(', ') || 'void';
  const ret = TYPE_NAMES.c[info.returnType || 'void'];
  return `${ret} ${f.name}(${paramsStr});`;
}

function emitProgram(typed, lang) {
  const functions = typed.functions;

  const funcLines = [];
  for (const f of typed.funcDefs) {
    funcLines.push(...emitFunction(f, functions[f.name], lang, functions));
    funcLines.push('');
  }

  // JS has no wrapping main() -- top-level statements sit at column 0.
  // Java's main() sits inside a class AND a method -- two levels of nesting.
  // C/Go wrap top-level statements in one function (main) -- one level.
  let mainLevel;
  if (lang === 'js') mainLevel = 0;
  else if (lang === 'java') mainLevel = 2;
  else mainLevel = 1;

  const mainLines = emitDeclarations(typed.globalScope, new Set(), lang, '    '.repeat(mainLevel));
  if (mainLines.length) mainLines.push('');
  mainLines.push(...emitBlock(typed.mainBody, lang, typed.globalScope, functions, mainLevel));

  if (lang === 'js') {
    return (funcLines.concat(mainLines).join('\n')).replace(/\s+$/, '') + '\n';
  }

  if (lang === 'go') {
    const imports = [
      ...(programUsesPrint(typed) ? ['"fmt"'] : []),
      ...(programUsesMath(typed, 'go') ? ['"math"'] : [])
    ];
    const header = imports.length
      ? ['package main', '', 'import ('].concat(imports.map((i) => `\t${i}`), [')', ''])
      : ['package main', ''];
    const body = ['func main() {'].concat(mainLines, ['}']);
    return (header.concat(funcLines, body).join('\n')).replace(/\s+$/, '') + '\n';
  }

  if (lang === 'java') {
    const indentedFuncs = funcLines.map((l) => (l ? '    ' + l : l));
    const header = ['public class Main {', '    public static void main(String[] args) {'];
    const footer = ['    }', ''].concat(indentedFuncs, ['}']);
    return (header.concat(mainLines, footer).join('\n')).replace(/\s+$/, '') + '\n';
  }

  if (lang === 'c') {
    const includes = ['#include <stdio.h>', '#include <stdbool.h>', '#include <string.h>'];
    if (programUsesMath(typed, 'c')) includes.push('#include <math.h>');
    const prototypes = typed.funcDefs.map((f) => emitCPrototype(f, functions[f.name]));
    const header = includes.concat(['']).concat(prototypes, prototypes.length ? [''] : []);
    const mainHeader = ['int main(void) {'];
    const mainFooter = ['    return 0;', '}'];
    return (header.concat(funcLines, mainHeader, mainLines, mainFooter).join('\n')).replace(/\s+$/, '') + '\n';
  }

  throw new CodegenError(`unsupported language ${JSON.stringify(lang)}`);
}

export const LANGUAGE_NAMES = { js: 'JavaScript', c: 'C', java: 'Java', go: 'Go' };

/** Exact-match cache: if the WHOLE trimmed source matches a magic_lines
 *  entry, return its pre-compiled output for every requested target
 *  without running the lexer/parser/type-checker/code-generator at all.
 *  Returns null on a miss (the normal, unbounded case). */
function magicLineLookup(source, targets) {
  const key = source.replace(/^\n+|\n+$/g, '');
  const row = MAGIC_LINES[key];
  if (!row) return null;
  if (!targets.every((t) => t in row)) return null;
  const result = {};
  for (const t of targets) result[t] = row[t] + '\n';
  return result;
}

/** End-to-end: a magic_lines cache check first, then -- on a miss --
 *  source -> tokens -> AST -> type-checked program -> one generated
 *  source string per requested target. Throws LexError, ParseError,
 *  TypeCheckError, or CodegenError with a line-numbered message on
 *  anything outside the supported subset. Returns { outputs, fromCache }. */
export function compileSource(source, targets) {
  const cached = magicLineLookup(source, targets);
  if (cached !== null) return { outputs: cached, fromCache: true };
  const program = parse(source);
  const typed = checkTypes(program);
  const outputs = {};
  for (const target of targets) outputs[target] = emitProgram(typed, target);
  return { outputs, fromCache: false };
}
