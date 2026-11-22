import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clapperboard, Mail, Mic, MousePointerClick, Share2, Sparkles, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const FEATURES = [
  { icon: Sparkles, title: "A spec becomes a script", body: "Paste release notes or a rough outline. AppShowcase turns them into browser steps with captions and a voiceover line for each scene." },
  { icon: MousePointerClick, title: "It records the real product", body: "A cloud browser opens your app, clicks through the path, and keeps the frames. You can also drive a live pane and turn each press into a step." },
  { icon: Mic, title: "Viewers can hear it", body: "Generate speech from the lines already written, then press Play. Captions stay on screen so the demo still works on mute." },
  { icon: Share2, title: "One link, or a file", body: "Share an interactive player, drop in an embed, or export a GIF and an MP4. A call to action can sit on the last frame." },
  { icon: ShieldCheck, title: "Broken steps get flagged", body: "When the product UI changes, a health check keeps the last good frame and marks the step that failed, so a public demo does not go blank." },
  { icon: Clapperboard, title: "It looks like your brand", body: "Set the accent, caption position, and watermark before you publish. The player and the export use the same kit." },
];

const STEPS = [
  { n: "01", title: "Describe the walkthrough", body: "Name the product, paste the URL, and write what a new user should see. A template can fill this in if you want a working example first." },
  { n: "02", title: "Let the studio record it", body: "AI writes the steps. Record runs them in a real browser, or you click through the live pane yourself. Each scene holds long enough to read." },
  { n: "03", title: "Send a demo, not a meeting", body: "Generate the voiceover, then share the player. Viewers move through chapters, and you see who finished." },
];

const FAQS = [
  { q: "What do I actually get?", a: "A narrated product walkthrough: a step timeline, screenshots of your live app, optional voiceover, and a shareable player plus GIF or MP4 export." },
  { q: "Do I have to install a screen recorder?", a: "No. Recording happens in a cloud browser. You write the path, or click inside the studio’s live pane. AppShowcase does not listen to the keys you type on your own keyboard." },
  { q: "How long does the first demo take?", a: "A short tour is one draft, one script, and one recording. Voiceover is a separate button after the lines are written, then Play is what you hear." },
  { q: "Can I share it before launch?", a: "Yes. Turn on a public link, or keep it private until you are ready. You can also put a password on a share and embed the player in docs." },
  { q: "What does it cost to start?", a: "Create an account and build the first demo in the studio. Recording time is metered each month, and the meter is visible in Settings before you hit the cap." },
  { q: "What if my app’s buttons move?", a: "Re-record the failed steps, or run a health check. Previous frames stay in place so the shared demo does not break while you fix a selector." },
];

const PREVIEW_STEPS = [
  { label: "Open the app", status: "Captured", tone: "text-slate-500" },
  { label: "Add a task", status: "Voice ready", tone: "text-slate-500" },
  { label: "Show the result", status: "Share", tone: "text-cyan-300" },
];

function Wordmark({ to = "/", testId = "landing-logo" }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-display font-bold tracking-tight" data-testid={testId}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500/20 text-cyan-300 ring-1 ring-indigo-400/30">
        <Clapperboard className="h-4 w-4" />
      </span>
      AppShowcase
    </Link>
  );
}

function Shot({ src, alt, caption, eager = false }) {
  return (
    <figure className="surface overflow-hidden">
      <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} className="block w-full h-auto" />
      {caption && <figcaption className="border-t border-white/5 px-4 py-3 text-sm text-slate-400">{caption}</figcaption>}
    </figure>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const [contact, setContact] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => { document.title = "AppShowcase | Narrated product demos"; }, []);
  const startHref = user ? "/dashboard" : "/login?mode=register";
  const startLabel = user ? "Open studio" : "Start free";

  const submitContact = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent(`AppShowcase — ${contact.name || "New note"}`);
    const body = encodeURIComponent(`${contact.message}\n\n${contact.name}\n${contact.email}`);
    window.location.href = `mailto:hello@solopreneur.solutions?subject=${subject}&body=${body}`;
    setSent(true);
  };

  const closeMenu = () => setMenu(false);

  return (
    <div className="min-h-screen relative z-10" data-testid="landing-page">
      <header className="sticky top-0 z-30 bg-[hsl(232_45%_5%/0.88)] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/80 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.9)]">
          <div className="h-16 px-3 sm:px-4 flex items-center justify-between gap-3">
            <Wordmark />
            <nav className="hidden md:flex items-center gap-1 text-sm text-slate-300" data-testid="landing-nav">
              <a href="#features" className="rounded-full px-3 py-1.5 hover:bg-white/5 hover:text-white">Features</a>
              <a href="#how" className="rounded-full px-3 py-1.5 hover:bg-white/5 hover:text-white">How it works</a>
              <a href="#faq" className="rounded-full px-3 py-1.5 hover:bg-white/5 hover:text-white">FAQ</a>
              <a href="#contact" className="rounded-full px-3 py-1.5 hover:bg-white/5 hover:text-white">Contact</a>
            </nav>
            <div className="flex items-center gap-2 shrink-0">
              {!user && <Link to="/login" className="!hidden sm:!inline-flex nav-pill whitespace-nowrap" data-testid="landing-sign-in">Sign in</Link>}
              <Link to={startHref} className="btn-primary h-9 px-3 text-sm whitespace-nowrap" data-testid="landing-header-cta">{startLabel}</Link>
              <button
                type="button"
                className="md:hidden h-9 px-3 rounded-lg border border-white/10 text-sm text-slate-300 whitespace-nowrap"
                aria-expanded={menu}
                aria-controls="landing-nav-mobile"
                onClick={() => setMenu((v) => !v)}
                data-testid="landing-menu"
              >
                Menu
              </button>
            </div>
          </div>
          {menu && (
            <nav id="landing-nav-mobile" className="md:hidden border-t border-white/5 px-3 py-3 grid grid-cols-2 gap-2 text-sm" data-testid="landing-nav-mobile">
              <a href="#features" className="rounded-lg px-3 py-2 hover:bg-white/5" onClick={closeMenu}>Features</a>
              <a href="#how" className="rounded-lg px-3 py-2 hover:bg-white/5" onClick={closeMenu}>How it works</a>
              <a href="#faq" className="rounded-lg px-3 py-2 hover:bg-white/5" onClick={closeMenu}>FAQ</a>
              <a href="#contact" className="rounded-lg px-3 py-2 hover:bg-white/5" onClick={closeMenu}>Contact</a>
              {!user && <Link to="/login" className="rounded-lg px-3 py-2 hover:bg-white/5 sm:hidden" onClick={closeMenu}>Sign in</Link>}
            </nav>
          )}
        </div>
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-8 lg:pt-16 lg:pb-12 grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-10 lg:gap-14 items-center">
          <div>
            <p className="eyebrow mb-4">Product demos without the screen-recording grind</p>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.02]" data-testid="landing-hero-title">
              Show the product.<br />Skip the meeting.
            </h1>
            <p className="mt-5 text-lg text-slate-300 max-w-xl leading-relaxed">
              AppShowcase turns a written spec into a narrated walkthrough of your live app. Share a player, a GIF, or an MP4 that a buyer can watch before they ever book time with you.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={startHref} className="btn-primary" data-testid="landing-hero-cta">
                {startLabel} <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#how" className="h-11 px-4 inline-flex items-center rounded-xl border border-slate-700 text-sm hover:bg-slate-900" data-testid="landing-how-link">See how it works</a>
            </div>
            <p className="mt-4 text-sm text-slate-500">Free to create an account. Your first demo starts from a spec, not a blank timeline.</p>
          </div>
          <div data-testid="landing-preview">
            <div className="mb-3 flex items-center justify-between px-1 text-xs text-slate-400">
              <span className="font-mono tracking-wide uppercase">Studio</span>
              <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Live recording</span>
            </div>
            <Shot
              eager
              src="/appshowcase-hero.jpeg"
              alt="AppShowcase studio recording a live product in the browser, with captions and a voiceover timeline"
              caption="Spec, script, record, narrate, and share stay in one studio."
            />
            <ol className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              {PREVIEW_STEPS.map((step, index) => (
                <li key={step.label} className="surface px-3 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-slate-300">{index + 1} · {step.label}</span>
                  <span className={step.tone}>{step.status}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="scroll-mt-32 border-y border-white/5 bg-slate-950/35" data-testid="landing-features">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div>
                <p className="eyebrow mb-3">From spec to share link</p>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything between the spec and the share link</h2>
                <p className="mt-4 text-slate-400 max-w-xl leading-relaxed">The studio is where you edit the timeline. A written spec becomes a recorded walkthrough, then a player or a file your team can send.</p>
              </div>
              <Shot
                src="/appshowcase-spec.jpeg"
                alt="Diagram of a product spec flowing through browser automation into a shareable player and a video export"
                caption="One path: write it, record it, hand someone a player or a video."
              />
            </div>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <article key={title} className="surface p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/20">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-32" data-testid="landing-how">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20 grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-10 lg:gap-14 items-center">
            <div>
              <p className="eyebrow mb-3">How it works</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Three moves to a demo you can send</h2>
              <ol className="mt-8 space-y-3">
                {STEPS.map((step) => (
                  <li key={step.n} className="surface p-5 flex gap-4">
                    <span className="font-mono text-sm text-cyan-300 shrink-0 pt-0.5">{step.n}</span>
                    <div>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <Shot
              src="/appshowcase-player.jpeg"
              alt="A narrated product player inside an email, with captions on and a short note to the team"
              caption="What arrives in the inbox: a player, captions, and a note. No meeting on the calendar."
            />
          </div>
        </section>

        <section id="faq" className="scroll-mt-32 border-t border-white/5" data-testid="landing-faq">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
            <div className="max-w-2xl">
              <p className="eyebrow mb-3">FAQ</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Questions people ask before they start</h2>
            </div>
            <div className="mt-8 grid md:grid-cols-2 gap-3">
              {FAQS.map((item) => (
                <details key={item.q} className="surface px-5 py-4 group self-start">
                  <summary className="cursor-pointer font-medium list-none flex items-center justify-between gap-4">
                    {item.q}
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/10 text-slate-400 group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-32" data-testid="landing-contact">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-4 items-stretch">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Tell us what you want to showcase</h2>
              <p className="mt-3 text-slate-400 max-w-xl">Send a note to Solopreneur Solutions. Your mail app opens with the message filled in, addressed to hello@solopreneur.solutions.</p>
              <form onSubmit={submitContact} className="surface mt-6 p-5 sm:p-6 space-y-3" data-testid="landing-contact-form">
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-slate-400">Name</span>
                    <input required value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder="Ada Lovelace" className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm" data-testid="contact-name" />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-slate-400">Work email</span>
                    <input required type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="ada@company.com" className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm" data-testid="contact-email" />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-slate-400">Message</span>
                  <textarea required rows={4} value={contact.message} onChange={(e) => setContact({ ...contact, message: e.target.value })} placeholder="Which product should the first demo walk through?" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" data-testid="contact-message" />
                </label>
                <button type="submit" className="btn-primary" data-testid="contact-submit"><Mail className="h-4 w-4" /> Send a note</button>
                {sent && <p className="text-sm text-emerald-300" data-testid="contact-sent">Your mail app should open with this note. If it does not, write to hello@solopreneur.solutions.</p>}
              </form>
            </div>
            <div className="surface p-8 sm:p-10 flex flex-col justify-between gap-8 bg-gradient-to-br from-indigo-500/15 via-transparent to-cyan-400/10">
              <div>
                <p className="eyebrow mb-3">Start in the studio</p>
                <h2 className="text-3xl font-bold tracking-tight">Put a demo in someone’s inbox today.</h2>
                <p className="mt-3 text-slate-300 leading-relaxed">Start from a spec. Leave with a player they can click through.</p>
              </div>
              <Link to={startHref} className="btn-primary self-start" data-testid="landing-footer-cta">
                {startLabel} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5" data-testid="landing-footer">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid sm:grid-cols-3 gap-8 text-sm">
          <div>
            <Wordmark testId="landing-footer-logo" />
            <p className="mt-3 text-slate-500 max-w-xs">A product of Solopreneur Solutions. Narrated demos of the software you already ship.</p>
          </div>
          <div className="space-y-2 text-slate-400">
            <p className="font-medium text-slate-200">Product</p>
            <a href="#features" className="block hover:text-white">Features</a>
            <a href="#how" className="block hover:text-white">How it works</a>
            <a href="#faq" className="block hover:text-white">FAQ</a>
            <Link to="/help" className="block hover:text-white">Help</Link>
          </div>
          <div className="space-y-2 text-slate-400">
            <p className="font-medium text-slate-200">Contact</p>
            <a href="mailto:hello@solopreneur.solutions" className="block hover:text-white" data-testid="footer-email">hello@solopreneur.solutions</a>
            <a href="#contact" className="block hover:text-white">Write to us</a>
            <Link to="/login" className="block hover:text-white">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
