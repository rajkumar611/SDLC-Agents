export type Phase = 'requirements' | 'design' | 'qa';
export type RunStatus = 'running' | 'awaiting_review' | 'completed' | 'failed';

export interface PipelineRun {
  id: string;
  created_at: string;
  status: RunStatus;
  current_phase: Phase;
  file_name: string | null;
  file_path: string | null;
  requirements_output: string | null;
  design_output: string | null;
  qa_output: string | null;
  requirements_started_at: string | null;
  requirements_completed_at: string | null;
  design_started_at: string | null;
  design_completed_at: string | null;
  qa_started_at: string | null;
  qa_completed_at: string | null;
  completed_at: string | null;
}

export interface PipelineReview {
  id: number;
  run_id: string;
  phase: Phase;
  action: 'approved' | 'rejected';
  feedback: string | null;
  reviewed_at: string;
}

export interface SSEUpdate {
  snapshot?: boolean;
  run?: PipelineRun;
  phase?: string;
  status?: string;
  output?: RequirementsOutput | unknown;
  feedback?: string;
  error?: string;
}

// ── Requirements Agent output schema ─────────────────────────────────────────

export interface AcceptanceCriteria {
  given: string;
  when: string;
  then: string;
}

export interface Requirement {
  id: string;
  description: string;
  acceptance_criteria: AcceptanceCriteria;
  status: 'CLEAR' | 'AMBIGUOUS' | 'INCOMPLETE' | 'SECURITY_FLAG';
  finding: string | null;
  clarifying_questions: string[];
}

// ── QA Agent output schema ────────────────────────────────────────────────────

export type TestPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface QATestCase {
  id: string;
  title: string;
  priority: TestPriority;
  preconditions: string;
  steps: string[];
  expected_result: string;
  // functional
  linked_api_endpoint?: string | null;
  linked_requirement?: string | null;
  // database
  linked_table?: string | null;
  linked_constraint?: string | null;
  // ui
  linked_screen?: string | null;
  linked_user_flow?: string | null;
  // security
  attack_vector?: string;
  // edge cases
  edge_type?: string;
}

export interface TraceabilityEntry {
  component: string;
  component_type: string;
  test_case_ids: string[];
}

export interface CoverageGap {
  area: string;
  reason: string;
  recommendation: string;
}

export interface QAOutput {
  test_suite: {
    functional: QATestCase[];
    database: QATestCase[];
    ui: QATestCase[];
    security: QATestCase[];
    edge_cases: QATestCase[];
  };
  summary: {
    total: number;
    functional: number;
    database: number;
    ui: number;
    security: number;
    edge_cases: number;
  };
  traceability_matrix: TraceabilityEntry[];
  coverage_gaps: CoverageGap[];
  pipeline_metadata: {
    phase: string;
    next_phase: string | null;
    ready_for_handoff: boolean;
    handoff_blocked_reason: string | null;
  };
}

// ── Design Agent output schema ────────────────────────────────────────────────

export interface DesignEndpoint {
  method: string;
  path: string;
  description: string;
  request_body: string;
  response: string;
  auth_required: boolean;
}

export interface DesignService {
  name: string;
  responsibility: string;
  dependencies: string[];
}

export interface DesignColumn {
  name: string;
  type: string;
  constraints: string;
  description: string;
}

export interface DesignTable {
  name: string;
  purpose: string;
  columns: DesignColumn[];
}

export interface DesignRelationship {
  from: string;
  to: string;
  type: string;
  description: string;
}

export interface DesignComponent {
  name: string;
  purpose: string;
  parent: string | null;
}

export interface DesignUserFlow {
  name: string;
  steps: string[];
  flow_mermaid: string;
}

export interface DesignWireframe {
  screen: string;
  description: string;
  ascii_layout: string;
}

export interface DesignDecision {
  decision: string;
  rationale: string;
  alternatives_considered: string[];
}

export interface DesignOpenQuestion {
  question: string;
  impact: string;
  raised_by: string;
}

export interface DesignOutput {
  design: {
    backend: {
      architecture_style: string;
      tech_stack: string[];
      services: DesignService[];
      api_endpoints: DesignEndpoint[];
    };
    database: {
      type: string;
      engine: string;
      tables: DesignTable[];
      relationships: DesignRelationship[];
      erd_mermaid: string;
    };
    frontend: {
      architecture_style: string;
      tech_stack: string[];
      components: DesignComponent[];
      user_flows: DesignUserFlow[];
      wireframes: DesignWireframe[];
    };
    diagrams: {
      system_overview_mermaid: string;
      component_hierarchy_mermaid: string;
    };
  };
  summary: {
    total_api_endpoints: number;
    total_tables: number;
    total_components: number;
    total_wireframes: number;
    total_user_flows: number;
  };
  design_decisions: DesignDecision[];
  open_questions: DesignOpenQuestion[];
  pipeline_metadata: {
    phase: string;
    next_phase: string;
    ready_for_handoff: boolean;
    handoff_blocked_reason: string | null;
  };
}

// ── Requirements Agent output schema ─────────────────────────────────────────

export interface RequirementsOutput {
  requirements: Requirement[];
  summary: {
    total: number;
    clear: number;
    ambiguous: number;
    incomplete: number;
    security_flags: number;
  };
  overall_clarifying_questions: string[];
  pipeline_metadata: {
    phase: string;
    next_phase: string;
    ready_for_handoff: boolean;
    handoff_blocked_reason: string | null;
  };
}
