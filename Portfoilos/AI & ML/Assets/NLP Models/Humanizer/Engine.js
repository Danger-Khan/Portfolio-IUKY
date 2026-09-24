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

  function humanizeText(text) {
    var changes = [];
    var result = text;
    result = applyRules(result, AI_PHRASES, changes, false);
    result = applyRules(result, WORD_SUBSTITUTIONS, changes, true);
    result = applyRules(result, CONTRACTIONS, changes, true);
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
    if (!input || !humanizeBtn) return;

    function render() {
      var text = input.value;
      var before = analyze(text);
      var result = humanizeText(text);
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
              return '<li><span class="was">' + escapeHtml(c[0]) + '</span> → <span class="now">' + escapeHtml(c[1]) + '</span></li>';
            }).join('')
          : '<li class="empty-hint">No AI-sounding patterns found — nothing to change.</li>';
      }
    }

    function escapeHtml(str) {
      return String(str || '').replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    humanizeBtn.addEventListener('click', render);

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
