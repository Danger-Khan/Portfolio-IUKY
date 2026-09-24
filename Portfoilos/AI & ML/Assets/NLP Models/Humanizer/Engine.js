/**
 * Engine.js — the Humanizer, running entirely in the browser.
 *
 * Rule-based, not a trained model: swaps stock AI-sounding phrases, overly
 * formal words, and expanded verb phrases for plainer, contracted
 * alternatives. The rule data here is a direct JS copy of database.sql (a
 * browser can't read a .sql file without a server) — backend_pipeline.py is
 * the same logic again, in Python, for the offline/CLI companion.
 */
(function () {
  'use strict';

  var AI_PHRASES = [
    ["in today's fast-paced world", 'these days'],
    ['it is important to note that', 'worth noting:'],
    ['in conclusion', 'overall'],
    ['delve into', 'dig into'],
    ['navigate the complexities of', 'deal with'],
    ['in the realm of', 'in'],
    ['plays a crucial role', 'matters a lot'],
    ['plays a pivotal role', 'matters a lot'],
    ['embark on a journey', 'start out'],
    ['unlock the potential of', 'get the most out of'],
    ['a testament to', 'proof of'],
    ['at the end of the day', 'in the end'],
    ['rich tapestry of', 'mix of'],
    ['in order to', 'to'],
    ['with respect to', 'about'],
    ['in regard to', 'about'],
    ['prior to', 'before'],
    ['a wide range of', 'lots of'],
    ['it goes without saying that', 'obviously,'],
    ['needless to say', 'obviously,']
  ];

  var WORD_SUBSTITUTIONS = [
    ['utilize', 'use'], ['utilizes', 'uses'], ['utilizing', 'using'],
    ['leverage', 'use'], ['leveraging', 'using'],
    ['commence', 'start'], ['commenced', 'started'],
    ['terminate', 'end'],
    ['obtain', 'get'], ['obtained', 'got'],
    ['purchase', 'buy'],
    ['endeavor', 'try'],
    ['facilitate', 'help'],
    ['demonstrate', 'show'], ['demonstrates', 'shows'],
    ['indicate', 'show'], ['indicates', 'shows'],
    ['require', 'need'], ['requires', 'needs'],
    ['additional', 'more'],
    ['numerous', 'many'],
    ['approximately', 'about'],
    ['subsequently', 'then'],
    ['nevertheless', 'still'],
    ['notwithstanding', 'still'],
    ['robust', 'solid'],
    ['seamless', 'smooth'], ['seamlessly', 'smoothly'],
    ['boasts', 'has'],
    ['myriad', 'many'],
    ['holistic', 'complete'],
    ['underscore', 'highlight'], ['underscores', 'highlights'],
    ['furthermore', 'also'],
    ['moreover', 'plus']
  ];

  var CONTRACTIONS = [
    ['it is', "it's"], ['that is', "that's"],
    ['do not', "don't"], ['does not', "doesn't"], ['did not', "didn't"],
    ['cannot', "can't"], ['can not', "can't"],
    ['will not', "won't"],
    ['is not', "isn't"], ['are not', "aren't"],
    ['was not', "wasn't"], ['were not', "weren't"],
    ['has not', "hasn't"], ['have not', "haven't"],
    ['would not', "wouldn't"], ['should not', "shouldn't"], ['could not', "couldn't"],
    ['I am', "I'm"], ['you are', "you're"], ['we are', "we're"], ['they are', "they're"]
  ];

  // Deleted entirely (whole word/phrase) when Length = Shorten.
  var FILLER_TERMS = [
    'really', 'very', 'actually', 'basically', 'just', 'quite', 'simply',
    'certainly', 'definitely', 'literally', 'essentially', 'virtually',
    'totally', 'absolutely', 'truly',
    'in fact', 'as a matter of fact', 'so to speak', 'sort of', 'kind of',
    'to be honest', 'if you will'
  ].map(function (term) { return [term, '']; });

  // Prepended to alternating sentences when Length = Extend.
  var TRANSITION_CONNECTORS = [
    'In addition, ', "What's more, ", 'On top of that, ',
    'To put it another way, ', 'Building on that, ', 'Beyond that, '
  ];

  // US -> UK spelling, whole word. Used for both the UK and AUS dialect
  // options — Australian English follows British spelling here. Only
  // unambiguous spelling-only pairs are included (no "tire"/"tyre",
  // "practice"/"practise" — both have an unrelated second meaning where a
  // blind swap would just be wrong).
  var US_UK_SPELLING = [
    ['color', 'colour'], ['colors', 'colours'], ['colored', 'coloured'], ['coloring', 'colouring'],
    ['favorite', 'favourite'], ['favorites', 'favourites'],
    ['honor', 'honour'], ['honors', 'honours'], ['honored', 'honoured'], ['honoring', 'honouring'],
    ['labor', 'labour'], ['labors', 'labours'], ['labored', 'laboured'], ['laboring', 'labouring'],
    ['neighbor', 'neighbour'], ['neighbors', 'neighbours'], ['neighborhood', 'neighbourhood'], ['neighborhoods', 'neighbourhoods'],
    ['behavior', 'behaviour'], ['behaviors', 'behaviours'], ['behavioral', 'behavioural'],
    ['center', 'centre'], ['centers', 'centres'], ['centered', 'centred'], ['centering', 'centring'],
    ['theater', 'theatre'], ['theaters', 'theatres'],
    ['liter', 'litre'], ['liters', 'litres'],
    ['fiber', 'fibre'], ['fibers', 'fibres'],
    ['organize', 'organise'], ['organizes', 'organises'], ['organized', 'organised'], ['organizing', 'organising'], ['organization', 'organisation'], ['organizations', 'organisations'],
    ['realize', 'realise'], ['realizes', 'realises'], ['realized', 'realised'], ['realizing', 'realising'], ['realization', 'realisation'],
    ['recognize', 'recognise'], ['recognizes', 'recognises'], ['recognized', 'recognised'], ['recognizing', 'recognising'],
    ['analyze', 'analyse'], ['analyzes', 'analyses'], ['analyzed', 'analysed'], ['analyzing', 'analysing'],
    ['apologize', 'apologise'], ['apologized', 'apologised'], ['apologizing', 'apologising'],
    ['capitalize', 'capitalise'], ['capitalized', 'capitalised'],
    ['customize', 'customise'], ['customized', 'customised'],
    ['emphasize', 'emphasise'], ['emphasized', 'emphasised'],
    ['finalize', 'finalise'], ['finalized', 'finalised'],
    ['maximize', 'maximise'], ['maximized', 'maximised'],
    ['minimize', 'minimise'], ['minimized', 'minimised'],
    ['memorize', 'memorise'], ['memorized', 'memorised'],
    ['optimize', 'optimise'], ['optimized', 'optimised'],
    ['prioritize', 'prioritise'], ['prioritized', 'prioritised'],
    ['specialize', 'specialise'], ['specialized', 'specialised'],
    ['summarize', 'summarise'], ['summarized', 'summarised'],
    ['utilize', 'utilise'], ['utilizes', 'utilises'], ['utilized', 'utilised'], ['utilizing', 'utilising'],
    ['defense', 'defence'], ['defenses', 'defences'],
    ['offense', 'offence'], ['offenses', 'offences'],
    ['gray', 'grey'],
    ['aluminum', 'aluminium'],
    ['mom', 'mum'], ['moms', 'mums'],
    ['math', 'maths'],
    ['airplane', 'aeroplane'], ['airplanes', 'aeroplanes'],
    ['cozy', 'cosy'],
    ['pajamas', 'pyjamas'],
    ['jewelry', 'jewellery'],
    ['traveled', 'travelled'], ['traveling', 'travelling'], ['traveler', 'traveller'], ['travelers', 'travellers'],
    ['canceled', 'cancelled'], ['canceling', 'cancelling'],
    ['modeling', 'modelling'], ['modeled', 'modelled'],
    ['fueled', 'fuelled'], ['fueling', 'fuelling'],
    ['signaled', 'signalled'], ['signaling', 'signalling'],
    ['counselor', 'counsellor'], ['counselors', 'counsellors'],
    ['plow', 'plough'], ['plows', 'ploughs'],
    ['mold', 'mould'], ['molds', 'moulds'], ['molding', 'moulding'],
    ['skeptic', 'sceptic'], ['skeptical', 'sceptical'], ['skepticism', 'scepticism']
  ];

  // Business/tech jargon -> plain English, whole word/phrase.
  var JARGON_TERMS = [
    ['synergy', 'teamwork'], ['synergies', 'benefits'],
    ['circle back', 'follow up'], ['touch base', 'talk'],
    ['low-hanging fruit', 'easy wins'], ['move the needle', 'make a difference'],
    ['deep dive', 'close look'], ['deep-dive', 'close look'],
    ['actionable', 'useful'], ['bandwidth', 'capacity'],
    ['ecosystem', 'network'], ['value-add', 'benefit'], ['value add', 'benefit'],
    ['best-in-class', 'top-tier'], ['best in class', 'top-tier'],
    ['game-changer', 'big deal'], ['game changer', 'big deal'],
    ['think outside the box', 'get creative'],
    ['going forward', 'from now on'],
    ['reach out', 'contact'], ['loop in', 'include'], ['loop you in', 'include you'],
    ['take this offline', 'discuss this separately'],
    ['core competency', 'strength'], ['core competencies', 'strengths'],
    ['paradigm shift', 'major change'],
    ['ideate', 'brainstorm'],
    ['operationalize', 'put into practice'],
    ['incentivize', 'motivate'],
    ['drill down', 'look closer'],
    ['level set', 'get on the same page'],
    ['boil the ocean', 'try to do too much'],
    ['bleeding edge', 'newest'],
    ['best practice', 'proven method'], ['best practices', 'proven methods'],
    ['win-win', 'good for everyone']
  ];

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function matchCase(original, replacement) {
    if (/^[A-Z]/.test(original)) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  }

  function applyRules(text, pairs, changes, wholeWord) {
    var sorted = pairs.slice().sort(function (a, b) { return b[0].length - a[0].length; });
    var result = text;
    sorted.forEach(function (pair) {
      var find = pair[0];
      var replace = pair[1];
      var boundary = wholeWord ? '\\b' : '';
      var pattern = new RegExp(boundary + escapeRegExp(find) + boundary, 'gi');
      result = result.replace(pattern, function (match) {
        var cased = matchCase(match, replace);
        changes.push([match, cased]);
        return cased;
      });
    });
    return result;
  }

  function collapseWhitespace(text) {
    return text.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
  }

  // Fluency cleanup: whitespace/punctuation hygiene + capitalize sentence
  // starts. Always the last pass, when enabled — a formatting pass, not a
  // rewrite, so it's safe to run regardless of what else ran.
  function fluencyCleanup(text) {
    if (!text) return text;
    var result = collapseWhitespace(text);
    result = result.replace(/(^\s*|[.!?]\s+)([a-z])/g, function (m, sep, ch) {
      return sep + ch.toUpperCase();
    });
    return result;
  }

  // Splits on sentence-ending punctuation and prepends a connector to every
  // other sentence — real English transition words, not invented content.
  function extendText(text) {
    if (!text.trim()) return text;
    var sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    var idx = 0;
    for (var i = 1; i < sentences.length; i += 2) {
      var connector = TRANSITION_CONNECTORS[idx % TRANSITION_CONNECTORS.length];
      idx++;
      var s = sentences[i];
      var firstWord = (s.match(/^[A-Za-z]+/) || [''])[0];
      if (firstWord && firstWord !== 'I' && /^[A-Z]/.test(s)) {
        s = s.charAt(0).toLowerCase() + s.slice(1);
      }
      sentences[i] = connector + s;
    }
    return sentences.join(' ');
  }

  // options: { intensity: 'light'|'medium'|'full', length: 'shorten'|'normal'|'extend',
  //            dialect: 'us'|'uk'|'aus', removeJargon: bool, fluency: bool }
  function humanizeText(text, options) {
    options = options || {};
    var intensity = options.intensity || 'full';
    var length = options.length || 'normal';
    var dialect = options.dialect || 'us';
    var removeJargon = !!options.removeJargon;
    var fluency = options.fluency !== false;

    var changes = [];
    var result = text;

    if (intensity === 'full') {
      result = applyRules(result, AI_PHRASES, changes, false);
    }
    if (intensity === 'medium' || intensity === 'full') {
      result = applyRules(result, WORD_SUBSTITUTIONS, changes, true);
    }
    if (length !== 'extend') {
      result = applyRules(result, CONTRACTIONS, changes, true);
    }
    if (removeJargon) {
      result = applyRules(result, JARGON_TERMS, changes, true);
    }
    if (dialect === 'uk' || dialect === 'aus') {
      result = applyRules(result, US_UK_SPELLING, changes, true);
    }
    if (length === 'shorten') {
      result = applyRules(result, FILLER_TERMS, changes, true);
      result = collapseWhitespace(result);
    } else if (length === 'extend') {
      result = extendText(result);
    }
    if (fluency) {
      result = fluencyCleanup(result);
    }

    return { text: result, changes: changes };
  }

  function analyze(text) {
    var words = text.trim().length ? text.trim().split(/\s+/) : [];
    var sentences = text.split(/[.!?]+\s*/).filter(function (s) { return s.trim().length; });
    return { wordCount: words.length, sentenceCount: sentences.length };
  }

  window.Humanizer = { humanizeText: humanizeText, analyze: analyze };

  // --- Page wiring -----------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    var input = document.getElementById('humanizerInput');
    var output = document.getElementById('humanizerOutput');
    var changesList = document.getElementById('changesList');
    var statsRow = document.getElementById('humanizerStats');
    var humanizeBtn = document.getElementById('humanizeBtn');
    var clearBtn = document.getElementById('clearBtn');
    var copyBtn = document.getElementById('copyBtn');
    var downloadBtn = document.getElementById('downloadBtn');
    var optIntensity = document.getElementById('optIntensity');
    var optLength = document.getElementById('optLength');
    var optDialect = document.getElementById('optDialect');
    var optFluency = document.getElementById('optFluency');
    var optJargon = document.getElementById('optJargon');
    if (!input || !humanizeBtn) return;

    function readOptions() {
      return {
        intensity: optIntensity ? optIntensity.value : 'full',
        length: optLength ? optLength.value : 'normal',
        dialect: optDialect ? optDialect.value : 'us',
        removeJargon: optJargon ? optJargon.checked : false,
        fluency: optFluency ? optFluency.checked : true
      };
    }

    function render() {
      var text = input.value;
      var before = analyze(text);
      var result = humanizeText(text, readOptions());
      var after = analyze(result.text);

      output.textContent = result.text || '';
      output.classList.toggle('is-empty', !result.text);
      if (!result.text) output.textContent = 'Humanized text will appear here.';

      if (statsRow) {
        statsRow.innerHTML =
          '<div class="stat-chip"><strong>' + before.wordCount + '</strong><span>Words in</span></div>' +
          '<div class="stat-chip"><strong>' + after.wordCount + '</strong><span>Words out</span></div>' +
          '<div class="stat-chip"><strong>' + result.changes.length + '</strong><span>Patterns fixed</span></div>';
      }

      if (changesList) {
        changesList.innerHTML = result.changes.length
          ? result.changes.map(function (c) {
              var now = c[1] ? '<span class="now">' + escapeHtml(c[1]) + '</span>' : '<em class="now">removed</em>';
              return '<li><span class="was">' + escapeHtml(c[0]) + '</span> → ' + now + '</li>';
            }).join('')
          : '<li class="empty-hint">No matching patterns found — nothing to change.</li>';
      }
    }

    function escapeHtml(str) {
      return String(str || '').replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    humanizeBtn.addEventListener('click', render);

    [optIntensity, optLength, optDialect, optFluency, optJargon].forEach(function (el) {
      if (el) el.addEventListener('change', render);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        input.value = '';
        render();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var text = output.textContent || '';
        if (!text || output.classList.contains('is-empty')) return;
        navigator.clipboard.writeText(text).then(function () {
          var original = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(function () { copyBtn.textContent = original; }, 1200);
        }).catch(function () { /* clipboard permission denied — nothing else to do */ });
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        var text = output.textContent || '';
        if (!text || output.classList.contains('is-empty')) return;
        var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'humanized.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
    }

    render();
  });
})();
