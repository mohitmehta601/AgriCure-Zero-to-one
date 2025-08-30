import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our database tables
export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  farm_location?: string;
  phone_number?: string;
  farm_size?: number;
  farm_size_unit?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface FertilizerRecommendation {
  id: string;
  user_id: string;
  field_name: string;
  field_size: number;
  field_size_unit: string;
  crop_type: string;
  soil_type: string;
  soil_ph: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  temperature: number;
  humidity: number;
  soil_moisture: number;
  primary_fertilizer: string;
  secondary_fertilizer?: string;
  ml_prediction: string;
  confidence_score: number;
  cost_estimate?: string;
  status: 'pending' | 'applied' | 'scheduled';
  created_at: string;
}

export interface Farm {
  id: string;
  user_id: string;
  name: string;
  size: number;
  unit: 'hectares' | 'acres' | 'bigha';
  crop_type: string;
  soil_type: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  soil_data?: any; // JSON data for detailed soil properties
  sowing_date?: string; // ISO date string (YYYY-MM-DD)
  created_at: string;
  updated_at: string;
}