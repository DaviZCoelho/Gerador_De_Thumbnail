# ==============================================================================
# Script de Deploy - Thumbnail Generator Lambda
# ==============================================================================
# Execute cada seção separadamente ou rode o script completo
# ==============================================================================

# ------------------------------------------------------------------------------
# VARIÁVEIS DE CONFIGURAÇÃO
# ------------------------------------------------------------------------------
$AWS_REGION = "us-east-1"
$AWS_ACCOUNT_ID = "550869127860"
$ECR_REPO = "thumbnail-generator"
$ECR_URI = "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO"
$LAMBDA_NAME = "thumbnail-generator"
$INPUT_BUCKET = "thumbnail-app-input-davicoelho"
$OUTPUT_BUCKET = "thumbnail-app-output-davicoelho"
$LAMBDA_ROLE_NAME = "lambda-thumbnail-role"

# Caminho do AWS CLI
$AWS = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"

Write-Host "=============================================="
Write-Host "DEPLOY - Thumbnail Generator Lambda"
Write-Host "=============================================="

# ------------------------------------------------------------------------------
# 1. LOGIN NO ECR
# ------------------------------------------------------------------------------
Write-Host "`n[1/7] Fazendo login no ECR..."
& $AWS ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

# ------------------------------------------------------------------------------
# 2. BUILD DA IMAGEM DOCKER
# ------------------------------------------------------------------------------
Write-Host "`n[2/7] Fazendo build da imagem Docker..."
Set-Location "c:\Users\davia\Downloads\Projeto Ops Thumb\backend"
docker build -t ${ECR_REPO}:latest .

# ------------------------------------------------------------------------------
# 3. TAG E PUSH PARA O ECR
# ------------------------------------------------------------------------------
Write-Host "`n[3/7] Fazendo tag e push para o ECR..."
docker tag ${ECR_REPO}:latest ${ECR_URI}:latest
docker push ${ECR_URI}:latest

# ------------------------------------------------------------------------------
# 4. CRIAR ROLE IAM PARA A LAMBDA
# ------------------------------------------------------------------------------
Write-Host "`n[4/7] Criando Role IAM para a Lambda..."

# Trust policy - permite que Lambda assuma a role
$TrustPolicy = @'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "lambda.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
'@

# Criar a role (ignora erro se já existir)
$TrustPolicy | Out-File -FilePath "trust-policy.json" -Encoding UTF8
& $AWS iam create-role `
    --role-name $LAMBDA_ROLE_NAME `
    --assume-role-policy-document file://trust-policy.json `
    --region $AWS_REGION 2>$null

# Anexar políticas necessárias
Write-Host "   Anexando políticas de permissão..."

# Política básica de execução Lambda (CloudWatch Logs)
& $AWS iam attach-role-policy `
    --role-name $LAMBDA_ROLE_NAME `
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" `
    --region $AWS_REGION

# Política de acesso ao S3
$S3Policy = @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::$INPUT_BUCKET/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject"
            ],
            "Resource": "arn:aws:s3:::$OUTPUT_BUCKET/*"
        }
    ]
}
"@

$S3Policy | Out-File -FilePath "s3-policy.json" -Encoding UTF8
& $AWS iam put-role-policy `
    --role-name $LAMBDA_ROLE_NAME `
    --policy-name "S3AccessPolicy" `
    --policy-document file://s3-policy.json `
    --region $AWS_REGION

# Aguardar propagação da role (IAM é eventually consistent)
Write-Host "   Aguardando propagação da role (15 segundos)..."
Start-Sleep -Seconds 15

# ------------------------------------------------------------------------------
# 5. CRIAR A FUNÇÃO LAMBDA
# ------------------------------------------------------------------------------
Write-Host "`n[5/7] Criando função Lambda..."

$ROLE_ARN = "arn:aws:iam::${AWS_ACCOUNT_ID}:role/$LAMBDA_ROLE_NAME"

# Tentar criar a função (se já existir, atualizar)
$CreateResult = & $AWS lambda create-function `
    --function-name $LAMBDA_NAME `
    --package-type Image `
    --code ImageUri=${ECR_URI}:latest `
    --role $ROLE_ARN `
    --memory-size 2048 `
    --timeout 60 `
    --environment "Variables={OUTPUT_BUCKET=$OUTPUT_BUCKET,U2NET_HOME=/tmp/.u2net}" `
    --region $AWS_REGION 2>&1

if ($CreateResult -match "ResourceConflictException") {
    Write-Host "   Função já existe, atualizando..."
    & $AWS lambda update-function-code `
        --function-name $LAMBDA_NAME `
        --image-uri ${ECR_URI}:latest `
        --region $AWS_REGION
    
    # Aguardar atualização
    Start-Sleep -Seconds 5
    
    & $AWS lambda update-function-configuration `
        --function-name $LAMBDA_NAME `
        --memory-size 2048 `
        --timeout 60 `
        --environment "Variables={OUTPUT_BUCKET=$OUTPUT_BUCKET,U2NET_HOME=/tmp/.u2net}" `
        --region $AWS_REGION
} else {
    Write-Host $CreateResult
}

# Aguardar função ficar ativa
Write-Host "   Aguardando função ficar ativa..."
& $AWS lambda wait function-active --function-name $LAMBDA_NAME --region $AWS_REGION

# ------------------------------------------------------------------------------
# 6. ADICIONAR PERMISSÃO PARA S3 INVOCAR A LAMBDA
# ------------------------------------------------------------------------------
Write-Host "`n[6/7] Configurando permissão do S3 para invocar Lambda..."

& $AWS lambda add-permission `
    --function-name $LAMBDA_NAME `
    --statement-id "S3InvokePermission" `
    --action "lambda:InvokeFunction" `
    --principal "s3.amazonaws.com" `
    --source-arn "arn:aws:s3:::$INPUT_BUCKET" `
    --source-account $AWS_ACCOUNT_ID `
    --region $AWS_REGION 2>$null

# ------------------------------------------------------------------------------
# 7. CONFIGURAR S3 TRIGGER (NOTIFICAÇÃO)
# ------------------------------------------------------------------------------
Write-Host "`n[7/7] Configurando S3 Trigger..."

$LAMBDA_ARN = "arn:aws:lambda:${AWS_REGION}:${AWS_ACCOUNT_ID}:function:$LAMBDA_NAME"

$NotificationConfig = @"
{
    "LambdaFunctionConfigurations": [
        {
            "Id": "ThumbnailTrigger",
            "LambdaFunctionArn": "$LAMBDA_ARN",
            "Events": ["s3:ObjectCreated:*"],
            "Filter": {
                "Key": {
                    "FilterRules": [
                        {
                            "Name": "suffix",
                            "Value": ".jpg"
                        }
                    ]
                }
            }
        },
        {
            "Id": "ThumbnailTriggerPNG",
            "LambdaFunctionArn": "$LAMBDA_ARN",
            "Events": ["s3:ObjectCreated:*"],
            "Filter": {
                "Key": {
                    "FilterRules": [
                        {
                            "Name": "suffix",
                            "Value": ".png"
                        }
                    ]
                }
            }
        },
        {
            "Id": "ThumbnailTriggerJPEG",
            "LambdaFunctionArn": "$LAMBDA_ARN",
            "Events": ["s3:ObjectCreated:*"],
            "Filter": {
                "Key": {
                    "FilterRules": [
                        {
                            "Name": "suffix",
                            "Value": ".jpeg"
                        }
                    ]
                }
            }
        }
    ]
}
"@

$NotificationConfig | Out-File -FilePath "notification-config.json" -Encoding UTF8
& $AWS s3api put-bucket-notification-configuration `
    --bucket $INPUT_BUCKET `
    --notification-configuration file://notification-config.json `
    --region $AWS_REGION

# ------------------------------------------------------------------------------
# LIMPEZA E RESUMO
# ------------------------------------------------------------------------------
Remove-Item -Path "trust-policy.json" -ErrorAction SilentlyContinue
Remove-Item -Path "s3-policy.json" -ErrorAction SilentlyContinue
Remove-Item -Path "notification-config.json" -ErrorAction SilentlyContinue

Write-Host "`n=============================================="
Write-Host "DEPLOY CONCLUÍDO COM SUCESSO!"
Write-Host "=============================================="
Write-Host ""
Write-Host "Recursos criados/atualizados:"
Write-Host "  - Lambda: $LAMBDA_NAME"
Write-Host "  - Role IAM: $LAMBDA_ROLE_NAME"
Write-Host "  - S3 Trigger configurado no bucket: $INPUT_BUCKET"
Write-Host ""
Write-Host "Para testar, faça upload de uma imagem:"
Write-Host "  aws s3 cp sua-imagem.jpg s3://$INPUT_BUCKET/"
Write-Host ""
Write-Host "A thumbnail será gerada em:"
Write-Host "  s3://$OUTPUT_BUCKET/thumbnails/"
Write-Host "=============================================="
