# Google Colab에서 실행할 2주차 모델링 스크립트 초안
# 데이터셋: Car details v3.csv

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor

df = pd.read_csv('Car details v3.csv')

for col in ['mileage','engine','max_power']:
    df[col] = pd.to_numeric(df[col].astype(str).str.extract(r'([0-9.]+)')[0], errors='coerce')

features = ['year','km_driven','fuel','seller_type','transmission','owner','mileage','engine','max_power']
target = 'selling_price'

X = df[features]
y = df[target]

num = ['year','km_driven','mileage','engine','max_power']
cat = ['fuel','seller_type','transmission','owner']

pre = ColumnTransformer([
    ('num', SimpleImputer(strategy='median'), num),
    ('cat', Pipeline([
        ('imp', SimpleImputer(strategy='most_frequent')),
        ('ohe', OneHotEncoder(handle_unknown='ignore'))
    ]), cat)
])

X_train, X_test, y_train, y_test = train_test_split(X,y,test_size=0.2,random_state=42)

models = {
    'LinearRegression': LinearRegression(),
    'RandomForest': RandomForestRegressor(n_estimators=200, random_state=42),
    'GradientBoosting': GradientBoostingRegressor(random_state=42)
}

for name, model in models.items():
    pipe = Pipeline([('pre', pre), ('model', model)])
    pipe.fit(X_train, y_train)
    pred = pipe.predict(X_test)
    print(name)
    print('MAE:', mean_absolute_error(y_test,pred))
    print('RMSE:', mean_squared_error(y_test,pred) ** 0.5)
    print('R2:', r2_score(y_test,pred))
    print('-'*30)
