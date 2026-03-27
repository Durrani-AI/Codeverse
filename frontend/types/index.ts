/*    TypeScript interfaces for the AI Interview Platform */

// Enums

export type InterviewType = "coding" | "behavioral" | "system_design";
export type DifficultyLevel = "easy" | "medium" | "hard";
export type SessionStatus = "in_progress" | "completed" | "cancelled";
export type QuestionType = "coding" | "behavioral" | "system_design" | "follow_up";
export type ImprovementTrend = "improving" | "stable" | "declining" | "insufficient_data";

// 1. User

export interface User {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string; // ISO-8601
}

// 2. InterviewSession

export interface InterviewSession {
  id: string;
  user_id: string;
  interview_type: InterviewType;
  difficulty_level: DifficultyLevel;
  status: SessionStatus;
  topic: string | null;
  started_at: string;
  completed_at: string | null;
  questions: Question[];
  questions_count: number;
}

// 3. Question

export interface Question {
  id: string;
  session_id: string;
  question_text: string;
  question_type: QuestionType;
  asked_at: string;
}

// 4. UserResponse (candidate answer)

export interface UserResponse {
  id: string;
  question_id: string;
  response_text: string;
  response_code: string | null;
  submitted_at: string;
  feedback: Feedback | null;
}

// 5. Feedback

export interface Feedback {
  id: string;
  response_id: string;
  ai_feedback_text: string;
  score: number; // 1-10
  strengths: string[] | null;
  improvements: string[] | null;
  created_at: string;
}

// 6. Analytics

export interface PerformanceByType {
  interview_type: string;
  total_feedbacks: number;
  average_score: number;
}

export interface AnalyticsOverview {
  sessions_count: number;
  completed_sessions: number;
  in_progress_sessions: number;
  total_questions_asked: number;
  average_score: number;
  improvement_trend: ImprovementTrend;
  by_type: PerformanceByType[];
}

export interface RecentSession {
  id: string;
  interview_type: string;
  difficulty: string;
  status: string;
  started_at: string | null;
}

// API Request Bodies

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface StartInterviewRequest {
  interview_type: InterviewType;
  difficulty_level: DifficultyLevel;
  topic: string;
  num_questions?: number;
}

export interface SubmitAnswerRequest {
  question_id: string;
  response_text: string;
  response_code?: string;
}

// API Response Bodies

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface InterviewStartResponse {
  session_id: string;
  interview_type: InterviewType;
  difficulty_level: DifficultyLevel;
  topic: string;
  status: SessionStatus;
  started_at: string;
  first_question: Question;
}

export interface AnswerSubmitResponse {
  response: UserResponse;
  is_complete: boolean;
  next_question: Question | null;
  questions_remaining: number | null;
}

export interface QuestionFeedbackDetail {
  question_text: string;
  question_type: string;
  score: number | null;
  ai_feedback_text: string | null;
  strengths: string[] | null;
  improvements: string[] | null;
}

export interface SessionFeedbackResponse {
  session_id: string;
  overall_score: number | null;
  summary: string;
  key_strengths: string[];
  areas_for_improvement: string[];
  recommendations: string[];
  questions_answered: number;
  individual_scores: (number | null)[];
  question_feedbacks: QuestionFeedbackDetail[];
}

// Generic API wrapper

export interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data: T;
}

export interface ApiError {
  detail?: string;
  error?: string;
  message?: string;
  errors?: Array<{ loc: string[]; msg: string; type: string }>;
}

