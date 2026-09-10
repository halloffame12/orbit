import React from "react";

const DOWNLOAD_URL = "https://github.com/halloffame12/orbit/releases/latest/download/Orbit.Setup.exe";
const PORTABLE_URL = "https://github.com/halloffame12/orbit/releases/latest/download/Orbit.Portable.exe";

const FEATURES = [
  {
    icon: "🕶",
    title: "Completely invisible",
    body: "Runs on your machine and loops back your own mic — nothing is uploaded to the cloud during your call.",
  },
  {
    icon: "🛡",
    title: "Screen-share proof",
    body: "The overlay window is excluded at the OS level (SetWindowDisplayAffinity), so it physically cannot appear in a recording or share.",
  },
  {
    icon: "🎙",
    title: "Hears both sides",
    body: "Captures your microphone and system audio simultaneously — it knows who just asked the question and answers in real time.",
  },
  {
    icon: "🏗",
    title: "Builds your talking points",
    body: "Behavioral mode answers the interviewer with concise STAR bullets you can read at a glance.",
  },
  {
    icon: "⌨",
    title: "Coding-round solver",
    body: "Press one hotkey to capture the problem statement, get complexity, intuition, a solution, and edge cases — within seconds.",
  },
  {
    icon: "🔐",
    title: "Your keys, your model",
    body: "BYO API keys: OpenAI, Gemini, Claude, or your own local model. Keys are encrypted with Windows DPAPI.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Download",
    body: "Get the Windows installer or portable .exe. No admin rights or dependencies required.",
  },
  {
    n: "02",
    title: "Add a key",
    body: "Paste your provider API key (or point it at a local OpenAI-compatible server) in Settings.",
  },
  {
    n: "03",
    title: "Start a call",
    body: "Orbit sits above your screen, invisible to cameras. It transcribes the interviewer and streams notes in real time.",
  },
];

export default function App() {
  return (
    <div className="min-h-screen">
      <Nav />
      <Hero />
      <Logos />
      <Features />
      <Steps />
      <Privacy />
      <Cta />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="fixed top-0 w-full z-50 bg-[#07070b]/80 backdrop-blur border-b border-white/5">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-semibold tracking-tight text-white">Orbit</span>
          <span className="mono text-[11px] text-neutral-500 mt-0.5">v1.0</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-neutral-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how" className="hover:text-white transition-colors">How it works</a>
          <a href="#privacy" className="hover:text-white transition-colors">Privacy</a>
          <a
            href="#download"
            className="ml-2 px-4 py-2 rounded-lg bg-[#00E5A0] text-black text-sm font-semibold hover:brightness-110 transition-all"
          >
            Download
          </a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-grid">
      <div className="absolute inset-0 glow-teal top-0 left-0" />
      <div className="absolute -right-40 top-1/3 w-[520px] h-[520px] rounded-full glow-teal" />

      <div className="max-w-6xl mx-auto px-6 py-32 relative">
        <div className="mono text-[12px] text-[#00E5A0] uppercase tracking-[0.3em] mb-6">
          Real-time AI copilot · Windows
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.05]">
          Your invisible
          <br />
          <span className="text-[#00E5A0]">interview</span> copilot.
        </h1>

        <p className="mt-6 max-w-xl text-lg text-neutral-400 leading-relaxed">
          Orbit listens to both sides of your interview and streams concise, on-message
          answers onto a screen-share-proof overlay — for behavioral rounds and live
          coding alike.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href="#download"
            className="px-7 py-3.5 rounded-xl bg-[#00E5A0] text-black font-semibold text-[15px] hover:brightness-110 transition-all shadow-[0_0_40px_rgba(0,229,160,0.35)]"
          >
            Download for Windows
          </a>
          <a
            href="#how"
            className="px-7 py-3.5 rounded-xl glass text-white font-medium text-[15px] hover:bg-white/10 transition-all"
          >
            See how it works ↓
          </a>
        </div>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-neutral-500">
          <span className="flex items-center gap-2"><Tick /> Installer + portable .exe</span>
          <span className="flex items-center gap-2"><Tick /> Free local STT option</span>
          <span className="flex items-center gap-2"><Tick /> NEVER appears on camera</span>
        </div>
      </div>
    </section>
  );
}

function Logos() {
  return (
    <div className="border-y border-white/5">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-neutral-500 mono">
        <span className="uppercase tracking-widest text-[11px] text-neutral-600">Works with</span>
        <span>OpenAI</span>
        <span>Google Gemini</span>
        <span>Anthropic Claude</span>
        <span>Ollama / Local</span>
        <span>Deepgram</span>
        <span>whisper.cpp</span>
      </div>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="py-28">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeading
          kicker="Features"
          title="Everything the interview throws at you — covered"
        />
        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="glass rounded-2xl p-7 hover:border-[#00E5A0]/30 hover:bg-white/[0.05] transition-all group"
            >
              <div className="text-3xl mb-4 group-hover:scale-110 transition-transform origin-left inline-block">
                {f.icon}
              </div>
              <h3 className="text-white font-semibold text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section id="how" className="py-28 relative bg-grid">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeading kicker="Getting started" title="Live in under three minutes" />
        <div className="mt-16 grid md:grid-cols-3 gap-10">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-8 left-1/2 w-full h-px bg-gradient-to-r from-white/20 to-transparent" />
              )}
              <div className="mono text-[#00E5A0] text-5xl font-bold opacity-80">{s.n}</div>
              <h3 className="mt-4 text-white font-semibold text-xl">{s.title}</h3>
              <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <section id="privacy" className="py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="glass rounded-3xl p-10 md:p-14 grid md:grid-cols-2 gap-10">
          <div>
            <SectionHeading
              kicker="Privacy"
              title="Designed so you can't be caught."
            />
            <p className="text-neutral-400 leading-relaxed">
              The overlay you read from is rendered in a window the OS explicitly
              excludes from capture. In any screen share or recording, that region is
              replaced by black — guaranteed at the Windows compositor level, before
              any app can see a frame.
            </p>
          </div>
          <div className="space-y-4 text-sm">
            {[
              ["OS-level hiding", "SetWindowDisplayAffinity with WDA_EXCLUDEFROMCAPTURE hides every window of the app on every capture path."],
              ["Keymaps & audio stay local", "Audio is transcribed on-device (optional local model) or via a provider you choose; hotkeys are handled locally."],
              ["Encrypted keys", "API keys are stored encrypted with the Windows Data Protection API — never plaintext on disk."],
              ["Open source", "No telemetry, no accounts. Review the code, or point it at a fully local stack."],
            ].map(([title, body]) => (
              <div key={title} className="glass rounded-xl p-5">
                <div className="text-[#00E5A0] font-semibold">{title}</div>
                <div className="mt-1 text-neutral-400">{body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section id="download" className="py-28">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <SectionHeading
          kicker="Download"
          title="Ready when you are."
        />
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <a
            href={DOWNLOAD_URL}
            className="px-8 py-4 rounded-xl bg-[#00E5A0] text-black font-semibold hover:brightness-110 transition-all shadow-[0_0_50px_rgba(0,229,160,0.4)]"
          >
            Download installer (.exe)
          </a>
          <a
            href={PORTABLE_URL}
            className="px-8 py-4 rounded-xl glass text-white font-medium hover:bg-white/10 transition-all"
          >
            Portable build (no install)
          </a>
        </div>
        <div className="mt-6 mono text-[12px] text-neutral-500">
          Windows 10/11 · x64 · BYO API key for hosted models
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 py-10">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-neutral-400">Orbit Copilot</span>
        </div>
        <div className="text-sm text-neutral-600">
          Built for candidates who run toward the hard questions.
        </div>
      </div>
    </footer>
  );
}

function SectionHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="max-w-2xl">
      <div className="mono text-[12px] text-[#00E5A0] uppercase tracking-[0.3em] mb-3">{kicker}</div>
      <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white">{title}</h2>
    </div>
  );
}

function Logo() {
  return (
    <div className="w-7 h-7 rounded-full border-2 border-[#00E5A0] relative">
      <div className="absolute w-2 h-2 rounded-full bg-[#00E5A0] -top-1 -right-0.5" />
    </div>
  );
}

function Tick() {
  return <span className="w-3.5 h-3.5 rounded-full bg-[#00E5A0]/20 grid place-items-center text-[10px] text-[#00E5A0]">✓</span>;
}