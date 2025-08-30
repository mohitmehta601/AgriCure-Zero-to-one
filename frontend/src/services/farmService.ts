import { supabase, Farm } from './supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export type SoilDataResponse = {
  location: { latitude: number; longitude: number; timestamp: string };
  soil_type: "Loamy" | "Sandy" | "Clayey" | "Silty" | "Red" | "Black" | "Laterite" | "Peaty" | "Saline" | "Alkaline";
  soil_properties: Record<string, number>;
  confidence: number;
  sources: string[];
  success: boolean;
  location_info?: Record<string, any>;
};

export async function fetchSoilType(lat: number, lon: number): Promise<SoilDataResponse> {
  const res = await fetch(`${API_BASE_URL}/soil-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude: lat, longitude: lon }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Soil API failed: ${res.status} ${t}`);
  }
  return res.json();
}

export interface CreateFarmData {
  user_id: string;
  name: string;
  size: number;
  unit: 'hectares' | 'acres' | 'bigha';
  crop_type: string;
  soil_type: string;
  location: string;
  latitude?: number;
  longitude?: number;
  soil_data?: any; // JSON data for soil properties
  sowing_date: string; // ISO date string (YYYY-MM-DD)
}

export interface UpdateFarmData {
  name?: string;
  size?: number;
  unit?: 'hectares' | 'acres' | 'bigha';
  crop_type?: string;
  soil_type?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  soil_data?: any; // JSON data for soil properties
  sowing_date?: string; // ISO date string (YYYY-MM-DD)
}

export const farmService = {
  // Create new farm
  async createFarm(data: CreateFarmData) {
    try {
      const { data: farm, error } = await supabase
        .from('farms')
        .insert(data)
        .select()
        .single();

      return { data: farm, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get farms by user
  async getFarmsByUser(userId: string): Promise<{ data: Farm[] | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('farms')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get a single farm by id
  async getFarmById(id: string): Promise<{ data: Farm | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('farms')
        .select('*')
        .eq('id', id)
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update farm
  async updateFarm(farmId: string, updateData: UpdateFarmData) {
    try {
      const { data, error } = await supabase
        .from('farms')
        .update(updateData)
        .eq('id', farmId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Delete farm
  async deleteFarm(farmId: string) {
    try {
      const { error } = await supabase
        .from('farms')
        .delete()
        .eq('id', farmId);

      return { error };
    } catch (error) {
      return { error };
    }
  },

  // Get farm statistics for a user
  async getFarmStats(userId: string) {
    try {
      const { data, error } = await supabase
        .from('farms')
        .select('size, unit')
        .eq('user_id', userId);

      if (error) throw error;

      // Calculate total farm size in hectares
      let totalSize = 0;
      data?.forEach(farm => {
        if (farm.unit === 'hectares') {
          totalSize += farm.size;
        } else if (farm.unit === 'acres') {
          totalSize += farm.size * 0.404686; // Convert acres to hectares
        } else if (farm.unit === 'bigha') {
          totalSize += farm.size * 0.1338; // Convert bigha to hectares (approximate)
        }
      });

      return { 
        data: { 
          totalFarms: data?.length || 0, 
          totalSize: Math.round(totalSize * 100) / 100 
        }, 
        error: null 
      };
    } catch (error) {
      return { data: null, error };
    }
  }
};

export type { Farm };
