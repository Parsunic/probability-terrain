// Source paragraphs for the bundled "founder's idea journal" demo terrain.
// Each entry becomes one node. `topic` is a curated label used to name the
// semantic cluster the note lands in (clusters are still discovered from the
// embeddings — the tag just gives the island a clean human name instead of a
// keyword guess). User-pasted notes have no tag and fall back to keyword labels.
//
// Edit here, then run `node scripts/embedSample.mjs` to regenerate
// src/data/sampleData.json.

export const sampleNotes = [
  // — Ideas & Influence —
  { topic: "Ideas & Influence", text: "The thing nobody tells you about network effects is that they run in reverse just as fast. The same density that makes a community feel alive can curdle overnight when the early believers leave. Value doesn't accumulate in the product; it accumulates in the relationships the product happens to host." },
  { topic: "Ideas & Influence", text: "Ideas spread through communities the way warmth moves through a crowded room — not from the loudest source but through proximity, person to person, until the whole space has changed temperature without anyone deciding it should. You can't broadcast a movement. You can only make it easy to pass along." },
  { topic: "Ideas & Influence", text: "Virality is mostly a story people tell about luck after the fact. What actually travels is a feeling someone wants to give to someone else. If using the thing makes you look generous or clever to your friends, it spreads. If it only makes you look like a customer, it dies quietly." },
  { topic: "Ideas & Influence", text: "Every strong community has a secret: a shared enemy, an inside joke, a sense that the people outside just don't get it. Belonging is built on a boundary. The hard part is keeping the boundary porous enough to grow without dissolving the thing that made it worth joining." },
  { topic: "Ideas & Influence", text: "Word of mouth is not a marketing channel, it's a referendum. People only tell their friends about things that survived contact with their own reputation. Every recommendation is someone spending social capital on your behalf, and they audit you ruthlessly before they do." },

  // — Creativity —
  { topic: "Creativity", text: "Most of my best ideas arrived disguised as distractions. They showed up while I was doing something adjacent and unimportant, never when I sat down and demanded them. Creativity seems to be a side effect of paying loose attention to two unrelated things at once." },
  { topic: "Creativity", text: "An idea is just two old things standing close enough together that you finally notice the gap between them. Originality is mostly a memory of where you've been combined with the nerve to connect places no one thought belonged on the same map." },
  { topic: "Creativity", text: "I keep a list of questions I can't answer instead of a list of ideas. Ideas go stale in a week; a good question stays hungry for years and quietly attracts everything relevant you encounter until one day the answer assembles itself." },
  { topic: "Creativity", text: "Serendipity isn't random — it's the harvest of a wide surface area. The people who 'get lucky' with ideas are usually the ones who talk to strangers, read outside their field, and leave enough slack in the day for the unexpected collision to actually happen." },
  { topic: "Creativity", text: "Borrow the structure of a solution from a field that has nothing to do with yours. Biology has already solved most coordination problems; cities have already solved most density problems. The fresh idea is almost always an old idea wearing someone else's clothes." },

  // — Decisions —
  { topic: "Decisions", text: "Decisions under uncertainty aren't about predicting the future, they're about staying alive long enough to be surprised by it. Prefer the choice that keeps the most doors open, even when a narrower path looks more efficient on paper." },
  { topic: "Decisions", text: "Intuition is compressed experience that hasn't finished explaining itself yet. When my gut and my spreadsheet disagree, I've learned to interrogate the spreadsheet first — it's usually the one quietly making things up." },
  { topic: "Decisions", text: "The cost of a reversible decision is the time you waste deliberating over it. Most choices are doors you can walk back through; treat them that way and move fast. Save the agonizing for the few that genuinely lock you in." },
  { topic: "Decisions", text: "Risk isn't the chance of being wrong, it's the size of the hole when you are. I'll happily be wrong nine times in a row if each mistake is survivable and the tenth is uncapped. Asymmetry is the whole game." },
  { topic: "Decisions", text: "Beware decisions that are easy to defend but hard to love. The choice you can justify to a committee is rarely the one that wins, because by the time something is obviously reasonable, the advantage has already been competed away." },

  // — Product —
  { topic: "Product", text: "Users can't tell you what they want, but they're brutally honest about what they hate. So stop running surveys and start watching them struggle. The feature request is a guess; the workaround they've already hacked together is the truth." },
  { topic: "Product", text: "The first version should embarrass you a little. If you waited until it was good, you waited too long to learn the one thing the market was going to teach you anyway, except now you've spent six months defending a thesis instead of testing it." },
  { topic: "Product", text: "Every feature you add is a tax on every feature that comes after it. Complexity compounds silently — the second-order cost isn't the code, it's the dozen future ideas that quietly become impossible because the surface got too tangled to move." },
  { topic: "Product", text: "Talk to the users who almost left and the users who almost stayed. The happy middle teaches you nothing. The signal lives at the edges, in the people who felt the product strongly enough in either direction to nearly act on it." },
  { topic: "Product", text: "Build the thing that doesn't scale until it works, then earn the right to automate it. The manual, embarrassing, hand-stitched version is where you discover what the product actually is before you pour concrete on the wrong shape." },

  // — Focus —
  { topic: "Focus", text: "Attention is the only truly nonrenewable resource I have; money comes back, time at least passes predictably, but a fractured morning is gone in a way nothing restores. I've started guarding the first two hours of the day like they're the whole day." },
  { topic: "Focus", text: "Depth and speed feel like opposites but they're the same muscle. The fastest people I know aren't rushing — they've just removed enough noise that a single clear thought can travel a long way before something interrupts it." },
  { topic: "Focus", text: "Busyness is the camouflage of people avoiding the one hard thing. A full calendar is often just an elaborate way to feel productive while never touching the work that actually scares you. Subtract until only the frightening thing is left." },
  { topic: "Focus", text: "Context-switching has a tax you can't see on any invoice. Each jump leaves a residue of the last task smeared across the next one, so the day feels full and the real work stays untouched. Batch ruthlessly, or the fragments will eat everything." },

  // — Resilience —
  { topic: "Resilience", text: "Failure isn't the opposite of success, it's the raw material. The only unrecoverable mistake is the one you refuse to look at directly, because the lesson is always sitting right inside the part that hurts most to examine." },
  { topic: "Resilience", text: "Resilience isn't gritting your teeth, it's shortening the distance between a setback and the next attempt. The founders who last aren't the toughest — they're the ones who turned recovery into a reflex instead of a decision." },
  { topic: "Resilience", text: "I trust people more after I've watched them be wrong. How someone metabolizes a mistake tells you everything about whether you want them next to you in the next one. Grace under being wrong is rarer and more valuable than being right." },

  // — Teams —
  { topic: "Teams", text: "Culture isn't the values on the wall, it's the worst behavior the team is willing to tolerate from its best performer. People read what you permit far more carefully than what you preach, and they calibrate to the gap." },
  { topic: "Teams", text: "Hire for the slope, not the intercept. Where someone is today matters far less than how fast they're climbing, because in a year the steep learners will have lapped the people who were merely impressive at the interview." },
  { topic: "Teams", text: "The best teams argue about ideas and protect each other's dignity; the worst do the exact reverse. Get those two wires crossed and you'll have a polite room where nothing true ever gets said out loud." },

  // — Money —
  { topic: "Money", text: "Money is a story about the future that enough people agree to believe at the same time. Fundraising is just the art of making your version of that story legible to someone whose imagination runs on different fuel than yours." },
  { topic: "Money", text: "Watch what incentives reward, not what the mission statement promises. People are not hypocrites; they're responding rationally to the scoreboard you actually built, and the scoreboard always wins the argument against the poster on the wall." },
  { topic: "Money", text: "Raising money feels like winning and is actually borrowing — you've sold a slice of every future you might have had in exchange for the one you're betting on now. The cost isn't the dilution, it's the futures you just quietly closed off." },
];
