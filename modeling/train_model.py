import json
import math
import re
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder

ROOT = Path(__file__).resolve().parents[1]
ZIP_PATH = ROOT / "archive.zip"
DATA_DIR = ROOT / "data"
MODEL_DIR = ROOT / "model"
CSV_NAME = "Car details v3.csv"

DATA_DIR.mkdir(exist_ok=True)
MODEL_DIR.mkdir(exist_ok=True)

# 1) GitHub에 업로드한 Kaggle archive.zip에서 사용할 CSV를 추출합니다.
with zipfile.ZipFile(ZIP_PATH, "r") as zf:
    if CSV_NAME not in zf.namelist():
        raise FileNotFoundError(f"{CSV_NAME} not found. files={zf.namelist()}")
    zf.extract(CSV_NAME, DATA_DIR)

csv_path = DATA_DIR / CSV_NAME
df_raw = pd.read_csv(csv_path)

# 2) 데이터 탐색용 기본 정보
used_features = [
    "year",
    "km_driven",
    "fuel",
    "seller_type",
    "transmission",
    "owner",
    "engine",
    "max_power",
]
target = "selling_price"

missing_before = {
    col: int(df_raw[col].isna().sum())
    for col in used_features + [target]
}

duplicate_count = int(df_raw.duplicated().sum())

# 동일 행이 학습/테스트에 동시에 들어가 성능이 과대평가되는 것을 방지합니다.
df = df_raw.drop_duplicates().copy()

# 숫자 + 단위 형식("1248 CC", "74 bhp")에서 숫자만 추출합니다.
def numeric_from_text(series):
    return pd.to_numeric(
        series.astype(str).str.extract(r"([0-9]+(?:\.[0-9]+)?)", expand=False),
        errors="coerce",
    )

df["engine"] = numeric_from_text(df["engine"])
df["max_power"] = numeric_from_text(df["max_power"])

# 타깃이 없는 행은 학습할 수 없으므로 제거합니다.
df = df.dropna(subset=[target])

X = df[used_features]
y = df[target].astype(float)

numeric_features = ["year", "km_driven", "engine", "max_power"]
categorical_features = ["fuel", "seller_type", "transmission", "owner"]

numeric_pipe = Pipeline(
    steps=[
        ("imputer", SimpleImputer(strategy="median")),
    ]
)

categorical_pipe = Pipeline(
    steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        (
            "encoder",
            OrdinalEncoder(
                handle_unknown="use_encoded_value",
                unknown_value=-1,
            ),
        ),
    ]
)

preprocessor = ColumnTransformer(
    transformers=[
        ("num", numeric_pipe, numeric_features),
        ("cat", categorical_pipe, categorical_features),
    ],
    remainder="drop",
)

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
)

models = {
    "Linear Regression": LinearRegression(),
    "Random Forest": RandomForestRegressor(
        n_estimators=120,
        max_depth=18,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    ),
    "Gradient Boosting": GradientBoostingRegressor(
        n_estimators=180,
        learning_rate=0.05,
        max_depth=3,
        random_state=42,
    ),
}

results = {}
fitted = {}

for name, estimator in models.items():
    pipe = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", estimator),
        ]
    )
    pipe.fit(X_train, y_train)
    pred = pipe.predict(X_test)

    mae = mean_absolute_error(y_test, pred)
    rmse = math.sqrt(mean_squared_error(y_test, pred))
    r2 = r2_score(y_test, pred)

    results[name] = {
        "MAE": round(float(mae), 2),
        "RMSE": round(float(rmse), 2),
        "R2": round(float(r2), 6),
    }
    fitted[name] = pipe

selected_name = max(results, key=lambda k: results[k]["R2"])
selected_pipe = fitted[selected_name]
selected_model = selected_pipe.named_steps["model"]
selected_pre = selected_pipe.named_steps["preprocessor"]

# 3) 웹의 Node.js Vercel Function에서도 같은 전처리를 할 수 있도록 메타데이터를 저장합니다.
num_imputer = selected_pre.named_transformers_["num"].named_steps["imputer"]
cat_imputer = selected_pre.named_transformers_["cat"].named_steps["imputer"]
cat_encoder = selected_pre.named_transformers_["cat"].named_steps["encoder"]

preprocess_meta = {
    "numeric_features": numeric_features,
    "numeric_medians": {
        col: float(val)
        for col, val in zip(numeric_features, num_imputer.statistics_)
    },
    "categorical_features": categorical_features,
    "categorical_defaults": {
        col: str(val)
        for col, val in zip(categorical_features, cat_imputer.statistics_)
    },
    "categorical_categories": {
        col: [str(x) for x in cats.tolist()]
        for col, cats in zip(categorical_features, cat_encoder.categories_)
    },
}

def export_tree(tree):
    t = tree.tree_
    return {
        "children_left": t.children_left.astype(int).tolist(),
        "children_right": t.children_right.astype(int).tolist(),
        "feature": t.feature.astype(int).tolist(),
        "threshold": [round(float(x), 10) for x in t.threshold.tolist()],
        "value": [float(v[0][0]) for v in t.value],
    }

if selected_name == "Linear Regression":
    model_meta = {
        "type": "linear",
        "intercept": float(selected_model.intercept_),
        "coef": [float(x) for x in selected_model.coef_.tolist()],
    }
elif selected_name == "Random Forest":
    model_meta = {
        "type": "random_forest",
        "trees": [export_tree(t) for t in selected_model.estimators_],
    }
elif selected_name == "Gradient Boosting":
    init_constant = float(np.ravel(selected_model.init_.constant_)[0])
    model_meta = {
        "type": "gradient_boosting",
        "init": init_constant,
        "learning_rate": float(selected_model.learning_rate),
        "trees": [export_tree(t) for t in selected_model.estimators_.ravel()],
    }
else:
    raise RuntimeError(f"Unsupported selected model: {selected_name}")

report = {
    "dataset": {
        "source_file": CSV_NAME,
        "original_rows": int(len(df_raw)),
        "rows_after_duplicate_removal": int(len(df)),
        "duplicates_removed": duplicate_count,
        "columns": df_raw.columns.tolist(),
        "missing_before_preprocessing": missing_before,
        "target": target,
        "features": used_features,
        "selling_price": {
            "min": float(y.min()),
            "median": float(y.median()),
            "mean": round(float(y.mean()), 2),
            "max": float(y.max()),
        },
    },
    "split": {
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "test_size": 0.20,
        "random_state": 42,
    },
    "metrics": results,
    "selected_model": selected_name,
    "selection_rule": "테스트 데이터 R²가 가장 높은 모델",
}

web_model = {
    "version": 1,
    "currency": "INR",
    "features": used_features,
    "preprocess": preprocess_meta,
    "model_name": selected_name,
    "model": model_meta,
    "metrics": results[selected_name],
}

(MODEL_DIR / "metrics.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
(MODEL_DIR / "model.json").write_text(
    json.dumps(web_model, ensure_ascii=False, separators=(",", ":")),
    encoding="utf-8",
)

# Node/Vercel에서 직접 import 가능한 JS 모듈도 함께 만듭니다.
(ROOT / "api" / "model.js").write_text(
    "export default " + json.dumps(web_model, ensure_ascii=False, separators=(",", ":")) + ";\n",
    encoding="utf-8",
)

print(json.dumps(report, ensure_ascii=False, indent=2))
