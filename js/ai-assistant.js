/* ============================================================
   SkillQuest — ai-assistant.js
   Quinn: In-app intelligent guide
   Self-contained, no external dependencies
   ============================================================ */

(function () {
  'use strict';

  if (document.getElementById('sq-ai-root')) return; // prevent double-init

  const ASSISTANT_NAME = 'Quinn';
  const REPLY_DELAY    = 750;   // ms — simulated thinking time
  const TYPING_SHOW    = 1100;  // ms — typing dots visible before message

  /* ── Knowledge base ──────────────────────────────────────── */
  const KB = [
    {
      id: 'greeting',
      test: s => /\b(hello|^hi$|hey|howdy|good\s(morning|afternoon|evening)|what can you|help me|who are you|start)\b/.test(s),
      reply: ctx => ({
        text: `Hi${ctx.firstName ? ' ' + ctx.firstName : ''}! I'm ${ASSISTANT_NAME}, your SkillQuest guide.\n\nI can help you find courses, understand the monthly prize draw, check your rank, or navigate anywhere on the platform. What would you like to know?`,
        chips: ['How do I earn points?', 'About the monthly draw', 'What courses are here?', 'How do certificates work?']
      })
    },
    {
      id: 'points',
      test: s => /\bpoints?\b|\bearn\b|\bscor(e|ing)\b|\baccumulate\b|\bhow.*get.*points\b|\bpoints.*earn\b/.test(s),
      reply: () => ({
        text: `Points are earned by completing courses and passing quizzes:\n\n• Pass any quiz with 60%+ to earn points\n• Higher scores earn proportionally more points\n• Your total points determine your leaderboard rank\n• Ranking in the top 100 enters you in the monthly prize draw automatically`,
        chips: ['Tell me about the monthly draw', 'Browse courses', 'View the leaderboard'],
        links: [{ label: 'My Dashboard', url: 'dashboard.html' }, { label: 'Browse Courses', url: 'courses.html' }]
      })
    },
    {
      id: 'courses-general',
      test: s => /\bcourses?\b|\blessons?\b|\blearn\b|\bstudy\b|\bsubjects?\b|\bavailable\b|\bbrowse\b|\bwhat.*teach\b|\b36\b|\bhow many\b/.test(s),
      reply: () => ({
        text: `SkillQuest has 36 free courses across 6 subjects:\n\n• Financial Literacy — budgeting, credit, investing\n• AI Fundamentals — how AI & ML work\n• Cybersecurity — online safety and privacy\n• Digital Skills — productivity & data tools\n• Career Readiness — CVs, interviews, networking\n• Entrepreneurship — idea validation, lean startup\n\nAll courses are self-paced and include a scored quiz.`,
        chips: ['Financial Literacy', 'AI Fundamentals', 'Career Readiness', 'Cybersecurity'],
        links: [{ label: 'Browse All Courses', url: 'courses.html' }]
      })
    },
    {
      id: 'finance',
      test: s => /\bfinanc|\bmoney\b|\bbudget|\binvest|\bcredit\b|\bwealth\b|\bbanking\b|\bsavings\b/.test(s),
      reply: () => ({
        text: `Financial Literacy is one of our most-completed subjects. Six courses covering budgeting, understanding credit scores, investing basics, and building long-term wealth. No prior knowledge needed.`,
        links: [{ label: 'Explore Financial Literacy', url: 'subject.html?id=finance' }]
      })
    },
    {
      id: 'ai-tech',
      test: s => /\bartificial intelligence\b|\bai\s|\bai$|\bmachine learning\b|\bdeep learning\b|\bneural\b|\bchatgpt\b|\bllm\b/.test(s),
      reply: () => ({
        text: `AI Fundamentals covers what AI is, how machine learning and neural networks work, large language models, and the ethics of AI. Six courses designed for complete beginners — no coding knowledge required.`,
        links: [{ label: 'Explore AI Fundamentals', url: 'subject.html?id=ai-tech' }]
      })
    },
    {
      id: 'cyber',
      test: s => /\bcyber|\bsecurity\b|\bpassword\b|\bphish|\bhack|\bprivacy\b|\bscam\b|\bsafe online\b|\bthreat\b|\battack\b/.test(s),
      reply: () => ({
        text: `Cybersecurity covers practical online safety — strong passwords, recognising phishing, protecting personal data, and understanding how digital attacks work. Useful for anyone who uses the internet.`,
        links: [{ label: 'Explore Cybersecurity', url: 'subject.html?id=cybersecurity' }]
      })
    },
    {
      id: 'career',
      test: s => /\bcareer\b|\bjob\b|\bcv\b|\bresume\b|\binterview\b|\bnetwork|\bprofessional\b|\bworkplace\b|\bemploy|\bsoft skills\b/.test(s),
      reply: () => ({
        text: `Career Readiness covers writing a strong CV, interview preparation, professional networking, and effective workplace communication — the skills most schools don't teach but employers expect from day one.`,
        links: [{ label: 'Explore Career Readiness', url: 'subject.html?id=career' }]
      })
    },
    {
      id: 'entrepreneurship',
      test: s => /\bentrepreneur|\bstartup\b|\bbusiness\b|\bfounder\b|\bidea\b|\bproduct\b|\bmarket\b|\blean\b|\bventure\b/.test(s),
      reply: () => ({
        text: `Entrepreneurship covers idea validation, lean startup methodology, customer discovery, and marketing fundamentals. Whether you want to start your own venture or think like a founder inside an organisation, this subject is for you.`,
        links: [{ label: 'Explore Entrepreneurship', url: 'subject.html?id=entrepreneurship' }]
      })
    },
    {
      id: 'digital',
      test: s => /\bdigital\b|\bexcel\b|\bspreadsheet\b|\bproductivity\b|\btools?\b|\bgoogle workspace\b|\bmicrosoft\b|\bdata analysis\b/.test(s),
      reply: () => ({
        text: `Digital Skills covers the tools modern workplaces expect — spreadsheets, cloud collaboration, professional communication, and data analysis basics. Immediately practical for students entering any field.`,
        links: [{ label: 'Explore Digital Skills', url: 'subject.html?id=digital' }]
      })
    },
    {
      id: 'monthly-draw',
      test: s => /\blottery\b|\bprize\b|\bdraw\b|\breward|\bgift card\b|\bwin\b|\bcash\b|\bnt\$|\bmonthly\b|\bplatinum\b|\bgold tier\b|\bsilver tier\b|\bqualif|\beligible\b/.test(s),
      reply: () => ({
        text: `The Monthly Prize Draw automatically enters the top 100 learners every month — no sign-up required:\n\n• Rank 1–10 → NT$2,000 gift card  (Platinum)\n• Rank 11–50 → NT$500 gift card  (Gold)\n• Rank 51–100 → NT$200 gift card  (Silver)\n\nWinners are drawn on the last day of each month and notified by email within 24 hours.`,
        chips: ['How do I rank higher?', 'View the leaderboard', 'How do I earn points?'],
        links: [{ label: 'Monthly Draw Details', url: 'rewards.html' }, { label: 'View Leaderboard', url: 'leaderboard.html' }]
      })
    },
    {
      id: 'leaderboard',
      test: s => /\bleaderboard\b|\brank\b|\branking\b|\bstanding\b|\bposition\b|\bcompare\b|\bhighest\b|\btop 10\b|\btop 50\b|\btop 100\b/.test(s),
      reply: () => ({
        text: `The leaderboard ranks all SkillQuest learners by total points earned from quizzes. It updates after every completed quiz. Ranking in the top 100 by end of month automatically enters you in the monthly prize draw.`,
        chips: ['Tell me about the monthly draw'],
        links: [{ label: 'View Leaderboard', url: 'leaderboard.html' }]
      })
    },
    {
      id: 'certificate',
      test: s => /\bcertificat|\bbadge\b|\b80%\b|\bcompletion\b|\bprintable\b|\blinkedin\b|\bportfolio\b|\bcredential\b/.test(s),
      reply: () => ({
        text: `You earn a certificate for every course where you score 80% or above on the quiz. Certificates are printable and can be added to a LinkedIn profile or resume. There's no limit to how many you can earn.`,
        chips: ['Browse Courses', 'Go to my Dashboard'],
        links: [{ label: 'Browse Courses', url: 'courses.html' }, { label: 'My Dashboard', url: 'dashboard.html' }]
      })
    },
    {
      id: 'dashboard',
      test: s => /\bdashboard\b|\bmy profile\b|\bmy progress\b|\bmy account\b|\bmy courses\b|\bmy history\b|\bcompleted courses\b/.test(s),
      reply: () => ({
        text: `Your dashboard shows total points, courses completed and in progress, your current leaderboard rank, and recent quiz activity. Access it any time from the navigation bar — you need to be logged in.`,
        links: [{ label: 'Go to Dashboard', url: 'dashboard.html' }]
      })
    },
    {
      id: 'signup',
      test: s => /\bsign\s*up\b|\bregister\b|\bcreate\s*(an?\s*)?account\b|\bjoin\b|\bget started\b|\bnew account\b|\bfree account\b/.test(s),
      reply: () => ({
        text: `Creating an account is free and takes under a minute — just a name, email, and password. No credit card, no trial period. Free from day one, free forever.`,
        links: [{ label: 'Create Free Account', url: 'signup.html' }]
      })
    },
    {
      id: 'login',
      test: s => /\blog\s*in\b|\bsign\s*in\b|\baccess my\b|\bforgot\b|\bpassword reset\b|\bcant.*log\b/.test(s),
      reply: () => ({
        text: `Head to the login page and enter your registered email and password. If you've forgotten your password, contact us at skillquest@uedu.tw and we'll reset it for you.`,
        links: [{ label: 'Log In', url: 'login.html' }, { label: 'Sign Up Free', url: 'signup.html' }]
      })
    },
    {
      id: 'free',
      test: s => /\bfree\b|\bcost\b|\bprice\b|\bpaid\b|\bsubscri|\bpayment\b|\bfee\b|\bcharge\b|\bhow much\b|\baffordabl\b/.test(s),
      reply: () => ({
        text: `SkillQuest is completely free — all 36 courses, certificates, the leaderboard, and the monthly prize draw. There is no premium plan, no subscription, and no payment ever required. Free from day one, free forever.`
      })
    },
    {
      id: 'contact',
      test: s => /\bcontact\b|\bsupport\b|\breport\b|\bfeedback\b|\bproblem\b|\bissue\b|\bbug\b|\berror\b|\bhelp desk\b|\breach\b/.test(s),
      reply: () => ({
        text: `You can reach the SkillQuest team at skillquest@uedu.tw or via the contact form on the Contact page. We typically respond within 1–2 business days.`,
        links: [{ label: 'Contact Page', url: 'contact.html' }]
      })
    },
    {
      id: 'about',
      test: s => /\babout\b|\bwho made\b|\bwho built\b|\btaiwan\b|\bteam\b|\bmission\b|\bpurpose\b|\bwhy skillquest\b/.test(s),
      reply: () => ({
        text: `SkillQuest was built in Taiwan to bridge the gap between what schools teach and what life actually requires — focused on financial literacy, technology, career readiness, and entrepreneurship. Completely free, always.`,
        links: [{ label: 'About SkillQuest', url: 'about.html' }]
      })
    },
    {
      id: 'quiz',
      test: s => /\bquiz\b|\btest\b|\bquestion\b|\banswer\b|\bmultiple choice\b|\battempt\b|\bretake\b|\bassessment\b|\bexam\b/.test(s),
      reply: () => ({
        text: `Each course ends with a multiple-choice quiz:\n\n• Score 60%+ to earn points for your leaderboard rank\n• Score 80%+ to unlock a certificate of completion\n• Retakes are unlimited — improve your score any time`
      })
    },
    {
      id: 'navigate',
      test: s => /\bwhere\b|\bfind\b|\bgo to\b|\bnavigate\b|\bwhich page\b|\bhow do i get to\b|\bsite map\b|\bpages\b/.test(s),
      reply: () => ({
        text: `Here are the main pages:`,
        links: [
          { label: 'Home',          url: 'index.html'      },
          { label: 'Browse Courses', url: 'courses.html'    },
          { label: 'Leaderboard',   url: 'leaderboard.html'},
          { label: 'Monthly Draw',  url: 'rewards.html'    },
          { label: 'My Dashboard',  url: 'dashboard.html'  },
          { label: 'About',         url: 'about.html'      },
          { label: 'Contact',       url: 'contact.html'    }
        ]
      })
    }
  ];

  /* ── Get page context ── */
  function getCtx() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const pageLabels = {
      'index.html':        'Home',
      'courses.html':      'Courses',
      'leaderboard.html':  'Leaderboard',
      'rewards.html':      'Monthly Draw',
      'dashboard.html':    'Dashboard',
      'about.html':        'About',
      'contact.html':      'Contact',
      'login.html':        'Login',
      'signup.html':       'Sign Up'
    };
    return {
      user,
      firstName:  user ? user.name.split(' ')[0] : null,
      page,
      pageLabel:  pageLabels[page] || 'SkillQuest'
    };
  }

  /* ── Context-specific welcome ── */
  function welcomeMessage(ctx) {
    const greets = {
      'courses.html':     `Hi${ctx.firstName ? ' ' + ctx.firstName : ''}! You're browsing courses. Can I help you find the right subject or explain how the quizzes work?`,
      'leaderboard.html': `Hi${ctx.firstName ? ' ' + ctx.firstName : ''}! Checking your rank? I can explain how ranking works and how it connects to the monthly prize draw.`,
      'rewards.html':     `Hi${ctx.firstName ? ' ' + ctx.firstName : ''}! This page shows the Monthly Prize Draw. Want me to explain how to qualify or how winners are selected?`,
      'dashboard.html':   `Hi${ctx.firstName ? ' ' + ctx.firstName : ''}! I can help you understand your dashboard — points, rank, course progress, or anything else.`,
      'login.html':       `Need help logging in? I can walk you through it, or help you create an account if you're new here.`,
      'signup.html':      `Creating an account is quick and free. Let me know if you have any questions about signing up.`
    };
    return greets[ctx.page] || `Hi${ctx.firstName ? ' ' + ctx.firstName : ''}! I'm ${ASSISTANT_NAME}, your SkillQuest guide. Ask me anything about courses, points, the monthly draw, or how to use the platform.`;
  }

  /* ── Page-specific initial chips ── */
  function pageChips(ctx) {
    const chips = {
      'courses.html':     ['What subjects are available?', 'How do I earn points?', 'How do I get a certificate?'],
      'leaderboard.html': ['How does ranking work?', 'Tell me about the monthly draw', 'How do I earn more points?'],
      'rewards.html':     ['How do I qualify?', 'How are winners selected?', 'How do I earn points?'],
      'dashboard.html':   ['How do I earn more points?', 'Tell me about the monthly draw', 'How do certificates work?'],
      'index.html':       ['How do I earn points?', 'What courses are available?', 'Tell me about the monthly draw', 'Is it really free?']
    };
    return chips[ctx.page] || ['How do I earn points?', 'What courses are here?', 'Tell me about the monthly draw', 'How do certificates work?'];
  }

  /* ── Match knowledge base ── */
  function findReply(input, ctx) {
    const s = input.toLowerCase().trim();
    for (const item of KB) {
      try { if (item.test(s)) return item.reply(ctx); } catch(e) {}
    }
    return {
      text: `I don't have a specific answer for that, but I can help with courses, points, the monthly draw, certificates, and navigation. What would you like to know?`,
      chips: ['How do I earn points?', 'What courses are available?', 'Tell me about the monthly draw', 'How do I contact support?']
    };
  }

  /* ── Escape HTML ── */
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* ── Inject styles ── */
  const css = `
    #sq-ai-root *{box-sizing:border-box;margin:0;padding:0;}

    #sq-ai-root {
      position:fixed;
      bottom:24px;
      right:24px;
      z-index:8000;
      font-family:'Inter',system-ui,sans-serif;
    }

    /* Toggle button */
    #sq-toggle {
      width:58px;height:58px;
      border-radius:50%;
      background:linear-gradient(135deg,#1d4ed8,#4f46e5);
      border:none;
      cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 8px 24px rgba(37,99,235,0.45);
      transition:transform 0.2s ease,box-shadow 0.2s ease;
      position:relative;
      z-index:8001;
    }
    #sq-toggle:hover{transform:scale(1.08);box-shadow:0 12px 32px rgba(37,99,235,0.5);}
    #sq-toggle svg{transition:opacity 0.2s;}
    #sq-toggle.open .sq-icon-chat{opacity:0;position:absolute;}
    #sq-toggle.open .sq-icon-close{opacity:1;}
    #sq-toggle .sq-icon-close{opacity:0;position:absolute;}

    /* Unread badge */
    #sq-badge {
      position:absolute;top:-3px;right:-3px;
      width:18px;height:18px;
      background:#ef4444;
      border:2px solid white;
      border-radius:50%;
      font-size:10px;font-weight:800;
      color:white;
      display:flex;align-items:center;justify-content:center;
      animation:sq-pulse 2s infinite;
    }
    @keyframes sq-pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}

    /* Panel */
    #sq-panel {
      position:absolute;
      bottom:72px;
      right:0;
      width:370px;
      max-height:520px;
      background:white;
      border-radius:20px;
      box-shadow:0 24px 64px rgba(0,0,0,0.16),0 4px 16px rgba(0,0,0,0.08);
      display:flex;flex-direction:column;
      overflow:hidden;
      transform-origin:bottom right;
      transition:transform 0.28s cubic-bezier(0.34,1.56,0.64,1),opacity 0.22s ease;
    }
    #sq-panel.sq-hidden{transform:scale(0.85) translateY(12px);opacity:0;pointer-events:none;}

    /* Header */
    #sq-header {
      background:linear-gradient(135deg,#1e293b,#0f172a);
      padding:16px 18px;
      display:flex;align-items:center;justify-content:space-between;
      flex-shrink:0;
    }
    .sq-hd-left{display:flex;align-items:center;gap:12px;}
    .sq-avatar{
      width:38px;height:38px;border-radius:50%;
      background:linear-gradient(135deg,#2563eb,#4f46e5);
      color:white;font-size:14px;font-weight:800;
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;
    }
    .sq-hd-name{font-size:14px;font-weight:700;color:white;line-height:1.2;}
    .sq-hd-status{display:flex;align-items:center;gap:5px;font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;}
    .sq-online-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;flex-shrink:0;}
    #sq-close-btn{
      background:rgba(255,255,255,0.1);border:none;cursor:pointer;
      width:30px;height:30px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:rgba(255,255,255,0.7);transition:background 0.15s;
    }
    #sq-close-btn:hover{background:rgba(255,255,255,0.2);color:white;}

    /* Messages */
    #sq-messages {
      flex:1;overflow-y:auto;padding:16px 14px;
      display:flex;flex-direction:column;gap:12px;
      scroll-behavior:smooth;
    }
    #sq-messages::-webkit-scrollbar{width:4px;}
    #sq-messages::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.1);border-radius:4px;}

    .sq-msg{display:flex;gap:8px;align-items:flex-end;animation:sq-fadein 0.22s ease;}
    @keyframes sq-fadein{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}

    .sq-msg.sq-user{flex-direction:row-reverse;}

    .sq-msg-avatar{
      width:28px;height:28px;border-radius:50%;
      background:linear-gradient(135deg,#2563eb,#4f46e5);
      color:white;font-size:11px;font-weight:800;
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;
    }
    .sq-msg.sq-user .sq-msg-avatar{background:linear-gradient(135deg,#64748b,#475569);}

    .sq-bubble{
      max-width:260px;
      padding:11px 14px;
      border-radius:16px;
      font-size:13px;line-height:1.6;
      color:#1e293b;
      background:#f1f5f9;
      border-bottom-left-radius:4px;
      white-space:pre-line;
    }
    .sq-msg.sq-user .sq-bubble{
      background:linear-gradient(135deg,#2563eb,#4f46e5);
      color:white;
      border-bottom-right-radius:4px;
      border-bottom-left-radius:16px;
    }

    /* Links inside bubbles */
    .sq-links{display:flex;flex-direction:column;gap:6px;margin-top:10px;}
    .sq-link-btn{
      display:inline-flex;align-items:center;gap:6px;
      padding:7px 12px;
      background:white;
      border:1px solid #e2e8f0;
      border-radius:10px;
      font-size:12px;font-weight:600;
      color:#2563eb;
      text-decoration:none;
      transition:background 0.15s,border-color 0.15s;
    }
    .sq-link-btn:hover{background:#eff6ff;border-color:#bfdbfe;}
    .sq-link-btn svg{flex-shrink:0;}

    /* Typing indicator */
    #sq-typing{display:flex;gap:8px;align-items:flex-end;padding:0 4px;}
    .sq-typing-bubble{
      padding:11px 16px;
      background:#f1f5f9;
      border-radius:16px;border-bottom-left-radius:4px;
      display:flex;gap:4px;align-items:center;
    }
    .sq-typing-dot{
      width:6px;height:6px;border-radius:50%;
      background:#94a3b8;
      animation:sq-bounce 1.2s infinite;
    }
    .sq-typing-dot:nth-child(2){animation-delay:0.2s;}
    .sq-typing-dot:nth-child(3){animation-delay:0.4s;}
    @keyframes sq-bounce{0%,80%,100%{transform:translateY(0);}40%{transform:translateY(-6px);}}

    /* Quick chips */
    #sq-chips{
      padding:0 14px 10px;
      display:flex;gap:6px;flex-wrap:wrap;
    }
    .sq-chip{
      padding:6px 12px;
      background:#f1f5f9;
      border:1px solid #e2e8f0;
      border-radius:999px;
      font-size:12px;font-weight:600;
      color:#374151;
      cursor:pointer;
      white-space:nowrap;
      transition:background 0.15s,border-color 0.15s,color 0.15s;
    }
    .sq-chip:hover{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8;}

    /* Input */
    #sq-input-row{
      display:flex;align-items:center;gap:8px;
      padding:10px 14px 14px;
      border-top:1px solid #f1f5f9;
      flex-shrink:0;
    }
    #sq-input{
      flex:1;
      border:1px solid #e2e8f0;
      border-radius:12px;
      padding:10px 14px;
      font-size:13px;
      font-family:inherit;
      color:#1e293b;
      background:white;
      outline:none;
      transition:border-color 0.15s;
    }
    #sq-input:focus{border-color:#93c5fd;}
    #sq-input::placeholder{color:#94a3b8;}
    #sq-send{
      width:36px;height:36px;border-radius:10px;
      background:linear-gradient(135deg,#2563eb,#4f46e5);
      border:none;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;
      transition:opacity 0.15s;
    }
    #sq-send:hover{opacity:0.88;}
    #sq-send:disabled{opacity:0.4;cursor:default;}

    /* Powered by */
    .sq-footer{
      text-align:center;font-size:10px;color:#cbd5e1;
      padding:0 14px 10px;flex-shrink:0;
    }

    @media(max-width:420px){
      #sq-panel{width:calc(100vw - 32px);right:-8px;}
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── Build DOM ── */
  const root = document.createElement('div');
  root.id = 'sq-ai-root';
  root.innerHTML = `
    <div id="sq-panel" class="sq-hidden" role="dialog" aria-label="${ASSISTANT_NAME} — SkillQuest Guide" aria-modal="true">
      <div id="sq-header">
        <div class="sq-hd-left">
          <div class="sq-avatar">Q</div>
          <div>
            <div class="sq-hd-name">${ASSISTANT_NAME}</div>
            <div class="sq-hd-status"><span class="sq-online-dot"></span>SkillQuest Guide</div>
          </div>
        </div>
        <button id="sq-close-btn" aria-label="Close assistant">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div id="sq-messages" role="log" aria-live="polite"></div>
      <div id="sq-chips"></div>
      <div id="sq-input-row">
        <input id="sq-input" type="text" placeholder="Ask anything…" autocomplete="off" maxlength="200" aria-label="Message Quinn">
        <button id="sq-send" aria-label="Send message">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      <div class="sq-footer">SkillQuest automated guide · Not an AI chat service</div>
    </div>

    <button id="sq-toggle" aria-label="Open SkillQuest guide" aria-expanded="false">
      <svg class="sq-icon-chat" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg class="sq-icon-close" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      <span id="sq-badge" style="display:none;">1</span>
    </button>
  `;
  document.body.appendChild(root);

  /* ── State ── */
  let isOpen     = false;
  let isTyping   = false;
  let hasOpened  = false;
  const ctx      = getCtx();

  const panel     = document.getElementById('sq-panel');
  const toggle    = document.getElementById('sq-toggle');
  const closeBtn  = document.getElementById('sq-close-btn');
  const messages  = document.getElementById('sq-messages');
  const chipsEl   = document.getElementById('sq-chips');
  const input     = document.getElementById('sq-input');
  const sendBtn   = document.getElementById('sq-send');
  const badge     = document.getElementById('sq-badge');

  /* ── Helpers ── */
  function scrollBottom() {
    setTimeout(() => { messages.scrollTop = messages.scrollHeight; }, 60);
  }

  function userInitials() {
    if (!ctx.user) return 'U';
    return ctx.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  function addMsg(text, isUser, replyData) {
    const msg = document.createElement('div');
    msg.className = 'sq-msg' + (isUser ? ' sq-user' : '');

    const avatarEl = document.createElement('div');
    avatarEl.className = 'sq-msg-avatar';
    avatarEl.textContent = isUser ? userInitials() : 'Q';

    const bubble = document.createElement('div');
    bubble.className = 'sq-bubble';
    bubble.textContent = text;

    // Inject links if provided
    if (!isUser && replyData && replyData.links && replyData.links.length) {
      const linksDiv = document.createElement('div');
      linksDiv.className = 'sq-links';
      replyData.links.forEach(lnk => {
        const a = document.createElement('a');
        a.className = 'sq-link-btn';
        a.href = lnk.url;
        a.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>${esc(lnk.label)}`;
        linksDiv.appendChild(a);
      });
      bubble.appendChild(linksDiv);
    }

    msg.appendChild(avatarEl);
    msg.appendChild(bubble);
    messages.appendChild(msg);
    scrollBottom();
    return msg;
  }

  function showTyping() {
    if (isTyping) return;
    isTyping = true;
    const el = document.createElement('div');
    el.id = 'sq-typing';
    el.className = 'sq-msg';
    el.innerHTML = `<div class="sq-msg-avatar">Q</div><div class="sq-typing-bubble"><div class="sq-typing-dot"></div><div class="sq-typing-dot"></div><div class="sq-typing-dot"></div></div>`;
    messages.appendChild(el);
    scrollBottom();
  }

  function hideTyping() {
    const el = document.getElementById('sq-typing');
    if (el) el.remove();
    isTyping = false;
  }

  function setChips(chipsArr) {
    chipsEl.innerHTML = '';
    if (!chipsArr || !chipsArr.length) return;
    chipsArr.slice(0, 4).forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'sq-chip';
      btn.textContent = label;
      btn.addEventListener('click', () => handleSend(label));
      chipsEl.appendChild(btn);
    });
  }

  function openPanel() {
    isOpen = true;
    panel.classList.remove('sq-hidden');
    toggle.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    badge.style.display = 'none';
    input.focus();

    if (!hasOpened) {
      hasOpened = true;
      // Welcome message
      setTimeout(() => {
        addMsg(welcomeMessage(ctx), false);
        setChips(pageChips(ctx));
        scrollBottom();
      }, 200);
    }
  }

  function closePanel() {
    isOpen = false;
    panel.classList.add('sq-hidden');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  function handleSend(text) {
    const raw = (text || input.value).trim();
    if (!raw || isTyping) return;
    input.value = '';
    chipsEl.innerHTML = '';

    addMsg(raw, true);
    sendBtn.disabled = true;

    showTyping();
    setTimeout(() => {
      hideTyping();
      const reply = findReply(raw, ctx);
      addMsg(reply.text, false, reply);
      setChips(reply.chips);
      sendBtn.disabled = false;
      input.focus();
    }, TYPING_SHOW);
  }

  /* ── Events ── */
  toggle.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  closeBtn.addEventListener('click', closePanel);

  sendBtn.addEventListener('click', () => handleSend());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });

  // Close on outside click
  document.addEventListener('click', e => {
    if (isOpen && !root.contains(e.target)) closePanel();
  });

  // Show badge after 3 seconds to draw attention (first visit)
  if (!sessionStorage.getItem('sq_chat_seen')) {
    setTimeout(() => {
      if (!isOpen) {
        badge.style.display = 'flex';
        sessionStorage.setItem('sq_chat_seen', '1');
      }
    }, 3000);
  }

})();
