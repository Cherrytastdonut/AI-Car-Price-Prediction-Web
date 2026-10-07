# AI Car Price Prediction Web

중고차 정보를 입력하면 머신러닝 회귀 모델이 예상 판매가격을 예측하는 수행평가용 웹앱입니다.

## 목표
- 1주차: 기획 및 데이터셋 확정
- 2주차: 데이터 전처리, 모델 학습/평가
- 3주차: Vercel 웹앱 구현 + Supabase 예측 기록 + Gemini 설명 기능

## 데이터셋
- Vehicle Dataset from CarDekho
- 파일: `Car details v3.csv`
- 약 8,128개 중고차 레코드
- 주요 변수: year, km_driven, fuel, seller_type, transmission, owner, mileage, engine, max_power, seats
- 타깃: selling_price

## 기술
- Frontend: HTML / CSS / JavaScript
- Backend: Vercel Functions
- ML: 직접 학습한 회귀 모델
- Database: Supabase
- AI explanation: Google Gemini API
- Deploy: Vercel

> API 키와 Supabase service role key는 GitHub에 저장하지 않고 Vercel Environment Variables에만 등록합니다.
