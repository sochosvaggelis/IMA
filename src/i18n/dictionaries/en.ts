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

  nav: {
    home: 'Home',
    services: 'Services',
    capabilities: 'Capabilities',
    projects: 'Projects',
    certifications: 'Certifications',
    coverage: 'Coverage',
    contact: 'Contact',
    menu: 'Menu',
    close: 'Close',
    skipToContent: 'Skip to content',
  },

  emergency: {
    label: '24/7 Breakdown',
    phone: '+30 210 000 0000',
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
    },
    validation: {
      required: 'Please fill in this field.',
      email: 'Please check the email address.',
      imo: 'An IMO number has 7 digits.',
    },
    success: {
      title: 'Report sent.',
      body: 'We reply within 2 hours during office hours. For emergencies, call the 24/7 line — do not rely on email.',
      again: 'Send another',
    },
    direct: {
      title: 'Direct',
      emergency: '24/7 breakdown',
      office: 'Office',
      email: 'Email',
      address: 'Address',
      addressValue: 'Akti Miaouli 00, Piraeus 185 00, Greece',
      hours: 'Office hours',
      hoursValue: 'Mon–Fri, 08:00–18:00 EET',
      hoursNote: 'The breakdown line runs 24/7, 365 days a year.',
    },
  },

  footer: {
    tagline: 'Marine electrical, electronics and automation. Based in Piraeus, working worldwide.',
    sections: {
      company: 'Company',
      services: 'Services',
      contact: 'Contact',
    },
    rights: 'All rights reserved.',
    placeholder: 'Demo site with placeholder content — these details are not real.',
  },

  notFound: {
    code: '404',
    title: 'Off course.',
    body: 'The page you asked for does not exist. It may have moved.',
    cta: 'Back to home',
  },
}
