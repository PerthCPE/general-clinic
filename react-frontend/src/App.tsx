import Sidebar from './components/Sidebar/Sidebar'
import Topbar from './components/Topbar/Topbar'
import Body from './components/Body/Body'
import './App.css'
import { useState } from 'react'

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="app-layout">
      {/* 1. Left Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* 2. Top Navigation Bar */}
      <Topbar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(true)}
      />

      {/* 3. Main Body Content */}
      <Body isSidebarOpen={isSidebarOpen} />
    </div>
  )
}

export default App
