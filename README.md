# FITNESS FORGE

Monorepo TypeScript con:
- `apps/api` (Node + Express + TypeScript)
- `apps/web` (React + Vite + TypeScript)
- `packages/shared` (tipi condivisi, zod schemas, utils)

## Requisiti
- pnpm

## Installazione
```bash
pnpm install
```

## Avvio in sviluppo
```bash
pnpm dev
```

## Altri script
- `pnpm build`
- `pnpm lint`
- `pnpm format`

## Prisma (Supabase)
Questo progetto usa **un solo DB remoto** (Supabase). Imposta `DATABASE_URL` in `apps/api/.env` con `sslmode=require`.

### Guardrail DB
`ALLOW_DB_DESTRUCTIVE` (default `false`) blocca operazioni distruttive (es. `deleteMany` globale).  
Usa `assertNonDestructive()` prima di qualunque operazione che possa cancellare dati.  
Seed e test devono **sempre** rispettare questo flag.

### Auth (JWT)
Imposta `JWT_SECRET` in `apps/api/.env` per firmare i token JWT.

Esempi `curl`:

Registrazione
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","name":"Mario Rossi","unitKg":true}'
```

Login
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

Rotta protetta
```bash
curl http://localhost:3001/me \
  -H "Authorization: Bearer <TOKEN>"
```

## Mesocicli e sessioni
Creare un mesociclo (genera automaticamente le settimane)
```bash
curl -X POST http://localhost:3001/mesocycles \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2026-02-10","structure":"FOUR_ONE"}'
```

Creare template sessioni (vengono copiate su tutte le settimane)
```bash
curl -X POST http://localhost:3001/mesocycles/<MESOCYCLE_ID>/sessions \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '[{"dayOfWeek":1,"sessionName":"Upper A","sessionOrderInWeek":1,"scheduledDate":"2026-02-11"},{"dayOfWeek":4,"sessionName":"Lower A","sessionOrderInWeek":2,"scheduledDate":"2026-02-14"}]'
```

Sessioni della settimana
```bash
curl http://localhost:3001/weeks/<WEEK_ID>/sessions \
  -H "Authorization: Bearer <TOKEN>"
```

Dettaglio sessione (con esercizi)
```bash
curl http://localhost:3001/sessions/<SESSION_ID> \
  -H "Authorization: Bearer <TOKEN>"
```

Aggiungere esercizi a una sessione
```bash
curl -X POST http://localhost:3001/sessions/<SESSION_ID>/exercises \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"exerciseId":"<EXERCISE_ID>","orderIndex":1,"setsTarget":3,"mode":"AUTO","loadTarget":null}'
```

### Migrazioni
- Generare una nuova migrazione (solo in locale con un Postgres di sviluppo):
```bash
pnpm --filter @fitness-forge/api exec prisma migrate dev --name <nome>
```
- Applicare le migrazioni su Supabase (remoto):
```bash
pnpm --filter @fitness-forge/api db:migrate
```
- Stato migrazioni:
```bash
pnpm --filter @fitness-forge/api db:status
```

### Seed
```bash
pnpm --filter @fitness-forge/api db:seed
```

## Note
- Copia `apps/api/.env.example` in `apps/api/.env` e personalizza le variabili se necessario.
