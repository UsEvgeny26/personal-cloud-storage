import sqlite3
import bcrypt

DB_NAME = "users.db"


def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    # Включаем WAL-режим для безопасного параллельного доступа нескольких инстансов
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def init_db():
    """Инициализация таблицы пользователей"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()


def hash_password(password: str) -> str:
    """Хеширование пароля с использованием bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hashed_password: str) -> bool:
    """Проверка совпадения пароля и хеша"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_user_by_username(username: str):
    """Получить пользователя из базы данных по логину"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()
    return user


def create_user(username: str, password: str, role: str = "user") -> bool:
    """Добавить нового пользователя в базу данных"""
    if get_user_by_username(username):
        return False

    pwd_hash = hash_password(password)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
        (username, pwd_hash, role)
    )
    conn.commit()
    conn.close()
    return True


# Автоматически создаём таблицу при импорте модуля
init_db()