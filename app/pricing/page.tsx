export default function Pricing() {
  return (
    <main className="min-h-screen bg-black text-white p-8 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-black to-black pointer-events-none"></div>
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-black mb-4 bg-gradient-to-r from-cyan-400 via-cyan-300 to-white bg-clip-text text-transparent">
            Simple Pricing
          </h1>
          <p className="text-cyan-400/60 text-lg">Choose the perfect plan for your music creation needs</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Starter Plan */}
          <div className="group relative backdrop-blur-xl bg-gradient-to-br from-cyan-950/30 to-black border border-cyan-500/20 rounded-3xl p-8 hover:border-cyan-400/60 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="relative">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Starter</h2>
                <p className="text-cyan-400/60 text-sm">Perfect for trying out</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">$1</span>
                  <span className="text-cyan-400/60 text-lg">one-time</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300"><span className="font-bold text-white">20 songs</span> generation</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">High quality audio</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">Cover art included</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">Download & own forever</span>
                </li>
              </ul>

              <button className="w-full py-4 px-6 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl font-bold hover:bg-cyan-500/30 hover:border-cyan-400/60 transition-all duration-300 group-hover:scale-105">
                Get Started
              </button>
            </div>
          </div>

          {/* Popular Plan */}
          <div className="group relative backdrop-blur-xl bg-gradient-to-br from-cyan-600/20 to-black border-2 border-cyan-400 rounded-3xl p-8 hover:border-cyan-300 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-400/30 md:-mt-4">
            {/* Popular Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full text-white text-sm font-bold shadow-lg shadow-cyan-500/50">
              ✨ Most Popular
            </div>

            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="relative">
              <div className="mb-6 mt-4">
                <h2 className="text-2xl font-bold text-white mb-2">Creator</h2>
                <p className="text-cyan-300/80 text-sm">Best value for creators</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">$3</span>
                  <span className="text-cyan-300/80 text-lg">one-time</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-200"><span className="font-bold text-white">50 songs</span> generation</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-200">Premium quality audio</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-200">Cover art included</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-200">Priority support</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-200">Download & own forever</span>
                </li>
              </ul>

              <button className="w-full py-4 px-6 bg-gradient-to-r from-cyan-600 to-cyan-400 text-white rounded-xl font-bold hover:from-cyan-700 hover:to-cyan-500 transition-all duration-300 shadow-lg shadow-cyan-500/30 group-hover:scale-105">
                Get Started
              </button>
            </div>
          </div>

          {/* Unlimited Plan */}
          <div className="group relative backdrop-blur-xl bg-gradient-to-br from-cyan-950/30 to-black border border-cyan-500/20 rounded-3xl p-8 hover:border-cyan-400/60 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="relative">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">Pro</h2>
                <p className="text-cyan-400/60 text-sm">For serious creators</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">$25</span>
                  <span className="text-cyan-400/60 text-lg">one-time</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300"><span className="font-bold text-white">Unlimited songs</span> generation</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">Premium quality audio</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">Unlimited cover art</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">Priority support 24/7</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">Commercial license</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-cyan-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-300">Early access to features</span>
                </li>
              </ul>

              <button className="w-full py-4 px-6 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-xl font-bold hover:bg-cyan-500/30 hover:border-cyan-400/60 transition-all duration-300 group-hover:scale-105">
                Get Started
              </button>
            </div>
          </div>
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-20 text-center">
          <p className="text-cyan-400/60 text-sm">
            All plans include high-quality music generation • No subscriptions • Pay once, use forever
          </p>
          <p className="text-cyan-400/40 text-xs mt-2">
            Questions? Contact us at support@444radio.com
          </p>
        </div>
      </div>
    </main>
  )
}

