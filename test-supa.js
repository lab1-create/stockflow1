require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://inmyfrdeiqbzcavijnkg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubXlmcmRlaXFiemNhdmlqbmtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MzYxNzUsImV4cCI6MjA5OTAxMjE3NX0.vpJ2tUNO843mnfUh_N5aP_fFymX89s-9guczjzaBXbo';
const db = createClient(supabaseUrl, supabaseKey);

async function test() {
  const name = 'Luiz';
  console.log("Testing exact:", name);
  const res1 = await db.from('app_users').select('*').eq('name', name);
  console.log("eq:", res1.data);
  
  const res2 = await db.from('app_users').select('*').ilike('name', name);
  console.log("ilike:", res2.data);
  
  const res3 = await db.from('app_users').select('*').ilike('name', `%${name}%`);
  console.log("ilike %:", res3.data);
}
test();
