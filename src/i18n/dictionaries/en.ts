import type { Dictionary } from './el'

/**
 * English content. Typed against the Greek dictionary — if a key is
 * missing or misspelled here, the build fails.
 */
export const en: Dictionary = {
  meta: {
    title: 'International Marine Automations — Marine Electrical & Automation',
    description:
      'Marine electrical and automation repair. From board-level component repair to full electrical refit. 24/7 breakdown response.',
  },

  pageMeta: {
    home: {
      title: 'International Marine Automations — Marine Electrical & Automation',
      description:
        'Marine electrical and automation repair. From board-level component repair to full electrical refit. 24/7 breakdown response.',
    },
    services: {
      title: 'Services — From the component to the vessel | IMA',
      description:
        'Three levels of repair: board, system, full electrical refit. All in-house, no subcontractors — on site, at anchor or in the yard.',
    },
    capabilities: {
      title: 'Capabilities — Equipment we support | IMA',
      description:
        'PLCs, drives, inverters, switchboards, alarm and monitoring systems. We work daily with the equipment you already have installed, any manufacturer.',
    },
    projects: {
      title: 'Projects — Recent breakdowns and turnaround times | IMA',
      description:
        'Real faults on real vessels: what failed, what we did, and how long until the ship was back in service.',
    },
    certifications: {
      title: 'Certifications and class approvals | IMA',
      description:
        'The certifications and class approvals covering our work, so the repair passes survey.',
    },
    coverage: {
      title: 'Coverage — 9 Greek ports, worldwide response | IMA',
      description:
        'Based in Piraeus. Covering Elefsina, Perama, Salamina, Thessaloniki, Volos, Patras, Heraklion and Rhodes — and we travel to wherever the vessel is.',
    },
    contact: {
      title: 'Report a breakdown — 24/7 line | IMA',
      description:
        'Send vessel name, IMO, port and ETA. We reply with an engineer and an arrival time, not a quotation. Breakdown line 24/7, 365 days.',
    },
    privacy: {
      title: 'Privacy Policy | IMA',
      description:
        'What data the breakdown report form collects, why we need it, where it is stored and what rights you have over it.',
    },
    notFound: {
      title: 'Page not found | IMA',
      description: 'The page you asked for does not exist.',
    },
  },

  nav: {
    home: 'Home',
    services: 'Services',
    capabilities: 'Capabilities',
    projects: 'Projects',
    certifications: 'Certifications',
    coverage: 'Coverage',
    contact: 'Contact',
    privacy: 'Privacy Policy',
    menu: 'Menu',
    close: 'Close',
    skipToContent: 'Skip to content',
    mainNav: 'Main navigation',
    mobileNav: 'Mobile navigation',
  },

  emergency: {
    label: '24/7 Breakdown',
    phone: '+30 210 481 4935',
    cta: 'Call now',
  },

  hero: {
    eyebrow: 'Pneumatics · Electrical · Electronics · Automation',
    title: 'Your vessel is not waiting.',
    titleAccent: 'Neither are we.',
    subtitle:
      'We repair the marine electrical, electronics and automation systems others only replace — from a single burnt component to the entire main switchboard. Alongside, underway, or in the yard.',
    ctaPrimary: 'Report a breakdown',
    ctaSecondary: 'See what we cover',
    sceneLabel:
      'Schematic top-down view of a vessel with the systems we service highlighted.',
    stats: [
      { value: '24/7', label: 'Breakdown response' },
      { value: '15+', label: 'Years in shipping' },
      { value: '400+', label: 'Boards repaired' },
      { value: '9', label: 'Ports covered' },
    ],
  },

  home: {
    problem: {
      eyebrow: 'The problem',
      title: 'An automation fault is never just a fault.',
      body: 'It is port delay, off-hire, a lost charter, and a class survey you do not pass. Most suppliers replace the whole unit because they cannot read the board — then quote you six months lead time for a part that is no longer manufactured.',
      contrast: 'We repair it.',
    },
    servicesTeaser: {
      eyebrow: 'What we do',
      title: 'Three levels, one workshop.',
      body: 'You do not need to know where the problem is to call us. Finding it is the job.',
      cta: 'All services',
    },
    capabilitiesTeaser: {
      eyebrow: 'Equipment',
      title: 'We know your system.',
      body: 'We work daily with the equipment already installed on your vessel. If you do not see your system here, ask — the list is not exhaustive.',
      cta: 'Full list',
    },
    projectsTeaser: {
      eyebrow: 'In practice',
      title: 'Recent cases.',
      body: 'Real faults, real turnaround times.',
      cta: 'All projects',
    },
    ctaBand: {
      title: 'Broken down right now?',
      body: 'Send us vessel name, IMO, port and ETA. You get an engineer and an arrival time back, not a sales quote.',
      cta: 'Report a breakdown',
      or: 'or call',
    },
  },

  services: {
    eyebrow: 'Services',
    title: 'From the component to the vessel.',
    intro:
      'We work at three levels. Most jobs start at one and end at another — which is why we do all of them in house, with no subcontractors.',
    levels: [
      {
        id: 'component',
        index: '01',
        name: 'Component-level repair',
        summary:
          'We repair the board instead of replacing the unit. For obsolete equipment, it is often the only option that exists.',
        items: [
          'PCB fault-finding and component-level repair',
          'Drives, inverters and soft starter repair',
          'PLC modules, I/O cards, power supplies',
          'Reverse engineering of obsolete boards',
          'BGA/SMD reflow and rework',
          'Full bench testing before return',
        ],
      },
      {
        id: 'systems',
        index: '02',
        name: 'Systems & automation',
        summary:
          'Where 70% of jobs actually live: the component is fine, the system is not talking.',
        items: [
          'Main and emergency switchboards',
          'Generators, AVR, synchronizing panels',
          'Alarm & monitoring systems',
          'Engine room automation, UMS',
          'Ballast, bilge and cargo control',
          'Navigation & bridge equipment interfacing',
          'Insulation (earth) fault tracing',
        ],
      },
      {
        id: 'retrofit',
        index: '03',
        name: 'Refit & new installations',
        summary:
          'When patching is no longer honest. Full electrical refit, drawn and class approved.',
        items: [
          'Full electrical refit and rewiring',
          'Switchboard and automation upgrades',
          'Panel building and assembly',
          'Newbuilding support',
          'Electrical drawing updates and reconstruction',
          'Supervision and handover with class survey',
        ],
      },
    ],
    where: {
      title: 'Where we work',
      modes: [
        {
          name: 'Alongside, in port',
          body: 'Engineer on board within hours. The most common case by far.',
        },
        {
          name: 'Underway (riding squad)',
          body: 'We board and work during the voyage, so you lose no trading time.',
        },
        {
          name: 'In our workshop',
          body: 'Ship us the unit. Diagnosis, repair, test, return.',
        },
        {
          name: 'At the yard',
          body: 'Full supervision during docking or newbuilding.',
        },
      ],
    },
  },

  capabilities: {
    eyebrow: 'Capabilities',
    title: 'Systems & makers.',
    intro:
      'This list is equipment we have worked on repeatedly, not equipment we have heard of. If your system is missing, send us the model — we usually cover it.',
    note: 'All trademarks belong to their respective owners. IMA is an independent service workshop and is not an agent or representative of any maker listed above.',
    groups: [
      {
        name: 'Automation & control',
        brands: ['Siemens', 'ABB', 'Schneider Electric', 'Allen-Bradley', 'Omron', 'Mitsubishi'],
      },
      {
        name: 'Alarm & monitoring',
        brands: ['Kongsberg', 'Autronica', 'Praxis', 'Selma', 'Lyngsø Marine', 'Nabtesco'],
      },
      {
        name: 'Power & propulsion',
        brands: ['Wärtsilä', 'MAN Energy Solutions', 'Caterpillar', 'Cummins', 'Deif', 'Woodward'],
      },
      {
        name: 'Drives & motors',
        brands: ['Danfoss', 'Vacon', 'Yaskawa', 'Fuji Electric', 'Nidec', 'WEG'],
      },
    ],
  },

  projects: {
    eyebrow: 'Projects',
    title: 'Case files.',
    intro:
      'Selected jobs from recent years. Vessel and owner names are withheld where we do not have written permission.',
    labels: {
      vessel: 'Vessel type',
      location: 'Location',
      problem: 'Problem',
      solution: 'Solution',
      downtime: 'Turnaround',
      scope: 'Scope',
    },
    items: [
      {
        id: 'p1',
        title: 'Blackouts traced to a generator synchronising fault',
        vessel: 'Bulk carrier, 82,000 DWT',
        location: 'Piraeus',
        scope: 'Systems & automation',
        problem:
          'Repeated blackouts when running two generators in parallel. Two previous suppliers had replaced the AVR with no effect.',
        solution:
          'Fault-finding located a degraded current transformer in the synchronising panel, not in the generator. CT replaced, load sharing recalibrated, tested at full load.',
        downtime: '11 hours',
      },
      {
        id: 'p2',
        title: 'Obsolete ballast control board with no spare in existence',
        vessel: 'Product tanker, 50,000 DWT',
        location: 'IMA workshop',
        scope: 'Component level',
        problem:
          'The ballast system control card went out of production in 2009. The maker proposed a full system upgrade at six-figure cost.',
        solution:
          'Component-level repair: two driver ICs and the output relay replaced, corroded tracks rebuilt. 72-hour bench test before return.',
        downtime: '6 days (vessel never stopped)',
      },
      {
        id: 'p3',
        title: 'False fire alarms four days before class survey',
        vessel: 'Container vessel, 4,500 TEU',
        location: 'Elefsina',
        scope: 'Systems & automation',
        problem:
          'Dozens of false alarms per day in the engine room. Survey was in four days and the system would not have passed.',
        solution:
          'Traced an insulation fault on a detector loop caused by water ingress. Replaced 40 m of cable and 6 detectors, full loop test, documentation prepared for the surveyor.',
        downtime: '2 days — survey passed',
      },
      {
        id: 'p4',
        title: 'Full electrical refit after an engine room fire',
        vessel: 'Ro-Ro ferry',
        location: 'Perama shipyard',
        scope: 'Refit',
        problem:
          'An engine room fire destroyed the main switchboard and much of the wiring. No current drawings existed — the last set was from 1998.',
        solution:
          'Surveyed and redrew the electrical drawings from scratch, built a new switchboard, fully rewired the engine room, handed over with class approval.',
        downtime: '11 weeks',
      },
    ],
  },

  certifications: {
    eyebrow: 'Certifications',
    title: 'Class & compliance.',
    intro:
      'Our work is handed over with documentation that survives an inspection. Without that, a repair is worth nothing.',
    items: [
      { name: 'DNV', detail: 'Approved service supplier' },
      { name: 'ABS', detail: 'Recognised external specialist' },
      { name: "Lloyd's Register", detail: 'Service approval' },
      { name: 'Bureau Veritas', detail: 'Approved service supplier' },
      { name: 'ISO 9001:2015', detail: 'Quality management system' },
      { name: 'ISO 45001', detail: 'Occupational health & safety' },
    ],
    disclaimer:
      'Placeholder content. Replace with IMA’s actual approvals and certificate numbers before going live.',
  },

  coverage: {
    eyebrow: 'Coverage',
    title: 'Where we reach.',
    intro:
      'Based in Piraeus. We cover Greek ports permanently and travel worldwide for breakdowns and riding squads.',
    primary: 'Permanent presence',
    secondary: 'Regular coverage',
    reach: {
      title: 'One base, worldwide radius.',
      body: 'Piraeus is our home — from there we reach every major shipping hub. The lines show indicative routes, not limits.',
      hub: 'Piraeus — home port',
      onRequest: 'Ports on request',
      note: 'An engineer in any port worldwide within 24 hours.',
    },
    worldwide: {
      title: 'Worldwide, on request',
      body: 'Engineer on a plane within 24 hours to any port. Riding squads for voyages of any length.',
    },
    ports: [
      { name: 'Piraeus', tier: 'primary' },
      { name: 'Elefsina', tier: 'primary' },
      { name: 'Perama', tier: 'primary' },
      { name: 'Salamina', tier: 'primary' },
      { name: 'Thessaloniki', tier: 'secondary' },
      { name: 'Volos', tier: 'secondary' },
      { name: 'Patras', tier: 'secondary' },
      { name: 'Heraklion', tier: 'secondary' },
      { name: 'Rhodes', tier: 'secondary' },
    ],
  },

  contact: {
    eyebrow: 'Contact',
    title: 'Report a breakdown.',
    intro:
      'The more specific you are, the faster we send the right engineer with the right tools. If it is urgent, call — do not wait on email.',
    form: {
      urgency: {
        label: 'How urgent is this?',
        options: [
          { value: 'emergency', label: 'Broken down now', hint: 'Vessel is stopped or at risk' },
          { value: 'urgent', label: 'Within days', hint: 'Before next voyage or survey' },
          { value: 'planned', label: 'Planned work', hint: 'Docking, retrofit, quotation' },
        ],
      },
      vesselName: 'Vessel name',
      imo: 'IMO number',
      vesselType: 'Vessel type',
      port: 'Port / location',
      eta: 'ETA / available window',
      system: 'System involved',
      systemPlaceholder: 'e.g. main switchboard, generator AVR, alarm system…',
      description: 'Fault description',
      descriptionPlaceholder:
        'What is happening, since when, what has already been tried. Error codes if you have them.',
      contactName: 'Your name',
      company: 'Company',
      email: 'Email',
      phone: 'Phone',
      submit: 'Send report',
      submitting: 'Sending…',
      required: 'Required',
      optional: 'Optional',
      privacyNotice: 'Your details are used only to answer your enquiry. See our',
      privacyLink: 'Privacy Policy',
    },
    validation: {
      required: 'Please fill in this field.',
      email: 'Please check the email address.',
      imo: 'An IMO number has 7 digits.',
      summary: 'Please check the fields marked below.',
    },
    success: {
      title: 'Report sent.',
      body: 'We reply within 2 hours during office hours. For emergencies, call the 24/7 line — do not rely on email.',
      again: 'Send another',
      mailTitle: 'Finish sending from your email.',
      mailBody:
        'We composed the message with every detail of your report and opened your email client. The report reaches us as soon as you press send there.',
      mailFallback: 'If nothing opened, send it straight to',
    },
    error: {
      title: 'Sending failed.',
      body: 'Your report is not lost — it is still filled in below. Try again, send it by email, or call us directly.',
      mail: 'Send by email',
      call: 'Call the breakdown line',
    },
    direct: {
      title: 'Direct',
      emergency: '24/7 breakdown',
      office: 'Office',
      email: 'Email',
      address: 'Address',
      addressValue: 'Akropoleos 13 & Garivaldi, Nikea 184 51, Greece',
      hours: 'Office hours',
      hoursValue: 'Mon–Fri, 08:00–17:00 EET',
      hoursNote: 'The breakdown line runs 24/7, 365 days a year.',
    },
  },

  privacy: {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    intro:
      'We collect only what you send us through the breakdown report form, and we use it only to reply. No advertising, no tracking, no selling data on.',
    updated: 'Last updated: 21 September 2026',
    sections: [
      {
        title: 'Who we are',
        body: [
          'The data controller is International Marine Automations, Akropoleos 13 & Garivaldi, Nikea 184 51, Greece.',
          'For anything concerning your data, contact us at imagreece@gmail.com or +30 2104814935.',
        ],
      },
      {
        title: 'What we collect',
        body: [
          'Only what you type into the breakdown report form: your name, company, email and phone, together with the incident details — vessel name, IMO number, type, port, ETA, system and fault description.',
          'We do not build profiles, we do not track your browsing, and we do not buy or enrich your details from third-party sources.',
        ],
      },
      {
        title: 'Why we need it',
        body: [
          'To answer your enquiry and send the right engineer with the right tools. Without a port, a fault description and a way to reach you, the job cannot be dispatched.',
          'The legal basis is steps taken at your request prior to entering into a contract (GDPR Art. 6(1)(b)) and our legitimate interest in responding to business enquiries (Art. 6(1)(f)).',
        ],
      },
      {
        title: 'Where it goes',
        body: [
          'The form is delivered by Web3Forms, which turns the submission into an email to us. That correspondence is hosted with Google (Gmail).',
          'Both act as processors and operate outside the EEA; the transfer relies on the standard contractual clauses in their terms. We do not share your data with anyone else unless the law requires it.',
        ],
      },
      {
        title: 'How long we keep it',
        body: [
          'We keep the correspondence for as long as it takes to handle the enquiry and, if work follows, for as long as the related records must be retained. After that it is deleted.',
          'You can ask us to delete it sooner — see below.',
        ],
      },
      {
        title: 'Your rights',
        body: [
          'You have the right to access, correct, erase, restrict and port your data, and to object to processing. Email us and we will respond within one month.',
          'If you believe we have mishandled your data, you can complain to the Hellenic Data Protection Authority (dpa.gr).',
        ],
      },
      {
        title: 'Cookies and local storage',
        body: [
          'This site sets no cookies and runs no analytics or advertising tools.',
          'We store nothing at all on your device. Even the language is part of the address — the Greek version lives under /el — so there is no preference for us to remember.',
        ],
      },
    ],
  },

  footer: {
    tagline: 'Marine electrical, electronics and automation. Based in Piraeus, working worldwide.',
    sections: {
      company: 'Company',
      services: 'Services',
      contact: 'Contact',
    },
    rights: 'All rights reserved.',
  },

  notFound: {
    code: '404',
    title: 'Off course.',
    body: 'The page you asked for does not exist. It may have moved.',
    cta: 'Back to home',
  },
}
