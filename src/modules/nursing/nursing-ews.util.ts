/** Simplified NEWS2-style scoring for MVP (not full UK NEWS2 certification). */
export function calculateNews2Score(input: {
  respiratoryRate: number;
  spo2: number;
  supplementalO2: boolean;
  temperature: number;
  systolicBp: number;
  pulse: number;
  consciousness: string;
}): number {
  let score = 0;
  const rr = input.respiratoryRate;
  if (rr <= 8) score += 3;
  else if (rr <= 11) score += 1;
  else if (rr <= 20) score += 0;
  else if (rr <= 24) score += 2;
  else score += 3;

  const spo2 = input.spo2;
  if (spo2 <= 91) score += 3;
  else if (spo2 <= 93) score += 2;
  else if (spo2 <= 95) score += 1;
  if (input.supplementalO2) score += 2;

  const temp = input.temperature;
  if (temp <= 35) score += 3;
  else if (temp <= 36) score += 1;
  else if (temp <= 38) score += 0;
  else if (temp <= 39) score += 1;
  else score += 2;

  const sbp = input.systolicBp;
  if (sbp <= 90) score += 3;
  else if (sbp <= 100) score += 2;
  else if (sbp <= 110) score += 1;
  else if (sbp <= 219) score += 0;
  else score += 3;

  const pulse = input.pulse;
  if (pulse <= 40) score += 3;
  else if (pulse <= 50) score += 1;
  else if (pulse <= 90) score += 0;
  else if (pulse <= 110) score += 1;
  else if (pulse <= 130) score += 2;
  else score += 3;

  const c = input.consciousness.toUpperCase();
  if (c !== 'A' && c !== 'ALERT') score += 3;

  return score;
}

export function ewsRiskBand(total: number): 'low' | 'medium' | 'high' {
  if (total >= 7) return 'high';
  if (total >= 5) return 'medium';
  return 'low';
}
