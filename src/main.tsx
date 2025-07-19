import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// START: REMOVE THIS BEFORE DEPLOYING
import { supabase } from '@/integrations/supabase/client';

if (import.meta.env.DEV) {
  console.log('You are in development mode');
}
(window as any).supabase = supabase;
console.log('✅ Supabase attached to window.supabase');
// END: REMOVE THIS BEFORE DEPLOYING

createRoot(document.getElementById("root")!).render(<App />);
