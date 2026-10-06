# BookEase
<<<<<<< HEAD
BookEase is a modern multi-service booking platform that connects customers with service providers for easy service discovery, booking, payment, and management.
=======

BookEase is a React/Vite frontend backed by a Laravel REST API and a MySQL database.
The frontend uses Tailwind CSS, React Router, and Axios to communicate with the API.

## Requirements

- Node.js 20.19+ (or 22.12+) and npm
- PHP 8.2+ with the DOM, mbstring, and PDO MySQL extensions
- Composer 2
- MySQL 8+

## Local setup

### 1. Create the MySQL database and application user

Sign in to MySQL with an administrator account and run:

```sql
CREATE DATABASE bookease CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'bookease'@'127.0.0.1' IDENTIFIED BY 'bookease_local_password';
GRANT ALL PRIVILEGES ON bookease.* TO 'bookease'@'127.0.0.1';
```

Use a unique password for your local environment and update `DB_PASSWORD` in `backend/.env` to match it.

### 2. Configure and start the Laravel API

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve --host=127.0.0.1 --port=8000
```

The API health endpoint is available at <http://127.0.0.1:8000/api/health>.

### 3. Start the React frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite. The development server proxies `/api` requests to Laravel on port 8000.

To create a production frontend build, run `npm run build` from `frontend/`.

### 4. Initialize Git (if this folder is not already a repository)

From the project root:

```bash
git init
```

The root `.gitignore` excludes frontend build/dependency files and the backend environment file.

## Project layout

- `frontend/` — React, TypeScript, and Vite application
- `backend/` — Laravel API application
- `MASTER_ARCHITECTURE.md` — phased delivery roadmap
>>>>>>> a6514b5 (Initial BookEase)
