'use client';

import { useEffect, useState } from 'react';

export default function Gallery({ photos, title }) {
  const [open, setOpen] = useState(-1);

  useEffect(() => {
    if (open < 0) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(-1);
      if (e.key === 'ArrowRight') setOpen((i) => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft') setOpen((i) => (i - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, photos.length]);

  if (!photos.length) {
    return <div className="card pad muted" style={{ textAlign: 'center' }}>Fotos em breve</div>;
  }

  const shown = photos.slice(0, 5);
  return (
    <>
      <div className="gallery" style={shown.length === 1 ? { gridTemplateColumns: '1fr' } : undefined}>
        {shown.map((src, i) => (
          <button key={src + i} className={i === 0 ? 'main' : 'thumb'} onClick={() => setOpen(i)} aria-label={`Abrir foto ${i + 1}`}>
            <img src={src} alt={`${title} – foto ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} />
          </button>
        ))}
      </div>
      {photos.length > 1 && (
        <p style={{ marginTop: 8 }}>
          <button className="btn ghost small" onClick={() => setOpen(0)}>Ver todas as {photos.length} fotos</button>
        </p>
      )}
      {open >= 0 && (
        <div className="lightbox" onClick={() => setOpen(-1)} role="dialog" aria-modal="true">
          <button className="close" onClick={() => setOpen(-1)}>Fechar ✕</button>
          <button className="nav prev" aria-label="Anterior" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + photos.length) % photos.length); }}>‹</button>
          <img src={photos[open]} alt={`${title} – foto ${open + 1}`} onClick={(e) => e.stopPropagation()} />
          <button className="nav next" aria-label="Próxima" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % photos.length); }}>›</button>
          <span className="count">{open + 1} / {photos.length}</span>
        </div>
      )}
    </>
  );
}
