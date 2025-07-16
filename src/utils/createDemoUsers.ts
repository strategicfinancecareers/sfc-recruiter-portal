import { supabase } from '@/integrations/supabase/client';

export const createDemoUsers = async () => {
  try {
    const { data, error } = await supabase.functions.invoke('create-demo-users');
    
    if (error) {
      console.error('Error calling create-demo-users function:', error);
      return false;
    }
    
    console.log('Demo users creation result:', data);
    return data.success;
  } catch (error) {
    console.error('Error creating demo users:', error);
    return false;
  }
};