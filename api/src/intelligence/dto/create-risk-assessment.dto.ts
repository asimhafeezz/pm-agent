export class CreateRiskAssessmentDto {
  riskType: string;
  severity: string;
  description: string;
  mitigation?: string;
  evidence?: Record<string, unknown>;
  linkedIssueId?: string;
}

export class BulkCreateRisksDto {
  risks: CreateRiskAssessmentDto[];
}

export class UpdateRiskStatusDto {
  status: string; // 'open' | 'acknowledged' | 'mitigated' | 'resolved'
}

export class CreateWeeklySummaryDto {
  executiveSummary: string;
  metrics?: Record<string, unknown>;
  highlights?: Record<string, unknown>[];
  risks?: Record<string, unknown>[];
  recommendations?: Record<string, unknown>[];
  periodStart: string;
  periodEnd: string;
}
