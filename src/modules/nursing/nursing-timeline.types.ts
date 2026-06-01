export type ClinicalTimelineKind =
  | 'emr'
  | 'nursing_flowsheet'
  | 'nursing_ews'
  | 'nursing_care_plan'
  | 'emar';

export type ClinicalTimelineItem = {
  kind: ClinicalTimelineKind;
  id: string;
  at: string;
  title: string;
  summary?: string;
  meta?: Record<string, unknown>;
};
