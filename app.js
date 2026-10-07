let lastPrediction = null;

function payload(){
  return {
    year:+document.querySelector('#year').value,
    km_driven:+document.querySelector('#km_driven').value,
    fuel:document.querySelector('#fuel').value,
    transmission:document.querySelector('#transmission').value,
    engine:+document.querySelector('#engine').value,
    max_power:+document.querySelector('#max_power').value,
    seller_type:document.querySelector('#seller_type').value,
    owner:document.querySelector('#owner').value
  };
}

async function predict(){
  const status = document.querySelector('#status');
  status.textContent = '예측 중...';
  try{
    const res = await fetch('/api/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload())});
    const data = await res.json();
    if(!res.ok) throw new Error(data.error||'예측 실패');
    lastPrediction = {...payload(), predicted_price:data.predicted_price};
    document.querySelector('#price').textContent = data.display_price;
    document.querySelector('#explanation').textContent = data.explanation || '모델 기반 예측 결과입니다.';
    document.querySelector('#saveBtn').disabled = false;
    status.textContent = '';
  }catch(e){ status.textContent = e.message; }
}

async function save(){
  if(!lastPrediction) return;
  const res = await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(lastPrediction)});
  const data = await res.json();
  if(!res.ok) return alert(data.error||'저장 실패');
  await loadHistory();
}

async function loadHistory(){
  const box = document.querySelector('#history');
  try{
    const res = await fetch('/api/history');
    const data = await res.json();
    const rows = data.items || [];
    box.innerHTML = rows.length ? rows.map(x=>`<div class="item"><b>${Number(x.predicted_price).toLocaleString()}</b> / ${x.year}년 / ${Number(x.km_driven).toLocaleString()}km</div>`).join('') : '저장된 기록이 없습니다.';
  }catch{ box.textContent='기록을 불러오지 못했습니다.'; }
}

document.querySelector('#predictBtn').addEventListener('click',predict);
document.querySelector('#saveBtn').addEventListener('click',save);
loadHistory();