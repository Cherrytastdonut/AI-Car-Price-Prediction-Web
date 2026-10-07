import modelBundle from './model.js';

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function preprocess(input) {
  const meta = modelBundle.preprocess;
  const values = [];

  for (const feature of meta.numeric_features) {
    values.push(toNumber(input[feature], meta.numeric_medians[feature]));
  }

  for (const feature of meta.categorical_features) {
    const fallback = meta.categorical_defaults[feature];
    const value = input[feature] ?? fallback;
    const categories = meta.categorical_categories[feature];
    const index = categories.indexOf(String(value));
    values.push(index === -1 ? -1 : index);
  }

  return values;
}

function predictTree(tree, features) {
  let node = 0;

  while (tree.children_left[node] !== -1 && tree.children_right[node] !== -1) {
    const featureIndex = tree.feature[node];
    const threshold = tree.threshold[node];

    node =
      features[featureIndex] <= threshold
        ? tree.children_left[node]
        : tree.children_right[node];
  }

  return tree.value[node];
}

function runModel(features) {
  const model = modelBundle.model;

  if (model.type === 'linear') {
    return model.intercept + model.coef.reduce(
      (sum, coefficient, index) => sum + coefficient * features[index],
      0
    );
  }

  if (model.type === 'random_forest') {
    const total = model.trees.reduce(
      (sum, tree) => sum + predictTree(tree, features),
      0
    );
    return total / model.trees.length;
  }

  if (model.type === 'gradient_boosting') {
    const trees = model.trees.reduce(
      (sum, tree) => sum + predictTree(tree, features),
      0
    );
    return model.init + model.learning_rate * trees;
  }

  throw new Error('지원하지 않는 모델 형식입니다.');
}

async function getGeminiExplanation(input, predictedPrice) {
  const fallback =
    '실제 중고차 데이터에서 연식, 주행거리, 엔진, 출력, 연료 종류, 변속기, 판매자 유형, 소유 이력을 분석한 머신러닝 예측 결과입니다.';

  if (!process.env.GEMINI_API_KEY) return fallback;

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const prompt = [
      '중고차 가격 예측 웹앱의 결과를 한국어 1~2문장으로 아주 간단히 설명하세요.',
      '가격은 머신러닝 모델이 예측했으며, Gemini는 설명만 담당합니다.',
      '근거 없이 정확하다고 단정하지 마세요.',
      `차량 정보: ${JSON.stringify(input)}`,
      `예측 가격: ₹ ${Math.round(predictedPrice).toLocaleString('en-IN')}`,
    ].join('\n');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) return fallback;

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const input = req.body || {};
  const required = [
    'year',
    'km_driven',
    'fuel',
    'seller_type',
    'transmission',
    'owner',
    'engine',
    'max_power',
  ];

  for (const key of required) {
    if (input[key] === undefined || input[key] === null || input[key] === '') {
      return res.status(400).json({ error: `${key} 값이 필요합니다.` });
    }
  }

  try {
    const features = preprocess(input);
    const rawPrediction = runModel(features);
    const predictedPrice = Math.max(0, Math.round(rawPrediction));
    const explanation = await getGeminiExplanation(input, predictedPrice);

    return res.status(200).json({
      predicted_price: predictedPrice,
      display_price: `₹ ${predictedPrice.toLocaleString('en-IN')}`,
      currency: modelBundle.currency,
      model: modelBundle.model_name,
      metrics: modelBundle.metrics,
      explanation,
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || '예측 중 오류가 발생했습니다.',
    });
  }
}
