import React, { useEffect, useState } from 'react';

const Synthesis = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch('/api/data')
            .then(res => res.json())
            .then(json => {
                setData(json);
                setLoading(false);
            })
            .catch(err => {
                setError(err.toString());
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="loader"><div className="spinner"></div>Loading Synthesis...</div>;
    if (error) return <div className="loader text-bearish">Error: {error}</div>;

    return (
        <div className="synthesis-page fade-in">
            <header className="page-header">
                <h2>Executive Synthesis</h2>
                <p className="page-desc">High-level overview of the most recent on-chain algorithmic output.</p>
            </header>

            <div className="dashboard-grid">
                {['BTC', 'ETH'].map((asset, assetIndex) => {
                    const assetData = data[asset];

                    if (!assetData || !assetData.synthesis || Object.keys(assetData.synthesis).length === 0) {
                        return (
                            <div key={asset} className="g-col-full" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', flexDirection: 'column', gridColumn: 'span 12' }}>
                                <h2 style={{ color: '#EF4444', marginBottom: '1rem' }}>No AI Synthesis Found for {asset}</h2>
                                <p className="text-muted">The Python engine found no 'synthesis.txt' for {asset}. Please generate reports at 'output/data/onchain_analysis'.</p>
                            </div>
                        );
                    }

                    const synth = assetData.synthesis;
                    const report = assetData.report?.global || {};

                    return (
                        <div key={asset} className="g-col-full grid-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>

                            {/* Asset Header Row */}
                            <div className="glass-card g-col-full" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <h2 style={{ fontSize: '1.75rem', fontWeight: 600, margin: 0 }}>{asset}</h2>
                                    <span className="pulse" style={{ display: 'inline-block' }}></span>
                                </div>
                                <div className="mono text-primary-accent" style={{ fontSize: '1.5rem' }}>${report.underlying_price || '--'}</div>
                            </div>

                            {/* Status Row */}
                            <div className="glass-card" style={{ gridColumn: 'span 4' }}>
                                <span className="card-title">Market Environment</span>
                                <SemanticMetric label="Regime" value={synth.regime} lg />
                                <SemanticMetric label="Directional Bias" value={synth.direction} lg />
                                <SemanticMetric label="Volatility State" value={synth.volatility} lg />
                            </div>

                            {/* Bias Term Structure */}
                            <div className="glass-card" style={{ gridColumn: 'span 4' }}>
                                <span className="card-title">Term Structure Bias</span>
                                <SemanticMetric label="Near-Term (0-7 DTE)" value={synth.near_term_bias} lg />
                                <SemanticMetric label="Mid-Term (7-30 DTE)" value={synth.mid_term_bias} lg />
                                <SemanticMetric label="Far-Term (30+ DTE)" value={synth.far_term_bias} lg />
                                <SemanticMetric label="Forward VRP" value={synth.vrp} lg />
                            </div>

                            {/* Primary Trade Recommendation */}
                            <div className="glass-card" style={{ gridColumn: 'span 4' }}>
                                <span className="card-title">Recommendation</span>
                                <p style={{ lineHeight: '1.6', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                                    {synth.primary_recommendation || 'No clear signal.'}
                                </p>
                            </div>

                            {/* Vol Assessment & Risk Factors */}
                            <div className="glass-card" style={{ gridColumn: 'span 6' }}>
                                <span className="card-title" style={{ color: '#D4AF37' }}>Volatility Assessment</span>
                                <p style={{ lineHeight: '1.6', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                                    {synth.vol_assessment || 'No volatility assessment available.'}
                                </p>
                            </div>
                            <div className="glass-card" style={{ gridColumn: 'span 6' }}>
                                <span className="card-title" style={{ color: '#EF4444' }}>Risk Factors</span>
                                <p style={{ lineHeight: '1.6', fontSize: '1.05rem', color: '#EF4444' }}>
                                    {synth.risk_factors || 'No explicit risk factors identified.'}
                                </p>
                            </div>

                            {/* Institutional Flow Row */}
                            {synth.block_trades_summary && (
                                <div className="glass-card" style={{ gridColumn: 'span 12' }}>
                                    <span className="card-title">Institutional Block Trades (Live Flow)</span>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 500 }}>{synth.block_trades_summary}</div>
                                        <div className="mono text-muted" style={{ backgroundColor: 'rgba(212, 175, 55, 0.05)', padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid rgba(212,175,55,0.1)' }}>
                                            {synth.block_trades_largest}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Helper for color-coded metrics
const SemanticMetric = ({ label, value, lg }) => {
    let colorClass = '';
    if (!value) value = '--';
    const valUp = value.toUpperCase();

    if (valUp.includes('BULLISH') || valUp.includes('POSITIVE') || valUp.includes('BUY')) {
        colorClass = 'text-bullish';
    } else if (valUp.includes('BEARISH') || valUp.includes('NEGATIVE') || valUp.includes('SELL')) {
        colorClass = 'text-bearish';
    } else if (valUp.includes('NEUTRAL') || valUp.includes('TRANSITION') || valUp.includes('EXPLOSIVE')) {
        colorClass = 'text-neutral';
    }

    return (
        <div className="metric" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', ...(lg ? { padding: '0.75rem 0', fontSize: '1.1rem' } : {}) }}>
            <span className="label" style={lg ? { fontSize: '1rem' } : {}}>{label}</span>
            <span className={`value ${colorClass}`} style={{ textAlign: 'right' }}>{valUp}</span>
        </div>
    );
}

export default Synthesis;
