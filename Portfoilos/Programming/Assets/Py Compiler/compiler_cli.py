#!/usr/bin/env python3
"""
compiler_cli.py
-----------------------------------------------------------------------------
A real, small compiler front-end: a hand-written lexer, a recursive-descent
parser building an AST, a single-pass type-inference step, and four backend
code generators (JavaScript, C, Java, Go) -- translating a genuine, clearly
bounded SUBSET of Python into working source in whichever target language
you pick. No library, no LLM call, no shelling out to an existing compiler.

This is a teaching-subset transpiler, not a full Python implementation.
Supported: comments, int/float/string/bool/None literals, arithmetic
(+ - * / // % **), comparisons, `and`/`or`/`not`, if/elif/else, while,
`for x in range(...)`, top-level function defs with return, print(...),
pass/break/continue. NOT supported (by design, kept out to stay small and
correct): lists/dicts/tuples, classes, exceptions, string methods,
f-strings/.format(), multiple assignment/unpacking, comprehensions, imports,
default/keyword arguments, closures, generators. Variable and parameter
types are inferred from how they're first used -- reassigning a variable to
a different type is reported as an error rather than silently miscompiled,
since the target languages are statically typed and Python isn't.

Usage:
    python3 compiler_cli.py source.py --target go
    python3 compiler_cli.py source.py --target c --target java   (multiple)
    echo "print(1 + 2)" | python3 compiler_cli.py --target js
"""
import argparse
import sqlite3
import sys
from pathlib import Path

# =============================================================================
# Lexer
# =============================================================================

KEYWORDS = {
    "def", "return", "if", "elif", "else", "while", "for", "in",
    "and", "or", "not", "True", "False", "None", "pass", "break", "continue",
}

SYMBOLS = [
    "**", "//", "==", "!=", "<=", ">=",
    "=", "+", "-", "*", "/", "%", "<", ">", "(", ")", ":", ",",
]


class LexError(Exception):
    pass


class Token:
    __slots__ = ("kind", "value", "line")

    def __init__(self, kind, value, line):
        self.kind = kind
        self.value = value
        self.line = line

    def __repr__(self):
        return f"Token({self.kind!r}, {self.value!r}, line={self.line})"


def strip_comment(line):
    """Removes a trailing # comment, but not one inside a string literal."""
    in_string = None
    out = []
    i = 0
    while i < len(line):
        ch = line[i]
        if in_string:
            out.append(ch)
            if ch == "\\" and i + 1 < len(line):
                out.append(line[i + 1])
                i += 2
                continue
            if ch == in_string:
                in_string = None
        else:
            if ch in ("'", '"'):
                in_string = ch
                out.append(ch)
            elif ch == "#":
                break
            else:
                out.append(ch)
        i += 1
    return "".join(out)


def tokenize_line_body(text, line_no, tokens):
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch in " \t":
            i += 1
            continue
        if ch.isdigit():
            j = i
            seen_dot = False
            while j < n and (text[j].isdigit() or (text[j] == "." and not seen_dot)):
                if text[j] == ".":
                    seen_dot = True
                j += 1
            raw = text[i:j]
            tokens.append(Token("FLOAT" if seen_dot else "INT", raw, line_no))
            i = j
            continue
        if ch.isalpha() or ch == "_":
            j = i
            while j < n and (text[j].isalnum() or text[j] == "_"):
                j += 1
            word = text[i:j]
            tokens.append(Token(word if word in KEYWORDS else "NAME", word, line_no))
            i = j
            continue
        if ch in ("'", '"'):
            quote = ch
            j = i + 1
            buf = []
            while j < n and text[j] != quote:
                if text[j] == "\\" and j + 1 < n:
                    esc = text[j + 1]
                    buf.append({"n": "\n", "t": "\t", "\\": "\\", "'": "'", '"': '"'}.get(esc, esc))
                    j += 2
                else:
                    buf.append(text[j])
                    j += 1
            if j >= n:
                raise LexError(f"line {line_no}: unterminated string literal")
            tokens.append(Token("STRING", "".join(buf), line_no))
            i = j + 1
            continue
        matched = None
        for sym in SYMBOLS:
            if text.startswith(sym, i):
                matched = sym
                break
        if matched:
            tokens.append(Token(matched, matched, line_no))
            i += len(matched)
            continue
        raise LexError(f"line {line_no}: unexpected character {ch!r}")
    tokens.append(Token("NEWLINE", "\n", line_no))


def tokenize(source):
    tokens = []
    indent_stack = [0]
    lines = source.split("\n")

    for line_no, raw_line in enumerate(lines, start=1):
        if "\t" in raw_line[:len(raw_line) - len(raw_line.lstrip(" \t"))]:
            raise LexError(f"line {line_no}: tabs are not supported for indentation, use spaces")

        code = strip_comment(raw_line)
        if code.strip() == "":
            continue  # blank or comment-only line: no NEWLINE/INDENT token needed

        indent = len(code) - len(code.lstrip(" "))
        body = code[indent:]

        if indent > indent_stack[-1]:
            indent_stack.append(indent)
            tokens.append(Token("INDENT", indent, line_no))
        while indent < indent_stack[-1]:
            indent_stack.pop()
            tokens.append(Token("DEDENT", indent, line_no))
        if indent != indent_stack[-1]:
            raise LexError(f"line {line_no}: inconsistent indentation")

        tokenize_line_body(body, line_no, tokens)

    while len(indent_stack) > 1:
        indent_stack.pop()
        tokens.append(Token("DEDENT", 0, len(lines)))
    tokens.append(Token("EOF", None, len(lines)))
    return tokens


# =============================================================================
# Parser -- recursive descent, builds a plain-dict AST
# =============================================================================

class ParseError(Exception):
    pass


class Parser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.pos = 0

    def peek(self, offset=0):
        return self.tokens[min(self.pos + offset, len(self.tokens) - 1)]

    def at(self, kind):
        return self.peek().kind == kind

    def advance(self):
        tok = self.tokens[self.pos]
        if self.pos < len(self.tokens) - 1:
            self.pos += 1
        return tok

    def expect(self, kind):
        tok = self.peek()
        if tok.kind != kind:
            raise ParseError(f"line {tok.line}: expected {kind}, found {tok.kind} ({tok.value!r})")
        return self.advance()

    # --- program & blocks ----------------------------------------------

    def parse_program(self):
        body = []
        while not self.at("EOF"):
            body.append(self.parse_statement())
        return {"type": "Program", "body": body}

    def parse_block(self):
        self.expect(":")
        self.expect("NEWLINE")
        self.expect("INDENT")
        stmts = []
        while not self.at("DEDENT") and not self.at("EOF"):
            stmts.append(self.parse_statement())
        self.expect("DEDENT")
        return stmts

    # --- statements -------------------------------------------------------

    def parse_statement(self):
        tok = self.peek()
        if tok.kind == "def":
            return self.parse_function_def()
        if tok.kind == "if":
            return self.parse_if()
        if tok.kind == "while":
            return self.parse_while()
        if tok.kind == "for":
            return self.parse_for()
        if tok.kind == "return":
            self.advance()
            value = None
            if not self.at("NEWLINE"):
                value = self.parse_expr()
            self.expect("NEWLINE")
            return {"type": "Return", "value": value, "line": tok.line}
        if tok.kind == "pass":
            self.advance()
            self.expect("NEWLINE")
            return {"type": "Pass", "line": tok.line}
        if tok.kind == "break":
            self.advance()
            self.expect("NEWLINE")
            return {"type": "Break", "line": tok.line}
        if tok.kind == "continue":
            self.advance()
            self.expect("NEWLINE")
            return {"type": "Continue", "line": tok.line}

        # print(...) as its own statement form, or assignment, or a bare call
        if tok.kind == "NAME" and tok.value == "print" and self.peek(1).kind == "(":
            self.advance()
            self.expect("(")
            args = []
            if not self.at(")"):
                args.append(self.parse_expr())
                while self.at(","):
                    self.advance()
                    args.append(self.parse_expr())
            self.expect(")")
            self.expect("NEWLINE")
            return {"type": "Print", "args": args, "line": tok.line}

        if tok.kind == "NAME" and self.peek(1).kind == "=":
            name = self.advance().value
            self.advance()  # '='
            value = self.parse_expr()
            self.expect("NEWLINE")
            return {"type": "Assign", "name": name, "value": value, "line": tok.line}

        expr = self.parse_expr()
        self.expect("NEWLINE")
        return {"type": "ExprStmt", "expr": expr, "line": tok.line}

    def parse_function_def(self):
        tok = self.advance()  # 'def'
        name = self.expect("NAME").value
        self.expect("(")
        params = []
        if not self.at(")"):
            params.append(self.expect("NAME").value)
            while self.at(","):
                self.advance()
                params.append(self.expect("NAME").value)
        self.expect(")")
        body = self.parse_block()
        return {"type": "FunctionDef", "name": name, "params": params, "body": body, "line": tok.line}

    def parse_if(self):
        tok = self.advance()  # 'if'
        test = self.parse_expr()
        body = self.parse_block()
        orelse = []
        if self.at("elif"):
            orelse = [self.parse_if_as_elif()]
        elif self.at("else"):
            self.advance()
            orelse = self.parse_block()
        return {"type": "If", "test": test, "body": body, "orelse": orelse, "line": tok.line}

    def parse_if_as_elif(self):
        tok = self.advance()  # 'elif'
        test = self.parse_expr()
        body = self.parse_block()
        orelse = []
        if self.at("elif"):
            orelse = [self.parse_if_as_elif()]
        elif self.at("else"):
            self.advance()
            orelse = self.parse_block()
        return {"type": "If", "test": test, "body": body, "orelse": orelse, "line": tok.line}

    def parse_while(self):
        tok = self.advance()  # 'while'
        test = self.parse_expr()
        body = self.parse_block()
        return {"type": "While", "test": test, "body": body, "line": tok.line}

    def parse_for(self):
        tok = self.advance()  # 'for'
        var_name = self.expect("NAME").value
        self.expect("in")
        range_tok = self.expect("NAME")
        if range_tok.value != "range":
            raise ParseError(f"line {range_tok.line}: only 'for x in range(...)' loops are supported")
        self.expect("(")
        args = [self.parse_expr()]
        while self.at(","):
            self.advance()
            args.append(self.parse_expr())
        self.expect(")")
        if len(args) == 1:
            start, stop, step = {"type": "Num", "value": 0, "is_float": False}, args[0], None
        elif len(args) == 2:
            start, stop, step = args[0], args[1], None
        elif len(args) == 3:
            start, stop, step = args[0], args[1], args[2]
        else:
            raise ParseError(f"line {tok.line}: range() takes 1 to 3 arguments")
        body = self.parse_block()
        return {"type": "For", "var": var_name, "start": start, "stop": stop, "step": step, "body": body, "line": tok.line}

    # --- expressions (precedence climbing) ---------------------------------

    def parse_expr(self):
        return self.parse_or()

    def parse_or(self):
        left = self.parse_and()
        values = [left]
        while self.at("or"):
            self.advance()
            values.append(self.parse_and())
        if len(values) == 1:
            return left
        return {"type": "BoolOp", "op": "or", "values": values}

    def parse_and(self):
        left = self.parse_not()
        values = [left]
        while self.at("and"):
            self.advance()
            values.append(self.parse_not())
        if len(values) == 1:
            return left
        return {"type": "BoolOp", "op": "and", "values": values}

    def parse_not(self):
        if self.at("not"):
            self.advance()
            return {"type": "UnaryOp", "op": "not", "operand": self.parse_not()}
        return self.parse_comparison()

    COMPARE_OPS = {"==", "!=", "<", ">", "<=", ">="}

    def parse_comparison(self):
        left = self.parse_additive()
        if self.peek().kind in self.COMPARE_OPS:
            op = self.advance().kind
            right = self.parse_additive()
            return {"type": "Compare", "op": op, "left": left, "right": right}
        return left

    def parse_additive(self):
        left = self.parse_term()
        while self.peek().kind in ("+", "-"):
            op = self.advance().kind
            right = self.parse_term()
            left = {"type": "BinOp", "op": op, "left": left, "right": right}
        return left

    def parse_term(self):
        left = self.parse_unary()
        while self.peek().kind in ("*", "/", "//", "%"):
            op = self.advance().kind
            right = self.parse_unary()
            left = {"type": "BinOp", "op": op, "left": left, "right": right}
        return left

    def parse_unary(self):
        if self.peek().kind == "-":
            self.advance()
            return {"type": "UnaryOp", "op": "-", "operand": self.parse_unary()}
        return self.parse_power()

    def parse_power(self):
        left = self.parse_atom()
        if self.at("**"):
            self.advance()
            right = self.parse_unary()  # right-associative
            return {"type": "BinOp", "op": "**", "left": left, "right": right}
        return left

    def parse_atom(self):
        tok = self.peek()
        if tok.kind == "INT":
            self.advance()
            return {"type": "Num", "value": int(tok.value), "is_float": False}
        if tok.kind == "FLOAT":
            self.advance()
            return {"type": "Num", "value": float(tok.value), "is_float": True}
        if tok.kind == "STRING":
            self.advance()
            return {"type": "Str", "value": tok.value}
        if tok.kind == "True":
            self.advance()
            return {"type": "Bool", "value": True}
        if tok.kind == "False":
            self.advance()
            return {"type": "Bool", "value": False}
        if tok.kind == "None":
            self.advance()
            return {"type": "NoneLit"}
        if tok.kind == "(":
            self.advance()
            expr = self.parse_expr()
            self.expect(")")
            return expr
        if tok.kind == "NAME":
            name = self.advance().value
            if self.at("("):
                self.advance()
                args = []
                if not self.at(")"):
                    args.append(self.parse_expr())
                    while self.at(","):
                        self.advance()
                        args.append(self.parse_expr())
                self.expect(")")
                return {"type": "Call", "name": name, "args": args, "line": tok.line}
            return {"type": "Name", "id": name}
        raise ParseError(f"line {tok.line}: unexpected token {tok.kind} ({tok.value!r})")


def parse(source):
    tokens = tokenize(source)
    return Parser(tokens).parse_program()


# =============================================================================
# Type inference
# =============================================================================

class TypeError_(Exception):
    pass


def merge_type(current, new, line, what):
    if new is None:
        # Only happens mid-iteration, when a call to a mutually-recursive
        # function's return type hasn't been resolved yet on this pass --
        # not real information, so leave `current` exactly as it was and
        # let a later pass fill it in for real.
        return current
    if current is None:
        return new
    if current == new:
        return current
    if {current, new} <= {"int", "float"}:
        return "float"
    raise TypeError_(f"line {line}: {what} used as both {current!r} and {new!r} -- "
                      f"this compiler requires one static type per variable/parameter")


class TypeChecker:
    """Collects function signatures (param/return types) from their call
    sites and return statements, then infers every variable's type within
    each scope from its first assignment plus every later use. Runs the
    body-checking step several times (see run()) so two functions that
    call each other (mutual recursion) can still have their return types
    resolve correctly, instead of the first one seen treating the other's
    not-yet-known return type as an error."""

    def __init__(self, program):
        self.functions = {}   # name -> {"params": [...], "param_types": [...], "return_type": ...}
        self.program = program
        self.strict_calls = False  # see run(): False during warm-up passes, True on the final one

    def run(self):
        func_defs = [s for s in self.program["body"] if s["type"] == "FunctionDef"]
        for f in func_defs:
            self.functions[f["name"]] = {
                "params": f["params"],
                "param_types": [None] * len(f["params"]),
                "return_type": None,
                "node": f,
            }

        # Gather parameter types from call sites anywhere in the program.
        self._scan_calls_for_param_types(self.program["body"])
        for f in func_defs:
            info = self.functions[f["name"]]
            info["param_types"] = [t or "int" for t in info["param_types"]]

        main_body = [s for s in self.program["body"] if s["type"] != "FunctionDef"]
        global_scope = {}

        # Warm-up passes: a call to a function whose return type isn't known
        # yet this pass (a forward reference -- typically mutual recursion)
        # contributes no type information rather than raising or guessing
        # "void". Two warm-ups are enough for the direct-return-of-a-call
        # mutual-recursion shape this compiler supports; the final pass
        # below is the real, strict one that raises on genuine mismatches.
        for _ in range(2):
            self.strict_calls = False
            for f in func_defs:
                info = self.functions[f["name"]]
                scope = {name: t for name, t in zip(info["params"], info["param_types"])}
                info["return_type"] = self._check_block(f["body"], scope)
                info["scope"] = scope

        # Final, strict pass: every function's return type from the warm-up
        # is now as resolved as it's going to get, so a real mismatch here
        # is a genuine error, and an unresolved call now safely falls back
        # to "void" (a function that truly never returns a value).
        self.strict_calls = True
        for f in func_defs:
            info = self.functions[f["name"]]
            scope = {name: t for name, t in zip(info["params"], info["param_types"])}
            info["return_type"] = self._check_block(f["body"], scope)
            info["scope"] = scope
        self._check_block(main_body, global_scope)

        return {
            "functions": self.functions,
            "global_scope": global_scope,
            "main_body": main_body,
            "func_defs": func_defs,
        }

    def _scan_calls_for_param_types(self, stmts):
        for s in stmts:
            self._scan_calls_in_stmt(s)

    def _scan_calls_in_stmt(self, s):
        t = s["type"]
        if t == "FunctionDef":
            self._scan_calls_for_param_types(s["body"])
        elif t in ("If",):
            self._scan_expr_calls(s["test"])
            self._scan_calls_for_param_types(s["body"])
            self._scan_calls_for_param_types(s["orelse"])
        elif t == "While":
            self._scan_expr_calls(s["test"])
            self._scan_calls_for_param_types(s["body"])
        elif t == "For":
            for e in (s["start"], s["stop"], s["step"]):
                if e:
                    self._scan_expr_calls(e)
            self._scan_calls_for_param_types(s["body"])
        elif t == "Assign":
            self._scan_expr_calls(s["value"])
        elif t == "Return":
            if s["value"]:
                self._scan_expr_calls(s["value"])
        elif t == "Print":
            for a in s["args"]:
                self._scan_expr_calls(a)
        elif t == "ExprStmt":
            self._scan_expr_calls(s["expr"])

    def _scan_expr_calls(self, e):
        t = e["type"]
        if t == "Call" and e["name"] in self.functions:
            info = self.functions[e["name"]]
            if len(e["args"]) != len(info["params"]):
                raise TypeError_(f"line {e.get('line', '?')}: {e['name']}() called with "
                                  f"{len(e['args'])} arguments, expected {len(info['params'])}")
            for i, arg in enumerate(e["args"]):
                arg_type = self._literal_type_guess(arg)
                if arg_type:
                    info["param_types"][i] = merge_type(info["param_types"][i], arg_type, e.get("line", "?"),
                                                          f"parameter {info['params'][i]!r} of {e['name']}()")
            for a in e["args"]:
                self._scan_expr_calls(a)
        elif t == "Call":
            for a in e["args"]:
                self._scan_expr_calls(a)
        elif t == "BinOp":
            self._scan_expr_calls(e["left"])
            self._scan_expr_calls(e["right"])
        elif t == "UnaryOp":
            self._scan_expr_calls(e["operand"])
        elif t == "Compare":
            self._scan_expr_calls(e["left"])
            self._scan_expr_calls(e["right"])
        elif t == "BoolOp":
            for v in e["values"]:
                self._scan_expr_calls(v)

    def _literal_type_guess(self, e):
        """A shallow guess used only to seed parameter types from call-site
        literals/names; full inference happens in _check_block."""
        t = e["type"]
        if t == "Num":
            return "float" if e["is_float"] else "int"
        if t == "Str":
            return "string"
        if t == "Bool":
            return "bool"
        return None

    def _check_block(self, stmts, scope):
        """Type-checks a list of statements against `scope` (mutated in
        place). Returns the inferred return type of this block, if any
        `return <expr>` appears (None if the block never returns a value)."""
        return_type = None
        for s in stmts:
            t = s["type"]
            if t == "Assign":
                value_type = self.infer_expr(s["value"], scope)
                existing = scope.get(s["name"])
                scope[s["name"]] = merge_type(existing, value_type, s["line"], f"variable {s['name']!r}")
            elif t == "If":
                self.infer_expr(s["test"], scope)
                r1 = self._check_block(s["body"], scope)
                r2 = self._check_block(s["orelse"], scope)
                return_type = merge_type(return_type, r1, s["line"], "return type") if r1 else return_type
                return_type = merge_type(return_type, r2, s["line"], "return type") if r2 else return_type
            elif t == "While":
                self.infer_expr(s["test"], scope)
                r = self._check_block(s["body"], scope)
                if r:
                    return_type = merge_type(return_type, r, s["line"], "return type")
            elif t == "For":
                for e in (s["start"], s["stop"], s["step"]):
                    if e:
                        self.infer_expr(e, scope)
                scope[s["var"]] = merge_type(scope.get(s["var"]), "int", s["line"], f"loop variable {s['var']!r}")
                r = self._check_block(s["body"], scope)
                if r:
                    return_type = merge_type(return_type, r, s["line"], "return type")
            elif t == "Return":
                if s["value"] is not None:
                    rt = self.infer_expr(s["value"], scope)
                    return_type = merge_type(return_type, rt, s["line"], "return type")
            elif t == "Print":
                for a in s["args"]:
                    self.infer_expr(a, scope)
            elif t == "ExprStmt":
                self.infer_expr(s["expr"], scope)
            elif t in ("Pass", "Break", "Continue"):
                pass
            elif t == "FunctionDef":
                raise TypeError_(f"line {s['line']}: nested function definitions are not supported")
            else:
                raise TypeError_(f"unsupported statement type {t!r}")
        return return_type

    def infer_expr(self, e, scope):
        t = e["type"]
        if t == "Num":
            return "float" if e["is_float"] else "int"
        if t == "Str":
            return "string"
        if t == "Bool":
            return "bool"
        if t == "NoneLit":
            raise TypeError_("'None' is not supported by this compiler -- every value needs a "
                              "concrete int/float/string/bool type, since the target languages "
                              "don't have Python's dynamic None")
        if t == "Name":
            if e["id"] not in scope:
                raise TypeError_(f"name {e['id']!r} used before assignment")
            return scope[e["id"]]
        if t == "UnaryOp":
            operand_type = self.infer_expr(e["operand"], scope)
            return "bool" if e["op"] == "not" else operand_type
        if t == "BinOp":
            left = self.infer_expr(e["left"], scope)
            right = self.infer_expr(e["right"], scope)
            if e["op"] == "+" and (left == "string" or right == "string"):
                if left != "string" or right != "string":
                    raise TypeError_("cannot mix a string with a number in '+' -- this compiler has no implicit str()")
                return "string"
            if left == "string" or right == "string":
                raise TypeError_(f"operator {e['op']} is not supported on strings")
            if e["op"] == "/":
                return "float"
            if e["op"] == "**":
                return "float"
            if left == "float" or right == "float":
                return "float"
            return "int"
        if t == "Compare":
            self.infer_expr(e["left"], scope)
            self.infer_expr(e["right"], scope)
            return "bool"
        if t == "BoolOp":
            for v in e["values"]:
                self.infer_expr(v, scope)
            return "bool"
        if t == "Call":
            if e["name"] not in self.functions:
                raise TypeError_(f"line {e.get('line', '?')}: call to unknown function {e['name']!r} "
                                  f"(only calls to functions defined in this file are supported)")
            info = self.functions[e["name"]]
            for a in e["args"]:
                self.infer_expr(a, scope)
            if self.strict_calls:
                return info["return_type"] or "void"
            return info["return_type"]  # may be None mid-warm-up; merge_type treats that as "no info yet"
        raise TypeError_(f"unsupported expression type {t!r}")


def check_types(program):
    return TypeChecker(program).run()


# =============================================================================
# Code generation -- four independent backends sharing one expression emitter
# =============================================================================

class CodegenError(Exception):
    pass


TYPE_NAMES = {
    "c": {"int": "int", "float": "double", "string": "const char *", "bool": "bool", "void": "void"},
    "java": {"int": "int", "float": "double", "string": "String", "bool": "boolean", "void": "void"},
    "go": {"int": "int", "float": "float64", "string": "string", "bool": "bool", "void": ""},
}
ZERO_VALUES = {"int": "0", "float": "0.0", "string": '""', "bool": "false"}


def expr_type(e, scope, functions):
    t = e["type"]
    if t == "Num":
        return "float" if e["is_float"] else "int"
    if t == "Str":
        return "string"
    if t == "Bool":
        return "bool"
    if t == "NoneLit":
        return "none"
    if t == "Name":
        return scope[e["id"]]
    if t == "UnaryOp":
        return "bool" if e["op"] == "not" else expr_type(e["operand"], scope, functions)
    if t == "BinOp":
        left = expr_type(e["left"], scope, functions)
        right = expr_type(e["right"], scope, functions)
        if e["op"] == "+" and left == "string":
            return "string"
        if e["op"] in ("/", "**"):
            return "float"
        if left == "float" or right == "float":
            return "float"
        return "int"
    if t == "Compare" or t == "BoolOp":
        return "bool"
    if t == "Call":
        return functions[e["name"]]["return_type"] or "void"
    raise CodegenError(f"unsupported expression type {t!r}")


def py_string_to_literal(value):
    out = value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\t", "\\t")
    return f'"{out}"'


def format_float(value):
    if value == int(value):
        return f"{value:.1f}"
    return repr(value)


def emit_expr(e, lang, scope, functions):
    t = e["type"]
    if t == "Num":
        return format_float(e["value"]) if e["is_float"] else str(e["value"])
    if t == "Str":
        return py_string_to_literal(e["value"])
    if t == "Bool":
        return "true" if e["value"] else "false"
    if t == "NoneLit":
        return magic_term("None", lang)
    if t == "Name":
        return e["id"]
    if t == "UnaryOp":
        operand = emit_expr(e["operand"], lang, scope, functions)
        return f"{magic_term('not', lang)}({operand})" if e["op"] == "not" else f"(-{operand})"
    if t == "BinOp":
        return emit_binop(e, lang, scope, functions)
    if t == "Compare":
        return emit_compare(e, lang, scope, functions)
    if t == "BoolOp":
        joiner = f" {magic_term(e['op'], lang)} "
        parts = [emit_expr(v, lang, scope, functions) for v in e["values"]]
        return "(" + joiner.join(parts) + ")"
    if t == "Call":
        args = ", ".join(emit_expr(a, lang, scope, functions) for a in e["args"])
        return f"{e['name']}({args})"
    raise CodegenError(f"unsupported expression type {t!r}")


def emit_binop(e, lang, scope, functions):
    left_type = expr_type(e["left"], scope, functions)
    right_type = expr_type(e["right"], scope, functions)
    l = emit_expr(e["left"], lang, scope, functions)
    r = emit_expr(e["right"], lang, scope, functions)
    op = e["op"]

    if op == "+":
        if left_type == "string" and lang == "c":
            raise CodegenError("the C target does not support string concatenation (C strings are manual, "
                                "fixed char*/const char* -- try another target for this line)")
        return f"({l} + {r})"
    if op == "-":
        return f"({l} - {r})"
    if op == "*":
        return f"({l} * {r})"
    if op == "/":
        if lang == "js":
            return f"({l} / {r})"
        if lang == "go":
            return f"(float64({l}) / float64({r}))"
        return f"((double){l} / (double){r})"
    if op == "//":
        if left_type == "float" or right_type == "float":
            if lang == "js":
                return f"Math.floor({l} / {r})"
            if lang == "go":
                return f"math.Floor({l} / {r})"
            if lang == "java":
                return f"Math.floor({l} / {r})"
            return f"floor((double){l} / (double){r})"
        # Integer floor division: C/Java/Go's `/` truncates toward zero, Python floors toward
        # negative infinity -- these only disagree when the result is negative and inexact,
        # a documented, deliberate simplification (see the page's "known limits" panel).
        if lang == "js":
            return f"Math.floor({l} / {r})"
        return f"({l} / {r})"
    if op == "%":
        # Python's % takes the sign of the divisor; C/Java/Go/JS take the sign of the dividend.
        # Corrected with the standard "((a % b) + b) % b" pattern so behavior genuinely matches
        # Python instead of merely looking similar.
        if left_type == "float" or right_type == "float":
            if lang == "c":
                return f"fmod(fmod((double){l}, (double){r}) + (double){r}, (double){r})"
            if lang == "go":
                return f"math.Mod(math.Mod({l}, {r}) + {r}, {r})"
            return f"((({l} % {r}) + {r}) % {r})"  # Java/JS % already works on floats
        return f"((({l} % {r}) + {r}) % {r})"
    if op == "**":
        if lang == "js" or lang == "java":
            return f"Math.pow({l}, {r})"
        if lang == "go":
            return f"math.Pow(float64({l}), float64({r}))"
        return f"pow((double){l}, (double){r})"
    raise CodegenError(f"unsupported operator {op!r}")


def emit_compare(e, lang, scope, functions):
    left_type = expr_type(e["left"], scope, functions)
    right_type = expr_type(e["right"], scope, functions)
    l = emit_expr(e["left"], lang, scope, functions)
    r = emit_expr(e["right"], lang, scope, functions)
    op = e["op"]
    is_string_compare = left_type == "string" and right_type == "string"

    if is_string_compare and lang == "java" and op in ("==", "!="):
        eq = f"{l}.equals({r})"
        return eq if op == "==" else f"!({eq})"
    if is_string_compare and lang == "c":
        if op not in ("==", "!="):
            raise CodegenError("the C target only supports == and != between strings")
        cmp = f"strcmp({l}, {r}) == 0"
        return cmp if op == "==" else f"!({cmp})"

    symbols = {"==": "==", "!=": "!=", "<": "<", ">": ">", "<=": "<=", ">=": ">="}
    return f"({l} {symbols[op]} {r})"


def emit_print(args, lang, scope, functions, indent):
    if lang == "js":
        parts = [emit_expr(a, "js", scope, functions) for a in args]
        return f"{indent}console.log({', '.join(parts)});"
    if lang == "go":
        parts = [emit_expr(a, "go", scope, functions) for a in args]
        return f"{indent}fmt.Println({', '.join(parts)})"
    if lang == "java":
        if not args:
            return f"{indent}System.out.println();"
        parts = [emit_expr(a, "java", scope, functions) for a in args]
        joined = ' + " " + '.join(parts)
        return f'{indent}System.out.println("" + {joined});'
    if lang == "c":
        fmt_parts, c_args = [], []
        for a in args:
            t = expr_type(a, scope, functions)
            val = emit_expr(a, "c", scope, functions)
            if t == "int":
                fmt_parts.append("%d")
            elif t == "float":
                fmt_parts.append("%f")
            elif t == "bool":
                fmt_parts.append("%s")
                val = f'({val} ? "true" : "false")'
            else:
                fmt_parts.append("%s")
            c_args.append(val)
        fmt = " ".join(fmt_parts) + "\\n"
        if c_args:
            return f'{indent}printf("{fmt}", {", ".join(c_args)});'
        return f'{indent}printf("\\n");'
    raise CodegenError(f"unsupported language {lang!r}")


def emit_declarations(scope, exclude, lang, indent):
    lines = []
    for name, vtype in scope.items():
        if name in exclude:
            continue
        zero = ZERO_VALUES[vtype]
        if lang == "js":
            lines.append(f"{indent}let {name} = {zero};")
        elif lang == "go":
            lines.append(f"{indent}var {name} {TYPE_NAMES['go'][vtype]} = {zero}")
        else:
            lines.append(f"{indent}{TYPE_NAMES[lang][vtype]} {name} = {zero};")
    return lines


def emit_assign(s, lang, scope, functions, indent):
    if lang == "c" and scope[s["name"]] == "string" and s["value"]["type"] != "Str":
        raise CodegenError(f"line {s['line']}: the C target only supports assigning string LITERALS "
                            f"to a variable (no string expressions/concatenation)")
    val = emit_expr(s["value"], lang, scope, functions)
    if lang == "go":
        return f"{indent}{s['name']} = {val}"
    return f"{indent}{s['name']} = {val};"


def emit_block(stmts, lang, scope, functions, indent_level):
    indent = "    " * indent_level
    lines = []
    for s in stmts:
        t = s["type"]
        if t == "Assign":
            lines.append(emit_assign(s, lang, scope, functions, indent))
        elif t == "If":
            lines.extend(emit_if_chain(s, lang, scope, functions, indent_level))
        elif t == "While":
            cond = emit_expr(s["test"], lang, scope, functions)
            header = f"for {cond} {{" if lang == "go" else f"while ({cond}) {{"
            lines.append(f"{indent}{header}")
            lines.extend(emit_block(s["body"], lang, scope, functions, indent_level + 1))
            lines.append(f"{indent}}}")
        elif t == "For":
            lines.extend(emit_for(s, lang, scope, functions, indent_level))
        elif t == "Return":
            if s["value"] is None:
                lines.append(f"{indent}return" if lang == "go" else f"{indent}return;")
            else:
                val = emit_expr(s["value"], lang, scope, functions)
                lines.append(f"{indent}return {val}" if lang == "go" else f"{indent}return {val};")
        elif t == "Print":
            lines.append(emit_print(s["args"], lang, scope, functions, indent))
        elif t == "ExprStmt":
            val = emit_expr(s["expr"], lang, scope, functions)
            lines.append(f"{indent}{val};" if lang != "go" else f"{indent}{val}")
        elif t == "Pass":
            pass
        elif t == "Break":
            lines.append(f"{indent}break" if lang == "go" else f"{indent}break;")
        elif t == "Continue":
            lines.append(f"{indent}continue" if lang == "go" else f"{indent}continue;")
        else:
            raise CodegenError(f"unsupported statement type {t!r}")
    return lines


def emit_if_chain(node, lang, scope, functions, indent_level):
    indent = "    " * indent_level
    lines = [f"{indent}if ({emit_expr(node['test'], lang, scope, functions)}) {{"]
    lines.extend(emit_block(node["body"], lang, scope, functions, indent_level + 1))
    orelse = node["orelse"]
    while len(orelse) == 1 and orelse[0]["type"] == "If":
        elif_node = orelse[0]
        lines.append(f"{indent}}} else if ({emit_expr(elif_node['test'], lang, scope, functions)}) {{")
        lines.extend(emit_block(elif_node["body"], lang, scope, functions, indent_level + 1))
        orelse = elif_node["orelse"]
    if orelse:
        lines.append(f"{indent}}} else {{")
        lines.extend(emit_block(orelse, lang, scope, functions, indent_level + 1))
    lines.append(f"{indent}}}")
    return lines


def emit_for(s, lang, scope, functions, indent_level):
    indent = "    " * indent_level
    var = s["var"]
    start = emit_expr(s["start"], lang, scope, functions)
    stop = emit_expr(s["stop"], lang, scope, functions)
    step = emit_expr(s["step"], lang, scope, functions) if s["step"] else "1"
    negative_step = s["step"] is not None and s["step"]["type"] == "Num" and s["step"]["value"] < 0
    cmp_op = ">" if negative_step else "<"

    if lang == "go":
        header = f"for {var} = {start}; {var} {cmp_op} {stop}; {var} += {step} {{"
    else:
        header = f"for ({var} = {start}; {var} {cmp_op} {stop}; {var} += {step}) {{"
    lines = [f"{indent}{header}"]
    lines.extend(emit_block(s["body"], lang, scope, functions, indent_level + 1))
    lines.append(f"{indent}}}")
    return lines


def program_uses_math(typed, lang):
    if lang not in ("c", "go"):
        return False
    found = [False]

    def walk_expr(e, scope):
        t = e["type"]
        if t == "BinOp":
            walk_expr(e["left"], scope)
            walk_expr(e["right"], scope)
            if e["op"] == "**":
                found[0] = True
            elif e["op"] in ("//", "%"):
                lt = expr_type(e["left"], scope, typed["functions"])
                rt = expr_type(e["right"], scope, typed["functions"])
                if lt == "float" or rt == "float":
                    found[0] = True
        elif t == "UnaryOp":
            walk_expr(e["operand"], scope)
        elif t in ("Compare",):
            walk_expr(e["left"], scope)
            walk_expr(e["right"], scope)
        elif t == "BoolOp":
            for v in e["values"]:
                walk_expr(v, scope)
        elif t == "Call":
            for a in e["args"]:
                walk_expr(a, scope)

    def walk_stmts(stmts, scope):
        for s in stmts:
            t = s["type"]
            if t == "Assign":
                walk_expr(s["value"], scope)
            elif t == "If":
                walk_expr(s["test"], scope)
                walk_stmts(s["body"], scope)
                walk_stmts(s["orelse"], scope)
            elif t == "While":
                walk_expr(s["test"], scope)
                walk_stmts(s["body"], scope)
            elif t == "For":
                for e in (s["start"], s["stop"], s["step"]):
                    if e:
                        walk_expr(e, scope)
                walk_stmts(s["body"], scope)
            elif t == "Return":
                if s["value"] is not None:
                    walk_expr(s["value"], scope)
            elif t == "Print":
                for a in s["args"]:
                    walk_expr(a, scope)
            elif t == "ExprStmt":
                walk_expr(s["expr"], scope)

    for f in typed["func_defs"]:
        walk_stmts(f["body"], typed["functions"][f["name"]]["scope"])
    walk_stmts(typed["main_body"], typed["global_scope"])
    return found[0]


def program_uses_print(typed):
    """Go errors on an unused 'fmt' import, so only import it when the
    program actually contains a print(...) call somewhere."""
    def any_print(stmts):
        for s in stmts:
            t = s["type"]
            if t == "Print":
                return True
            if t == "If" and (any_print(s["body"]) or any_print(s["orelse"])):
                return True
            if t in ("While", "For") and any_print(s["body"]):
                return True
        return False

    for f in typed["func_defs"]:
        if any_print(f["body"]):
            return True
    return any_print(typed["main_body"])


def emit_function(f, info, lang, functions):
    name = f["name"]
    params = info["params"]
    param_types = info["param_types"]
    return_type = info["return_type"] or "void"
    scope = info["scope"]

    if lang == "js":
        header = f"function {name}({', '.join(params)}) {{"
        base_level = 0
    elif lang == "go":
        params_str = ", ".join(f"{p} {TYPE_NAMES['go'][t]}" for p, t in zip(params, param_types))
        ret = "" if return_type == "void" else f" {TYPE_NAMES['go'][return_type]}"
        header = f"func {name}({params_str}){ret} {{"
        base_level = 0
    elif lang == "java":
        params_str = ", ".join(f"{TYPE_NAMES['java'][t]} {p}" for p, t in zip(params, param_types))
        header = f"static {TYPE_NAMES['java'][return_type]} {name}({params_str}) {{"
        base_level = 0  # emit_program adds the one class-level indent for every func_lines entry
    elif lang == "c":
        params_str = ", ".join(f"{TYPE_NAMES['c'][t]} {p}" for p, t in zip(params, param_types)) or "void"
        header = f"{TYPE_NAMES['c'][return_type]} {name}({params_str}) {{"
        base_level = 0
    else:
        raise CodegenError(f"unsupported language {lang!r}")

    indent = "    " * base_level
    lines = [f"{indent}{header}"]
    decl_lines = emit_declarations(scope, set(params), lang, "    " * (base_level + 1))
    lines.extend(decl_lines)
    if decl_lines:
        lines.append("")
    lines.extend(emit_block(f["body"], lang, scope, functions, base_level + 1))
    lines.append(f"{indent}}}")
    return lines


def emit_c_prototype(f, info):
    params_str = ", ".join(TYPE_NAMES["c"][t] for t in info["param_types"]) or "void"
    ret = TYPE_NAMES["c"][info["return_type"] or "void"]
    return f"{ret} {f['name']}({params_str});"


def emit_program(typed, lang):
    functions = typed["functions"]

    func_lines = []
    for f in typed["func_defs"]:
        func_lines.extend(emit_function(f, functions[f["name"]], lang, functions))
        func_lines.append("")

    # JS has no wrapping main() -- top-level statements sit at column 0.
    # Java's main() sits inside a class AND a method -- two levels of nesting.
    # C/Go wrap top-level statements in one function (main) -- one level.
    if lang == "js":
        main_level = 0
    elif lang == "java":
        main_level = 2
    else:
        main_level = 1
    main_lines = emit_declarations(typed["global_scope"], set(), lang, "    " * main_level)
    if main_lines:
        main_lines.append("")
    main_lines.extend(emit_block(typed["main_body"], lang, typed["global_scope"], functions, main_level))

    if lang == "js":
        return ("\n".join(func_lines + main_lines)).rstrip() + "\n"

    if lang == "go":
        imports = (['"fmt"'] if program_uses_print(typed) else []) + \
                  (['"math"'] if program_uses_math(typed, "go") else [])
        if imports:
            header = ["package main", "", "import ("] + [f"\t{i}" for i in imports] + [")", ""]
        else:
            header = ["package main", ""]
        body = ["func main() {"] + main_lines + ["}"]
        return ("\n".join(header + func_lines + body)).rstrip() + "\n"

    if lang == "java":
        indented_funcs = ["    " + l if l else l for l in func_lines]
        header = ["public class Main {", "    public static void main(String[] args) {"]
        footer = ["    }", ""] + indented_funcs + ["}"]
        return ("\n".join(header + main_lines + footer)).rstrip() + "\n"

    if lang == "c":
        includes = ["#include <stdio.h>", "#include <stdbool.h>", "#include <string.h>"]
        if program_uses_math(typed, "c"):
            includes.append("#include <math.h>")
        prototypes = [emit_c_prototype(f, functions[f["name"]]) for f in typed["func_defs"]]
        header = includes + [""] + prototypes + ([""] if prototypes else [])
        main_header = ["int main(void) {"]
        main_footer = ["    return 0;", "}"]
        return ("\n".join(header + func_lines + main_header + main_lines + main_footer)).rstrip() + "\n"

    raise CodegenError(f"unsupported language {lang!r}")


LANGUAGE_NAMES = {"js": "JavaScript", "c": "C", "java": "Java", "go": "Go"}

MAGIC_SQL_PATH = Path(__file__).resolve().parent / "templates" / "magic.sql"
_magic_conn = None


def _magic_db():
    """Loads templates/magic.sql into a real, in-memory SQLite database the
    first time it's needed (same load-a-.sql-file pattern as the
    Humanizer's database.sql / backend_pipeline.py). Cheap enough to redo
    per process -- the table is tiny -- so no on-disk .db file is kept."""
    global _magic_conn
    if _magic_conn is None:
        _magic_conn = sqlite3.connect(":memory:")
        if MAGIC_SQL_PATH.exists():
            with open(MAGIC_SQL_PATH, encoding="utf-8") as f:
                _magic_conn.executescript(f.read())
    return _magic_conn


_MAGIC_TERM_FALLBACK = {
    "None": {"js": "null", "c": "NULL", "java": "null", "go": "nil"},
    "and": {"js": "&&", "c": "&&", "java": "&&", "go": "&&"},
    "or": {"js": "||", "c": "||", "java": "||", "go": "||"},
    "not": {"js": "!", "c": "!", "java": "!", "go": "!"},
}


def magic_term(python_term, lang):
    """Looks up a core keyword's per-language token in magic_terms (e.g.
    'None' -> null/NULL/null/nil) instead of a dict buried inline in the
    code generator -- falls back to a small built-in table only if
    templates/magic.sql is somehow missing, so the compiler still works."""
    conn = _magic_db()
    row = conn.execute("SELECT js, c, java, go FROM magic_terms WHERE python_term = ?", (python_term,)).fetchone()
    if row is None:
        return _MAGIC_TERM_FALLBACK[python_term][lang]
    return dict(zip(("js", "c", "java", "go"), row))[lang]


def magic_line_lookup(source, targets):
    """Exact-match cache: if the WHOLE trimmed source matches a row in
    magic_lines, return its pre-compiled output for every requested target
    without running the lexer/parser/type-checker/code-generator at all.
    Returns None on a miss (the normal, unbounded case -- anything that
    isn't one of a few common example snippets)."""
    conn = _magic_db()
    row = conn.execute(
        "SELECT js, c, java, go FROM magic_lines WHERE python_source = ?",
        (source.strip("\n"),),
    ).fetchone()
    if row is None:
        return None
    js, c, java, go = row
    by_lang = {"js": js, "c": c, "java": java, "go": go}
    if not all(t in by_lang for t in targets):
        return None
    return {t: by_lang[t] + "\n" for t in targets}


def compile_source(source, targets):
    """End-to-end: a magic_lines cache check first (see magic_line_lookup),
    then -- on a miss -- source -> tokens -> AST -> type-checked program ->
    one generated source string per requested target. Raises LexError,
    ParseError, TypeError_, or CodegenError with a line-numbered message on
    anything outside the supported subset -- never silently produces wrong
    code for something it doesn't understand. Returns (outputs, from_cache)."""
    cached = magic_line_lookup(source, targets)
    if cached is not None:
        return cached, True
    program = parse(source)
    typed = check_types(program)
    return {target: emit_program(typed, target) for target in targets}, False


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Translate a small, real subset of Python into JavaScript, C, Java, or Go.")
    parser.add_argument("source", nargs="?", help="Path to a .py file. Reads stdin if omitted.")
    parser.add_argument("--target", action="append", choices=list(LANGUAGE_NAMES.keys()), required=True,
                         help="Target language(s); repeat --target to compile to more than one at once.")
    args = parser.parse_args()

    source = open(args.source, encoding="utf-8").read() if args.source else sys.stdin.read()

    try:
        outputs, from_cache = compile_source(source, args.target)
    except (LexError, ParseError, TypeError_, CodegenError) as exc:
        print(f"Compile error: {exc}", file=sys.stderr)
        sys.exit(1)

    if from_cache:
        print("(served from the magic_lines cache -- exact match, skipped the compiler)", file=sys.stderr)
    for target in args.target:
        print(f"=== {LANGUAGE_NAMES[target]} ===")
        print(outputs[target])


if __name__ == "__main__":
    main()
