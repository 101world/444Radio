'use client';

import { useEffect, useRef, useState } from 'react';
import createAudioScheduler from '@/lib/audio/AudioScheduler';

const scheduler = createAudioScheduler();

function formatTime(sec = 0) {
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function MultiTrackStudio() {
  const [tracks, setTracks] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [zoom, setZoom] = useState(50);
  const rafRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (tracks.length === 0) {
      setTracks([{ id: 't-1', name: 'Track 1', clips: [] }]);
    }
  }, []);

  useEffect(() => {
    function loop(ts) {
      if (ts - lastUpdateRef.current > 33) {
        const ph = scheduler.getPlayhead();
        setPlayhead(ph);
        lastUpdateRef.current = ts;
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyS') {
        stop();
      } else if (e.code === 'KeyT') {
        addTrack();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tracks, isPlaying]);

  function addTrack() {
    const t = { id: 't-' + Date.now(), name: `Track ${tracks.length + 1}`, clips: [] };
    setTracks(prev => [...prev, t]);
  }

  async function addClipToTrack(trackId) {
    const url = prompt('Paste audio URL (http(s)://...) to attach as clip');
    if (!url) return;
    const start = parseFloat(prompt('Start position in project (seconds)', String(Math.floor(playhead)))) || 0;
    const newClip = { id: 'c-' + Date.now(), url, start, duration: 0 };
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t));
    try {
      await scheduler.loadBuffer(url);
      console.log('buffer loaded');
    } catch (err) {
      console.warn('buffer load error', err);
      alert('Failed to load audio (CORS or invalid URL). Check console.');
    }
  }

  async function togglePlay() {
    if (!isPlaying) {
      scheduler.setPlayheadPositionManual(playhead);
      const flatClips = tracks.flatMap(t => t.clips);
      await scheduler.play(flatClips);
      setIsPlaying(true);
    } else {
      scheduler.pause();
      setIsPlaying(false);
    }
  }

  function stop() {
    scheduler.stop();
    setIsPlaying(false);
    setPlayhead(0);
    scheduler.setPlayheadPositionManual(0);
  }

  function seekTo(seconds) {
    scheduler.seek(seconds, tracks.flatMap(t => t.clips));
    setPlayhead(seconds);
  }

  function pxForSeconds(sec) {
    return sec * zoom;
  }

  return (
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', background: '#0b0b0b', color: '#fff' }}>
      <header style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #111' }}>
        <div>
          <h2 style={{ margin: 0 }}>444 Radio — Studio</h2>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Space = Play/Pause • S = Stop • T = New Track</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div>Playhead: <strong>{formatTime(playhead)}</strong></div>
          <button onClick={togglePlay} style={{ padding: '8px 12px', background: '#1db954', border: 0, color: '#000', borderRadius: 6, cursor: 'pointer' }}>{isPlaying ? 'Pause' : 'Play'}</button>
          <button onClick={stop} style={{ padding: '8px 12px', background: '#ff6b6b', border: 0, color: '#000', borderRadius: 6, cursor: 'pointer' }}>Stop</button>
          <button onClick={() => addTrack()} style={{ padding: '8px 12px', background: '#444', border: 0, color: '#fff', borderRadius: 6, cursor: 'pointer' }}>+ Track</button>
        </div>
      </header>

      <main style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <aside style={{ width: 220, borderRight: '1px solid #111', padding: 12, boxSizing: 'border-box', background: '#070707', overflowY: 'auto' }}>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#bbb' }}>Tracks</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tracks.map(t => (
              <div key={t.id} style={{ padding: 8, background: '#0f0f0f', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>{t.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{t.clips.length} clips</div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <button style={{ padding: '6px 8px', width: '100%', cursor: 'pointer' }} onClick={() => addClipToTrack(t.id)}>+ Clip (URL)</button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
          <div style={{ height: 48, borderBottom: '1px solid #111', background: '#080808', display: 'flex', alignItems: 'center', paddingLeft: 8, position: 'sticky', top: 0, zIndex: 10 }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {Array.from({ length: 121 }).map((_, i) => (
                <div key={i} style={{ width: pxForSeconds(1), textAlign: 'center', fontSize: 11, color: '#888', borderRight: '1px solid #0b0b0b' }}>
                  {i % 5 === 0 ? i : ''}
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: 12 }}>
            {tracks.map((t, idx) => (
              <div key={t.id} style={{ height: 84, marginBottom: 12, background: idx % 2 === 0 ? '#0f0f0f' : '#0b0b0b', borderRadius: 6, padding: 8, position: 'relative' }}>
                <div style={{ position: 'absolute', left: 8, top: 8, fontSize: 12, color: '#ccc' }}>{t.name}</div>

                <div style={{ marginLeft: 120, height: 56, position: 'relative', overflow: 'hidden', borderRadius: 6 }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(255,255,255,0.01) 1px, transparent 1px)', backgroundSize: `${pxForSeconds(1)}px 100%` }} />

                  {t.clips.map(c => {
                    const left = pxForSeconds(c.start || 0);
                    const width = pxForSeconds(c.duration && c.duration > 0 ? c.duration : 8);
                    return (
                      <div key={c.id} style={{
                        position: 'absolute', left, top: 6, height: 44,
                        width: Math.max(40, width),
                        background: 'linear-gradient(90deg,#00b894,#00d1a6)',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 8,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                        cursor: 'pointer'
                      }}>
                        <div style={{ fontSize: 12, color: '#001' }}>{c.url.split('/').pop().slice(0, 12)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            position: 'absolute',
            left: pxForSeconds(playhead),
            top: 48,
            bottom: 0,
            width: 2,
            background: 'linear-gradient(180deg,#fff,#ff0)',
            transform: 'translateX(-1px)',
            pointerEvents: 'none'
          }} />

          <div style={{ position: 'absolute', left: 0, right: 0, top: 48, bottom: 0 }} onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const seconds = clickX / zoom;
            seekTo(seconds);
          }} />
        </section>

        <aside style={{ width: 300, borderLeft: '1px solid #111', padding: 12, background: '#070707' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: '#bbb' }}>Controls</div>
            <div style={{ marginTop: 8 }}>{isPlaying ? 'Playing' : 'Stopped'}</div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Zoom:</div>
              <input type="range" min="20" max="200" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, color: '#bbb', marginBottom: 6 }}>Quick Actions</div>
            <button style={{ width: '100%', marginBottom: 8, padding: '8px', cursor: 'pointer' }} onClick={async () => {
              const url = prompt('Paste generated asset URL (for test)');
              if (!url) return;
              const newTrack = { id: 't-' + Date.now(), name: 'Gen ' + (tracks.length + 1), clips: [{ id: 'c-' + Date.now(), url, start: Math.floor(playhead), duration: 0 }] };
              setTracks(prev => [...prev, newTrack]);
              try { await scheduler.loadBuffer(url); } catch (e) { console.warn(e); }
            }}>Attach Generated Asset</button>
            <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>Use this to simulate webhook → attaches new track with clip at current playhead.</div>
          </div>
        </aside>
      </main>
    </div>
  );
}
