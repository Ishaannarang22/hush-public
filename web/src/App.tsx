import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router'
import Plan from './pages/Plan.tsx'

const AcousticLab = lazy(() => import('./pages/AcousticLab.tsx'))
const Portfolio = lazy(() => import('./pages/Portfolio.tsx'))
const Neighborhood = lazy(() => import('./pages/Neighborhood.tsx'))

export default function App() {
  const { pathname } = useLocation()
  const neighborhood = pathname === '/' || pathname === '/lab/neighborhood' || pathname === '/lab/portfolio'
  return (
    <div className="app">
      {!neighborhood && <header className="topbar">
        <span className="brand">Hush</span>
        <nav>
          <NavLink to="/" end>
            Neighborhood
          </NavLink>
          <NavLink to="/lab">Acoustic lab</NavLink>
          <NavLink to="/plan">Plan</NavLink>
        </nav>
      </header>}
      <main>
        <Suspense fallback={<p className="loading">Loading 3D view...</p>}>
          <Routes>
            <Route path="/" element={<Neighborhood />} />
            <Route path="/lab/portfolio" element={<Portfolio />} />
            <Route path="/lab/neighborhood" element={<Neighborhood />} />
            <Route path="/lab" element={<AcousticLab />} />
            <Route path="/plan" element={<Plan />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}
