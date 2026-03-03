import os
import re
import sys
import json
import threading
import webbrowser
from datetime import datetime
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(os.path.dirname(__file__))
    return os.path.join(base_path, relative_path)

# Point Flask to the built React directory
FRONTEND_FOLDER = resource_path(os.path.join('frontend', 'dist'))
app = Flask(__name__, static_folder=FRONTEND_FOLDER, static_url_path='')

# Enable CORS for the React development server bridging (optional for exe but good for dev)
CORS(app)

DATA_PATH = r"C:\Users\Nick\PycharmProjects\option_trading\output\data\onchain_analysis"

def get_latest_report_dir(asset):
    base_path = os.path.join(DATA_PATH, asset, "report")
    if not os.path.exists(base_path):
        return None
    dirs = [d for d in os.listdir(base_path) if os.path.isdir(os.path.join(base_path, d))]
    if not dirs:
        return None
    return os.path.join(base_path, sorted(dirs)[-1])

def clean_num(s):
    if not s: return None
    s = s.replace(',', '').replace('$', '').replace('%', '').replace('+', '').strip()
    try:
        if '.' in s: return float(s)
        return int(s)
    except:
        return s

def parse_report(filepath):
    """
    Advanced State Machine Parser to extract tables per expiry.
    """
    data = {
        "global": {},
        "expirations": []
    }
    
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    state = "GLOBAL"
    current_expiry = None
    
    table_parser_state = None
    
    for line in lines:
        line_s = line.strip()
        
        # --- GLOBAL METRICS ---
        if state == "GLOBAL":
            if line_s.startswith("Current Underlying Price:"):
                data["global"]["underlying_price"] = clean_num(line_s.split("$")[1])
            elif "DVOL (Volatility Index):" in line_s:
                data["global"]["dvol"] = clean_num(line_s.split(":")[1])
            elif "IV Percentile" in line_s:
                try: data["global"]["iv_percentile"] = clean_num(line_s.split(":")[1])
                except: pass
            elif "Current Funding Rate:" in line_s:
                data["global"]["funding_rate"] = line_s.split("Current Funding Rate:")[1].split("(")[0].strip()
            elif "8h Funding Rate:" in line_s:
                data["global"]["funding_rate_8h"] = line_s.split("8h Funding Rate:")[1].strip()
            
            # Transition to expiry block
            elif line_s.startswith("EXPIRATION:"):
                state = "EXPIRATION"
                exp = line_s.split(":")[1].strip()
                current_expiry = {
                    "date": exp,
                    "metrics": {},
                    "strikes": [],
                    "gex_strikes": [],
                    "buy_flow": [],
                    "sell_flow": [],
                    "iv_surface": [],
                    "support_levels": [],
                    "resistance_levels": [],
                    "large_oi_changes": [],
                    "moneyness": {
                        "calls": {},
                        "puts": {},
                        "combined": {},
                        "skew": ""
                    }
                }
                data["expirations"].append(current_expiry)
                
        # --- PER EXPIRATION METRICS ---
        elif state == "EXPIRATION":
            # Check if starting next expiration
            if line_s.startswith("EXPIRATION:"):
                exp = line_s.split(":")[1].strip()
                current_expiry = {
                    "date": exp,
                    "metrics": {},
                    "strikes": [],
                    "gex_strikes": [],
                    "buy_flow": [],
                    "sell_flow": [],
                    "iv_surface": [],
                    "support_levels": [],
                    "resistance_levels": [],
                    "moneyness": {
                        "calls": {},
                        "puts": {},
                        "combined": {},
                        "skew": ""
                    }
                }
                data["expirations"].append(current_expiry)
                table_parser_state = None
                continue
                
            # Basic Metrics
            if line_s.startswith("Max Pain Strike:"):
                current_expiry["metrics"]["max_pain"] = clean_num(line_s.split("$")[1])
            elif line_s.startswith("Distance from Current:"):
                try: 
                    match = re.search(r"Distance from Current:\s*\$([+-]?)([\d.,]+)\s*\((.*?)\)", line_s)
                    if match:
                        sign = match.group(1)
                        val = clean_num(match.group(2))
                        if sign == '-' and val != 0:
                            current_expiry["metrics"]["max_pain_distance"] = -val
                        else:
                            current_expiry["metrics"]["max_pain_distance"] = val
                        current_expiry["metrics"]["max_pain_distance_pct"] = match.group(3).strip()
                    else:
                        m2 = re.search(r"Distance from Current:\s*\$([+-]?)([\d.,]+)", line_s)
                        if m2:
                            sign = m2.group(1)
                            val = clean_num(m2.group(2))
                            if sign == '-' and val != 0:
                                current_expiry["metrics"]["max_pain_distance"] = -val
                            else:
                                current_expiry["metrics"]["max_pain_distance"] = val
                except: pass
            
            # Put/Call Ratio (Open Interest)
            if line_s.startswith("Total Call OI:"):
                current_expiry["metrics"]["total_call_oi"] = clean_num(line_s.split(":")[1])
            elif line_s.startswith("Total Put OI:"):
                current_expiry["metrics"]["total_put_oi"] = clean_num(line_s.split(":")[1])
            elif line_s.startswith("P/C Ratio:"):
                 parts = line_s.split(":")
                 if len(parts) > 1:
                     val_sig = parts[1].split()
                     if len(val_sig) >= 2:
                         current_expiry["metrics"]["pc_ratio"] = clean_num(val_sig[0])
                         current_expiry["metrics"]["pc_signal"] = val_sig[1].strip("()")
                         
            # Volume Statistics
            if line_s.startswith("Total Call Volume:"):
                current_expiry["metrics"]["total_call_vol"] = clean_num(line_s.split(":")[1])
            elif line_s.startswith("Total Put Volume:"):
                current_expiry["metrics"]["total_put_vol"] = clean_num(line_s.split(":")[1])
            elif line_s.startswith("Total Volume:"):
                current_expiry["metrics"]["total_vol"] = clean_num(line_s.split(":")[1])
            elif line_s.startswith("Volume P/C Ratio:"):
                current_expiry["metrics"]["vol_pc_ratio"] = clean_num(line_s.split(":")[1])
            
            # GEX Key Levels summary
            if line_s.startswith("Call Resistance:"):
                m = re.search(r"\$([\d,]+)", line_s)
                if m: current_expiry["metrics"]["gex_call_res"] = clean_num(m.group(1))
            elif line_s.startswith("Put Support:"):
                m = re.search(r"\$([\d,]+)", line_s)
                if m: current_expiry["metrics"]["gex_put_sup"] = clean_num(m.group(1))
            elif line_s.startswith("HVL (Zero Gamma):"):
                m = re.search(r"\$([\d,]+)", line_s)
                if m: current_expiry["metrics"]["hvl_zero_gamma"] = clean_num(m.group(1))
            elif line_s.startswith("Total Net GEX:"):
                current_expiry["metrics"]["total_net_gex"] = clean_num(line_s.split(":")[1])
            elif line_s.startswith("Total Net DEX:"):
                current_expiry["metrics"]["total_net_dex"] = clean_num(line_s.split(":")[1])
                
            # Tables and Block parsing states
            if line_s.startswith("OI Skew:"):
                 current_expiry["moneyness"]["skew"] = line_s.split("OI Skew:")[1].strip()
            elif line_s == "CALLS:": table_parser_state = "CALLS_MONEYNESS"
            elif line_s == "PUTS:": table_parser_state = "PUTS_MONEYNESS"
            elif line_s == "COMBINED TOTALS:": table_parser_state = "COMBINED_MONEYNESS"
            
            elif "OPEN INTEREST & VOLUME BY STRIKE" in line_s: table_parser_state = "OI_TABLE_WAIT"
            elif line_s.startswith("RESISTANCE (Top 3"): table_parser_state = "RESISTANCE_ACTIVE"
            elif line_s.startswith("SUPPORT (Top 3"): table_parser_state = "SUPPORT_ACTIVE"
            elif "GEX/DEX BY STRIKE:" in line_s: table_parser_state = "GEX_TABLE_WAIT"
            elif "TOP 5 STRIKES BY BUYING PRESSURE:" in line_s: table_parser_state = "BUY_FLOW_WAIT"
            elif "TOP 5 STRIKES BY SELLING PRESSURE:" in line_s: table_parser_state = "SELL_FLOW_WAIT"
            elif "IV BY STRIKE:" in line_s: table_parser_state = "IV_SURFACE_WAIT"
            elif "LARGE OI CHANGES" in line_s: table_parser_state = "LARGE_OI_CHANGE_WAIT"
            elif "MARKET-WIDE METRICS" in line_s: state = "MARKET_WIDE"
            
            if line_s.startswith("Bias:") and table_parser_state is None:
                current_expiry["metrics"]["bias"] = line_s.split("Bias:")[1].strip()
            elif line_s.startswith("Trend:") and table_parser_state is None:
                current_expiry["metrics"]["trend"] = line_s.split("Trend:")[1].strip()
            
            # Pattern for Moneyness (handles ITM, OTM, Total)
            # format: ITM:       42 OI    Notional: $  2,635,087.73    ( 0.89%)
            def parse_moneyness_line(l):
                cat = l.split(":")[0].strip() # ITM, OTM, Total
                oi_match = re.search(r"([\d,]+)\s*OI", l)
                notional_match = re.search(r"Notional:\s*\$\s*([\d,.]+)", l)
                pct_match = re.search(r"\(\s*([.\d]+)%\)", l)
                res = {}
                if oi_match: res['oi'] = clean_num(oi_match.group(1))
                if notional_match: res['notional'] = clean_num(notional_match.group(1))
                if pct_match: res['pct'] = clean_num(pct_match.group(1))
                return cat, res

            if table_parser_state in ["CALLS_MONEYNESS", "PUTS_MONEYNESS", "COMBINED_MONEYNESS"]:
                if "ITM:" in line_s or "OTM:" in line_s or "Total:" in line_s:
                    cat, res = parse_moneyness_line(line_s)
                    if table_parser_state == "CALLS_MONEYNESS": current_expiry["moneyness"]["calls"][cat] = res
                    elif table_parser_state == "PUTS_MONEYNESS": current_expiry["moneyness"]["puts"][cat] = res
                    elif table_parser_state == "COMBINED_MONEYNESS": current_expiry["moneyness"]["combined"][cat] = res
                    
            elif table_parser_state == "OI_TABLE_WAIT":
                if "------" in line_s: table_parser_state = "OI_TABLE_ACTIVE"
            elif table_parser_state == "OI_TABLE_ACTIVE":
                if not line_s: 
                    table_parser_state = None
                else:
                    parts = line_s.split()
                    if len(parts) >= 5:
                        try:
                            strike_val = clean_num(parts[0])
                            if isinstance(strike_val, (int, float)):
                                row = {
                                    "strike": strike_val,
                                    "call_oi": clean_num(parts[1]),
                                    "put_oi": clean_num(parts[2]),
                                    "call_vol": clean_num(parts[3]),
                                    "put_vol": clean_num(parts[4])
                                }
                                # Check for notes
                                if len(parts) > 5:
                                    row["notes"] = " ".join(parts[5:])
                                current_expiry["strikes"].append(row)
                        except: pass
                        
            elif table_parser_state == "RESISTANCE_ACTIVE":
                if not line_s: table_parser_state = None
                elif line_s.startswith("SUPPORT (Top 3"): table_parser_state = "SUPPORT_ACTIVE"
                else:
                    m = re.search(r"\$([\d,]+)", line_s)
                    if m: current_expiry["resistance_levels"].append(clean_num(m.group(1)))
            elif table_parser_state == "SUPPORT_ACTIVE":
                if not line_s: table_parser_state = None
                elif line_s.startswith("SHORT-TERM LEVELS"): table_parser_state = None
                else:
                    m = re.search(r"\$([\d,]+)", line_s)
                    if m: current_expiry["support_levels"].append(clean_num(m.group(1)))
            
            elif table_parser_state == "GEX_TABLE_WAIT":
                if "------" in line_s: table_parser_state = "GEX_TABLE_ACTIVE"
            elif table_parser_state == "GEX_TABLE_ACTIVE":
                 if not line_s: 
                    table_parser_state = None
                 else:
                    parts = line_s.split()
                    if len(parts) >= 3:
                        try:
                            strike_val = clean_num(parts[0])
                            if isinstance(strike_val, (int, float)):
                                current_expiry["gex_strikes"].append({
                                    "strike": strike_val,
                                    "net_gex": clean_num(parts[1]),
                                    "net_dex": clean_num(parts[2])
                                })
                        except: pass
            
            elif table_parser_state == "BUY_FLOW_WAIT":
                if "------" in line_s: table_parser_state = "BUY_FLOW_ACTIVE"
            elif table_parser_state == "BUY_FLOW_ACTIVE":
                 if not line_s: 
                    table_parser_state = None
                 else:
                    parts = line_s.split()
                    if len(parts) >= 4:
                        try:
                            strike_val = clean_num(parts[0])
                            if isinstance(strike_val, (int, float)):
                                current_expiry["buy_flow"].append({
                                    "strike": strike_val,
                                    "type": parts[1],
                                    "net_flow": clean_num(parts[2]),
                                    "vol": clean_num(parts[3])
                                })
                        except: pass
            
            elif table_parser_state == "SELL_FLOW_WAIT":
                if "------" in line_s: table_parser_state = "SELL_FLOW_ACTIVE"
            elif table_parser_state == "SELL_FLOW_ACTIVE":
                 if not line_s: 
                    table_parser_state = None
                 else:
                    parts = line_s.split()
                    if len(parts) >= 4:
                        try:
                            strike_val = clean_num(parts[0])
                            if isinstance(strike_val, (int, float)):
                                current_expiry["sell_flow"].append({
                                    "strike": strike_val,
                                    "type": parts[1],
                                    "net_flow": clean_num(parts[2]),
                                    "vol": clean_num(parts[3])
                                })
                        except: pass
            
            elif table_parser_state == "IV_SURFACE_WAIT":
                if "------" in line_s: table_parser_state = "IV_SURFACE_ACTIVE"
            elif table_parser_state == "IV_SURFACE_ACTIVE":
                 if not line_s or line_s.startswith("P/C RATIO"): 
                    table_parser_state = None
                 else:
                    parts = line_s.split()
                    if len(parts) >= 3:
                        try:
                            strike_val = clean_num(parts[0])
                            if isinstance(strike_val, (int, float)):
                                current_expiry["iv_surface"].append({
                                    "strike": strike_val,
                                    "call_iv": clean_num(parts[1]),
                                    "put_iv": clean_num(parts[2])
                                })
                        except: pass
            
            elif table_parser_state == "LARGE_OI_CHANGE_WAIT":
                if "------" in line_s: table_parser_state = "LARGE_OI_CHANGE_ACTIVE"
            elif table_parser_state == "LARGE_OI_CHANGE_ACTIVE":
                 if not line_s or line_s.startswith("IV PERCENTILE"): 
                    table_parser_state = None
                 else:
                    parts = line_s.split()
                    if len(parts) >= 6:
                        try:
                            strike_val = clean_num(parts[0])
                            if isinstance(strike_val, (int, float)):
                                current_expiry.setdefault("large_oi_changes", []).append({
                                    "strike": strike_val,
                                    "type": parts[1],
                                    "prev_oi": clean_num(parts[2]),
                                    "curr_oi": clean_num(parts[3]),
                                    "change": clean_num(parts[4]),
                                    "change_pct": parts[5]
                                })
                        except: pass
                        
        # --- MARKET WIDE METRICS ---
        elif state == "MARKET_WIDE":
            if "VRP:" in line_s and ("CHEAP" in line_s or "EXPENSIVE" in line_s or "FAIR" in line_s):
                data["global"]["vrp_details"] = line_s.strip()
            elif "Perp OI:" in line_s:
                data["global"]["perp_oi_details"] = line_s.strip()
            elif "8h Funding:" in line_s and not "8h Funding Rate" in line_s:
                data["global"]["perp_funding_details"] = line_s.strip()
            elif table_parser_state == "BLOCK_TRADES_WAIT" or "BLOCK TRADES" in line_s:
                table_parser_state = "BLOCK_TRADES_WAIT"
                if "------" in line_s: table_parser_state = "BLOCK_TRADES_ACTIVE"
            elif table_parser_state == "BLOCK_TRADES_ACTIVE":
                 if not line_s or "CROSS-ASSET" in line_s or "=====" in line_s:
                     table_parser_state = None
                 else:
                     parts = line_s.split()
                     if len(parts) >= 6:
                         data["global"].setdefault("block_trades", []).append({
                             "time": parts[0],
                             "instrument": parts[1],
                             "size": parts[2],
                             "dir": parts[3],
                             "notional": clean_num(parts[5]) if len(parts) > 5 else None,
                             "iv": parts[-1]
                         })

    # Sort expirations by date
    def parse_date(date_str):
        try:
            return datetime.strptime(date_str, "%d%b%y")
        except:
            return datetime.max
    
    data["expirations"] = sorted(data["expirations"], key=lambda x: parse_date(x['date']))

    return data

def parse_synthesis(filepath):
    data = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    regime_m = re.search(r"Regime:\s*([^\|\n]+)", content)
    if regime_m: data['regime'] = regime_m.group(1).strip()

    dir_m = re.search(r"Direction:\s*([^\|\n]+)", content)
    if dir_m: data['direction'] = dir_m.group(1).strip()

    vol_m = re.search(r"Vol:\s*([^\|\n]+)", content)
    if vol_m: data['volatility'] = vol_m.group(1).strip()
    
    vrp_m = re.search(r"VRP:\s*([^\|\n]+)", content)
    if vrp_m: data['vrp'] = vrp_m.group(1).strip()

    near_m = re.search(r"NEAR-TERM[^:]*:\s*([A-Z]+) bias", content)
    if near_m: data['near_term_bias'] = near_m.group(1).strip()
    
    far_m = re.search(r"FAR-TERM[^:]*:\s*([A-Z]+) bias", content)
    if far_m: data['far_term_bias'] = far_m.group(1).strip()
    
    mid_m = re.search(r"MID-TERM[^:]*:\s*([A-Z]+) bias", content)
    if mid_m: data['mid_term_bias'] = mid_m.group(1).strip()

    # Vol Assessment
    vol_ass_m = re.search(r"VOL ASSESSMENT:\s*(.*?)(?=\n\n|\n[A-Z]+)", content, re.DOTALL)
    if vol_ass_m: data['vol_assessment'] = vol_ass_m.group(1).strip().replace('\n', ' ')

    # Risk Factors
    rf_m = re.search(r"RISK FACTORS:\s*(.*?)(?=\n\n|\n[A-Z]+)", content, re.DOTALL)
    if rf_m: data['risk_factors'] = rf_m.group(1).strip().replace('\n', ' ')

    # Block Trades Extraction
    block_m = re.search(r"INSTITUTIONAL FLOW.*:\s*(.*)\n\s*Largest:\s*(.*)", content)
    if block_m:
        data['block_trades_summary'] = block_m.group(1).strip()
        data['block_trades_largest'] = block_m.group(2).strip()

    recommendation_m = re.search(r"TRADE RECOMMENDATIONS:\s*\n?PRIMARY — ([^\n]+)", content)
    if recommendation_m: data['primary_recommendation'] = recommendation_m.group(1).strip()

    return data

@app.route('/')
def serve_react_app():
    # Serve the index.html from the built React app
    if os.path.exists(os.path.join(FRONTEND_FOLDER, 'index.html')):
        return send_from_directory(FRONTEND_FOLDER, 'index.html')
    return "React frontend build not found. Please run 'npm run build' in the frontend directory.", 404

@app.route('/api/data')
def get_data():
    result = {}
    for asset in ["BTC", "ETH"]:
        latest_dir = get_latest_report_dir(asset)
        asset_data = {'asset': asset, 'timestamp': None}
        if latest_dir:
            asset_data['timestamp'] = os.path.basename(latest_dir)
            report_path = os.path.join(latest_dir, 'report.txt')
            synthesis_path = os.path.join(latest_dir, 'synthesis.txt')
            
            if os.path.exists(report_path):
                asset_data["report"] = parse_report(report_path)
            if os.path.exists(synthesis_path):
                asset_data["synthesis"] = parse_synthesis(synthesis_path)
        result[asset] = asset_data

    return jsonify(result)

def open_browser():
    webbrowser.open_new('http://127.0.0.1:5000/')

if __name__ == '__main__':
    # Launch browser after a short delay so Flask can start
    threading.Timer(1.25, open_browser).start()
    # Turn off debug mode for PyInstaller production safety
    app.run(debug=False, port=5000)
