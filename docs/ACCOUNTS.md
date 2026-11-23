# Accounts: the owner's guide

What the owner does by hand for [Phase A](../ROADMAP.md#phase-a-private-accounts) and the people after it, in order. Everything else is code, built on branches as usual. Each section says when it's needed. Only step 1 is needed now.

**Never paste into chat or commit:** the database passwords, a secret key (`sb_secret_…`) or the Gmail app password. The project URL and the publishable key (`sb_publishable_…`) are public by design. They only work within the database's rules, so they can go in the repo.

## 1. Now: create the projects

1. Go to [supabase.com](https://supabase.com) and sign up. **Continue with GitHub** is quickest. When it asks for an organization, choose the **Free** plan.
2. Create a **new project** named `Bro`:
   - **GitHub (optional):** leave it empty. The database barely changes, since each person's data is one sealed blob, so a one-time SQL paste beats giving Supabase access to the repo. It can be connected later.
   - **Database password:** generate one, press **Copy** and save it in your password manager before creating. The app never uses it; the nightly backup does (step 4).
   - **Region:** press **Need a specific region?** and choose South America (São Paulo) if it's listed, otherwise **Americas**. It can't be changed later.
   - **Data access:** keep **Enable Data API** on, since the app talks to the database through it. Leave **Grant API access to new tables automatically** off, since the setup file grants only what the app needs. Turn **Enable RLS on new tables automatically** on, so any new table starts locked.
   - Leave **Advanced configuration** as it is. It takes a couple of minutes to start.
3. Create a second project the same way, named `Bro test`, with its own password. Development and rehearsals use it, so real accounts are never touched. The free plan allows exactly two projects.
4. In **each** project, open **Authentication**, then the sign-in settings:
   - **Allow new users to sign up:** off for now. It goes back on in step 3, once the guest list is in place.
   - **Email** sign-in: on. **Confirm email:** off. The guest list replaces it, and confirmation links open in Safari instead of the installed app.
   - Leave the password rules alone. The app checks the real password itself, and Supabase only ever sees a long derived secret.
5. Copy each project's **Project URL** and **publishable key** and send them over. Both are under **Project Settings**: **Data API** for the URL, **API Keys** for the key. The app needs the URL without `/rest/v1`. Both projects are now recorded in `src/lib/supabaseConfig.ts`.

Until the app uses them, the projects may pause after a week without activity. That's harmless: press **Restore** in the dashboard when we need them.

## 2. With A.4: an email sender for password resets

Only **Forgot password** needs this. The reset email has to carry a code typed into the app instead of a link, and on the free plan Supabase only lets you edit its emails when they go through your own mail account.

1. Create a new Gmail account just for Bro. Keeping it separate means its app password can't reach your own mail.
2. In that Google account, open **Security**, turn on **2-Step Verification**, then search for **App passwords** and create one named "Supabase". Copy the 16 characters.
3. In each project, open **Authentication**, then **Emails**, then **SMTP Settings**, and enable custom SMTP:
   - **Sender email:** the new Gmail. **Sender name:** Bro.
   - **Host:** `smtp.gmail.com`. **Port:** `465`.
   - **Username:** the new Gmail. **Password:** the app password.
4. Still in **Emails**, open the **Reset password** template. It shows a code instead of a link:
   - **Subject:** `Your Bro reset code`
   - **Body:**
     ```html
     <h2>Reset your Bro password</h2>
     <p>Type this code in the app:</p>
     <p style="font-size:28px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
     <p>You'll also need your recovery key. The code works for one hour.</p>
     <p>If you didn't ask for this, ignore this email. Your account is safe.</p>
     ```
5. Save. There's nothing to test yet: the reset screen arrives with A.4, and it gets tried on `Bro test` first.

## 3. With A.4: database setup and the guest list

1. In each project, open the **SQL Editor**, start a new query, paste the setup file that comes with A.4 and press **Run**.
2. Open **Authentication**, then **Hooks**, and add a **Before User Created** hook of type Postgres, pointing at the function the setup file names.
3. Add yourself to the guest list: **Table Editor**, the `guests` table, **Insert row**, your email.
4. Turn **Allow new users to sign up** back on.

To check it: creating an account with an email that isn't on the list should fail.

## 4. With A.5: the nightly backup

1. In the `bro` project, press **Connect** and copy the **Session pooler** connection string. GitHub's servers can't reach the direct one. Put the database password from step 1 into it.
2. In your private data repo on GitHub, open **Settings**, then **Secrets and variables**, then **Actions**, and add a repository secret named `SUPABASE_DB_URL` holding that string.
3. Add the workflow file that comes with A.5 to that repo, then run it once by hand from its **Actions** tab.

From then on it runs every night. Each backup is sealed, so it's unreadable without each person's key, and the query keeps the project from pausing.

## 5. With A.6: move your data

1. Rehearse on `bro-test` first, with a copy of your export.
2. In the current app, open **Settings**, **Data & sync**, **Export**, and keep that file.
3. Open the new version and tap **Create account** with your email. Let iPhone suggest the password and save it.
4. **Save the recovery key** in the Passwords app, and keep a second copy somewhere off the phone, such as on paper at home.
5. In **Settings**, **Data & sync**, **Import** the file.
6. Check that workouts, weigh-ins, level and stars match the old app. Use it for a week or two before the GitHub path is removed. The old data repo stays as an archive.

## 6. With S.3: add her

1. Add her email to the `guests` table, as in step 3.
2. On her iPhone, open the app's link in **Safari**, tap **Share**, then **Add to Home Screen**.
3. Open Bro **from the Home Screen**, not from Safari, and tap **Create account**. iPhone suggests a strong password and saves it.
4. Save her recovery key in Passwords, and a second copy somewhere else. Without her password and that key, nobody can open her data, you included.
5. **Settings** first: sex, height and birth year, since they pick the formulas. Then a weekly goal she can keep, and her routine.

## 7. With S.6: friends

The same as step 6, one person at a time.

## What to tell people

> Your log is locked on your phone before it's uploaded. I run the server, but all I can see is your email and when you last synced. If you forget your password, your recovery key gets you back in. If you lose both, the data is gone, because nobody else has a key. You can export everything or delete your account from Settings at any time.

## If something goes wrong

- **Supabase emails that a project will pause:** the backup didn't run. Check the **Actions** tab in the data repo. If it already paused, press **Restore**; the data is kept.
- **Someone forgot their password:** **Forgot password** in the app emails them a code. With the code and their recovery key, they set a new one. You can't do it for them, by design.
- **A lost or stolen phone:** they sign in on the new phone and everything comes back from the server. Changing the password signs out other devices.
- **Removing someone:** delete their email from `guests`. They can delete their own account in Settings, or you can delete the user under **Authentication**, **Users**, which removes their data with it.
