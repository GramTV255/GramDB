# GramDB Pro — Muundo wa Project Kubwa (Production-Ready)

`App -> API Key -> Access Token -> GramDB` — sasa na **PostgreSQL**, muundo wa MVC
(routes/controllers/models), rate limiting, security headers, logging, na graceful shutdown.

## 📂 Muundo wa Folda

```
gramdb-pro/
├── src/
│   ├── config/
│   │   ├── env.js          # Kusoma environment variables
│   │   ├── db.js           # Postgres connection pool
│   │   └── migrate.js      # Kuendesha migrations
│   ├── middleware/
│   │   ├── auth.js         # requireApiKey, requireAuth
│   │   ├── rateLimit.js    # Rate limit ya /auth/login
│   │   └── errorHandler.js # 404 "site not found" + error handler
│   ├── models/
│   │   ├── user.model.js
│   │   ├── doc.model.js
│   │   └── file.model.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── data.controller.js
│   │   └── storage.controller.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── data.routes.js
│   │   ├── storage.routes.js
│   │   └── media.routes.js
│   ├── utils/
│   │   └── upload.js       # Multer config
│   ├── app.js               # Express app (middleware + routes)
│   └── server.js             # Entry point + graceful shutdown
├── migrations/
│   └── 001_init.sql
├── uploads/                  # Faili zilizo-upload (haziko git)
├── .env.example
├── .gitignore
└── package.json
```

## 🚀 Kuanzisha

### 1. Weka PostgreSQL
Kama huna, weka kwa Docker:
```bash
docker run --name gramdb-postgres -e POSTGRES_USER=gramdb_user \
  -e POSTGRES_PASSWORD=password -e POSTGRES_DB=gramdb \
  -p 5432:5432 -d postgres:16
```

### 2. Nakili `.env`
```bash
cp .env.example .env
```
Kisha fungua `.env` na weka `DATABASE_URL`, `GRAMDB_API_KEY`, na `BASE_URL` sahihi.

### 3. Install dependencies
```bash
npm install
```

### 4. Endesha Migrations (kuunda majedwali)
```bash
npm run migrate
```

### 5. Anzisha Server
```bash
npm start
```
Kwa maendeleo (auto-restart ukibadilisha code):
```bash
npm run dev
```

## 🔑 Matumizi (Endpoints)

Zote zinahitaji header: `X-API-Key: <GRAMDB_API_KEY>`

### Auth
| Method | Endpoint | Auth | Maelezo |
|---|---|---|---|
| POST | `/auth/login` | API Key tu | Login/Register kwa phone_number |
| POST | `/auth/logout` | API Key + Token | Futa session ya sasa |
| GET | `/auth/me` | API Key + Token | Taarifa za mtumiaji wa sasa |

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "X-API-Key: $GRAMDB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"+255712345678"}'
```

### Data (CRUD — wazi kwa mtumiaji yeyote mwenye token halali)
| Method | Endpoint |
|---|---|
| POST | `/data?collection=posts` |
| GET | `/data?collection=posts` |
| GET | `/data/:id` |
| PUT | `/data/:id` |
| DELETE | `/data/:id` |

```bash
curl -X POST "http://localhost:3000/data?collection=posts" \
  -H "X-API-Key: $GRAMDB_API_KEY" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Habari","body":"Maandishi..."}'
```

### Storage
| Method | Endpoint | Auth |
|---|---|---|
| POST | `/storage/upload` | Ndiyo |
| GET | `/storage/files` | Ndiyo |
| DELETE | `/storage/:file_id` | Ndiyo |
| GET | `/media/:filename` | **Hapana** (public) |

```bash
curl -X POST http://localhost:3000/storage/upload \
  -H "X-API-Key: $GRAMDB_API_KEY" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/photo.jpg"
```

Ukijaribu `/media/xxx` isiyokuwepo, utapata ukurasa wa "Tovuti hii haiwezi kufikiwa".

## 📈 Kupeleka Live (Deployment)

1. **Database**: Tumia Postgres iliyosimamiwa (Neon, Supabase, Railway, RDS) — usitumie Docker ya ndani kwa production.
2. **HTTPS**: Weka nyuma ya reverse proxy (Nginx/Caddy) au load balancer ya cloud provider inayotoa TLS.
3. **Environment variables**: Kamwe usiweke `.env` kwenye git — tumia secrets manager ya hosting yako.
4. **Uploads kwenye scale**: Faili za disk za ndani hazishirikiani kati ya servers nyingi. Ukienda multi-instance, hamisha uploads kwenda **S3 / Cloud Storage / Cloudflare R2** badala ya disk ya server (`storage.controller.js` ndipo utabadilisha hii).
5. **Process manager**: Tumia PM2 au Docker + orchestrator (Kubernetes, ECS) badala ya kuendesha `node` moja kwa moja, ili iwe na auto-restart ikianguka.
6. **Logging/Monitoring**: Ongeza huduma kama Sentry (errors) na Better Stack/Grafana (logs, uptime).
7. **Rate limiting kwa multi-instance**: Badilisha in-memory Map ya `rateLimit.js` na Redis store (`rate-limit-redis`) ili kikomo kifanye kazi sawa kwenye servers zote.

## ⚠️ Maamuzi ya Kubuni Yaliyofanywa Kwa Makusudi

- Hakuna OTP/SMS/Password — uthibitisho ni namba ya simu tu.
- Access Token haina muda wa kuisha — inabatilika tu ukilogin tena (single-session kwa kila uid).
- Hakuna ownership check kwenye `/data` — mtumiaji yeyote aliyesajiliwa anaweza CRUD data yoyote.

Haya ni sahihi kwa mifumo ya "shared/open data" (demo, matangazo ya pamoja, chat za wazi). Kama baadaye utahitaji faragha ya data kwa baadhi ya collections, ongeza ukaguzi wa `owner_id === req.uid` ndani ya `data.controller.js` kwa collection husika pekee.
