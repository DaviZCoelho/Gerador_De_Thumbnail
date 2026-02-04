import os
import io
import json
import urllib.parse
import boto3
from PIL import Image, ImageDraw, ImageFont
from rembg import remove

s3_client = boto3.client('s3')
OUTPUT_BUCKET = os.environ.get('OUTPUT_BUCKET', 'thumbnail-app-output-davicoelho')
THUMBNAIL_WIDTH = 1280
THUMBNAIL_HEIGHT = 720


def create_gradient_background(width, height):
    color_start = (75, 0, 130)
    color_end = (148, 0, 211)
    
    gradient = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(gradient)
    
    for y in range(height):
        ratio = y / height
        r = int(color_start[0] + (color_end[0] - color_start[0]) * ratio)
        g = int(color_start[1] + (color_end[1] - color_start[1]) * ratio)
        b = int(color_start[2] + (color_end[2] - color_start[2]) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    return gradient


def resize_and_center_image(foreground, bg_width, bg_height):
    max_width = int(bg_width * 0.8)
    max_height = int(bg_height * 0.8)
    
    width_ratio = max_width / foreground.width
    height_ratio = max_height / foreground.height
    scale = min(width_ratio, height_ratio)
    
    new_width = int(foreground.width * scale)
    new_height = int(foreground.height * scale)
    
    resized = foreground.resize((new_width, new_height), Image.Resampling.LANCZOS)
    return resized


def add_text_to_image(image, text):
    draw = ImageDraw.Draw(image)
    
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
    except (IOError, OSError):
        try:
            font = ImageFont.truetype("/usr/share/fonts/liberation/LiberationSans-Bold.ttf", 72)
        except (IOError, OSError):
            font = ImageFont.load_default()
    
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (image.width - text_width) // 2
    y = image.height - text_height - 50
    
    shadow_offset = 3
    draw.text((x + shadow_offset, y + shadow_offset), text, font=font, fill=(0, 0, 0, 180))
    draw.text((x, y), text, font=font, fill=(255, 255, 255, 255))
    
    return image


def extract_title_from_filename(filename):
    base_name = os.path.splitext(filename)[0]
    parts = base_name.split('_', 1)
    if len(parts) > 1:
        title = parts[1].rsplit('_thumbnail', 1)[0]
        title = title.replace('_', ' ')
        return title.upper()
    return base_name.upper()


def process_image(image_bytes, title="THUMBNAIL"):
    print("Removendo fundo da imagem...")
    image_no_bg = remove(image_bytes)
    foreground = Image.open(io.BytesIO(image_no_bg)).convert("RGBA")
    
    print("Criando fundo gradiente...")
    background = create_gradient_background(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
    background = background.convert("RGBA")
    
    print("Redimensionando imagem...")
    resized_foreground = resize_and_center_image(foreground, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
    
    x = (THUMBNAIL_WIDTH - resized_foreground.width) // 2
    y = (THUMBNAIL_HEIGHT - resized_foreground.height) // 2
    
    print("Compondo imagem final...")
    background.paste(resized_foreground, (x, y), resized_foreground)
    
    print(f"Adicionando texto: {title}")
    final_image = add_text_to_image(background, title)
    
    final_image = final_image.convert("RGB")
    
    output_buffer = io.BytesIO()
    final_image.save(output_buffer, format="JPEG", quality=95)
    output_buffer.seek(0)
    
    return output_buffer.getvalue()


def lambda_handler(event, context):
    print("="*50)
    print("Iniciando processamento de thumbnail")
    print(f"Evento recebido: {json.dumps(event, indent=2)}")
    print("="*50)
    
    try:
        record = event['Records'][0]
        input_bucket = record['s3']['bucket']['name']
        object_key = urllib.parse.unquote_plus(record['s3']['object']['key'])
        
        print(f"Bucket de entrada: {input_bucket}")
        print(f"Arquivo: {object_key}")
        
        print("Baixando imagem do S3...")
        response = s3_client.get_object(Bucket=input_bucket, Key=object_key)
        image_bytes = response['Body'].read()
        print(f"Imagem baixada: {len(image_bytes)} bytes")
        
        title = extract_title_from_filename(object_key)
        print(f"Título extraído: {title}")
        
        processed_image = process_image(image_bytes, title)
        print(f"Imagem processada: {len(processed_image)} bytes")
        
        base_name = os.path.splitext(object_key)[0]
        output_key = f"thumbnails/{base_name}_thumbnail.jpg"
        
        print(f"Fazendo upload para: {OUTPUT_BUCKET}/{output_key}")
        s3_client.put_object(
            Bucket=OUTPUT_BUCKET,
            Key=output_key,
            Body=processed_image,
            ContentType='image/jpeg'
        )
        
        print("="*50)
        print("Processamento concluído com sucesso!")
        print("="*50)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Thumbnail gerada com sucesso!',
                'input': f"s3://{input_bucket}/{object_key}",
                'output': f"s3://{OUTPUT_BUCKET}/{output_key}"
            })
        }
        
    except KeyError as e:
        print(f"Erro: Campo obrigatório não encontrado no evento: {e}")
        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': f'Campo obrigatório não encontrado: {str(e)}'
            })
        }
        
    except Exception as e:
        print(f"Erro durante o processamento: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }
