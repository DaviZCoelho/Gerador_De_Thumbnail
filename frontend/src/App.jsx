import ImageUploader from './components/ImageUploader'

function App() {
  return (
    <div className="min-h-screen bg-black grid-bg">
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-bold text-white tracking-wider">
                  GERADOR DE THUMBNAIL
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Crie Thumbnails
            </h2>
            <p className="text-gray-400 text-lg">
              Faça upload da sua imagem, adicione um título e deixe a IA modificar o fundo
            </p>
          </div>

          <ImageUploader />

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gamer-card border border-white/10 rounded-xl p-6 hover:border-white/30 transition-all">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Remoção de Fundo</h3>
              <p className="text-gray-400 text-sm">IA remove automaticamente o fundo da sua imagem</p>
            </div>

            <div className="bg-gamer-card border border-white/10 rounded-xl p-6 hover:border-white/30 transition-all">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Gradiente Épico</h3>
              <p className="text-gray-400 text-sm">Fundo gradiente profissional para suas thumbs</p>
            </div>

            <div className="bg-gamer-card border border-white/10 rounded-xl p-6 hover:border-white/30 transition-all">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">1280x720 HD</h3>
              <p className="text-gray-400 text-sm">Tamanho perfeito para YouTube e redes sociais</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 mt-16 py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            Desenvolvido por Davi Coelho
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
