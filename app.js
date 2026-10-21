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


function formatINR(value) {
  return '₹ ' + Math.round(value).toLocaleString('en-IN');
}

function renderPriceComparison(comparison, predictedPrice) {
  const section = $('#comparison-section');
  if (!comparison || !Number.isFinite(Number(comparison.overall_average))) {
    section.hidden = true;
    return;
  }

  const overall = Number(comparison.overall_average);
  const similar = comparison.similar_average == null
    ? null
    : Number(comparison.similar_average);
  const hasSimilar = similar !== null && Number.isFinite(similar) && similar > 0;
  const reference = hasSimilar ? similar : overall;
  const diff = Number(predictedPrice) - reference;
  const ratio = reference > 0 ? Math.abs(diff / reference * 100).toFixed(1) : '0.0';

  $('#comparisonMy').textContent = formatINR(predictedPrice);
  $('#comparisonReferenceLabel').textContent = hasSimilar
    ? '유사 조건 차량 평균'
    : '전체 중고차 평균';
  $('#comparisonReference').textContent = formatINR(reference);

  const prices = [Number(predictedPrice), overall];
  if (hasSimilar) prices.push(similar);
  const max = Math.max(1, ...prices);

  const drawBar = (id, value) => {
    $(id).style.width = (Math.max(0, value) / max * 100).toFixed(1) + '%';
  };
  drawBar('#comparisonMyBar', predictedPrice);
  drawBar('#comparisonOverallBar', overall);
  $('#comparisonMyChartPrice').textContent = formatINR(predictedPrice);
  $('#comparisonOverallChartPrice').textContent = formatINR(overall);
  $('#comparisonSimilarRow').hidden = !hasSimilar;

  if (hasSimilar) {
    drawBar('#comparisonSimilarBar', similar);
    $('#comparisonSimilarChartPrice').textContent = formatINR(similar);
  }

  const basis = hasSimilar ? '유사 조건 차량 평균' : '전체 중고차 평균';
  $('#comparisonDifference').textContent = Math.abs(diff) < 0.5
    ? basis + '과 예상 가격이 같습니다.'
    : basis + '보다 ' + formatINR(Math.abs(diff))
      + ' (' + ratio + '%) ' + (diff > 0 ? '높습니다.' : '낮습니다.');

  $('#comparisonBasis').textContent = hasSimilar
    ? '비교 대상 ' + comparison.similar_count.toLocaleString('ko-KR')
      + '대 · ' + comparison.criteria
      + '. 입력한 차량과 비슷한 조건의 실제 데이터 평균입니다.'
    : '비슷한 조건의 차량이 10대 미만이므로, 중복 제거한 전체 '
      + comparison.dataset_count.toLocaleString('ko-KR')
      + '대의 평균 가격만 비교합니다.';

  $('#comparisonChart').setAttribute(
    'aria-label',
    '내 차 예상 가격 ' + formatINR(predictedPrice)
      + ', ' + basis + ' ' + formatINR(reference)
      + ', 전체 평균 ' + formatINR(overall)
  );
  section.hidden = false;
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
    renderPriceComparison(data.comparison, data.predicted_price);
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
  $('#comparison-section').hidden = true;
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