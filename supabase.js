import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://dyfldeqbiqrkgligyhbe.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_rPbRPVDC0StngZ9-PHKFQA_4xk3jGrF";

export const supabase = createClient(
SUPABASE_URL,
SUPABASE_ANON_KEY
);
