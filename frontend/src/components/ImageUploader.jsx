import { useState, useRef } from 'react'

const AWS_CONFIG = {
  region: 'us-east-1',
  inputBucket: 'thumbnail-app-input-davicoelho',
  outputBucket: 'thumbnail-app-output-davicoelho',
  apiUrl: 'https://8mjz3h8s62.execute-api.us-east-1.amazonaws.com/prod',
}

export default function ImageUploader() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [title, setTitle] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [generatedThumbnail, setGeneratedThumbnail] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      const isValidImage = file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.jfif')
      if (!isValidImage) {
        setStatus({ type: 'error', message: 'Por favor, selecione uma imagem válida.' })
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        setStatus({ type: 'error', message: 'A imagem deve ter no máximo 10MB.' })
        return
      }

      setSelectedFile(file)
      setStatus({ type: '', message: '' })
      setGeneratedThumbnail(null)

      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    event.currentTarget.classList.add('border-gamer-accent')
  }

  const handleDragLeave = (event) => {
    event.preventDefault()
    event.currentTarget.classList.remove('border-gamer-accent')
  }

  const handleDrop = (event) => {
    event.preventDefault()
    event.currentTarget.classList.remove('border-gamer-accent')
    
    const file = event.dataTransfer.files[0]
    if (file) {
      const fakeEvent = { target: { files: [file] } }
      handleFileSelect(fakeEvent)
    }
  }

  const getPresignedUrl = async (fileName, contentType) => {
    const response = await fetch(`${AWS_CONFIG.apiUrl}/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: fileName, contentType })
    })
    
    if (!response.ok) {
      throw new Error('Falha ao obter URL de upload')
    }
    
    return await response.json()
  }

  const uploadWithPresignedUrl = async (file, uploadUrl) => {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    })
    
    if (!response.ok) {
      throw new Error('Falha no upload do arquivo')
    }
    
    setUploadProgress(100)
    return true
  }

  const checkThumbnailStatus = async (key, maxAttempts = 30) => {
    for (let i = 0; i < maxAttempts; i++) {
      setStatus({ type: 'info', message: `Processando thumbnail... (${i + 1}/${maxAttempts})` })
      
      const response = await fetch(`${AWS_CONFIG.apiUrl}/status?key=${encodeURIComponent(key)}`)
      const data = await response.json()
      
      if (data.status === 'ready') {
        return data.downloadUrl
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    throw new Error('Tempo esgotado aguardando processamento')
  }

  const handleGenerateThumbnail = async () => {
    if (!selectedFile) {
      setStatus({ type: 'error', message: 'Selecione uma imagem primeiro.' })
      return
    }

    if (!title.trim()) {
      setStatus({ type: 'error', message: 'Digite um título para a thumbnail.' })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setStatus({ type: 'info', message: 'Iniciando upload...' })

    try {
      const timestamp = Date.now()
      const extension = selectedFile.name.split('.').pop()
      const fileName = `${timestamp}_${title.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`

      setStatus({ type: 'info', message: 'Obtendo URL de upload...' })
      const { uploadUrl, key } = await getPresignedUrl(fileName, selectedFile.type)

      setStatus({ type: 'info', message: 'Enviando imagem...' })
      await uploadWithPresignedUrl(selectedFile, uploadUrl)

      const thumbnailUrl = await checkThumbnailStatus(key)
      
      setGeneratedThumbnail(thumbnailUrl)
      setStatus({ type: 'success', message: 'Thumbnail gerada com sucesso!' })
      
    } catch (error) {
      console.error('Erro no upload:', error)
      setStatus({ type: 'error', message: `Erro: ${error.message}` })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleClear = () => {
    setSelectedFile(null)
    setPreview(null)
    setTitle('')
    setStatus({ type: '', message: '' })
    setGeneratedThumbnail(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="bg-gamer-card border border-white/20 rounded-2xl p-6 md:p-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
              transition-all duration-300 group
              ${preview 
                ? 'border-white/50 bg-black/50' 
                : 'border-white/20 hover:border-white/50 bg-black/30 hover:bg-black/50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.jfif"
              onChange={handleFileSelect}
              className="hidden"
            />

            {preview ? (
              <div className="relative">
                <img 
                  src={preview} 
                  alt="Preview" 
                  className="max-h-64 mx-auto rounded-lg shadow-lg"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <span className="text-white font-medium">Clique para trocar</span>
                </div>
              </div>
            ) : (
              <div className="py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-white mb-2">
                  Arraste sua imagem aqui
                </p>
                <p className="text-gray-400 text-sm">
                  ou clique para selecionar
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  PNG, JPG, JPEG (máx. 10MB)
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Título da Thumbnail
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: NOVA SEASON ÉPICA!"
              className="w-full px-4 py-3 bg-black border border-white/20 rounded-lg text-white placeholder-gray-500 focus:border-white/50 transition-colors"
              maxLength={50}
            />
            <p className="text-gray-500 text-xs mt-1 text-right">
              {title.length}/50 caracteres
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleGenerateThumbnail}
              disabled={isUploading || !selectedFile}
              className={`
                flex-1 btn-gamer px-6 py-4 rounded-lg font-bold text-lg uppercase tracking-wider
                transition-all duration-300
                ${isUploading || !selectedFile
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-gray-200 hover:scale-[1.02]'
                }
              `}
            >
              {isUploading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Gerando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Gerar Thumbnail
                </span>
              )}
            </button>

            {selectedFile && (
              <button
                onClick={handleClear}
                disabled={isUploading}
                className="px-4 py-4 border border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="h-2 bg-black rounded-full overflow-hidden">
                <div 
                  className="h-full progress-bar rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-400 text-center">{uploadProgress}%</p>
            </div>
          )}

          {status.message && (
            <div className={`
              p-4 rounded-lg border
              ${status.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : ''}
              ${status.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : ''}
              ${status.type === 'info' ? 'bg-white/5 border-white/20 text-white' : ''}
            `}>
              <p className="text-sm font-medium">{status.message}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview da Thumbnail
          </h3>

          <div className="aspect-video bg-black rounded-xl border border-white/20 overflow-hidden flex items-center justify-center">
            {generatedThumbnail ? (
              <div className="relative w-full h-full">
                <div className="w-full h-full bg-gradient-to-b from-gray-900 via-gray-800 to-black flex items-center justify-center">
                  {preview && (
                    <img 
                      src={preview} 
                      alt="Thumbnail Preview" 
                      className="max-h-full max-w-full object-contain"
                      style={{ filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' }}
                    />
                  )}
                  <div className="absolute bottom-8 left-0 right-0 text-center">
                    <p className="text-3xl font-bold text-white uppercase tracking-wider"
                       style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                      {title || 'TESTE'}
                    </p>
                  </div>
                </div>
                
                <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 rounded text-xs text-white">
                  1280 × 720
                </div>
              </div>
            ) : (
              <div className="text-center p-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-500">
                  A thumbnail aparecerá aqui
                </p>
                <p className="text-gray-600 text-sm mt-1">
                  1280 × 720 pixels
                </p>
              </div>
            )}
          </div>

          {generatedThumbnail && (
            <button
              onClick={() => window.open(generatedThumbnail, '_blank')}
              className="w-full btn-gamer px-6 py-3 bg-white/10 border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all font-medium flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Thumbnail
            </button>
          )}

          <div className="bg-black/50 rounded-lg p-4 border border-white/10">
            <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Como funciona
            </h4>
            <ul className="text-sm text-gray-500 space-y-1">
              <li>1. Upload da imagem para o S3</li>
              <li>2. Lambda processa com IA (rembg)</li>
              <li>3. Remove fundo + adiciona gradiente</li>
              <li>4. Thumbnail pronta em segundos!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
