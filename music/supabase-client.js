import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'your_supabase_url';
const SUPABASE_KEY = 'your_supabase_key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
