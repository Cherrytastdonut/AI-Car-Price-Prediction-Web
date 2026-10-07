import { createClient } from '@supabase/supabase-js';

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({error:'Supabase 환경변수가 아직 설정되지 않았습니다.'});
  const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
  const {error}=await supabase.from('predictions').insert([req.body]);
  if(error) return res.status(500).json({error:error.message});
  return res.status(200).json({ok:true});
}