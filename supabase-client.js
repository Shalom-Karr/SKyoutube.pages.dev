// supabase-client.js
// This file connects your website to your Supabase backend.
// It uses your unique Project URL and your public 'anon' key.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Your unique project details from the Supabase dashboard
const SUPABASE_URL = 'https://qvoxpfigbukidlmshiei.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2b3hwZmlnYnVraWRsbXNoaWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyOTM2OTEsImV4cCI6MjA2NTg2OTY5MX0.CEbyeIw6QiMxbLBhU7x7Re7SL_unWJMyaJQPS9y-k60';

// Create and export the Supabase client so other files can use it
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);