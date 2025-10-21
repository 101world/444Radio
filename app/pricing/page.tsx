export default function Pricing() {
  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">Pricing</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 text-center shadow-2xl hover:scale-105 transition-transform duration-300">
            <h2 className="text-2xl font-semibold mb-4">Free</h2>
            <p className="text-4xl font-bold mb-4">$0</p>
            <ul className="text-left mb-6">
              <li>5 generations per month</li>
              <li>Basic support</li>
            </ul>
            <button className="bg-teal-500 text-white py-2 px-4 rounded hover:bg-teal-600 transition">Get Started</button>
          </div>
          <div className="backdrop-blur-md bg-white/10 border-2 border-teal-400 rounded-2xl p-6 text-center shadow-2xl hover:scale-105 transition-transform duration-300">
            <h2 className="text-2xl font-semibold mb-4">Pro</h2>
            <p className="text-4xl font-bold mb-4">$9.99</p>
            <ul className="text-left mb-6">
              <li>Unlimited generations</li>
              <li>High quality audio</li>
              <li>Priority support</li>
            </ul>
            <button className="bg-teal-500 text-white py-2 px-4 rounded hover:bg-teal-600 transition">Subscribe</button>
          </div>
          <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-2xl p-6 text-center shadow-2xl hover:scale-105 transition-transform duration-300">
            <h2 className="text-2xl font-semibold mb-4">Enterprise</h2>
            <p className="text-4xl font-bold mb-4">Contact Us</p>
            <ul className="text-left mb-6">
              <li>Custom solutions</li>
              <li>API access</li>
              <li>Dedicated support</li>
            </ul>
            <button className="bg-teal-500 text-white py-2 px-4 rounded hover:bg-teal-600 transition">Contact</button>
          </div>
        </div>
      </div>
    </main>
  )
}

