require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://inmyfrdeiqbzcavijnkg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubXlmcmRlaXFiemNhdmlqbmtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MzYxNzUsImV4cCI6MjA5OTAxMjE3NX0.vpJ2tUNO843mnfUh_N5aP_fFymX89s-9guczjzaBXbo';
const db = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await db.from('stock_movements').select('*, supplies(code, name), app_users(name, sector), destinations(name)').order('created_at', { ascending: false }).limit(2);
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}

main();
