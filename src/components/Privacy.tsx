// What Bro keeps and who can see it (roadmap A.5). Shown from Settings and before signing in.
export function PrivacyText() {
  return (
    <div className="stack privacy">
      <section className="card stack">
        <h2>What Bro keeps</h2>
        <p className="small dim">
          Your workouts, weigh-ins and measurements, routines, profile (name, sex, height, birth year) and any photos you add. A copy lives on
          your phone, and one in your account so it syncs and survives a lost phone.
        </p>
      </section>
      <section className="card stack">
        <h2>Locked before it leaves your phone</h2>
        <p className="small dim">
          Your phone locks everything with AES-256 before uploading it, using a key that only your password or your recovery key can open. Your
          password itself never leaves the phone. The server stores the locked copy, so it can't read it.
        </p>
      </section>
      <section className="card stack">
        <h2>Who can see what</h2>
        <ul className="steps-guide small">
          <li><b>You:</b> everything.</li>
          <li><b>The person who runs Bro,</b> and Supabase, the service that hosts it: your email, when you created the account and last synced, and how much data you have. Not the data itself.</li>
          <li><b>Other people using Bro:</b> nothing.</li>
          <li><b>Backups:</b> a locked copy is saved every night and kept 30 days. Nobody can open it without your key either.</li>
          <li><b>Weather:</b> if you look up the weather for a workout, your location, rounded to about 10 km, goes to Open-Meteo, a free weather service. Nothing else does.</li>
        </ul>
      </section>
      <section className="card stack">
        <h2>Your choices</h2>
        <ul className="steps-guide small">
          <li><b>Export</b> everything as a file at any time: Settings, Data &amp; sync.</li>
          <li><b>Delete your account</b> in Settings, Account. It removes your data, photos and sign-in from the server for good, and backups expire within 30 days.</li>
          <li><b>If you forget your password,</b> your recovery key and a code sent to your email get you back in. Lose both, and nobody can open your data, not even Bro.</li>
        </ul>
      </section>
    </div>
  );
}
