# Not A Limit

A Chrome extension that rewrites OpenAI's spend limit pages to say what they actually mean.

## The problem

OpenAI's platform settings let you set a "spend limit". It does not limit spend.

The number you type is a notification threshold. The thing that actually stops requests is a
separate toggle called **"Enforce a hard limit"**, hidden inside the edit modal, off by default,
with no explanation. The card on the page gives you:

- a heading that says **limit**
- a progress bar that fills up to it (in green, calmly, and then stops rendering)
- one line of fine print: *"Your actual costs may exceed this based on usage"*

Nothing on that page tells you whether the toggle is on. So the page looks identical whether
you are protected or not — including when spend has run five figures past the limit you set.

"Your actual costs may exceed this based on usage" reads like *we might round up a cent*.
It means *we will keep billing you past this number, indefinitely.*

## What the extension does

On `platform.openai.com/settings/**/limits` (project **and** organization):

- Reads the real state of the "Enforce a hard limit" toggle and remembers it per project/org.
- Rewrites the heading to "spend ~~limit~~ suggestion" with a `NOT ENFORCED` badge, and replaces
  the "your actual costs may exceed this" fine print with what it means.
- Rewrites the edit modal too: the misleading intro sentence, plus a note pointing at the toggle
  that says which control is the actual limit.
- Carries your tier ceiling across pages. The organization editor names it — "your usage tier
  defines the maximum monthly limit (...)" — and the project editor doesn't. Once seen, the
  figure is shown on every project card, with a link to the organization limits page.
- A floating **⇄ Reality / OpenAI's version** button flips the whole patch on and off, so you can
  take identical before/after screenshots. The swap is animated.

The volume scales to the situation, so it stays quiet when nothing is wrong:

| State | Treatment |
| --- | --- |
| Not enforced, under the limit | Grey one-liner. Deadpan, no alarm. |
| Not enforced, **over** the limit | Red card, and the progress bar breaks out of the card and runs off the screen — because that's what your spend did. |
| Enforced | "Enforced. Requests are rejected once spend reaches $X." |
| Not checked yet | Says so, rather than guessing. |

It never changes your billing settings. The "show me the switch that actually works" button just
opens the editor — flipping the toggle stays your click.

## Install (unpacked)

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder
3. Open your project or organization limits page

## How it survives redesigns

OpenAI's classnames are hashed per build (`rTZh9`, `-dWeP`), so nothing here targets them.
Everything is found by visible text and ARIA roles: the info line, the card heading, and
`button[role="switch"]` inside the "Enforce a hard limit" label. If OpenAI changes the copy,
the extension quietly does nothing rather than breaking the page.

Before publishing to the Chrome Web Store you'll need icons (`16/48/128px`) added to
`manifest.json` — omitted here because unpacked loading doesn't require them.

## License

MIT
