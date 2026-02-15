# Hive Books
A modern book virtual library platform built with a microservices architecture. Users can search for books using our search engine, get personalized recommendations based on the books in the library and

## Quick Start

### Prerequisites

- **Docker** and **Docker Compose** installed
- **Node.js** and **npm** (for DEV)

### 1. Start the Application

Use the provided Docker Compose file to start all services:

#### DEV mode
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

#### PROD mode
```bash
# Build the images
docker compose -f docker-compose.yml build
# Start the services
docker compose -f docker-compose.yml up
```

This will start:
- **API Gateway** on port `3000`
- **Book Metadata Service** on port `3003`
- **User Data Service** on port `3004`
- **Recommendation Service** on port `3005`
- **Follower Service** on port `3006`

And the website will be available on `http://localhost:3000`

## 📂 Project Structure

```
hive_books/
├── services/
│   ├── book-metadata/      # Google Books and NYT API Adapter
│   ├── follower/           # Servizio per rilasci recenti e autori seguiti
│   ├── item-data/          # Persistence layer per la libreria (SQLite + GraphQL/REST)
│   ├── orchestrator/       # API Gateway e orchestrazione workflow
│   ├── recommendation/     # Motore di suggerimenti basato sulla libreria
│   └── user-data/          # Gestione utenti e autenticazione (SQLite)
├── docker-compose.yml     # Main Docker Compose file
├── docker-compose.dev.yml # Development-specific config
└── README.md              # This file
```


```mermaid

flowchart TD

    UI[Client UI]

    subgraph "Process Centric Layer"
        OS[Orchestrator Service]
    end


    subgraph "Business Logic Layer"
        RS[Recommendation Service]
        FS[Follower Service]

        IMC[("In-memory Cache")]
    end

  
    subgraph "Adapter Layer"
        MA[Book Metadata Service]

        R[(Redis Cache)]

        GBA([Google Books API])
        NYT([New York Times API])
    end
  

    subgraph "Data Layer"
        UDS[User Data Service]
        IDS[Item Data Service]

        UDB[(User DB - SQLite)]
        IDB[(Item DB - SQLite)]
    end

    IDS --> IDB
    UDS --> UDB

    UI -->|REST + JWT| OS

    OS -->|REST| UDS
    OS -->|REST| IDS
    OS -->|REST| MA
    OS -->|REST| RS
    OS -->|REST| FS

    RS -->|REST| IDS
    RS -->|REST| MA

    FS -->|REST| IDS
    FS -->|REST| MA

    FS <--> IMC
    RS <--> IMC

    MA -->|REST| GBA
    MA -->|REST| NYT

    MA <--> R

```

## 📚 Tech & Tools

### Core Backend & Orchestration
- **Node.js**: Runtime environment for all microservices.
- **Express**: Web framework for building RESTful APIs.
- **Docker**: Containerization and deployment orchestration.

### Data Layer
- **SQLite3**: Lightweight, file-based SQL database for user and library data.
- **JWT**: JSON Web Tokens for secure authentication.
- **Redis**: High-performance caching and message queuing.

### Frontend
- **Vanilla JavaScript**: State management and DOM interaction without heavy framework dependencies.
- **Tailwind CSS**: Utility-first CSS framework for modern and responsive design.
- **Font Awesome**: Iconography and vector assets.

### External APIs
- **Google Books API**: Primary source for book metadata and search functionality.
- **New York Times API**: Secondary source for book metadata and search functionality.
