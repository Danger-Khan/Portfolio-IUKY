/**
 * templates/magic.js
 * ---------------------------------------------------------------------------
 * Browser-loadable mirror of templates/magic.sql in this same folder (that
 * .sql file is the source of truth; compiler_cli.py loads it into a real,
 * in-memory SQLite database via Python's stdlib sqlite3). Hand-synced here
 * because Engine.js runs from file:// too and a browser can't read a .sql
 * file, or run SQLite, without a server or a bundled library.
 *
 * MAGIC_TERMS: a handful of core Python keywords mapped 1:1 onto each
 *   target language's token (None/True/False/and/or/not/print). Pulled out
 *   of the code generator as reviewable data instead of an inline dict.
 * MAGIC_LINES: whole Python programs, keyed by their EXACT source text,
 *   with already-compiled output cached per language. Engine.js checks
 *   this before running the lexer/parser/type-checker/code-generator at
 *   all -- a real cache hit skips all of that. Every value here was
 *   produced by actually running the compiler on that exact source and
 *   copying its real output, so the cache can never disagree with what a
 *   fresh compile would produce.
 */
export const MAGIC_TERMS = {
  "None": {
    "js": "null",
    "c": "NULL",
    "java": "null",
    "go": "nil",
    "note": "the null/absent value"
  },
  "True": {
    "js": "true",
    "c": "true",
    "java": "true",
    "go": "true",
    "note": null
  },
  "False": {
    "js": "false",
    "c": "false",
    "java": "false",
    "go": "false",
    "note": null
  },
  "and": {
    "js": "&&",
    "c": "&&",
    "java": "&&",
    "go": "&&",
    "note": "boolean AND"
  },
  "or": {
    "js": "||",
    "c": "||",
    "java": "||",
    "go": "||",
    "note": "boolean OR"
  },
  "not": {
    "js": "!",
    "c": "!",
    "java": "!",
    "go": "!",
    "note": "boolean NOT"
  },
  "print": {
    "js": "console.log",
    "c": "printf",
    "java": "System.out.println",
    "go": "fmt.Println",
    "note": "the underlying call every print(...) statement compiles to"
  }
};

export const MAGIC_LINES = {
  "print(\"Hello, World!\")": {
    "js": "console.log(\"Hello, World!\");",
    "c": "#include <stdio.h>\n#include <stdbool.h>\n#include <string.h>\n\nint main(void) {\n    printf(\"%s\\n\", \"Hello, World!\");\n    return 0;\n}",
    "java": "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"\" + \"Hello, World!\");\n    }\n\n}",
    "go": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc main() {\n    fmt.Println(\"Hello, World!\")\n}"
  },
  "x = 1\ny = 2\nprint(x + y)": {
    "js": "let x = 0;\nlet y = 0;\n\nx = 1;\ny = 2;\nconsole.log((x + y));",
    "c": "#include <stdio.h>\n#include <stdbool.h>\n#include <string.h>\n\nint main(void) {\n    int x = 0;\n    int y = 0;\n\n    x = 1;\n    y = 2;\n    printf(\"%d\\n\", (x + y));\n    return 0;\n}",
    "java": "public class Main {\n    public static void main(String[] args) {\n        int x = 0;\n        int y = 0;\n\n        x = 1;\n        y = 2;\n        System.out.println(\"\" + (x + y));\n    }\n\n}",
    "go": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc main() {\n    var x int = 0\n    var y int = 0\n\n    x = 1\n    y = 2\n    fmt.Println((x + y))\n}"
  },
  "for i in range(5):\n    print(i)": {
    "js": "let i = 0;\n\nfor (i = 0; i < 5; i += 1) {\n    console.log(i);\n}",
    "c": "#include <stdio.h>\n#include <stdbool.h>\n#include <string.h>\n\nint main(void) {\n    int i = 0;\n\n    for (i = 0; i < 5; i += 1) {\n        printf(\"%d\\n\", i);\n    }\n    return 0;\n}",
    "java": "public class Main {\n    public static void main(String[] args) {\n        int i = 0;\n\n        for (i = 0; i < 5; i += 1) {\n            System.out.println(\"\" + i);\n        }\n    }\n\n}",
    "go": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc main() {\n    var i int = 0\n\n    for i = 0; i < 5; i += 1 {\n        fmt.Println(i)\n    }\n}"
  }
};
