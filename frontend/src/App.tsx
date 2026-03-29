import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Shell } from './components/layout/Shell'
import { Dashboard } from './pages/Dashboard'
import { Workspaces } from './pages/Workspaces'
import { Modules } from './pages/Modules'
import { ModuleDetail } from './pages/ModuleDetail'
import { Marketplace } from './pages/Marketplace'
import { DataTables } from './pages/DataTables'
import { Snapshots } from './pages/Snapshots'
import { Keys } from './pages/Keys'

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/workspaces" element={<Workspaces />} />
          <Route path="/modules" element={<Modules />} />
          <Route path="/modules/*" element={<ModuleDetail />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/data" element={<DataTables />} />
          <Route path="/data/:table" element={<DataTables />} />
          <Route path="/snapshots" element={<Snapshots />} />
          <Route path="/keys" element={<Keys />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  )
}
