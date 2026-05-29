export type DrugInteractionHit = {
  kind: 'drug-drug' | 'drug-allergy';
  drugA: string;
  drugB: string;
  severity: 'major' | 'moderate';
  message: string;
};

/** Curated interaction pairs (expand over time; not a full DDI vendor feed). */
export const COMMON_DRUG_INTERACTIONS: Omit<DrugInteractionHit, 'kind'>[] = [
  { drugA: 'warfarin', drugB: 'aspirin', severity: 'major', message: 'Increased bleeding risk — anticoagulant + antiplatelet.' },
  { drugA: 'warfarin', drugB: 'ibuprofen', severity: 'major', message: 'NSAIDs increase bleeding and anticoagulant effect.' },
  { drugA: 'warfarin', drugB: 'naproxen', severity: 'major', message: 'NSAIDs increase bleeding risk with warfarin.' },
  { drugA: 'metformin', drugB: 'contrast', severity: 'major', message: 'Hold metformin around iodinated contrast if renal impairment.' },
  { drugA: 'metformin', drugB: 'iodinated', severity: 'major', message: 'Contrast + metformin — lactic acidosis risk; follow renal protocol.' },
  { drugA: 'ace inhibitor', drugB: 'potassium', severity: 'major', message: 'ACE inhibitors + potassium — hyperkalemia risk.' },
  { drugA: 'lisinopril', drugB: 'potassium', severity: 'major', message: 'ACE inhibitors + potassium — hyperkalemia risk.' },
  { drugA: 'enalapril', drugB: 'spironolactone', severity: 'major', message: 'Dual RAAS blockade / hyperkalemia risk.' },
  { drugA: 'simvastatin', drugB: 'clarithromycin', severity: 'major', message: 'CYP3A4 inhibition — elevated statin levels, myopathy risk.' },
  { drugA: 'atorvastatin', drugB: 'clarithromycin', severity: 'major', message: 'Macrolide may raise statin exposure.' },
  { drugA: 'methotrexate', drugB: 'trimethoprim', severity: 'major', message: 'Increased methotrexate toxicity.' },
  { drugA: 'methotrexate', drugB: 'nsaid', severity: 'major', message: 'NSAIDs reduce methotrexate clearance.' },
  { drugA: 'fluoxetine', drugB: 'tramadol', severity: 'major', message: 'Serotonin syndrome risk (SSRI + serotonergic opioid).' },
  { drugA: 'sertraline', drugB: 'tramadol', severity: 'major', message: 'Serotonin syndrome risk.' },
  { drugA: 'paroxetine', drugB: 'maoi', severity: 'major', message: 'Contraindicated SSRI + MAOI combination.' },
  { drugA: 'amlodipine', drugB: 'simvastatin', severity: 'moderate', message: 'CCB may increase statin levels — consider dose limits.' },
  { drugA: 'digoxin', drugB: 'amiodarone', severity: 'major', message: 'Amiodarone increases digoxin levels — monitor toxicity.' },
  { drugA: 'lithium', drugB: 'ibuprofen', severity: 'major', message: 'NSAIDs may raise lithium levels — toxicity risk.' },
  { drugA: 'phenytoin', drugB: 'fluconazole', severity: 'major', message: 'Azole inhibits phenytoin metabolism.' },
  { drugA: 'clopidogrel', drugB: 'omeprazole', severity: 'moderate', message: 'Some PPIs may reduce antiplatelet effect — prefer pantoprazole if needed.' },
  { drugA: 'sildenafil', drugB: 'nitroglycerin', severity: 'major', message: 'Severe hypotension risk — PDE5 inhibitor + nitrate.' },
  { drugA: 'alcohol', drugB: 'metronidazole', severity: 'major', message: 'Disulfiram-like reaction risk.' },
];

/** Drug name fragments that often indicate a class match against allergy substance text. */
const DRUG_ALLERGY_HINTS: Array<{ drugFragment: string; allergyHints: string[]; message: string }> = [
  { drugFragment: 'penicillin', allergyHints: ['penicillin', 'amoxicillin', 'ampicillin', 'piperacillin'], message: 'Beta-lactam prescribed — patient has penicillin-class allergy on file.' },
  { drugFragment: 'amoxicillin', allergyHints: ['penicillin', 'amoxicillin'], message: 'Amoxicillin may cross-react with documented penicillin allergy.' },
  { drugFragment: 'sulfa', allergyHints: ['sulfa', 'sulfamethoxazole', 'trimethoprim'], message: 'Sulfonamide drug vs documented sulfa allergy.' },
  { drugFragment: 'sulfamethoxazole', allergyHints: ['sulfa', 'sulfamethoxazole'], message: 'TMP-SMX vs sulfa allergy on file.' },
  { drugFragment: 'aspirin', allergyHints: ['aspirin', 'nsaid', 'salicylate'], message: 'Salicylate/NSAID vs aspirin or NSAID allergy.' },
  { drugFragment: 'ibuprofen', allergyHints: ['ibuprofen', 'nsaid'], message: 'NSAID prescribed — NSAID allergy documented.' },
  { drugFragment: 'codeine', allergyHints: ['codeine', 'opioid'], message: 'Opioid vs documented opioid allergy.' },
  { drugFragment: 'morphine', allergyHints: ['morphine', 'opioid'], message: 'Opioid vs documented opioid allergy.' },
  { drugFragment: 'insulin', allergyHints: ['insulin'], message: 'Insulin product vs insulin allergy on file.' },
  { drugFragment: 'latex', allergyHints: ['latex'], message: 'Review latex exposure for devices/gloves (allergy on file).' },
];

function normalizeDrugName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function checkDrugDrugInteractions(drugNames: string[]): DrugInteractionHit[] {
  const normalized = [...new Set(drugNames.map(normalizeDrugName).filter(Boolean))];
  const hits: DrugInteractionHit[] = [];
  for (const pair of COMMON_DRUG_INTERACTIONS) {
    const a = normalizeDrugName(pair.drugA);
    const b = normalizeDrugName(pair.drugB);
    const hasA = normalized.some((d) => d.includes(a) || a.includes(d));
    const hasB = normalized.some((d) => d.includes(b) || b.includes(d));
    if (hasA && hasB) {
      hits.push({ kind: 'drug-drug', drugA: pair.drugA, drugB: pair.drugB, severity: pair.severity, message: pair.message });
    }
  }
  return hits;
}

export function checkDrugAllergyConflicts(
  drugNames: string[],
  allergySubstances: string[],
): DrugInteractionHit[] {
  const drugs = drugNames.map(normalizeDrugName).filter(Boolean);
  const allergies = allergySubstances.map(normalizeDrugName).filter(Boolean);
  if (!drugs.length || !allergies.length) return [];

  const hits: DrugInteractionHit[] = [];
  for (const drug of drugs) {
    for (const allergy of allergies) {
      let matched = drug.includes(allergy) || allergy.includes(drug);
      let message = `Prescribed "${drug}" may conflict with allergy: ${allergy}.`;

      if (!matched) {
        for (const hint of DRUG_ALLERGY_HINTS) {
          const df = normalizeDrugName(hint.drugFragment);
          if (!drug.includes(df) && !df.includes(drug)) continue;
          if (hint.allergyHints.some((h) => allergy.includes(h) || allergies.some((a) => a.includes(h)))) {
            matched = true;
            message = hint.message;
            break;
          }
        }
      }

      if (matched) {
        hits.push({
          kind: 'drug-allergy',
          drugA: drug,
          drugB: allergy,
          severity: 'major',
          message,
        });
      }
    }
  }
  return hits;
}

export function checkDrugInteractions(
  drugNames: string[],
  allergySubstances: string[] = [],
): DrugInteractionHit[] {
  const ddi = checkDrugDrugInteractions(drugNames);
  const allergy = checkDrugAllergyConflicts(drugNames, allergySubstances);
  const seen = new Set<string>();
  return [...ddi, ...allergy].filter((h) => {
    const key = `${h.kind}:${h.drugA}:${h.drugB}:${h.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
