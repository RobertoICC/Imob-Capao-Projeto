'use client';

import { useState } from 'react';
import { toISO, fromISO, todayISO, addDays } from '@/lib/format';

const DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function monthDays(year, month) {
  const first = new Date(year, month, 1);
  const days = [];
  for (let i = 0; i < first.getDay(); i++) days.push(null);
  const last = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= last; d++) days.push(toISO(new Date(year, month, d)));
  return days;
}

/**
 * Calendário de 2 meses para escolher entrada/saída.
 * busy: Set de noites ocupadas ('YYYY-MM-DD').
 */
export default function Calendar({ busy, checkIn, checkOut, onChange, allowPast = false }) {
  const start = checkIn ? fromISO(checkIn) : new Date();
  const [cursor, setCursor] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const today = todayISO();

  function rangeFree(a, b) {
    for (let d = a; d < b; d = addDays(d, 1)) if (busy.has(d)) return false;
    return true;
  }

  function click(day) {
    if (!checkIn || (checkIn && checkOut)) {
      if (busy.has(day)) return;
      onChange(day, '');
      return;
    }
    if (day <= checkIn) {
      if (busy.has(day)) return;
      onChange(day, '');
      return;
    }
    if (rangeFree(checkIn, day)) onChange(checkIn, day);
    else if (!busy.has(day)) onChange(day, '');
  }

  function shift(n) {
    const d = new Date(cursor.y, cursor.m + n, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  }

  const months = [0, 1].map((i) => {
    const d = new Date(cursor.y, cursor.m + i, 1);
    return { y: d.getFullYear(), m: d.getMonth(), label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) };
  });

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" onClick={() => shift(-1)} aria-label="Mês anterior">‹</button>
        <span className="small muted">
          {!checkIn ? 'Escolha a data de entrada' : !checkOut ? 'Agora escolha a data de saída' : 'Datas selecionadas'}
        </span>
        <button type="button" onClick={() => shift(1)} aria-label="Próximo mês">›</button>
      </div>
      <div className="cal-months">
        {months.map((mo, idx) => (
          <div key={mo.label} className={idx === 1 ? 'm2' : ''}>
            <div className="cal-title">{mo.label}</div>
            <div className="cal-grid">
              {DOW.map((d, i) => <span key={i} className="dow">{d}</span>)}
              {monthDays(mo.y, mo.m).map((day, i) => {
                if (!day) return <span key={'e' + i} />;
                const past = !allowPast && day < today;
                const isBusy = busy.has(day);
                const isEdge = day === checkIn || day === checkOut;
                const inRange = checkIn && checkOut && day > checkIn && day < checkOut;
                // dia ocupado ainda pode ser a SAÍDA (a noite anterior está livre)
                const canBeCheckout = checkIn && !checkOut && day > checkIn && rangeFree(checkIn, day);
                const disabled = past || (isBusy && !canBeCheckout);
                const cls = [past ? 'past' : '', isBusy ? 'busy' : '', inRange ? 'inrange' : '', isEdge ? 'edge' : '']
                  .filter(Boolean).join(' ');
                return (
                  <button type="button" key={day} className={cls} disabled={disabled} onClick={() => click(day)}
                    title={isBusy ? 'Ocupado' : undefined}>
                    {Number(day.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="cal-legend">
        <span><i style={{ background: 'var(--red-soft)' }} />Ocupado</span>
        <span><i style={{ background: 'var(--ocean)' }} />Entrada/saída</span>
        <span><i style={{ background: 'var(--blue-soft)' }} />Sua estadia</span>
      </div>
    </div>
  );
}
