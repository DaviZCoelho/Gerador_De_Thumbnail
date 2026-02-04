# Gerador de Thumbnail

Aplicação web para gerar thumbnails automaticamente com remoção de fundo usando inteligência artificial.

<img width="1920" height="949" alt="image" src="https://github.com/user-attachments/assets/f126af62-71bb-412f-ad6b-1fae5567c72e" />

## Sobre o Projeto

Este projeto permite fazer upload de imagens e gerar thumbnails com o fundo removido automaticamente.

## Tecnologias Utilizadas

### Frontend
- **React** - Biblioteca JavaScript para interfaces
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework CSS utilitário

### Backend
- **Python 3.11** - Linguagem de programação
- **rembg** - IA para remoção de fundo
- **Pillow** - Processamento de imagens
- **Docker** - Containerização

### Infraestrutura (AWS)
- **AWS Lambda** - Execução serverless
- **Amazon S3** - Armazenamento de imagens
- **Amazon ECR** - Registro de containers Docker
- **API Gateway** - API REST

### Deploy
- **Vercel** - Hospedagem do frontend
- **AWS** - Backend serverless

---

## Como Funciona

1. Usuário faz upload de uma imagem no frontend
2. Frontend solicita URL pré-assinada via API Gateway
3. Imagem é enviada diretamente para o S3 (bucket input)
4. S3 dispara evento que aciona a Lambda
5. Lambda processa a imagem com rembg (remove fundo)
6. Thumbnail é salva no S3 (bucket output)
7. Frontend exibe a thumbnail processada

---

## Como Executar Localmente

### Pré-requisitos

- Node.js 18+
- Python 3.11+
- Docker Desktop
- AWS CLI configurado
- Conta AWS

### 1. Clonar o Repositório

```bash
git clone https://github.com/DaviZCoelho/Gerador_De_Thumbnail.git
cd Gerador_De_Thumbnail
```

### 2. Configurar AWS CLI

```bash
aws configure
```

Insira suas credenciais:
- AWS Access Key ID
- AWS Secret Access Key
- Region: `us-east-1`
- Output format: `json`

### 3. Criar Buckets S3

```bash
aws s3 mb s3://SEU-BUCKET-INPUT --region us-east-1
aws s3 mb s3://SEU-BUCKET-OUTPUT --region us-east-1
```

Configurar CORS no bucket de input:
```bash
aws s3api put-bucket-cors --bucket SEU-BUCKET-INPUT --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }]
}'
```

### 4. Configurar Backend

#### 4.1 Criar repositório ECR

```bash
aws ecr create-repository --repository-name thumbnail-generator --region us-east-1
```

#### 4.2 Build e Push da imagem Docker

```bash
cd backend

# Login no ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin SEU_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build
docker build -t thumbnail-generator .

# Tag
docker tag thumbnail-generator:latest SEU_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/thumbnail-generator:latest

# Push
docker push SEU_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/thumbnail-generator:latest
```

#### 4.3 Criar Lambda Function

```bash
aws lambda create-function \
  --function-name thumbnail-generator \
  --package-type Image \
  --code ImageUri=SEU_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/thumbnail-generator:latest \
  --role arn:aws:iam::SEU_ACCOUNT_ID:role/lambda-thumbnail-role \
  --timeout 60 \
  --memory-size 2048 \
  --region us-east-1
```

#### 4.4 Configurar Trigger S3

```bash
aws lambda add-permission \
  --function-name thumbnail-generator \
  --statement-id s3-trigger \
  --action lambda:InvokeFunction \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::SEU-BUCKET-INPUT
```

### 5. Configurar API Gateway

#### 5.1 Deploy da função de presigned URL

```bash
cd backend
zip presigned.zip presigned_url_handler.py

aws lambda create-function \
  --function-name thumbnail-presigned-url \
  --runtime python3.11 \
  --handler presigned_url_handler.lambda_handler \
  --zip-file fileb://presigned.zip \
  --role arn:aws:iam::SEU_ACCOUNT_ID:role/lambda-thumbnail-role \
  --timeout 30 \
  --region us-east-1
```

#### 5.2 Criar API Gateway

Acesse o console AWS > API Gateway > Create API > REST API

Crie os endpoints:
- `POST /upload-url`
- `POST /download-url`
- `GET /status/{key}`

Conecte cada endpoint à Lambda `thumbnail-presigned-url`.

### 6. Configurar Frontend

```bash
cd frontend
npm install
```

Edite `src/components/ImageUploader.jsx` e substitua a URL da API:

```javascript
const API_URL = 'https://SUA-API-GATEWAY.execute-api.us-east-1.amazonaws.com/prod';
```

### 7. Executar Frontend

```bash
npm run dev
```

Acesse: http://localhost:3000

---
