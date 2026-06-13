# Mindscape — Presentation Script

*Target length: ~3 minutes. Open `your-app.vercel.app/launch` before you start so the fonts are cached and the model is warm. Use Chrome/Edge for voice.*

---

## 0. Before you click anything (10s)

> "Quick question. When you try to remember something — you don't scroll a list in your head. You jump. One idea pulls you to the next. Memory is a **web**, not a list. So why does every notes app still look like a to-do list from 1995?"

*(You're on `/launch`. Arrow through the 5 pitch slides — or just click "Enter the Mindscape" on slide 5.)*

---

## 1. Enter the Mindscape (15s)

*Click **Enter the Mindscape**. The deck dives into the app — a dark "deep space" map with glowing, color-coded islands.*

> "This is Mindscape. Every dot is one note. They aren't in folders — they've arranged *themselves*. Notes about the same idea drift together into these colored islands, automatically. Nobody tagged anything."

---

## 2. Load a real notebook (20s)

*Click the **+** (top-right) → paste or upload `demo/writers-notebook.md` → "Add to terrain" (or "Start a fresh terrain").*

> "Let me drop in a real example — **a novelist's idea notebook. 200 raw notes**, written over years. Character sketches, scraps of dialogue, plot problems, 3am doubts."

*Watch the stars stream in and re-cluster into islands — Character, Dialogue, Plot, Revision, Endings…*

> "In a couple of seconds it's read all 200 and laid out the writer's whole head — every theme they keep circling back to."

---

## 3. The moment — describe a feeling (30s)  ⭐ *this is the demo*

*Click the mic (lower center) and **say it out loud** — or type it if the wifi's bad:*

> 🎙️ **"That fear that I'm not actually a writer… staring at the blank page."**

*The fog clears: 5–6 notes ignite warm-amber and pull to the center; everything else dims.*

> "I didn't type a keyword. I described a **feeling** — and it surfaced the exact notes about doubt and the blank page. **This is the thing you can't do with Ctrl-F.** I found something I couldn't have searched for."

*(Backup queries that also land well: "the moment a character finally tells the truth" → Character/Dialogue · "I keep starting things and never finishing them" → Revision.)*

---

## 4. Dive into an idea (15s)

*Click one of the bright orbs. The camera flies in, the note blooms, the full text opens beside it.*

> "Click any one to read it. And —" *(click **Find similar**)* "— 'find similar' re-runs the whole map from *this* note as the seed. I'm navigating by resemblance, the way the brain does."

---

## 5. Explore by topic + voice (20s)

*Hover an island → the **"CHARACTER · 24 notes"** pill appears. Click it → it blooms open into a ring.*

> "Hover an island to see how much I've thought about it — click to open it like a solar system."

*Then the showpiece — say:*

> 🎙️ **"Take me to dialogue."**

*The camera flies to the Dialogue island.*

> "I can *talk* to the map. 'Take me to dialogue.' 'Zoom out.' The voice isn't just search — it's navigation. And that faint trail? That's my train of thought — everywhere I've just been."

---

## 6. How it actually works (25s)

> "Under the hood it's all **TypeScript, and it all runs in your browser** — there's no backend, no server, no account.
>
> Every note gets turned into a **384-number vector — an embedding** — by a small language model (MiniLM) running *locally* via Transformers.js. I even self-host the model and its WebAssembly runtime, so the whole thing works **fully offline**.
>
> Relevance is just **cosine similarity** between your query's vector and every note's vector. The islands come from **k-means clustering** on those same vectors. And it's drawn on a hand-written **canvas + d3-force** physics engine — that's where the gravity, the glow, and the breathing come from."

*(One line if asked about scale/quality: "There's an optional Gemini-embeddings mode too — paste a key in Settings and it re-embeds the whole map.")*

---

## 7. Close (10s)

> "Notes apps have looked the same for 20 years. Mindscape treats your ideas the way your mind actually holds them — **relational, spatial, alive.** Not a list. A landscape. Thank you."

---

### Cheat sheet (sticky-note version)
1. `/launch` → arrow through deck → **Enter the Mindscape**
2. **+** → upload `writers-notebook.md` → watch it cluster
3. 🎙️ *"that fear I'm not actually a writer, the blank page"* → **fog clears**
4. Click a bright orb → read → **Find similar**
5. Hover island → click to **bloom open**
6. 🎙️ *"take me to dialogue"* → *"zoom out"*
7. The one-liner: **TypeScript · in-browser MiniLM embeddings · cosine similarity · k-means islands · canvas + d3-force · no backend**

> ⚠️ **Demo safety:** voice (Web Speech) needs internet. If the venue wifi is flaky, **type** the same phrases into the search box — everything else (model, search, clustering) runs offline.
