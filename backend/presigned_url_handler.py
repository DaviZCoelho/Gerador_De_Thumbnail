import os
import json
import boto3
from botocore.config import Config

s3_client = boto3.client(
    's3',
    region_name='us-east-1',
    config=Config(signature_version='s3v4')
)

INPUT_BUCKET = os.environ.get('INPUT_BUCKET', 'thumbnail-app-input-davicoelho')
OUTPUT_BUCKET = os.environ.get('OUTPUT_BUCKET', 'thumbnail-app-output-davicoelho')
UPLOAD_EXPIRATION = 300
DOWNLOAD_EXPIRATION = 3600


def lambda_handler(event, context):
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    }
    
    http_method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method', ''))
    if http_method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }
    
    try:
        path = event.get('path', event.get('rawPath', ''))
        body = {}
        if event.get('body'):
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        
        if '/upload-url' in path:
            return generate_upload_url(body, headers)
        elif '/download-url' in path:
            return generate_download_url(body, headers)
        elif '/status' in path:
            return check_thumbnail_status(event, headers)
        else:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Endpoint não encontrado'})
            }
            
    except Exception as e:
        print(f"Erro: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)})
        }


def generate_upload_url(body, headers):
    filename = body.get('filename')
    content_type = body.get('contentType', 'image/jpeg')
    
    if not filename:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': 'filename é obrigatório'})
        }
    
    presigned_url = s3_client.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': INPUT_BUCKET,
            'Key': filename,
            'ContentType': content_type
        },
        ExpiresIn=UPLOAD_EXPIRATION
    )
    
    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({
            'uploadUrl': presigned_url,
            'key': filename,
            'bucket': INPUT_BUCKET,
            'expiresIn': UPLOAD_EXPIRATION
        })
    }


def generate_download_url(body, headers):
    key = body.get('key')
    
    if not key:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': 'key é obrigatório'})
        }
    
    thumbnail_key = f"thumbnails/{key.rsplit('.', 1)[0]}_thumbnail.jpg"
    
    try:
        s3_client.head_object(Bucket=OUTPUT_BUCKET, Key=thumbnail_key)
    except:
        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': 'Thumbnail ainda não foi gerada', 'key': thumbnail_key})
        }
    
    presigned_url = s3_client.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': OUTPUT_BUCKET,
            'Key': thumbnail_key
        },
        ExpiresIn=DOWNLOAD_EXPIRATION
    )
    
    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({
            'downloadUrl': presigned_url,
            'key': thumbnail_key,
            'bucket': OUTPUT_BUCKET,
            'expiresIn': DOWNLOAD_EXPIRATION
        })
    }


def check_thumbnail_status(event, headers):
    path_params = event.get('pathParameters', {}) or {}
    query_params = event.get('queryStringParameters', {}) or {}
    
    key = path_params.get('key') or query_params.get('key')
    
    if not key:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': 'key é obrigatório'})
        }
    
    thumbnail_key = f"thumbnails/{key.rsplit('.', 1)[0]}_thumbnail.jpg"
    
    try:
        response = s3_client.head_object(Bucket=OUTPUT_BUCKET, Key=thumbnail_key)
        
        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': OUTPUT_BUCKET,
                'Key': thumbnail_key
            },
            ExpiresIn=DOWNLOAD_EXPIRATION
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'ready',
                'key': thumbnail_key,
                'size': response['ContentLength'],
                'downloadUrl': download_url
            })
        }
    except s3_client.exceptions.ClientError as e:
        if e.response['Error']['Code'] == '404':
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'status': 'processing',
                    'key': thumbnail_key
                })
            }
        raise
