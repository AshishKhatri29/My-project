# Zipzy

A React + Vite quick-commerce storefront with server-authenticated product management.

## Run locally

Requires Node.js 18 or newer.

1. Copy `.env.example` to `.env` and set your Supabase Project URL and publishable key. Do not put a Supabase service-role key in the frontend environment.
2. Run:

   ```bash
   npm.cmd install
   npm.cmd run dev
   ```

Open `http://127.0.0.1:8080/`. The existing product catalog is stored in `data/catalog.json`, which is created on first run and excluded from Git.

The dedicated food landing page is available at `http://127.0.0.1:8080/food` and can also be opened from the **Food** link in the category navigation. It includes clearly labeled sample restaurant listings; replace these with real partner data before launch.

## Customer accounts (Supabase)

Customer registration and sign-in use Supabase Auth. The customer name is saved as signup metadata; no customer profile table or product-catalog migration is part of this setup. Public signup does not accept or set a role. Customer authentication does not grant admin access.

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. In **Project Settings → API**, copy the **Project URL** and **publishable key** (or legacy **anon** key). These are public client credentials. Never use the `service_role` key in this React app.
3. Copy `.env.example` to `.env`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to those values. Keep `.env` private; it is ignored by Git.
4. Open the Supabase **SQL Editor**, open `supabase/migrations/202610220001_customer_profiles.sql` in this project, and run its contents. It creates customer profiles and RLS that permits users to read only their own profile and does not permit clients to change roles.
5. In **Authentication → URL Configuration**, set the Site URL to `http://127.0.0.1:8080` and add `http://127.0.0.1:8080/**` to the Redirect URLs allow list.
6. In **Authentication → Providers → Email**, enable email confirmations. Configure custom SMTP under **Project Settings → Authentication → SMTP Settings** before relying on delivery to real users. The default sender has limited availability for testing.
7. Restart the development server after editing `.env`:

   ```bash
   npm.cmd run dev
   ```

8. Open the app, choose **Account → Create account**, enter a name, email, and password, then open the verification email and follow its link. After returning to the app, choose **Account → Sign in**.
9. Use **Forgot password?** from the sign-in form to request a reset link. The recovery link returns to the app, where you can enter and confirm a new password.
10. Choose **Account → Sign out** to end the customer session.

For local email testing, Supabase may capture messages in its Auth email testing view instead of delivering them to an ordinary inbox. A Supabase session is restored when the app reloads.

### Admin role setup

Public registrations always receive the `customer` role. To manually promote an already verified account, run this in the Supabase SQL Editor after replacing the email with that account's email:

```sql
update public.profiles as profiles
set role = 'admin'
from auth.users as users
where profiles.id = users.id
  and lower(users.email) = lower('admin@example.com');
```

The React client cannot modify profile roles. Admin sign-in is verified by the Node server using the Supabase access token and the user's own RLS-protected profile row. Catalog changes remain in `data/catalog.json`; the server authorizes writes for admin-role users. The public catalog reads and product data have not been migrated or changed.

## Production

Build the frontend and run the same server with `NODE_ENV=production` behind HTTPS:

```bash
npm run build
NODE_ENV=production npm start
```

The server reads the public Supabase Project URL and publishable key from its environment (or local `.env` file), verifies admin access tokens against Supabase Auth, and checks the authenticated user's RLS-protected profile role before accepting catalog updates. Configure the production site URL and email redirect allow list in Supabase Auth, and terminate HTTPS at the hosting proxy.

Product photography is loaded from Unsplash and requires an internet connection.
