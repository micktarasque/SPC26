// Copy this file to environment.ts and fill in your Supabase credentials.
// environment.ts is gitignored — never commit real credentials.
//
// Get these from: Supabase dashboard → Settings → API
// The anon key is safe to use client-side — security is enforced by RLS policies.

export const environment = {
  production: false,
  supabaseUrl: 'https://YOUR_PROJECT_ID.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  // Shared PIN that gates score/wheel editing (client-side convenience gate, not real auth).
  editPin: 'CHANGE_ME'
};
