/**
 * Supabase Connection Test Utility
 * 
 * This utility tests if the Supabase client can be initialized
 * with the configured environment variables.
 * 
 * DO NOT use this in production. For development verification only.
 */

import { createClient } from '@/lib/supabase/client';

export async function testSupabaseConnection() {
  try {
    // Verify environment variables exist
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return {
        success: false,
        error: 'NEXT_PUBLIC_SUPABASE_URL is not set in .env.local',
      };
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return {
        success: false,
        error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in .env.local',
      };
    }

    // Initialize the Supabase client
    const supabase = createClient();

    // Verify client was created
    if (!supabase) {
      return {
        success: false,
        error: 'Failed to initialize Supabase client',
      };
    }

    // Test a simple query to verify connection
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      return {
        success: false,
        error: `Connection test failed: ${error.message}`,
      };
    }

    return {
      success: true,
      message: 'Supabase connection verified successfully',
      details: {
        url: '✓ NEXT_PUBLIC_SUPABASE_URL is configured',
        key: '✓ NEXT_PUBLIC_SUPABASE_ANON_KEY is configured',
        client: '✓ Supabase browser client initialized',
        database: '✓ Database connection successful',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Connection test error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
