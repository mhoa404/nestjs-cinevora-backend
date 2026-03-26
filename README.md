# Cinego Backend API

Backend service for a movie booking platform, providing authentication, booking management, and role-based access control.

## Introduction

This project is a backend API built with NestJS, designed to handle business logic for a movie booking system.  
It provides RESTful APIs for authentication, movie management, booking, and user operations.

## Tech Stack
<img src="https://skillicons.dev/icons?i=nestjs,ts,mysql,redis,docker,jenkins" />

## Features

- JWT Authentication (Access + Refresh Token)
- Booking system
- Seat locking (Redis)
- User management
- Database migration with TypeORM

## Architecture

The project follows modular architecture in NestJS:

- Modules (feature-based)
- Controllers (handle requests)
- Services (business logic)
- Repositories (database layer)

The system is designed with separation of concerns and scalability in mind.

## Installation

```bash
# download project
git clone <this-repository-url>

# open project
cd cinego-backend

# install packages and libraries
pnpm install
```

## Running the Project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```
## Running Tests
This project uses **Jest** and **Supertest** for E2E API testing. Run the interactive CLI:  
```bash
pnpm test:api
```
Select a module from the menu to execute its test suite. Upon completion, a detailed Excel test report is automatically generated in the test/results/ directory.

## Deployment

Not support yet

## Author


Lê Nguyễn Minh Hoà

[![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white)](https://facebook.com/your-link)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/your-username)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/mhoa-workspace)

