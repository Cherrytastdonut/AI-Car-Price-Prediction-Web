import { createClient } from '@supabase/supabase-js';

export default async function handler(req,res){
  if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(200).json({items:[]});
  const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
  const {data,error}=await supabase.from('predictions').select('*').order('created_at',{ascending:false}).limit(10);
  if(error) return res.status(500).json({error:error.message});
  return res.status(200).json({items:data||[]});
}