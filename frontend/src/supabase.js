import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xdfsxwirrgwnulekyifw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkZnN4d2lycmd3bnVsZWt5aWZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMTE2NzcsImV4cCI6MjA5MTY4NzY3N30.g4BsB2PpiG6gDFz0FDj2_U7aShclbSHvUxMij7NkOD4';

export const supabase = createClient(supabaseUrl, supabaseKey);
