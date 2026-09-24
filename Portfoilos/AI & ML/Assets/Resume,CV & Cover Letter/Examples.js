/**
 * Example resume/CV drafts — real background (Imaad Ullah Khan Yameen),
 * reframed for each of the site's portfolio fields. Same facts, dates and
 * employers throughout; only the title/summary/skills emphasis and which
 * bullets are foregrounded change per field. Loaded by Builder.js — never
 * fetched over the network, so this works fully offline.
 */
(function () {
  'use strict';

  var EDU = [
    { degree: 'BSc Industrial Engineering', school: 'UET Peshawar — CGPA 3.75/4.00, 3rd Position (FYDP 2025)', dates: 'Sept 2021 — Aug 2025' }
  ];

  var BLANK_EXTRAS = {
    coCompany: '', coRole: '', coHiring: '', coOpen: '', coBody: '', coClose: '',
    nationality: '', dob: '', furigana: '', languages: '', drivingLicence: '', jpRequest: ''
  };

  var CONTACT = {
    name: 'Imaad Ullah Khan Yameen',
    email: 'yameenimaad@gmail.com',
    phone: '+92-344-9295545',
    location: 'Peshawar, KPK, Pakistan',
    links: 'linkedin.com/in/imaad-ullah-khan-yameen  •  github.com/yameenimaad'
  };

  function draft(fields) {
    var d = {};
    Object.keys(CONTACT).forEach(function (k) { d[k] = CONTACT[k]; });
    Object.keys(BLANK_EXTRAS).forEach(function (k) { d[k] = BLANK_EXTRAS[k]; });
    d.education = EDU;
    Object.keys(fields).forEach(function (k) { d[k] = fields[k]; });
    return d;
  }

  window.RESUME_EXAMPLES = {
    industrial: draft({
      title: 'Industrial Engineer | Lean Six Sigma & Quality Systems',
      summary: 'Industrial engineering graduate (UET Peshawar, CGPA 3.75/4.00, 3rd Position — FYDP 2025) with hands-on experience across manufacturing operations, mold design, and quality systems. Lean Six Sigma Yellow Belt and ISO 9001:2015 QMS trained, with practical background in CNC machining and FDM/SLA 3D printing operations.',
      skills: 'Lean Six Sigma, Quality Assurance & Control, Process Optimization, Project Management (MS Project, Primavera P6), CNC & FDM/SLA Operations, Minitab/SPSS, Arena Simulation, AutoCAD, SolidWorks, Fusion360',
      experience: [
        { role: 'Graduate Engineer Trainee', company: 'PCSIR, Peshawar, KPK', dates: '2026.04 — Present', bullets: 'Worked on FDM 3D printers — operations, functions, and project-related tasks.\nWorked in the CNC workstation on calibration, maintenance, and observation of VMC machines.' },
        { role: 'Mechanical CAD Designer', company: 'SK Engineering, Jalozai', dates: '2026.01 — 2026.02', bullets: 'Designed precise molds for industrial injection molding systems.\nValidated production quality using custom Go/No-Go gauges.\nOptimized mechanical designs to reduce manufacturing lead times.' },
        { role: 'Internship Trainee', company: 'SK Engineering & Manufacturing, Jalozai', dates: '2024.06 — 2024.09', bullets: 'Implemented Lean principles to eliminate operational waste.\nStandardized workflows using Job Cards and Machine Control Cards.' },
        { role: 'Internship Trainee', company: 'Dewan Cement Limited, Hattar', dates: '2023.06 — 2023.08', bullets: 'Gained hands-on knowledge of machine operations and cement production processes.' },
        { role: 'Deputy Design Head', company: 'IISE Student Chapter, UET Peshawar', dates: '2023.09 — 2025.06', bullets: 'Led the design team for international engineering symposiums.\nEstablished the visual identity for society events and technical workshops.' }
      ],
      extra: 'Lean Six Sigma Yellow Belt — Kennesaw State University\nISO 9001:2015 QMS — Alison\nISO 9001 QMS for SMEs — NPO.gov.pk\nOccupational Health & Safety — TSDC\nAgile Project Management — HP Life'
    }),

    mechanical: draft({
      title: 'Mechanical CAD Designer | SolidWorks, AutoCAD & Fusion360',
      summary: 'Mechanical CAD designer specializing in mold design, injection-molding validation, and precision part design in SolidWorks, AutoCAD, and Fusion360 — with hands-on FDM/SLA 3D-printing operations experience.',
      skills: 'SolidWorks, AutoCAD, Fusion360, Mold & Tooling Design, GD&T / Go-No-Go Gauging, FDM 3D Printing (Cura, PrusaSlicer, OrcaSlicer, Bambu Studio), SLA 3D Printing',
      experience: [
        { role: 'Mechanical CAD Designer', company: 'SK Engineering, Jalozai', dates: '2026.01 — 2026.02', bullets: 'Designed precise molds for industrial injection molding systems.\nValidated production quality using custom Go/No-Go gauges.\nOptimized mechanical designs to reduce manufacturing lead times.' },
        { role: 'Graduate Engineer Trainee', company: 'PCSIR, Peshawar, KPK', dates: '2026.04 — Present', bullets: 'Operated and maintained FDM 3D printers for prototyping and project work.\nSupported CNC workstation calibration and maintenance of VMC machines.' },
        { role: 'Freelance CAD Designer', company: 'Remote', dates: '2023.01 — Present', bullets: 'Delivered mechanical CAD projects using SolidWorks, AutoCAD, and Fusion360.' },
        { role: 'Deputy Design Head', company: 'IISE Student Chapter, UET Peshawar', dates: '2023.09 — 2025.06', bullets: 'Led the design team for international engineering symposiums and technical workshops.' }
      ],
      extra: 'SolidWorks CAD Design — Dassault Systèmes\nFDM 3D Printing — HP Life\nSLA 3D Printing — Sinterit\nMaster Structural Design of Buildings — Yeforum.org'
    }),

    software: draft({
      title: 'Software Developer | Python, JavaScript & Web',
      summary: 'Engineer with a hands-on programming background spanning Python automation, JavaScript/Three.js web development, and SQL — built an autonomous UAV navigation system and a fully offline, interactive portfolio site with multiple in-browser tools.',
      skills: 'Python, JavaScript, Three.js, React.js, SQL, SQLite, Git, VS Code',
      experience: [
        { role: 'Freelance Developer', company: 'Remote', dates: '2023.01 — Present', bullets: 'Built web development projects using Three.js, React.js, and SQL.\nDelivered mechanical CAD-to-web visualization work bridging engineering and front-end code.' },
        { role: 'Personal / Academic Projects', company: '', dates: '2023 — 2025', bullets: 'Built an autonomous UAV inventory-control navigation system in Python (Final Year Design Project — 3rd Position, UET Peshawar 2025).\nDeveloped a 3D solar system visualization using Three.js and JavaScript.\nBuilt a fully offline portfolio site with SQLite-backed Python/JavaScript tools (forecasting, NLP, image processing, resume builder).' },
        { role: 'Deputy Design Head', company: 'IISE Student Chapter, UET Peshawar', dates: '2023.09 — 2025.06', bullets: 'Established the visual/brand identity and web presence for society events.' }
      ],
      extra: 'HTML — Sololearn\nMS Office — Coursera / BGMC'
    }),

    ai: draft({
      title: 'AI/ML Enthusiast | Applied Python & Deep Learning Fundamentals',
      summary: 'Industrial engineer with applied AI/ML exposure — NVIDIA Deep Learning Fundamentals certified, built rule-based NLP and regression-forecasting tools from scratch, and an autonomous Python-based UAV navigation system.',
      skills: 'Python, Deep Learning Fundamentals, Regression & Forecasting, Rule-Based NLP, Data Ethics, SQL/SQLite',
      experience: [
        { role: 'Personal / Academic Projects', company: '', dates: '2023 — 2025', bullets: 'Built and documented offline regression-forecasting, image-processing, and text-humanizing tools (Python + SQLite, mirrored to JavaScript for a fully offline in-browser lab).\nBuilt an autonomous UAV inventory-control navigation system in Python (Final Year Design Project — 3rd Position, UET Peshawar 2025).' },
        { role: 'Graduate Engineer Trainee', company: 'PCSIR, Peshawar, KPK', dates: '2026.04 — Present', bullets: 'Applied data-driven observation and process analysis to FDM printing and CNC machine operations.' }
      ],
      extra: 'Fundamentals of Deep Learning — NVIDIA\nAI For Beginners — HP Life\nDrones for Environmental Science — Duke University'
    }),

    embedded: draft({
      title: 'Embedded Systems | UAV & Sensor Systems',
      summary: 'Background in embedded and UAV systems integration — built an autonomous Python-based UAV navigation and inventory-tracking system, trained in drone operations for environmental science, and experienced with CNC/FDM machine operations.',
      skills: 'UAV Operation, Embedded Python, Sensor Integration, CNC Machine Operations, FDM/SLA 3D Printing',
      experience: [
        { role: 'Personal / Academic Projects', company: '', dates: '2023 — 2025', bullets: 'Built an autonomous UAV inventory-control navigation system in Python (Final Year Design Project — 3rd Position, UET Peshawar 2025).' },
        { role: 'Graduate Engineer Trainee', company: 'PCSIR, Peshawar, KPK', dates: '2026.04 — Present', bullets: 'Operated FDM 3D printers and supported CNC workstation calibration and maintenance of VMC machines.' }
      ],
      extra: 'Drones for Environmental Science — Duke University\nFDM 3D Printing — HP Life'
    }),

    graphics: draft({
      title: '3D & Visualization Designer | Three.js, CAD & 3D Printing',
      summary: 'Designer bridging mechanical CAD and interactive 3D graphics — Three.js web visualizations, SolidWorks/Fusion360 mechanical models, Canva/Illustrator visual design, and FDM/SLA 3D printing.',
      skills: 'Three.js, SolidWorks, Fusion360, Canva, Adobe Illustrator, Affinity, DaVinci Resolve, FDM/SLA 3D Printing',
      experience: [
        { role: 'Personal / Academic Projects', company: '', dates: '2023 — 2025', bullets: 'Developed a 3D solar system visualization using Three.js and JavaScript.\nDesigned automated mold models in SolidWorks for high-efficiency injection molding.' },
        { role: 'Deputy Design Head', company: 'IISE Student Chapter, UET Peshawar', dates: '2023.09 — 2025.06', bullets: 'Led the design team and established visual/brand identity for international engineering symposiums.' },
        { role: 'Freelance CAD & Web Designer', company: 'Remote', dates: '2023.01 — Present', bullets: 'Delivered mechanical CAD projects (SolidWorks, AutoCAD, Fusion360) and web visualization projects (Three.js, React.js).' }
      ],
      extra: 'Canva (2D Designing) — Coursera\nFDM 3D Printing — HP Life\nSLA 3D Printing — Sinterit\nSolidWorks CAD Design — Dassault Systèmes'
    }),

    gis: draft({
      title: 'GIS & Remote Sensing | UAV-Based Data Collection',
      summary: 'Industrial engineering background applied to UAV-based data collection — trained in drone operations for environmental science (Duke University) and built an autonomous Python navigation system for automated tracking.',
      skills: 'UAV Operation & Remote Sensing, Python Data Automation, Environmental Data Collection, Observation & Analytical Skills',
      experience: [
        { role: 'Personal / Academic Projects', company: '', dates: '2023 — 2025', bullets: 'Built an autonomous UAV inventory-control navigation system in Python (Final Year Design Project — 3rd Position, UET Peshawar 2025), applying automated tracking over large-scale physical spaces.' },
        { role: 'Graduate Engineer Trainee', company: 'PCSIR, Peshawar, KPK', dates: '2026.04 — Present', bullets: 'Applied observation and monitoring skills to CNC and 3D-printing operations.' }
      ],
      extra: 'Drones for Environmental Science — Duke University'
    })
  };

  window.RESUME_EXAMPLE_LABELS = {
    industrial: 'Industrial Engineering',
    mechanical: 'Mechanical CAD / CADCAMCAE',
    software: 'Programming / Software',
    ai: 'AI & ML',
    embedded: 'Embedded Systems',
    graphics: '3D & Graphics',
    gis: 'GIS & Remote Sensing'
  };
})();
