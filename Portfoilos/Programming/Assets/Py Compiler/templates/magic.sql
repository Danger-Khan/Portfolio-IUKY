-- templates/magic.sql
-- Common Python terms and a handful of whole-source snippets, pre-mapped
-- per target language. compiler_cli.py loads this into a real, in-memory
-- SQLite database via Python's stdlib sqlite3 -- the same
-- load-a-.sql-file-into-SQLite pattern the Humanizer's database.sql /
-- backend_pipeline.py already use elsewhere in this project. Engine.js
-- keeps its own JS mirror, magic.js, since a browser can't read a .sql
-- file without a server.
--
-- Two tables, two different jobs:
--   magic_terms  a small vocabulary (None/True/False/and/or/not/print)
--                that maps 1:1 onto a target-language token. Pulled out
--                of the code generator as reviewable data instead of
--                staying buried in an inline dict.
--   magic_lines  a handful of common whole Python programs with their
--                already-compiled output cached against the EXACT source
--                text. A cache hit skips the lexer/parser/type-checker/
--                code-generator entirely -- real memoization, for real
--                speed, on real repeated input (e.g. this page's own
--                "Try an example" buttons use these exact snippets).
--                Every cached value here was produced by actually running
--                this compiler on that exact source and copying its real
--                output -- not a hand-written guess that could drift from
--                what the real pipeline would produce. Anything that
--                isn't an exact match still goes through the real
--                compiler like normal.

CREATE TABLE IF NOT EXISTS magic_terms (
  id          INTEGER PRIMARY KEY,
  python_term TEXT NOT NULL UNIQUE,
  js          TEXT NOT NULL,
  c           TEXT NOT NULL,
  java        TEXT NOT NULL,
  go          TEXT NOT NULL,
  note        TEXT
);

CREATE TABLE IF NOT EXISTS magic_lines (
  id            INTEGER PRIMARY KEY,
  python_source TEXT NOT NULL UNIQUE,
  js            TEXT NOT NULL,
  c             TEXT NOT NULL,
  java          TEXT NOT NULL,
  go            TEXT NOT NULL
);

INSERT OR IGNORE INTO magic_terms (id, python_term, js, c, java, go, note) VALUES
  (1, 'None',  'null', 'NULL', 'null', 'nil', 'the null/absent value'),
  (2, 'True',  'true', 'true', 'true', 'true', NULL),
  (3, 'False', 'false', 'false', 'false', 'false', NULL),
  (4, 'and',   '&&', '&&', '&&', '&&', 'boolean AND'),
  (5, 'or',    '||', '||', '||', '||', 'boolean OR'),
  (6, 'not',   '!', '!', '!', '!', 'boolean NOT'),
  (7, 'print', 'console.log', 'printf', 'System.out.println', 'fmt.Println',
      'the underlying call every print(...) statement compiles to');

INSERT OR IGNORE INTO magic_lines (id, python_source, js, c, java, go) VALUES
  (1, 'print("Hello, World!")',
      'console.log("Hello, World!");',
      '#include <stdio.h>
#include <stdbool.h>
#include <string.h>

int main(void) {
    printf("%s\n", "Hello, World!");
    return 0;
}',
      'public class Main {
    public static void main(String[] args) {
        System.out.println("" + "Hello, World!");
    }

}',
      'package main

import (
	"fmt"
)

func main() {
    fmt.Println("Hello, World!")
}'),
  (2, 'x = 1
y = 2
print(x + y)',
      'let x = 0;
let y = 0;

x = 1;
y = 2;
console.log((x + y));',
      '#include <stdio.h>
#include <stdbool.h>
#include <string.h>

int main(void) {
    int x = 0;
    int y = 0;

    x = 1;
    y = 2;
    printf("%d\n", (x + y));
    return 0;
}',
      'public class Main {
    public static void main(String[] args) {
        int x = 0;
        int y = 0;

        x = 1;
        y = 2;
        System.out.println("" + (x + y));
    }

}',
      'package main

import (
	"fmt"
)

func main() {
    var x int = 0
    var y int = 0

    x = 1
    y = 2
    fmt.Println((x + y))
}'),
  (3, 'for i in range(5):
    print(i)',
      'let i = 0;

for (i = 0; i < 5; i += 1) {
    console.log(i);
}',
      '#include <stdio.h>
#include <stdbool.h>
#include <string.h>

int main(void) {
    int i = 0;

    for (i = 0; i < 5; i += 1) {
        printf("%d\n", i);
    }
    return 0;
}',
      'public class Main {
    public static void main(String[] args) {
        int i = 0;

        for (i = 0; i < 5; i += 1) {
            System.out.println("" + i);
        }
    }

}',
      'package main

import (
	"fmt"
)

func main() {
    var i int = 0

    for i = 0; i < 5; i += 1 {
        fmt.Println(i)
    }
}');
