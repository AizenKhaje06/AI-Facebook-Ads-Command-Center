import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const META_APP_ID = Deno.env.get('META_APP_ID')!;
const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!;
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!;

function decrypt(encrypted: string): string {
  const key = ENCRYPTION_KEY;
  const text = atob(encrypted);
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

function encrypt(text: string): string {
  const key = ENCRYPTION_KEY;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get all active Meta connections that need token refresh
    // Token should be refreshed before it expires (e.g., 7 days before)
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { data: connections, error: fetchError } = await supabase
      .from('meta_connections')
      .select('*')
      .eq('status', 'active')
      .lt('token_expires_at', sevenDaysFromNow.toISOString());

    if (fetchError) {
      throw fetchError;
    }

    const results = [];

    for (const connection of connections || []) {
      try {
        // Decrypt current token
        const currentToken = decrypt(connection.encrypted_access_token);

        // Exchange for new long-lived token
        const response = await fetch(
          `https://graph.facebook.com/v19.0/oauth/access_token?` +
          `grant_type=fb_exchange_token&` +
          `client_id=${META_APP_ID}&` +
          `client_secret=${META_APP_SECRET}&` +
          `fb_exchange_token=${currentToken}`
        );

        const data = await response.json();

        if (data.error) {
          // Update connection status to error
          await supabase
            .from('meta_connections')
            .update({
              status: 'error',
              last_error_message: data.error.message,
              updated_at: new Date().toISOString()
            })
            .eq('id', connection.id);

          results.push({ id: connection.id, status: 'error', error: data.error.message });
          continue;
        }

        const newToken = data.access_token;
        const newExpiresIn = data.expires_in || 5184000;
        const newExpiresAt = new Date(Date.now() + (newExpiresIn * 1000));

        // Encrypt and store new token
        const encryptedToken = encrypt(newToken);

        await supabase
          .from('meta_connections')
          .update({
            encrypted_access_token: encryptedToken,
            token_expires_at: newExpiresAt.toISOString(),
            status: 'active',
            last_error_message: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', connection.id);

        results.push({ id: connection.id, status: 'refreshed', expires_at: newExpiresAt });

      } catch (error) {
        results.push({ id: connection.id, status: 'error', error: error.message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
