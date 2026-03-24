(function () {
'use strict';

/* =========================================================
   STORAGE & DATA LAYER
   ========================================================= */
var SK = { U: 'nll_users', O: 'nll_orders', ME: 'nll_me', CAL: 'nll_calendar' };

function jGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function jSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

function initDB() {
  if (!jGet(SK.U)) {
    jSet(SK.U, [
      { id: 'u1', email: 'student@nll.com', password: '1234', role: 'user',  name: 'Alex Student' },
      { id: 'u2', email: 'admin@nll.com',   password: '1234', role: 'admin', name: 'Admin NLL'    }
    ]);
  }
  if (!jGet(SK.O))   jSet(SK.O, []);
  if (!jGet(SK.CAL)) jSet(SK.CAL, []);
}

function getUsers()      { return jGet(SK.U)   || []; }
function getOrders()     { return jGet(SK.O)   || []; }
function saveOrders(arr) { jSet(SK.O, arr); }
function getMe()         { return jGet(SK.ME); }
function setMe(u)        { u ? jSet(SK.ME, u) : localStorage.removeItem(SK.ME); }
function getCalEvents()  { return jGet(SK.CAL) || []; }
function saveCalEvents(arr) { jSet(SK.CAL, arr); }

function tryLogin(email, pwd) {
  var u = getUsers().find(function (x) { return x.email === email && x.password === pwd; });
  if (!u) return { ok: false, err: 'Invalid email or password' };
  setMe({ id: u.id, email: u.email, role: u.role, name: u.name });
  return { ok: true, role: u.role };
}

function tryRegister(email, pwd, name) {
  var users = getUsers();
  if (users.find(function (u) { return u.email === email; }))
    return { ok: false, err: 'Email already in use' };
  var nu = { id: 'u' + Date.now(), email: email, password: pwd, role: 'user', name: name || email.split('@')[0] };
  jSet(SK.U, users.concat([nu]));
  return { ok: true };
}

function createOrder(product) {
  var me = getMe(); if (!me) return;
  var o = {
    id: 'ord_' + Date.now(),
    userId: me.id, userName: me.name, userEmail: me.email,
    product: product, status: 'pending', ts: new Date().toISOString()
  };
  saveOrders(getOrders().concat([o]));
  return o;
}

function approveOrder(id) {
  saveOrders(getOrders().map(function (o) {
    return o.id === id ? Object.assign({}, o, { status: 'approved' }) : o;
  }));
}

/* ── FIX: logout properly clears session then re-renders auth ── */
function logout() {
  setMe(null);
  renderAuth();
}

function getAnalytics() {
  var o = getOrders();
  return {
    users:    getUsers().length,
    total:    o.length,
    approved: o.filter(function (x) { return x.status === 'approved'; }).length,
    pending:  o.filter(function (x) { return x.status === 'pending';  }).length
  };
}

/* =========================================================
   NOTIFICATION / TOAST SYSTEM
   ========================================================= */
var _notifTimer = null;

function showToast(title, body, type) {
  var existing = document.getElementById('nll-toast');
  if (existing) existing.remove();
  if (_notifTimer) clearTimeout(_notifTimer);

  var colors = {
    warning: { bg: 'rgba(255,193,7,0.22)',     icon: 'fa-bell',           color: 'var(--yellow)' },
    urgent:  { bg: 'rgba(255,107,107,0.22)',    icon: 'fa-triangle-exclamation', color: 'var(--accent4)' },
    info:    { bg: 'rgba(79,142,255,0.22)',      icon: 'fa-circle-info',   color: 'var(--accent)' },
    success: { bg: 'rgba(0,212,170,0.22)',       icon: 'fa-circle-check',  color: 'var(--accent3)' }
  };
  var c = colors[type] || colors.info;

  var toast = document.createElement('div');
  toast.id = 'nll-toast';
  toast.className = 'notif-toast';
  toast.innerHTML =
    '<div class="notif-icon" style="background:' + c.bg + ';color:' + c.color + '">' +
    '<i class="fas ' + c.icon + '"></i></div>' +
    '<div style="flex:1"><div class="notif-title">' + title + '</div>' +
    '<div class="notif-body">' + body + '</div></div>' +
    '<button class="notif-close" onclick="document.getElementById(\'nll-toast\').remove()">' +
    '<i class="fas fa-times"></i></button>';
  document.body.appendChild(toast);
  _notifTimer = setTimeout(function () {
    var t = document.getElementById('nll-toast');
    if (t) t.remove();
  }, 7000);
}

/* check upcoming calendar events and fire notifications */
function checkCalendarNotifications() {
  var events = getCalEvents();
  if (!events.length) return;
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var seen = jGet('nll_notif_seen') || {};

  events.forEach(function (ev) {
    var evDate = new Date(ev.date + 'T00:00:00');
    var diff = Math.round((evDate - today) / (1000 * 60 * 60 * 24));
    var key = ev.id + '_' + diff;
    if (seen[key]) return;

    var typeLabel = { test: 'Test', assignment: 'Assignment', exam: 'Exam', other: 'Event' }[ev.type] || 'Event';

    if (diff === 0) {
      seen[key] = true;
      jSet('nll_notif_seen', seen);
      setTimeout(function () {
        showToast('📅 Today: ' + typeLabel, '"' + ev.title + '" is scheduled for TODAY!', 'urgent');
      }, 1500);
    } else if (diff === 1) {
      seen[key] = true;
      jSet('nll_notif_seen', seen);
      setTimeout(function () {
        showToast('⚠️ Tomorrow: ' + typeLabel, '"' + ev.title + '" is due TOMORROW. Get ready!', 'warning');
      }, 1500);
    } else if (diff === 3) {
      seen[key] = true;
      jSet('nll_notif_seen', seen);
      setTimeout(function () {
        showToast('🔔 Upcoming ' + typeLabel, '"' + ev.title + '" is in 3 days (' + ev.date + ')', 'info');
      }, 1500);
    }
  });
}

/* =========================================================
   MOCK NOTES DATA
   ========================================================= */
var MOCK_NOTES = [
  {
    id: 'n1', title: 'Mathematics — Functions & Graphs', subject: 'Mathematics', grade: 'Grade 12',
    pages: 18, size: '1.2 MB', icon: '📐', color: 'var(--accent)',
    content: [
      { h: 'Chapter 1: Introduction to Functions' },
      { p: 'A function is a relation where each input (x-value) has exactly one output (y-value). We write f(x) = y.' },
      { h: 'Types of Functions' },
      { p: 'Linear: f(x) = mx + c | Quadratic: f(x) = ax² + bx + c | Exponential: f(x) = a·bˣ | Logarithmic: f(x) = log_a(x)' },
      { h: 'Key Concepts: Domain & Range' },
      { p: 'Domain = all valid x-values. Range = all resulting y-values. Always check for division by zero and square roots of negatives.' },
      { h: 'Transformation of Functions' },
      { p: 'f(x) + k → vertical shift up by k\nf(x - h) → horizontal shift right by h\n-f(x) → reflection over x-axis\nf(-x) → reflection over y-axis' },
      { h: 'Exam Tips' },
      { p: '1. Always sketch the graph first.\n2. Label intercepts clearly.\n3. State the domain and range in set notation.\n4. Check asymptotes for exponential and log functions.' }
    ]
  },
  {
    id: 'n2', title: 'Physical Sciences — Newton\'s Laws', subject: 'Physical Sciences', grade: 'Grade 11',
    pages: 22, size: '1.8 MB', icon: '⚡', color: 'var(--accent3)',
    content: [
      { h: 'Newton\'s Three Laws of Motion' },
      { p: 'These laws form the foundation of classical mechanics and are essential for the Physical Sciences examination.' },
      { h: 'First Law — Law of Inertia' },
      { p: 'An object at rest stays at rest, and an object in motion stays in motion with the same speed and direction, unless acted upon by an unbalanced force.' },
      { h: 'Second Law — F = ma' },
      { p: 'The acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass. Formula: Fnet = ma (SI unit: Newton = kg·m/s²)' },
      { h: 'Third Law — Action-Reaction' },
      { p: 'For every action there is an equal and opposite reaction. Forces always occur in pairs — but act on DIFFERENT objects.' },
      { h: 'Worked Example' },
      { p: 'A 5 kg box is pushed with 20 N. Friction = 8 N. Find acceleration.\nFnet = 20 - 8 = 12 N\na = Fnet/m = 12/5 = 2.4 m/s²' },
      { h: 'Diagrams: Free Body Diagrams' },
      { p: 'Always draw a FBD showing: Normal force (N) upward, Weight (W = mg) downward, Applied force (F) horizontal, Friction (f) opposing motion.' }
    ]
  },
  {
    id: 'n3', title: 'English — Essay Writing Guide', subject: 'English Home Language', grade: 'Grade 12',
    pages: 14, size: '0.9 MB', icon: '✍️', color: 'var(--accent2)',
    content: [
      { h: 'Essay Writing: Structure & Technique' },
      { p: 'A well-structured essay is the key to top marks in English. Follow this guide for both formal and creative essays.' },
      { h: 'The Five-Paragraph Structure' },
      { p: '1. Introduction — Hook + Background + Thesis Statement\n2. Body Paragraph 1 — Topic sentence + Evidence + Analysis\n3. Body Paragraph 2 — Topic sentence + Evidence + Analysis\n4. Body Paragraph 3 — Topic sentence + Evidence + Analysis\n5. Conclusion — Restate thesis + Summary + Closing thought' },
      { h: 'Writing a Strong Thesis' },
      { p: 'Your thesis must: make a claim, be specific, be arguable, and appear at the end of your introduction. Avoid "In this essay I will…"' },
      { h: 'Formal vs Informal Register' },
      { p: 'Formal: No contractions, objective tone, academic vocabulary.\nInformal: Conversational, personal pronouns allowed, expressive language.' },
      { h: 'Vocabulary Bank — Transition Words' },
      { p: 'Adding: Furthermore, Moreover, In addition\nContrasting: However, Nevertheless, On the other hand\nConcluding: Therefore, Thus, In conclusion, Ultimately' }
    ]
  },
  {
    id: 'n4', title: 'Life Sciences — Cell Biology', subject: 'Life Sciences', grade: 'Grade 11',
    pages: 26, size: '2.1 MB', icon: '🔬', color: '#ff9800',
    content: [
      { h: 'Cell Biology: The Building Blocks of Life' },
      { p: 'All living organisms are made of cells. Understanding cell structure is fundamental to Life Sciences.' },
      { h: 'Prokaryotic vs Eukaryotic Cells' },
      { p: 'Prokaryotic: No membrane-bound nucleus, no organelles, smaller (e.g. bacteria)\nEukaryotic: Has nucleus and organelles, larger (e.g. animal & plant cells)' },
      { h: 'Key Organelles and Functions' },
      { p: 'Nucleus → controls cell activities & contains DNA\nMitochondria → produces ATP energy (aerobic respiration)\nRibosome → protein synthesis\nEndoplasmic Reticulum → transport network\nGolgi Apparatus → packages & exports proteins\nChloroplast → photosynthesis (plant cells only)\nCell Wall → support & protection (plant cells only)\nVacuole → storage (large in plants, small in animals)' },
      { h: 'Cell Division: Mitosis' },
      { p: 'Stages: Interphase → Prophase → Metaphase → Anaphase → Telophase → Cytokinesis\nResult: 2 identical daughter cells (used for growth & repair)' },
      { h: 'Meiosis' },
      { p: 'Produces 4 genetically different cells (gametes). Involves 2 rounds of division. Reduces chromosome number by half (haploid).' }
    ]
  },
  {
    id: 'n5', title: 'Economics — Supply & Demand', subject: 'Economics', grade: 'Grade 11',
    pages: 16, size: '1.1 MB', icon: '📈', color: 'var(--yellow)',
    content: [
      { h: 'The Law of Demand' },
      { p: 'As price increases, quantity demanded decreases (inverse relationship). Shown by a downward-sloping demand curve.' },
      { h: 'The Law of Supply' },
      { p: 'As price increases, quantity supplied increases (direct relationship). Shown by an upward-sloping supply curve.' },
      { h: 'Market Equilibrium' },
      { p: 'Equilibrium = point where supply curve meets demand curve. At equilibrium: Quantity Demanded = Quantity Supplied. There is no surplus or shortage.' },
      { h: 'Shifts in Demand' },
      { p: 'Demand shifts RIGHT (increases) when: Income rises (normal goods), Population grows, Tastes change favourably, Prices of substitutes rise.\nDemand shifts LEFT (decreases) when: Opposite of above.' },
      { h: 'Price Elasticity of Demand (PED)' },
      { p: 'PED = % change in Qd / % change in Price\nElastic: PED > 1 (luxury goods)\nInelastic: PED < 1 (necessities like bread, medicine)\nUnitary: PED = 1' }
    ]
  },
  {
    id: 'n6', title: 'Accounting — Financial Statements', subject: 'Accounting', grade: 'Grade 12',
    pages: 30, size: '2.4 MB', icon: '🧾', color: 'var(--accent4)',
    content: [
      { h: 'Income Statement (P&L)' },
      { p: 'Shows profitability over a period. Format:\nRevenue (Sales)\n– Cost of Sales\n= Gross Profit\n– Operating Expenses\n= Operating Profit\n– Interest & Tax\n= Net Profit After Tax' },
      { h: 'Balance Sheet (Statement of Financial Position)' },
      { p: 'Shows financial position on a specific date.\nASSETS = LIABILITIES + OWNERS\' EQUITY\n\nNon-Current Assets: Land, Buildings, Equipment\nCurrent Assets: Inventory, Debtors, Cash\n\nNon-Current Liabilities: Long-term loans\nCurrent Liabilities: Creditors, Bank overdraft\n\nOwners\' Equity: Share capital + Retained earnings' },
      { h: 'Cash Flow Statement' },
      { p: 'Three sections:\n1. Operating Activities (day-to-day business)\n2. Investing Activities (buying/selling assets)\n3. Financing Activities (loans, share issues, dividends)' },
      { h: 'Key Accounting Ratios' },
      { p: 'Gross Profit %: (GP / Sales) × 100\nNet Profit %: (NP / Sales) × 100\nCurrent Ratio: Current Assets / Current Liabilities (ideal: 2:1)\nDebt-Equity Ratio: Total Debt / Equity' }
    ]
  }
];

/* =========================================================
   DIGITAL LIBRARY DATA
   ========================================================= */
var LIBRARY = {
  A: [
    { t: 'Adaptive Learning Systems',       a: 'Dr. James Owusu',        cat: 'Technology',    icon: '🤖' },
    { t: 'Advanced Mathematics Grade 12',   a: 'P. Nkosi & M. Dlamini', cat: 'Mathematics',   icon: '📐' },
    { t: 'African History: A Complete Guide',a: 'Thabo Molefe',          cat: 'History',       icon: '🌍' },
    { t: 'Accounting Principles & Practice',a: 'S. van Rooyen',          cat: 'Accounting',    icon: '🧾' }
  ],
  B: [
    { t: 'Basic Science Concepts',          a: 'Linda van der Berg',     cat: 'Science',       icon: '🔬' },
    { t: 'Business Studies 101',            a: 'R. Ferreira',            cat: 'Business',      icon: '💼' },
    { t: 'Brain-Based Learning Strategies', a: 'Dr. N. Khoza',           cat: 'Education',     icon: '🧠' },
    { t: 'Biology: Life Processes',         a: 'T. Moodley',             cat: 'Biology',       icon: '🌿' }
  ],
  C: [
    { t: 'Chemistry: Matter & Change',      a: 'Sipho Dube',             cat: 'Science',       icon: '⚗️' },
    { t: 'Computer Science Essentials',     a: 'A. Patel',               cat: 'Technology',    icon: '💻' },
    { t: 'Creative Writing Workshop',       a: 'Naledi Mokoena',         cat: 'Language',      icon: '✍️' },
    { t: 'Civics & Social Responsibility',  a: 'Dr. F. Sithole',         cat: 'Social Science',icon: '🏛️' }
  ],
  D: [
    { t: 'Data Science for Beginners',      a: 'Marcus Lee',             cat: 'Technology',    icon: '📊' },
    { t: 'Democracy & Citizenship SA',      a: 'Dr. F. Botha',           cat: 'Social Science',icon: '🗳️' },
    { t: 'Drama & Theatre Arts',            a: 'B. Nkosi',               cat: 'Arts',          icon: '🎭' }
  ],
  E: [
    { t: 'Economics Grade 11',              a: 'T. Shabangu',            cat: 'Economics',     icon: '📈' },
    { t: 'English Grammar in Use (SA Ed.)', a: 'R. Murphy',              cat: 'Language',      icon: '📖' },
    { t: 'Environmental Science Today',     a: 'C. Naidoo',              cat: 'Science',       icon: '🌱' },
    { t: 'Engineering Fundamentals',        a: 'Prof. D. Hassan',        cat: 'Engineering',   icon: '⚙️' }
  ],
  F: [
    { t: 'Financial Literacy for Youth',    a: 'B. Mahlangu',            cat: 'Finance',       icon: '💰' },
    { t: 'Forces & Motion in Physics',      a: 'Dr. V. Pillay',          cat: 'Science',       icon: '⚡' },
    { t: 'Food & Nutrition Science',        a: 'L. Dlamini',             cat: 'Health',        icon: '🥗' }
  ],
  G: [
    { t: 'Geography of Southern Africa',    a: 'L. de Beer',             cat: 'Geography',     icon: '🗺️' },
    { t: 'Grade 10 Study Guide Bundle',     a: 'NLL Editorial Team',     cat: 'Multi-subject', icon: '📚' },
    { t: 'Graphic Design Principles',       a: 'M. Sithole',             cat: 'Arts',          icon: '🎨' }
  ],
  H: [
    { t: 'History of South Africa',         a: 'Prof. B. Ntuli',         cat: 'History',       icon: '🏅' },
    { t: 'Human Biology Grade 12',          a: 'S. Govender',            cat: 'Biology',       icon: '🫀' },
    { t: 'Health Sciences Essentials',      a: 'Dr. T. Abrahams',        cat: 'Health',        icon: '🏥' }
  ],
  I: [
    { t: 'Introduction to AI & ML',         a: 'Dr. K. Chen',            cat: 'Technology',    icon: '🤖' },
    { t: 'IsiZulu for Beginners',           a: 'M. Zwane',               cat: 'Language',      icon: '🗣️' },
    { t: 'Industrial Technology Grade 11',  a: 'N. Hadebe',              cat: 'Technology',    icon: '🔩' }
  ],
  J: [
    { t: 'Junior Science Experiments',      a: 'T. Abrahams',            cat: 'Science',       icon: '🧪' },
    { t: 'JavaScript for Beginners',        a: 'P. Mokoena',             cat: 'Technology',    icon: '💻' }
  ],
  K: [
    { t: 'Key Concepts in Economics',       a: 'N. Molete',              cat: 'Economics',     icon: '🔑' },
    { t: 'Knowledge Management in Educ.',   a: 'Dr. P. Tshivhase',       cat: 'Education',     icon: '📋' }
  ],
  L: [
    { t: 'Life Orientation Complete',       a: 'NLL Editorial Team',     cat: 'Life Skills',   icon: '🌟' },
    { t: 'Life Sciences Grade 11',          a: 'D. Maharaj',             cat: 'Biology',       icon: '🌱' },
    { t: 'Literacy & Reading Development',  a: 'Mojaki Finger',          cat: 'Literacy',      icon: '📑' },
    { t: 'Law for Everyday South Africans', a: 'Adv. K. Motsepe',        cat: 'Law',           icon: '⚖️' }
  ],
  M: [
    { t: 'Mathematics Literacy Grade 12',   a: 'F. Sithole',             cat: 'Mathematics',   icon: '🔢' },
    { t: 'Mind Mapping for Study Success',  a: 'T. Letsoko',             cat: 'Study Skills',  icon: '🧭' },
    { t: 'Music Theory Fundamentals',       a: 'A. Ntanzi',              cat: 'Arts',          icon: '🎵' }
  ],
  N: [
    { t: 'Natural Sciences Grade 9',        a: 'B. Essack',              cat: 'Science',       icon: '🔭' },
    { t: 'Nutrition & Health Science',      a: 'Dr. A. Mthembu',         cat: 'Health',        icon: '🥦' },
    { t: 'Network Administration Basics',   a: 'C. Dlamini',             cat: 'Technology',    icon: '🌐' }
  ],
  O: [
    { t: 'Office Administration Textbook',  a: 'N. Scholtz',             cat: 'Business',      icon: '🖨️' },
    { t: 'Organic Chemistry Explained',     a: 'Dr. R. Moyo',            cat: 'Science',       icon: '🧬' }
  ],
  P: [
    { t: 'Physical Science Grade 12',       a: 'M. Govender',            cat: 'Science',       icon: '⚛️' },
    { t: 'Programming with Python',         a: 'S. Nakedi',              cat: 'Technology',    icon: '🐍' },
    { t: 'Public Speaking & Debate',        a: 'L. Mahlangu',            cat: 'Language',      icon: '🎤' }
  ],
  Q: [
    { t: 'Quantitative Research Methods',   a: 'Dr. L. Mabaso',          cat: 'Research',      icon: '📉' },
    { t: 'Quality Management Principles',   a: 'B. van der Merwe',       cat: 'Business',      icon: '🏆' }
  ],
  R: [
    { t: 'Reading Comprehension Skills',    a: 'NLL THRASS Team',        cat: 'Literacy',      icon: '📰' },
    { t: 'Religious Studies Overview',      a: 'T. Fakude',              cat: 'Humanities',    icon: '☮️' },
    { t: 'Robotics & Automation Intro',     a: 'Dr. S. Mokoena',         cat: 'Technology',    icon: '🤖' }
  ],
  S: [
    { t: 'STEM Fundamentals',               a: 'K. Hadebe',              cat: 'Multi-subject', icon: '🔩' },
    { t: 'South African Law Basics',        a: 'Adv. P. Ntanzi',         cat: 'Law',           icon: '⚖️' },
    { t: 'Statistics & Probability',        a: 'Dr. D. Nel',             cat: 'Mathematics',   icon: '📊' },
    { t: 'Setswana Language Grade 9',       a: 'M. Mokgatlhe',           cat: 'Language',      icon: '🗣️' }
  ],
  T: [
    { t: 'THRASS: Teaching Phonics',        a: 'Mojaki Finger',          cat: 'Literacy',      icon: '🔤' },
    { t: 'Technology in the Classroom',     a: 'Dr. T. Mashishi',        cat: 'Education',     icon: '🖥️' },
    { t: 'Tourism Grade 11',                a: 'P. Sithole',             cat: 'Business',      icon: '✈️' }
  ],
  U: [
    { t: 'Understanding Accounting',        a: 'R. Sithole',             cat: 'Accounting',    icon: '🧾' },
    { t: 'Ubuntu Philosophy in Education',  a: 'Prof. N. Zulu',          cat: 'Philosophy',    icon: '🤝' }
  ],
  V: [
    { t: 'Visual Arts Grade 10',            a: 'L. Bhengu',              cat: 'Arts',          icon: '🎨' },
    { t: 'Vocabulary Builder Advanced',     a: 'NLL Editorial Team',     cat: 'Language',      icon: '📝' }
  ],
  W: [
    { t: 'World Geography Today',           a: 'A. Mabaso',              cat: 'Geography',     icon: '🌐' },
    { t: 'Writing Skills for Matric',       a: 'NLL Editorial Team',     cat: 'Language',      icon: '✏️' },
    { t: 'Web Development Fundamentals',    a: 'T. Lekota',              cat: 'Technology',    icon: '💻' }
  ],
  X: [
    { t: 'Xhosa Language & Literature',     a: 'N. Mbobo',               cat: 'Language',      icon: '🌺' },
    { t: 'XML & Data Structures',           a: 'P. Mahlangu',            cat: 'Technology',    icon: '🗂️' }
  ],
  Y: [
    { t: 'Youth Financial Planning',        a: 'B. Cele',                cat: 'Finance',       icon: '🏦' },
    { t: 'Yoga & Mindfulness for Students', a: 'Dr. L. Nkosi',           cat: 'Life Skills',   icon: '🧘' }
  ],
  Z: [
    { t: 'Zulu Heritage & Culture',         a: 'Prof. Z. Ngubane',       cat: 'Culture',       icon: '🥁' },
    { t: 'Zero to Hero: Matric Prep',       a: 'NLL Editorial Team',     cat: 'Multi-subject', icon: '🚀' }
  ]
};

var BOOK_COLORS = ['#4f8eff','#a259ff','#00d4aa','#ff6b6b','#ffc107','#ff9800','#e91e63','#00bcd4'];

/* =========================================================
   DOM ROOT
   ========================================================= */
var ROOT = document.getElementById('app-root');
function setHTML(html) { ROOT.innerHTML = html; }

/* =========================================================
   SMALL HELPERS
   ========================================================= */
function ic(cls, style) {
  return '<i class="fas ' + cls + '"' + (style ? ' style="' + style + '"' : '') + '></i>';
}
function badge(txt, cls) {
  return '<span class="badge badge-' + cls + '">' + txt + '</span>';
}
function mkBtn(content, classes, onclick, style) {
  return '<button class="btn ' + classes + '" onclick="' + onclick + '"' +
    (style ? ' style="' + style + '"' : '') + '>' + content + '</button>';
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* =========================================================
   AUTH PAGE
   ========================================================= */
function renderAuth() {
  var activeTab = 'login';
  var errMsg = '';

  function formHtml() {
    if (activeTab === 'login') {
      return '<div class="field">' +
        '<label>' + ic('fa-envelope', 'margin-right:5px;opacity:.55') + ' Email address</label>' +
        '<input id="a-email" type="email" placeholder="student@nll.com" value="student@nll.com">' +
        '</div>' +
        '<div class="field">' +
        '<label>' + ic('fa-lock', 'margin-right:5px;opacity:.55') + ' Password</label>' +
        '<input id="a-pass" type="password" placeholder="Your password" value="1234">' +
        '</div>' +
        mkBtn(ic('fa-arrow-right-to-bracket') + ' Sign In', 'btn-primary btn-full', 'window._authLogin()') +
        '<p style="text-align:center;font-size:11.5px;color:var(--dim);margin-top:14px">' +
        ic('fa-circle-info', 'margin-right:4px') +
        'Demo: student@nll.com / 1234 &nbsp;|&nbsp; admin@nll.com / 1234</p>';
    } else {
      return '<div class="field">' +
        '<label>' + ic('fa-user', 'margin-right:5px;opacity:.55') + ' Full Name</label>' +
        '<input id="r-name" type="text" placeholder="Your full name">' +
        '</div>' +
        '<div class="field">' +
        '<label>' + ic('fa-envelope', 'margin-right:5px;opacity:.55') + ' Email</label>' +
        '<input id="r-email" type="email" placeholder="you@email.com">' +
        '</div>' +
        '<div class="field">' +
        '<label>' + ic('fa-lock', 'margin-right:5px;opacity:.55') + ' Password</label>' +
        '<input id="r-pass" type="password" placeholder="Choose a strong password">' +
        '</div>' +
        mkBtn(ic('fa-user-plus') + ' Create Account', 'btn-primary btn-full', 'window._authRegister()');
    }
  }

  function draw() {
    setHTML(
      '<div class="auth-wrap">' +
      '<div class="glass2 auth-card fade-in">' +
      '<div style="text-align:center;margin-bottom:30px">' +
      '<div style="width:60px;height:60px;background:linear-gradient(135deg,var(--accent),var(--accent2));border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 16px">' +
      ic('fa-graduation-cap', 'color:white') +
      '</div>' +
      '<h2 style="font-size:23px;font-weight:800">Next Level Learning</h2>' +
      '<p style="color:var(--muted);font-size:13.5px;margin-top:5px">AI-Powered Education Hub</p>' +
      '</div>' +
      '<div class="auth-tabs">' +
      '<button class="auth-tab ' + (activeTab === 'login'    ? 'active' : '') + '" onclick="window._authTab(\'login\')">Sign In</button>' +
      '<button class="auth-tab ' + (activeTab === 'register' ? 'active' : '') + '" onclick="window._authTab(\'register\')">Register</button>' +
      '</div>' +
      formHtml() +
      '<div id="auth-err" style="color:var(--accent4);font-size:13px;text-align:center;margin-top:14px;min-height:20px">' + errMsg + '</div>' +
      '</div></div>'
    );
  }

  window._authTab = function (t) { activeTab = t; errMsg = ''; draw(); };

  window._authLogin = function () {
    var email = (document.getElementById('a-email') || {}).value || '';
    var pass  = (document.getElementById('a-pass')  || {}).value || '';
    var res = tryLogin(email.trim(), pass);
    if (res.ok) {
      if (res.role === 'admin') renderAdmin();
      else renderUser();
    } else {
      errMsg = res.err; draw();
    }
  };

  window._authRegister = function () {
    var name  = (document.getElementById('r-name')  || {}).value || '';
    var email = (document.getElementById('r-email') || {}).value || '';
    var pass  = (document.getElementById('r-pass')  || {}).value || '';
    if (!email || !pass) { errMsg = 'Please fill in all fields'; draw(); return; }
    var res = tryRegister(email.trim(), pass, name.trim());
    if (res.ok) { tryLogin(email.trim(), pass); renderUser(); }
    else { errMsg = res.err; draw(); }
  };

  draw();
}

/* =========================================================
   USER DASHBOARD
   ========================================================= */
function renderUser() {
  var me = getMe();
  if (!me || me.role !== 'user') { renderAuth(); return; }

  var curTab = 'dashboard';
  var chatLog = [{ from: 'ai', text: 'Hello ' + me.name.split(' ')[0] + '! I\'m your AI Study Assistant. Ask me anything about your coursework.' }];

  /* ── NAVBAR ── */
  function navHtml() {
    var tabs = [
      ['dashboard', 'fa-gauge',       'Dashboard'],
      ['ai-tools',  'fa-robot',       'AI Tools'],
      ['library',   'fa-book-open',   'Library'],
      ['orders',    'fa-box',         'My Orders'],
      ['media',     'fa-circle-play', 'Media'],
      ['calendar',  'fa-calendar',    'Calendar']
    ];
    var tabBtns = '';
    tabs.forEach(function (t) {
      tabBtns += '<button class="tab-btn ' + (curTab === t[0] ? 'active' : '') +
        '" onclick="window._uSwitch(\'' + t[0] + '\')">' + ic(t[1]) + '<span>' + t[2] + '</span></button>';
    });
    return '<nav class="navbar">' +
      '<div class="logo">' +
      '<div class="logo-icon">' + ic('fa-brain', 'color:white') + '</div>' +
      '<span>NLL Hub</span></div>' +
      '<div class="tab-bar">' + tabBtns + '</div>' +
      '<div style="display:flex;align-items:center;gap:14px">' +
      '<span style="font-size:13px;color:var(--muted)">' + ic('fa-circle-user', 'margin-right:5px') + me.name + '</span>' +
      '<button class="btn btn-danger" onclick="window._doLogout()" style="padding:8px 15px">' +
      ic('fa-power-off') + ' Logout</button>' +
      '</div></nav>';
  }

  /* expose logout so the inline onclick can reach it */
  window._doLogout = function () { logout(); };

  /* ── DASHBOARD TAB ── */
  function tabDashboard() {
    var stats = [
      ['fa-chalkboard-user', '12', 'Courses Enrolled',  'rgba(79,142,255,.15)',  'var(--accent)'],
      ['fa-circle-check',    '3',  'Completed',          'rgba(0,212,170,.15)',   'var(--accent3)'],
      ['fa-fire-flame-curved','5 days','Learning Streak','rgba(162,89,255,.15)',  'var(--accent2)'],
      ['fa-star',            '88%','Avg. Score',         'rgba(255,193,7,.14)',   'var(--yellow)']
    ];
    var statsHtml = '<div class="grid-4" style="margin-top:4px">';
    stats.forEach(function (s) {
      statsHtml += '<div class="glass stat-card">' +
        '<div class="stat-icon" style="background:' + s[3] + ';color:' + s[4] + '">' + ic(s[0]) + '</div>' +
        '<div class="stat-num">' + s[1] + '</div>' +
        '<div class="stat-label">' + s[2] + '</div></div>';
    });
    statsHtml += '</div>';

    var actions = [
      ['fa-shopping-cart', 'Order THRASS Kit',   'Literacy materials',  'rgba(79,142,255,.14)',  'var(--accent)',  "window._uOrder('THRASS Literacy Kit')"],
      ['fa-book-open',     'Order Workbooks',    'Full grade sets',     'rgba(0,212,170,.14)',   'var(--accent3)', "window._uOrder('Learning Workbooks Set')"],
      ['fa-books',         'Browse Library',     'All materials A-Z',   'rgba(162,89,255,.14)',  'var(--accent2)', "window._uSwitch('library')"],
      ['fa-file-user',     'AI CV Builder',      'Generate your CV',    'rgba(255,107,107,.14)', 'var(--accent4)', 'window._openCV()'],
      ['fa-robot',         'AI Tutor Chat',      'Ask anything',        'rgba(255,193,7,.12)',   'var(--yellow)',  "window._uSwitch('ai-tools')"],
      ['fa-circle-play',   'Video Lessons',      'Watch & learn',       'rgba(0,212,170,.12)',   'var(--accent3)', "window._uSwitch('media')"],
      ['fa-file-pdf',      'Download Notes',     'PDF study guides',    'rgba(79,142,255,.12)',  'var(--accent)',  'window._openNotes()'],
      ['fa-chart-line',    'View Progress',      'See your analytics',  'rgba(162,89,255,.12)',  'var(--accent2)', 'window._openProgress()']
    ];
    var actHtml = '<div class="grid-4">';
    actions.forEach(function (a) {
      actHtml += '<div class="action-card" onclick="' + a[5] + '">' +
        '<div class="action-icon" style="background:' + a[3] + ';color:' + a[4] + '">' + ic(a[0]) + '</div>' +
        '<div class="action-title">' + a[1] + '</div>' +
        '<div class="action-sub">' + a[2] + '</div></div>';
    });
    actHtml += '</div>';

    var subjects = [
      ['Mathematics',     74, 'var(--accent)'],
      ['Physical Science',59, 'var(--accent3)'],
      ['English',         88, 'var(--accent2)'],
      ['Life Sciences',   42, 'var(--accent4)'],
      ['Economics',       66, 'var(--yellow)']
    ];
    var progHtml = '';
    subjects.forEach(function (s) {
      progHtml += '<div style="margin-bottom:14px">' +
        '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">' +
        '<span>' + s[0] + '</span>' +
        '<span style="color:' + s[2] + ';font-weight:700">' + s[1] + '%</span></div>' +
        '<div class="prog-bar"><div class="prog-fill" style="width:' + s[1] + '%;background:' + s[2] + '"></div></div>' +
        '</div>';
    });

    var activity = [
      [ic('fa-circle-check'), 'Completed Quiz: Algebra Basics',      '2 hours ago',  'rgba(0,212,170,.14)'],
      [ic('fa-box'),          'Ordered THRASS Literacy Kit',          'Yesterday',    'rgba(79,142,255,.14)'],
      [ic('fa-circle-play'),  'Watched: Reading Comprehension',       '2 days ago',   'rgba(162,89,255,.14)'],
      [ic('fa-robot'),        'AI Tutor Session — 32 messages',       '3 days ago',   'rgba(255,107,107,.12)'],
      [ic('fa-download'),     'Downloaded: Physical Science Notes',   '4 days ago',   'rgba(255,193,7,.12)']
    ];
    var actFeed = '';
    activity.forEach(function (a) {
      actFeed += '<div style="display:flex;gap:13px;align-items:flex-start;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.05)">' +
        '<div style="width:34px;height:34px;border-radius:9px;background:' + a[3] + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px">' + a[0] + '</div>' +
        '<div><div style="font-size:13.5px">' + a[1] + '</div><div style="font-size:11.5px;color:var(--dim);margin-top:2px">' + a[2] + '</div></div>' +
        '</div>';
    });

    return '<div class="fade-in">' +
      statsHtml +
      '<div class="glass p-6 mt-5"><div class="section-title">' + ic('fa-bolt', 'color:var(--accent)') + 'Quick Actions</div>' + actHtml + '</div>' +
      '<div class="grid-2 mt-5">' +
      '<div class="glass p-6"><div class="section-title" style="font-size:17px">' + ic('fa-chart-line', 'color:var(--accent2)') + 'Learning Progress</div>' + progHtml + '</div>' +
      '<div class="glass p-6"><div class="section-title" style="font-size:17px">' + ic('fa-bell', 'color:var(--accent)') + 'Recent Activity</div>' + actFeed + '</div>' +
      '</div></div>';
  }

  /* ── AI TOOLS TAB ── */
  function tabAITools() {
    var chatHtml = '';
    chatLog.forEach(function (m) {
      chatHtml += '<div style="display:flex;gap:9px;align-items:flex-end;' + (m.from === 'user' ? 'flex-direction:row-reverse' : '') + '">' +
        '<div style="width:30px;height:30px;border-radius:50%;flex-shrink:0;background:' +
        (m.from === 'ai' ? 'linear-gradient(135deg,var(--accent),var(--accent2))' : 'linear-gradient(135deg,var(--accent2),var(--accent4))') +
        ';display:flex;align-items:center;justify-content:center;font-size:13px">' +
        ic(m.from === 'ai' ? 'fa-robot' : 'fa-user', 'color:white') +
        '</div>' +
        '<div class="chat-bubble ' + m.from + '">' + escHtml(m.text) + '</div></div>';
    });

    var quizAnswers = ['Personalised learning paths', 'Automating grading only', 'Both personalisation & automation', 'Replacing all teachers'];
    var quizHtml = '';
    quizAnswers.forEach(function (opt, i) {
      quizHtml += '<div class="quiz-opt" id="qo' + i + '" onclick="window._pickQ(' + i + ',' + (i === 2 ? 1 : 0) + ')">' +
        '<div style="width:21px;height:21px;border-radius:50%;border:2px solid rgba(255,255,255,.2);flex-shrink:0"></div>' +
        opt + '</div>';
    });

    var recs = [
      ['Introduction to Data Science',    'Beginner',     'badge-blue'],
      ['Machine Learning Foundations',    'Intermediate', 'badge-purple'],
      ['Python for Educators',            'Beginner',     'badge-green'],
      ['Advanced Statistics',             'Advanced',     'badge-yellow']
    ];
    var recHtml = '';
    recs.forEach(function (r) {
      recHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.05)">' +
        '<span style="font-size:13.5px;font-weight:500">' + r[0] + '</span>' +
        badge(r[1], r[2].replace('badge-', '')) +
        '</div>';
    });

    var labs = [
      ['fa-bolt',          'Circuits Lab',    'var(--accent)'],
      ['fa-code',          'Code Sandbox',    'var(--accent2)'],
      ['fa-chart-column',  'Data Viz',        'var(--accent3)'],
      ['fa-network-wired', 'Network Sim',     'var(--accent4)'],
      ['fa-flask',         'Chemistry Lab',   'var(--yellow)'],
      ['fa-calculator',    'Math Solver',     'var(--accent)']
    ];
    var labHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    labs.forEach(function (l) {
      labHtml += '<div style="padding:14px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);cursor:pointer;display:flex;align-items:center;gap:11px;transition:.2s" onmouseover="this.style.background=\'rgba(255,255,255,.09)\'" onmouseout="this.style.background=\'rgba(255,255,255,.04)\'">' +
        ic(l[0], 'color:' + l[2] + ';font-size:17px;width:20px;text-align:center') +
        '<span style="font-size:13px;font-weight:500">' + l[1] + '</span></div>';
    });
    labHtml += '</div>';

    return '<div class="fade-in grid-2" style="gap:18px">' +

      '<div class="glass p-6">' +
      '<div class="section-title" style="font-size:17px">' + ic('fa-robot', 'color:var(--accent)') + 'AI Study Assistant</div>' +
      '<div id="chat-win" style="height:268px;overflow-y:auto;display:flex;flex-direction:column;gap:11px;padding:2px 0">' + chatHtml + '</div>' +
      '<div style="display:flex;gap:9px;margin-top:13px">' +
      '<input id="chat-in" type="text" placeholder="Ask your AI tutor anything…" style="flex:1" onkeydown="if(event.key===\'Enter\')window._uChat()">' +
      '<button class="btn btn-primary" onclick="window._uChat()" style="padding:10px 17px;border-radius:10px">' + ic('fa-paper-plane') + '</button>' +
      '</div></div>' +

      '<div class="glass p-6">' +
      '<div class="section-title" style="font-size:17px">' + ic('fa-circle-question', 'color:var(--accent2)') + 'Quick Assessment</div>' +
      '<p style="font-size:13.5px;color:var(--muted);margin-bottom:14px">What is the primary benefit of AI in education?</p>' +
      '<div id="quiz-wrap">' + quizHtml + '</div>' +
      '<div id="quiz-fb" style="margin-top:8px;font-size:13.5px;min-height:20px"></div>' +
      '</div>' +

      '<div class="glass p-6">' +
      '<div class="section-title" style="font-size:17px">' + ic('fa-wand-magic-sparkles', 'color:var(--yellow)') + 'AI Recommendations</div>' +
      '<p style="font-size:13px;color:var(--muted);margin-bottom:12px">Based on your learning profile:</p>' +
      recHtml +
      mkBtn(ic('fa-arrow-right') + ' View all courses', 'btn-ghost', '', 'font-size:12.5px;width:100%;justify-content:center;margin-top:14px') +
      '</div>' +

      '<div class="glass p-6">' +
      '<div class="section-title" style="font-size:17px">' + ic('fa-microchip', 'color:var(--accent3)') + 'Simulation Labs</div>' +
      labHtml + '</div>' +
      '</div>';
  }

  /* ── LIBRARY TAB ── */
  function tabLibrary() {
    var selLetter = 'A';
    var searchQ   = '';

    function renderLibContent() {
      var letters = Object.keys(LIBRARY);
      var totalBooks = Object.values(LIBRARY).reduce(function (a, arr) { return a + arr.length; }, 0);

      var letterBtns = '';
      letters.forEach(function (l) {
        var isActive = !searchQ && selLetter === l;
        letterBtns += '<button onclick="window._libLetter(\'' + l + '\')" style="' +
          'width:35px;height:35px;border-radius:8px;' +
          'border:1px solid ' + (isActive ? 'var(--accent)' : 'rgba(255,255,255,.10)') + ';' +
          'background:' + (isActive ? 'rgba(79,142,255,.20)' : 'transparent') + ';' +
          'color:' + (isActive ? 'var(--accent)' : 'var(--muted)') + ';' +
          'cursor:pointer;font-family:Syne,sans-serif;font-weight:700;font-size:13px;transition:.15s">' + l + '</button>';
      });

      var showing;
      if (searchQ) {
        var q = searchQ.toLowerCase();
        showing = [];
        Object.values(LIBRARY).forEach(function (arr) {
          arr.forEach(function (b) {
            if (b.t.toLowerCase().indexOf(q) > -1 ||
                b.a.toLowerCase().indexOf(q) > -1 ||
                b.cat.toLowerCase().indexOf(q) > -1) {
              showing.push(b);
            }
          });
        });
      } else {
        showing = LIBRARY[selLetter] || [];
      }

      var bookHtml = '';
      if (!showing.length) {
        bookHtml = '<div style="text-align:center;padding:52px;color:var(--dim)">' +
          ic('fa-book-open', 'font-size:36px;display:block;margin-bottom:12px;opacity:.3') +
          '<p>No books found</p></div>';
      } else {
        showing.forEach(function (b, i) {
          var col = BOOK_COLORS[i % BOOK_COLORS.length];
          bookHtml += '<div class="book-card">' +
            '<div class="book-cover" style="background:' + col + '22;border:1px solid ' + col + '38">' + b.icon + '</div>' +
            '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + b.t + '</div>' +
            '<div style="font-size:12px;color:var(--muted);margin-top:3px">' + ic('fa-user-pen', 'margin-right:5px;opacity:.55') + b.a + '</div>' +
            '<div style="margin-top:7px">' + badge(b.cat, 'purple') + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-shrink:0">' +
            mkBtn(ic('fa-eye') + ' Preview', 'btn-ghost', '', 'padding:7px 13px;font-size:12px;border-radius:8px') +
            mkBtn(ic('fa-download'), 'btn-primary', '', 'padding:7px 13px;font-size:12px;border-radius:8px') +
            '</div></div>';
        });
      }

      document.getElementById('lib-inner').innerHTML =
        '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:20px">' + letterBtns + '</div>' +
        '<div style="display:flex;gap:10px;align-items:center;margin-bottom:20px">' +
        '<div style="position:relative;flex:1">' +
        ic('fa-magnifying-glass', 'position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--dim);font-size:13px') +
        '<input id="lib-search" type="text" placeholder="Search books, authors, subjects…" style="padding-left:38px" value="' + searchQ + '" oninput="window._libSearch(this.value)"></div>' +
        badge(ic('fa-book') + ' ' + showing.length + (searchQ ? '' : ' / ' + totalBooks) + ' titles', 'blue') +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:12px">' + bookHtml + '</div>';
    }

    window._libLetter = function (l) { selLetter = l; searchQ = ''; renderLibContent(); };
    window._libSearch  = function (s) { searchQ = s; renderLibContent(); };

    var total = Object.values(LIBRARY).reduce(function (a, arr) { return a + arr.length; }, 0);

    setTimeout(renderLibContent, 0);

    return '<div class="fade-in"><div class="glass p-6">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px;margin-bottom:22px">' +
      '<div>' +
      '<div class="section-title" style="margin-bottom:5px">' + ic('fa-books', 'color:var(--accent2)') + 'Digital Library</div>' +
      '<p style="font-size:13.5px;color:var(--muted)">All NLL learning materials organised A to Z. Browse, preview, and download.</p>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      badge(ic('fa-book') + ' ' + total + '+ Titles', 'blue') +
      badge(ic('fa-download') + ' Free Access', 'green') +
      badge(ic('fa-certificate') + ' Accredited', 'purple') +
      '</div></div>' +
      '<div id="lib-inner"></div>' +
      '</div></div>';
  }

  /* ── ORDERS TAB ── */
  function tabOrders() {
    var myOrders = getOrders().filter(function (o) { return o.userId === me.id; });
    var inner = '';

    if (!myOrders.length) {
      inner = '<div style="text-align:center;padding:52px;color:var(--dim)">' +
        ic('fa-box-open', 'font-size:42px;display:block;margin-bottom:14px;opacity:.3') +
        '<p style="font-size:14px">No orders yet.</p>' +
        mkBtn(ic('fa-shopping-cart') + ' Browse Products', 'btn-primary', "window._uSwitch('dashboard')", 'margin:18px auto 0;display:inline-flex') +
        '</div>';
    } else {
      var rows = '';
      myOrders.slice().reverse().forEach(function (o) {
        rows += '<tr>' +
          '<td>' + ic('fa-box', 'color:var(--accent);margin-right:8px') + o.product + '</td>' +
          '<td>' + badge((o.status === 'approved' ? ic('fa-circle-check') + ' ' : ic('fa-clock') + ' ') + o.status, o.status === 'approved' ? 'green' : 'yellow') + '</td>' +
          '<td style="color:var(--muted)">' + fmtDate(o.ts) + '</td>' +
          '<td style="font-size:11.5px;color:var(--dim);font-family:monospace">#' + o.id.slice(-8) + '</td>' +
          '</tr>';
      });
      inner = '<div class="overflow-x"><table>' +
        '<thead><tr><th>Product</th><th>Status</th><th>Date</th><th>Order ID</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>';
    }

    return '<div class="fade-in"><div class="glass p-6">' +
      '<div class="section-title">' + ic('fa-box-open', 'color:var(--accent)') + 'My Orders</div>' +
      inner + '</div></div>';
  }

  /* ── MEDIA TAB ── */
  function tabMedia() {
    var vids = [
      ['Understanding Phonics with THRASS',  'https://www.youtube.com/embed/5MgBikgcWnY', 'Literacy',     '15 min'],
      ['Study Skills & Memory Techniques',   'https://www.youtube.com/embed/p60rN9JEapg', 'Study Skills', '22 min']
    ];
    var vidHtml = '';
    vids.forEach(function (v) {
      vidHtml += '<div style="margin-bottom:18px">' +
        '<div style="border-radius:11px;overflow:hidden;border:1px solid rgba(255,255,255,.08)">' +
        '<iframe style="width:100%;height:185px;display:block" src="' + v[1] + '" frameborder="0" allowfullscreen></iframe>' +
        '</div>' +
        '<div style="margin-top:9px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">' +
        '<span style="font-size:13.5px;font-weight:500">' + v[0] + '</span>' +
        '<div style="display:flex;gap:6px">' + badge(v[2], 'purple') + badge(ic('fa-clock') + ' ' + v[3], 'blue') + '</div>' +
        '</div></div>';
    });

    var imgs = [
      ['https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400', 'Students studying'],
      ['https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400', 'Classroom'],
      ['https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400', 'Library'],
      ['https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=400', 'Tech learning']
    ];
    var imgHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    imgs.forEach(function (im) {
      imgHtml += '<img src="' + im[0] + '" alt="' + im[1] + '" style="width:100%;height:130px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,.08)">';
    });
    imgHtml += '</div>';

    return '<div class="fade-in grid-2" style="gap:18px">' +
      '<div class="glass p-6"><div class="section-title" style="font-size:17px">' + ic('fa-circle-play', 'color:var(--accent4)') + 'Video Lessons</div>' + vidHtml + '</div>' +
      '<div class="glass p-6"><div class="section-title" style="font-size:17px">' + ic('fa-images', 'color:var(--accent3)') + 'Learning Gallery</div>' +
      imgHtml +
      '<div style="margin-top:15px;padding:16px;background:rgba(79,142,255,.08);border:1px solid rgba(79,142,255,.16);border-radius:11px">' +
      '<div style="font-size:14px;font-weight:600;margin-bottom:6px">' + ic('fa-podcast', 'color:var(--accent);margin-right:7px') + 'NLL Learning Podcast</div>' +
      '<p style="font-size:12.5px;color:var(--muted)">Weekly learning strategies and study tips. New episodes every Monday.</p>' +
      mkBtn(ic('fa-play') + ' Listen Now', 'btn-primary', '', 'font-size:12.5px;padding:8px 16px;margin-top:12px') +
      '</div></div></div>';
  }

  /* ── CALENDAR TAB ── */
  function tabCalendar() {
    var now = new Date();
    var calYear  = now.getFullYear();
    var calMonth = now.getMonth(); // 0-indexed

    var typeColors = {
      test:       { dot: 'dot-test',   label: 'Test',       icon: 'fa-pencil' },
      assignment: { dot: 'dot-assign', label: 'Assignment', icon: 'fa-file-lines' },
      exam:       { dot: 'dot-exam',   label: 'Exam',       icon: 'fa-graduation-cap' },
      other:      { dot: 'dot-other',  label: 'Other',      icon: 'fa-circle-dot' }
    };

    var MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    var DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    function eventsForDate(dateStr) {
      return getCalEvents().filter(function (e) { return e.date === dateStr; });
    }

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

    function renderCalBody() {
      var el = document.getElementById('cal-body');
      if (!el) return;

      var firstDay = new Date(calYear, calMonth, 1).getDay();
      var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
      var todayStr = now.getFullYear() + '-' + pad2(now.getMonth()+1) + '-' + pad2(now.getDate());

      var html = '';
      DAYS.forEach(function (d) {
        html += '<div class="cal-day-label">' + d + '</div>';
      });

      for (var i = 0; i < firstDay; i++) {
        html += '<div class="cal-day empty"></div>';
      }

      for (var day = 1; day <= daysInMonth; day++) {
        var dateStr = calYear + '-' + pad2(calMonth+1) + '-' + pad2(day);
        var evs = eventsForDate(dateStr);
        var isToday = dateStr === todayStr;
        var hasEv   = evs.length > 0;

        html += '<div class="cal-day' + (isToday ? ' today' : '') + (hasEv ? ' has-event' : '') +
          '" onclick="window._calDayClick(\'' + dateStr + '\')">' +
          '<div class="cal-day-num">' + day + '</div>';
        evs.slice(0,2).forEach(function (e) {
          var tc = typeColors[e.type] || typeColors.other;
          html += '<span class="cal-event-dot ' + tc.dot + '">' + e.title + '</span>';
        });
        if (evs.length > 2) {
          html += '<span style="font-size:9px;color:var(--dim);padding-left:4px">+' + (evs.length-2) + ' more</span>';
        }
        html += '</div>';
      }

      el.innerHTML = html;
    }

    function renderEventList() {
      var el = document.getElementById('cal-event-list');
      if (!el) return;
      var events = getCalEvents().slice().sort(function (a,b) { return a.date.localeCompare(b.date); });
      var monthEvents = events.filter(function (e) {
        var d = new Date(e.date + 'T00:00:00');
        return d.getFullYear() === calYear && d.getMonth() === calMonth;
      });

      if (!monthEvents.length) {
        el.innerHTML = '<p style="color:var(--dim);font-size:13px;text-align:center;padding:18px 0">' +
          ic('fa-calendar-xmark', 'display:block;font-size:26px;margin-bottom:8px;opacity:.35') +
          'No events this month</p>';
        return;
      }

      var html = '';
      monthEvents.forEach(function (ev) {
        var tc = typeColors[ev.type] || typeColors.other;
        var evDate = new Date(ev.date + 'T00:00:00');
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var diff = Math.round((evDate - today) / (1000*60*60*24));
        var diffStr = diff === 0 ? badge('Today','red') :
                      diff === 1 ? badge('Tomorrow','yellow') :
                      diff > 0   ? badge('In ' + diff + ' days','blue') :
                                   badge('Past','purple');
        html += '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.05)">' +
          '<div style="width:38px;height:38px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;' +
          'background:rgba(162,89,255,.14);color:var(--accent2)">' + ic('fa-' + tc.icon.replace('fa-','')) + '</div>' +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13.5px;font-weight:600">' + escHtml(ev.title) + '</div>' +
          '<div style="font-size:11.5px;color:var(--muted);margin-top:2px">' +
          ic('fa-calendar', 'margin-right:4px;opacity:.55') + ev.date + ' &nbsp;·&nbsp; ' + tc.label +
          (ev.subject ? ' &nbsp;·&nbsp; ' + escHtml(ev.subject) : '') +
          '</div></div>' +
          diffStr +
          '<button onclick="window._calDelete(\'' + ev.id + '\')" style="background:rgba(255,107,107,.12);border:1px solid rgba(255,107,107,.25);color:var(--accent4);border-radius:7px;padding:5px 9px;cursor:pointer;font-size:12px">' +
          ic('fa-trash') + '</button>' +
          '</div>';
      });
      el.innerHTML = html;
    }

    window._calPrev = function () {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      document.getElementById('cal-month-label').textContent = MONTHS[calMonth] + ' ' + calYear;
      renderCalBody();
      renderEventList();
    };
    window._calNext = function () {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      document.getElementById('cal-month-label').textContent = MONTHS[calMonth] + ' ' + calYear;
      renderCalBody();
      renderEventList();
    };

    window._calDayClick = function (dateStr) {
      document.getElementById('cal-add-date').value = dateStr;
      document.getElementById('cal-add-panel').style.display = 'block';
      document.getElementById('cal-add-title').focus();
    };

    window._calAddEvent = function () {
      var title   = (document.getElementById('cal-add-title')   || {}).value || '';
      var dateVal = (document.getElementById('cal-add-date')    || {}).value || '';
      var type    = (document.getElementById('cal-add-type')    || {}).value || 'other';
      var subject = (document.getElementById('cal-add-subject') || {}).value || '';
      if (!title.trim() || !dateVal) {
        showToast('Missing Info', 'Please enter a title and date.', 'warning');
        return;
      }
      var ev = {
        id: 'ev_' + Date.now(),
        title: title.trim(),
        date: dateVal,
        type: type,
        subject: subject.trim()
      };
      saveCalEvents(getCalEvents().concat([ev]));
      document.getElementById('cal-add-title').value   = '';
      document.getElementById('cal-add-subject').value = '';
      document.getElementById('cal-add-panel').style.display = 'none';
      renderCalBody();
      renderEventList();
      showToast('Event Added', '"' + ev.title + '" on ' + ev.date, 'success');
    };

    window._calDelete = function (id) {
      saveCalEvents(getCalEvents().filter(function (e) { return e.id !== id; }));
      renderCalBody();
      renderEventList();
    };

    setTimeout(function () {
      renderCalBody();
      renderEventList();
    }, 0);

    var addPanelHtml =
      '<div id="cal-add-panel" style="display:none;margin-top:18px;padding:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);border-radius:12px">' +
      '<div style="font-size:14px;font-weight:700;margin-bottom:14px">' + ic('fa-plus', 'color:var(--accent);margin-right:7px') + 'Add Event</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div class="field" style="margin:0"><label>Title *</label>' +
      '<input id="cal-add-title" type="text" placeholder="e.g. Maths Test Chapter 5"></div>' +
      '<div class="field" style="margin:0"><label>Date *</label>' +
      '<input id="cal-add-date" type="date"></div>' +
      '<div class="field" style="margin:0"><label>Type</label>' +
      '<select id="cal-add-type">' +
      '<option value="test">Test</option>' +
      '<option value="assignment">Assignment</option>' +
      '<option value="exam">Exam</option>' +
      '<option value="other">Other</option>' +
      '</select></div>' +
      '<div class="field" style="margin:0"><label>Subject (optional)</label>' +
      '<input id="cal-add-subject" type="text" placeholder="e.g. Mathematics"></div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-top:14px">' +
      mkBtn(ic('fa-plus') + ' Add Event', 'btn-primary', 'window._calAddEvent()', 'border-radius:9px;padding:10px 20px') +
      mkBtn('Cancel', 'btn-ghost', 'document.getElementById(\'cal-add-panel\').style.display=\'none\'', 'border-radius:9px;padding:10px 18px') +
      '</div></div>';

    return '<div class="fade-in">' +
      '<div style="display:grid;grid-template-columns:1fr 320px;gap:18px;align-items:start">' +

      /* Calendar */
      '<div class="glass p-6">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">' +
      '<div class="section-title" style="margin-bottom:0">' + ic('fa-calendar', 'color:var(--accent2)') + 'Study Calendar</div>' +
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<button onclick="window._calPrev()" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.10);color:var(--text);border-radius:8px;padding:7px 12px;cursor:pointer;">' + ic('fa-chevron-left') + '</button>' +
      '<span id="cal-month-label" style="font-family:Syne,sans-serif;font-weight:700;font-size:15px;min-width:160px;text-align:center">' + MONTHS[calMonth] + ' ' + calYear + '</span>' +
      '<button onclick="window._calNext()" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.10);color:var(--text);border-radius:8px;padding:7px 12px;cursor:pointer;">' + ic('fa-chevron-right') + '</button>' +
      '</div></div>' +
      '<div class="cal-grid" id="cal-body"></div>' +
      addPanelHtml +
      '<p style="font-size:12px;color:var(--dim);margin-top:12px">' + ic('fa-hand-pointer','margin-right:5px;opacity:.55') + 'Click any day to add an event</p>' +
      '</div>' +

      /* Event list + Legend */
      '<div style="display:flex;flex-direction:column;gap:14px">' +
      '<div class="glass p-6">' +
      '<div class="section-title" style="font-size:16px;margin-bottom:14px">' + ic('fa-list', 'color:var(--accent)') + 'Events This Month</div>' +
      '<div id="cal-event-list"></div>' +
      mkBtn(ic('fa-plus') + ' Add Event', 'btn-primary', 'document.getElementById(\'cal-add-panel\').style.display=\'block\'', 'width:100%;justify-content:center;border-radius:9px;margin-top:12px;font-size:13px;padding:10px') +
      '</div>' +

      '<div class="glass p-6">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:12px">' + ic('fa-circle-info','color:var(--muted);margin-right:6px') + 'Legend</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<div style="display:flex;align-items:center;gap:9px"><span class="cal-event-dot dot-exam" style="width:10px;height:10px;border-radius:3px;padding:0;display:inline-block"></span><span style="font-size:12.5px;color:var(--muted)">Exam</span></div>' +
      '<div style="display:flex;align-items:center;gap:9px"><span class="cal-event-dot dot-test" style="width:10px;height:10px;border-radius:3px;padding:0;display:inline-block"></span><span style="font-size:12.5px;color:var(--muted)">Test</span></div>' +
      '<div style="display:flex;align-items:center;gap:9px"><span class="cal-event-dot dot-assign" style="width:10px;height:10px;border-radius:3px;padding:0;display:inline-block"></span><span style="font-size:12.5px;color:var(--muted)">Assignment</span></div>' +
      '<div style="display:flex;align-items:center;gap:9px"><span class="cal-event-dot dot-other" style="width:10px;height:10px;border-radius:3px;padding:0;display:inline-block"></span><span style="font-size:12.5px;color:var(--muted)">Other</span></div>' +
      '</div>' +
      '<div style="margin-top:14px;padding:12px;background:rgba(162,89,255,.08);border:1px solid rgba(162,89,255,.18);border-radius:9px;font-size:12px;color:var(--muted);line-height:1.5">' +
      ic('fa-bell','color:var(--accent2);margin-right:5px') +
      'You\'ll receive reminders 3 days, 1 day, and on the day of each event.' +
      '</div>' +
      '</div>' +

      '</div>' + /* end right col */
      '</div></div>';
  }

  /* ── DRAW ── */
  function draw() {
    var body = '';
    if      (curTab === 'dashboard') body = tabDashboard();
    else if (curTab === 'ai-tools')  body = tabAITools();
    else if (curTab === 'library')   body = tabLibrary();
    else if (curTab === 'orders')    body = tabOrders();
    else if (curTab === 'media')     body = tabMedia();
    else if (curTab === 'calendar')  body = tabCalendar();
    ROOT.innerHTML = navHtml() + '<div class="content-area">' + body + '</div>';

    var cw = document.getElementById('chat-win');
    if (cw) cw.scrollTop = cw.scrollHeight;
  }

  /* ── EXPOSED USER FUNCTIONS ── */
  window._uSwitch = function (t) { curTab = t; draw(); };

  window._uOrder = function (p) {
    createOrder(p);
    showToast('Order Placed!', '"' + p + '" submitted. Pending admin approval.', 'success');
    curTab = 'orders'; draw();
  };

  window._uChat = function () {
    var inp = document.getElementById('chat-in');
    if (!inp) return;
    var q = inp.value.trim(); if (!q) return;
    chatLog.push({ from: 'user', text: q });
    inp.value = '';
    var aiReplies = [
      'Great question! AI in education helps personalise learning for every individual student. Want me to go deeper on that topic?',
      'That\'s a key area covered in several NLL modules. Start with the fundamentals, then we can work through the advanced concepts together.',
      'Breaking this topic into smaller chunks is the best approach. Shall I build you a personalised study plan?',
      'You\'ll find excellent resources in our Digital Library under the relevant subject. Want me to point you to specific titles?',
      'Based on your recent progress, I recommend focusing on this topic with 20 minutes of practice daily. Consistency is key!'
    ];
    setTimeout(function () {
      chatLog.push({ from: 'ai', text: aiReplies[Math.floor(Math.random() * aiReplies.length)] });
      draw();
    }, 680);
    draw();
  };

  window._pickQ = function (idx, correct) {
    var opts = document.querySelectorAll('.quiz-opt');
    opts.forEach(function (el, j) {
      el.className = 'quiz-opt' + (j === idx ? (correct ? ' correct' : ' wrong') : '');
    });
    var fb = document.getElementById('quiz-fb');
    if (fb) fb.innerHTML = correct
      ? '<span style="color:var(--accent3)">' + ic('fa-circle-check') + ' Correct! AI excels at both personalisation and grading automation.</span>'
      : '<span style="color:var(--accent4)">' + ic('fa-circle-xmark') + ' Not quite — option C is correct. AI does both!</span>';
  };

  /* ─────────────────────────────────────────────────────────
     DOWNLOAD NOTES MODAL
  ───────────────────────────────────────────────────────── */
  window._openNotes = function () {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'notes-overlay';

    var notesListHtml = '';
    MOCK_NOTES.forEach(function (n) {
      notesListHtml +=
        '<div style="display:flex;align-items:center;gap:14px;padding:14px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin-bottom:10px;transition:.2s" ' +
        'onmouseover="this.style.background=\'rgba(255,255,255,.08)\'" onmouseout="this.style.background=\'rgba(255,255,255,.04)\'">' +
        '<div style="width:46px;height:62px;border-radius:8px;background:rgba(79,142,255,.12);border:1px solid rgba(79,142,255,.22);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">' + n.icon + '</div>' +
        '<div style="flex:1;min-width:0">' +
        '<div style="font-size:14px;font-weight:600;margin-bottom:3px">' + n.title + '</div>' +
        '<div style="font-size:12px;color:var(--muted)">' +
        badge(n.subject, 'blue') + ' &nbsp; ' + badge(n.grade, 'purple') +
        '</div>' +
        '<div style="font-size:11.5px;color:var(--dim);margin-top:5px">' + ic('fa-file-lines', 'margin-right:4px') + n.pages + ' pages &nbsp;·&nbsp; ' + ic('fa-weight-hanging', 'margin-right:4px') + n.size + '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:7px;flex-shrink:0">' +
        '<button onclick="window._downloadNote(\'' + n.id + '\')" style="background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;color:#fff;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:12.5px;display:flex;align-items:center;gap:6px">' + ic('fa-download') + ' Download</button>' +
        '<button onclick="window._previewNote(\'' + n.id + '\')" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--text);border-radius:8px;padding:8px 14px;cursor:pointer;font-size:12.5px;display:flex;align-items:center;gap:6px">' + ic('fa-eye') + ' Preview</button>' +
        '</div></div>';
    });

    overlay.innerHTML =
      '<div class="glass2 modal-box fade-in" style="max-width:780px">' +
      '<button class="modal-close" onclick="document.getElementById(\'notes-overlay\').remove()">' + ic('fa-times') + '</button>' +
      '<div style="margin-bottom:22px">' +
      '<h3 style="font-size:20px;font-weight:800;margin-bottom:5px">' + ic('fa-file-pdf', 'color:var(--accent4);margin-right:9px') + 'Download Study Notes</h3>' +
      '<p style="font-size:13px;color:var(--muted)">High-quality study guides for all your NLL subjects. Free to download.</p>' +
      '</div>' +
      notesListHtml +
      '</div>';

    document.body.appendChild(overlay);
  };

  window._downloadNote = function (id) {
    var note = MOCK_NOTES.find(function (n) { return n.id === id; });
    if (!note) return;

    var contentHtml = note.content.map(function (block) {
      if (block.h) return '<h2>' + block.h + '</h2>';
      if (block.p) return '<p>' + block.p.replace(/\n/g, '<br>') + '</p>';
      return '';
    }).join('');

    var fullHtml =
      '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
      '<title>' + note.title + ' — NLL Study Notes</title>' +
      '<style>' +
      'body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 32px;color:#1a1a2e;line-height:1.8;background:#fff}' +
      '.header{background:linear-gradient(135deg,#4f8eff,#a259ff);color:white;padding:28px 32px;border-radius:12px;margin-bottom:32px}' +
      '.header h1{font-size:24px;font-weight:800;margin:0 0 8px}' +
      '.header p{font-size:13px;opacity:.85;margin:0}' +
      'h2{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#4f8eff;margin-top:28px;margin-bottom:10px;border-bottom:1.5px solid #e0e8ff;padding-bottom:5px}' +
      'p{font-size:14.5px;color:#2a2a40;margin-bottom:14px}' +
      '.footer{margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center}' +
      '@media print{body{margin:20px auto}.header{padding:20px}}' +
      '</style></head><body>' +
      '<div class="header"><h1>' + note.icon + ' ' + note.title + '</h1>' +
      '<p>' + note.subject + ' &nbsp;|&nbsp; ' + note.grade + ' &nbsp;|&nbsp; ' + note.pages + ' pages &nbsp;|&nbsp; Next Level Learning</p></div>' +
      contentHtml +
      '<div class="footer">© Next Level Learning — AI Education Hub &nbsp;|&nbsp; This document is for study purposes only.</div>' +
      '</body></html>';

    var blob = new Blob([fullHtml], { type: 'text/html' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = note.title.replace(/[^a-zA-Z0-9 ]/g,'').replace(/\s+/g,'_') + '_NLL.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast('Downloaded!', '"' + note.title + '" saved to your downloads.', 'success');
  };

  window._previewNote = function (id) {
    var note = MOCK_NOTES.find(function (n) { return n.id === id; });
    if (!note) return;

    var overlay2 = document.createElement('div');
    overlay2.className = 'modal-overlay';
    overlay2.id = 'preview-overlay';
    overlay2.style.zIndex = '600';

    var contentHtml = note.content.map(function (block) {
      if (block.h) return '<h2 style="font-family:Syne,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--accent);margin-top:22px;margin-bottom:9px;border-bottom:1px solid rgba(79,142,255,.22);padding-bottom:5px">' + block.h + '</h2>';
      if (block.p) return '<p style="font-size:13.5px;color:rgba(240,244,255,.82);line-height:1.8;margin-bottom:12px">' + block.p.replace(/\n/g,'<br>') + '</p>';
      return '';
    }).join('');

    overlay2.innerHTML =
      '<div class="glass2 modal-box fade-in" style="max-width:680px">' +
      '<button class="modal-close" onclick="document.getElementById(\'preview-overlay\').remove()">' + ic('fa-times') + '</button>' +
      '<div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.08)">' +
      '<div style="font-size:22px;margin-bottom:4px">' + note.icon + '</div>' +
      '<h3 style="font-family:Syne,sans-serif;font-size:19px;font-weight:800;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">' + note.title + '</h3>' +
      '<div style="margin-top:7px;display:flex;gap:7px;flex-wrap:wrap">' + badge(note.subject,'blue') + badge(note.grade,'purple') + badge(note.pages+' pages','green') + '</div>' +
      '</div>' +
      '<div style="max-height:450px;overflow-y:auto;padding-right:8px">' + contentHtml + '</div>' +
      '<div style="display:flex;gap:10px;margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08)">' +
      '<button onclick="window._downloadNote(\'' + id + '\')" style="background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;color:#fff;border-radius:10px;padding:10px 22px;cursor:pointer;font-size:13.5px;display:flex;align-items:center;gap:8px;flex:1;justify-content:center;font-family:DM Sans,sans-serif">' + ic('fa-download') + ' Download Full Notes</button>' +
      '</div></div>';

    document.body.appendChild(overlay2);
  };

  /* ─────────────────────────────────────────────────────────
     VIEW PROGRESS MODAL
  ───────────────────────────────────────────────────────── */
  window._openProgress = function () {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'progress-overlay';

    var subjects = [
      { name: 'Mathematics',      pct: 74, grade: 'C',  trend: '+8%',  icon: '📐', col: 'var(--accent)',  tests: [62,68,71,74], quizzes: 12, completed: 8  },
      { name: 'Physical Sciences',pct: 59, grade: 'D',  trend: '+4%',  icon: '⚡', col: 'var(--accent3)', tests: [52,55,57,59], quizzes: 10, completed: 5  },
      { name: 'English HL',       pct: 88, grade: 'A',  trend: '+11%', icon: '📖', col: 'var(--accent2)', tests: [78,82,85,88], quizzes: 14, completed: 12 },
      { name: 'Life Sciences',    pct: 42, grade: 'E',  trend: '-2%',  icon: '🌿', col: 'var(--accent4)', tests: [48,44,45,42], quizzes: 9,  completed: 4  },
      { name: 'Economics',        pct: 66, grade: 'C',  trend: '+6%',  icon: '📈', col: 'var(--yellow)',  tests: [58,61,64,66], quizzes: 11, completed: 7  },
      { name: 'Accounting',       pct: 77, grade: 'B',  trend: '+9%',  icon: '🧾', col: '#ff9800',        tests: [66,70,73,77], quizzes: 13, completed: 9  }
    ];

    var overall = Math.round(subjects.reduce(function(a,s){return a+s.pct;},0)/subjects.length);

    /* summary cards */
    var summaryHtml =
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">' +
      '<div style="padding:16px;border-radius:11px;background:rgba(79,142,255,.10);border:1px solid rgba(79,142,255,.20);text-align:center">' +
      '<div style="font-family:Syne,sans-serif;font-size:28px;font-weight:800;color:var(--accent)">' + overall + '%</div>' +
      '<div style="font-size:12px;color:var(--muted)">Overall Average</div></div>' +
      '<div style="padding:16px;border-radius:11px;background:rgba(0,212,170,.10);border:1px solid rgba(0,212,170,.20);text-align:center">' +
      '<div style="font-family:Syne,sans-serif;font-size:28px;font-weight:800;color:var(--accent3)">45/58</div>' +
      '<div style="font-size:12px;color:var(--muted)">Quizzes Completed</div></div>' +
      '<div style="padding:16px;border-radius:11px;background:rgba(162,89,255,.10);border:1px solid rgba(162,89,255,.20);text-align:center">' +
      '<div style="font-family:Syne,sans-serif;font-size:28px;font-weight:800;color:var(--accent2)">5 days</div>' +
      '<div style="font-size:12px;color:var(--muted)">Study Streak</div></div>' +
      '</div>';

    /* subject cards */
    var subjectHtml = subjects.map(function (s) {
      var trendColor = s.trend.startsWith('+') ? 'var(--accent3)' : 'var(--accent4)';
      var trendIcon  = s.trend.startsWith('+') ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
      /* mini sparkline using divs */
      var sparkMax = Math.max.apply(null, s.tests);
      var sparkMin = Math.min.apply(null, s.tests);
      var sparkRange = sparkMax - sparkMin || 1;
      var sparkHtml = s.tests.map(function (v, i) {
        var h = Math.round(((v - sparkMin) / sparkRange) * 28) + 4;
        return '<div style="width:8px;height:' + h + 'px;border-radius:3px 3px 0 0;background:' + s.col + ';opacity:' + (0.4 + 0.6*(i/(s.tests.length-1))) + ';align-self:flex-end"></div>';
      }).join('');

      return '<div style="padding:16px;border-radius:11px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);transition:.2s">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:20px">' + s.icon + '</span>' +
        '<div><div style="font-size:13.5px;font-weight:700">' + s.name + '</div>' +
        '<div style="font-size:11.5px;color:var(--muted)">' + s.completed + '/' + s.quizzes + ' activities done</div></div>' +
        '</div>' +
        '<div style="text-align:right">' +
        '<div style="font-family:Syne,sans-serif;font-size:22px;font-weight:800;color:' + s.col + '">' + s.grade + '</div>' +
        '<div style="font-size:11.5px;color:' + trendColor + '">' + ic(trendIcon) + ' ' + s.trend + '</div>' +
        '</div></div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
        '<div class="prog-bar" style="flex:1"><div class="prog-fill" style="width:' + s.pct + '%;background:' + s.col + '"></div></div>' +
        '<span style="font-size:13px;font-weight:700;color:' + s.col + ';min-width:36px">' + s.pct + '%</span>' +
        '</div>' +
        '<div style="display:flex;gap:4px;align-items:flex-end;height:36px">' + sparkHtml + '</div>' +
        '</div>';
    }).join('');

    /* recent test results */
    var recentTests = [
      { sub:'Mathematics',        test:'Chapter 4 Test',         score:74, total:100, date:'15 Mar 2025' },
      { sub:'English HL',         test:'Essay Task 2',           score:44, total:50,  date:'12 Mar 2025' },
      { sub:'Physical Sciences',  test:'Newton\'s Laws Quiz',    score:18, total:30,  date:'10 Mar 2025' },
      { sub:'Accounting',         test:'Income Statement Test',  score:31, total:40,  date:'7 Mar 2025'  },
      { sub:'Economics',          test:'Chapter 3 Assessment',   score:26, total:40,  date:'3 Mar 2025'  }
    ];
    var recentHtml = recentTests.map(function (r) {
      var pct = Math.round((r.score/r.total)*100);
      var col = pct >= 80 ? 'var(--accent3)' : pct >= 60 ? 'var(--accent)' : pct >= 50 ? 'var(--yellow)' : 'var(--accent4)';
      var letterGrade = pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';
      return '<tr>' +
        '<td style="font-size:13px;font-weight:500">' + r.test + '</td>' +
        '<td style="font-size:12px;color:var(--muted)">' + r.sub + '</td>' +
        '<td style="font-size:13px">' + r.score + '/' + r.total + '</td>' +
        '<td>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<div style="width:60px;height:5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden">' +
        '<div style="width:' + pct + '%;height:100%;background:' + col + ';border-radius:3px"></div></div>' +
        '<span style="color:' + col + ';font-weight:700;font-size:13px">' + pct + '%</span>' +
        '</div></td>' +
        '<td>' + badge(letterGrade, pct>=70?'green':pct>=50?'yellow':'red') + '</td>' +
        '<td style="font-size:11.5px;color:var(--dim)">' + r.date + '</td>' +
        '</tr>';
    }).join('');

    overlay.innerHTML =
      '<div class="glass2 modal-box fade-in" style="max-width:900px">' +
      '<button class="modal-close" onclick="document.getElementById(\'progress-overlay\').remove()">' + ic('fa-times') + '</button>' +
      '<div style="margin-bottom:22px">' +
      '<h3 style="font-size:20px;font-weight:800;margin-bottom:4px">' + ic('fa-chart-line', 'color:var(--accent2);margin-right:9px') + 'Learning Progress</h3>' +
      '<p style="font-size:13px;color:var(--muted)">Your academic performance overview — ' + me.name + '</p>' +
      '</div>' +
      summaryHtml +
      '<div style="font-size:15px;font-weight:700;margin-bottom:14px;font-family:Syne,sans-serif">' + ic('fa-graduation-cap','color:var(--accent);margin-right:7px') + 'Subject Performance</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">' + subjectHtml + '</div>' +
      '<div style="font-size:15px;font-weight:700;margin-bottom:14px;font-family:Syne,sans-serif">' + ic('fa-clipboard-list','color:var(--accent3);margin-right:7px') + 'Recent Test Results</div>' +
      '<div class="overflow-x"><table>' +
      '<thead><tr><th>Test / Assessment</th><th>Subject</th><th>Score</th><th>Result</th><th>Grade</th><th>Date</th></tr></thead>' +
      '<tbody>' + recentHtml + '</tbody></table></div>' +
      '</div>';

    document.body.appendChild(overlay);
  };

  /* ─────────────────────────────────────────────────────────
     CV BUILDER
  ───────────────────────────────────────────────────────── */
  window._openCV = function () {
    var step = 1;
    var cv   = {};

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'cv-overlay';

    function progressBar() {
      var bar = '<div style="display:flex;gap:7px;margin:14px 0 6px">';
      for (var i = 1; i <= 3; i++) {
        bar += '<div style="flex:1;height:3px;border-radius:3px;background:' +
          (step >= i ? 'linear-gradient(90deg,var(--accent),var(--accent2))' : 'rgba(255,255,255,.10)') +
          '"></div>';
      }
      bar += '</div><p style="font-size:12px;color:var(--dim);margin-bottom:22px">Step ' + step +
        ' of 3 — ' + (['Career Details', 'Background Info', 'Your Generated CV'][step - 1]) + '</p>';
      return bar;
    }

    function renderCV() {
      var content = '';
      if (step === 1) {
        content =
          '<div class="field"><label>' + ic('fa-briefcase','margin-right:5px;opacity:.55') + ' Target Career / Field</label>' +
          '<input id="cv-career" type="text" placeholder="e.g. Software Developer, Teacher, Accountant" value="' + escHtml(cv.career||'') + '"></div>' +
          '<div class="field"><label>' + ic('fa-layer-group','margin-right:5px;opacity:.55') + ' Career Level</label>' +
          '<select id="cv-level">' +
          '<option value="" ' + (!cv.level?'selected':'') + ' disabled>Select level…</option>' +
          '<option value="Entry Level / Graduate"' + (cv.level==='Entry Level / Graduate'?' selected':'') + '>Entry Level / Graduate</option>' +
          '<option value="Mid Level (2-5 years)"'  + (cv.level==='Mid Level (2-5 years)'?' selected':'')  + '>Mid Level (2–5 years)</option>' +
          '<option value="Senior Level (5+ years)"'+ (cv.level==='Senior Level (5+ years)'?' selected':'')+ '>Senior Level (5+ years)</option>' +
          '</select></div>' +
          '<div class="field"><label>' + ic('fa-location-dot','margin-right:5px;opacity:.55') + ' Location</label>' +
          '<input id="cv-loc" type="text" placeholder="e.g. Johannesburg, South Africa" value="' + escHtml(cv.location||'') + '"></div>' +
          '<div class="field"><label>' + ic('fa-list-check','margin-right:5px;opacity:.55') + ' Key Skills (comma-separated)</label>' +
          '<input id="cv-skills" type="text" placeholder="e.g. Python, Communication, Leadership" value="' + escHtml(cv.skills||'') + '"></div>' +
          mkBtn(ic('fa-arrow-right') + ' Next: Background Info', 'btn-primary btn-full', 'window._cvNext1()');
      } else if (step === 2) {
        content =
          '<div class="field"><label>' + ic('fa-id-card','margin-right:5px;opacity:.55') + ' Your Full Name</label>' +
          '<input id="cv-name" type="text" placeholder="Full name as it should appear on CV" value="' + escHtml(cv.name||'') + '"></div>' +
          '<div class="field"><label>' + ic('fa-envelope','margin-right:5px;opacity:.55') + ' Email Address</label>' +
          '<input id="cv-email" type="email" placeholder="your@email.com" value="' + escHtml(cv.email||'') + '"></div>' +
          '<div class="field"><label>' + ic('fa-phone','margin-right:5px;opacity:.55') + ' Phone Number</label>' +
          '<input id="cv-phone" type="text" placeholder="+27 000 000 0000" value="' + escHtml(cv.phone||'') + '"></div>' +
          '<div class="field"><label>' + ic('fa-paste','margin-right:5px;opacity:.55') + ' Paste your existing CV or background info <span style="color:var(--dim)">(optional)</span></label>' +
          '<textarea id="cv-paste" rows="5" placeholder="Paste your old CV text, work history, education, achievements…">' + escHtml(cv.paste||'') + '</textarea></div>' +
          '<div class="field"><label>' + ic('fa-pen-to-square','margin-right:5px;opacity:.55') + ' Extra highlights, awards, or notes</label>' +
          '<textarea id="cv-notes" rows="3" placeholder="Languages spoken, certifications, key achievements…">' + escHtml(cv.notes||'') + '</textarea></div>' +
          '<div style="display:flex;gap:10px">' +
          mkBtn(ic('fa-arrow-left') + ' Back', 'btn-ghost', 'window._cvBack(1)', '') +
          mkBtn(ic('fa-wand-magic-sparkles') + ' Generate My CV', 'btn-primary', 'window._cvGenerate()', 'flex:1;justify-content:center;border-radius:12px;padding:13px') +
          '</div>';
      } else {
        content =
          '<div id="cv-loading" style="text-align:center;padding:36px 0">' +
          '<div class="spinner" style="margin:0 auto 16px"></div>' +
          '<p style="font-size:14px;color:var(--muted)">Crafting your AI-polished CV…</p>' +
          '<p style="font-size:12px;color:var(--dim);margin-top:5px">This may take a few seconds</p>' +
          '</div>' +
          '<div id="cv-result" class="cv-out hidden"></div>' +
          '<div id="cv-actions" class="hidden" style="display:flex;gap:10px;margin-top:22px">' +
          mkBtn(ic('fa-pencil') + ' Edit Info', 'btn-ghost', 'window._cvBack(2)', '') +
          mkBtn(ic('fa-download') + ' Download CV', 'btn-success', 'window._cvDownload()', 'flex:1;justify-content:center') +
          '</div>';
      }

      overlay.innerHTML =
        '<div class="glass2 modal-box fade-in">' +
        '<button class="modal-close" onclick="document.getElementById(\'cv-overlay\').remove()">' + ic('fa-times') + '</button>' +
        '<h3 style="font-size:21px;font-weight:800;margin-bottom:2px">' + ic('fa-wand-magic-sparkles','color:var(--accent);margin-right:9px') + 'AI CV Builder</h3>' +
        progressBar() + content + '</div>';

      if (step === 3) callCVAI();
    }

    function save1() {
      cv.career   = (document.getElementById('cv-career')||{}).value||'';
      cv.level    = (document.getElementById('cv-level') ||{}).value||'';
      cv.location = (document.getElementById('cv-loc')   ||{}).value||'';
      cv.skills   = (document.getElementById('cv-skills')||{}).value||'';
    }
    function save2() {
      cv.name  = (document.getElementById('cv-name') ||{}).value||'';
      cv.email = (document.getElementById('cv-email')||{}).value||'';
      cv.phone = (document.getElementById('cv-phone')||{}).value||'';
      cv.paste = (document.getElementById('cv-paste')||{}).value||'';
      cv.notes = (document.getElementById('cv-notes')||{}).value||'';
    }

    window._cvNext1    = function () { save1(); if (!cv.career||!cv.level){alert('Please fill in career and level.');return;} step=2; renderCV(); };
    window._cvBack     = function (s) { step=s; renderCV(); };
    window._cvGenerate = function () { save2(); if (!cv.name){alert('Please enter your full name.');return;} step=3; renderCV(); };

    async function callCVAI() {
      var prompt =
        'You are an expert, award-winning CV writer specialising in South African and African job markets. ' +
        'Generate a complete, polished, modern, ATS-optimised CV in clean HTML using ONLY h1, h2, p, ul, li, strong tags.\n\n' +
        'CANDIDATE DETAILS:\nName: ' + cv.name + '\nEmail: ' + (cv.email||'[not provided]') + '\nPhone: ' + (cv.phone||'[not provided]') + '\n' +
        'Location: ' + (cv.location||'South Africa') + '\nTarget Career: ' + cv.career + '\nLevel: ' + cv.level + '\n' +
        'Key Skills: ' + (cv.skills||'to be inferred') + '\n' +
        (cv.paste?'\nEXISTING BACKGROUND:\n'+cv.paste+'\n':'') +
        (cv.notes?'\nHIGHLIGHTS:\n'+cv.notes+'\n':'') +
        '\nCreate a complete CV with: Professional Summary, Core Competencies, Work Experience (with dates & quantified achievements), Education, Certifications, Technical Skills, References Available on Request.\n' +
        'Return ONLY the HTML content — no markdown, no backticks.';

      try {
        var res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        var data = await res.json();
        var textBlock = data.content && data.content.find(function (b) { return b.type==='text'; });
        var html = textBlock ? textBlock.text : '<p>Unable to generate CV. Please try again.</p>';
        var loading = document.getElementById('cv-loading');
        var result  = document.getElementById('cv-result');
        var actions = document.getElementById('cv-actions');
        if (loading) loading.classList.add('hidden');
        if (result)  { result.innerHTML = html; result.classList.remove('hidden'); }
        if (actions) { actions.classList.remove('hidden'); actions.style.display='flex'; }
      } catch (e) {
        var loading = document.getElementById('cv-loading');
        if (loading) loading.innerHTML = '<p style="color:var(--accent4)">' + ic('fa-triangle-exclamation') +
          ' Could not connect to AI. Please check your internet and try again.</p>' +
          mkBtn(ic('fa-rotate-right')+' Retry','btn-primary','window._cvGenerate()','margin-top:16px');
      }
    }

    window._cvDownload = function () {
      var result = document.getElementById('cv-result');
      if (!result) return;
      var full = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
        '<title>CV - ' + escHtml(cv.name) + '</title>' +
        '<style>body{font-family:Georgia,serif;max-width:820px;margin:40px auto;padding:0 32px;color:#1a1a2e;line-height:1.75}' +
        'h1{font-size:30px;font-weight:800;color:#4f8eff;margin-bottom:5px}' +
        'h2{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#a259ff;' +
        'margin-top:26px;margin-bottom:10px;border-bottom:1.5px solid #e0e0ff;padding-bottom:5px}' +
        'p,li{font-size:14px;color:#2a2a40}ul{padding-left:20px;margin:8px 0}' +
        'strong{color:#1a1a2e}@media print{body{margin:20px auto}}</style>' +
        '</head><body>' + result.innerHTML + '</body></html>';
      var blob = new Blob([full],{type:'text/html'});
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'CV_' + (cv.name||'NLL').replace(/\s+/g,'_') + '.html';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    document.body.appendChild(overlay);
    renderCV();
  };

  /* initial draw + check notifications */
  draw();
  checkCalendarNotifications();
}

/* =========================================================
   ADMIN DASHBOARD
   ========================================================= */
function renderAdmin() {
  var me = getMe();
  if (!me || me.role !== 'admin') { renderAuth(); return; }

  var curTab = 'overview';

  function navHtml() {
    var tabs = [
      ['overview','fa-gauge-high',   'Overview'],
      ['orders',  'fa-boxes-stacked','Orders'],
      ['users',   'fa-users',        'Users']
    ];
    var tabBtns = '';
    tabs.forEach(function (t) {
      tabBtns += '<button class="tab-btn ' + (curTab===t[0]?'active':'') +
        '" onclick="window._adSwitch(\'' + t[0] + '\')">' + ic(t[1]) + '<span>' + t[2] + '</span></button>';
    });
    return '<nav class="navbar">' +
      '<div class="logo">' +
      '<div class="logo-icon" style="background:linear-gradient(135deg,var(--accent4),var(--accent2))">' +
      ic('fa-shield-halved','color:white;font-size:15px') + '</div>' +
      '<span>Admin Hub</span></div>' +
      '<div class="tab-bar">' + tabBtns + '</div>' +
      '<div style="display:flex;align-items:center;gap:14px">' +
      '<span style="font-size:13px;color:var(--muted)">' + ic('fa-circle-user','margin-right:5px') + me.name + '</span>' +
      '<button class="btn btn-danger" onclick="window._doLogout()" style="padding:8px 16px">' +
      ic('fa-power-off') + ' Logout</button>' +
      '</div></nav>';
  }

  window._doLogout = function () { logout(); };

  function tabOverview() {
    var a = getAnalytics();
    var pending = getOrders().filter(function (o) { return o.status==='pending'; });

    var stats = [
      ['fa-users',         a.users,    'Total Users',    'rgba(79,142,255,.14)','var(--accent)'],
      ['fa-boxes-stacked', a.total,    'Total Orders',   'rgba(162,89,255,.14)','var(--accent2)'],
      ['fa-circle-check',  a.approved, 'Approved',       'rgba(0,212,170,.14)', 'var(--accent3)'],
      ['fa-clock',         a.pending,  'Pending Review', 'rgba(255,193,7,.14)', 'var(--yellow)']
    ];
    var statsHtml = '<div class="grid-4" style="margin-top:4px">';
    stats.forEach(function (s) {
      statsHtml += '<div class="glass stat-card">' +
        '<div class="stat-icon" style="background:' + s[3] + ';color:' + s[4] + '">' + ic(s[0]) + '</div>' +
        '<div class="stat-num">' + s[1] + '</div><div class="stat-label">' + s[2] + '</div></div>';
    });
    statsHtml += '</div>';

    var pendHtml = '';
    if (!pending.length) {
      pendHtml = '<p style="color:var(--dim);font-size:13.5px">' +
        ic('fa-circle-check','color:var(--accent3);margin-right:7px') + 'All orders are up to date!</p>';
    } else {
      pending.forEach(function (o) {
        pendHtml += '<div style="display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.06);flex-wrap:wrap;gap:10px">' +
          '<div><div style="font-size:14px;font-weight:500">' + o.product + '</div>' +
          '<div style="font-size:12px;color:var(--muted);margin-top:3px">' +
          ic('fa-user','margin-right:5px') + o.userName + ' &nbsp;·&nbsp; ' + fmtDate(o.ts) +
          '</div></div>' +
          mkBtn(ic('fa-circle-check')+' Approve','btn-success',"window._adApprove('"+o.id+"')",'font-size:13px;padding:8px 16px') +
          '</div>';
      });
    }

    return '<div class="fade-in">' +
      statsHtml +
      '<div class="glass p-6 mt-5"><div class="section-title">' +
      ic('fa-clock','color:var(--yellow)') + 'Pending Orders (' + a.pending + ')' +
      '</div>' + pendHtml + '</div></div>';
  }

  function tabOrders() {
    var orders = getOrders().slice().reverse();
    var rows = '';
    if (!orders.length) {
      rows = '<tr><td colspan="6" style="text-align:center;padding:36px;color:var(--dim)">No orders yet</td></tr>';
    } else {
      orders.forEach(function (o) {
        rows += '<tr>' +
          '<td style="font-family:monospace;font-size:11.5px;color:var(--dim)">#' + o.id.slice(-6) + '</td>' +
          '<td><div style="font-size:13.5px">' + o.userName + '</div><div style="font-size:11.5px;color:var(--dim)">' + o.userEmail + '</div></td>' +
          '<td>' + o.product + '</td>' +
          '<td style="color:var(--muted)">' + fmtDate(o.ts) + '</td>' +
          '<td>' + badge((o.status==='approved'?ic('fa-circle-check')+' ':ic('fa-clock')+' ')+o.status, o.status==='approved'?'green':'yellow') + '</td>' +
          '<td>' + (o.status==='pending'
            ? mkBtn(ic('fa-check')+' Approve','btn-success',"window._adApprove('"+o.id+"')",'font-size:12px;padding:6px 14px')
            : '<span style="color:var(--dim);font-size:13px">—</span>') + '</td>' +
          '</tr>';
      });
    }
    return '<div class="fade-in glass p-6">' +
      '<div class="section-title">' + ic('fa-boxes-stacked','color:var(--accent)') + 'All Orders</div>' +
      '<div class="overflow-x"><table>' +
      '<thead><tr><th>ID</th><th>Customer</th><th>Product</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
  }

  function tabUsers() {
    var users  = getUsers();
    var orders = getOrders();
    var rows = '';
    users.forEach(function (u) {
      var cnt = orders.filter(function (o) { return o.userId===u.id; }).length;
      rows += '<tr>' +
        '<td>' + ic('fa-circle-user','color:var(--accent);margin-right:8px') + u.name + '</td>' +
        '<td style="color:var(--muted)">' + u.email + '</td>' +
        '<td>' + badge(u.role, u.role==='admin'?'purple':'blue') + '</td>' +
        '<td>' + cnt + '</td>' +
        '<td><span style="color:var(--dim);font-size:13px">Active</span></td>' +
        '</tr>';
    });
    return '<div class="fade-in glass p-6">' +
      '<div class="section-title">' + ic('fa-users','color:var(--accent2)') + 'All Users (' + users.length + ')</div>' +
      '<div class="overflow-x"><table>' +
      '<thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Orders</th><th>Status</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
  }

  function draw() {
    var body = '';
    if      (curTab==='overview') body = tabOverview();
    else if (curTab==='orders')   body = tabOrders();
    else if (curTab==='users')    body = tabUsers();
    ROOT.innerHTML = navHtml() + '<div class="content-area">' + body + '</div>';
  }

  window._adSwitch  = function (t) { curTab = t; draw(); };
  window._adApprove = function (id) { approveOrder(id); draw(); };

  draw();
}

/* =========================================================
   BOOT
   ========================================================= */
initDB();
var _me = getMe();
if (_me) {
  if (_me.role === 'admin') renderAdmin();
  else renderUser();
} else {
  renderAuth();
}

})();