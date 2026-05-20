# Buykori Client Portal

Vercel-ready static frontend for `client.buykori.app`.

Set the Vercel project root to `client-portal`.

Runtime API target:

```txt
https://api.buykori.app
```

The portal now uses public email/password signup and secure client sessions.

Current flow:

```txt
Sign up -> workspace auto-created -> session cookie set -> dashboard opens
Sign in -> session cookie set -> dashboard opens
```

Email verification is intentionally not required yet. It can be added later when transactional email is configured.
