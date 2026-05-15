# SolarEPC – Installation Management System

Solar rooftop installation EPC workflow management system.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### If dev server won’t start or you see errors

- **"Unable to acquire lock" / "Port 3000 is in use"**  
  Stop any running `next dev` (Ctrl+C in that terminal), then run:
  ```bash
  npm run dev:clean
  ```
  If port 3000 is still in use, close the other app using it or run on another port:
  ```bash
  npx next dev -p 3001
  ```

- **"EMFILE: too many open files" (macOS)**  
  The `dev` and `dev:clean` scripts set `WATCHPACK_POLLING=true` so the watcher uses polling instead of native file handles. If you run `next dev` directly and see this, use `npm run dev` instead.

- **"uv_interface_addresses returned Unknown system error"**  
  The project applies a patch to Next.js so network interface detection fails gracefully. After `npm install`, `patch-package` applies it automatically. If the error persists, run `npm run postinstall` or `npx patch-package`.

- **Supabase / env**  
  Copy `.env.example` to `.env.local` and set at least `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example` comments). Server-side code also needs `NEXT_PUBLIC_SUPABASE_URL` set.

- **Ports (Kong vs Next.js)**  
  Default Supabase Kong is **8000**; Studio often uses **3000**. If something else uses 8000, set `KONG_HTTP_PORT` in `supabase/docker/.env` (e.g. **7100**) and point `.env.local` at that port. Production PM2 uses **PORT=6001** ([`ecosystem.config.cjs`](ecosystem.config.cjs)). Optional: `npm run dev:7100` to run Next on 7100 locally. See [`docs/CONNECTION_TROUBLESHOOTING.md`](docs/CONNECTION_TROUBLESHOOTING.md) §7.

## Scripts

| Script        | Description                    |
|---------------|--------------------------------|
| `npm run dev` | Start dev server (with polling fix) |
| `npm run dev:clean` | Remove dev lock and start dev server |
| `npm run build` | Production build              |
| `npm run start` | Run production server         |
| `npm run lint` | Run ESLint                    |

## License

Private.
