import os
import json
import sys
import threading
from datetime import datetime
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from zoneinfo import ZoneInfo

from fetch_predictions import main as update_predictions, write_offline_snapshot


class QuietDisconnectHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.rstrip('/') == '/health':
            body = b'{"status":"ok"}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, format, *args):
        if self.path.rstrip('/') == '/health':
            return
        super().log_message(format, *args)

    def handle_error(self, request, client_address):
        error = sys.exc_info()[1]
        if isinstance(error, (ConnectionResetError, BrokenPipeError)):
            return
        super().handle_error(request, client_address)


def clear_previous_day_data():
    today = datetime.now(ZoneInfo("America/Lima")).date().isoformat()
    data_dir = os.path.join(os.getcwd(), "data")
    for filename in ("predictions_today.json", "predictions.json"):
        path = os.path.join(data_dir, filename)
        try:
            with open(path, "r", encoding="utf-8") as data_file:
                data = json.load(data_file)
        except (OSError, json.JSONDecodeError):
            data = {}
        if data.get("date") != today:
            data = {"date": today, "matches": []}
            with open(path, "w", encoding="utf-8") as data_file:
                json.dump(data, data_file)
        if filename == "predictions_today.json":
            write_offline_snapshot(data)


def update_until_complete():
    while True:
        try:
            has_more = update_predictions()
        except Exception as error:
            print(f"Actualizador detenido: {error}", flush=True)
            return
        if not has_more:
            print("No quedan partidos nuevos de Champions League ni Europa League para consultar hoy.", flush=True)
            return
        # API calls inside the updater are spaced 6.2 seconds apart. The next
        # cycle begins immediately, keeping the rolling rate below 10/minute.


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    clear_previous_day_data()
    server = ThreadingHTTPServer(("127.0.0.1", 8000), QuietDisconnectHandler)
    threading.Thread(target=update_until_complete, daemon=True).start()
    print("Dashboard: http://127.0.0.1:8000 (Ctrl+C para detener)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    finally:
        server.server_close()
