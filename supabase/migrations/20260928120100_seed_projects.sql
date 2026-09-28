-- The four case studies the site launched with, moved out of the dictionaries
-- (src/i18n/dictionaries) so the admin panel can edit them. Same ids as
-- src/content/snapshot/projects.json, which is this data as the site ships it
-- until the first snapshot is taken from the live database.

insert into public.projects (
  id,
  position,
  published,
  scope,
  title_el,
  title_en,
  vessel_el,
  vessel_en,
  location_el,
  location_en,
  problem_el,
  problem_en,
  solution_el,
  solution_en,
  downtime_el,
  downtime_en
)
values
  (
    '6f1c2a0e-4b7d-4c1e-9a52-1d3f8e0b7a01',
    1,
    true,
    'systems',
    'Blackout από σφάλμα συγχρονισμού γεννητριών',
    'Blackouts traced to a generator synchronising fault',
    'Bulk carrier, 82.000 DWT',
    'Bulk carrier, 82,000 DWT',
    'Πειραιάς',
    'Piraeus',
    'Επαναλαμβανόμενα blackout κατά την παράλληλη λειτουργία δύο γεννητριών. Δύο προηγούμενοι προμηθευτές είχαν αντικαταστήσει τον AVR χωρίς αποτέλεσμα.',
    'Repeated blackouts when running two generators in parallel. Two previous suppliers had replaced the AVR with no effect.',
    'Η διάγνωση εντόπισε φθαρμένο current transformer στον πίνακα συγχρονισμού, όχι στη γεννήτρια. Αντικατάσταση CT, επαναβαθμονόμηση load sharing, δοκιμή σε πλήρες φορτίο.',
    'Fault-finding located a degraded current transformer in the synchronising panel, not in the generator. CT replaced, load sharing recalibrated, tested at full load.',
    '11 ώρες',
    '11 hours'
  ),
  (
    '6f1c2a0e-4b7d-4c1e-9a52-1d3f8e0b7a02',
    2,
    true,
    'component',
    'Obsolete πλακέτα ballast control χωρίς ανταλλακτικό',
    'Obsolete ballast control board with no spare in existence',
    'Product tanker, 50.000 DWT',
    'Product tanker, 50,000 DWT',
    'Εργαστήριο IMA',
    'IMA workshop',
    'Η κάρτα ελέγχου του ballast system είχε βγει από παραγωγή το 2009. Ο κατασκευαστής πρότεινε πλήρη αναβάθμιση συστήματος, κόστους έξι ψηφίων.',
    'The ballast system control card went out of production in 2009. The maker proposed a full system upgrade at six-figure cost.',
    'Επισκευή σε επίπεδο εξαρτήματος: αντικατάσταση δύο driver ICs και του ρελέ εξόδου, ανακατασκευή διαβρωμένων δρόμων. Δοκιμή 72 ωρών σε πάγκο πριν την επιστροφή.',
    'Component-level repair: two driver ICs and the output relay replaced, corroded tracks rebuilt. 72-hour bench test before return.',
    '6 ημέρες (χωρίς ακινητοποίηση πλοίου)',
    '6 days (vessel never stopped)'
  ),
  (
    '6f1c2a0e-4b7d-4c1e-9a52-1d3f8e0b7a03',
    3,
    true,
    'systems',
    'Ψευδείς συναγερμοί πυρανίχνευσης πριν από class survey',
    'False fire alarms four days before class survey',
    'Container vessel, 4.500 TEU',
    'Container vessel, 4,500 TEU',
    'Ελευσίνα',
    'Elefsina',
    'Δεκάδες ψευδείς συναγερμοί ημερησίως στο μηχανοστάσιο. Το survey ήταν σε 4 ημέρες και το σύστημα δεν θα περνούσε.',
    'Dozens of false alarms per day in the engine room. Survey was in four days and the system would not have passed.',
    'Εντοπισμός σφάλματος μόνωσης σε βρόχο ανιχνευτών λόγω εισροής νερού. Αντικατάσταση 40 μέτρων καλωδίου και 6 ανιχνευτών, πλήρης δοκιμή βρόχου, τεκμηρίωση για τον επιθεωρητή.',
    'Traced an insulation fault on a detector loop caused by water ingress. Replaced 40 m of cable and 6 detectors, full loop test, documentation prepared for the surveyor.',
    '2 ημέρες — το survey πέρασε',
    '2 days — survey passed'
  ),
  (
    '6f1c2a0e-4b7d-4c1e-9a52-1d3f8e0b7a04',
    4,
    true,
    'retrofit',
    'Πλήρης ηλεκτρολογική ανακατασκευή μετά από πυρκαγιά',
    'Full electrical refit after an engine room fire',
    'Ro-Ro ferry',
    'Ro-Ro ferry',
    'Ναυπηγείο, Πέραμα',
    'Perama shipyard',
    'Πυρκαγιά στο μηχανοστάσιο κατέστρεψε τον κύριο πίνακα και μεγάλο μέρος της καλωδίωσης. Δεν υπήρχαν ενημερωμένα σχέδια — τα τελευταία ήταν του 1998.',
    'An engine room fire destroyed the main switchboard and much of the wiring. No current drawings existed — the last set was from 1998.',
    'Αποτύπωση και αναδημιουργία των σχεδίων από το μηδέν, κατασκευή νέου switchboard, πλήρης επανακαλωδίωση μηχανοστασίου, παράδοση με class approval.',
    'Surveyed and redrew the electrical drawings from scratch, built a new switchboard, fully rewired the engine room, handed over with class approval.',
    '11 εβδομάδες',
    '11 weeks'
  )
on conflict (id) do nothing;
