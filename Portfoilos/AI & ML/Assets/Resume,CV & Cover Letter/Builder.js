/**
 * Resume / CV / Cover Letter Builder — engine.
 * One shared `state` object drives three live previews (resume, CV, cover
 * letter) rendered together on the page. Draft autosaves to localStorage;
 * "Export Draft (JSON)" writes the same shape of file that Printer.py reads,
 * so the same draft can be formatted again from the command line.
 */
(function () {
  'use strict';
  var STORAGE_KEY = 'resume_builder_draft_v1';
  var selectedFormat = 'resume';

  var FORMAT_LABELS = {
    resume: 'Resume', cv: 'CV', cover: 'Cover Letter',
    ats: 'ATS Resume', europass: 'Europass', japanese: 'Japanese Resume'
  };

  function selectFormat(format) {
    if (!FORMAT_LABELS[format]) return;
    selectedFormat = format;

    document.querySelectorAll('.format-opt').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-format') === format);
    });
    document.querySelectorAll('.preview-panel').forEach(function (panel) {
      panel.classList.toggle('is-selected', panel.getAttribute('data-format') === format);
    });

    var printBtn = el('btnPrintSelected');
    if (printBtn) printBtn.textContent = 'Print ' + FORMAT_LABELS[format] + ' / Save as PDF';

    var panel = document.querySelector('.preview-panel[data-format="' + format + '"]');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  var state = {
    name: '', title: '', email: '', phone: '', location: '', links: '',
    summary: '', skills: '',
    experience: [{ role: '', company: '', dates: '', bullets: '' }],
    education: [{ degree: '', school: '', dates: '' }],
    extra: '',
    coCompany: '', coRole: '', coHiring: '', coOpen: '', coBody: '', coClose: '',
    nationality: '', dob: '', furigana: '', languages: '', drivingLicence: '', jpRequest: ''
  };

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function el(id) { return document.getElementById(id); }

  var simpleFieldIds = ['fName', 'fTitle', 'fEmail', 'fPhone', 'fLocation', 'fLinks', 'fSummary', 'fSkills', 'fExtra', 'fCoCompany', 'fCoRole', 'fCoHiring', 'fCoOpen', 'fCoBody', 'fCoClose', 'fNationality', 'fDob', 'fFurigana', 'fLanguages', 'fDrivingLicence', 'fJpRequest'];
  var simpleFieldMap = {
    fName: 'name', fTitle: 'title', fEmail: 'email', fPhone: 'phone', fLocation: 'location', fLinks: 'links',
    fSummary: 'summary', fSkills: 'skills', fExtra: 'extra',
    fCoCompany: 'coCompany', fCoRole: 'coRole', fCoHiring: 'coHiring', fCoOpen: 'coOpen', fCoBody: 'coBody', fCoClose: 'coClose',
    fNationality: 'nationality', fDob: 'dob', fFurigana: 'furigana', fLanguages: 'languages', fDrivingLicence: 'drivingLicence', fJpRequest: 'jpRequest'
  };

  function renderEntryLists() {
    var expList = el('expList');
    expList.innerHTML = '';
    state.experience.forEach(function (entry, i) {
      var block = document.createElement('div');
      block.className = 'entry-block';
      block.innerHTML =
        '<button type="button" class="entry-remove" data-kind="experience" data-idx="' + i + '">Remove</button>' +
        '<div class="field-row">' +
          '<div class="field"><label>Role</label><input data-kind="experience" data-idx="' + i + '" data-key="role" value="' + escapeHtml(entry.role) + '" placeholder="Job title"></div>' +
          '<div class="field"><label>Company</label><input data-kind="experience" data-idx="' + i + '" data-key="company" value="' + escapeHtml(entry.company) + '" placeholder="Company"></div>' +
        '</div>' +
        '<div class="field"><label>Dates</label><input data-kind="experience" data-idx="' + i + '" data-key="dates" value="' + escapeHtml(entry.dates) + '" placeholder="2023 — Present"></div>' +
        '<div class="field"><label>Bullets (one per line)</label><textarea data-kind="experience" data-idx="' + i + '" data-key="bullets" rows="3" placeholder="What you actually did/shipped.">' + escapeHtml(entry.bullets) + '</textarea></div>';
      expList.appendChild(block);
    });

    var eduList = el('eduList');
    eduList.innerHTML = '';
    state.education.forEach(function (entry, i) {
      var block = document.createElement('div');
      block.className = 'entry-block';
      block.innerHTML =
        '<button type="button" class="entry-remove" data-kind="education" data-idx="' + i + '">Remove</button>' +
        '<div class="field-row">' +
          '<div class="field"><label>Degree / program</label><input data-kind="education" data-idx="' + i + '" data-key="degree" value="' + escapeHtml(entry.degree) + '" placeholder="Degree, field"></div>' +
          '<div class="field"><label>School</label><input data-kind="education" data-idx="' + i + '" data-key="school" value="' + escapeHtml(entry.school) + '" placeholder="Institution"></div>' +
        '</div>' +
        '<div class="field"><label>Dates</label><input data-kind="education" data-idx="' + i + '" data-key="dates" value="' + escapeHtml(entry.dates) + '" placeholder="2021 — 2025"></div>';
      eduList.appendChild(block);
    });
  }

  function bulletList(text) {
    var lines = String(text || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) return '';
    return '<ul>' + lines.map(function (l) { return '<li>' + escapeHtml(l) + '</li>'; }).join('') + '</ul>';
  }

  // Plain "- line" text instead of <ul><li>, so the .txt download always carries
  // a literal dash — <li> bullet glyphs are CSS-only and don't reliably survive innerText.
  function bulletListPlain(text) {
    var lines = String(text || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) return '';
    return lines.map(function (l) { return '<div>- ' + escapeHtml(l) + '</div>'; }).join('');
  }

  // Splits a free-text "start — end" range. End is blank when the range reads
  // as ongoing (Present/Current/etc.) so callers can render an in-progress label.
  function splitDateRange(datesStr) {
    var s = String(datesStr || '').trim();
    if (!s) return { start: '', end: '', ongoing: false };
    var parts = s.split(/\s*(?:—|-|to)\s*/i).filter(Boolean);
    var start = parts[0] || '';
    var end = parts[1] || '';
    var ongoing = !end || /present|current|now|ongoing/i.test(end);
    return { start: start, end: ongoing ? '' : end, ongoing: ongoing };
  }

  function calcAge(dobStr) {
    if (!dobStr) return null;
    var dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return null;
    var today = new Date();
    var age = today.getFullYear() - dob.getFullYear();
    var m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }

  function renderResumeOrCv(isCv, targetId) {
    var contactBits = [state.email, state.phone, state.location, state.links].filter(Boolean).map(escapeHtml).join('  •  ');
    var html = '';
    html += '<h2 class="doc-name">' + (escapeHtml(state.name) || 'Your Name') + '</h2>';
    if (state.title) html += '<div class="doc-contact"><strong>' + escapeHtml(state.title) + '</strong></div>';
    html += '<div class="doc-contact">' + (contactBits || '<span class="empty-hint">Add contact details on the left</span>') + '</div>';

    if (state.summary) {
      html += '<div class="doc-h">Summary</div><p>' + escapeHtml(state.summary) + '</p>';
    }

    var expEntries = state.experience.filter(function (e) { return e.role || e.company; });
    if (expEntries.length) {
      html += '<div class="doc-h">Experience</div>';
      expEntries.forEach(function (e) {
        html += '<div class="doc-entry"><div class="doc-entry-title">' + escapeHtml(e.role || 'Role') + (e.company ? ' — ' + escapeHtml(e.company) : '') + '</div>';
        if (e.dates) html += '<div class="doc-entry-meta">' + escapeHtml(e.dates) + '</div>';
        html += bulletList(e.bullets) + '</div>';
      });
    }

    var eduEntries = state.education.filter(function (e) { return e.degree || e.school; });
    if (eduEntries.length) {
      html += '<div class="doc-h">Education</div>';
      eduEntries.forEach(function (e) {
        html += '<div class="doc-entry"><div class="doc-entry-title">' + escapeHtml(e.degree || 'Degree') + (e.school ? ' — ' + escapeHtml(e.school) : '') + '</div>';
        html += e.dates ? '<div class="doc-entry-meta">' + escapeHtml(e.dates) + '</div>' : '';
        html += '</div>';
      });
    }

    if (state.skills) {
      html += '<div class="doc-h">Skills</div><p>' + escapeHtml(state.skills) + '</p>';
    }

    if (isCv && state.extra) {
      html += '<div class="doc-h">Certifications, Publications &amp; Projects</div>' + bulletList(state.extra);
    }

    if (!state.name && !state.summary && !expEntries.length && !eduEntries.length) {
      html += '<p class="empty-hint">Start typing on the left — this updates live.</p>';
    }

    el(targetId).innerHTML = html;
  }

  function renderCover() {
    var today = new Date();
    var dateStr = today.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    var html = '';
    html += '<h2 class="doc-name">' + (escapeHtml(state.name) || 'Your Name') + '</h2>';
    var contactBits = [state.email, state.phone, state.location].filter(Boolean).map(escapeHtml).join('  •  ');
    html += '<div class="doc-contact">' + contactBits + '</div>';
    html += '<p class="letter-p" style="margin-top:18px;">' + escapeHtml(dateStr) + '</p>';
    html += '<p class="letter-p">' + escapeHtml(state.coHiring || 'Hiring Manager') + (state.coCompany ? '<br>' + escapeHtml(state.coCompany) : '') + '</p>';
    html += '<p class="letter-p">Dear ' + escapeHtml(state.coHiring || 'Hiring Manager') + ',</p>';

    var opening = state.coOpen || (state.coRole && state.coCompany
      ? 'I am writing to apply for the ' + state.coRole + ' position at ' + state.coCompany + '.'
      : '');
    if (opening) html += '<p class="letter-p">' + escapeHtml(opening) + '</p>';

    if (state.coBody) {
      html += '<p class="letter-p">' + escapeHtml(state.coBody) + '</p>';
    } else if (state.summary) {
      html += '<p class="letter-p">' + escapeHtml(state.summary) + '</p>';
    }

    if (state.coClose) {
      html += '<p class="letter-p">' + escapeHtml(state.coClose) + '</p>';
    } else {
      html += '<p class="letter-p">Thank you for your time and consideration. I would welcome the chance to discuss how I can contribute to the team.</p>';
    }

    html += '<p class="letter-p">Sincerely,<br>' + (escapeHtml(state.name) || 'Your Name') + '</p>';

    if (!state.name && !state.coCompany && !state.coOpen) {
      html = '<p class="empty-hint">Fill in the cover letter fields below the education section — this updates live.</p>' + html;
    }

    el('previewCover').innerHTML = html;
  }

  // ATS-friendly: single column, plain section labels, no decorative markup —
  // Summary / Skills / Work Experience / Education / Certifications, in that
  // order, which is the ordering ATS parsers are most reliably tuned for.
  function renderAts(targetId) {
    var html = '';
    html += '<h2 class="doc-name">' + (escapeHtml(state.name) || 'Your Name') + '</h2>';
    var contactBits = [state.email, state.phone, state.location, state.links].filter(Boolean).map(escapeHtml).join(' | ');
    html += '<div class="doc-contact">' + (contactBits || '<span class="empty-hint">Add contact details on the left</span>') + '</div>';

    if (state.summary) html += '<div class="doc-h">Summary</div><p>' + escapeHtml(state.summary) + '</p>';
    if (state.skills) html += '<div class="doc-h">Skills</div><p>' + escapeHtml(state.skills) + '</p>';

    var expEntries = state.experience.filter(function (e) { return e.role || e.company; });
    if (expEntries.length) {
      html += '<div class="doc-h">Work Experience</div>';
      expEntries.forEach(function (e) {
        html += '<div class="doc-entry"><div class="doc-entry-title">' + escapeHtml(e.role || 'Role') + (e.company ? ' - ' + escapeHtml(e.company) : '') + '</div>';
        if (e.dates) html += '<div class="doc-entry-meta">' + escapeHtml(e.dates) + '</div>';
        html += bulletListPlain(e.bullets) + '</div>';
      });
    }

    var eduEntries = state.education.filter(function (e) { return e.degree || e.school; });
    if (eduEntries.length) {
      html += '<div class="doc-h">Education</div>';
      eduEntries.forEach(function (e) {
        html += '<div class="doc-entry"><div class="doc-entry-title">' + escapeHtml(e.degree || 'Degree') + (e.school ? ' - ' + escapeHtml(e.school) : '') + '</div>';
        html += e.dates ? '<div class="doc-entry-meta">' + escapeHtml(e.dates) + '</div>' : '';
        html += '</div>';
      });
    }

    if (state.extra) html += '<div class="doc-h">Certifications</div>' + bulletListPlain(state.extra);

    if (!state.name && !expEntries.length && !eduEntries.length) {
      html += '<p class="empty-hint">Start typing on the left — this updates live.</p>';
    }
    el(targetId).innerHTML = html;
  }

  // Europass CV — the standard EU section set: Personal information, Work
  // experience (dates / occupation / activities / employer), Education and
  // training, Personal skills (languages, driving licence), Additional info.
  function renderEuropass(targetId) {
    var html = '';
    html += '<h2 class="doc-name">Curriculum Vitae Europass</h2>';
    html += '<div class="doc-h">Personal Information</div>';
    html += '<p><strong>' + (escapeHtml(state.name) || 'Your Name') + '</strong></p>';
    var addrBits = [state.location, state.phone, state.email].filter(Boolean).map(escapeHtml).join(' | ');
    if (addrBits) html += '<p>' + addrBits + '</p>';
    var natDob = [
      state.nationality ? 'Nationality: ' + escapeHtml(state.nationality) : '',
      state.dob ? 'Date of birth: ' + escapeHtml(state.dob) : ''
    ].filter(Boolean).join('  ');
    if (natDob) html += '<p>' + natDob + '</p>';

    var expEntries = state.experience.filter(function (e) { return e.role || e.company; });
    if (expEntries.length) {
      html += '<div class="doc-h">Work Experience</div>';
      expEntries.forEach(function (e) {
        html += '<div class="doc-entry">';
        if (e.dates) html += '<div class="doc-entry-meta">' + escapeHtml(e.dates) + '</div>';
        html += '<div>Occupation or position held: <strong>' + escapeHtml(e.role || '—') + '</strong></div>';
        if (e.bullets) html += '<div>Main activities and responsibilities:</div>' + bulletListPlain(e.bullets);
        if (e.company) html += '<div>Name and address of employer: ' + escapeHtml(e.company) + '</div>';
        html += '</div>';
      });
    }

    var eduEntries = state.education.filter(function (e) { return e.degree || e.school; });
    if (eduEntries.length) {
      html += '<div class="doc-h">Education and Training</div>';
      eduEntries.forEach(function (e) {
        html += '<div class="doc-entry">';
        if (e.dates) html += '<div class="doc-entry-meta">' + escapeHtml(e.dates) + '</div>';
        html += '<div>Title of qualification awarded: <strong>' + escapeHtml(e.degree || '—') + '</strong></div>';
        if (e.school) html += '<div>Name and type of organisation: ' + escapeHtml(e.school) + '</div>';
        html += '</div>';
      });
    }

    html += '<div class="doc-h">Personal Skills</div>';
    if (state.languages) html += '<div>Mother tongue / other language(s): ' + escapeHtml(state.languages) + '</div>';
    if (state.skills) html += '<div>Job-related skills: ' + escapeHtml(state.skills) + '</div>';
    if (state.drivingLicence) html += '<div>Driving licence: ' + escapeHtml(state.drivingLicence) + '</div>';

    if (state.extra) html += '<div class="doc-h">Additional Information</div>' + bulletListPlain(state.extra);

    if (!state.name && !expEntries.length && !eduEntries.length) {
      html += '<p class="empty-hint">Start typing on the left — this updates live.</p>';
    }
    el(targetId).innerHTML = html;
  }

  // Japanese rirekisho (履歴書) — name with furigana reading, date of birth,
  // a merged 学歴・職歴 history (each entry expands to its own 入学/卒業 or
  // 入社/退社 line, as the real form does), licenses, and 本人希望記入欄.
  function renderJapanese(targetId) {
    var html = '';
    html += '<h2 class="doc-name">履歴書 (Rirekisho)</h2>';
    html += '<div class="doc-contact">' + escapeHtml(new Date().toLocaleDateString()) + '</div>';

    html += '<div class="doc-h">Personal Information</div>';
    var nameLine = escapeHtml(state.name) || 'Your Name';
    if (state.furigana) nameLine += ' (' + escapeHtml(state.furigana) + ')';
    html += '<p><strong>' + nameLine + '</strong></p>';
    var age = calcAge(state.dob);
    if (state.dob) html += '<p>Date of birth: ' + escapeHtml(state.dob) + (age !== null ? ' (Age ' + age + ')' : '') + '</p>';
    var contactBits = [state.location, state.phone, state.email].filter(Boolean).map(escapeHtml).join(' | ');
    if (contactBits) html += '<p>' + contactBits + '</p>';

    var history = [];
    state.education.filter(function (e) { return e.degree || e.school; }).forEach(function (e) {
      var r = splitDateRange(e.dates);
      var label = escapeHtml(e.school || e.degree);
      if (r.start) history.push({ date: r.start, text: label + ' 入学 (Enrolled)' });
      if (r.end) history.push({ date: r.end, text: label + ' 卒業 (Graduated)' });
      else if (r.ongoing) history.push({ date: '—', text: label + ' 在学中 (Currently enrolled)' });
    });
    state.experience.filter(function (e) { return e.role || e.company; }).forEach(function (e) {
      var r = splitDateRange(e.dates);
      var label = escapeHtml(e.company || e.role);
      if (r.start) history.push({ date: r.start, text: label + ' 入社 (Joined)' });
      if (r.end) history.push({ date: r.end, text: label + ' 退社 (Left)' });
      else if (r.ongoing) history.push({ date: '—', text: label + ' 現在に至る (To present)' });
    });

    if (history.length) {
      html += '<div class="doc-h">学歴・職歴 (Education &amp; Work History)</div>';
      history.forEach(function (h) {
        html += '<div class="doc-entry"><div class="doc-entry-meta">' + escapeHtml(h.date) + '</div><div>' + h.text + '</div></div>';
      });
    }

    if (state.extra) html += '<div class="doc-h">免許・資格 (Licenses &amp; Qualifications)</div>' + bulletListPlain(state.extra);

    var request = state.jpRequest || state.summary;
    html += '<div class="doc-h">本人希望記入欄 (Personal Requests)</div>';
    html += request ? '<p>' + escapeHtml(request) + '</p>' : '<p class="empty-hint">None specified.</p>';

    if (!state.name && !history.length) {
      html += '<p class="empty-hint">Start typing on the left — this updates live.</p>';
    }
    el(targetId).innerHTML = html;
  }

  function render() {
    renderResumeOrCv(false, 'previewResume');
    renderResumeOrCv(true, 'previewCv');
    renderCover();
    renderAts('previewAts');
    renderEuropass('previewEuropass');
    renderJapanese('previewJapanese');
  }

  function collectSimpleFields() {
    simpleFieldIds.forEach(function (id) {
      var node = el(id);
      if (node) state[simpleFieldMap[id]] = node.value;
    });
  }

  function applyStateToInputs() {
    simpleFieldIds.forEach(function (id) {
      var node = el(id);
      if (node) node.value = state[simpleFieldMap[id]] || '';
    });
    renderEntryLists();
  }

  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        var note = el('saveNote');
        note.innerHTML = 'Draft saved to this browser <span class="ok">✓</span> — nothing is sent anywhere.';
      } catch (e) { /* storage unavailable — draft just won't persist */ }
    }, 400);
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      applyLoadedData(JSON.parse(raw));
    } catch (e) { /* corrupt or missing draft — start fresh */ }
  }

  function applyLoadedData(saved) {
    if (!saved || typeof saved !== 'object') return;
    Object.keys(state).forEach(function (k) {
      if (saved[k] !== undefined) state[k] = saved[k];
    });
    if (!Array.isArray(state.experience) || !state.experience.length) state.experience = [{ role: '', company: '', dates: '', bullets: '' }];
    if (!Array.isArray(state.education) || !state.education.length) state.education = [{ degree: '', school: '', dates: '' }];
  }

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (simpleFieldIds.indexOf(t.id) !== -1) {
      collectSimpleFields();
      render();
      scheduleSave();
      return;
    }
    var kind = t.getAttribute && t.getAttribute('data-kind');
    if (kind === 'experience' || kind === 'education') {
      var idx = parseInt(t.getAttribute('data-idx'), 10);
      var key = t.getAttribute('data-key');
      state[kind][idx][key] = t.value;
      render();
      scheduleSave();
    }
  });

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'addExp') {
      state.experience.push({ role: '', company: '', dates: '', bullets: '' });
      renderEntryLists(); render(); scheduleSave();
    } else if (t.id === 'addEdu') {
      state.education.push({ degree: '', school: '', dates: '' });
      renderEntryLists(); render(); scheduleSave();
    } else if (t.classList && t.classList.contains('entry-remove')) {
      var kind = t.getAttribute('data-kind');
      var idx = parseInt(t.getAttribute('data-idx'), 10);
      state[kind].splice(idx, 1);
      if (!state[kind].length) {
        state[kind].push(kind === 'experience' ? { role: '', company: '', dates: '', bullets: '' } : { degree: '', school: '', dates: '' });
      }
      renderEntryLists(); render(); scheduleSave();
    } else if (t.classList && t.classList.contains('format-opt')) {
      selectFormat(t.getAttribute('data-format'));
    } else if (t.id === 'btnPrint') {
      document.body.removeAttribute('data-print-only');
      window.print();
    } else if (t.id === 'btnPrintSelected') {
      document.body.setAttribute('data-print-only', selectedFormat);
      window.print();
    } else if (t.classList && t.classList.contains('mini-btn') && t.getAttribute('data-download')) {
      downloadTxt(t.getAttribute('data-download'));
    } else if (t.id === 'btnExportJson') {
      exportJson();
    } else if (t.id === 'btnImportJson') {
      el('importJsonFile').click();
    } else if (t.id === 'btnClear') {
      if (confirm('Clear the saved draft and reset the form?')) {
        try { localStorage.removeItem(STORAGE_KEY); } catch (err) {}
        location.reload();
      }
    }
  });

  el('importJsonFile').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        applyLoadedData(JSON.parse(String(reader.result)));
        applyStateToInputs();
        render();
        scheduleSave();
      } catch (err) {
        alert('That file is not a valid draft (expected the JSON this page exports).');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  var previewIdByDoc = {
    resume: 'previewResume', cv: 'previewCv', cover: 'previewCover',
    ats: 'previewAts', europass: 'previewEuropass', japanese: 'previewJapanese'
  };
  function downloadTxt(docType) {
    var text = el(previewIdByDoc[docType] || 'previewResume').innerText;
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, (state.name ? state.name.replace(/\s+/g, '_') : 'draft') + '_' + docType + '.txt');
  }

  function exportJson() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8' });
    triggerDownload(blob, (state.name ? state.name.replace(/\s+/g, '_') : 'draft') + '.json');
  }

  loadDraft();
  applyStateToInputs();
  render();
  selectFormat('resume');
})();
