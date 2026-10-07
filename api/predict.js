export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  const b=req.body||{};
  const required=['year','km_driven','engine','max_power'];
  for(const k of required){ if(b[k]===undefined || b[k]===null || b[k]==='') return res.status(400).json({error:`${k} 값이 필요합니다.`}); }

  // 임시 MVP 계산식입니다. 2주차에 실제 학습 모델 결과로 교체합니다.
  const age=Math.max(0,2026-Number(b.year));
  const km=Number(b.km_driven)||0;
  const engine=Number(b.engine)||0;
  const power=Number(b.max_power)||0;
  let price=1400000 - age*65000 - km*3.5 + engine*180 + power*2500;
  if(b.transmission==='Automatic') price+=100000;
  if(b.fuel==='Diesel') price+=70000;
  if(b.owner && b.owner!=='First Owner') price-=80000;
  price=Math.max(120000,Math.round(price));

  let explanation='연식, 주행거리, 엔진, 출력, 연료 및 변속기 정보를 바탕으로 예측했습니다.';
  if(process.env.GEMINI_API_KEY){
    try{
      const model=process.env.GEMINI_MODEL||'gemini-2.5-flash';
      const prompt=`중고차 가격 예측 웹앱의 짧은 설명을 한국어 한 문장으로 작성하세요. 차량 정보: ${JSON.stringify(b)}, 예측 가격: ${price} INR. 과장 금지.`;
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})
      });
      const j=await r.json();
      explanation=j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()||explanation;
    }catch{}
  }
  return res.status(200).json({predicted_price:price,display_price:`₹ ${price.toLocaleString('en-IN')}`,explanation});
}