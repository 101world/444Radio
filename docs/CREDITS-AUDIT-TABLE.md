# 444Radio — Complete Credits Audit Table

> Last updated: Session 6 (pre-launch audit)

---

## Credit Deductions (All Functions & Costs)

| Feature | API Route | Cost | Key Parameters | Notes |
|---|---|---|---|---|
| **Image Gen (legacy)** | `/api/generate/route.ts` | **1 cr** | prompt | Type: `generation_image` |
| **Image Gen (standalone)** | `/api/generate/image-only` | **1 cr** | prompt | Refunds on failure |
| **Music Gen (MiniMax)** | `/api/generate/music-only` | **2 cr** (+1 optional) | prompt, title, lyrics, duration, generateCoverArt | +1 for auto cover art if user has ≥1 credit remaining |
| **Sound Effects** | `/api/generate/effects` | **2 cr** | prompt, duration | SFX generation |
| **Loopers** | `/api/generate/loopers` | **6–7 cr** | prompt, max_duration, bpm | 6 if ≤10s; 7 if >10s |
| **Autotune** | `/api/generate/autotune` | **1 cr** | audio_file, scale, output_format | Pitch-correction via Replicate |
| **Audio Boost (Mix & Master)** | `/api/generate/audio-boost` | **1 cr** | audioUrl, bass/treble/volume boost | BOOST_COST = 1 |
| **Video-to-Audio** | `/api/generate/video-to-audio` | **4 cr** | prompt, videoUrl | Fixed cost, no HQ option |
| **Extract Video Audio** | `/api/generate/extract-video-audio` | **1 cr** | videoUrl, trackTitle | EXTRACT_COST = 1 |
| **Extract Audio Stem** | `/api/generate/extract-audio-stem` | **1 cr** | audioUrl, stem, model_name | Single stem extraction |
| **Visualizer (Video)** | `/api/generate/visualizer` | **2–62 cr** | duration (2-12s), resolution (480p/720p/1080p), generateAudio | Cost = ⌈duration × costPerSec × 1.5 / $0.035⌉ |
| **Stem Split** | `/api/audio/split-stems` | **0–5 cr** | stem, model, output_format, wav_format | See Stem Split Pricing below |
| **Audio-to-Audio (remix)** | `/api/generate/audio-to-audio` | **2 cr** (TODO) | prompt, audioUrl | Deduction may be incomplete |
| **Earn — List Track** | `/api/earn/list` | **2 cr** | trackId | LISTING_FEE = 2 |
| **Earn — Purchase Track** | `/api/earn/purchase` | **5–6 cr** | trackId, splitStems | Base 5 (1→artist, 4→admin); +1 if splitStems |
| **Quest Pass** | `/api/quests/purchase-pass` | **30 cr** | — | 30-day quest access |

### Stem Split Pricing Detail

| Tier | Model | Per-Stem Cost | Conditions |
|---|---|---|---|
| **444 Core** | htdemucs (4 stems) | **FREE (0 cr)** | int16 or int24 WAV output |
| **444 Core** | htdemucs (4 stems) | **1 cr** | float32 WAV, MP3, or FLAC output |
| **444 Extended** | htdemucs_6s (6 stems) | **1 cr** | All formats (always 1 cr) |
| **444 Heat** | All stems at once | **5 cr flat** | Splits all stems in one go |

### Plugin Unified Route Costs (`/api/plugin/generate`)

| Type | Cost | Notes |
|---|---|---|
| music | 2 cr | MiniMax |
| image | 1 cr | Cover art |
| effects | 2 cr | SFX |
| loops | 6–7 cr | Duration-dependent |
| stems | 0–5 cr | Same as stem split pricing |
| extract | 1 cr | Single stem |
| audio-boost | 1 cr | Mix & master |
| extract-video | 1 cr | Video → audio |
| video-to-audio | 2–10 cr | 2 normal, 10 HQ |
| autotune | 1 cr | Pitch correction |

### Studio Route Costs

| Type | Route | Cost |
|---|---|---|
| Song Gen | `/api/studio/generate-song` | 2 cr |
| Beat Gen | `/api/studio/generate-beat` | 2 cr |
| AI Effect | `/api/studio/ai-effect` | 1 cr |
| Autotune | `/api/studio/autotune` | 1 cr |
| Stem Split | `/api/studio/split-stems` | 0–1 cr |

---

## Credit Awards (Income Sources)

| Source | Route / Mechanism | Amount | Notes |
|---|---|---|---|
| **Decrypt Puzzle** | `/api/credits/award` | **+20 cr** | One-time per user; code: "FREE THE MUSIC" |
| **Quest Rewards** | `/api/quests/claim` | **+varies** | Amount from quest DB; type: `quest_reward` |
| **Earn — Track Sale** | `/api/earn/purchase` | **+1 cr** | Artist receives 1 credit per sale |
| **Wallet Deposit (Razorpay)** | `/api/credits/purchase` → verify → webhook | **+$X to wallet** | Rate: 1 credit = $0.035 USD |
| **Wallet → Credit Conversion** | `/api/wallet/convert` | **+floor(amount/$0.035)** | Requires >$1.00 locked minimum |
| **Admin Subscription** | `/api/admin/activate-subscription` | **+N cr** | Admin-only manual award |
| **Refunds** | Various generate routes | **+cost refunded** | Auto-refund on generation failure/timeout |

---

## System Rules

1. **$1 Wallet Gate**: `deduct_credits` RPC requires `wallet_balance ≥ $1.00` before allowing any deduction
2. **Atomic Deductions**: All routes use `deduct_credits` RPC to prevent race conditions
3. **Refund on Failure**: All generation routes refund credits if Replicate fails, times out, or is cancelled
4. **Transaction Logging**: Every deduction/award logged to `credit_transactions` table with type, description, metadata
5. **Artist Self-Play**: Artists don't count toward their own play tracking (prevents inflation)
