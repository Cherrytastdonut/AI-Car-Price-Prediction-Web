# AI Car Price Prediction Web

중고차 정보를 입력하면 직접 학습한 머신러닝 회귀 모델이 예상 판매가격을 예측하는 AI 웹앱입니다.

## 현재 진행 상태

- 1주차 기획 및 데이터셋 확정: 완료
- 2주차 데이터 전처리 / 모델 학습 / 모델 평가: 완료
- 3주차 웹앱 기본 구현: 진행 중
- 실제 학습 모델을 Vercel Function 예측 API에 연결: 완료
- Supabase 예측 기록 저장/조회: 코드 구현 완료
- Gemini 결과 설명: 코드 구현 완료
- Vercel 배포 및 환경변수 연결: 남음

## 데이터셋

- Vehicle Dataset from CarDekho
- 사용 파일: `Car details v3.csv`
- 원본 데이터: 8,128행
- 완전 중복 행 제거: 1,202행
- 학습에 사용한 데이터: 6,926행
- Train/Test: 80% / 20%
- 타깃: `selling_price`
- 입력 변수: `year`, `km_driven`, `fuel`, `seller_type`, `transmission`, `owner`, `engine`, `max_power`

## 모델 비교 결과

| 모델 | MAE | RMSE | R² |
|---|---:|---:|---:|
| Linear Regression | 173,274.23 | 308,016.33 | 0.567420 |
| **Random Forest** | **77,781.65** | **127,226.71** | **0.926197** |
| Gradient Boosting | 89,546.07 | 141,392.92 | 0.908846 |

최종 모델은 테스트 데이터에서 R²가 가장 높고 MAE/RMSE가 가장 낮은 **Random Forest Regressor**로 선정했습니다.

## 데이터 전처리

- 완전 중복 행 제거
- `engine`, `max_power`의 단위를 제거하고 숫자형으로 변환
- 숫자형 결측값은 중앙값으로 처리
- 범주형 결측값은 최빈값으로 처리
- 범주형 데이터는 Ordinal Encoding
- `random_state=42`로 Train/Test 분리

## 기술 구성

- Frontend: HTML / CSS / JavaScript
- Backend: Vercel Functions
- ML: Random Forest Regressor
- Database: Supabase
- AI explanation: Google Gemini API
- Deploy: Vercel
- ML automation: GitHub Actions

## 주요 파일

- `modeling/train_model.py`: 데이터 전처리, 3개 모델 학습 및 성능 비교
- `model/metrics.json`: 실제 모델 평가 결과
- `model/model.json`: 웹 예측용 학습 모델
- `api/model.js`: Vercel Function에서 사용하는 학습 모델
- `api/predict.js`: 실제 학습 모델 기반 가격 예측 API
- `api/save.js`: Supabase 예측 기록 저장
- `api/history.js`: Supabase 기록 조회
- `supabase.sql`: Supabase 테이블 생성 SQL

> API 키와 Supabase service role key는 GitHub에 저장하지 않고 Vercel Environment Variables에만 등록합니다.
