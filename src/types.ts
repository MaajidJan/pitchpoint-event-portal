export interface Env {
  DB: D1Database;
  AI?: any;
  ASSETS?: Fetcher;
  ENVIRONMENT?: string;
  WEBHOOK_SECRET?: string;
  EASYPAISA_TITLE?: string;
  EASYPAISA_NUMBER?: string;
  GMAIL_ACCOUNT?: string;
}

export interface IncomingPayment {
  trx_id: string;
  amount: number;
  sender_name?: string;
  sender_phone?: string;
  payment_method: string;
  raw_text: string;
  source: 'GMAIL' | 'SMS' | 'SIMULATION' | 'MANUAL';
  status: 'UNCLAIMED' | 'CLAIMED';
  claimed_by?: string;
  received_at?: string;
}

export interface Registration {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  roll_no: string;
  department: string;
  ticket_type: string;
  expected_amount: number;
  trx_id?: string;
  ocr_amount?: number;
  ocr_sender?: string;
  ocr_raw?: string;
  screenshot_preview?: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verification_notes?: string;
  ticket_qr?: string;
  payment_method?: 'EASYPAISA' | 'CASH';
  cashier_name?: string;
  receipt_no?: string;
  checked_in_at?: string;
  checkin_by?: string;
  verified_at?: string;
  created_at?: string;
}

export interface DeskShift {
  id: string;
  cashier_name: string;
  desk_number: string;
  started_at: string;
  closed_at?: string;
  total_cash_collected: number;
  total_tickets_sold: number;
  handover_to?: string;
  handover_status: 'OPEN' | 'PENDING_HANDOVER' | 'APPROVED';
  handover_notes?: string;
  approved_at?: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  paid_to?: string;
  receipt_image?: string;
  recorded_by: string;
  created_at?: string;
}

export interface ParsedReceipt {
  trx_id: string;
  amount: number;
  sender_name?: string;
  sender_phone?: string;
  timestamp?: string;
  raw_text: string;
}

export interface OCRResult {
  success: boolean;
  trx_id?: string;
  amount?: number;
  sender_name?: string;
  receiver_title?: string;
  receiver_phone?: string;
  timestamp?: string;
  raw_text?: string;
  confidence?: string;
}

export interface AuditLogEntry {
  id: number;
  event_type: string;
  reference_id?: string;
  details: string;
  created_at: string;
}

export interface SystemSetting {
  key: string;
  value: string;
}

export interface StaffUser {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  role: 'ADMIN' | 'FINANCE' | 'CASHIER' | 'GATE_SCANNER' | 'JUDGE' | 'STAGE_COORDINATOR' | 'VIEW_ONLY';
  title?: string;
  plain_passcode?: string;
  phone?: string;
  is_active: number;
  created_at?: string;
}

export interface JudgeScore {
  id: string;
  team_id: string;
  judge_id: string;
  judge_name: string;
  score_idea: number;
  score_solution: number;
  score_business: number;
  score_impact: number;
  score_startup: number;
  score_judges: number;
  total_score: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface JudgeFeedback {
  id: string;
  judge_id: string;
  judge_name: string;
  judge_title?: string;
  overall_rating?: number;
  organization_rating?: number;
  pitch_quality_rating?: number;
  venue_rating?: number;
  best_highlights?: string;
  areas_of_improvement?: string;
  general_comments?: string;
  created_at?: string;
  updated_at?: string;
}


export interface StallApplication {
  id: string;
  stall_name: string;
  brand_or_society?: string;
  category: string;
  applicant_name: string;
  applicant_phone: string;
  applicant_email?: string;
  roll_no?: string;
  requirements?: string;
  description?: string;
  status: 'PENDING_REVIEW' | 'APPROVED_FOR_PAYMENT' | 'VERIFYING_PAYMENT' | 'VERIFIED' | 'REJECTED';
  agreed_fee: number;
  trx_id?: string;
  payment_method?: string;
  screenshot_preview?: string;
  ocr_raw?: string;
  admin_notes?: string;
  stall_qr?: string;
  approved_by?: string;
  approved_at?: string;
  verified_at?: string;
  created_at?: string;
}

export interface IdeaCruxTeam {
  id: string;
  team_name: string;
  members_count: number;
  leader_name: string;
  leader_email: string;
  leader_phone: string;
  leader_dept: string;
  leader_semester?: string;
  member_2_name?: string;
  member_2_phone?: string;
  member_3_name?: string;
  member_3_phone?: string;
  startup_name: string;
  idea_description: string;
  problem_statement: string;
  startup_stage: string;
  revenue_model?: string;
  pitch_deck_ready?: string;
  available_on_day?: string;
  pitch_deck_url?: string;
  fee_amount: number;
  payment_method?: string;
  receipt_no?: string;
  cashier_name?: string;
  trx_id?: string;
  screenshot_preview?: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  pitch_pass_qr?: string;
  admin_notes?: string;
  whatsapp_sent?: number;
  timing_slot?: string;
  checked_in_at?: string;
  verified_at?: string;
  created_at?: string;
}


