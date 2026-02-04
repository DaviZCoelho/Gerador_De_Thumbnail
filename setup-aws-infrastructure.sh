#!/bin/bash

###############################################################################
# Script: setup-aws-infrastructure.sh
# Descrição: Configura a infraestrutura AWS para o projeto de processamento
#            de imagens serverless (geração de thumbnails)
# Autor: DevOps Engineer
# Data: 2026-02-03
###############################################################################

# =============================================================================
# CONFIGURAÇÕES
# =============================================================================

# Defina seu nome aqui (será usado como sufixo único nos buckets S3)
# IMPORTANTE: Altere "SEU_NOME" para seu nome real (sem espaços, minúsculas)
NAME_SUFFIX="davicoelho"

# Região AWS onde os recursos serão criados
AWS_REGION="us-east-1"

# Nomes dos recursos
BUCKET_INPUT="thumbnail-app-input-${NAME_SUFFIX}"
BUCKET_OUTPUT="thumbnail-app-output-${NAME_SUFFIX}"
ECR_REPO_NAME="thumbnail-generator"

# =============================================================================
# FUNÇÕES AUXILIARES
# =============================================================================

# Função para imprimir mensagens formatadas
print_header() {
    echo ""
    echo "=============================================="
    echo "$1"
    echo "=============================================="
}

# Função para verificar se o comando anterior foi bem sucedido
check_status() {
    if [ $? -eq 0 ]; then
        echo "✅ $1 - Sucesso!"
    else
        echo "❌ $1 - Falhou!"
        exit 1
    fi
}

# =============================================================================
# VERIFICAÇÕES PRÉ-EXECUÇÃO
# =============================================================================

print_header "Verificando pré-requisitos"

# Verifica se o AWS CLI está instalado
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI não está instalado. Por favor, instale antes de continuar."
    echo "   Instruções: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi
echo "✅ AWS CLI encontrado"

# Verifica se as credenciais AWS estão configuradas
aws sts get-caller-identity &> /dev/null
if [ $? -ne 0 ]; then
    echo "❌ Credenciais AWS não configuradas ou inválidas."
    echo "   Execute 'aws configure' para configurar suas credenciais."
    exit 1
fi
echo "✅ Credenciais AWS válidas"

# Exibe a identidade atual (para confirmação)
echo ""
echo "📌 Executando como:"
aws sts get-caller-identity --output table

# =============================================================================
# CRIAÇÃO DOS BUCKETS S3
# =============================================================================

print_header "Criando Buckets S3"

# Cria o bucket de INPUT
# Nota: Na região us-east-1, não é necessário especificar --create-bucket-configuration
echo "🔄 Criando bucket de input: ${BUCKET_INPUT}..."
aws s3api create-bucket \
    --bucket "${BUCKET_INPUT}" \
    --region "${AWS_REGION}"
check_status "Bucket S3 de input criado"

# Cria o bucket de OUTPUT
echo "🔄 Criando bucket de output: ${BUCKET_OUTPUT}..."
aws s3api create-bucket \
    --bucket "${BUCKET_OUTPUT}" \
    --region "${AWS_REGION}"
check_status "Bucket S3 de output criado"

# Habilita versionamento nos buckets (boa prática para dados importantes)
echo "🔄 Habilitando versionamento no bucket de input..."
aws s3api put-bucket-versioning \
    --bucket "${BUCKET_INPUT}" \
    --versioning-configuration Status=Enabled \
    --region "${AWS_REGION}"
check_status "Versionamento habilitado no bucket de input"

echo "🔄 Habilitando versionamento no bucket de output..."
aws s3api put-bucket-versioning \
    --bucket "${BUCKET_OUTPUT}" \
    --versioning-configuration Status=Enabled \
    --region "${AWS_REGION}"
check_status "Versionamento habilitado no bucket de output"

# Bloqueia acesso público nos buckets (segurança)
echo "🔄 Bloqueando acesso público nos buckets..."
for bucket in "${BUCKET_INPUT}" "${BUCKET_OUTPUT}"; do
    aws s3api put-public-access-block \
        --bucket "${bucket}" \
        --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
        --region "${AWS_REGION}"
done
check_status "Acesso público bloqueado em ambos os buckets"

# =============================================================================
# CRIAÇÃO DO REPOSITÓRIO ECR
# =============================================================================

print_header "Criando Repositório ECR"

# Cria o repositório ECR para armazenar as imagens Docker
echo "🔄 Criando repositório ECR: ${ECR_REPO_NAME}..."
ECR_RESULT=$(aws ecr create-repository \
    --repository-name "${ECR_REPO_NAME}" \
    --region "${AWS_REGION}" \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256 \
    --output json 2>&1)

# Verifica se o repositório já existe ou foi criado com sucesso
if echo "${ECR_RESULT}" | grep -q "RepositoryAlreadyExistsException"; then
    echo "ℹ️  Repositório ECR já existe, obtendo informações..."
    ECR_URI=$(aws ecr describe-repositories \
        --repository-names "${ECR_REPO_NAME}" \
        --region "${AWS_REGION}" \
        --query 'repositories[0].repositoryUri' \
        --output text)
else
    check_status "Repositório ECR criado"
    ECR_URI=$(echo "${ECR_RESULT}" | grep -o '"repositoryUri": "[^"]*"' | cut -d'"' -f4)
fi

# Configura política de ciclo de vida do ECR (mantém apenas as últimas 10 imagens)
echo "🔄 Configurando política de ciclo de vida do ECR..."
aws ecr put-lifecycle-policy \
    --repository-name "${ECR_REPO_NAME}" \
    --region "${AWS_REGION}" \
    --lifecycle-policy-text '{
        "rules": [
            {
                "rulePriority": 1,
                "description": "Manter apenas as últimas 10 imagens",
                "selection": {
                    "tagStatus": "any",
                    "countType": "imageCountMoreThan",
                    "countNumber": 10
                },
                "action": {
                    "type": "expire"
                }
            }
        ]
    }' > /dev/null
check_status "Política de ciclo de vida configurada"

# =============================================================================
# RESUMO DOS RECURSOS CRIADOS
# =============================================================================

print_header "🎉 INFRAESTRUTURA CRIADA COM SUCESSO!"

echo ""
echo "📦 RECURSOS CRIADOS:"
echo "────────────────────────────────────────────────"
echo ""
echo "🪣 BUCKETS S3:"
echo "   • Input:  ${BUCKET_INPUT}"
echo "   • Output: ${BUCKET_OUTPUT}"
echo ""
echo "🐳 REPOSITÓRIO ECR:"
echo "   • Nome: ${ECR_REPO_NAME}"
echo "   • URI:  ${ECR_URI}"
echo ""
echo "🌎 REGIÃO: ${AWS_REGION}"
echo ""
echo "────────────────────────────────────────────────"
echo ""
echo "📝 PRÓXIMOS PASSOS:"
echo "   1. Faça build da sua imagem Docker"
echo "   2. Autentique no ECR:"
echo "      aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI%/*}"
echo "   3. Faça push da imagem:"
echo "      docker tag thumbnail-generator:latest ${ECR_URI}:latest"
echo "      docker push ${ECR_URI}:latest"
echo ""
echo "✅ Script finalizado com sucesso!"
