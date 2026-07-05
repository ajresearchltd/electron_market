'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SupabaseTestPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Create Supabase client
        const supabase = createClient();

        // Test query to users table
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .limit(1);

        if (error) {
          setResult({
            success: false,
            message: `Connection failed: ${error.message}`,
          });
        } else {
          setResult({
            success: true,
            message: 'Supabase connection OK',
            recordsFound: data?.length || 0,
          });
        }
      } catch (err) {
        setResult({
          success: false,
          message: `Error: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        setLoading(false);
      }
    };

    testConnection();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Supabase Connection Test</h1>

      {loading ? (
        <p>Testing connection...</p>
      ) : (
        <div>
          <div
            style={{
              padding: '1rem',
              marginTop: '1rem',
              borderRadius: '4px',
              backgroundColor: result?.success ? '#e8f5e9' : '#ffebee',
              borderLeft: `4px solid ${result?.success ? '#4caf50' : '#f44336'}`,
            }}
          >
            <p>
              <strong>Status:</strong> {result?.success ? '✓ SUCCESS' : '✗ FAILED'}
            </p>
            <p>
              <strong>Message:</strong> {result?.message}
            </p>

            {result?.success && result?.recordsFound !== undefined && (
              <p>
                <strong>Records found:</strong> {result.recordsFound}
              </p>
            )}
          </div>

          <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#999' }}>
            <p>ℹ️ This is a development test page only. Remove before production.</p>
            <p>📍 Location: app/test/page.tsx</p>
          </div>
        </div>
      )}
    </div>
  );
}
