import os
import shutil
from datetime import datetime, timedelta
from typing import List
import mimetypes

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import jwt
from pydantic import BaseModel

from database import get_user_by_username, verify_password
from config import settings

# ==================== НАСТРОЙКИ И БЕЗОПАСНОСТЬ ====================

# 1. Абсолютный путь к ЗАКРЫТОЙ папке на компьютере
BASE_STORAGE_DIR = os.path.abspath("./private_storage")
CHUNK_TEMP_DIR = os.path.abspath("./private_temp_chunks")

os.makedirs(BASE_STORAGE_DIR, exist_ok=True)
CHUNK_TEMP_DIR = os.path.abspath("./private_temp_chunks")

app = FastAPI(title="Personal Cloud API")

# Разрешаем запросы с React-фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://195.112.114.234:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
def get_secure_path(relative_path: str = "") -> str:
    """
    Защита от Path Traversal.
    Гарантирует, что итоговый путь находится строго внутри BASE_STORAGE_DIR.
    """
    # Нормализуем путь и убираем начальные слэши
    clean_relative = os.path.normpath(relative_path).lstrip("/\\")
    if clean_relative in [".", ""]:
        full_path = BASE_STORAGE_DIR
    else:
        full_path = os.path.abspath(os.path.join(BASE_STORAGE_DIR, clean_relative))

    # Главная проверка: начинается ли итоговый путь с базового каталога
    if not full_path.startswith(BASE_STORAGE_DIR):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен: попытка выхода за пределы рабочей директории"
        )
    return full_path


def verify_token(request: Request) -> dict:
    """Проверка JWT-токена и возврат данных авторизованного пользователя"""
    token = request.cookies.get("access_token")

    # Если токена нет в Cookie, пробуем достать из заголовка Authorization
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Необходима авторизация"
        )

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str = payload.get("sub")

        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Недействительный токен"
            )

        # Проверяем, существует ли всё ещё пользователь в базе данных
        user = get_user_by_username(username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь не найден или удален"
            )

        # Возвращаем словарь с подробными данными о пользователе
        return {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"]
        }

    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Токен недействителен или просрочен"
        )

# ==================== СХЕМЫ ДАННЫХ ====================
class LoginRequest(BaseModel):
    username: str
    password: str

class CreateFolderRequest(BaseModel):
    path: str = ""
    folder_name: str

class ConflictCheckRequest(BaseModel):
    path: str = ""
    filenames: List[str]

class RenameRequest(BaseModel):
    old_path: str
    new_name: str

# ==================== ЭНДПОИНТЫ API ====================
@app.post("/api/auth/login")
def login(data: LoginRequest, response: Response):
    """Авторизация и установка JWT-токена в Secure HttpOnly Cookie."""
    # 1. Поиск пользователя в базе данных
    user = get_user_by_username(data.username)

    # 2. Проверка существования и совпадения пароля
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Неверный логин или пароль")

    # 3. Генерация токена с добавлением ID и роли пользователя
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    token_payload = {
        "sub": user["username"],
        "user_id": user["id"],
        "role": user["role"],
        "exp": expire
    }
    token = jwt.encode(token_payload, settings.secret_key, algorithm=settings.algorithm)

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False
    )
    return {
        "message": "Успешный вход",
        "username": user["username"],
        "role": user["role"]
    }

@app.post("/api/auth/logout")
def logout(response: Response):
    """Выход из системы."""
    response.delete_cookie("access_token")
    return {"message": "Успешный выход"}

@app.get("/api/files")
def list_files(
        path: str = "",
        page: int = 0,
        limit: int = 10,
        user: str = Depends(verify_token)):
    """Получение списка файлов и папок в директории."""
    target_dir = get_secure_path(path)

    if not os.path.exists(target_dir) or not os.path.isdir(target_dir):
        raise HTTPException(status_code=404, detail="Папка не найдена")

    all_entries = list(os.scandir(target_dir))
    all_entries.sort(key=lambda entry: (not entry.is_dir(), entry.name.lower()))

    total = len(all_entries)
    start = (page - 1) * limit
    end = start + limit
    page_entries = all_entries[start:end] if limit > 0 else all_entries

    items=[]
    for entry in page_entries:
        stat=entry.stat()
        items.append({
            "name": entry.name,
            "is_dir": entry.is_dir(),
            "size": stat.st_size if not entry.is_dir() else 0,
            "updated_at": datetime.fromtimestamp(stat.st_mtime).strftime("%d.%m.%Y %H:%M")
        })

    return {
        "current_path": path,
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "has_more": end < total
    }


@app.post("/api/upload/check-conflicts")
def check_conflicts(data: ConflictCheckRequest, user: dict = Depends(verify_token)):
    """Проверяет наличие файлов с такими же именами в целевой папке."""
    target_dir = get_secure_path(data.path)
    conflicts = []
    for fname in data.filenames:
        safe_fname = os.path.basename(fname)
        if os.path.exists(os.path.join(target_dir, safe_fname)):
            conflicts.append(safe_fname)
    return {"conflicts": conflicts}


@app.post("/api/upload/chunk")
async def upload_chunk(
        upload_id: str = Form(...),
        filename: str = Form(...),
        path: str = Form(""),
        chunk_index: int = Form(...),
        total_chunks: int = Form(...),
        conflict_action: str = Form("overwrite"),  # 'overwrite', 'rename', 'skip'
        file: UploadFile = File(...),
        user: dict = Depends(verify_token)
):
    """Принимает кусок (чанк) файла и собирает его при получении последнего кусочка."""
    target_dir = get_secure_path(path)
    safe_filename = os.path.basename(filename)

    upload_temp_dir = os.path.join(CHUNK_TEMP_DIR, upload_id)
    os.makedirs(upload_temp_dir, exist_ok=True)

    chunk_file_path = os.path.join(upload_temp_dir, f"chunk_{chunk_index}")
    with open(chunk_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    uploaded_chunks = os.listdir(upload_temp_dir)

    # Если загружены все чанки, собираем итоговый файл
    if len(uploaded_chunks) == total_chunks:
        final_filename = safe_filename

        if conflict_action == "rename":
            base, ext = os.path.splitext(safe_filename)
            counter = 1
            while os.path.exists(os.path.join(target_dir, final_filename)):
                final_filename = f"{base} ({counter}){ext}"
                counter += 1

        final_path = os.path.join(target_dir, final_filename)

        with open(final_path, "wb") as final_file:
            for i in range(total_chunks):
                c_path = os.path.join(upload_temp_dir, f"chunk_{i}")
                if os.path.exists(c_path):
                    with open(c_path, "rb") as c_file:
                        shutil.copyfileobj(c_file, final_file)

        shutil.rmtree(upload_temp_dir, ignore_errors=True)
        return {"status": "completed", "filename": final_filename}

    return {"status": "chunk_uploaded", "chunk_index": chunk_index}


@app.post("/api/folders")
def create_folder(data: CreateFolderRequest, user: str = Depends(verify_token)):
    """Создание новой папки."""
    parent_dir = get_secure_path(data.path)
    new_folder_path = os.path.join(parent_dir, data.folder_name)

    if os.path.exists(new_folder_path):
        raise HTTPException(status_code=400, detail="Папка с таким именем уже существует")

    os.makedirs(new_folder_path)
    return {"message": "Папка создана"}


# @app.post("/api/upload")
# def upload_files(
#         path: str = Form(""),
#         files: List[UploadFile] = File(...),
#         user: str = Depends(verify_token)
# ):
#     """Загрузка одного или нескольких файлов."""
#     target_dir = get_secure_path(path)
#
#     for file in files:
#         # Санитаризируем имя файла
#         safe_filename = os.path.basename(file.filename)
#         file_path = os.path.join(target_dir, safe_filename)
#
#         with open(file_path, "wb") as buffer:
#             shutil.copyfileobj(file.file, buffer)
#
#     return {"message": f"Успешно загружено файлов: {len(files)}"}


@app.get("/api/download")
def download_file(path: str, inline: bool = False, user: str = Depends(verify_token)):
    """Скачивание файла."""
    file_path = get_secure_path(path)

    if not os.path.exists(file_path) or os.path.isdir(file_path):
        raise HTTPException(status_code=404, detail="Файл не найден")

    # Автоматически определяем MIME-тип файла ( image/png, video/mp4, application/pdf и т.д. )
    media_type, _ = mimetypes.guess_type(file_path)
    if not media_type:
        media_type = 'application/octet-stream'

    # Если inline=True (режим предпросмотра), не передаем filename
    if inline:
        return FileResponse(
            path=file_path,
            media_type=media_type
        )

    # Стандартный режим скачивания (сохранение на диск)
    return FileResponse(
        path=file_path,
        filename=os.path.basename(file_path),
        media_type=media_type
    )


@app.delete("/api/items")
def delete_item(path: str, user: str = Depends(verify_token)):
    """Удаление файла или папки."""
    target_path = get_secure_path(path)

    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Объект не найден")

    if os.path.isdir(target_path):
        shutil.rmtree(target_path)
    else:
        os.remove(target_path)

    return {"message": "Успешно удалено"}


@app.post("/api/files/rename")
async def rename_item(req: RenameRequest, user=Depends(verify_token)):
    # Логика формирования полного пути и проверки прав
    old_full_path = get_secure_path(req.old_path)
    parent_dir = os.path.dirname(old_full_path)
    new_full_path = os.path.join(parent_dir, req.new_name)

    if os.path.exists(new_full_path):
        raise HTTPException(status_code=400, detail="Файл с таким именем уже существует")

    os.rename(old_full_path, new_full_path)
    return {"message": "Успешно переименовано"}

