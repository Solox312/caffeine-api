"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let client = null;
function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey)
        return null;
    if (!client) {
        client = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
    }
    return client;
}
exports.getSupabase = getSupabase;
