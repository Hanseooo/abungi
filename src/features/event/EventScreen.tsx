import { useAppStore, currentEvent } from '../../app/appStore';
import { canChooseEvent } from '../../game/core/progression/events';
import { GameHeader } from '../../ui/components/GameHeader';
import { PaperButton } from '../../ui/components/PaperButton';

export function EventScreen(){
  const run=useAppStore(s=>s.run)!;const event=currentEvent(run);const choose=useAppStore(s=>s.chooseEvent);const result=useAppStore(s=>s.eventResult);const finish=useAppStore(s=>s.finishEvent);const error=useAppStore(s=>s.error);
  if(!event)return null;
  return <main className={`screen event-screen event-theme-${event.theme}`}><GameHeader title={event.title} subtitle="Read the consequence before choosing. Event randomness is seeded, so refreshing cannot fish for a better result."/>
    <section className="event-theatre"><div className="event-backdrop" aria-hidden="true"><i className="event-shape a"/><i className="event-shape b"/><i className="event-shape c"/><i className="event-prop"/></div><div className="event-poster"><span className="event-kicker">ROADSIDE EVENT</span><p className="event-copy">{event.text}</p>{result?<div className="event-result"><strong>RESULT</strong><p>{result}</p><PaperButton variant="ink" onClick={finish}>BACK TO ROUTE</PaperButton></div>:<div className="event-choices">{event.choices.map(c=>{const legality=canChooseEvent(run,event.id,c.id);return <button key={c.id} disabled={!legality.allowed} title={legality.reason} onClick={()=>void choose(c.id)}><strong>{c.label}</strong><span>{c.hint}</span><em>{legality.allowed?'CHOOSE':legality.reason}</em></button>})}</div>}{error&&<p className="inline-error" role="alert">{error}</p>}</div></section>
  </main>;
}
