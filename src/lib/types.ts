export type ImageStatus =
  | 'pending'
  | 'uploaded'
  | 'processing'
  | 'completed'
  | 'failed';

export interface DeviceRow {
  id: string;
  device_name: string | null;
  device_code: string | null;
  is_active: boolean;
  daily_limit: number;
  created_at: string;
  updated_at: string;
}

export interface PresetRow {
  id: string;
  name: string;
  label: string;
  emoji: string | null;
  prompt: string;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ImageRow {
  id: string;
  device_id: string | null;
  preset_id: string | null;
  original_path: string | null;
  generated_path: string | null;
  original_content_type: string | null;
  generated_content_type: string | null;
  status: ImageStatus;
  error_message: string | null;
  created_at: string;
  uploaded_at: string | null;
  completed_at: string | null;
}

export interface ParentSettingsRow {
  id: string;
  device_id: string;
  parent_pin_hash: string;
  save_originals: boolean;
  save_generated: boolean;
  auto_delete_originals_days: number;
  auto_delete_generated_days: number;
  created_at: string;
  updated_at: string;
}

// Public-safe preset shape sent to child mode (no prompt text exposed).
export interface PublicPreset {
  id: string;
  name: string;
  label: string;
  emoji: string | null;
}
