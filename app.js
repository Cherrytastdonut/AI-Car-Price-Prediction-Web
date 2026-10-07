let lastPrediction = null;

const $ = (selector) => document.querySelector(selector);

function payload() {
  return {
    year: +$('#year').value,
    km_driven: +$('#km_driven').value,
    fuel: $('#fuel').value,
    transmission: $('#transmission').value,
    engine: +$('#engine').value,
    max_power: +$('#max_power').value,
    seller_type: $('#seller_type').value,
    owner: $('#owner').value,
  };
}

function setLoading(loading) {
  $('#predictBtn').disabled = loading;
  $('#predictBtnText').textContent = loading ? 'AI가 예측하는 중...' : '가격 예측하기';
}

async function predict() {
  const status = $('#status');
  status.textContent = '';
  setLoading(true);

  try {
    const response = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload()),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '예측에 실패했습니다.');

    lastPrediction = {
      ...payload(),
      predicted_price: data.predicted_price,
    };

    $('#price').textContent = data.display_price;
    $('#explanation').textContent =
      data.explanation || '머신러닝 모델 기반 예측 결과입니다.';
    $('#resultMeta').textContent =
      `${data.model || 'ML 모델'} · R² ${data.metrics?.R2 ?? '-'}`;
    $('#saveBtn').disabled = false;

    document.querySelector('.result-card').scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  } catch (error) {
    status.textContent = error.message;
  } finally {
    setLoading(false);
  }
}

async function save() {
  if (!lastPrediction) return;

  const button = $('#saveBtn');
  button.disabled = true;
  const original = button.textContent;
  button.textContent = '저장 중...';

  try {
    const response = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lastPrediction),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '저장에 실패했습니다.');

    button.textContent = '저장 완료 ✓';
    await loadHistory();
    setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
    }, 1300);
  } catch (error) {
    alert(error.message);
    button.textContent = original;
    button.disabled = false;
  }
}

async function loadHistory() {
  const box = $('#history');

  try {
    const response = await fetch('/api/history');
    const data = await response.json();
    if (!response.ok) throw new Error();

    const rows = data.items || [];

    box.innerHTML = rows.length
      ? rows
          .map(
            (item) => `
              <div class="item">
                <span>${item.year}년 · ${Number(item.km_driven).toLocaleString()}km</span>
                <b>₹ ${Number(item.predicted_price).toLocaleString('en-IN')}</b>
              </div>
            `
          )
          .join('')
      : '저장된 기록이 없습니다.';
  } catch {
    box.textContent = '예측 기록을 불러오지 못했습니다.';
  }
}

function resetForm() {
  $('#year').value = 2020;
  $('#km_driven').value = 50000;
  $('#fuel').value = 'Petrol';
  $('#transmission').value = 'Manual';
  $('#engine').value = 1498;
  $('#max_power').value = 110;
  $('#seller_type').value = 'Individual';
  $('#owner').value = 'First Owner';
  $('#price').textContent = '-';
  $('#explanation').textContent =
    '가격 예측 후 차량 조건에 대한 설명을 확인할 수 있습니다.';
  $('#resultMeta').textContent = '차량 정보를 입력해 주세요.';
  $('#saveBtn').disabled = true;
  $('#status').textContent = '';
  lastPrediction = null;
  $('#predict').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('#predictBtn').addEventListener('click', predict);
$('#saveBtn').addEventListener('click', save);
$('#resetBtn').addEventListener('click', resetForm);

loadHistory();