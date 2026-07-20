/** The company name, broken where the lockup breaks it.
 *
 * Its own module rather than an export from Logo: the intro curtain sets the
 * same two lines independently — on a phone the header has dropped them and the
 * curtain is the one place the company is named in full — and the two spellings
 * must not be able to drift apart. (A constant exported from a component file
 * also costs that file its fast-refresh boundary.) */
export const COMPANY_NAME_LINES = ['International', 'Marine Automations'] as const
