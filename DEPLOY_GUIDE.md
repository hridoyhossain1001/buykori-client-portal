# CAPI Gateway — Deployment Guide (Heroku CLI)

## প্রজেক্ট স্ট্রাকচার
```
Server site traking/
├── app/
│   ├── main.py
│   ├── database.py
│   ├── dependencies.py
│   ├── models/client.py
│   ├── schemas/event.py
│   ├── routers/events.py
│   ├── routers/admin.py
│   └── services/capi_service.py
├── requirements.txt
├── Procfile
├── runtime.txt
└── .env  (লোকাল টেস্টের জন্য, Heroku-তে push হবে না)
```

---

## ধাপ ১ — Prerequisites (একবারই করতে হবে)

### Git Install করুন
https://git-scm.com/downloads

### Heroku CLI Install করুন
https://devcenter.heroku.com/articles/heroku-cli

Terminal/PowerShell-এ চেক করুন:
```
git --version
heroku --version
```

---

## ধাপ ২ — Heroku Login

```powershell
heroku login
```
ব্রাউজার খুলবে, লগইন করুন।

---

## ধাপ ৩ — Git Repository Init

আপনার প্রজেক্ট ফোল্ডারে (Server site traking):
```powershell
git init
git add .
git commit -m "Initial commit: CAPI Gateway"
```

---

## ধাপ ৪ — Heroku App তৈরি করুন

```powershell
heroku create capi-gateway-yourname
```
(yourname পরিবর্তন করুন, যেমন: capi-gateway-hridoy)

---

## ধাপ ৫ — Postgres Database যোগ করুন ($5/মাস)

```powershell
heroku addons:create heroku-postgresql:essential-0 -a capi-gateway-yourname
```

DATABASE_URL অটো সেট হয়ে যাবে।

---

## ধাপ ৬ — Admin Credentials Heroku-তে সেট করুন

```powershell
heroku config:set ADMIN_USERNAME=admin ADMIN_PASSWORD=1122334455 -a capi-gateway-yourname
```

---

## ধাপ ৭ — Deploy করুন

```powershell
git push heroku main
```

---

## ধাপ ৮ — অ্যাপ চেক করুন

```powershell
heroku open -a capi-gateway-yourname
```

অথবা ব্রাউজারে যান:
- **Health Check:** `https://capi-gateway-yourname.herokuapp.com/`
- **Admin Panel:** `https://capi-gateway-yourname.herokuapp.com/api/v1/admin`
- **API Docs:** `https://capi-gateway-yourname.herokuapp.com/docs`

---

## ধাপ ৯ — Custom Domain যোগ করুন (Optional, Heroku লুকানোর জন্য)

```powershell
heroku domains:add tracking.yourname.com -a capi-gateway-yourname
heroku domains -a capi-gateway-yourname
```

DNS Target নোট করুন (যেমন: abc123.herokudns.com)।
আপনার Domain provider-এ CNAME Record যোগ করুন:
- Host: tracking
- Value: abc123.herokudns.com

SSL অটো সেটআপ হবে।

---

## Useful Commands

```powershell
# লাইভ লগ দেখুন
heroku logs --tail -a capi-gateway-yourname

# অ্যাপ রিস্টার্ট করুন
heroku restart -a capi-gateway-yourname

# ডাটাবেস চেক করুন
heroku pg:info -a capi-gateway-yourname
```

---

## Admin Panel ব্যবহার

1. `https://your-app.herokuapp.com/api/v1/admin` এ যান
2. Username: `admin`, Password: `1122334455` দিয়ে লগইন করুন
3. নতুন ক্লায়েন্ট যোগ করুন (নাম, Pixel ID, Access Token)
4. "📋 Instructions" বাটনে ক্লিক করে ক্লায়েন্টকে পাঠানোর জন্য ইন্সট্রাকশন নিন

---

## Client-এর কাছ থেকে কী নেবেন?

- Facebook Pixel ID (FB Events Manager → Settings)
- CAPI Access Token (Events Manager → Settings → Conversions API → Generate Token)
- ক্লায়েন্টের নাম

আপনি "Instructions" পেজে ক্লিক করলে সব তৈরি হয়ে যাবে — ক্লায়েন্টকে শুধু লিংকটা পাঠান।
