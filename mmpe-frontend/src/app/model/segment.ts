export enum SegmentStatus {
  Confirmed = 0,
  Unconfirmed = 1,
  Active = 2
}

export class Segment {
  id: number;
  source: string;
  target: string;
  mt: string;
  highlevelKeylog: string;
  sourceLanguage: string;
  targetLanguage: string;
  segmentStatus: SegmentStatus;
  keylog: string;

  // Relevant only for the study cases
  studyOperation: string;
  studyCorrection: string;
  studyModality: string;
  studyTrial: boolean;
}
