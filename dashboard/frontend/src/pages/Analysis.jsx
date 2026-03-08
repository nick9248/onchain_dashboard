import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ComposedChart, LineChart, Line, Cell, ReferenceLine, LabelList
} from 'recharts';

const formatBigNumber = (val) => {
    if (val >= 1000000 || val <= -1000000) return (val / 1000000).toFixed(2) + 'M';
    if (val >= 1000 || val <= -1000) return (val / 1000).toFixed(1) + 'k';
    return val;
};

// Custom Tooltip component for Recharts to match theme
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'rgba(11, 19, 43, 0.95)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                padding: '12px',
                borderRadius: '8px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                color: '#F8FAFC',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.85rem'
            }}>
                <p style={{ margin: '0 0 8px 0', color: '#D4AF37', fontWeight: 600 }}>{label}</p>
                {payload.map((entry, index) => (
                    <p key={index} style={{ margin: '4px 0', color: entry.color }}>
                        {entry.name}: {entry.value.toLocaleString()}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const Analysis = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Selections
    const [selectedAsset, setSelectedAsset] = useState('BTC');
    const [selectedExpiry, setSelectedExpiry] = useState('ALL');
    const [showNotional, setShowNotional] = useState(false);
    const [hoveredLegend, setHoveredLegend] = useState(null);

    const handleLegendMouseEnter = (o) => {
        setHoveredLegend(o.dataKey);
    };

    const handleLegendMouseLeave = () => {
        setHoveredLegend(null);
    };

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

    if (loading) return <div className="loader"><div className="spinner"></div>Loading Deep Analysis...</div>;
    if (error) return <div className="loader text-bearish">Error: {error}</div>;

    const assetData = data[selectedAsset]?.report;
    if (!assetData || Object.keys(assetData).length === 0) return (
        <div className="analysis-page fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
            <h2 style={{ color: '#EF4444', marginBottom: '1rem' }}>No Data Found</h2>
            <p className="text-muted">The Python parsing engine could not find any report text files for {selectedAsset}. Please ensure the reports are generated at 'output/data/onchain_analysis'.</p>
        </div>
    );

    const globalData = assetData.global || {};
    const currentPrice = globalData.underlying_price || 0;

    const expirations = assetData.expirations || [];

    let currentView = null;
    if (selectedExpiry === 'ALL') {
        currentView = expirations[0];
    } else {
        currentView = expirations.find(e => e.date === selectedExpiry) || expirations[0];
    }

    if (!currentView) return <div className="loader">No expiration data found.</div>;

    const metrics = currentView.metrics || {};
    const strikesData = currentView.strikes || [];
    const gexData = currentView.gex_strikes || [];
    const buyFlowData = currentView.buy_flow || [];
    const sellFlowData = currentView.sell_flow || [];
    const ivData = currentView.iv_surface || [];

    const extractMoneyType = (dict, type) => {
        const field = showNotional ? 'notional' : 'oi';
        return dict?.[type]?.[field] || 0;
    };

    const callMoneyness = [
        { name: 'Calls ITM', val: extractMoneyType(currentView.moneyness.calls, 'ITM'), pct: currentView.moneyness.calls?.ITM?.pct },
        { name: 'Calls OTM', val: extractMoneyType(currentView.moneyness.calls, 'OTM'), pct: currentView.moneyness.calls?.OTM?.pct },
        { name: 'Total Calls', val: extractMoneyType(currentView.moneyness.calls, 'Total'), pct: currentView.moneyness.calls?.Total?.pct },
    ];

    const putMoneyness = [
        { name: 'Puts ITM', val: extractMoneyType(currentView.moneyness.puts, 'ITM'), pct: currentView.moneyness.puts?.ITM?.pct },
        { name: 'Puts OTM', val: extractMoneyType(currentView.moneyness.puts, 'OTM'), pct: currentView.moneyness.puts?.OTM?.pct },
        { name: 'Total Puts', val: extractMoneyType(currentView.moneyness.puts, 'Total'), pct: currentView.moneyness.puts?.Total?.pct },
    ];

    const combinedMoneyness = [
        { name: 'Combined ITM', val: extractMoneyType(currentView.moneyness.combined, 'ITM'), pct: currentView.moneyness.combined?.ITM?.pct },
        { name: 'Combined OTM', val: extractMoneyType(currentView.moneyness.combined, 'OTM'), pct: currentView.moneyness.combined?.OTM?.pct },
        { name: 'Grand Total', val: extractMoneyType(currentView.moneyness.combined, 'Total'), pct: currentView.moneyness.combined?.Total?.pct },
    ];

    const pcOidata = [
        { name: 'Calls', oi: metrics.total_call_oi || 0, fill: '#10B981' },
        { name: 'Puts', oi: metrics.total_put_oi || 0, fill: '#EF4444' }
    ];

    const volStatsData = [
        { name: 'Call Vol', vol: metrics.total_call_vol || 0, fill: '#10B981' },
        { name: 'Put Vol', vol: metrics.total_put_vol || 0, fill: '#EF4444' },
        { name: 'Total Vol', vol: metrics.total_vol || 0, fill: '#D4AF37' } /* Changed total vol to khaki */
    ];

    const maxPainVal = metrics.max_pain || 0;
    const maxPainDistData = [
        { name: 'Current Price', price: currentPrice },
        { name: 'Max Pain Strike', price: maxPainVal }
    ];

    const getLevels = () => {
        let supp = metrics.gex_put_sup || null;
        let res = metrics.gex_call_res || null;
        let hvl = metrics.hvl_zero_gamma || null;
        return { supp, res, hvl };
    };

    const { supp, res, hvl } = getLevels();
    const suppLevels = currentView.support_levels || [];
    const resLevels = currentView.resistance_levels || [];

    const bias = metrics.bias || '--';
    const trend = metrics.trend || '--';
    const largeOiChanges = currentView.large_oi_changes || [];

    return (
        <div className="analysis-page fade-in">
            <header className="page-header analysis-header">
                <div>
                    <h2>Market Analysis</h2>
                    <p className="page-desc mono">Aggregated on-chain mechanics</p>
                </div>

                <div className="controls">
                    <div className="custom-select-wrapper">
                        <select
                            value={selectedAsset}
                            onChange={e => setSelectedAsset(e.target.value)}
                            className="dropdown"
                        >
                            <option value="BTC">BTC</option>
                            <option value="ETH">ETH</option>
                        </select>
                    </div>

                    <div className="custom-select-wrapper">
                        <select
                            value={selectedExpiry}
                            onChange={e => setSelectedExpiry(e.target.value)}
                            className="dropdown"
                            style={{ minWidth: '200px' }}
                        >
                            {expirations.map((exp, idx) => (
                                <option key={exp.date} value={exp.date}>
                                    {idx === 0 ? 'Nearest Expiry' : 'Expiry'}: {exp.date}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            <div className="dashboard-grid" style={{ marginBottom: '5rem' }}>

                {/* TOP LAYOUT STRUCTURE */}
                <div className="g-col-full" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* ROW 1: DVOL, IV Percentile, Funding Rate, Put/Call Ratio */}
                    <div className="dashboard-grid" style={{ alignItems: 'stretch' }}>

                        {/* 3 Left Cards */}
                        <div style={{ gridColumn: 'span 6', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                            <div className="glass-card metric-box" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <span className="card-title">DVOL Index</span>
                                <span className="box-value mono text-primary-accent">{globalData.dvol || '--'}%</span>
                                {globalData.expected_daily_move && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#94A3B8' }}>
                                        <div>Daily Expected: {globalData.expected_daily_move}</div>
                                        <div>Weekly Expected: {globalData.expected_weekly_move}</div>
                                        <div>Monthly Expected: {globalData.expected_monthly_move}</div>
                                    </div>
                                )}
                            </div>

                            <div className="glass-card metric-box" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <span className="card-title">IV Percentile</span>
                                <span className="box-value mono">{globalData.iv_percentile || '--'}</span>
                                <span className="box-sub">Relative Rank</span>
                            </div>

                            <div className="glass-card metric-box" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <span className="card-title">Funding Rate</span>
                                <span className="box-value mono">{globalData.funding_rate || '--'}%</span>
                                <span className="box-sub">8h: {globalData.funding_rate_8h ? globalData.funding_rate_8h + '%' : '--'}</span>
                            </div>
                        </div>

                        {/* Put/Call Ratio (Right side) */}
                        <div className="glass-card" style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column' }}>
                            <h3 className="card-title">Put/Call Ratio (Open Interest)</h3>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexGrow: 1, alignItems: 'center' }}>
                                <div style={{ width: '60%', height: '140px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={pcOidata} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.05)" vertical={false} />
                                            <XAxis dataKey="name" stroke="#94A3B8" tick={{ fontSize: 12 }} />
                                            <YAxis stroke="#94A3B8" tick={{ fontSize: 12 }} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                            <Bar dataKey="oi" radius={[4, 4, 0, 0]}>
                                                {pcOidata.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="metric-box" style={{ width: '40%', alignItems: 'flex-end', justifyContent: 'center', textAlign: 'right' }}>
                                    <span className="box-label">OI P/C</span>
                                    <span className="box-value mono" style={{ fontSize: '2rem' }}>{metrics.pc_ratio || '--'}</span>
                                    <span className={`box-sub ${metrics.pc_ratio < 1 ? 'text-bullish' : 'text-bearish'}`}>{metrics.pc_signal || '--'}</span>
                                    {metrics.trend_pc && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#94A3B8', textAlign: 'right' }}>
                                            <div>P/C: {metrics.trend_pc}</div>
                                            <div>Calls: {metrics.trend_call_oi}</div>
                                            <div>Puts: {metrics.trend_put_oi}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* ROW 2: Max Pain, Directional Bias, Flow Trend, Volume Statistics */}
                    <div className="dashboard-grid" style={{ alignItems: 'stretch' }}>

                        {/* 3 Left Cards */}
                        <div style={{ gridColumn: 'span 6', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="metric-box">
                                    <span className="card-title">Max Pain</span>
                                    <span className="box-value mono text-neutral">${maxPainVal.toLocaleString()}</span>
                                    <span className="box-sub" style={{ marginTop: '0.25rem' }}>Distance: {metrics.max_pain_distance > 0 ? '+' : ''}{metrics.max_pain_distance}{metrics.max_pain_distance_pct ? ` (${metrics.max_pain_distance_pct})` : '%'}</span>
                                </div>
                                <div style={{ width: '100%', height: '60px', marginTop: 'auto', paddingTop: '1rem' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={maxPainDistData}>
                                            <YAxis domain={['auto', 'auto']} hide />
                                            <XAxis dataKey="name" hide />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Line type="step" dataKey="price" stroke="#D4AF37" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#0B132B', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="glass-card metric-box" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <span className="card-title">Directional Bias</span>
                                <span className={`box-value ${bias.includes('Bullish') ? 'text-bullish' : bias.includes('Bearish') ? 'text-bearish' : 'text-neutral'}`} style={{ fontSize: '1.5rem' }}>{bias}</span>
                            </div>

                            <div className="glass-card metric-box" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <span className="card-title">Flow Trend</span>
                                <span className="box-value" style={{ fontSize: '1.5rem', color: '#E0E7FF' }}>{trend}</span>
                            </div>
                        </div>

                        {/* Volume Statistics (Right side) */}
                        <div className="glass-card" style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column' }}>
                            <h3 className="card-title">Volume Statistics</h3>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexGrow: 1, alignItems: 'center' }}>
                                <div style={{ width: '60%', height: '140px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={volStatsData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.05)" vertical={false} />
                                            <XAxis dataKey="name" stroke="#94A3B8" tick={{ fontSize: 12 }} />
                                            <YAxis stroke="#94A3B8" tick={{ fontSize: 12 }} padding={{ left: 0 }} tickFormatter={(value) => value.toLocaleString()} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                            <Bar dataKey="vol" radius={[4, 4, 0, 0]}>
                                                {volStatsData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="metric-box" style={{ width: '40%', alignItems: 'flex-end', justifyContent: 'center', textAlign: 'right' }}>
                                    <span className="box-label">VOL P/C</span>
                                    <span className="box-value mono" style={{ fontSize: '2rem' }}>{metrics.vol_pc_ratio || '--'}</span>
                                    {metrics.trend_vol_pc && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#94A3B8', textAlign: 'right' }}>
                                            <div>Vol P/C: {metrics.trend_vol_pc}</div>
                                            <div>Volume: {metrics.trend_volume}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>

                </div>

                {/* MONEYNESS */}
                <div className="glass-card g-col-full">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="card-title" style={{ margin: 0, border: 'none' }}>Moneyness Analysis {currentView.moneyness?.skew && `(${currentView.moneyness.skew})`}</h3>
                        <button
                            className={`toggle-btn ${showNotional ? 'active' : ''}`}
                            onClick={() => setShowNotional(!showNotional)}
                        >
                            View: {showNotional ? 'Notional ($)' : 'Open Interest'}
                        </button>
                    </div>

                    <div className="grid-3" style={{ height: '250px', marginTop: '1rem' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={callMoneyness} margin={{ top: 20, right: 35, left: 0, bottom: 5 }} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.05)" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" stroke="#94A3B8" width={80} tick={{ fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Bar dataKey="val" fill="#10B981" radius={[0, 4, 4, 0]}>
                                    <LabelList dataKey="pct" position="right" fill="#D4AF37" formatter={(v) => v ? `${v}%` : ''} fontSize={11} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>

                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={putMoneyness} margin={{ top: 20, right: 35, left: 0, bottom: 5 }} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.05)" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" stroke="#94A3B8" width={80} tick={{ fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Bar dataKey="val" fill="#EF4444" radius={[0, 4, 4, 0]}>
                                    <LabelList dataKey="pct" position="right" fill="#D4AF37" formatter={(v) => v ? `${v}%` : ''} fontSize={11} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>

                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={combinedMoneyness} margin={{ top: 20, right: 35, left: 0, bottom: 5 }} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.05)" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" stroke="#94A3B8" width={90} tick={{ fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Bar dataKey="val" fill="#D4AF37" radius={[0, 4, 4, 0]}>
                                    <LabelList dataKey="pct" position="right" fill="#E0E7FF" formatter={(v) => v ? `${v}%` : ''} fontSize={11} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div >

                {/* SPLIT OPEN INTEREST AND VOLUME GRAPHS */}
                < div className="glass-card g-col-full" >
                    <h3 className="card-title">Open Interest Distribution by Strike</h3>
                    <div className="chart-container" style={{ height: 350 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={strikesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.05)" />
                                <XAxis dataKey="strike" stroke="#94A3B8" />
                                <YAxis stroke="#94A3B8" />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} onMouseEnter={handleLegendMouseEnter} onMouseLeave={handleLegendMouseLeave} />
                                <Bar dataKey="call_oi" fill="#10B981" name="Call Open Interest" fillOpacity={hoveredLegend === 'call_oi' || !hoveredLegend ? 1 : 0.3} />
                                <Bar dataKey="put_oi" fill="#EF4444" name="Put Open Interest" fillOpacity={hoveredLegend === 'put_oi' || !hoveredLegend ? 1 : 0.3} />

                                {maxPainVal > 0 && <ReferenceLine x={maxPainVal} stroke="#D4AF37" strokeDasharray="3 3" label={{ position: 'top', value: 'Max Pain', fill: '#D4AF37', fontSize: 12 }} />}
                                {suppLevels.map((s, i) => <ReferenceLine key={`sup-${i}`} x={s} stroke="#10B981" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: `Support ${i + 1}`, fill: '#10B981', fontSize: 10 }} />)}
                                {resLevels.map((r, i) => <ReferenceLine key={`res-${i}`} x={r} stroke="#EF4444" strokeDasharray="3 3" label={{ position: 'insideTopRight', value: `Resistance ${i + 1}`, fill: '#EF4444', fontSize: 10 }} />)}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div >

                <div className="glass-card g-col-full">
                    <h3 className="card-title">Trading Volume by Strike</h3>
                    <div className="chart-container" style={{ height: 350 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={strikesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.05)" />
                                <XAxis dataKey="strike" stroke="#94A3B8" />
                                <YAxis stroke="#94A3B8" />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} onMouseEnter={handleLegendMouseEnter} onMouseLeave={handleLegendMouseLeave} />
                                <Bar dataKey="call_vol" fill="#10B981" name="Call Volume" fillOpacity={hoveredLegend === 'call_vol' || !hoveredLegend ? 1 : 0.3} />
                                <Bar dataKey="put_vol" fill="#EF4444" name="Put Volume" fillOpacity={hoveredLegend === 'put_vol' || !hoveredLegend ? 1 : 0.3} />

                                {maxPainVal > 0 && <ReferenceLine x={maxPainVal} stroke="#D4AF37" strokeDasharray="3 3" />}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* GEX Profile */}
                <div className="glass-card g-col-full">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 className="card-title" style={{ border: 'none', margin: 0 }}>Gamma Exposure (GEX) Level Map</h3>
                        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                            <div className="metric-box" style={{ alignItems: 'flex-end' }}>
                                <span className="box-label">Total Net GEX</span>
                                <span className={`box-value mono ${metrics.total_net_gex > 0 ? 'text-bullish' : 'text-bearish'}`}>{(metrics.total_net_gex ? Number(metrics.total_net_gex).toLocaleString() + ' USD' : '--')}</span>
                            </div>
                            <span style={{ color: 'rgba(212,175,55,0.3)', fontSize: '1.5rem' }}>|</span>
                            <div className="metric-box" style={{ alignItems: 'flex-end' }}>
                                <span className="box-label">Total Net DEX</span>
                                <span className={`box-value mono ${metrics.total_net_dex > 0 ? 'text-bullish' : 'text-bearish'}`}>{(metrics.total_net_dex ? Number(metrics.total_net_dex).toLocaleString() + ' BTC' : '--')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="chart-container" style={{ height: 400, marginTop: '2rem' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={gexData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.05)" />
                                <XAxis dataKey="strike" stroke="#94A3B8" />
                                <YAxis stroke="#94A3B8" tickFormatter={formatBigNumber} />
                                <YAxis yAxisId="right" orientation="right" stroke="#94A3B8" hide />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} onMouseEnter={handleLegendMouseEnter} onMouseLeave={handleLegendMouseLeave} />
                                <Bar dataKey="net_gex" name="Net Gamma Exposure" fill="#10B981" fillOpacity={hoveredLegend === 'net_gex' || !hoveredLegend ? 1 : 0.3}>
                                    {
                                        gexData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.net_gex > 0 ? '#10B981' : '#EF4444'} />
                                        ))
                                    }
                                </Bar>
                                {/* Subtle invisible line to satisfy legend coloring logic mapping */}
                                <Line dataKey="net_dex" name="Net Delta Exposure" stroke="#D4AF37" strokeWidth={2} dot={false} yAxisId="right" strokeOpacity={hoveredLegend === 'net_dex' || !hoveredLegend ? 1 : 0.3} />
                                <ReferenceLine y={0} stroke="#94A3B8" />

                                {supp && <ReferenceLine x={supp} stroke="#10B981" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Put Support', fill: '#10B981', fontSize: 11 }} />}
                                {hvl && <ReferenceLine x={hvl} stroke="#E0E7FF" strokeDasharray="3 3" label={{ position: 'top', value: 'HVL (Zero Gamma)', fill: '#E0E7FF', fontSize: 11 }} />}
                                {res && <ReferenceLine x={res} stroke="#EF4444" strokeDasharray="3 3" label={{ position: 'insideTopRight', value: 'Call Resistance', fill: '#EF4444', fontSize: 11 }} />}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* TOP FLOW BLOCKS */}
                <div className="g-col-full" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem' }}>
                    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
                        <h3 className="card-title">Top 5 Buyer Flows</h3>
                        <div className="chart-container" style={{ flexGrow: 1, minHeight: '250px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={buyFlowData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.05)" />
                                    <XAxis dataKey="strike" stroke="#94A3B8" />
                                    <YAxis stroke="#94A3B8" />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                    <Bar dataKey="net_flow" name="Net Flow" fill="#10B981" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
                        <h3 className="card-title">Top 5 Seller Flows</h3>
                        <div className="chart-container" style={{ flexGrow: 1, minHeight: '250px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sellFlowData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.05)" />
                                    <XAxis dataKey="strike" stroke="#94A3B8" />
                                    <YAxis stroke="#94A3B8" />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                    <Bar dataKey="net_flow" name="Net Flow" fill="#EF4444" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* VOL SURFACES */}
                <div className="glass-card g-col-full">
                    <h3 className="card-title">Volatility Surface By Strike</h3>
                    <div className="chart-container" style={{ height: 350 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={ivData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.05)" />
                                <XAxis dataKey="strike" stroke="#94A3B8" />
                                <YAxis stroke="#94A3B8" domain={['auto', 'auto']} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} onMouseEnter={handleLegendMouseEnter} onMouseLeave={handleLegendMouseLeave} />
                                <Line type="monotone" dataKey="call_iv" stroke="#10B981" name="Call IV" strokeWidth={2} dot={false} strokeOpacity={hoveredLegend === 'call_iv' || !hoveredLegend ? 1 : 0.3} />
                                <Line type="monotone" dataKey="put_iv" stroke="#EF4444" name="Put IV" strokeWidth={2} strokeDasharray="5 5" dot={false} strokeOpacity={hoveredLegend === 'put_iv' || !hoveredLegend ? 1 : 0.3} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* MARKET-WIDE SECTION */}
                {globalData.market_total_net_gex && (
                    <div className="glass-card g-col-full" style={{ background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.8) 0%, rgba(11, 19, 43, 0.9) 100%)', border: '1px solid rgba(212, 175, 55, 0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                            <div>
                                <h3 className="card-title" style={{ margin: 0, border: 'none', color: '#D4AF37' }}>MARKET-WIDE GEX/DEX LEVELS</h3>
                                <p className="mono" style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '0.25rem' }}>(All Expirations Aggregated)</p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            {/* Key Levels */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ color: '#E0E7FF', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', borderBottom: '1px dotted rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>KEY AGGREGATED LEVELS</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#94A3B8' }}>Agg. Call Resistance:</span>
                                    <span className="mono" style={{ color: '#EF4444' }}>${Number(globalData.market_gex_call_res).toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#94A3B8' }}>Agg. Put Support:</span>
                                    <span className="mono" style={{ color: '#10B981' }}>${Number(globalData.market_gex_put_sup).toLocaleString()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#94A3B8' }}>Market HVL (Zero Gamma):</span>
                                    <span className="mono" style={{ color: '#E0E7FF' }}>${Number(globalData.market_hvl_zero_gamma).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Totals & Environments */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ color: '#E0E7FF', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', borderBottom: '1px dotted rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>OVERALL POSITIONING</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#94A3B8' }}>Total Net GEX:</span>
                                    <span className={`mono ${globalData.market_total_net_gex > 0 ? 'text-bullish' : 'text-bearish'}`}>{(globalData.market_total_net_gex > 0 ? '+' : '')}{Number(globalData.market_total_net_gex).toLocaleString()} USD</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#94A3B8' }}>Total Net DEX:</span>
                                    <span className={`mono ${globalData.market_total_net_dex > 0 ? 'text-bullish' : 'text-bearish'}`}>{(globalData.market_total_net_dex > 0 ? '+' : '')}{Number(globalData.market_total_net_dex).toLocaleString()} BTC</span>
                                </div>

                                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#94A3B8' }}>
                                    <div style={{ marginBottom: '0.25rem' }}><strong style={{ color: '#E0E7FF' }}>GEX Env:</strong> {globalData.market_gex_env}</div>
                                    <div><strong style={{ color: '#E0E7FF' }}>DEX Env:</strong> {globalData.market_dex_env}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* LARGE OI CHANGES AND MARKET METRICS COMBO */}
                <div className="g-col-full" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 6fr) minmax(0, 3fr) minmax(0, 3fr)', gap: '1.5rem', marginTop: '2rem', alignItems: 'stretch' }}>

                    {/* 6 Columns: Large OI Changes */}
                    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
                        <h3 className="card-title">Large OI Changes (Day-over-Day)</h3>
                        <div style={{ overflowX: 'auto', marginTop: '1rem', flexGrow: 1 }}>
                            {largeOiChanges.length > 0 ? (
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(212,175,55,0.2)', color: '#94A3B8' }}>
                                            <th style={{ padding: '0.75rem' }}>Strike</th>
                                            <th style={{ padding: '0.75rem' }}>Type</th>
                                            <th style={{ padding: '0.75rem' }}>Prev OI</th>
                                            <th style={{ padding: '0.75rem' }}>Curr OI</th>
                                            <th style={{ padding: '0.75rem' }}>Change</th>
                                            <th style={{ padding: '0.75rem' }}>%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {largeOiChanges.map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '0.75rem' }}>${item.strike.toLocaleString()}</td>
                                                <td style={{ padding: '0.75rem', color: item.type === 'Call' ? '#10B981' : '#EF4444' }}>{item.type}</td>
                                                <td style={{ padding: '0.75rem' }}>{item.prev_oi.toLocaleString()}</td>
                                                <td style={{ padding: '0.75rem' }}>{item.curr_oi.toLocaleString()}</td>
                                                <td style={{ padding: '0.75rem', color: item.change > 0 ? '#10B981' : '#EF4444' }}>{item.change > 0 ? '+' : ''}{item.change.toLocaleString()}</td>
                                                <td style={{ padding: '0.75rem', color: item.change_pct.includes('+') ? '#10B981' : '#EF4444' }}>{item.change_pct}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <span style={{ color: '#94A3B8', fontStyle: 'italic', display: 'block' }}>No large OI changes detected.</span>
                            )}
                        </div>
                    </div>

                    {/* 3 Columns: Block Trades */}
                    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
                        <h3 className="card-title">Block Trades (Recent)</h3>
                        <div style={{ flexGrow: 1, overflowY: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}>
                            {(globalData.block_trades || []).slice(0, 7).map((bt, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '6px 0' }}>
                                    <span style={{ color: bt.dir === 'buy' ? '#10B981' : '#EF4444', fontWeight: 600 }}>{bt.dir.toUpperCase()} {bt.size}</span>
                                    <span style={{ color: '#E0E7FF' }}>{bt.instrument}</span>
                                </div>
                            ))}
                            {(!globalData.block_trades || globalData.block_trades.length === 0) && <span style={{ color: '#94A3B8', fontStyle: 'italic', display: 'block', marginTop: '0.5rem' }}>No recent blocks tracked.</span>}
                        </div>
                    </div>

                    {/* 3 Columns: VRP & Perp vertically stacked */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', minWidth: 0 }}>
                        <div className="glass-card metric-box" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.25rem' }}>
                            <span className="card-title" style={{ paddingBottom: '0.25rem' }}>Volatility Risk Premium</span>
                            <span className="box-value mono" style={{ fontSize: '1.25rem' }}>{globalData.vrp_details || '--'}</span>
                        </div>
                        <div className="glass-card metric-box" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.25rem' }}>
                            <span className="card-title" style={{ paddingBottom: '0.25rem' }}>Perpetual Funding & OI</span>
                            <span className="box-value mono" style={{ fontSize: '1.1rem' }}>{globalData.perp_oi_details || '--'}</span>
                            <span className="box-value mono" style={{ fontSize: '1.1rem' }}>{globalData.perp_funding_details || '--'}</span>
                        </div>
                    </div>

                </div>
            </div>
        </div >
    );
};

export default Analysis;
