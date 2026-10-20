import sys
from database import create_user, get_user_by_username
from config import settings


def main():
    print("=== Утилита добавления пользователя ===")

    # 1. Проверка секретного кода администратора
    secret_input = input("Введите секретный код администратора: ").strip()
    if secret_input != settings.admin_secret_key:
        print("Ошибка: Неверный секретный код администратора! Доступ запрещен.")
        sys.exit(1)

    print("Авторизация администратора успешна!\n")

    # 2. Ввод данных нового пользователя
    username = input("Введите имя нового пользователя: ").strip()
    if not username:
        print("Ошибка: Имя пользователя не может быть пустым.")
        sys.exit(1)

    if get_user_by_username(username):
        print(f"Ошибка: Пользователь '{username}' уже существует.")
        sys.exit(1)

    password = input("Введите пароль: ").strip()
    if len(password) < 6:
        print("Ошибка: Пароль должен содержать минимум 6 символов.")
        sys.exit(1)

    role_choice = input("Назначить роль (1 - user, 2 - admin) [По умолчанию 1]: ").strip()
    role = "admin" if role_choice == "2" else "user"

    # 3. Сохранение в БД
    success = create_user(username, password, role)
    if success:
        print(f"\nПользователь '{username}' (роль: {role}) успешно создан!")
    else:
        print("\nПроизошла ошибка при создании пользователя.")


if __name__ == "__main__":
    main()