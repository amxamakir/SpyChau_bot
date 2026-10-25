from __future__ import annotations

import hashlib
import hmac
import json
import os
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qsl, urlparse

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
DB_PATH = Path(os.getenv("SPYCHAU_DB_PATH", "./data/spy_chau.sqlite3"))
MAX_AGE = int(os.getenv("INIT_DATA_MAX_AGE_SECONDS", "86400"))


def connect_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript("""
    CREATE TABLE IF NOT EXISTS users (telegram_id TEXT PRIMARY KEY, username TEXT, first_name TEXT, language_code TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS connections (connection_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, enabled INTEGER NOT NULL, payload_json TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id TEXT NOT NULL, connection_id TEXT, chat_id TEXT, message_id TEXT, event_type TEXT NOT NULL, message_json TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS events_owner_created ON events(owner_id, id DESC);
    CREATE TABLE IF NOT EXISTS payments (charge_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, payload TEXT NOT NULL, currency TEXT NOT NULL, total_amount INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE);
    """)
    db.commit()
    return db


def validate_init_data(raw: str) -> dict:
    if not BOT_TOKEN:
        raise ValueError("Mini App authentication is not configured")
    values = dict(parse_qsl(raw, keep_blank_values=True))
    received = values.pop("hash", None)
    auth_date = int(values.get("auth_date", "0"))
    age = int(time.time()) - auth_date
    if not received or age < -60 or age > MAX_AGE:
        raise ValueError("Missing, expired, or invalid initData")
    check = "\n".join(f"{key}={value}" for key, value in sorted(values.items()))
    secret = hmac.new(BOT_TOKEN.encode(), b"WebAppData", hashlib.sha256).digest()
    expected = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received):
        raise ValueError("Invalid initData signature")
    user = json.loads(values.get("user", "{}"))
    if not user.get("id"):
        raise ValueError("Telegram user is missing")
    return user


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, data: dict):
        encoded = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", os.getenv("CORS_ORIGIN", "http://localhost:5173"))
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Telegram-Bot-Api-Secret-Token, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self):
        self._json(200, {"ok": True})

    def _read(self):
        return json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))) or b"{}")

    def _user(self):
        authorization = self.headers.get("Authorization", "")
        if not authorization.startswith("tma "):
            raise ValueError("Telegram initData required")
        return validate_init_data(authorization[4:])

    def do_GET(self):
        route = urlparse(self.path).path
        if route == "/health":
            return self._json(200, {"status": "ok", "service": "spychau-api", "version": "0.1.0"})
        if route not in ("/api/me", "/api/archive"):
            return self._json(404, {"error": "not found"})
        try:
            user = self._user(); owner = str(user["id"]); db = connect_db()
            db.execute("INSERT INTO users(telegram_id,username,first_name,language_code) VALUES(?,?,?,?) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username,first_name=excluded.first_name,language_code=excluded.language_code", (owner,user.get("username"),user.get("first_name"),user.get("language_code")))
            if route == "/api/archive":
                events = db.execute("""
                    WITH archive_events AS (
                      SELECT id, owner_id, chat_id, message_id, event_type
                      FROM events
                      WHERE owner_id=? AND (
                        event_type IN ('edited','deleted')
                        OR json_extract(message_json, '$.ephemeral_message_id') IS NOT NULL
                        OR json_extract(message_json, '$.receiver_user.id') IS NOT NULL
                        OR COALESCE(CAST(json_extract(message_json, '$.ttl_period') AS INTEGER), 0) > 0
                      )
                    ),
                    snapshot_ids AS (
                      SELECT (
                        SELECT previous.id FROM events previous
                        WHERE previous.owner_id=archive_events.owner_id
                          AND previous.chat_id=archive_events.chat_id
                          AND previous.message_id=archive_events.message_id
                          AND previous.id < archive_events.id
                          AND previous.event_type != 'deleted'
                        ORDER BY previous.id DESC LIMIT 1
                      ) AS id
                      FROM archive_events
                      WHERE event_type IN ('edited','deleted')
                    ),
                    selected_ids AS (
                      SELECT id FROM archive_events
                      UNION
                      SELECT id FROM snapshot_ids WHERE id IS NOT NULL
                    )
                    SELECT events.id, events.chat_id, events.message_id, events.event_type,
                           events.message_json, events.created_at
                    FROM events JOIN selected_ids ON selected_ids.id=events.id
                    ORDER BY events.id DESC
                """, (owner,)).fetchall()
                return self._json(200, {"events": [event_row(row) for row in events]})
            connections = db.execute("SELECT connection_id,enabled,updated_at FROM connections WHERE owner_id=?",(owner,)).fetchall()
            events = db.execute("SELECT id,chat_id,message_id,event_type,message_json,created_at FROM events WHERE owner_id=? ORDER BY id DESC LIMIT 25",(owner,)).fetchall()
            return self._json(200,{"user":user,"connections":[dict(r) for r in connections],"events":[event_row(r) for r in events]})
        except (ValueError, KeyError, json.JSONDecodeError) as error:
            return self._json(401,{"error":str(error)})

    def do_POST(self):
        route=urlparse(self.path).path
        try: body=self._read()
        except json.JSONDecodeError: return self._json(400,{"error":"invalid JSON"})
        if route=="/api/auth/telegram":
            try:
                user=validate_init_data(body.get("init_data","")); db=connect_db()
                db.execute("INSERT INTO users(telegram_id,username,first_name,language_code) VALUES(?,?,?,?) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username,first_name=excluded.first_name,language_code=excluded.language_code",(str(user["id"]),user.get("username"),user.get("first_name"),user.get("language_code"))); db.commit()
                return self._json(200,{"user":user,"authenticated":True})
            except (ValueError,KeyError,json.JSONDecodeError) as error: return self._json(401,{"error":str(error)})
        if route in ("/webhooks/telegram","/webhooks/telegram/payments"):
            supplied=self.headers.get("X-Telegram-Bot-Api-Secret-Token","")
            if not WEBHOOK_SECRET or not hmac.compare_digest(supplied,WEBHOOK_SECRET): return self._json(401,{"error":"invalid webhook secret"})
            return self._payment(body) if route.endswith("/payments") else self._business_update(body)
        return self._json(404,{"error":"not found"})

    def _business_update(self, update):
        db=connect_db(); connection=update.get("business_connection")
        if connection:
            user=connection.get("user",{}); owner=str(user.get("id",""))
            if owner:
                db.execute("INSERT INTO users(telegram_id,username,first_name,language_code) VALUES(?,?,?,?) ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username,first_name=excluded.first_name,language_code=excluded.language_code",(owner,user.get("username"),user.get("first_name"),user.get("language_code")))
                db.execute("INSERT INTO connections(connection_id,owner_id,enabled,payload_json) VALUES(?,?,?,?) ON CONFLICT(connection_id) DO UPDATE SET enabled=excluded.enabled,payload_json=excluded.payload_json,updated_at=CURRENT_TIMESTAMP",(connection["id"],owner,int(connection.get("is_enabled",False)),json.dumps(connection)))
            db.commit(); return self._json(200,{"ok":True})
        msg=update.get("business_message") or update.get("edited_business_message"); deleted=update.get("deleted_business_messages"); event=msg or deleted or {}
        connection_id=event.get("business_connection_id")
        if not connection_id: return self._json(200,{"ok":True,"ignored":True})
        row=db.execute("SELECT owner_id FROM connections WHERE connection_id=?",(connection_id,)).fetchone()
        if not row: return self._json(200,{"ok":True,"ignored":True})
        owner=row["owner_id"]
        if deleted:
            chat_id=deleted.get("chat",{}).get("id")
            for mid in deleted.get("message_ids",[]): insert_event(db,owner,connection_id,chat_id,mid,"deleted",deleted)
        elif msg:
            insert_event(db,owner,connection_id,msg.get("chat",{}).get("id"),msg.get("message_id"),"edited" if "edited_business_message" in update else "new",msg)
        return self._json(200,{"ok":True})

    def _payment(self, update):
        message=update.get("message",{}); payment=message.get("successful_payment")
        if not payment: return self._json(200,{"ok":True})
        if payment.get("currency")!="XTR" or not payment.get("telegram_payment_charge_id"):
            return self._json(400,{"error":"invalid Stars payment"})
        owner=str(message.get("from",{}).get("id",""))
        if owner:
            db=connect_db(); db.execute("INSERT OR IGNORE INTO payments(charge_id,owner_id,payload,currency,total_amount) VALUES(?,?,?,?,?)",(payment["telegram_payment_charge_id"],owner,payment.get("invoice_payload",""),payment["currency"],payment["total_amount"]));db.commit()
        return self._json(200,{"ok":True})

    def do_DELETE(self):
        if urlparse(self.path).path!="/api/me/data":return self._json(404,{"error":"not found"})
        try:
            user=self._user();db=connect_db();db.execute("DELETE FROM users WHERE telegram_id=?",(str(user["id"]),));db.commit();return self._json(200,{"deleted":True})
        except (ValueError,KeyError,json.JSONDecodeError) as error:return self._json(401,{"error":str(error)})

    def log_message(self, format, *args):
        print("%s - %s" % (self.address_string(), format % args))


def insert_event(db,owner,connection_id,chat_id,message_id,event_type,payload):
    db.execute("INSERT INTO events(owner_id,connection_id,chat_id,message_id,event_type,message_json) VALUES(?,?,?,?,?,?)",(owner,connection_id,str(chat_id or ""),str(message_id or ""),event_type,json.dumps(payload,ensure_ascii=False)));db.commit()

def event_row(row):
    item=dict(row);item["message"]=json.loads(item.pop("message_json"));return item

if __name__ == "__main__":
    host=os.getenv("HOST","127.0.0.1");port=int(os.getenv("PORT","8000"))
    server=ThreadingHTTPServer((host,port),Handler)
    print(f"SpyChau API listening on http://{host}:{port}")
    server.serve_forever()
