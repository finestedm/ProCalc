import { SupabaseStorage } from './supabaseStorage';
import { ICalculationStorage } from './types';

// The singleton instance
export const storageService: ICalculationStorage = new SupabaseStorage();
