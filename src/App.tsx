import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './components/Home'
import Upload from './components/Upload'
import Download from './components/Download'
import Ghostlink from './components/Ghostlink'
import Room from './components/Room'
import Footer from './components/Footer'

export default function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/Upload" element={<Upload />} />
            <Route path="/Download" element={<Download />} />
            <Route path="/Ghostlink" element={<Ghostlink />} />
            <Route path="/Room" element={<Room />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  )
}
