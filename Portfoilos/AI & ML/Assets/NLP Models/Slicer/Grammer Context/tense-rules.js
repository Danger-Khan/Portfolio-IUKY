/**
 * tense-rules.js
 * ---------------------------------------------------------------------------
 * Browser-loadable mirror of tense-rules.json in this same Grammer Context
 * folder (the JSON is the source of truth; slicer_cli.py reads it directly).
 * Hand-synced here for the same file:// reason as rules.js.
 */
export const TENSE_AUXILIARIES = {
  "modalFuture": [
    "will",
    "shall"
  ],
  "bePresent": [
    "am",
    "is",
    "are"
  ],
  "bePast": [
    "was",
    "were"
  ],
  "beBase": [
    "be",
    "been",
    "being"
  ],
  "havePresent": [
    "has",
    "have"
  ],
  "havePast": [
    "had"
  ]
};

export const TENSES = {
  "simplePresent": {
    "label": "Simple Present",
    "time": "present",
    "aspect": "simple",
    "structure": "subject + base verb (+ -s/-es for he/she/it)",
    "example": "She writes every day.",
    "signalWords": [
      "always",
      "usually",
      "often",
      "sometimes",
      "never",
      "every day"
    ]
  },
  "presentContinuous": {
    "label": "Present Continuous",
    "time": "present",
    "aspect": "continuous",
    "structure": "am/is/are + verb-ing",
    "example": "She is writing a letter.",
    "signalWords": [
      "now",
      "right now",
      "at the moment",
      "currently"
    ]
  },
  "presentPerfect": {
    "label": "Present Perfect",
    "time": "present",
    "aspect": "perfect",
    "structure": "has/have + past participle",
    "example": "She has written the letter.",
    "signalWords": [
      "already",
      "just",
      "yet",
      "ever",
      "never",
      "since",
      "for"
    ]
  },
  "presentPerfectContinuous": {
    "label": "Present Perfect Continuous",
    "time": "present",
    "aspect": "perfectContinuous",
    "structure": "has/have + been + verb-ing",
    "example": "She has been writing all morning.",
    "signalWords": [
      "since",
      "for",
      "all day",
      "lately",
      "recently"
    ]
  },
  "simplePast": {
    "label": "Simple Past",
    "time": "past",
    "aspect": "simple",
    "structure": "past-tense verb (regular -ed or irregular)",
    "example": "She wrote a letter.",
    "signalWords": [
      "yesterday",
      "last night",
      "ago",
      "in "
    ]
  },
  "pastContinuous": {
    "label": "Past Continuous",
    "time": "past",
    "aspect": "continuous",
    "structure": "was/were + verb-ing",
    "example": "She was writing a letter.",
    "signalWords": [
      "while",
      "when",
      "as"
    ]
  },
  "pastPerfect": {
    "label": "Past Perfect",
    "time": "past",
    "aspect": "perfect",
    "structure": "had + past participle",
    "example": "She had written the letter before he called.",
    "signalWords": [
      "already",
      "before",
      "after",
      "by the time"
    ]
  },
  "pastPerfectContinuous": {
    "label": "Past Perfect Continuous",
    "time": "past",
    "aspect": "perfectContinuous",
    "structure": "had + been + verb-ing",
    "example": "She had been writing for an hour when he called.",
    "signalWords": [
      "before",
      "for",
      "until"
    ]
  },
  "simpleFuture": {
    "label": "Simple Future",
    "time": "future",
    "aspect": "simple",
    "structure": "will/shall + base verb",
    "example": "She will write a letter.",
    "signalWords": [
      "tomorrow",
      "next week",
      "soon"
    ]
  },
  "futureContinuous": {
    "label": "Future Continuous",
    "time": "future",
    "aspect": "continuous",
    "structure": "will + be + verb-ing",
    "example": "She will be writing a letter.",
    "signalWords": [
      "at this time tomorrow",
      "this time next week"
    ]
  },
  "futurePerfect": {
    "label": "Future Perfect",
    "time": "future",
    "aspect": "perfect",
    "structure": "will + have + past participle",
    "example": "She will have written the letter by noon.",
    "signalWords": [
      "by",
      "by the time",
      "before"
    ]
  },
  "futurePerfectContinuous": {
    "label": "Future Perfect Continuous",
    "time": "future",
    "aspect": "perfectContinuous",
    "structure": "will + have + been + verb-ing",
    "example": "She will have been writing for an hour by noon.",
    "signalWords": [
      "by",
      "for",
      "by the time"
    ]
  }
};

export const IRREGULAR_VERBS = {
  "be": [
    "was/were",
    "been"
  ],
  "become": [
    "became",
    "become"
  ],
  "begin": [
    "began",
    "begun"
  ],
  "break": [
    "broke",
    "broken"
  ],
  "bring": [
    "brought",
    "brought"
  ],
  "build": [
    "built",
    "built"
  ],
  "buy": [
    "bought",
    "bought"
  ],
  "catch": [
    "caught",
    "caught"
  ],
  "choose": [
    "chose",
    "chosen"
  ],
  "come": [
    "came",
    "come"
  ],
  "do": [
    "did",
    "done"
  ],
  "drink": [
    "drank",
    "drunk"
  ],
  "drive": [
    "drove",
    "driven"
  ],
  "eat": [
    "ate",
    "eaten"
  ],
  "fall": [
    "fell",
    "fallen"
  ],
  "feel": [
    "felt",
    "felt"
  ],
  "find": [
    "found",
    "found"
  ],
  "fly": [
    "flew",
    "flown"
  ],
  "forget": [
    "forgot",
    "forgotten"
  ],
  "get": [
    "got",
    "gotten"
  ],
  "give": [
    "gave",
    "given"
  ],
  "go": [
    "went",
    "gone"
  ],
  "grow": [
    "grew",
    "grown"
  ],
  "have": [
    "had",
    "had"
  ],
  "hear": [
    "heard",
    "heard"
  ],
  "hold": [
    "held",
    "held"
  ],
  "keep": [
    "kept",
    "kept"
  ],
  "know": [
    "knew",
    "known"
  ],
  "leave": [
    "left",
    "left"
  ],
  "lose": [
    "lost",
    "lost"
  ],
  "make": [
    "made",
    "made"
  ],
  "meet": [
    "met",
    "met"
  ],
  "pay": [
    "paid",
    "paid"
  ],
  "read": [
    "read",
    "read"
  ],
  "ride": [
    "rode",
    "ridden"
  ],
  "ring": [
    "rang",
    "rung"
  ],
  "rise": [
    "rose",
    "risen"
  ],
  "run": [
    "ran",
    "run"
  ],
  "say": [
    "said",
    "said"
  ],
  "see": [
    "saw",
    "seen"
  ],
  "sell": [
    "sold",
    "sold"
  ],
  "send": [
    "sent",
    "sent"
  ],
  "shine": [
    "shone",
    "shone"
  ],
  "shoot": [
    "shot",
    "shot"
  ],
  "sing": [
    "sang",
    "sung"
  ],
  "sit": [
    "sat",
    "sat"
  ],
  "sleep": [
    "slept",
    "slept"
  ],
  "speak": [
    "spoke",
    "spoken"
  ],
  "spend": [
    "spent",
    "spent"
  ],
  "spring": [
    "sprang",
    "sprung"
  ],
  "stand": [
    "stood",
    "stood"
  ],
  "steal": [
    "stole",
    "stolen"
  ],
  "swim": [
    "swam",
    "swum"
  ],
  "take": [
    "took",
    "taken"
  ],
  "teach": [
    "taught",
    "taught"
  ],
  "tell": [
    "told",
    "told"
  ],
  "think": [
    "thought",
    "thought"
  ],
  "throw": [
    "threw",
    "thrown"
  ],
  "understand": [
    "understood",
    "understood"
  ],
  "wake": [
    "woke",
    "woken"
  ],
  "wear": [
    "wore",
    "worn"
  ],
  "win": [
    "won",
    "won"
  ],
  "write": [
    "wrote",
    "written"
  ]
};
