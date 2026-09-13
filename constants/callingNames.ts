import type { Language } from './translations';

/**
 * Display-time translation of calling names.
 *
 * `callings.calling_name` is stored as English free text (the picker writes the
 * English label from CALLING_GROUPS; "Other" writes whatever was typed). The
 * database is never rewritten — this map only changes what is rendered, so a
 * Spanish-speaking leader sees "Secretario de Barrio" on the same card an
 * English-speaking leader sees as "Ward Clerk". Names not in the map (custom
 * "Other" entries) pass through unchanged.
 *
 * Terminology follows the Spanish General Handbook (Manual General).
 */
export const CALLING_NAMES_ES: Record<string, string> = {
  // Bishopric
  'First Counselor in Bishopric': 'Primer Consejero del Obispado',
  'Second Counselor in Bishopric': 'Segundo Consejero del Obispado',
  'Ward Clerk': 'Secretario de Barrio',
  'Assistant Ward Clerk': 'Secretario Auxiliar de Barrio',
  'Assistant Ward Clerk Finance': 'Secretario Auxiliar de Barrio (Finanzas)',
  'Assistant Ward Clerk Membership': 'Secretario Auxiliar de Barrio (Registros de Miembros)',
  'Ward Executive Secretary': 'Secretario Ejecutivo de Barrio',
  'Assistant Ward Executive Secretary': 'Secretario Ejecutivo Auxiliar de Barrio',

  // Elders Quorum
  'Elders Quorum President': 'Presidente del Cuórum de Élderes',
  'First Counselor in Elders Quorum Presidency': 'Primer Consejero de la Presidencia del Cuórum de Élderes',
  'Second Counselor in Elders Quorum Presidency': 'Segundo Consejero de la Presidencia del Cuórum de Élderes',

  // Stake
  'High Councilor': 'Sumo Consejero',
  'Stake Executive Secretary': 'Secretario Ejecutivo de Estaca',
  'Stake Clerk': 'Secretario de Estaca',
  'Assistant Stake Clerk': 'Secretario Auxiliar de Estaca',
  'Stake Relief Society President': 'Presidenta de la Sociedad de Socorro de Estaca',
  'First Counselor in Stake Relief Society': 'Primera Consejera de la Sociedad de Socorro de Estaca',
  'Second Counselor in Stake Relief Society': 'Segunda Consejera de la Sociedad de Socorro de Estaca',
  'Stake Young Women President': 'Presidenta de las Mujeres Jóvenes de Estaca',
  'First Counselor in Stake Young Women': 'Primera Consejera de las Mujeres Jóvenes de Estaca',
  'Second Counselor in Stake Young Women': 'Segunda Consejera de las Mujeres Jóvenes de Estaca',
  'Stake Primary President': 'Presidenta de la Primaria de Estaca',
  'First Counselor in Stake Primary': 'Primera Consejera de la Primaria de Estaca',
  'Second Counselor in Stake Primary': 'Segunda Consejera de la Primaria de Estaca',
  'Stake Young Men President': 'Presidente de los Hombres Jóvenes de Estaca',
  'First Counselor in Stake Young Men Presidency': 'Primer Consejero de la Presidencia de los Hombres Jóvenes de Estaca',
  'Second Counselor in Stake Young Men Presidency': 'Segundo Consejero de la Presidencia de los Hombres Jóvenes de Estaca',
  'Stake Sunday School President': 'Presidente de la Escuela Dominical de Estaca',

  // Picker sentinel
  'Other': 'Otro',

  // Common "Other" entries and the demo fixtures, so custom cards and the
  // demo stake read naturally too.
  'Bishop': 'Obispo',
  'Bishopric 1st Counselor': 'Primer Consejero del Obispado',
  'Bishopric 2nd Counselor': 'Segundo Consejero del Obispado',
  'Relief Society President': 'Presidenta de la Sociedad de Socorro',
  'Young Women President': 'Presidenta de las Mujeres Jóvenes',
  'Young Men President': 'Presidente de los Hombres Jóvenes',
  'Primary President': 'Presidenta de la Primaria',
  'Primary 1st Counselor': 'Primera Consejera de la Primaria',
  'Primary 2nd Counselor': 'Segunda Consejera de la Primaria',
  'Sunday School President': 'Presidente de la Escuela Dominical',
  'Sunday School Teacher': 'Maestro de la Escuela Dominical',
  'Ward Mission Leader': 'Líder Misional de Barrio',
  'Stake Patriarch': 'Patriarca de Estaca',
  'Patriarch': 'Patriarca',
  'Stake Music Director': 'Director de Música de Estaca',
  'Stake Audit Committee': 'Comité de Auditorías de Estaca',
  'Activities Committee Chair': 'Presidente del Comité de Actividades',
  'High Council (Missionary)': 'Sumo Consejo (Obra Misional)',
  'Ordain to Elder': 'Ordenar Élder',
  'Ordain to High Priest': 'Ordenar Sumo Sacerdote',
};

/** Organization headers used by the calling pickers (CALLING_GROUPS[].org). */
export const ORG_NAMES_ES: Record<string, string> = {
  'Bishopric': 'Obispado',
  'Elders Quorum': 'Cuórum de Élderes',
  'Stake': 'Estaca',
  'Other': 'Otro',
};

// Case- and whitespace-insensitive index so a hand-typed "ward clerk" still
// matches. Built once.
const CALLING_INDEX_ES: Record<string, string> = Object.fromEntries(
  Object.entries(CALLING_NAMES_ES).map(([en, es]) => [normalize(en), es]),
);

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

// MP ordination cards store "Melchizedek Priesthood Ordination (<office>)".
// The office was written through t() at creation time, so a card created by a
// Spanish speaker carries "(Élder)" or "(Sumo Sacerdote)" — read both forms
// and render the office in the viewer's language either way.
const MP_ORDINATION_RE = /^melchizedek priesthood ordination\s*\((.+)\)$/i;
const OFFICE_KEY: Record<string, 'elder' | 'high_priest'> = {
  'elder': 'elder',
  'élder': 'elder',
  'high priest': 'high_priest',
  'sumo sacerdote': 'high_priest',
};
const MP_ORDINATION_LABEL: Record<Language, { prefix: string; elder: string; high_priest: string }> = {
  en: { prefix: 'Melchizedek Priesthood Ordination', elder: 'Elder', high_priest: 'High Priest' },
  es: { prefix: 'Ordenación al Sacerdocio de Melquisedec', elder: 'Élder', high_priest: 'Sumo Sacerdote' },
};

/**
 * Returns the calling name as it should be displayed in `language`.
 * Falls back to the stored text when there is no translation.
 */
export function translateCallingName(name: string | null | undefined, language: Language): string {
  if (!name) return '';
  const mp = name.trim().match(MP_ORDINATION_RE);
  if (mp) {
    const office = OFFICE_KEY[normalize(mp[1])];
    if (office) {
      const l = MP_ORDINATION_LABEL[language];
      return `${l.prefix} (${l[office]})`;
    }
  }
  if (language === 'en') return name;
  return CALLING_INDEX_ES[normalize(name)] ?? name;
}

/** Returns the organization header for the calling picker in `language`. */
export function translateOrgName(org: string, language: Language): string {
  if (language === 'en') return org;
  return ORG_NAMES_ES[org] ?? org;
}
