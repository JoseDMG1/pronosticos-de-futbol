import os
import json
import requests
from datetime import datetime, timedelta
import shutil
import time
import tempfile
from zoneinfo import ZoneInfo

API_KEY = os.environ.get('API_FOOTBALL_KEY')
API_URL = "https://v3.football.api-sports.io"
LIMA = ZoneInfo("America/Lima")
MAX_REQUESTS_PER_DAY = 100
MAX_PREDICTION_ATTEMPTS = 9
# Free API-Football plan: 10 requests/minute. Keep a margin below that ceiling.
MIN_REQUEST_INTERVAL_SECONDS = 6.2
USAGE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', '.api_usage.json')
ATTEMPTED_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', '.api_attempted.json')
OFFLINE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'offline-predictions.js')

def atomic_write(path, text):
    fd, temporary = tempfile.mkstemp(dir=os.path.dirname(path), suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as output:
            output.write(text)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

FORECAST_FIELDS = ('short_tip', 'advice', 'prediction_1x2', 'prediction_gg',
                   'prediction_ou', 'percent_home', 'percent_draw', 'percent_away',
                   'fetched_at', 'prediction_source', 'prediction_available')

def restore_forecasts(date_str, existing, output_file):
    archive_dir = os.path.join(os.path.dirname(output_file), 'forecast_archive')
    os.makedirs(archive_dir, exist_ok=True)
    archive_path = os.path.join(archive_dir, date_str + '.json')
    try:
        with open(archive_path, encoding='utf-8') as saved:
            archive = json.load(saved)
    except FileNotFoundError:
        archive = {}
    for fixture_id, match in existing.items():
        if fixture_id in archive:
            # Keep the first recorded forecast; only match status/score may change.
            match.update({key: archive[fixture_id][key] for key in FORECAST_FIELDS
                          if key in archive[fixture_id]})
        elif match.get('prediction_available') is not False and match.get('short_tip'):
            archive[fixture_id] = dict(match)
            archive[fixture_id]['prediction_available'] = True
    atomic_write(archive_path, json.dumps(archive, indent=4, ensure_ascii=False))

def persist_matches(date_str, existing, output_file):
    restore_forecasts(date_str, existing, output_file)
    snapshot = {'date': date_str, 'updated_at': datetime.now(LIMA).isoformat(),
                'matches': list(existing.values())}
    serialized = json.dumps(snapshot, indent=4, ensure_ascii=False)
    atomic_write(output_file, serialized)
    atomic_write(os.path.join(os.path.dirname(output_file), 'predictions.json'), serialized)
    write_offline_snapshot(snapshot)

def write_offline_snapshot(data):
    serialized = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')
    atomic_write(OFFLINE_FILE, f'window.OFFLINE_PREDICTIONS = {serialized};\n')

def load_usage():
    try:
        with open(USAGE_FILE, 'r', encoding='utf-8') as usage_file:
            usage = json.load(usage_file)
    except (OSError, json.JSONDecodeError):
        usage = {}
    today = datetime.now(LIMA).date().isoformat()
    if usage.get('date') != today:
        usage = {'date': today, 'refreshes': 0, 'requests': 0}
    return usage

def save_usage(usage):
    with open(USAGE_FILE, 'w', encoding='utf-8') as usage_file:
        json.dump(usage, usage_file, indent=2)

def load_attempted(date_str):
    try:
        with open(ATTEMPTED_FILE, 'r', encoding='utf-8') as state_file:
            state = json.load(state_file)
    except (OSError, json.JSONDecodeError):
        state = {}
    return set(state.get(date_str, []))

def save_attempted(date_str, attempted):
    try:
        with open(ATTEMPTED_FILE, 'r', encoding='utf-8') as state_file:
            state = json.load(state_file)
    except (OSError, json.JSONDecodeError):
        state = {}
    state[date_str] = sorted(attempted)
    with open(ATTEMPTED_FILE, 'w', encoding='utf-8') as state_file:
        json.dump(state, state_file, indent=2)

def fetch_api(endpoint, params):
    if not API_KEY:
        raise RuntimeError('Define API_FOOTBALL_KEY antes de iniciar el actualizador.')
    headers = {'x-apisports-key': API_KEY}
    usage = load_usage()
    if usage['requests'] >= MAX_REQUESTS_PER_DAY:
        raise RuntimeError(f"Límite local de {MAX_REQUESTS_PER_DAY} solicitudes API alcanzado hoy.")
    usage['requests'] += 1
    save_usage(usage)
    time.sleep(MIN_REQUEST_INTERVAL_SECONDS)
    response = requests.get(f"{API_URL}/{endpoint}", headers=headers, params=params, timeout=20)
    if response.status_code == 429:
        remaining = response.headers.get('x-ratelimit-requests-remaining', 'desconocido')
        minute_remaining = response.headers.get('X-RateLimit-Remaining', 'desconocido')
        raise RuntimeError(
            'API-Football respondió HTTP 429 (límite de solicitudes). '
            f'Restantes diarios reportados: {remaining}; restantes por minuto: {minute_remaining}. '
            'Espera a que se restablezca el límite indicado antes de volver a iniciar.'
        )
    response.raise_for_status()
    data = response.json()
    if data.get('errors'):
        raise RuntimeError(f"API-Football devolvió un error en {endpoint}: {data['errors']}")
    return data.get('response', [])

def get_fixtures_for_date(date_str):
    fixtures = fetch_api("fixtures", {"date": date_str, "timezone": "America/Lima"})
    if not fixtures: return []
    # Limit to 10 fixtures per day to save API limits
    return fixtures

def get_prediction(fixture_id):
    preds = fetch_api("predictions", {"fixture": fixture_id})
    if preds and len(preds) > 0: return preds[0]
    return None

def generate_short_tip(win_percent):
    try:
        h = float(str(win_percent.get('home', '33%')).replace('%',''))
        d = float(str(win_percent.get('draw', '33%')).replace('%',''))
        a = float(str(win_percent.get('away', '33%')).replace('%',''))
        
        if h >= 50: return "1"
        if a >= 50: return "2"
        if h > 40 and d > 30: return "1X"
        if a > 40 and d > 30: return "X2"
        if d >= 40: return "X"
        if h > a: return "1X"
        return "X2"
    except:
        return "1X2"

def process_day(date_obj, filename, data_dir):
    date_str = date_obj.strftime('%Y-%m-%d')
    fixtures = get_fixtures_for_date(date_str)
    target_leagues = {'uefa champions league', 'uefa europa league'}
    fixtures = [fixture for fixture in fixtures
                if fixture.get('league', {}).get('name', '').strip().casefold() in target_leagues]
    output_file = os.path.join(data_dir, filename)
    try:
        with open(output_file, 'r', encoding='utf-8') as saved_file:
            saved_data = json.load(saved_file)
    except (OSError, json.JSONDecodeError):
        saved_data = {'date': date_str, 'matches': []}
    if saved_data.get('date') != date_str:
        saved_data = {'date': date_str, 'matches': []}
    existing = {str(m['fixture_id']): m for m in saved_data.get('matches', [])}
    queryable = {str(f['fixture']['id']): f for f in fixtures
                if f.get('fixture', {}).get('status', {}).get('short') in {'NS', '1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'}}
    finished_codes = {'FT', 'AET', 'PEN'}
    eligible = {**queryable, **{str(f['fixture']['id']): f for f in fixtures
                if f.get('fixture', {}).get('status', {}).get('short') in finished_codes}}
    # A fixture is displayable even when its prediction was lost or unavailable.
    for fixture_id, fixture in eligible.items():
        if fixture_id not in existing:
            existing[fixture_id] = {
                'fixture_id': fixture['fixture']['id'], 'date': fixture['fixture']['date'],
                'league': fixture['league']['name'],
                'home_team': fixture['teams']['home']['name'],
                'away_team': fixture['teams']['away']['name'],
                'home_logo': fixture['teams']['home'].get('logo', ''),
                'away_logo': fixture['teams']['away'].get('logo', ''),
                'prediction_available': False, 'short_tip': None,
                'advice': 'No hay un pronóstico guardado para este partido.',
                'percent_home': None, 'percent_draw': None, 'percent_away': None,
                'odds': None,
            }
    # Refresh saved statuses and scores while retaining the day's finished matches.
    restore_forecasts(date_str, existing, output_file)
    for fixture_id in list(existing):
        current = next((f for f in fixtures if str(f.get('fixture', {}).get('id')) == fixture_id), None)
        if current is None:
            continue
        if fixture_id not in eligible:
            existing.pop(fixture_id, None)
        else:
            code = current['fixture']['status']['short']
            existing[fixture_id]['status_short'] = code
            existing[fixture_id]['status'] = 'Finished' if code in finished_codes else 'Pending' if code == 'NS' else 'In Play'
            if code in finished_codes:
                existing[fixture_id]['home_goals'] = current.get('goals', {}).get('home')
                existing[fixture_id]['away_goals'] = current.get('goals', {}).get('away')
                existing[fixture_id].pop('correct_1x2', None)
    persist_matches(date_str, existing, output_file)
    attempted = load_attempted(date_str)
    attempts_this_cycle = 0
    for f in fixtures:
        status_short = f.get('fixture', {}).get('status', {}).get('short')
        if status_short not in {'NS', '1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'}:
            continue
        fix_id = f['fixture']['id']
        if str(fix_id) in attempted or attempts_this_cycle >= MAX_PREDICTION_ATTEMPTS:
            continue
        if load_usage()['requests'] >= MAX_REQUESTS_PER_DAY:
            break
        print(f"Fetching {f['league']['name']} prediction for {fix_id} on {date_str}...")
        pred_data = get_prediction(fix_id)
        attempts_this_cycle += 1
        if not pred_data:
            attempted.add(str(fix_id))
            save_attempted(date_str, attempted)
            continue
            
        win_percent = pred_data['predictions']['percent']
        advice = pred_data['predictions']['advice']
        
        home_goals_pred = pred_data['predictions']['goals']['home']
        away_goals_pred = pred_data['predictions']['goals']['away']
        home_g = float(str(home_goals_pred).replace('-','0') if home_goals_pred else 0)
        away_g = float(str(away_goals_pred).replace('-','0') if away_goals_pred else 0)
        
        status_short = f['fixture']['status']['short']
        is_finished = status_short in ['FT', 'AET', 'PEN']
        home_goals = f['goals']['home']
        away_goals = f['goals']['away']
        
        correct_1x2 = False
        if is_finished and home_goals is not None and away_goals is not None:
            actual_1x2 = "1" if home_goals > away_goals else "2" if away_goals > home_goals else "X"
            short_tip = generate_short_tip(win_percent)
            correct_1x2 = actual_1x2 in short_tip

        existing[str(fix_id)] = {
            "prediction_available": True,
            "fixture_id": fix_id,
            "date": f['fixture']['date'],
            "league": f['league']['name'],
            "home_team": f['teams']['home']['name'],
            "home_logo": f['teams']['home']['logo'],
            "away_team": f['teams']['away']['name'],
            "away_logo": f['teams']['away']['logo'],
            "prediction_1x2": pred_data['predictions']['winner']['comment'],
            "short_tip": generate_short_tip(win_percent),
            "percent_home": win_percent.get('home', '33%'),
            "percent_draw": win_percent.get('draw', '33%'),
            "percent_away": win_percent.get('away', '33%'),
            "prediction_gg": "GG" if home_goals_pred and away_goals_pred and str(home_goals_pred) != "0" and str(away_goals_pred) != "0" else "NG",
            "prediction_ou": "Over 2.5" if home_g + away_g > 2.5 else "Under 2.5",
            "advice": advice,
            "odds": None,
            "status": "Pending" if status_short == 'NS' else "In Play",
            "status_short": status_short,
            "fetched_at": datetime.now().astimezone().isoformat(),
            "prediction_source": "API-Football",
            "home_goals": home_goals if is_finished else None,
            "away_goals": away_goals if is_finished else None,
            "correct_1x2": correct_1x2
        }
        persist_matches(date_str, existing, output_file)
        attempted.add(str(fix_id))
        save_attempted(date_str, attempted)
        
    predictions = list(existing.values())
    persist_matches(date_str, existing, output_file)
    print(f"Saved {len(predictions)} current UCL/UEL predictions to {output_file}")
    return (load_usage()['requests'] < MAX_REQUESTS_PER_DAY and bool(queryable)
            and any(str(f['fixture']['id']) not in attempted for f in queryable.values()))

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, '..', 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    usage = load_usage()
    if usage['requests'] >= MAX_REQUESTS_PER_DAY:
        raise RuntimeError('Se agotó el presupuesto local de 100 solicitudes diarias.')
    today = datetime.now(LIMA)
    
    # Fetch today's UEFA Champions League and UEFA Europa League fixtures and predictions.
    more = process_day(today, 'predictions_today.json', data_dir)

    # We also keep predictions.json as an alias for today to not break backward compatibility
    return more

if __name__ == "__main__":
    try:
        main()
    except (requests.RequestException, RuntimeError) as error:
        print(f"No se completó la actualización: {error}")
        raise SystemExit(1)
