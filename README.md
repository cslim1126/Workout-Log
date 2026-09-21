# Workout Log — Setup Guide (no coding needed)

This is a small multi-user workout tracker. Follow these steps in order.
Everything after "buy a domain" is free.

## 1. Create a Supabase project (free database + login system)

1. Go to https://supabase.com and sign up (you can use your Google account).
2. Click **New Project**. Pick any name and a database password (save it somewhere).
3. Wait about a minute for the project to finish setting up.
4. In the left sidebar, click **SQL Editor** → **New query**.
5. Open the file `supabase/schema.sql` from this folder, copy all of it, paste it into the SQL editor, and click **Run**.
   This creates the tables and makes sure each person can only see their own data.
6. In the left sidebar, click **Project Settings** → **API**.
   You'll see two values you need in a minute:
   - **Project URL**
   - **anon public** key

Keep that tab open — you'll copy these into Vercel in step 4.

## 2. Put this code on GitHub

1. Go to https://github.com and sign up if you don't have an account.
2. Click **New repository**. Name it e.g. `workout-log`. Keep it Private if you prefer. Click **Create repository**.
3. On the new repo's page, click **uploading an existing file**.
4. Drag every file and folder from this project folder into the upload box (everything except this README is fine to include too — it won't hurt anything).
5. Scroll down and click **Commit changes**.

## 3. Deploy on Vercel (free hosting)

1. Go to https://vercel.com and sign up using your GitHub account — this lets Vercel see your repos.
2. Click **Add New** → **Project**.
3. Find your `workout-log` repo and click **Import**.
4. Before clicking Deploy, open **Environment Variables** and add these two:
   - `NEXT_PUBLIC_SUPABASE_URL` → paste the Project URL from Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → paste the anon public key from Supabase
5. Click **Deploy**. After a minute or two you'll get a live link like `workout-log-yourname.vercel.app`.
6. Open that link, click **Sign up**, create an account, and try logging a set — this confirms everything is wired up correctly.

## 4. Buy your domain

Buy one from a registrar like https://www.cloudflare.com/products/registrar/ or https://www.namecheap.com — usually $10–15/year.

## 5. Connect the domain to Vercel (free)

1. In your Vercel project, go to **Settings** → **Domains**.
2. Type in your domain and click **Add**.
3. Vercel shows you one or two DNS records (usually an "A" record or a "CNAME").
4. Go to your domain registrar's dashboard, find the **DNS settings** for your domain, and add exactly the records Vercel showed you.
5. Wait a bit (a few minutes up to a couple hours) — Vercel will show a green checkmark once it's live, and HTTPS is set up automatically.

## 6. Invite other people

Just share your domain. Anyone can go to `yourdomain.com`, click **Sign up**, and create their own account. Their workout data is private to them — nobody can see anyone else's logs.

## If something goes wrong

- **Blank page / errors after deploying**: double-check the two environment variable names in Vercel match exactly: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then redeploy (Vercel → Deployments → ⋯ → Redeploy).
- **"relation does not exist" errors**: the SQL in step 1.5 didn't run — go back to Supabase's SQL Editor and run `supabase/schema.sql` again.
- **Can't sign in after signing up**: Supabase may require email confirmation by default — check your inbox, or turn it off in Supabase → Authentication → Providers → Email → "Confirm email" toggle.

Anytime you get stuck on one of these steps, come back and describe exactly what you're seeing — I can walk through it with you.
