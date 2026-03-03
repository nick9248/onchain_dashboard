import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Activity, BarChart2, Layers } from 'lucide-react';
import Synthesis from './pages/Synthesis';
import Analysis from './pages/Analysis';
import ParticleSphere from './components/ParticleSphere';
import './index.css';

function Navigation() {
    const location = useLocation();

    return (
        <nav className="sidebar">
            <div className="logo-container">
                <div className="logo-icon">
                    <Layers size={24} color="var(--accent-primary)" />
                </div>
                <h1 className="logo-text">ON-CHAIN</h1>
            </div>

            <div className="nav-links">
                <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
                    <Activity size={20} />
                    <span>Synthesis</span>
                </Link>
                <Link to="/analysis" className={`nav-link ${location.pathname === '/analysis' ? 'active' : ''}`}>
                    <BarChart2 size={20} />
                    <span>Analysis</span>
                </Link>
            </div>

            <div className="nav-footer">
                <div className="status-indicator">
                    <span className="pulse"></span>
                    System Live
                </div>
            </div>
        </nav>
    );
}

function App() {
    return (
        <BrowserRouter>
            <div className="app-container">
                {/* The 3D background sits behind everything */}
                <ParticleSphere />

                <Navigation />

                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<Synthesis />} />
                        <Route path="/analysis" element={<Analysis />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}

export default App;
