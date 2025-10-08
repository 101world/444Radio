export default function Visuals() {
  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-teal-400">Visuals</h1>
        <p className="text-center text-xl mb-8">Gallery of cinematic IG/YouTube loops</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder for videos */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="w-full h-48 bg-gray-700 rounded mb-4 flex items-center justify-center">
              <span className="text-gray-400">Video Placeholder</span>
            </div>
            <h3 className="text-lg font-semibold">Cinematic Loop 1</h3>
          </div>
          {/* Add more */}
        </div>
      </div>
    </main>
  )
}