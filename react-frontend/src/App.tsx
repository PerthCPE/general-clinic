import Sidebar from './components/Sidebar/Sidebar'
import Topbar from './components/Topbar/Topbar'
import Body from './components/Body/Body'
import './App.css'

function App() {
  return (
    <div className="app-layout">
      {/* 1. Left Sidebar */}
      <Sidebar />

      {/* 2. Top Navigation Bar */}
      <Topbar />

      {/* 3. Main Body Content */}
      <Body />
    </div>
  )
}

export default App
